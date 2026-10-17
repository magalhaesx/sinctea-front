import { SetMetadata } from '@nestjs/common'
import type { Perfil, RegistroAuditoria } from '@sinctea/compartilhado'
import type { RequisicaoHttp } from '../http/tipos-http.js'

/**
 * O que cada rota declara sobre si (docs/07, D7). A guarda e o interceptador
 * leem estas marcas; nenhuma funcao de servico "lembra" de auditar.
 *
 * Toda rota declara a auditoria, com @Auditar ou @SemDadoDoPaciente. Rota sem
 * declaracao nao responde: a guarda recusa com erro de programacao, e o teste
 * de rotas acusa antes de chegar ao ar.
 */

export const CHAVE_PUBLICO = 'sinctea:publico'
export const CHAVE_PERFIS = 'sinctea:perfis'
export const CHAVE_AUDITORIA = 'sinctea:auditoria'

/** Rota que responde sem sessao: entrar, primeiro acesso, saude. */
export const Publico = () => SetMetadata(CHAVE_PUBLICO, true)

/** Perfis que podem chamar a rota. Fora deles, ACESSO_NEGADO, registrado. */
export const Perfis = (...perfis: Perfil[]) => SetMetadata(CHAVE_PERFIS, perfis)

type DeOnde<T> = T | ((requisicao: RequisicaoHttp, resposta: unknown) => T)

export interface DeclaracaoAuditoria {
  /** A entidade que a rota le ou escreve, como no diagrama de classes. */
  entidade: string
  /**
   * O que se registra quando a rota responde com sucesso. Nulo: a rota nao
   * toca dado do paciente, e so a negativa entra na trilha (regra 6).
   */
  acao: Exclude<RegistroAuditoria['acao'], 'ACESSO_NEGADO'> | null
  /** O paciente: nome do parametro da rota, ou funcao sobre requisicao e resposta. */
  pacienteId?: DeOnde<string | null> | { parametro: string }
  idEntidade?: DeOnde<string | null> | { parametro: string }
  detalhe?: DeOnde<string>
}

/** Rota que le ou escreve dado do paciente: o interceptador registra o sucesso. */
export const Auditar = (declaracao: Required<Pick<DeclaracaoAuditoria, 'entidade' | 'acao' | 'detalhe'>> &
  DeclaracaoAuditoria) => SetMetadata(CHAVE_AUDITORIA, declaracao)

/**
 * Rota que nao toca dado do paciente (entrar, sair, saude). Declarar isso e
 * obrigatorio: a ausencia de @Auditar nunca e silenciosa.
 */
export const SemDadoDoPaciente = (entidade: string) =>
  SetMetadata(CHAVE_AUDITORIA, { entidade, acao: null } satisfies DeclaracaoAuditoria)

/** Resolve um campo da declaracao contra a requisicao e a resposta. */
export function resolver<T>(
  valor: DeOnde<T> | { parametro: string } | undefined,
  requisicao: RequisicaoHttp,
  resposta: unknown,
): T | string | null {
  if (valor === undefined) return null
  if (typeof valor === 'function') return (valor as (r: RequisicaoHttp, s: unknown) => T)(requisicao, resposta)
  if (typeof valor === 'object' && valor !== null && 'parametro' in valor) {
    return requisicao.params[(valor as { parametro: string }).parametro] ?? null
  }
  return valor as T
}
