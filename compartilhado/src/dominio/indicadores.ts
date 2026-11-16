import type {
  AlertaAtencao, Consentimento, DataCivil, DataIso, MotivoAtencao, PlanoTerapeutico, StatusObjetivo,
} from '../tipos.js'
import { diaCivilEm, fimDaValidade, inicioDoDia, somarDias } from './datas.js'
import { consentimentoVencendo, objetivoSemAvanco, pacienteSemSessaoRecente, planoPrecisaRevisao } from './regras.js'

/**
 * Os indicadores da coordenacao (tela 11, UC18; item 19), os mesmos no mock e
 * no servidor. Este modulo decide o RECORTE — que dias entram, com que rotulo
 * — e a ORDEM dos alertas. Os limiares nao moram aqui: sao os de
 * LIMIARES_ATENCAO, em regras.ts, os mesmos das telas de quem atende.
 *
 * A janela e movel e conta dias civis de Manaus, hoje incluido. "Sessoes na
 * semana" numa segunda-feira mostraria quase zero — toda semana, justamente
 * no dia em que a coordenacao planeja. E o dia e o de Manaus, e nao o da
 * maquina: a sessao das 23h30 de Manaus e daquele dia, mesmo num navegador em
 * Lisboa ou num servidor em UTC.
 */

export const JANELA_CURTA_DIAS = 7
export const JANELA_LONGA_DIAS = 30

/**
 * Com menos de tres medidas, a mediana diria mais sobre o acaso do que sobre a
 * clinica. Nao e limiar de atencao: e o tamanho minimo da amostra.
 */
export const MEDIDAS_PARA_MEDIANA = 3

const MS_HORA = 3_600_000
const MS_DIA = 24 * MS_HORA

const instante = (d: Date | DataIso) => (d instanceof Date ? d.getTime() : Date.parse(d))

/** Mora em datas.ts desde o item 19b, que tambem conta dias; daqui, so reexportada. */
export { somarDias }

/**
 * Dias civis de Manaus, os dois das pontas dentro. Como instantes, vai de
 * `desde` (00:00 do primeiro dia) ate antes de `ate` (00:00 do dia seguinte ao
 * ultimo).
 */
export interface Janela {
  primeiroDia: DataCivil
  ultimoDia: DataCivil
  desde: Date
  ate: Date
}

function janelaDe(primeiroDia: DataCivil, ultimoDia: DataCivil): Janela {
  return { primeiroDia, ultimoDia, desde: inicioDoDia(primeiroDia), ate: fimDaValidade(ultimoDia) }
}

/** Os ultimos `dias` dias, contando hoje: com 7 e hoje em 21/09, de 15/09 a 21/09. */
export function janelaPassada(agora: Date, dias: number): Janela {
  const hoje = diaCivilEm(agora)
  return janelaDe(somarDias(hoje, -(dias - 1)), hoje)
}

/** Hoje e os `dias` seguintes: com 30 e hoje em 21/09, de 21/09 a 21/10. */
export function janelaFutura(agora: Date, dias: number): Janela {
  const hoje = diaCivilEm(agora)
  return janelaDe(hoje, somarDias(hoje, dias))
}

export function naJanela(momento: Date | DataIso, janela: Janela): boolean {
  const t = instante(momento)
  return t >= janela.desde.getTime() && t < janela.ate.getTime()
}

/** Dia civil contra dia civil: a revisao marcada para hoje ainda esta por vir. */
export function diaNaJanela(dia: DataCivil, janela: Janela): boolean {
  return dia >= janela.primeiroDia && dia <= janela.ultimoDia
}

const diaMes = (d: DataCivil) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

/** "nos últimos 7 dias (15 a 21/09)": as duas pontas, nunca "esta semana". */
export function rotuloPassado(agora: Date, dias: number): string {
  const j = janelaPassada(agora, dias)
  const inicio = j.primeiroDia.slice(5, 7) === j.ultimoDia.slice(5, 7) ? j.primeiroDia.slice(8, 10) : diaMes(j.primeiroDia)
  return `nos últimos ${dias} dias (${inicio} a ${diaMes(j.ultimoDia)})`
}

/** "nos próximos 30 dias (21/09 a 21/10)" */
export function rotuloFuturo(agora: Date, dias: number): string {
  const j = janelaFutura(agora, dias)
  const inicio = j.primeiroDia.slice(5, 7) === j.ultimoDia.slice(5, 7) ? j.primeiroDia.slice(8, 10) : diaMes(j.primeiroDia)
  return `nos próximos ${dias} dias (${inicio} a ${diaMes(j.ultimoDia)})`
}

/** "em 21/09": numero de fotografia, que so faz sentido com a data. */
export function rotuloDeHoje(agora: Date): string {
  return `em ${diaMes(diaCivilEm(agora))}`
}

/** Dias inteiros de um instante a outro, para baixo: 23 horas ainda sao zero dias. */
export function diasInteiros(de: Date | DataIso, ate: Date | DataIso): number {
  return Math.floor((instante(ate) - instante(de)) / MS_DIA)
}

/** Horas da ocorrencia registrada pela escola ate a leitura clinica dela. */
export function horasAteLeitura(registradaEm: Date | DataIso, leituraClinicaEm: Date | DataIso): number {
  return (instante(leituraClinicaEm) - instante(registradaEm)) / MS_HORA
}

/**
 * Mediana, e nao media: um atraso isolado nao pode mover o numero da clinica
 * inteira. Nula com menos de MEDIDAS_PARA_MEDIANA valores.
 */
export function mediana(valores: number[]): number | null {
  if (valores.length < MEDIDAS_PARA_MEDIANA) return null
  const ordenados = [...valores].sort((a, b) => a - b)
  const meio = Math.floor(ordenados.length / 2)
  return ordenados.length % 2 === 1 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2
}

/** Ha quantas sessoes o objetivo nao bate o proprio recorde. Sem serie, zero. */
export function sessoesDesdeORecorde(percentuais: number[]): number {
  if (percentuais.length === 0) return 0
  const recorde = Math.max(...percentuais)
  return percentuais.length - 1 - percentuais.lastIndexOf(recorde)
}

// ---------------------------------------------------------------- Alertas

type Pessoa = { id: string; nome: string }

/**
 * Plano sem revisao: so o plano VIGENTE, como na evolucao (item 16) e no
 * relatorio (item 18). O rascunho, o devolvido e o plano em validacao ainda
 * nao estao valendo, e o que precisa de revisao e o que vale.
 */
export function alertaPlanoSemRevisao(
  plano: Pick<PlanoTerapeutico, 'id' | 'status' | 'dataInicio' | 'ultimaRevisaoEm'>,
  paciente: Pessoa,
  agora: Date,
): AlertaAtencao | null {
  if (plano.status !== 'VIGENTE' || !planoPrecisaRevisao(plano, agora)) return null
  // ultimaRevisaoEm e instante; dataInicio e dia civil, contado do inicio do dia.
  const referencia = plano.ultimaRevisaoEm ?? inicioDoDia(plano.dataInicio)
  return { motivo: 'PLANO_SEM_REVISAO', paciente, referenciaId: plano.id, quantidade: diasInteiros(referencia, agora), unidade: 'dias' }
}

/** Pela ultima sessao ENCERRADA. Quem nunca teve sessao vem sem quantidade. */
export function alertaPacienteSemSessao(paciente: Pessoa, ultimaSessaoEm: DataIso | null, agora: Date): AlertaAtencao | null {
  if (!pacienteSemSessaoRecente(ultimaSessaoEm, agora)) return null
  return {
    motivo: 'PACIENTE_SEM_SESSAO', paciente, referenciaId: paciente.id,
    quantidade: ultimaSessaoEm === null ? null : diasInteiros(ultimaSessaoEm, agora), unidade: 'dias',
  }
}

/** Vigente, nao revogado, vencendo: "vence hoje" e zero dia. */
export function alertaConsentimentoVencendo(c: Consentimento, paciente: Pessoa, agora: Date): AlertaAtencao | null {
  if (!consentimentoVencendo(c, agora)) return null
  return {
    motivo: 'CONSENTIMENTO_VENCENDO', paciente, referenciaId: c.id,
    quantidade: diasInteiros(agora, fimDaValidade(c.validadeAte)), unidade: 'dias',
  }
}

/**
 * Objetivo parado: so os do plano VIGENTE. `percentuais` e a serie do
 * objetivo, uma medida por sessao encerrada em que foi trabalhado, em ordem de
 * numero.
 */
export function alertaObjetivoSemAvanco(
  objetivo: { id: string; status: StatusObjetivo },
  planoStatus: PlanoTerapeutico['status'],
  paciente: Pessoa,
  percentuais: number[],
): AlertaAtencao | null {
  if (planoStatus !== 'VIGENTE' || !objetivoSemAvanco(objetivo.status, percentuais)) return null
  return {
    motivo: 'OBJETIVO_SEM_AVANCO', paciente, referenciaId: objetivo.id,
    quantidade: sessoesDesdeORecorde(percentuais), unidade: 'sessoes',
  }
}

/**
 * Mais urgente primeiro: quem espera ha mais tempo, ou — no consentimento —
 * quem vence antes. Sem quantidade (paciente que nunca teve sessao) vai para o
 * topo: e o caso mais grave, nao o menos. Empate, pelo nome do paciente e
 * depois pela referencia, para a pagina nao mudar de uma leitura para a outra.
 */
export function ordenarAlertas(alertas: AlertaAtencao[], motivo: MotivoAtencao): AlertaAtencao[] {
  const peso = (a: AlertaAtencao) => a.quantidade ?? Number.POSITIVE_INFINITY
  return [...alertas].sort((a, b) =>
    (motivo === 'CONSENTIMENTO_VENCENDO' ? peso(a) - peso(b) : peso(b) - peso(a)) ||
    a.paciente.nome.localeCompare(b.paciente.nome, 'pt-BR') ||
    (a.referenciaId < b.referenciaId ? -1 : a.referenciaId > b.referenciaId ? 1 : 0))
}
