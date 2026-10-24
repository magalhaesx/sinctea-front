import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessaoUsuario } from '../servicos'
import { aoNegarAcesso, requisitar } from '../servicos/api/cliente'
import { mudancaDaSessao } from './mudancaDaSessao'

/**
 * Duas contas no mesmo navegador (item 7): a negativa da API faz o contexto
 * reler a sessao, e a comparacao diz o que mudou.
 */

const sessao = (id: string, nome: string, perfilAtivo: SessaoUsuario['perfilAtivo']): SessaoUsuario => ({
  usuario: { id, nome, email: `${id}@teste.example`, perfis: [perfilAtivo], ativo: true, ultimoAcessoEm: null },
  perfilAtivo,
  especialidade: null,
  avisoDeRedefinicao: null,
  vaga: null,
})

describe('o que mudou na sessao desde que a janela a leu', () => {
  const ana = { usuarioId: 'u-ana', perfilAtivo: 'TERAPEUTA' as const }

  it('a mesma conta e o mesmo perfil: nada a dizer', () => {
    expect(mudancaDaSessao(ana, sessao('u-ana', 'Ana', 'TERAPEUTA'))).toEqual({ tipo: 'MESMA' })
  })

  it('outra conta entrou noutra janela: o nome dela', () => {
    expect(mudancaDaSessao(ana, sessao('u-mae', 'Patrícia', 'RESPONSAVEL'))).toEqual({ tipo: 'OUTRA_CONTA', nome: 'Patrícia' })
  })

  it('a mesma conta trocou de perfil noutra janela', () => {
    expect(mudancaDaSessao(ana, sessao('u-ana', 'Ana', 'COORDENADOR'))).toEqual({ tipo: 'OUTRO_PERFIL', perfil: 'COORDENADOR' })
  })

  it('a conta saiu noutra janela', () => {
    expect(mudancaDaSessao(ana, null)).toEqual({ tipo: 'SEM_SESSAO' })
  })

  it('janela sem conta: alguem entrar noutra janela e mudanca; ninguem entrar, nao', () => {
    expect(mudancaDaSessao(null, sessao('u-ana', 'Ana', 'TERAPEUTA'))).toEqual({ tipo: 'OUTRA_CONTA', nome: 'Ana' })
    expect(mudancaDaSessao(null, null)).toEqual({ tipo: 'MESMA' })
  })
})

describe('o cliente da API avisa quando o pedido e negado', () => {
  afterEach(() => { aoNegarAcesso(null); vi.unstubAllGlobals() })

  const respondendo = (status: number) => vi.stubGlobal('fetch', vi.fn(async () =>
    new Response(JSON.stringify({ mensagem: 'x' }), { status, headers: { 'Content-Type': 'application/json' } })))

  it('401 e 403 fora da autenticacao avisam, e o erro continua chegando a tela', async () => {
    const ouvinte = vi.fn()
    aoNegarAcesso(ouvinte)
    for (const status of [401, 403]) {
      respondendo(status)
      await expect(requisitar('GET', '/pacientes')).rejects.toMatchObject({ codigo: status === 401 ? 'NAO_AUTENTICADO' : 'ACESSO_NEGADO' })
    }
    expect(ouvinte).toHaveBeenCalledTimes(2)
  })

  it('a negativa de entrar, sair ou trocar de perfil a propria tela explica; os outros erros nao avisam', async () => {
    const ouvinte = vi.fn()
    aoNegarAcesso(ouvinte)
    respondendo(401)
    await expect(requisitar('POST', '/auth/entrar', {})).rejects.toBeTruthy()
    for (const status of [404, 409, 422, 500]) {
      respondendo(status)
      await expect(requisitar('GET', '/pacientes')).rejects.toBeTruthy()
    }
    expect(ouvinte).not.toHaveBeenCalled()
  })
})
