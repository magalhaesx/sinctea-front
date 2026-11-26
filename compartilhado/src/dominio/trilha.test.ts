import { describe, expect, it } from 'vitest'
import {
  detalheDaTrilha, desdeOMes, emitidaEm, mesCivilEm, mesPorExtenso, montarTrilha, SEM_HABILIDADES, semEstrategias, SUBTITULO_DA_TRILHA,
  tituloDasHabilidades, tituloDoApoio, type EntradaTrilha,
} from './trilha.js'

/** A trilha de autonomia (item 24), a mesma no mock e no servidor. */

const AGORA = new Date('2026-11-26T15:00:00.000Z')
// Acento combinado (NFD), quebra de linha e espaco no fim: tudo sai como entrou.
const ESCRITA = 'Lavar as mãos sozinho,\nseguindo os desenhos. '

const cartao = (id: string, titulo: string) => ({
  id, tituloSimples: titulo, oQueFazer: ['Mostre o primeiro passo.', 'Espere.\nDepois elogie.'],
  oQueEvitar: ['Não faça por ele.'], sinalAlerta: 'Se tapar os ouvidos,\nofereça uma pausa.',
})

const entrada = (status: 'VIGENTE' | 'RASCUNHO' = 'VIGENTE'): EntradaTrilha => ({
  paciente: { id: 'p-1', nome: 'Miguel Ficticio Santana' },
  plano: {
    status,
    // Fora de ordem de proposito: a montagem ordena.
    objetivos: [
      { id: 'o-3', descricaoAcessivel: 'Pedir ajuda com uma palavra.', status: 'DOMINADO', dominadoEm: '2026-09-10T15:00:00.000Z', cartoes: [cartao('c-3', 'Pedir ajuda')] },
      { id: 'o-1', descricaoAcessivel: ESCRITA, status: 'DOMINADO', dominadoEm: '2026-11-01T02:00:00.000Z', cartoes: [cartao('c-2', 'Segundo'), cartao('c-1', 'Primeiro')] },
      { id: 'o-2', descricaoAcessivel: 'Esperar a vez na fila.', status: 'EM_AQUISICAO', dominadoEm: null, cartoes: [] },
      // Status sem a data: nao e dominio confirmado, e nao entra.
      { id: 'o-4', descricaoAcessivel: 'Sem a data do domínio.', status: 'DOMINADO', dominadoEm: null, cartoes: [] },
    ],
  },
  agora: AGORA,
})

describe('montarTrilha (item 24)', () => {
  it('habilidades: so DOMINADO com a data, do mais recente para o mais antigo, com o mes de Manaus', () => {
    const t = montarTrilha(entrada())
    // 2026-11-01T02:00Z ainda e 31 de outubro em Manaus.
    expect(t.habilidades).toEqual([
      { descricaoAcessivel: ESCRITA, desde: '2026-10' },
      { descricaoAcessivel: 'Pedir ajuda com uma palavra.', desde: '2026-09' },
    ])
  })

  it('estrategias: os cartoes do plano vigente, na ordem em que foram escritos, como foram escritos', () => {
    const t = montarTrilha(entrada())
    expect(t.estrategias.map((e) => e.tituloSimples)).toEqual(['Primeiro', 'Segundo', 'Pedir ajuda'])
    expect(t.estrategias[0]).toEqual({
      tituloSimples: 'Primeiro', oQueFazer: ['Mostre o primeiro passo.', 'Espere.\nDepois elogie.'],
      oQueEvitar: ['Não faça por ele.'], sinalAlerta: 'Se tapar os ouvidos,\nofereça uma pausa.',
    })
  })

  it('o texto sai byte a byte: sem aparar, sem normalizar', () => {
    const t = montarTrilha(entrada())
    expect(t.habilidades[0].descricaoAcessivel).toBe(ESCRITA)
    expect(t.habilidades[0].descricaoAcessivel.normalize('NFC')).not.toBe(t.habilidades[0].descricaoAcessivel)
  })

  it('so as chaves do tipo, sem nada do objetivo alem da redacao acessivel', () => {
    const t = montarTrilha(entrada())
    expect(Object.keys(t).sort()).toEqual(['estrategias', 'geradaEm', 'habilidades', 'nome', 'pacienteId'])
    expect(Object.keys(t.habilidades[0]).sort()).toEqual(['descricaoAcessivel', 'desde'])
    expect(Object.keys(t.estrategias[0]).sort()).toEqual(['oQueEvitar', 'oQueFazer', 'sinalAlerta', 'tituloSimples'])
    expect(t).toMatchObject({ pacienteId: 'p-1', nome: 'Miguel Ficticio Santana', geradaEm: AGORA.toISOString() })
  })

  it('o detalhe da auditoria conta, e nao copia o texto', () => {
    const t = montarTrilha(entrada())
    expect(detalheDaTrilha(t)).toBe('Trilha de autonomia: 2 habilidades dominadas e 3 estratégias.')
    expect(detalheDaTrilha({ ...t, habilidades: t.habilidades.slice(0, 1), estrategias: t.estrategias.slice(0, 1) }))
      .toBe('Trilha de autonomia: 1 habilidade dominada e 1 estratégia.')
    expect(detalheDaTrilha({ ...t, habilidades: [], estrategias: [] }))
      .toBe('Trilha de autonomia: 0 habilidades dominadas e 0 estratégias.')
  })

  it('plano que nao e o vigente, ou nenhum plano: as duas partes vazias', () => {
    for (const plano of [entrada('RASCUNHO').plano, null]) {
      const t = montarTrilha({ ...entrada(), plano })
      expect(t.habilidades).toEqual([])
      expect(t.estrategias).toEqual([])
    }
  })

  it('a lista devolvida e copia: mexer nela nao mexe no que veio', () => {
    const e = entrada()
    montarTrilha(e).estrategias[0].oQueFazer.push('outro')
    expect(e.plano!.objetivos[1].cartoes[1].oQueFazer).toHaveLength(2)
  })
})

describe('os textos da tela 26', () => {
  it('o mes por extenso, e o mes de Manaus de um instante', () => {
    expect(mesPorExtenso('2026-03')).toBe('março de 2026')
    expect(desdeOMes('2026-11')).toBe('desde novembro de 2026')
    expect(mesCivilEm('2026-12-01T03:59:59.000Z')).toBe('2026-11')
    expect(mesCivilEm('2026-12-01T04:00:00.000Z')).toBe('2026-12')
    for (const ruim of ['2026-13', '2026-00', '2026-1', 'novembro']) expect(() => mesPorExtenso(ruim)).toThrow()
  })

  it('as frases fixas da caixa', () => {
    expect(SUBTITULO_DA_TRILHA).toBe('Escrito pela equipe clínica. Vale para a escola, o trabalho e outros espaços do dia a dia.')
    expect(tituloDasHabilidades('Miguel')).toBe('Habilidades que Miguel já domina')
    expect(tituloDoApoio('Miguel')).toBe('Como apoiar Miguel')
    expect(SEM_HABILIDADES).toBe('Ainda não há habilidades dominadas registradas. Elas aparecem aqui quando a equipe confirma o domínio de um objetivo.')
    expect(semEstrategias('Miguel')).toBe('A equipe ainda não escreveu estratégias para Miguel.')
    // 23h em Manaus do dia 26 ja e dia 27 em UTC.
    expect(emitidaEm('2026-11-27T03:00:00.000Z')).toBe('Emitida em 26/11/2026')
  })
})
