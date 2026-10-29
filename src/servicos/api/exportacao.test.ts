import { afterEach, describe, expect, it, vi } from 'vitest'
import { servicosApi } from './index'

/**
 * A exportacao da trilha pela API (item 17): o servidor responde text/csv na
 * rota /auditoria/exportacao, e o cliente devolve o texto como veio, com o
 * BOM, sem tentar le-lo como JSON.
 */

afterEach(() => vi.unstubAllGlobals())

const BOM = String.fromCharCode(0xfeff)

describe('a exportacao da trilha no cliente da API (item 17)', () => {
  it('pede /auditoria/exportacao com o filtro e devolve o CSV como texto, com o BOM', async () => {
    const csv = `${BOM}"Data e hora";"Usuário"\r\n"2026-10-29T10:00:00.000Z";"Caio"\r\n`
    const fetch = vi.fn(async (..._args: unknown[]) => new Response(csv, { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8' } }))
    vi.stubGlobal('fetch', fetch)
    vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} })
    const recebido = await servicosApi.auditoria.exportar({ desde: '2026-10-01', acao: 'ACESSO_NEGADO' })
    expect(recebido).toBe(csv)
    expect(recebido.charCodeAt(0)).toBe(0xfeff)
    expect(String(fetch.mock.calls[0][0])).toMatch(/\/auditoria\/exportacao\?desde=2026-10-01&acao=ACESSO_NEGADO$/)
  })
})
