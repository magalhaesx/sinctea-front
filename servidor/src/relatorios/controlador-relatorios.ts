import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common'
import type { Pagina, RelatorioEvolucao } from '@sinctea/compartilhado'
import { Auditar, Perfis } from '../acesso/metadados.js'
import type { DoPaciente } from '../clinica/servico-planos.js'
import { lerPaginacao } from '../http/paginacao.js'
import type { RequisicaoHttp } from '../http/tipos-http.js'
import { ServicoRelatorios } from './servico-relatorios.js'

const sessaoDe = (req: RequisicaoHttp) => req.sinctea!.sessao!
const deParametro = { parametro: 'id' }
function doPaciente<T>(req: RequisicaoHttp, { resultado, pacienteId }: DoPaciente<T>): T {
  req.sinctea!.pacienteId = pacienteId
  return resultado
}
const paraQuem = (r: RelatorioEvolucao) => (r.destinatario === 'FAMILIA' ? 'a família' : 'a equipe')

/**
 * O relatorio de evolucao (item 18): so a equipe do paciente e a coordenacao.
 * Professor, responsavel e administrador sao recusados pela marca da rota, e
 * a negativa entra na trilha. Toda operacao deixa uma linha, com o paciente:
 * a previa tambem, porque le as sessoes dele. Nao existe rota de editar nem de
 * excluir.
 */
@Controller()
@Perfis('TERAPEUTA', 'COORDENADOR')
export class ControladorRelatorios {
  constructor(private readonly relatorios: ServicoRelatorios) {}

  @Post('pacientes/:id/relatorios/previa')
  @HttpCode(200)
  @Auditar({ entidade: 'RelatorioEvolucao', acao: 'LEITURA_AUTORIZADA', pacienteId: deParametro, detalhe: 'Prévia do relatório de evolução.' })
  previsualizar(@Req() req: RequisicaoHttp, @Param('id') id: string, @Body() corpo: unknown) {
    return this.relatorios.previsualizar(sessaoDe(req), id, corpo)
  }

  @Post('pacientes/:id/relatorios')
  @Auditar({
    entidade: 'RelatorioEvolucao', acao: 'CRIACAO', pacienteId: deParametro,
    idEntidade: (_q, r) => (r as RelatorioEvolucao).id,
    detalhe: (_q, r) => `Relatório emitido para ${paraQuem(r as RelatorioEvolucao)}.`,
  })
  emitir(@Req() req: RequisicaoHttp, @Param('id') id: string, @Body() corpo: unknown) {
    return this.relatorios.emitir(sessaoDe(req), id, corpo)
  }

  @Get('pacientes/:id/relatorios')
  @Auditar({
    entidade: 'RelatorioEvolucao', acao: 'LEITURA_AUTORIZADA', pacienteId: deParametro,
    detalhe: (_q, r) => `Relatórios emitidos: ${(r as Pagina<RelatorioEvolucao>).total}.`,
  })
  listar(@Req() req: RequisicaoHttp, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    return this.relatorios.listarPorPaciente(sessaoDe(req), id, lerPaginacao(query))
  }

  @Get('relatorios/:id')
  @Auditar({ entidade: 'RelatorioEvolucao', acao: 'LEITURA_AUTORIZADA', idEntidade: deParametro, detalhe: 'Relatório de evolução emitido.' })
  async obter(@Req() req: RequisicaoHttp, @Param('id') id: string) {
    return doPaciente(req, await this.relatorios.obter(sessaoDe(req), id))
  }
}
