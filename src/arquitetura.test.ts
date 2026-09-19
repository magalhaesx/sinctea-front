import { describe, expect, it } from 'vitest'

/**
 * Regra 4 da camada de dados (docs/01, secao 4): nenhum componente conhece
 * servicos/mock. So a propria pasta servicos/ e os testes podem importa-la.
 */

const fontes = import.meta.glob<string>(['/src/**/*.{ts,tsx}', '!/src/**/*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

const IMPORTA_MOCK = /from\s+['"][^'"]*servicos\/mock[^'"]*['"]|import\(\s*['"][^'"]*servicos\/mock/

describe('arquitetura', () => {
  it('encontra os arquivos de codigo', () => {
    expect(Object.keys(fontes).length).toBeGreaterThan(10)
  })

  it('nenhum arquivo fora de src/servicos importa servicos/mock', () => {
    const violacoes = Object.entries(fontes)
      .filter(([caminho]) => !caminho.startsWith('/src/servicos/'))
      .filter(([, codigo]) => IMPORTA_MOCK.test(codigo))
      .map(([caminho]) => caminho)
    expect(violacoes).toEqual([])
  })

  it('dentro de servicos, so o index escolhe a implementacao', () => {
    const violacoes = Object.entries(fontes)
      .filter(([caminho]) => caminho.startsWith('/src/servicos/') && !caminho.startsWith('/src/servicos/mock/'))
      .filter(([caminho]) => caminho !== '/src/servicos/index.ts')
      .filter(([, codigo]) => /from\s+['"]\.\.?\/(\.\.\/)?mock/.test(codigo))
      .map(([caminho]) => caminho)
    expect(violacoes).toEqual([])
  })
})
