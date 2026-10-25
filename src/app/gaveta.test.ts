import { describe, expect, it } from 'vitest'
import { focoPresoNaGaveta, rotuloDoBotaoDoMenu } from './gaveta'

describe('a gaveta do menu prende o foco (item 12)', () => {
  it('do ultimo item, Tab volta ao primeiro; do primeiro, Shift+Tab vai ao ultimo', () => {
    expect(focoPresoNaGaveta(4, 5, false)).toBe(0)
    expect(focoPresoNaGaveta(0, 5, true)).toBe(4)
  })

  it('no meio, o navegador segue sozinho', () => {
    expect(focoPresoNaGaveta(2, 5, false)).toBeNull()
    expect(focoPresoNaGaveta(2, 5, true)).toBeNull()
  })

  it('com o foco fora da gaveta, ele volta para dentro', () => {
    expect(focoPresoNaGaveta(-1, 5, false)).toBe(0)
    expect(focoPresoNaGaveta(-1, 5, true)).toBe(4)
    expect(focoPresoNaGaveta(-1, 0, false)).toBeNull()
  })

  it('o botao diz o que faz, conforme o estado', () => {
    expect(rotuloDoBotaoDoMenu(false)).toBe('Abrir o menu')
    expect(rotuloDoBotaoDoMenu(true)).toBe('Fechar o menu')
  })
})
