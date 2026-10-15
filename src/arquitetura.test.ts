import { describe, expect, it } from 'vitest'

/**
 * Regra 4 da camada de dados (docs/01, secao 4): nenhum componente conhece
 * servicos/mock. So a propria pasta servicos/ e os testes podem importa-la.
 *
 * A outra porta e o dado estatico: foi por ela que duas telas da familia
 * ficaram cinco etapas paradas, lendo um arquivo fixo em vez do servico.
 */

const fontes = import.meta.glob<string>(['/src/**/*.{ts,tsx}', '!/src/**/*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

/**
 * A dependencia entre pacotes so vai num sentido: front e servidor importam de
 * compartilhado/, e compartilhado/ nao importa de nenhum dos dois. Se
 * importasse, o servidor passaria a carregar codigo de tela — ou o front, de
 * servidor —, e o dominio deixaria de ser o mesmo nos dois lados.
 *
 * Os testes do compartilhado entram na conferencia: tambem nao podem depender
 * do front.
 */
const doCompartilhado = import.meta.glob<string>('/compartilhado/src/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const ESPECIFICADOR = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g
const PACOTE_DE_FORA = /^(sinctea-front|@sinctea\/servidor)(\/|$)/

/** Para onde aponta um especificador relativo, a partir da raiz do repositorio. */
function resolver(arquivo: string, especificador: string): string {
  if (especificador.startsWith('/')) return especificador
  const partes = arquivo.split('/').slice(0, -1)
  for (const parte of especificador.split('/')) {
    if (parte === '..') partes.pop()
    else if (parte !== '.') partes.push(parte)
  }
  return partes.join('/')
}

/**
 * Os imports proibidos de um arquivo. `proibido` recebe o destino ja resolvido
 * (caminho a partir da raiz, para imports relativos) ou o nome do pacote.
 */
function importsProibidos(
  arquivo: string, codigo: string, proibido: (destino: string, relativo: boolean) => boolean,
): string[] {
  return [...codigo.matchAll(ESPECIFICADOR)]
    .map(([, especificador]) => especificador)
    .filter((especificador) => {
      const relativo = /^[./]/.test(especificador)
      return proibido(relativo ? resolver(arquivo, especificador) : especificador, relativo)
    })
    .map((especificador) => `${arquivo} -> ${especificador}`)
}

/** Os imports de um arquivo que saem de compartilhado/. */
function saidasDoCompartilhado(arquivo: string, codigo: string): string[] {
  return importsProibidos(arquivo, codigo, (destino, relativo) => relativo
    ? !destino.startsWith('/compartilhado/')
    : PACOTE_DE_FORA.test(destino))
}

/**
 * docs/01, secao 1: o servidor nao importa de src/ — a semente e portada do
 * mock, e nao importada dele, porque o mock sai na Etapa 12 e a semente fica —,
 * e o front nao importa do servidor nem do Prisma. O cliente gerado
 * (servidor/src/gerado) fica de fora: e codigo do proprio Prisma.
 */
const doServidor = import.meta.glob<string>(
  ['/servidor/{src,test,prisma,scripts}/**/*.{ts,mjs}', '!/servidor/src/gerado/**'],
  { query: '?raw', import: 'default', eager: true },
)
/** O front inteiro, testes inclusive. */
const doFront = import.meta.glob<string>('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const PACOTE_DO_FRONT = /^sinctea-front(\/|$)/
const PACOTE_DO_SERVIDOR_OU_DO_PRISMA = /^(@sinctea\/servidor(\/|$)|@prisma\/|prisma(\/|$))/

const IMPORTA_MOCK = /from\s+['"][^'"]*servicos\/mock[^'"]*['"]|import\(\s*['"][^'"]*servicos\/mock/
const IMPORTA_DADOS = /from\s+['"][^'"]*\/dados\/[^'"]*['"]/

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

  it('nenhuma tela le dado estatico: a origem e sempre o servico', () => {
    const violacoes = Object.entries(fontes)
      .filter(([caminho]) => caminho.startsWith('/src/app/'))
      .filter(([, codigo]) => IMPORTA_DADOS.test(codigo))
      .map(([caminho]) => caminho)
    expect(violacoes).toEqual([])
  })

  it('encontra os arquivos do compartilhado', () => {
    expect(Object.keys(doCompartilhado).length).toBeGreaterThan(10)
  })

  it('nada em compartilhado/ importa de src/ nem de servidor/', () => {
    const violacoes = Object.entries(doCompartilhado)
      .flatMap(([caminho, codigo]) => saidasDoCompartilhado(caminho, codigo))
    expect(violacoes).toEqual([])
  })

  it('encontra os arquivos do servidor', () => {
    expect(Object.keys(doServidor).length).toBeGreaterThan(5)
  })

  it('servidor/ nao importa de src/', () => {
    const violacoes = Object.entries(doServidor).flatMap(([caminho, codigo]) =>
      importsProibidos(caminho, codigo, (destino, relativo) => relativo
        ? destino.startsWith('/src/')
        : PACOTE_DO_FRONT.test(destino)))
    expect(violacoes).toEqual([])
  })

  it('src/ nao importa de servidor/ nem de @prisma', () => {
    const violacoes = Object.entries(doFront).flatMap(([caminho, codigo]) =>
      importsProibidos(caminho, codigo, (destino, relativo) => relativo
        ? destino.startsWith('/servidor/')
        : PACOTE_DO_SERVIDOR_OU_DO_PRISMA.test(destino)))
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
