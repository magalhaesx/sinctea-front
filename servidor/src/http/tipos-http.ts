import type { Perfil } from '@sinctea/compartilhado'
import type { DeclaracaoAuditoria } from '../acesso/metadados.js'

/**
 * O pouco do Express que o servidor usa, tipado aqui: sem @types/express como
 * dependencia, e sem o resto da API do Express a vista.
 */

export interface OpcoesCookie {
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax'
  path: string
  maxAge?: number
}

export interface UsuarioDaSessao {
  id: string
  nome: string
  email: string
  perfis: Perfil[]
  ativo: boolean
  ultimoAcessoEm: Date | null
}

/** Quem esta agindo, resolvido pelo cookie a cada requisicao. */
export interface SessaoServidor {
  sessaoId: string
  usuario: UsuarioDaSessao
  perfilAtivo: Perfil
  /** A vaga do navegador em que a sessao esta (item 9). */
  vaga?: number
}

/** O que a guarda deixa na requisicao para o interceptador e o filtro. */
export interface ContextoSinctea {
  sessao: SessaoServidor | null
  declaracao: DeclaracaoAuditoria
  /** Detalhe da negativa, quando quem nega sabe dizer mais que a mensagem. */
  detalheNegativa?: string
  /**
   * O paciente do dado, quando a rota chega por outro caminho (plano, objetivo,
   * sessao) e o controlador o descobre. O interceptador o prefere ao da rota.
   */
  pacienteId?: string
  /** O id do registro criado, quando a resposta nao o traz (o aceite do convite). */
  idEntidade?: string
  /** A versao anterior dos campos que mudaram (a correcao de ocorrencia escolar). */
  valorAnterior?: string
  /**
   * A operacao nao mudou nem revelou nada — o convite que nao vale mais, a
   * revogacao repetida —, e nao ha o que registrar. A negativa nunca usa isto.
   */
  dispensarRegistro?: boolean
}

export interface RequisicaoHttp {
  headers: Record<string, string | string[] | undefined>
  params: Record<string, string>
  body: unknown
  ip?: string
  sinctea?: ContextoSinctea
}

export interface RespostaHttp {
  cookie(nome: string, valor: string, opcoes: OpcoesCookie): unknown
  clearCookie(nome: string, opcoes: OpcoesCookie): unknown
  status(codigo: number): RespostaHttp
  json(corpo: unknown): unknown
}
