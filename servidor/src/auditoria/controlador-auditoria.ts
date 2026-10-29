import { Controller, Get, Query, Req, Res } from '@nestjs/common'
import type { AcaoAuditoria, DataCivil, FiltroAuditoria, Pagina, RegistroDaTrilha } from '@sinctea/compartilhado'
import { descreverFiltroAuditoria, nomeDoArquivoDaAuditoria } from '@sinctea/compartilhado/dominio/auditoria'
import { Auditar, Perfis, SemDadoDoPaciente } from '../acesso/metadados.js'
import { lerPaginacao, lerTexto } from '../http/paginacao.js'
import type { RequisicaoHttp, RespostaHttp } from '../http/tipos-http.js'
import { ServicoConsultaAuditoria } from './servico-consulta-auditoria.js'

function lerFiltro(query: Record<string, unknown>): FiltroAuditoria {
  return {
    desde: lerTexto(query.desde) as DataCivil | undefined,
    ate: lerTexto(query.ate) as DataCivil | undefined,
    usuarioId: lerTexto(query.usuarioId),
    pacienteId: lerTexto(query.pacienteId),
    acao: lerTexto(query.acao) as AcaoAuditoria | undefined,
    entidade: lerTexto(query.entidade),
  }
}

/**
 * /api/auditoria — a trilha de auditoria (item 17, tela 13), so da
 * coordenacao. Ler a trilha e exportar entram nela, uma linha cada, com o
 * paciente quando o filtro tem um: sem ele, o registro iria para a trilha
 * administrativa da tela 25. A negativa de quem nao e da coordenacao fica
 * nela, pela entidade destas rotas. Nao existe rota de editar nem de excluir.
 */
@Controller('auditoria')
@Perfis('COORDENADOR')
export class ControladorAuditoria {
  constructor(private readonly consulta: ServicoConsultaAuditoria) {}

  @Get()
  @Auditar({ entidade: 'RegistroAuditoria', acao: 'LEITURA_AUTORIZADA', detalhe: 'Trilha de auditoria consultada.' })
  async listar(@Req() req: RequisicaoHttp, @Query() query: Record<string, unknown>): Promise<Pagina<RegistroDaTrilha>> {
    const filtro = { ...lerFiltro(query), pagina: lerPaginacao(query).pagina }
    const pagina = await this.consulta.listar(filtro)
    this.paraATrilha(req, filtro, `Trilha de auditoria consultada: ${pagina.total} ${pagina.total === 1 ? 'registro' : 'registros'} (${descreverFiltroAuditoria(filtro)}).`)
    return pagina
  }

  /** As opcoes do filtro por pessoa: nao e uma consulta da trilha, e so a negativa entra nela. */
  @Get('pessoas')
  @SemDadoDoPaciente('RegistroAuditoria')
  listarPessoas() {
    return this.consulta.listarPessoas()
  }

  @Get('exportacao')
  @Auditar({ entidade: 'RegistroAuditoria', acao: 'LEITURA_AUTORIZADA', detalhe: 'Exportação da trilha.' })
  async exportar(
    @Req() req: RequisicaoHttp, @Query() query: Record<string, unknown>, @Res({ passthrough: true }) res: RespostaHttp,
  ): Promise<string> {
    const filtro = lerFiltro(query)
    const { csv, total } = await this.consulta.exportar(filtro)
    this.paraATrilha(req, filtro, `Exportação da trilha: ${total} ${total === 1 ? 'registro' : 'registros'} (${descreverFiltroAuditoria(filtro)}).`)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${nomeDoArquivoDaAuditoria(new Date())}"`)
    return csv
  }

  /** O detalhe e o paciente do filtro, para a linha que o interceptador grava. */
  private paraATrilha(req: RequisicaoHttp, filtro: FiltroAuditoria, detalhe: string) {
    req.sinctea!.detalhe = detalhe
    if (filtro.pacienteId) req.sinctea!.pacienteId = filtro.pacienteId.toLowerCase()
  }
}
