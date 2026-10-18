import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react'
import {
  aoNegarAcesso, ErroServico, servicos, type AceiteConvite, type AvisoDeRedefinicao, type Perfil, type SessaoUsuario,
  type Usuario,
} from '../servicos'
import { mudancaDaSessao, type MudancaDaSessao } from './mudancaDaSessao'

/**
 * Sessao do usuario autenticado e perfil ativo.
 *
 * A fonte e sempre `servicos.autenticacao`: hoje a implementacao simulada,
 * depois a API. Quando a API entrar, este arquivo nao muda.
 *
 * O que este contexto guarda serve para a INTERFACE decidir o que mostrar.
 * Nao e mecanismo de seguranca: quem autoriza cada leitura e o servidor.
 */

type PerfilDemonstracao = Exclude<Perfil, 'ADMINISTRADOR'>

type Estado =
  | { situacao: 'CARREGANDO' }
  | { situacao: 'ANONIMO' }
  | {
    situacao: 'AUTENTICADO'; usuario: Usuario; perfilAtivo: Perfil; especialidade: string | null
    avisoDeRedefinicao: AvisoDeRedefinicao | null
  }

interface Ctx {
  estado: Estado
  /** Atalhos para o caso autenticado. */
  usuario: Usuario | null
  perfilAtivo: Perfil | null
  /** A especialidade de quem e da equipe, para a tela mostrar no lugar do perfil (item 7). */
  especialidade: string | null
  /** A coordenacao redefiniu a senha, e a pessoa ainda nao deu ciencia (item 8). */
  avisoDeRedefinicao: AvisoDeRedefinicao | null
  darCienciaDaNovaSenha(): Promise<void>
  entrar(email: string, senha: string): Promise<void>
  entrarDemonstracao(perfil: PerfilDemonstracao): Promise<void>
  /** Aceite de convite: cria a conta do professor e ja abre a sessao. */
  entrarComConvite(token: string, dados: AceiteConvite): Promise<void>
  /** Primeiro acesso por link: define a senha e ja abre a sessao. */
  entrarComPrimeiroAcesso(token: string, senha: string): Promise<void>
  trocarPerfil(perfil: Perfil): Promise<void>
  sair(): Promise<void>
  /**
   * O que mudou na sessao desde que esta janela a leu: outra janela entrou com
   * outra conta, trocou de perfil ou saiu (item 7). MESMA, nada.
   */
  mudanca: MudancaDaSessao
}

const SessaoCtx = createContext<Ctx | null>(null)

const autenticado = (s: SessaoUsuario): Estado => ({
  situacao: 'AUTENTICADO', usuario: s.usuario, perfilAtivo: s.perfilAtivo, especialidade: s.especialidade,
  avisoDeRedefinicao: s.avisoDeRedefinicao,
})

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ situacao: 'CARREGANDO' })
  const [mudanca, setMudanca] = useState<MudancaDaSessao>({ tipo: 'MESMA' })
  // O que a janela mostra agora, para o ouvinte comparar sem refazer o efeito.
  const naJanela = useRef(estado)
  naJanela.current = estado
  const conferindo = useRef(false)

  /*
   * Toda negativa que a tela nao explica faz reler a sessao. Se a conta ou o
   * perfil mudou em outra janela, a tela diz isso e pede para recarregar.
   * Varios pedidos negados ao mesmo tempo fazem uma releitura so.
   */
  useEffect(() => {
    aoNegarAcesso(() => {
      if (conferindo.current) return
      conferindo.current = true
      const atual = naJanela.current
      const quem = atual.situacao === 'AUTENTICADO' ? { usuarioId: atual.usuario.id, perfilAtivo: atual.perfilAtivo } : null
      servicos.autenticacao.sessaoAtual()
        .then((agora) => {
          const resultado = mudancaDaSessao(quem, agora)
          if (resultado.tipo !== 'MESMA') setMudanca(resultado)
        })
        .catch(() => { /* sem servidor, a propria tela ja mostra o erro */ })
        .finally(() => { conferindo.current = false })
    })
    return () => aoNegarAcesso(null)
  }, [])

  useEffect(() => {
    let ativo = true
    servicos.autenticacao.sessaoAtual()
      .then((s) => { if (ativo) setEstado(s ? autenticado(s) : { situacao: 'ANONIMO' }) })
      // Sem conseguir confirmar a sessao, trata como anonimo: a tela de entrada resolve.
      .catch(() => { if (ativo) setEstado({ situacao: 'ANONIMO' }) })
    return () => { ativo = false }
  }, [])

  // Os erros de entrar/trocar sobem para a tela, que sabe como exibi-los.
  const entrar = useCallback(async (email: string, senha: string) => {
    setEstado(autenticado(await servicos.autenticacao.entrar(email, senha)))
  }, [])

  const entrarDemonstracao = useCallback(async (perfil: PerfilDemonstracao) => {
    // So a implementacao simulada tem conta sem senha (docs/07, D6).
    const semSenha = servicos.autenticacao.entrarDemonstracao
    if (!semSenha) throw new ErroServico('NAO_ENCONTRADO', 'A entrada de demonstração não existe no sistema real.')
    setEstado(autenticado(await semSenha(perfil)))
  }, [])

  const entrarComConvite = useCallback(async (token: string, dados: AceiteConvite) => {
    setEstado(autenticado(await servicos.convites.aceitar(token, dados)))
  }, [])

  const entrarComPrimeiroAcesso = useCallback(async (token: string, senha: string) => {
    setEstado(autenticado(await servicos.autenticacao.concluirPrimeiroAcesso(token, senha)))
  }, [])

  const trocarPerfil = useCallback(async (perfil: Perfil) => {
    setEstado(autenticado(await servicos.autenticacao.trocarPerfil(perfil)))
  }, [])

  const darCienciaDaNovaSenha = useCallback(async () => {
    setEstado(autenticado(await servicos.autenticacao.darCienciaDaNovaSenha()))
  }, [])

  const sair = useCallback(async () => {
    try {
      await servicos.autenticacao.sair()
    } finally {
      // Mesmo se o servidor nao responder, a interface deixa de mostrar dados.
      setEstado({ situacao: 'ANONIMO' })
    }
  }, [])

  const valor = useMemo<Ctx>(() => ({
    estado,
    usuario: estado.situacao === 'AUTENTICADO' ? estado.usuario : null,
    perfilAtivo: estado.situacao === 'AUTENTICADO' ? estado.perfilAtivo : null,
    especialidade: estado.situacao === 'AUTENTICADO' ? estado.especialidade : null,
    avisoDeRedefinicao: estado.situacao === 'AUTENTICADO' ? estado.avisoDeRedefinicao : null,
    darCienciaDaNovaSenha,
    entrar, entrarDemonstracao, entrarComConvite, entrarComPrimeiroAcesso, trocarPerfil, sair, mudanca,
  }), [estado, darCienciaDaNovaSenha, entrar, entrarDemonstracao, entrarComConvite, entrarComPrimeiroAcesso, trocarPerfil, sair, mudanca])

  return <SessaoCtx.Provider value={valor}>{children}</SessaoCtx.Provider>
}

export function usarSessao() {
  const ctx = useContext(SessaoCtx)
  if (!ctx) throw new Error('usarSessao precisa estar dentro de ProvedorSessao')
  return ctx
}
