import { Injectable } from '@nestjs/common'
import {
  ErroServico, type AcaoAuditoria, type FiltroTrilhaAdministrativa, type Pagina, type RegistroAdministrativo,
} from '@sinctea/compartilhado'
import { ENTIDADES_ADMINISTRATIVAS, semNomeNaTrilhaAdministrativa } from '@sinctea/compartilhado/dominio/auditoria'
import { fimDaValidade, inicioDoDia, partesDaDataCivil } from '@sinctea/compartilhado/dominio/datas'
import { ServicoBanco } from '../banco/servico-banco.js'
import { exigirUuid, exigirValido } from '../http/validacao.js'

export const POR_PAGINA_DA_TRILHA = 20

const ACOES: AcaoAuditoria[] = ['CONCESSAO_ACESSO', 'REVOGACAO_ACESSO', 'LEITURA_AUTORIZADA', 'ACESSO_NEGADO', 'CRIACAO', 'ALTERACAO']

/**
 * A trilha administrativa (item 13, tela 25). O administrador nunca alcanca
 * dado clinico (regra 3), nem pelo texto da auditoria: a consulta so devolve
 * registro sem paciente E de uma entidade da lista fechada — contas, links de
 * acesso, escolas e a propria trilha. As duas condicoes juntas: ha registro
 * clinico sem paciente (a leitura da lista de pacientes), e ha entidade da
 * lista que, noutra rota, leva paciente (o link do responsavel, item 8).
 *
 * O IP fica de fora da resposta. A projecao e explicita, campo a campo.
 *
 * O registro de escola feito por um responsavel sai sem o nome e sem o id de
 * quem agiu, e o filtro por pessoa nao o alcanca (item 13b): pelo id, a tela
 * 14 diria o nome.
 */
@Injectable()
export class ServicoTrilhaAdministrativa {
  constructor(private readonly banco: ServicoBanco) {}

  async listar(filtro: FiltroTrilhaAdministrativa): Promise<Pagina<RegistroAdministrativo>> {
    const erros: Record<string, string> = {}
    if (filtro.desde && !partesDaDataCivil(filtro.desde)) erros.desde = 'Escreva a data de início do período.'
    if (filtro.ate && !partesDaDataCivil(filtro.ate)) erros.ate = 'Escreva a data de fim do período.'
    if (filtro.desde && filtro.ate && !erros.desde && !erros.ate && filtro.ate < filtro.desde) {
      erros.ate = 'O fim do período precisa ser depois do início.'
    }
    if (filtro.acao && !ACOES.includes(filtro.acao)) erros.acao = 'Escolha uma ação da lista.'
    exigirValido(erros)
    const usuarioId = filtro.usuarioId ? exigirUuid(filtro.usuarioId, 'Usuário') : undefined

    const where = {
      pacienteId: null,
      entidade: { in: [...ENTIDADES_ADMINISTRATIVAS] },
      ...(usuarioId ? { usuarioId, NOT: { entidade: 'Escola', perfil: 'RESPONSAVEL' as const } } : {}),
      ...(filtro.acao ? { acao: filtro.acao } : {}),
      ...(filtro.desde || filtro.ate ? {
        ocorridoEm: {
          ...(filtro.desde ? { gte: inicioDoDia(filtro.desde) } : {}),
          ...(filtro.ate ? { lt: fimDaValidade(filtro.ate) } : {}),
        },
      } : {}),
    }
    const pagina = Math.max(1, Math.floor(filtro.pagina ?? 1))
    const [total, linhas] = await Promise.all([
      this.banco.registroAuditoria.count({ where }),
      this.banco.registroAuditoria.findMany({
        where,
        orderBy: [{ ocorridoEm: 'desc' }, { id: 'desc' }],
        skip: (pagina - 1) * POR_PAGINA_DA_TRILHA,
        take: POR_PAGINA_DA_TRILHA,
        select: {
          id: true, ocorridoEm: true, usuarioId: true, usuarioNome: true, perfil: true, acao: true,
          entidade: true, idEntidade: true, origem: true, detalhe: true, valorAnterior: true,
        },
      }),
    ])
    if (linhas.some((l) => !(ENTIDADES_ADMINISTRATIVAS as readonly string[]).includes(l.entidade))) {
      // A consulta ja recorta; isto so dispara se ela mudar e esquecer o recorte.
      throw new ErroServico('INDISPONIVEL', 'A trilha administrativa recusou um registro fora da lista.')
    }
    return {
      itens: linhas.map((l) => ({
        ...l,
        ocorridoEm: l.ocorridoEm.toISOString(),
        ...(semNomeNaTrilhaAdministrativa(l) ? { usuarioId: null, usuarioNome: null } : {}),
      })),
      total, pagina, porPagina: POR_PAGINA_DA_TRILHA,
    }
  }
}
