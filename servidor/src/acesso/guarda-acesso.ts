import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ErroServico, type Perfil } from '@sinctea/compartilhado'
import { ServicoSessoes } from '../autenticacao/servico-sessoes.js'
import type { RequisicaoHttp, RespostaHttp } from '../http/tipos-http.js'
import { CHAVE_AUDITORIA, CHAVE_PERFIS, CHAVE_PUBLICO, type DeclaracaoAuditoria } from './metadados.js'

/**
 * A guarda de toda rota (docs/07, D7): resolve a sessao pelo cookie, exige a
 * sessao onde a rota nao e publica e o perfil onde a rota diz quais servem.
 *
 * Rota sem declaracao de auditoria nao responde. E erro de programacao, e
 * falha fechada: a ausencia de @Auditar nunca vira leitura sem registro.
 */
@Injectable()
export class GuardaAcesso implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessoes: ServicoSessoes,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const alvos = [contexto.getHandler(), contexto.getClass()]
    const declaracao = this.reflector.getAllAndOverride<DeclaracaoAuditoria | undefined>(CHAVE_AUDITORIA, alvos)
    if (!declaracao) {
      throw new Error(`Rota sem declaracao de auditoria: ${contexto.getClass().name}.${contexto.getHandler().name}`)
    }
    const publico = this.reflector.getAllAndOverride<boolean | undefined>(CHAVE_PUBLICO, alvos) ?? false
    const perfis = this.reflector.getAllAndOverride<Perfil[] | undefined>(CHAVE_PERFIS, alvos)

    const http = contexto.switchToHttp()
    const requisicao = http.getRequest<RequisicaoHttp>()
    const resposta = http.getResponse<RespostaHttp>()
    const sessao = await this.sessoes.resolver(requisicao, resposta)
    requisicao.sinctea = { sessao, declaracao }

    if (publico) return true
    if (!sessao) throw new ErroServico('NAO_AUTENTICADO', 'Sua sessão terminou. Entre novamente.')
    if (perfis && !perfis.includes(sessao.perfilAtivo)) {
      requisicao.sinctea.detalheNegativa = `Perfil ${sessao.perfilAtivo} sem permissão.`
      throw new ErroServico('ACESSO_NEGADO', 'Você não tem permissão para acessar esta informação.')
    }
    return true
  }
}
