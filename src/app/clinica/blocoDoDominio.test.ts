import { describe, expect, it } from 'vitest'
import { blocoDoDominio } from './blocoDoDominio'

/** O bloco do dominio na tela 8 (item 16). */

describe('o bloco do dominio na tela 8 (item 16)', () => {
  it('no plano vigente, com o criterio atingido, o botao aparece', () => {
    expect(blocoDoDominio({ dominadoEm: null, vigente: true, atingiu: true })).toEqual({
      titulo: 'Critério de domínio atingido',
      frase: 'A promoção a dominado não é automática: depende da sua confirmação.',
      botao: true,
    })
  })

  it('fora do plano vigente, a situacao do criterio, sem o botao, e com a frase do servico', () => {
    for (const atingiu of [true, false]) {
      const bloco = blocoDoDominio({ dominadoEm: null, vigente: false, atingiu })
      expect(bloco.botao, String(atingiu)).toBe(false)
      expect(bloco.frase, String(atingiu)).toBe('O domínio se confirma no plano vigente.')
      expect(bloco.titulo, String(atingiu)).toBe(atingiu ? 'Critério de domínio atingido' : 'Ainda não atingiu o critério de domínio')
    }
  })

  it('sem o criterio atingido, ou ja dominado, nao ha botao', () => {
    expect(blocoDoDominio({ dominadoEm: null, vigente: true, atingiu: false }).botao).toBe(false)
    const dominado = blocoDoDominio({ dominadoEm: '2026-10-20T14:00:00.000Z', vigente: true, atingiu: true })
    expect(dominado.botao).toBe(false)
    expect(dominado.titulo).toBe('Objetivo dominado')
    expect(dominado.frase).toMatch(/^Domínio confirmado em \d{2}\/\d{2}\/2026\.$/)
  })
})
