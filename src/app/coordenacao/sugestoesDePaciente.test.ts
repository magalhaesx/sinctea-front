import { describe, expect, it } from 'vitest'
import { proximaSugestao, situacaoDaBusca, SUGESTOES_DA_BUSCA, textoParaBuscar } from './sugestoesDePaciente'

/** A busca de paciente do filtro da tela 13 (item 17b). */

describe('a busca de paciente da tela 13 (item 17b)', () => {
  it('so busca a partir de duas letras, sem os espacos das pontas, e pede ate 20', () => {
    expect(textoParaBuscar('')).toBeNull()
    expect(textoParaBuscar(' M ')).toBeNull()
    expect(textoParaBuscar(' Mi ')).toBe('Mi')
    expect(SUGESTOES_DA_BUSCA).toBe(20)
  })

  it('as setas andam pelas sugestoes e dao a volta', () => {
    expect(proximaSugestao(-1, 'ArrowDown', 3)).toBe(0)
    expect(proximaSugestao(2, 'ArrowDown', 3)).toBe(0)
    expect(proximaSugestao(0, 'ArrowUp', 3)).toBe(2)
    expect(proximaSugestao(-1, 'ArrowUp', 3)).toBe(2)
    expect(proximaSugestao(0, 'ArrowDown', 0)).toBe(-1)
  })

  it('a regiao viva diz o que esta acontecendo', () => {
    expect(situacaoDaBusca('', null)).toBe('Digite ao menos 2 letras do nome.')
    expect(situacaoDaBusca('M', null)).toBe('Digite ao menos 2 letras do nome.')
    expect(situacaoDaBusca('Mi', null)).toBe('Buscando…')
    expect(situacaoDaBusca('Mi', 0)).toBe('Nenhum paciente com esse nome.')
    expect(situacaoDaBusca('Mi', 1)).toBe('1 paciente encontrado.')
    expect(situacaoDaBusca('Mi', 7)).toBe('7 pacientes encontrados.')
  })
})
