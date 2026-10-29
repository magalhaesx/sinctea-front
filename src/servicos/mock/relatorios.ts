import type { ServicoRelatorio } from '@sinctea/compartilhado'
import { ErroServico, type ConteudoRelatorio, type PedidoRelatorio, type RelatorioEvolucao } from '@sinctea/compartilhado'
import { diaCivilEm } from '@sinctea/compartilhado/dominio/datas'
import { resumoSha256 } from '@sinctea/compartilhado/dominio/hash'
import {
  montarConteudoRelatorio, SEM_REGISTRO_NO_CONSELHO, validarPedidoRelatorio,
} from '@sinctea/compartilhado/dominio/relatorio'
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
 *
 * Item 18: a validacao do pedido e a montagem sao as do compartilhado
 * (dominio/relatorio.ts), as mesmas do servidor e da semente. No servidor, a
 * previa entra na trilha; aqui, como antes, nao.
 */

function montarConteudo(pacienteId: string, pedido: PedidoRelatorio, emitir: boolean): ConteudoRelatorio {
  exigirValido(validarPedidoRelatorio(pedido, diaCivilEm(relogio.agora()), { emitir }))
  const paciente = banco.pacientes.find((p) => p.id === pacienteId) ?? naoEncontrado('Paciente')
  const plano = banco.planos.find((p) => p.pacienteId === pacienteId) ?? null
  return montarConteudoRelatorio({
    paciente: { id: paciente.id, nome: paciente.nome, dataNascimento: paciente.dataNascimento },
    plano,
    sessoes: banco.sessoes.filter((s) => s.pacienteId === pacienteId),
    pedido,
  })
}

export const relatoriosMock: ServicoRelatorio = {
  previsualizar: (pacienteId, pedido) => responder(() => {
    exigirPacienteClinico(pacienteId, 'RelatorioEvolucao')
    // A previa aceita consideracoes ainda vazias: elas sao exigidas ao emitir.
    return montarConteudo(pacienteId, pedido, false)
  }),

  emitir: (pacienteId, pedido) => responder(async () => {
    const { sessao } = exigirPacienteClinico(pacienteId, 'RelatorioEvolucao')
    exigirValido(validarPedidoRelatorio(pedido, diaCivilEm(relogio.agora()), { emitir: true }))

    /*
     * O documento clinico carrega o nome e o registro no conselho de quem
     * assina. Sem registro preenchido nao se emite — e o sistema nao inventa
     * um, pela mesma razao da regra 4: nao se preenche no lugar do
     * profissional aquilo que so ele pode responder.
     */
    const autor = banco.profissionais.find((p) => p.id === sessao.usuario.id)
    if (!autor?.registroConselho.trim()) throw new ErroServico('CONFLITO', SEM_REGISTRO_NO_CONSELHO)
    const conteudoEmitido = montarConteudo(pacienteId, pedido, true)
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
      autorRegistro: autor.registroConselho.trim(),
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
