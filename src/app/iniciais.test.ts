import { describe, expect, it } from 'vitest'
import { iniciaisDe } from './iniciais'

describe('as iniciais do icone do cabecalho', () => {
  it('da pessoa, ate duas, em maiusculas, sem as palavras de ligacao', () => {
    expect(iniciaisDe('Miguel Ficticio Santana')).toBe('MF')
    expect(iniciaisDe('Patrícia da Silva')).toBe('PS')
    expect(iniciaisDe('Miguel')).toBe('M')
    expect(iniciaisDe('  ana   souza ')).toBe('AS')
  })

  it('sem pessoa escolhida, nenhuma inicial', () => {
    expect(iniciaisDe(null)).toBe('')
    expect(iniciaisDe(undefined)).toBe('')
    expect(iniciaisDe('   ')).toBe('')
  })
})
