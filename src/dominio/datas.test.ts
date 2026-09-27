import { describe, expect, it } from 'vitest'
import { dataIsoParaLocal, diaIso, emData } from './datas'

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
