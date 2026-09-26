import type { ServicoRelatorio } from '../contratos'
import {
  ErroServico, type ConteudoRelatorio, type ObjetivoNoRelatorio, type PedidoRelatorio,
  type RelatorioEvolucao, type Sessao,
} from '../tipos'
import { percentualIndependente } from '../../dominio/regras'
import { resumoSha256 } from '../../dominio/hash'
import { exigirPacienteClinico } from './acesso'
import { auditar, banco, exigirValido, gerarId, naoEncontrado, paginar, relogio, responder } from './infra'

/**
 * Relatorio de evolucao (UC09, tela 10).
 *
 * Emitir grava o documento como ele saiu. Regenerar a partir dos dados de hoje
 * produziria outro documento — e a copia que a familia recebeu continuaria
 * sendo a de ontem. Por isso conteudoEmitido e hashConteudo, e por isso nao ha
 * operacao de reemitir.
 *
 * Sem autorId: quem emitiu fica na auditoria, como em confirmarDominio. O nome
 * e o registro no conselho vao impressos no documento, fixos na data em que
 * saiu — se o profissional mudar de nome depois, o documento nao muda.
 */

const soODia = (iso: string) => iso.slice(0, 10)

/** Sessoes encerradas do paciente dentro do periodo, em ordem de numero. */
function sessoesDoPeriodo(pacienteId: string, inicio: string, fim: string): Sessao[] {
  return banco.sessoes
    .filter((s) => s.pacienteId === pacienteId && s.situacao === 'ENCERRADA' && s.inicio)
    .filter((s) => soODia(s.inicio!) >= inicio && soODia(s.inicio!) <= fim)
    .sort((a, b) => a.numero - b.numero)
}

function montarConteudo(pacienteId: string, pedido: PedidoRelatorio): ConteudoRelatorio {
  const paciente = banco.pacientes.find((p) => p.id === pacienteId) ?? naoEncontrado('Paciente')
  const plano = banco.planos.find((p) => p.pacienteId === pacienteId)
  const sessoes = sessoesDoPeriodo(pacienteId, pedido.periodoInicio, pedido.periodoFim)

  const objetivos: ObjetivoNoRelatorio[] = pedido.objetivoIds.map((objetivoId) => {
    const objetivo = plano?.objetivos.find((o) => o.id === objetivoId)
    if (!objetivo) {
      throw new ErroServico('VALIDACAO', 'Um dos objetivos escolhidos não é do plano deste paciente.', {
        objetivoIds: 'Um dos objetivos escolhidos não é do plano deste paciente.',
      })
    }
    const percentuais = sessoes
      .map((s) => percentualIndependente(s.registros, objetivoId))
      .filter((p): p is number => p !== null)

    return {
      objetivoId,
      dominio: objetivo.dominio,
      // Regra 4: a equipe le a tecnica, a familia le a acessivel. As duas
      // redacoes existem gravadas separadamente justamente para isto.
      redacao: pedido.destinatario === 'FAMILIA'
        ? objetivo.descricaoAcessivel
        : objetivo.descricaoTecnica,
      criterio: { ...objetivo.criterio },
      sessoesNoPeriodo: percentuais.length,
      primeiroPercentual: percentuais[0] ?? null,
      ultimoPercentual: percentuais[percentuais.length - 1] ?? null,
      melhorPercentual: percentuais.length > 0 ? Math.max(...percentuais) : null,
      status: objetivo.status,
      dominadoEm: objetivo.dominadoEm,
    }
  })

  return {
    paciente: { id: paciente.id, nome: paciente.nome, dataNascimento: paciente.dataNascimento },
    periodoInicio: pedido.periodoInicio,
    periodoFim: pedido.periodoFim,
    destinatario: pedido.destinatario,
    consideracoes: pedido.consideracoes.trim(),
    objetivos,
    sessoesNoPeriodo: sessoes.length,
  }
}

/** Validacoes do pedido, comuns a previa e a emissao. */
function validarPedido(pedido: PedidoRelatorio): Record<string, string> {
  const erros: Record<string, string> = {}
  if (!pedido.periodoInicio || !pedido.periodoFim) {
    erros.periodo = 'Escolha o período do relatório.'
  } else if (pedido.periodoFim < pedido.periodoInicio) {
    erros.periodo = 'O fim do período não pode ser anterior ao início.'
  }
  if (pedido.objetivoIds.length === 0) {
    erros.objetivoIds = 'Escolha ao menos um objetivo para o relatório.'
  }
  return erros
}

export const relatoriosMock: ServicoRelatorio = {
  previsualizar: (pacienteId, pedido) => responder(() => {
    exigirPacienteClinico(pacienteId, 'RelatorioEvolucao')
    // A previa aceita consideracoes ainda vazias: elas sao exigidas ao emitir.
    exigirValido(validarPedido(pedido))
    return montarConteudo(pacienteId, pedido)
  }),

  emitir: (pacienteId, pedido) => responder(async () => {
    const { sessao } = exigirPacienteClinico(pacienteId, 'RelatorioEvolucao')
    const erros = validarPedido(pedido)
    if (!pedido.consideracoes.trim()) {
      erros.consideracoes = 'O relatório é a sua leitura clínica, não só os números. Escreva as suas considerações — elas não são geradas pelo sistema.'
    }
    exigirValido(erros)

    const autor = banco.profissionais.find((p) => p.id === sessao.usuario.id)
    const conteudoEmitido = montarConteudo(pacienteId, pedido)
    const relatorio: RelatorioEvolucao = {
      id: gerarId('rel'),
      pacienteId,
      objetivoIds: [...pedido.objetivoIds],
      periodoInicio: pedido.periodoInicio,
      periodoFim: pedido.periodoFim,
      destinatario: pedido.destinatario,
      consideracoes: conteudoEmitido.consideracoes,
      // Fotografia da emissao: nunca resolver pelo Usuario na leitura.
      autorNome: sessao.usuario.nome,
      autorRegistro: autor?.registroConselho ?? '—',
      emitidoEm: relogio.agora().toISOString(),
      conteudoEmitido,
      hashConteudo: await resumoSha256(conteudoEmitido),
    }
    banco.relatorios.push(relatorio)
    auditar(sessao, {
      acao: 'CRIACAO', entidade: 'RelatorioEvolucao', idEntidade: relatorio.id,
      pacienteId, detalhe: `Relatório emitido para ${pedido.destinatario === 'FAMILIA' ? 'a família' : 'a equipe'}.`,
    })
    return relatorio
  }),

  listarPorPaciente: (pacienteId, filtro = {}) => responder(() => {
    exigirPacienteClinico(pacienteId, 'RelatorioEvolucao')
    const itens = banco.relatorios
      .filter((r) => r.pacienteId === pacienteId)
      .sort((a, b) => b.emitidoEm.localeCompare(a.emitidoEm))
    return paginar(itens, filtro)
  }),

  obter: (relatorioId) => responder(() => {
    const relatorio = banco.relatorios.find((r) => r.id === relatorioId) ?? naoEncontrado('Relatório')
    const { sessao } = exigirPacienteClinico(relatorio.pacienteId, 'RelatorioEvolucao')
    auditar(sessao, {
      acao: 'LEITURA_AUTORIZADA', entidade: 'RelatorioEvolucao', idEntidade: relatorio.id,
      pacienteId: relatorio.pacienteId, detalhe: 'Relatório de evolução emitido.',
    })
    return relatorio
  }),
}
