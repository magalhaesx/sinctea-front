import type { DataCivil, DataIso, SituacaoSessao } from '../tipos.js'
import { dataEHoraNaInstancia, diaCivilEm, emDataCivil, inicioDoDia, partesDaDataCivil, somarDias } from './datas.js'

/**
 * O agendamento de sessao (item 19b; telas 3, 5 e 7), o mesmo no front, no
 * mock e no servidor. Datas e horas sao de Manaus: o dia de um agendamento e
 * o dia civil de Manaus em que ele cai, qualquer que seja o fuso da maquina —
 * o Render roda em UTC, e a sessao das 23h30 de Manaus ja e do dia seguinte
 * em UTC.
 *
 * Quem agenda e quem vai conduzir. O banco garante o resto, com dois indices
 * unicos parciais sobre as sessoes em AGENDADA (migracao agendamento): o mesmo
 * profissional nao fica com dois agendamentos no mesmo horario, nem com dois
 * do mesmo paciente no mesmo dia de Manaus.
 */

export const AGENDAMENTO_DIAS_A_FRENTE = 90
export const LOCAL_MAXIMO = 100
/** O local com que o campo abre, e o da sessao iniciada sem agendamento. */
export const LOCAL_PADRAO = 'Clínica'

const MS_MINUTO = 60_000
const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/
/** Instante com o fuso escrito: sem ele, o texto seria lido na hora da maquina. */
const INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/

/** "14:30" de "2026-11-16", no relogio de Manaus, como instante. Nulo se o dia ou a hora nao existem. */
export function instanteEmManaus(dia: string, hora: string): Date | null {
  const m = HORA.exec(hora)
  if (!partesDaDataCivil(dia) || !m) return null
  return new Date(inicioDoDia(dia).getTime() + (Number(m[1]) * 60 + Number(m[2])) * MS_MINUTO)
}

const comoData = (instante: Date | DataIso) => (instante instanceof Date ? instante : new Date(instante))

/** "14:30": a hora do instante no relogio de Manaus. */
export function horaEmManaus(instante: Date | DataIso): string {
  return dataEHoraNaInstancia(comoData(instante)).slice(11, 16)
}

/** O dia civil de Manaus em que a sessao esta marcada. */
export function diaDoAgendamento(inicioPrevistoEm: Date | DataIso): DataCivil {
  return diaCivilEm(comoData(inicioPrevistoEm))
}

/** "16/11/2026 às 14:30", em Manaus. */
export function quandoEmManaus(instante: Date | DataIso): string {
  return `${emDataCivil(diaDoAgendamento(instante))} às ${horaEmManaus(instante)}`
}

/**
 * O pedido como vai ao banco: o local sem espacos nas pontas e o horario no
 * minuto, porque o indice do mesmo horario compara o instante exato — 14:30:00
 * e 14:30:20 seriam dois horarios.
 */
export function agendamentoPreenchido(dados: { inicioPrevistoEm?: unknown; local?: unknown }): {
  inicioPrevistoEm: Date | null
  local: string
} {
  const texto = typeof dados.inicioPrevistoEm === 'string' ? dados.inicioPrevistoEm : ''
  const ms = INSTANTE.test(texto) ? Date.parse(texto) : NaN
  return {
    inicioPrevistoEm: Number.isNaN(ms) ? null : new Date(Math.floor(ms / MS_MINUTO) * MS_MINUTO),
    local: typeof dados.local === 'string' ? dados.local.trim() : '',
  }
}

/** O ultimo dia que se pode agendar, contando de hoje em Manaus. */
export function ultimoDiaAgendavel(agora: Date): DataCivil {
  return somarDias(diaCivilEm(agora), AGENDAMENTO_DIAS_A_FRENTE)
}

/**
 * Nada no passado; no maximo 90 dias a frente, em dias de Manaus; local
 * obrigatorio, ate 100 caracteres. Erros em palavras, por campo.
 */
export function validarAgendamento(dados: { inicioPrevistoEm?: unknown; local?: unknown }, agora: Date): Record<string, string> {
  const d = agendamentoPreenchido(dados)
  const erros: Record<string, string> = {}
  if (!d.inicioPrevistoEm) {
    erros.inicioPrevistoEm = 'Informe a data e a hora da sessão.'
  } else if (d.inicioPrevistoEm.getTime() < agora.getTime()) {
    erros.inicioPrevistoEm = 'O agendamento não pode ficar no passado.'
  } else if (diaDoAgendamento(d.inicioPrevistoEm) > ultimoDiaAgendavel(agora)) {
    erros.inicioPrevistoEm =
      `Agende com até ${AGENDAMENTO_DIAS_A_FRENTE} dias de antecedência: até ${emDataCivil(ultimoDiaAgendavel(agora))}.`
  }
  if (!d.local) erros.local = 'Informe o local da sessão.'
  else if (d.local.length > LOCAL_MAXIMO) erros.local = `O local pode ter no máximo ${LOCAL_MAXIMO} caracteres.`
  return erros
}

// ---------------------------------------------------------------- Recusas

/** Os dois indices do banco, em palavras. O horario vai junto: a pessoa sabe qual conferir. */
export const conflitoDeHorario = (inicioPrevistoEm: Date | DataIso) =>
  `Você já tem uma sessão agendada para ${quandoEmManaus(inicioPrevistoEm)}.`

export const conflitoDoDia = (inicioPrevistoEm: Date | DataIso) =>
  `Você já tem uma sessão agendada com este paciente em ${emDataCivil(diaDoAgendamento(inicioPrevistoEm))}. ` +
  'Para mudar o horário, cancele aquela e agende de novo.'

/** O agendamento so se inicia no dia dele, em Manaus. */
export const agendamentoDeOutroDia = (inicioPrevistoEm: Date | DataIso) =>
  `Este agendamento é para ${emDataCivil(diaDoAgendamento(inicioPrevistoEm))}.`

export const AGENDAMENTO_CANCELADO = 'Este agendamento foi cancelado.'
export const SESSAO_JA_ENCERRADA = 'Esta sessão já foi encerrada.'
export const SO_CANCELA_AGENDADA = 'Só se cancela uma sessão agendada. Esta já foi iniciada ou cancelada.'
export const SO_QUEM_CONDUZ_CANCELA = 'Só o profissional que vai conduzir a sessão pode cancelar o agendamento.'

/**
 * Por que o agendamento nao se inicia agora, ou nulo se pode. Vale para a
 * sessao AGENDADA; a pausada se retoma em qualquer dia, como antes.
 */
export function recusaDoInicio(
  sessao: { situacao: SituacaoSessao; inicioPrevistoEm: Date | DataIso },
  agora: Date,
): string | null {
  if (sessao.situacao === 'CANCELADA') return AGENDAMENTO_CANCELADO
  if (sessao.situacao === 'ENCERRADA') return SESSAO_JA_ENCERRADA
  if (sessao.situacao === 'AGENDADA' && diaDoAgendamento(sessao.inicioPrevistoEm) !== diaCivilEm(agora)) {
    return agendamentoDeOutroDia(sessao.inicioPrevistoEm)
  }
  return null
}
