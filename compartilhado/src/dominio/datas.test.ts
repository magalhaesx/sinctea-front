import { afterEach, describe, expect, it } from 'vitest'
import type { Consentimento } from '../tipos.js'
import {
  dataEHoraNaInstancia, dataIsoParaLocal, diaCivilEm, diaIso, emData, emDataCivil, fimDaValidade, inicioDoDia, partesDaDataCivil,
} from './datas.js'
import { idadeEmAnos, situacaoConsentimento } from './regras.js'

/**
 * Dia civil (B5): a regra nao pode depender do fuso da maquina. O Render roda
 * em UTC, a familia em Manaus, e um avaliador pode abrir de Toquio — o dia 31
 * vale o dia 31 inteiro, em Manaus, para os tres.
 */
const FUSOS = ['UTC', 'Asia/Tokyo', 'America/Manaus']
const fusoOriginal = process.env.TZ
afterEach(() => {
  if (fusoOriginal === undefined) delete process.env.TZ
  else process.env.TZ = fusoOriginal
})

const consentimento = (validadeAte: string): Consentimento => ({
  id: 'c1', responsavelId: 'r1', pacienteId: 'p1', escolaId: 'e1', escopos: ['CARTAO_ESTRATEGIA'],
  concedidoEm: '2026-01-01T12:00:00.000Z', validadeAte, revogadoEm: null, hashTermo: 'sha256:ficticio',
})

describe.each(FUSOS)('dia civil, com a maquina em %s', (fuso) => {
  it('vigente as 23:59:59.999 de Manaus no dia da validade; expirado a 00:00 do dia seguinte', () => {
    process.env.TZ = fuso
    const c = consentimento('2026-12-31')
    // 23:59:59.999 de 31/12 em Manaus = 03:59:59.999 de 01/01 em UTC.
    expect(situacaoConsentimento(c, new Date('2027-01-01T03:59:59.999Z'))).toBe('VIGENTE')
    expect(situacaoConsentimento(c, new Date('2027-01-01T04:00:00.000Z'))).toBe('EXPIRADO')
    expect(fimDaValidade('2026-12-31').toISOString()).toBe('2027-01-01T04:00:00.000Z')
  })

  it('emDataCivil escreve DD/MM/AAAA sem passar por fuso nenhum', () => {
    process.env.TZ = fuso
    expect(emDataCivil('2026-12-31')).toBe('31/12/2026')
    expect(emDataCivil('2019-03-12')).toBe('12/03/2019')
  })

  it('faz aniversario no proprio dia, contado em Manaus', () => {
    process.env.TZ = fuso
    // 00:30 de 19/09 em Manaus: ja fez 7.
    expect(idadeEmAnos('2019-09-19', new Date('2026-09-19T04:30:00Z'))).toBe(7)
    // 23:30 de 18/09 em Manaus, que ja e 19/09 em UTC: ainda tem 6.
    expect(idadeEmAnos('2019-09-19', new Date('2026-09-19T03:30:00Z'))).toBe(6)
  })

  it('diaCivilEm da o dia de Manaus, e nao o da maquina', () => {
    process.env.TZ = fuso
    expect(diaCivilEm(new Date('2027-01-01T03:59:59.999Z'))).toBe('2026-12-31')
    expect(diaCivilEm(new Date('2027-01-01T04:00:00.000Z'))).toBe('2027-01-01')
  })
})

describe('partesDaDataCivil', () => {
  it('aceita so dia que existe, no formato AAAA-MM-DD', () => {
    expect(partesDaDataCivil('2028-02-29')).toEqual({ ano: 2028, mes: 2, dia: 29 })
    expect(partesDaDataCivil('2026-02-29')).toBeNull()
    expect(partesDaDataCivil('2026-12-31T23:59:59Z')).toBeNull()
    expect(partesDaDataCivil('31/12/2026')).toBeNull()
  })

  it('inicioDoDia e 00:00 de Manaus', () => {
    expect(inicioDoDia('2026-12-31').toISOString()).toBe('2026-12-31T04:00:00.000Z')
  })
})

describe('dataIsoParaLocal', () => {
  it('data sem hora nao volta um dia, qualquer que seja o fuso a oeste', () => {
    // Era este o defeito: new Date('2019-03-12') e meia-noite UTC, e em
    // Manaus (UTC-4) isso e 11/03 as 20h.
    const d = dataIsoParaLocal('2019-03-12')
    expect(d.getFullYear()).toBe(2019)
    expect(d.getMonth()).toBe(2)
    expect(d.getDate()).toBe(12)
  })

  it('texto com hora passa direto: ali o instante ja esta determinado', () => {
    const iso = '2026-09-20T14:45:00.000Z'
    expect(dataIsoParaLocal(iso).getTime()).toBe(Date.parse(iso))
  })
})

describe('diaIso', () => {
  it('escreve o dia de quem olha, com dois digitos', () => {
    expect(diaIso(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
    expect(diaIso(new Date(2026, 11, 31, 0, 1))).toBe('2026-12-31')
  })

  it('volta ao mesmo dia depois de ida e volta', () => {
    expect(diaIso(dataIsoParaLocal('2019-03-12'))).toBe('2019-03-12')
  })
})

describe('emData', () => {
  it('mostra a data no formato de quem le', () => {
    expect(emData('2019-03-12')).toBe('12/03/2019')
  })
})

describe('dataEHoraNaInstancia (item 17b)', () => {
  it('o relogio de Manaus, com os segundos: 03h30 em UTC ainda e 23h30 do dia anterior la', () => {
    expect(dataEHoraNaInstancia(new Date('2026-10-30T03:30:05.000Z'))).toBe('29/10/2026 23:30:05')
    expect(dataEHoraNaInstancia(new Date('2026-01-01T04:00:00.000Z'))).toBe('01/01/2026 00:00:00')
  })
})
