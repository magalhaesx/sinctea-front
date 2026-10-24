import { afterEach, describe, expect, it, vi } from 'vitest'
import { requisitar, vagaDaAba } from './cliente'
import { servicosApi } from './index'

/**
 * Item 9: a aba guarda so o numero da vaga, em sessionStorage, e o manda em
 * toda chamada. O token fica no cookie httpOnly, que o JavaScript nao le.
 */

function armazenamento(inicial: Record<string, string> = {}) {
  const dados = new Map(Object.entries(inicial))
  return {
    dados,
    getItem: (chave: string) => dados.get(chave) ?? null,
    setItem: (chave: string, valor: string) => { dados.set(chave, valor) },
    removeItem: (chave: string) => { dados.delete(chave) },
  }
}

const respondendo = (corpo: unknown, status = 200) => {
  const fetch = vi.fn(async (..._args: unknown[]) => new Response(corpo === undefined ? null : JSON.stringify(corpo), {
    status, headers: { 'Content-Type': 'application/json' },
  }))
  vi.stubGlobal('fetch', fetch)
  return fetch
}
const cabecalhosDe = (fetch: ReturnType<typeof respondendo>, chamada = 0) =>
  ((fetch.mock.calls[chamada][1] as RequestInit).headers ?? {}) as Record<string, string>

const SESSAO = {
  usuario: { id: 'u-ana', nome: 'Ana', email: 'ana@teste.example', perfis: ['TERAPEUTA'], ativo: true, ultimoAcessoEm: null },
  perfilAtivo: 'TERAPEUTA', especialidade: null, avisoDeRedefinicao: null, vaga: 3,
}

afterEach(() => vi.unstubAllGlobals())

describe('a vaga da aba', () => {
  it('vai em toda chamada, no cabecalho X-Sinctea-Aba', async () => {
    vi.stubGlobal('sessionStorage', armazenamento({ sinctea_aba: '2' }))
    const fetch = respondendo({ itens: [] })
    await requisitar('GET', '/pacientes')
    await requisitar('POST', '/sessoes', { pacienteId: 'p' })
    expect(cabecalhosDe(fetch, 0)).toEqual({ 'X-Sinctea-Aba': '2' })
    expect(cabecalhosDe(fetch, 1)).toEqual({ 'Content-Type': 'application/json', 'X-Sinctea-Aba': '2' })
  })

  it('sem vaga, com vaga fora de 1 a 5 ou sem sessionStorage, a chamada vai sem o cabecalho', async () => {
    for (const valor of [undefined, '0', '6', 'x']) {
      vi.stubGlobal('sessionStorage', armazenamento(valor === undefined ? {} : { sinctea_aba: valor }))
      const fetch = respondendo({})
      await requisitar('GET', '/auth/sessao')
      expect(cabecalhosDe(fetch)).not.toHaveProperty('X-Sinctea-Aba')
    }
    vi.stubGlobal('sessionStorage', { getItem: () => { throw new Error('bloqueado') } })
    expect(vagaDaAba()).toBeNull()
  })

  it('entrar guarda a vaga que o servidor deu; so o numero, e nada mais', async () => {
    const guardado = armazenamento()
    vi.stubGlobal('sessionStorage', guardado)
    respondendo(SESSAO)
    await servicosApi.autenticacao.entrar('ana@teste.example', 'senha-de-teste-123')
    expect([...guardado.dados]).toEqual([['sinctea_aba', '3']])
  })

  it('sair esquece a vaga, mesmo se o servidor nao responder', async () => {
    const guardado = armazenamento({ sinctea_aba: '3' })
    vi.stubGlobal('sessionStorage', guardado)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('sem rede') }))
    await expect(servicosApi.autenticacao.sair()).rejects.toBeTruthy()
    expect(guardado.dados.size).toBe(0)
  })

  it('continuar como uma conta aberta usa a vaga dela; se ela nao vale mais, a aba fica sem vaga', async () => {
    const guardado = armazenamento()
    vi.stubGlobal('sessionStorage', guardado)
    const fetch = respondendo(SESSAO)
    expect(await servicosApi.autenticacao.continuarComo(3)).toMatchObject({ vaga: 3 })
    expect(cabecalhosDe(fetch)).toEqual({ 'X-Sinctea-Aba': '3' })
    expect(guardado.dados.get('sinctea_aba')).toBe('3')

    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
    expect(await servicosApi.autenticacao.continuarComo(4)).toBeNull()
    expect(guardado.dados.size).toBe(0)
  })
})
