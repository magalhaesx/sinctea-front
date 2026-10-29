import { describe, expect, it } from 'vitest'
import { ErroServico, type Objetivo, type PedidoRelatorio } from '../tipos.js'
import { montarConteudoRelatorio, validarPedidoRelatorio, type EntradaRelatorio } from './relatorio.js'

/** O relatorio de evolucao (item 18): a validacao do pedido e a montagem, iguais no mock, no servidor e na semente. */

const HOJE = '2026-10-29'
const pedido = (mudanca: Partial<PedidoRelatorio> = {}): PedidoRelatorio => ({
  periodoInicio: '2026-10-01', periodoFim: '2026-10-28', objetivoIds: ['o-1'], destinatario: 'PROFISSIONAIS',
  consideracoes: 'Leitura do período.', ...mudanca,
})
const erro = (p: PedidoRelatorio, emitir = true) => Object.keys(validarPedidoRelatorio(p, HOJE, { emitir }))

const objetivo: Objetivo = {
  id: 'o-1', planoId: 'pl-1', dominio: 'Comunicação', descricaoTecnica: 'Mando com figura em 8 de 10.',
  descricaoAcessivel: 'Pedir o que quer, apontando.', status: 'EM_AQUISICAO', dominadoEm: null, percentualAtual: 50,
  criterio: { percentualMinimo: 80, sessoesConsecutivas: 2 },
}
const sessao = (numero: number, inicio: string, resultados: Array<'INDEPENDENTE' | 'AJUDA_FISICA'>, situacao: 'ENCERRADA' | 'EM_ANDAMENTO' = 'ENCERRADA') => ({
  numero, situacao, inicio,
  registros: resultados.map((resultado, i) => ({ id: `r-${numero}-${i}`, objetivoId: 'o-1', ordem: i + 1, resultado, ocorridoEm: inicio })),
})
const entrada = (mudanca: Partial<EntradaRelatorio> = {}): EntradaRelatorio => ({
  paciente: { id: 'p-1', nome: 'Miguel Ficticio', dataNascimento: '2019-03-12' },
  plano: { status: 'VIGENTE', objetivos: [objetivo] },
  sessoes: [
    sessao(1, '2026-10-05T14:00:00.000Z', ['INDEPENDENTE', 'AJUDA_FISICA']),
    // 28/10, 21h em Manaus = 29/10, 01h em UTC: e do ultimo dia do periodo.
    sessao(2, '2026-10-29T01:00:00.000Z', ['INDEPENDENTE']),
    // 29/10, 00h30 em Manaus: ja passou do periodo.
    sessao(3, '2026-10-29T04:30:00.000Z', ['AJUDA_FISICA']),
    sessao(4, '2026-10-10T14:00:00.000Z', ['INDEPENDENTE'], 'EM_ANDAMENTO'),
  ],
  pedido: pedido(),
  ...mudanca,
})

describe('validarPedidoRelatorio (item 18)', () => {
  it('o pedido certo passa; o fim pode ser hoje', () => {
    expect(validarPedidoRelatorio(pedido(), HOJE, { emitir: true })).toEqual({})
    expect(erro(pedido({ periodoFim: HOJE }))).toEqual([])
  })

  it('periodo vazio, invertido ou no futuro e recusado', () => {
    expect(erro(pedido({ periodoInicio: '' }))).toEqual(['periodo'])
    expect(erro(pedido({ periodoInicio: '2026-10-20', periodoFim: '2026-10-19' }))).toEqual(['periodo'])
    expect(erro(pedido({ periodoFim: '2026-10-30' }))).toEqual(['periodo'])
    expect(erro(pedido({ periodoFim: '2026-02-30' }))).toEqual(['periodo'])
  })

  it('sem objetivo, com destinatario inventado: recusado no campo', () => {
    expect(erro(pedido({ objetivoIds: [] }))).toEqual(['objetivoIds'])
    expect(erro(pedido({ destinatario: 'ESCOLA' as never }))).toEqual(['destinatario'])
  })

  it('consideracoes: obrigatorias ao emitir, opcionais na previa, e ate 4.000 caracteres', () => {
    expect(erro(pedido({ consideracoes: '   ' }))).toEqual(['consideracoes'])
    expect(erro(pedido({ consideracoes: '   ' }), false)).toEqual([])
    expect(erro(pedido({ consideracoes: ` ${'x'.repeat(4000)} ` }))).toEqual([])
    expect(erro(pedido({ consideracoes: 'x'.repeat(4001) }))).toEqual(['consideracoes'])
    expect(erro(pedido({ consideracoes: 'x'.repeat(4001) }), false)).toEqual(['consideracoes'])
  })
})

describe('montarConteudoRelatorio (item 18)', () => {
  it('so com plano vigente', () => {
    for (const plano of [null, { status: 'RASCUNHO' as const, objetivos: [objetivo] }, { status: 'AGUARDANDO_VALIDACAO' as const, objetivos: [objetivo] }]) {
      expect(() => montarConteudoRelatorio(entrada({ plano }))).toThrow('Para emitir, o paciente precisa de um plano vigente.')
    }
  })

  it('objetivo fora do plano vigente e recusado no campo', () => {
    try {
      montarConteudoRelatorio(entrada({ pedido: pedido({ objetivoIds: ['o-1', 'o-de-outro'] }) }))
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(ErroServico)
      expect((e as ErroServico).campos.objetivoIds).toBeTruthy()
    }
  })

  it('a sessao conta no dia de Manaus: a das 21h do ultimo dia entra, a das 00h30 do seguinte nao; a em andamento nao', () => {
    const c = montarConteudoRelatorio(entrada())
    expect(c.sessoesNoPeriodo).toBe(2)
    expect(c.objetivos[0].sessoesNoPeriodo).toBe(2)
    expect(c.objetivos[0].periodoTexto).toBe('primeiro 50% · último 100% · melhor 100%')
  })

  it('a equipe le a redacao tecnica e percentual; a familia, a acessivel e numeros em palavras', () => {
    const equipe = montarConteudoRelatorio(entrada())
    expect(equipe.objetivos[0]).toMatchObject({ redacao: objetivo.descricaoTecnica, criterioTexto: '80% em 2 sessões consecutivas' })
    const familia = montarConteudoRelatorio(entrada({ pedido: pedido({ destinatario: 'FAMILIA' }) }))
    expect(familia.objetivos[0].redacao).toBe(objetivo.descricaoAcessivel)
    expect(JSON.stringify(familia)).not.toContain(objetivo.descricaoTecnica)
    expect(JSON.stringify(familia.objetivos)).not.toMatch(/\d+ ?%/)
  })

  it('as consideracoes vao como escritas, sem os espacos das pontas', () => {
    expect(montarConteudoRelatorio(entrada({ pedido: pedido({ consideracoes: '  Leitura.  ' }) })).consideracoes).toBe('Leitura.')
  })
})
