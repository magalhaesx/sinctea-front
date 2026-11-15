import type { ServicoIndicadores } from '@sinctea/compartilhado'
import type { AlertaAtencao, MotivoAtencao, Paciente } from '@sinctea/compartilhado'
import { consentimentoVigente, percentualIndependente } from '@sinctea/compartilhado/dominio/regras'
import {
  alertaConsentimentoVencendo, alertaObjetivoSemAvanco, alertaPacienteSemSessao, alertaPlanoSemRevisao, diaNaJanela,
  diasInteiros, horasAteLeitura, JANELA_CURTA_DIAS, JANELA_LONGA_DIAS, janelaFutura, janelaPassada, mediana, naJanela,
  ordenarAlertas, rotuloDeHoje, rotuloFuturo, rotuloPassado,
} from '@sinctea/compartilhado/dominio/indicadores'
import { auditar, banco, exigirPerfil, paginar, relogio, responder } from './infra'
import { ultimaSessaoDe } from './pacientes'

/**
 * Indicadores da coordenacao (tela 11). Conta e aponta, nao descreve: o que
 * sai daqui sao numeros, motivos e o identificador para chegar ao registro.
 * Nenhum texto clinico atravessa este servico — a tela nao teria como exibir
 * o que nao esta no tipo.
 *
 * O recorte (a janela em dias de Manaus, os rotulos), a ordem e os alertas sao
 * os de dominio/indicadores.ts, os mesmos do servidor (item 19); os limiares,
 * os de dominio/regras.ts.
 */

const pacientesAtivos = () => banco.pacientes.filter((p) => p.ativo)
const ativos = () => new Set(pacientesAtivos().map((p) => p.id))

const pessoa = (pacienteId: string) =>
  ({ id: pacienteId, nome: banco.pacientes.find((p) => p.id === pacienteId)?.nome ?? '—' })

/** Percentual de independencia por sessao encerrada em que o objetivo foi trabalhado, em ordem de numero. */
function percentuaisDoObjetivo(pacienteId: string, objetivoId: string): number[] {
  return banco.sessoes
    .filter((s) => s.pacienteId === pacienteId && s.situacao === 'ENCERRADA')
    .sort((a, b) => a.numero - b.numero)
    .map((s) => percentualIndependente(s.registros, objetivoId))
    .filter((p): p is number => p !== null)
}

const planosDeAtivos = () => {
  const deAtivos = ativos()
  return banco.planos.filter((p) => deAtivos.has(p.pacienteId))
}

const existe = <T>(x: T | null): x is T => x !== null

function alertas(motivo: MotivoAtencao, agora: Date): AlertaAtencao[] {
  switch (motivo) {
    case 'PLANO_SEM_REVISAO':
      return planosDeAtivos().map((plano) => alertaPlanoSemRevisao(plano, pessoa(plano.pacienteId), agora)).filter(existe)
    case 'PACIENTE_SEM_SESSAO':
      return pacientesAtivos().map((p: Paciente) => alertaPacienteSemSessao(pessoa(p.id), ultimaSessaoDe(p.id), agora)).filter(existe)
    case 'CONSENTIMENTO_VENCENDO': {
      const deAtivos = ativos()
      return banco.consentimentos
        .filter((c) => deAtivos.has(c.pacienteId))
        .map((c) => alertaConsentimentoVencendo(c, pessoa(c.pacienteId), agora))
        .filter(existe)
    }
    case 'OBJETIVO_SEM_AVANCO':
      return planosDeAtivos().flatMap((plano) => plano.objetivos.map((o) =>
        alertaObjetivoSemAvanco(o, plano.status, pessoa(plano.pacienteId), percentuaisDoObjetivo(plano.pacienteId, o.id))))
        .filter(existe)
  }
}

// ---------------------------------------------------------------- Servico

export const indicadoresMock: ServicoIndicadores = {
  resumo: () => responder(() => {
    exigirPerfil(['COORDENADOR'], 'Indicadores')
    const agora = relogio.agora()
    const semana = janelaPassada(agora, JANELA_CURTA_DIAS)
    const mes = janelaPassada(agora, JANELA_LONGA_DIAS)
    const adiante = janelaFutura(agora, JANELA_LONGA_DIAS)

    // Sessao que aconteceu e sessao encerrada: agendada nao conta como feita.
    const sessoes = banco.sessoes.filter((s) => s.situacao === 'ENCERRADA' && s.inicio && naJanela(s.inicio, semana))

    const dominados = planosDeAtivos().flatMap((p) => p.objetivos)
      .filter((o) => o.dominadoEm !== null && naJanela(o.dominadoEm, mes))

    // So o plano vigente tem revisao a cumprir.
    const revisoes = planosDeAtivos().filter((p) => p.status === 'VIGENTE' && diaNaJanela(p.dataRevisao, adiante))

    return {
      // Clinica sem nenhuma sessao registrada nao tem indicador para mostrar.
      temDados: banco.sessoes.length > 0,
      pacientesEmAcompanhamento: { valor: pacientesAtivos().length, periodo: rotuloDeHoje(agora) },
      sessoesUltimos7Dias: { valor: sessoes.length, periodo: rotuloPassado(agora, JANELA_CURTA_DIAS) },
      objetivosDominadosUltimos30Dias: { valor: dominados.length, periodo: rotuloPassado(agora, JANELA_LONGA_DIAS) },
      planosComRevisaoProximos30Dias: { valor: revisoes.length, periodo: rotuloFuturo(agora, JANELA_LONGA_DIAS) },
    }
  }),

  listarAlertas: (motivo, filtro = {}) => responder(() => {
    const sessao = exigirPerfil(['COORDENADOR'], 'Indicadores')
    const agora = relogio.agora()

    // Das quatro operacoes, so esta nomeia pacientes, e e registrada como
    // leitura autorizada uma vez por chamada. Ela nao leva pacienteId de
    // proposito: o alerta aponta, nao descreve. A leitura de cada paciente e
    // auditada no destino — ficha, plano ou evolucao —, com pacienteId, quando
    // a coordenacao abre o registro.
    auditar(sessao, {
      acao: 'LEITURA_AUTORIZADA', entidade: 'Indicadores', idEntidade: motivo,
      detalhe: 'Alertas do painel da coordenação.',
    })
    return paginar(ordenarAlertas(alertas(motivo, agora), motivo), filtro)
  }),

  sessoesPorProfissional: () => responder(() => {
    exigirPerfil(['COORDENADOR'], 'Indicadores')
    const agora = relogio.agora()
    const mes = janelaPassada(agora, JANELA_LONGA_DIAS)
    const feitas = banco.sessoes.filter((s) => s.situacao === 'ENCERRADA' && s.inicio && naJanela(s.inicio, mes))

    const itens = banco.profissionais
      .map((prof) => ({
        profissional: { id: prof.id, nome: prof.nome },
        sessoes: feitas.filter((s) => s.profissionalId === prof.id).length,
      }))
      // Quem saiu da equipe some da comparacao de carga, mas nao se ja
      // conduziu sessao na janela: o atendimento aconteceu, e sem ele as
      // barras nao somariam o total da clinica.
      .filter((i) => i.sessoes > 0 || banco.profissionais.find((p) => p.id === i.profissional.id)?.ativo)
      // Quem conduziu mais primeiro; empate resolve pelo nome, nao pela ordem
      // em que o profissional foi cadastrado.
      .sort((a, b) => b.sessoes - a.sessoes || a.profissional.nome.localeCompare(b.profissional.nome, 'pt-BR'))

    return { periodo: rotuloPassado(agora, JANELA_LONGA_DIAS), itens }
  }),

  ponteEscola: () => responder(() => {
    exigirPerfil(['COORDENADOR'], 'Indicadores')
    const agora = relogio.agora()
    const mes = janelaPassada(agora, JANELA_LONGA_DIAS)
    const periodo30 = rotuloPassado(agora, JANELA_LONGA_DIAS)

    // A escola conta quando ha professor com vinculo ATIVO e o consentimento
    // que o sustenta esta vigente: um sem o outro nao e ponte.
    const escolasAtivas = new Set(banco.vinculos
      .filter((v) => v.status === 'ATIVO')
      .map((v) => banco.consentimentos.find((c) => c.id === v.consentimentoId))
      .filter((c) => c !== undefined && consentimentoVigente(c, agora))
      .map((c) => c!.escolaId))

    // A ocorrencia da escola e o evento que ela gerou na clinica («gera»). O
    // tempo corre do registro, e nao de quando aconteceu: a clinica so pode
    // ler o que ja foi registrado.
    const comLeitura = banco.ocorrenciasEscolares.map((oe) => ({
      registradaEm: oe.registradaEm,
      leituraClinicaEm: banco.ocorrenciasComportamentais.find((o) => o.ocorrenciaEscolarId === oe.id)?.leituraClinicaEm ?? null,
    }))
    const daJanela = comLeitura.filter((o) => naJanela(o.registradaEm, mes))

    // So entram as que ja foram lidas — e por isso as que faltam aparecem ao
    // lado, sempre: sem elas o numero ficaria melhor do que a realidade,
    // porque justamente as mais lentas estariam de fora.
    const horas = daJanela
      .filter((o) => o.leituraClinicaEm !== null)
      .map((o) => horasAteLeitura(o.registradaEm, o.leituraClinicaEm!))
    const meio = mediana(horas)

    // Aguardando nao tem recorte de tempo: um relato de 40 dias sem leitura e
    // exatamente o que nao pode sumir por estar fora da janela.
    const aguardando = comLeitura.filter((o) => o.leituraClinicaEm === null)
    const maisAntiga = aguardando.map((o) => o.registradaEm).sort()[0]

    return {
      escolasComVinculoAtivo: { valor: escolasAtivas.size, periodo: rotuloDeHoje(agora) },
      ocorrenciasUltimos30Dias: { valor: daJanela.length, periodo: periodo30 },
      tempoAteLeituraClinica: { medianaHoras: meio === null ? null : Math.round(meio), leituras: horas.length, periodo: periodo30 },
      aguardandoLeitura: {
        quantidade: aguardando.length,
        maisAntigaHaDias: maisAntiga === undefined ? null : diasInteiros(maisAntiga, agora),
      },
    }
  }),
}
