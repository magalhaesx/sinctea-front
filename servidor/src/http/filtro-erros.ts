import { Catch, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common'
import { ErroServico, type CodigoErro } from '@sinctea/compartilhado'
import { resolver } from '../acesso/metadados.js'
import { ServicoAuditoria } from '../auditoria/servico-auditoria.js'
import type { RequisicaoHttp, RespostaHttp } from './tipos-http.js'

/** O mesmo mapa que o cliente do front le de volta (src/servicos/api/cliente.ts). */
const STATUS_POR_CODIGO: Record<CodigoErro, number> = {
  VALIDACAO: 422,
  NAO_AUTENTICADO: 401,
  ACESSO_NEGADO: 403,
  NAO_ENCONTRADO: 404,
  CONFLITO: 409,
  INDISPONIVEL: 503,
}

/**
 * ErroServico vira resposta HTTP com { codigo, mensagem, campos, motivo }, o
 * corpo que o cliente do front ja espera.
 *
 * Toda negativa de acesso (ACESSO_NEGADO) e registrada aqui, venha da guarda
 * ou do servico (regra 6: a tentativa negada entra na trilha). Sem sessao
 * (NAO_AUTENTICADO) nao ha quem registrar, como no mock (docs/06).
 */
@Catch(ErroServico)
export class FiltroErros implements ExceptionFilter {
  private readonly log = new Logger('FiltroErros')

  constructor(private readonly auditoria: ServicoAuditoria) {}

  async catch(erro: ErroServico, host: ArgumentsHost): Promise<void> {
    const http = host.switchToHttp()
    const requisicao = http.getRequest<RequisicaoHttp>()
    const resposta = http.getResponse<RespostaHttp>()

    if (erro.codigo === 'ACESSO_NEGADO') {
      const ctx = requisicao.sinctea
      try {
        await this.auditoria.registrar(ctx?.sessao ?? null, {
          acao: 'ACESSO_NEGADO',
          entidade: ctx?.declaracao.entidade ?? 'Desconhecida',
          idEntidade: textoOuNulo(resolver(ctx?.declaracao.idEntidade, requisicao, null)),
          pacienteId: textoOuNulo(resolver(ctx?.declaracao.pacienteId, requisicao, null)),
          detalhe: ctx?.detalheNegativa ?? `Negado: ${erro.message}`,
          ipOrigem: requisicao.ip ?? null,
        })
      } catch (falha) {
        // A negativa continua negativa: nada sai. O motivo fica no log do servidor.
        this.log.error(`Falha ao registrar a negativa: ${(falha as Error).message}`)
      }
    }

    resposta.status(STATUS_POR_CODIGO[erro.codigo] ?? 500).json({
      codigo: erro.codigo,
      mensagem: erro.message,
      campos: erro.campos,
      ...(erro.motivo ? { motivo: erro.motivo } : {}),
    })
  }
}

function textoOuNulo(valor: unknown): string | null {
  return typeof valor === 'string' && valor.length > 0 ? valor : null
}
