import type { ServicoIndicadores } from '../contratos'
import type {
  AlertaAtencao, Indicador, MotivoAtencao, Objetivo, OcorrenciaComportamental, Paciente,
  PlanoTerapeutico, Sessao,
} from '../tipos'
import {
  consentimentoVencendo, consentimentoVigente, objetivoSemAvanco, pacienteSemSessaoRecente,
  percentualIndependente, planoPrecisaRevisao,
} from '../../dominio/regras'
import { auditar, banco, exigirPerfil, paginar, relogio, responder } from './infra'
import { ultimaSessaoDe } from './pacientes'

/**
 * Indicadores da coordenacao (tela 11). Conta e aponta, nao descreve: o que
 * sai daqui sao numeros, motivos e o identificador para chegar ao registro.
 * Nenhum texto clinico atravessa este servico — a tela nao teria como exibir
 * o que nao esta no tipo.
 *
 * Os limiares NAO moram aqui: sao os de dominio/regras.ts, os mesmos que as
 * telas do terapeuta usam. Este servico so decide o RECORTE (ultimos 7 dias,
 * ultimos 30, proximos 30) e a ORDEM (o mais urgente primeiro).
 */

const MS_DIA = 86_400_000
const MS_HORA = 3_600_000

/** Janelas do painel. Moveis, nao civis — ver o comentario de rotuloTras(). */
const JANELA_CURTA_DIAS = 7
const JANELA_LONGA_DIAS = 30

const ms = (iso: string) => Date.parse(iso)
const diaMes = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
const emDias = (de: number, ate: number) => Math.floor((ate - de) / MS_DIA)

/**
 * Inicio do dia, contando `dias` dias ate hoje inclusive: com dias = 7 e hoje
 * em 21/09, comeca a zero hora de 15/09.
 *
 * A janela e movel de proposito. "Sessoes na semana" numa segunda-feira mostra
 * quase zero — toda semana, justamente no dia em que a coordenacao planeja.
 */
function inicioDaJanela(agora: Date, dias: number): Date {
  const d = new Date(agora)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - (dias - 1))
  return d
}

/** "nos últimos 7 dias (15 a 21/09)" */
function rotuloTras(agora: Date, dias: number): string {
  return `nos últimos ${dias} dias (${diaMes(inicioDaJanela(agora, dias))} a ${diaMes(agora)})`
}

/** "nos próximos 30 dias (21/09 a 21/10)" */
function rotuloFrente(agora: Date, dias: number): string {
  const fim = new Date(agora.getTime() + dias * MS_DIA)
  return `nos próximos ${dias} dias (${diaMes(agora)} a ${diaMes(fim)})`
}

/** "em 21/09" — numero de fotografia, que so faz sentido com a data. */
const rotuloHoje = (agora: Date) => `em ${diaMes(agora)}`

const pacientesAtivos = () => banco.pacientes.filter((p) => p.ativo)

const nomeDoPaciente = (pacienteId: string) =>
  banco.pacientes.find((p) => p.id === pacienteId)?.nome ?? '—'

const pacienteDoAlerta = (pacienteId: string) => ({ id: pacienteId, nome: nomeDoPaciente(pacienteId) })

/** Sessoes encerradas do paciente, em ordem de numero: a serie do objetivo. */
function sessoesEncerradas(pacienteId: string): Sessao[] {
  return banco.sessoes
    .filter((s) => s.pacienteId === pacienteId && s.situacao === 'ENCERRADA')
    .sort((a, b) => a.numero - b.numero)
}

/** Percentual de independencia por sessao em que o objetivo foi trabalhado. */
function percentuaisDoObjetivo(pacienteId: string, objetivoId: string): number[] {
  return sessoesEncerradas(pacienteId)
    .map((s) => percentualIndependente(s.registros, objetivoId))
    .filter((p): p is number => p !== null)
}

/** Ha quantas sessoes o objetivo nao bate o proprio recorde. */
function sessoesDesdeORecorde(percentuais: number[]): number {
  const recorde = Math.max(...percentuais)
  return percentuais.length - 1 - percentuais.lastIndexOf(recorde)
}

const planosDeAtivos = (): PlanoTerapeutico[] => {
  const ativos = new Set(pacientesAtivos().map((p) => p.id))
  return banco.planos.filter((p) => ativos.has(p.pacienteId))
}

/** Mediana: um atraso isolado nao pode mover o numero da clinica inteira. */
function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b)
  const meio = Math.floor(ordenados.length / 2)
  return ordenados.length % 2 === 1
    ? ordenados[meio]
    : (ordenados[meio - 1] + ordenados[meio]) / 2
}

const daEscola = (o: OcorrenciaComportamental) => o.origem === 'ESCOLA'

// ---------------------------------------------------------------- Alertas

function alertasPlanoSemRevisao(agora: Date): AlertaAtencao[] {
  return planosDeAtivos()
    .filter((plano) => planoPrecisaRevisao(plano, agora))
    .map((plano) => ({
      motivo: 'PLANO_SEM_REVISAO' as const,
      paciente: pacienteDoAlerta(plano.pacienteId),
      referenciaId: plano.id,
      quantidade: emDias(ms(plano.ultimaRevisaoEm ?? plano.dataInicio), agora.getTime()),
      unidade: 'dias' as const,
    }))
}

function alertasPacienteSemSessao(agora: Date): AlertaAtencao[] {
  return pacientesAtivos()
    .map((p: Paciente) => ({ p, ultima: ultimaSessaoDe(p.id) }))
    .filter(({ ultima }) => pacienteSemSessaoRecente(ultima, agora))
    .map(({ p, ultima }) => ({
      motivo: 'PACIENTE_SEM_SESSAO' as const,
      paciente: pacienteDoAlerta(p.id),
      referenciaId: p.id,
      // Nulo quando nunca houve sessao: nao ha "ha quantos dias" a dizer.
      quantidade: ultima === null ? null : emDias(ms(ultima), agora.getTime()),
      unidade: 'dias' as const,
    }))
}

function alertasConsentimentoVencendo(agora: Date): AlertaAtencao[] {
  const ativos = new Set(pacientesAtivos().map((p) => p.id))
  return banco.consentimentos
    .filter((c) => ativos.has(c.pacienteId) && consentimentoVencendo(c, agora))
    .map((c) => ({
      motivo: 'CONSENTIMENTO_VENCENDO' as const,
      paciente: pacienteDoAlerta(c.pacienteId),
      referenciaId: c.id,
      quantidade: emDias(agora.getTime(), ms(c.validadeAte)),
      unidade: 'dias' as const,
    }))
}

function alertasObjetivoSemAvanco(): AlertaAtencao[] {
  return planosDeAtivos().flatMap((plano) =>
    plano.objetivos.flatMap((o: Objetivo) => {
      const percentuais = percentuaisDoObjetivo(plano.pacienteId, o.id)
      if (!objetivoSemAvanco(o.status, percentuais)) return []
      return [{
        motivo: 'OBJETIVO_SEM_AVANCO' as const,
        paciente: pacienteDoAlerta(plano.pacienteId),
        referenciaId: o.id,
        quantidade: sessoesDesdeORecorde(percentuais),
        unidade: 'sessoes' as const,
      }]
    }),
  )
}

/**
 * Mais urgente primeiro: quem espera ha mais tempo, ou — no consentimento —
 * quem vence antes. Sem quantidade (paciente que nunca teve sessao) vai para o
 * topo: e o caso mais grave, nao o menos.
 */
function ordenar(alertas: AlertaAtencao[], motivo: MotivoAtencao): AlertaAtencao[] {
  const peso = (a: AlertaAtencao) => a.quantidade ?? Number.POSITIVE_INFINITY
  return alertas.sort((a, b) => motivo === 'CONSENTIMENTO_VENCENDO'
    ? peso(a) - peso(b)
    : peso(b) - peso(a))
}

// ---------------------------------------------------------------- Servico

export const indicadoresMock: ServicoIndicadores = {
  resumo: () => responder(() => {
    exigirPerfil(['COORDENADOR'], 'Indicadores')
    const agora = relogio.agora()
    const desde7 = inicioDaJanela(agora, JANELA_CURTA_DIAS).getTime()
    const desde30 = inicioDaJanela(agora, JANELA_LONGA_DIAS).getTime()
    const ate30 = agora.getTime() + JANELA_LONGA_DIAS * MS_DIA

    const numero = (valor: number, periodo: string): Indicador => ({ valor, periodo })

    // Sessao que aconteceu e sessao encerrada: agendada nao conta como feita.
    const sessoes = banco.sessoes
      .filter((s) => s.situacao === 'ENCERRADA' && s.inicio && ms(s.inicio) >= desde7)

    const dominados = banco.planos.flatMap((p) => p.objetivos)
      .filter((o) => o.dominadoEm !== null && ms(o.dominadoEm) >= desde30)

    const revisoes = planosDeAtivos()
      .filter((p) => ms(p.dataRevisao) >= agora.getTime() && ms(p.dataRevisao) <= ate30)

    return {
      // Clinica sem nenhuma sessao registrada nao tem indicador para mostrar.
      temDados: banco.sessoes.length > 0,
      pacientesEmAcompanhamento: numero(pacientesAtivos().length, rotuloHoje(agora)),
      sessoesUltimos7Dias: numero(sessoes.length, rotuloTras(agora, JANELA_CURTA_DIAS)),
      objetivosDominadosUltimos30Dias: numero(dominados.length, rotuloTras(agora, JANELA_LONGA_DIAS)),
      planosComRevisaoProximos30Dias: numero(revisoes.length, rotuloFrente(agora, JANELA_LONGA_DIAS)),
    }
  }),

  listarAlertas: (motivo, filtro = {}) => responder(() => {
    const sessao = exigirPerfil(['COORDENADOR'], 'Indicadores')
    const agora = relogio.agora()
    const alertas = motivo === 'PLANO_SEM_REVISAO' ? alertasPlanoSemRevisao(agora)
      : motivo === 'PACIENTE_SEM_SESSAO' ? alertasPacienteSemSessao(agora)
        : motivo === 'CONSENTIMENTO_VENCENDO' ? alertasConsentimentoVencendo(agora)
          : alertasObjetivoSemAvanco()

    // Das quatro operacoes, so esta nomeia pacientes, e e registrada como
    // leitura autorizada uma vez por chamada. Ela nao leva pacienteId de
    // proposito: o alerta aponta, nao descreve. A leitura de cada paciente e
    // auditada no destino — ficha, plano ou evolucao —, com pacienteId, quando
    // a coordenacao abre o registro.
    auditar(sessao, {
      acao: 'LEITURA_AUTORIZADA', entidade: 'Indicadores', idEntidade: motivo,
      detalhe: 'Alertas do painel da coordenação.',
    })
    return paginar(ordenar(alertas, motivo), filtro)
  }),

  sessoesPorProfissional: () => responder(() => {
    exigirPerfil(['COORDENADOR'], 'Indicadores')
    const agora = relogio.agora()
    const desde = inicioDaJanela(agora, JANELA_LONGA_DIAS).getTime()
    const feitas = banco.sessoes
      .filter((s) => s.situacao === 'ENCERRADA' && s.inicio && ms(s.inicio) >= desde)

    const itens = banco.profissionais
      .map((prof) => ({
        profissional: { id: prof.id, nome: prof.nome },
        sessoes: feitas.filter((s) => s.profissionalId === prof.id).length,
      }))
      // Quem conduziu mais primeiro; empate resolve pelo nome, nao pela ordem
      // em que o profissional foi cadastrado.
      .sort((a, b) => b.sessoes - a.sessoes || a.profissional.nome.localeCompare(b.profissional.nome, 'pt-BR'))

    return { periodo: rotuloTras(agora, JANELA_LONGA_DIAS), itens }
  }),

  ponteEscola: () => responder(() => {
    exigirPerfil(['COORDENADOR'], 'Indicadores')
    const agora = relogio.agora()
    const desde30 = inicioDaJanela(agora, JANELA_LONGA_DIAS).getTime()
    const periodo30 = rotuloTras(agora, JANELA_LONGA_DIAS)

    const escolasAtivas = new Set(
      banco.vinculos
        .map((v) => banco.consentimentos.find((c) => c.id === v.consentimentoId))
        .filter((c) => c !== undefined && consentimentoVigente(c, agora))
        .map((c) => c!.escolaId),
    )

    const daJanela = banco.ocorrenciasComportamentais
      .filter((o) => daEscola(o) && ms(o.ocorridaEm) >= desde30)

    // So entram as que ja foram lidas — e por isso as que faltam aparecem ao
    // lado, sempre: sem elas o numero ficaria melhor do que a realidade,
    // porque justamente as mais lentas estariam de fora.
    const horas = daJanela
      .filter((o) => o.leituraClinicaEm !== null)
      .map((o) => (ms(o.leituraClinicaEm!) - ms(o.ocorridaEm)) / MS_HORA)

    // Aguardando nao tem recorte de tempo: um relato de 40 dias sem leitura e
    // exatamente o que nao pode sumir por estar fora da janela.
    const aguardando = banco.ocorrenciasComportamentais
      .filter((o) => daEscola(o) && o.leituraClinicaEm === null)
    const maisAntiga = aguardando
      .map((o) => ms(o.ocorridaEm))
      .sort((a, b) => a - b)[0]

    return {
      escolasComVinculoAtivo: { valor: escolasAtivas.size, periodo: rotuloHoje(agora) },
      ocorrenciasUltimos30Dias: { valor: daJanela.length, periodo: periodo30 },
      tempoAteLeituraClinica: {
        // Com menos de tres leituras, a mediana diria mais sobre o acaso do
        // que sobre a clinica.
        medianaHoras: horas.length >= 3 ? Math.round(mediana(horas)) : null,
        leituras: horas.length,
        periodo: periodo30,
      },
      aguardandoLeitura: {
        quantidade: aguardando.length,
        maisAntigaHaDias: maisAntiga === undefined ? null : emDias(maisAntiga, agora.getTime()),
      },
    }
  }),
}
