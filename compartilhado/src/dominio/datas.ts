import type { DataCivil } from '../tipos.js'

/**
 * Datas: instante e dia civil sao coisas diferentes, e cada um tem a sua regra.
 *
 * Instante (DataIso, "2026-10-14T13:00:00.000Z") e um ponto no tempo; aparece
 * na tela no fuso de quem olha.
 *
 * Dia civil (DataCivil, "2026-12-31") e um dia do calendario, sem hora: data de
 * nascimento, validade de uma autorizacao, periodo de relatorio. Ele nunca vira
 * objeto Date — "2026-12-31" lido como Date e meia-noite UTC, que a oeste de
 * Greenwich ainda e o dia 30. Quando um dia civil precisa virar instante (a
 * validade que termina), ele vira no fuso da instancia, e so aqui.
 *
 * Quem precisa de data importa deste modulo — copia da regra e como ela volta
 * a se perder.
 */

// ---------------------------------------------------------------- Dia civil

/**
 * O fuso da instancia: America/Manaus, -04:00. O deslocamento e fixo porque o
 * Brasil nao tem horario de verao desde 2019.
 */
export const FUSO_DA_INSTANCIA = 'America/Manaus'
export const DESLOCAMENTO_DA_INSTANCIA = '-04:00'
const DESLOCAMENTO_MS = -4 * 3_600_000

const FORMATO_CIVIL = /^(\d{4})-(\d{2})-(\d{2})$/

/** Ano, mes e dia de uma data civil, ou nulo se o texto nao e uma data que existe. */
export function partesDaDataCivil(d: string): { ano: number; mes: number; dia: number } | null {
  const m = FORMATO_CIVIL.exec(d)
  if (!m) return null
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])]
  // Aritmetica em UTC, que nao depende do fuso da maquina: 2026-02-30 nao existe.
  const conferencia = new Date(Date.UTC(ano, mes - 1, dia))
  const existe = conferencia.getUTCFullYear() === ano && conferencia.getUTCMonth() === mes - 1 &&
    conferencia.getUTCDate() === dia
  return existe ? { ano, mes, dia } : null
}

function exigirDataCivil(d: string): { ano: number; mes: number; dia: number } {
  const partes = partesDaDataCivil(d)
  if (!partes) throw new Error(`Data civil invalida: "${d}". O formato e AAAA-MM-DD.`)
  return partes
}

/** 00:00 do dia, em Manaus: o primeiro instante daquele dia civil. */
export function inicioDoDia(d: DataCivil): Date {
  const { ano, mes, dia } = exigirDataCivil(d)
  return new Date(Date.UTC(ano, mes - 1, dia) - DESLOCAMENTO_MS)
}

/**
 * 00:00 do dia seguinte, em Manaus: o primeiro instante em que a validade ja
 * passou. "Vale ate 31/12" vale o dia 31 inteiro.
 */
export function fimDaValidade(d: DataCivil): Date {
  const { ano, mes, dia } = exigirDataCivil(d)
  return new Date(Date.UTC(ano, mes - 1, dia + 1) - DESLOCAMENTO_MS)
}

/** "31/12/2026", so com operacoes de texto: fuso nenhum entra. */
export function emDataCivil(d: DataCivil): string {
  const { ano, mes, dia } = exigirDataCivil(d)
  const doisDigitos = (n: number) => String(n).padStart(2, '0')
  return `${doisDigitos(dia)}/${doisDigitos(mes)}/${ano}`
}

/** O dia civil, em Manaus, em que cai um instante — o "hoje" da instancia. */
export function diaCivilEm(instante: Date): DataCivil {
  return new Date(instante.getTime() + DESLOCAMENTO_MS).toISOString().slice(0, 10)
}

// ---------------------------------------------------------------- Instante

/**
 * ISO do servico para Date local. Data sem hora vira meio-dia local, longe das
 * duas bordas do dia; texto com hora passa direto, porque ali o instante ja
 * esta determinado.
 */
export function dataIsoParaLocal(iso: string): Date {
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
}

/**
 * Date local para AAAA-MM-DD — a forma que o campo `type="date"` e os filtros
 * de periodo esperam. Usa o dia de quem olha, nao o dia em UTC.
 */
export function diaIso(data: Date): string {
  const doisDigitos = (n: number) => String(n).padStart(2, '0')
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`
}

/** Data como ela aparece na tela: 12/03/2019. */
export function emData(iso: string): string {
  return dataIsoParaLocal(iso).toLocaleDateString('pt-BR')
}
