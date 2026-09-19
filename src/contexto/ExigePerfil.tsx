import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { Perfil } from '../servicos'
import { usarSessao } from './Sessao'

/**
 * Protege uma rota do app pelo perfil ativo.
 *
 * ATENCAO: ESTE REDIRECIONAMENTO NAO E SEGURANCA. E APENAS NAVEGACAO.
 * Ele evita que alguem caia numa tela que nao e sua, mas qualquer pessoa pode
 * alterar o codigo que roda no proprio navegador. A verificacao real — perfil,
 * consentimento vigente, escopo e auditoria — acontece no servidor, a cada
 * requisicao. Enquanto o servidor nao existe, quem faz esse papel e a camada
 * de servicos simulada (servicos/mock), nunca este componente.
 *
 * Sem sessao: vai para /app/entrar, guardando o destino para voltar depois.
 * Com sessao em outro perfil: vai para /app, que redireciona ao painel certo.
 */
export function ExigePerfil({ perfis, children }: { perfis: Perfil[]; children: ReactNode }) {
  const { estado } = usarSessao()
  const local = useLocation()

  if (estado.situacao === 'CARREGANDO') {
    return <p role="status" className="p-6 text-sm">Verificando sua sessão…</p>
  }

  if (estado.situacao === 'ANONIMO') {
    return <Navigate to="/app/entrar" replace state={{ destino: local.pathname + local.search }} />
  }

  if (!perfis.includes(estado.perfilAtivo)) {
    return <Navigate to="/app" replace />
  }

  return <>{children}</>
}
