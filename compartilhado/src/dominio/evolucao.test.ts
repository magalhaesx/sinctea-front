import { describe, expect, it } from 'vitest'
import type { EntradaEvolucao } from './evolucao.js'
import { montarEvolucao } from './evolucao.js'

/** A montagem da evolucao do objetivo (tela 8, item 16), a mesma no mock e no servidor. */

const OBJ = 'o-1'
const sessao = (numero: number, situacao: 'ENCERRADA' | 'EM_ANDAMENTO', resultados: Array<[string, 'INDEPENDENTE' | 'AJUDA_FISICA']>) => ({
  id: `s-${numero}`, numero, situacao, inicio: `2026-10-0${numero}T13:00:00.000Z`, inicioPrevistoEm: `2026-10-0${numero}T12:00:00.000Z`,
  registros: resultados.map(([objetivoId, resultado], i) => ({
    id: `r-${numero}-${i}`, objetivoId, ordem: i + 1, resultado, ocorridoEm: `2026-10-0${numero}T13:10:00.000Z`,
  })),
})

const entrada = (): EntradaEvolucao => ({
  objetivo: { id: OBJ, criterio: { percentualMinimo: 80, sessoesConsecutivas: 2 } },
  // Fora de ordem de proposito: a montagem ordena pelo numero.
  sessoes: [
    sessao(3, 'ENCERRADA', [[OBJ, 'INDEPENDENTE']]),
    sessao(1, 'ENCERRADA', [[OBJ, 'INDEPENDENTE'], [OBJ, 'AJUDA_FISICA']]),
    sessao(2, 'ENCERRADA', [['o-2', 'INDEPENDENTE']]),
    sessao(4, 'EM_ANDAMENTO', [[OBJ, 'INDEPENDENTE']]),
  ],
  atividades: [{ id: 'a-1', objetivoId: OBJ }, { id: 'a-2', objetivoId: OBJ }, { id: 'a-3', objetivoId: 'o-2' }],
  execucoes: [
    { atividadeId: 'a-2', dataRealizacao: '2026-10-05', desempenho: 'NAO_QUIS' },
    { atividadeId: 'a-1', dataRealizacao: '2026-10-04', desempenho: 'SOZINHO' },
    { atividadeId: 'a-3', dataRealizacao: '2026-10-04', desempenho: 'COM_AJUDA' },
  ],
  ocorrencias: [
    { origem: 'ESCOLA', ocorridaEm: '2026-10-06T15:00:00.000Z', intensidade: 2 },
    { origem: 'CLINICA', ocorridaEm: '2026-10-03T13:20:00.000Z', intensidade: 4 },
    { origem: 'ESCOLA', ocorridaEm: '2026-10-02T15:00:00.000Z', intensidade: 3 },
  ],
})

describe('montarEvolucao (item 16)', () => {
  it('clinica: so sessao encerrada com o objetivo, em ordem de numero, com a data de inicio', () => {
    expect(montarEvolucao(entrada()).clinica).toEqual([
      { sessaoId: 's-1', numero: 1, data: '2026-10-01T13:00:00.000Z', percentual: 50 },
      { sessaoId: 's-3', numero: 3, data: '2026-10-03T13:00:00.000Z', percentual: 100 },
    ])
  })

  it('sem inicio, a data e a prevista', () => {
    const e = entrada()
    e.sessoes = [{ ...sessao(1, 'ENCERRADA', [[OBJ, 'INDEPENDENTE']]), inicio: null }]
    expect(montarEvolucao(e).clinica[0].data).toBe('2026-10-01T12:00:00.000Z')
  })

  it('casa: as execucoes das atividades deste objetivo, em ordem de dia, sem as de outro objetivo', () => {
    expect(montarEvolucao(entrada()).casa).toEqual([
      { data: '2026-10-04', desempenho: 'SOZINHO' },
      { data: '2026-10-05', desempenho: 'NAO_QUIS' },
    ])
  })

  it('escola: so a origem ESCOLA, em ordem de data, so data e intensidade', () => {
    expect(montarEvolucao(entrada()).escola).toEqual([
      { data: '2026-10-02T15:00:00.000Z', intensidade: 3 },
      { data: '2026-10-06T15:00:00.000Z', intensidade: 2 },
    ])
  })

  it('o criterio e o de objetivoAtingiuCriterio: a sessao em andamento nao completa a sequencia', () => {
    expect(montarEvolucao(entrada()).atingiuCriterio).toBe(false)
    const e = entrada()
    e.sessoes.push(sessao(5, 'ENCERRADA', [[OBJ, 'INDEPENDENTE']]))
    expect(montarEvolucao(e).atingiuCriterio).toBe(true)
  })

  it('o que nao e medida nao passa: so as chaves da resposta', () => {
    const e = entrada() as EntradaEvolucao & { ocorrencias: Array<Record<string, unknown>> }
    e.ocorrencias = e.ocorrencias.map((o) => ({ ...o, comportamento: 'Texto do relato.' })) as never
    e.execucoes = e.execucoes.map((x) => ({ ...x, observacao: 'Texto da família.' })) as never
    const r = montarEvolucao(e)
    expect(JSON.stringify(r)).not.toMatch(/Texto/)
    expect(Object.keys(r).sort()).toEqual(['atingiuCriterio', 'casa', 'clinica', 'escola'])
  })
})
