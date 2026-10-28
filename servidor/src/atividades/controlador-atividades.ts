import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common'
import type { AtividadeCasa, Pagina } from '@sinctea/compartilhado'
import { Auditar, Perfis } from '../acesso/metadados.js'
import type { DoPaciente } from '../clinica/servico-planos.js'
import { lerBooleano, lerPaginacao } from '../http/paginacao.js'
import type { RequisicaoHttp } from '../http/tipos-http.js'
import { ServicoAtividades } from './servico-atividades.js'

/**
 * As rotas das atividades de casa (item 15). A clinica prescreve e encerra; a
 * familia ve e registra como foi; a escola e a administracao nao entram
 * (regra 3). Toda leitura e escrita entra na trilha pelo interceptador, e a
 * negativa, pelo filtro de erros (regra 6).
 */

const CLINICA = ['TERAPEUTA', 'COORDENADOR'] as const
const CLINICA_E_FAMILIA = [...CLINICA, 'RESPONSAVEL'] as const
const sessaoDe = (req: RequisicaoHttp) => req.sinctea!.sessao!
const deParametro = { parametro: 'id' }
function doPaciente<T>(req: RequisicaoHttp, { resultado, pacienteId }: DoPaciente<T>): T {
  req.sinctea!.pacienteId = pacienteId
  return resultado
}

@Controller()
export class ControladorAtividades {
  constructor(private readonly atividades: ServicoAtividades) {}

  @Get('pacientes/:id/atividades')
  @Perfis(...CLINICA_E_FAMILIA)
  @Auditar({
    entidade: 'AtividadeCasa', acao: 'LEITURA_AUTORIZADA', pacienteId: deParametro,
    detalhe: (_q, r) => `Atividades de casa: ${(r as Pagina<unknown>).total}.`,
  })
  listar(@Req() req: RequisicaoHttp, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    return this.atividades.listarPorPaciente(sessaoDe(req), id, { ...lerPaginacao(query), ativa: lerBooleano(query.ativa) })
  }

  @Get('atividades/:id')
  @Perfis(...CLINICA_E_FAMILIA)
  @Auditar({
    entidade: 'AtividadeCasa', acao: 'LEITURA_AUTORIZADA', idEntidade: deParametro,
    pacienteId: (_q, r) => (r as AtividadeCasa).pacienteId, detalhe: 'Leitura da atividade de casa.',
  })
  obter(@Req() req: RequisicaoHttp, @Param('id') id: string) {
    return this.atividades.obter(sessaoDe(req), id)
  }

  @Post('atividades')
  @Perfis(...CLINICA)
  @Auditar({
    entidade: 'AtividadeCasa', acao: 'CRIACAO', idEntidade: (_q, r) => (r as AtividadeCasa).id,
    pacienteId: (_q, r) => (r as AtividadeCasa).pacienteId,
    detalhe: (_q, r) => `Atividade de casa prescrita: ${(r as AtividadeCasa).titulo}.`,
  })
  prescrever(@Req() req: RequisicaoHttp, @Body() corpo: Record<string, unknown> | undefined) {
    return this.atividades.prescrever(sessaoDe(req), corpo ?? {})
  }

  @Post('atividades/:id/encerramento')
  @HttpCode(200)
  @Perfis(...CLINICA)
  @Auditar({
    entidade: 'AtividadeCasa', acao: 'ALTERACAO', idEntidade: deParametro,
    pacienteId: (_q, r) => (r as AtividadeCasa).pacienteId, detalhe: 'Prescrição encerrada.',
  })
  encerrar(@Req() req: RequisicaoHttp, @Param('id') id: string) {
    return this.atividades.encerrar(sessaoDe(req), id)
  }

  /** O que a familia conta fica no registro, e nao na trilha: a trilha diz que ela registrou. */
  @Post('atividades/:id/execucoes')
  @Perfis('RESPONSAVEL')
  @Auditar({
    entidade: 'ExecucaoAtividadeCasa', acao: 'CRIACAO', idEntidade: (_q, r) => (r as { id: string }).id,
    detalhe: 'Execução registrada pela família.',
  })
  async registrar(@Req() req: RequisicaoHttp, @Param('id') id: string, @Body() corpo: Record<string, unknown> | undefined) {
    return doPaciente(req, await this.atividades.registrarExecucao(sessaoDe(req), id, corpo ?? {}))
  }

  @Get('atividades/:id/execucoes')
  @Perfis(...CLINICA_E_FAMILIA)
  @Auditar({
    entidade: 'ExecucaoAtividadeCasa', acao: 'LEITURA_AUTORIZADA',
    detalhe: (_q, r) => `Execuções da atividade de casa: ${(r as Pagina<unknown>).total}.`,
  })
  async listarExecucoes(@Req() req: RequisicaoHttp, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    return doPaciente(req, await this.atividades.listarExecucoes(sessaoDe(req), id, lerPaginacao(query)))
  }
}
