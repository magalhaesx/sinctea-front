import { describe, expect, it } from 'vitest'
import { BOM_UTF8, celulaCsv, montarCsv } from './csv'

describe('celulaCsv', () => {
  it('escapa o que a planilha interpretaria como formula', () => {
    // O classico: um campo digitado que abre uma planilha executando algo.
    expect(celulaCsv('=1+1')).toBe('"\'=1+1"')
    expect(celulaCsv('+55 92 90000-0000')).toBe('"\'+55 92 90000-0000"')
    expect(celulaCsv('-1')).toBe('"\'-1"')
    expect(celulaCsv('@usuario')).toBe('"\'@usuario"')
  })

  it('texto comum passa inteiro, so entre aspas', () => {
    expect(celulaCsv('Leitura autorizada')).toBe('"Leitura autorizada"')
    expect(celulaCsv(null)).toBe('""')
  })

  it('aspas dobram, e separador e quebra de linha nao partem a coluna', () => {
    expect(celulaCsv('Ele disse "oi"')).toBe('"Ele disse ""oi"""')
    expect(celulaCsv('antes; depois')).toBe('"antes; depois"')
    expect(celulaCsv('uma\nduas')).toBe('"uma\nduas"')
  })
})

describe('montarCsv', () => {
  it('leva BOM, cabecalho e ponto e virgula — como o Excel em pt-BR espera', () => {
    const csv = montarCsv(['Ação', 'Detalhe'], [['LEITURA_AUTORIZADA', 'Ficha do paciente.']])
    expect(csv.startsWith(BOM_UTF8)).toBe(true)
    expect(csv).toContain('"Ação";"Detalhe"')
    expect(csv).toContain('"LEITURA_AUTORIZADA";"Ficha do paciente."')
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(2)
  })
})
