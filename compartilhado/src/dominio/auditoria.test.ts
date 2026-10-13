import { describe, expect, it } from 'vitest'
import { versaoAnteriorEmTexto } from './auditoria.js'
import { jsonCanonico } from './hash.js'

describe('versaoAnteriorEmTexto', () => {
  it('os tres campos viram pares legiveis, na ordem do JSON canonico', () => {
    const anterior = jsonCanonico({ tipo: 'Tapou os ouvidos', intensidade: 3, contexto: 'Recreio' })
    expect(versaoAnteriorEmTexto(anterior))
      .toBe('Em que momento: Recreio · Intensidade: 3 · O que aconteceu: Tapou os ouvidos')
  })

  it('sem versao anterior, nada a dizer', () => {
    expect(versaoAnteriorEmTexto(null)).toBe('')
  })

  it('chave desconhecida aparece pelo proprio nome', () => {
    // A trilha vai receber alteracoes de outras entidades: esconder o que
    // ainda nao se sabe nomear seria pior do que mostrar a chave.
    expect(versaoAnteriorEmTexto('{"turno":"Matutino"}')).toBe('turno: Matutino')
  })

  it('texto que nao e JSON nao se perde', () => {
    expect(versaoAnteriorEmTexto('algo antigo')).toBe('Valor anterior: algo antigo')
  })
})
