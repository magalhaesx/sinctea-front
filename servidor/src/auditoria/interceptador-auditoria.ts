import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common'
import { mergeMap, type Observable } from 'rxjs'
import { resolver } from '../acesso/metadados.js'
import type { RequisicaoHttp } from '../http/tipos-http.js'
import { ServicoAuditoria } from './servico-auditoria.js'

/**
 * Regra 6, no servidor: toda leitura e escrita de dado do paciente e
 * registrada aqui, pela declaracao da rota, e nao por cada funcao lembrando.
 *
 * O registro e gravado ANTES de a resposta sair. Se a gravacao falhar, a
 * resposta falha junto: nenhum dado do paciente sai sem deixar rastro.
 */
@Injectable()
export class InterceptadorAuditoria implements NestInterceptor {
  constructor(private readonly auditoria: ServicoAuditoria) {}

  intercept(contexto: ExecutionContext, proximo: CallHandler): Observable<unknown> {
    const requisicao = contexto.switchToHttp().getRequest<RequisicaoHttp>()
    return proximo.handle().pipe(mergeMap(async (resposta: unknown) => {
      const ctx = requisicao.sinctea
      const declaracao = ctx?.declaracao
      if (ctx && declaracao?.acao && !ctx.dispensarRegistro) {
        await this.auditoria.registrar(ctx.sessao, {
          acao: declaracao.acao,
          entidade: declaracao.entidade,
          idEntidade: ctx.idEntidade ?? textoOuNulo(resolver(declaracao.idEntidade, requisicao, resposta)),
          pacienteId: ctx.pacienteId ?? textoOuNulo(resolver(declaracao.pacienteId, requisicao, resposta)),
          detalhe: ctx.detalhe ?? textoOuNulo(resolver(declaracao.detalhe, requisicao, resposta)) ?? declaracao.entidade,
          ipOrigem: requisicao.ip ?? null,
          valorAnterior: ctx.valorAnterior ?? null,
        })
      }
      return resposta
    }))
  }
}

function textoOuNulo(valor: unknown): string | null {
  return typeof valor === 'string' && valor.length > 0 ? valor : null
}
