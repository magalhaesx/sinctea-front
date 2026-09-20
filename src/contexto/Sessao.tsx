import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react'
import { servicos, type AceiteConvite, type Perfil, type SessaoUsuario, type Usuario } from '../servicos'

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
  | { situacao: 'AUTENTICADO'; usuario: Usuario; perfilAtivo: Perfil }

interface Ctx {
  estado: Estado
  /** Atalhos para o caso autenticado. */
  usuario: Usuario | null
  perfilAtivo: Perfil | null
  entrar(email: string, senha: string): Promise<void>
  entrarDemonstracao(perfil: PerfilDemonstracao): Promise<void>
  /** Aceite de convite: cria a conta do professor e ja abre a sessao. */
  entrarComConvite(token: string, dados: AceiteConvite): Promise<void>
  trocarPerfil(perfil: Perfil): Promise<void>
  sair(): Promise<void>
}

const SessaoCtx = createContext<Ctx | null>(null)

const autenticado = (s: SessaoUsuario): Estado =>
  ({ situacao: 'AUTENTICADO', usuario: s.usuario, perfilAtivo: s.perfilAtivo })

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ situacao: 'CARREGANDO' })

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
    setEstado(autenticado(await servicos.autenticacao.entrarDemonstracao(perfil)))
  }, [])

  const entrarComConvite = useCallback(async (token: string, dados: AceiteConvite) => {
    setEstado(autenticado(await servicos.convites.aceitar(token, dados)))
  }, [])

  const trocarPerfil = useCallback(async (perfil: Perfil) => {
    setEstado(autenticado(await servicos.autenticacao.trocarPerfil(perfil)))
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
    entrar, entrarDemonstracao, entrarComConvite, trocarPerfil, sair,
  }), [estado, entrar, entrarDemonstracao, entrarComConvite, trocarPerfil, sair])

  return <SessaoCtx.Provider value={valor}>{children}</SessaoCtx.Provider>
}

export function usarSessao() {
  const ctx = useContext(SessaoCtx)
  if (!ctx) throw new Error('usarSessao precisa estar dentro de ProvedorSessao')
  return ctx
}
