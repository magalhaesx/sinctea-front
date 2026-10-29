import { Injectable } from '@nestjs/common'
import {
  ErroServico, type FiltroAuditoria, type Pagina, type PessoaDaTrilha, type RegistroDaTrilha,
} from '@sinctea/compartilhado'
import {
  csvDaAuditoria, LIMITE_DA_EXPORTACAO, POR_PAGINA_DA_AUDITORIA, RECORTE_GRANDE_DEMAIS, validarFiltroAuditoria,
} from '@sinctea/compartilhado/dominio/auditoria'
import { fimDaValidade, inicioDoDia } from '@sinctea/compartilhado/dominio/datas'
import { ServicoBanco } from '../banco/servico-banco.js'
import { exigirValido } from '../http/validacao.js'

/**
 * Projecao explicita, campo a campo: o ipOrigem fica no banco, por
 * minimizacao, e nao sai nem na tela nem no CSV (item 17).
 */
const PROJECAO = {
  id: true, ocorridoEm: true, usuarioId: true, usuarioNome: true, perfil: true, acao: true, entidade: true,
  idEntidade: true, pacienteId: true, origem: true, detalhe: true, valorAnterior: true,
} as const

const ORDEM = [{ ocorridoEm: 'desc' as const }, { id: 'desc' as const }]

/**
 * A consulta da trilha (item 17, tela 13), so da coordenacao. O filtro e o de
 * validarFiltroAuditoria, o mesmo da tela; o periodo e em dias de Manaus. A
 * pagina e contada e cortada no banco, e a exportacao leva o recorte inteiro,
 * ate LIMITE_DA_EXPORTACAO. Quem registra a leitura e o interceptador.
 */
@Injectable()
export class ServicoConsultaAuditoria {
  constructor(private readonly banco: ServicoBanco) {}

  private onde(filtro: FiltroAuditoria) {
    exigirValido(validarFiltroAuditoria(filtro))
    return {
      ...(filtro.usuarioId ? { usuarioId: filtro.usuarioId.toLowerCase() } : {}),
      ...(filtro.pacienteId ? { pacienteId: filtro.pacienteId.toLowerCase() } : {}),
      ...(filtro.acao ? { acao: filtro.acao } : {}),
      ...(filtro.entidade ? { entidade: filtro.entidade } : {}),
      ...(filtro.desde || filtro.ate ? {
        ocorridoEm: {
          ...(filtro.desde ? { gte: inicioDoDia(filtro.desde) } : {}),
          ...(filtro.ate ? { lt: fimDaValidade(filtro.ate) } : {}),
        },
      } : {}),
    }
  }

  async listar(filtro: FiltroAuditoria): Promise<Pagina<RegistroDaTrilha>> {
    const where = this.onde(filtro)
    const pagina = Math.max(1, Math.floor(filtro.pagina ?? 1))
    const [total, linhas] = await Promise.all([
      this.banco.registroAuditoria.count({ where }),
      this.banco.registroAuditoria.findMany({
        where, orderBy: ORDEM, skip: (pagina - 1) * POR_PAGINA_DA_AUDITORIA, take: POR_PAGINA_DA_AUDITORIA, select: PROJECAO,
      }),
    ])
    return { itens: linhas.map(paraRegistro), total, pagina, porPagina: POR_PAGINA_DA_AUDITORIA }
  }

  /** O recorte inteiro do filtro, e nao a pagina; acima do limite, nada sai. */
  async exportar(filtro: FiltroAuditoria): Promise<{ csv: string; total: number }> {
    const where = this.onde(filtro)
    if (await this.banco.registroAuditoria.count({ where }) > LIMITE_DA_EXPORTACAO) {
      throw new ErroServico('VALIDACAO', RECORTE_GRANDE_DEMAIS)
    }
    const linhas = await this.banco.registroAuditoria.findMany({ where, orderBy: ORDEM, take: LIMITE_DA_EXPORTACAO, select: PROJECAO })
    return { csv: csvDaAuditoria(linhas.map(paraRegistro)), total: linhas.length }
  }

  /**
   * As pessoas que aparecem na trilha, de toda ela, e nao so das ultimas
   * paginas: o nome e o do registro mais recente de cada uma, e a ordem e
   * alfabetica.
   */
  async listarPessoas(): Promise<PessoaDaTrilha[]> {
    const linhas = await this.banco.$queryRaw<PessoaDaTrilha[]>`
      SELECT DISTINCT ON ("usuarioId") "usuarioId"::text AS "usuarioId", "usuarioNome" AS "nome"
      FROM "registro_auditoria"
      WHERE "usuarioId" IS NOT NULL AND "usuarioNome" IS NOT NULL
      ORDER BY "usuarioId", "ocorridoEm" DESC, "id" DESC`
    return linhas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.usuarioId.localeCompare(b.usuarioId))
  }
}

type LinhaProjetada = Omit<RegistroDaTrilha, 'ocorridoEm'> & { ocorridoEm: Date }

function paraRegistro(l: LinhaProjetada): RegistroDaTrilha {
  return {
    id: l.id, ocorridoEm: l.ocorridoEm.toISOString(), usuarioId: l.usuarioId, usuarioNome: l.usuarioNome,
    perfil: l.perfil, acao: l.acao, entidade: l.entidade, idEntidade: l.idEntidade, pacienteId: l.pacienteId,
    origem: l.origem, detalhe: l.detalhe, valorAnterior: l.valorAnterior,
  }
}
