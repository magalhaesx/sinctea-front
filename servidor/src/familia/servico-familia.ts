import { Injectable } from '@nestjs/common'
import {
  ErroServico, type ConsentimentoConcedido, type ConsentimentoDetalhe, type FilhoResumo, type FiltroPaginacao,
  type ObjetivoAcessivel, type Pagina,
} from '@sinctea/compartilhado'
import {
  calcularExpiracaoConvite, consentimentoVigente, idadeEmAnos, situacaoConsentimento, validarNovoConsentimento,
} from '@sinctea/compartilhado/dominio/regras'
import { resumoDoTermo, VERSAO_CORRENTE_DO_TERMO } from '@sinctea/compartilhado/dominio/termo'
import { Negacao, SEM_PERMISSAO } from '../acesso/negacao.js'
import { novoToken, resumoDoToken } from '../autenticacao/tokens.js'
import { ServicoBanco } from '../banco/servico-banco.js'
import { alcancaClinicamente } from '../clinica/alcance.js'
import { deDataCivil, paraConsentimento, paraDataCivil } from '../clinica/mapeadores.js'
import type { DoPaciente } from '../clinica/servico-planos.js'
import { paginar, porNome } from '../http/paginacao.js'
import type { SessaoServidor } from '../http/tipos-http.js'
import { exigirUuid, exigirValido, textoOuVazio } from '../http/validacao.js'
import { exigirPacienteDaFamilia, exigirResponsavelLegal } from './acesso-familia.js'

const INCLUIR_DETALHE = {
  responsavel: { include: { usuario: true } },
  escola: true,
  convites: { orderBy: { criadoEm: 'desc' as const }, take: 1 },
  vinculos: { include: { professor: { include: { usuario: true } } }, take: 1 },
} as const

/**
 * Area da familia e consentimento (UC10, UC11, UC12; telas 15, 16 e 17),
 * portados de src/servicos/mock/familia.ts.
 *
 * Regra 1, assimetrica de proposito: conceder e reemitir convite ampliam o
 * acesso de quem esta fora da clinica, e exigem o responsavel legal; encerrar
 * nao pode ser dificultado, e qualquer responsavel vinculado encerra.
 */
@Injectable()
export class ServicoFamilia {
  constructor(private readonly banco: ServicoBanco) {}

  async listarFilhos(sessao: SessaoServidor, filtro: FiltroPaginacao): Promise<Pagina<FilhoResumo>> {
    const vinculos = await this.banco.vinculoFamiliar.findMany({
      where: { responsavelId: sessao.usuario.id, paciente: { ativo: true } }, include: { paciente: true },
    })
    const agora = new Date()
    const itens = vinculos.map((v) => ({
      id: v.pacienteId, nome: v.paciente.nome, idade: idadeEmAnos(paraDataCivil(v.paciente.dataNascimento), agora),
      // Parentesco e autoridade legal sao da relacao, e nao da pessoa.
      parentesco: v.parentesco, responsavelLegal: v.responsavelLegal,
    })).sort(porNome)
    return paginar(itens, filtro)
  }

  /** So a redacao acessivel, do plano vigente. A tecnica e o dominio nao saem daqui. */
  async listarObjetivos(sessao: SessaoServidor, pacienteId: string, filtro: FiltroPaginacao): Promise<Pagina<ObjetivoAcessivel>> {
    const { paciente } = await exigirPacienteDaFamilia(this.banco, sessao, pacienteId)
    const plano = await this.banco.planoTerapeutico.findFirst({
      where: { pacienteId: paciente.id, status: 'VIGENTE' }, include: { objetivos: true },
    })
    const itens = [...(plano?.objetivos ?? [])].sort((a, b) => a.id.localeCompare(b.id)).map((o) => ({
      id: o.id, descricaoAcessivel: o.descricaoAcessivel, status: o.status, percentualAtual: Number(o.percentualAtual),
    }))
    return paginar(itens, filtro)
  }

  // ------------------------------------------------------------ Consentimento

  async listarConsentimentos(sessao: SessaoServidor, pacienteId: string, filtro: FiltroPaginacao): Promise<Pagina<ConsentimentoDetalhe>> {
    const id = exigirUuid(pacienteId, 'Paciente')
    const paciente = await this.banco.paciente.findUnique({ where: { id }, include: { equipe: true } })
    if (!paciente) throw new ErroServico('NAO_ENCONTRADO', 'Paciente não encontrado.')
    const daFamilia = sessao.perfilAtivo === 'RESPONSAVEL' &&
      await this.banco.vinculoFamiliar.count({ where: { pacienteId: id, responsavelId: sessao.usuario.id } }) > 0
    if (!daFamilia && !alcancaClinicamente(sessao, paciente.equipe.map((e) => e.profissionalId))) {
      throw new Negacao(SEM_PERMISSAO, { pacienteId: id, detalhe: 'Paciente fora do alcance do perfil.' })
    }
    const linhas = await this.banco.consentimento.findMany({
      where: { pacienteId: id }, include: INCLUIR_DETALHE, orderBy: { concedidoEm: 'desc' },
    })
    return paginar(linhas.map((c) => detalhar(c)), filtro)
  }

  /** Regra 1: so o responsavel legal concede. Gera o convite de uso unico. */
  async conceder(sessao: SessaoServidor, dados: Record<string, unknown>): Promise<DoPaciente<ConsentimentoConcedido>> {
    const { paciente, vinculo } = await exigirPacienteDaFamilia(this.banco, sessao, textoOuVazio(dados.pacienteId))
    exigirResponsavelLegal(vinculo)
    const agora = new Date()
    const novo = {
      pacienteId: paciente.id,
      escolaId: textoOuVazio(dados.escolaId),
      escopos: Array.isArray(dados.escopos) ? [...new Set(dados.escopos as ConsentimentoDetalhe['escopos'])] : [],
      validadeAte: textoOuVazio(dados.validadeAte),
    }
    const erros = validarNovoConsentimento(novo, agora)
    const escola = /^[0-9a-f-]{36}$/i.test(novo.escolaId) ? await this.banco.escola.findUnique({ where: { id: novo.escolaId } }) : null
    if (!erros.escolaId && !escola) erros.escolaId = 'Escola não encontrada.'
    exigirValido(erros)

    // concedidoEm com milissegundo: e o que o banco guarda, e o resumo do termo o inclui.
    const concedidoEm = new Date(Math.floor(agora.getTime()))
    const hashTermo = await resumoDoTermo({
      versaoTermo: VERSAO_CORRENTE_DO_TERMO, responsavelId: sessao.usuario.id, pacienteId: paciente.id,
      escolaId: escola!.id, escopos: novo.escopos, validadeAte: novo.validadeAte, concedidoEm: concedidoEm.toISOString(),
    })
    const token = novoToken()
    const consentimento = await this.banco.$transaction(async (tx) => {
      const c = await tx.consentimento.create({ data: {
        responsavelId: sessao.usuario.id, pacienteId: paciente.id, escolaId: escola!.id, escopos: novo.escopos,
        concedidoEm, validadeAte: deDataCivil(novo.validadeAte), revogadoEm: null, hashTermo,
      } })
      // Sem consentimento nao ha convite. O vinculo so nasce quando o professor aceita.
      await tx.conviteEscolar.create({ data: {
        consentimentoId: c.id, tokenResumo: resumoDoToken(token), criadoEm: agora, expiraEm: calcularExpiracaoConvite(agora),
      } })
      return tx.consentimento.findUniqueOrThrow({ where: { id: c.id }, include: INCLUIR_DETALHE })
    })
    return {
      resultado: { consentimento: detalhar(consentimento), tokenConvite: token, conviteExpiraEm: consentimento.convites[0].expiraEm.toISOString() },
      pacienteId: paciente.id,
    }
  }

  private async consentimentoDaFamilia(sessao: SessaoServidor, consentimentoId: string) {
    const c = await this.banco.consentimento.findUnique({ where: { id: exigirUuid(consentimentoId, 'Consentimento') } })
    if (!c) throw new ErroServico('NAO_ENCONTRADO', 'Consentimento não encontrado.')
    const { vinculo } = await exigirPacienteDaFamilia(this.banco, sessao, c.pacienteId)
    return { consentimento: c, vinculo }
  }

  /**
   * Convite novo e porta nova: quem aceitar passa a ver o cartao. Como
   * conceder, exige o responsavel legal. O anterior ainda nao usado vence agora.
   */
  async reemitirConvite(sessao: SessaoServidor, consentimentoId: string): Promise<DoPaciente<ConsentimentoConcedido & { conviteId: string }>> {
    const { consentimento: c, vinculo } = await this.consentimentoDaFamilia(sessao, consentimentoId)
    exigirResponsavelLegal(vinculo)
    const agora = new Date()
    if (!consentimentoVigente(paraConsentimento(c), agora)) {
      throw new ErroServico('CONFLITO', 'Este acesso não está mais vigente. Autorize de novo para gerar um convite.')
    }
    const token = novoToken()
    const { convite, detalhe } = await this.banco.$transaction(async (tx) => {
      // Nunca dois tokens validos ao mesmo tempo.
      await tx.conviteEscolar.updateMany({ where: { consentimentoId: c.id, usadoEm: null, expiraEm: { gt: agora } }, data: { expiraEm: agora } })
      const convite = await tx.conviteEscolar.create({ data: {
        consentimentoId: c.id, tokenResumo: resumoDoToken(token), criadoEm: agora, expiraEm: calcularExpiracaoConvite(agora),
      } })
      const detalhe = await tx.consentimento.findUniqueOrThrow({ where: { id: c.id }, include: INCLUIR_DETALHE })
      return { convite, detalhe }
    })
    return {
      resultado: { consentimento: detalhar(detalhe), tokenConvite: token, conviteExpiraEm: convite.expiraEm.toISOString(), conviteId: convite.id },
      pacienteId: c.pacienteId,
    }
  }

  /**
   * Regra 5: efeito imediato — toda leitura da escola relê o consentimento.
   * Sem exigir o responsavel legal, de proposito: qualquer responsavel
   * vinculado que perceba um problema fecha a porta na hora.
   */
  async revogar(sessao: SessaoServidor, consentimentoId: string): Promise<DoPaciente<ConsentimentoDetalhe> & { jaEstavaRevogado: boolean }> {
    const { consentimento: c } = await this.consentimentoDaFamilia(sessao, consentimentoId)
    const jaEstavaRevogado = c.revogadoEm !== null
    const detalhe = await this.banco.$transaction(async (tx) => {
      if (!jaEstavaRevogado) {
        await tx.consentimento.update({ where: { id: c.id }, data: { revogadoEm: new Date() } })
        // O vinculo do ano letivo tambem se encerra; o controle continua no consentimento.
        await tx.vinculoEscolar.updateMany({ where: { consentimentoId: c.id }, data: { status: 'ENCERRADO' } })
      }
      return tx.consentimento.findUniqueOrThrow({ where: { id: c.id }, include: INCLUIR_DETALHE })
    })
    return { resultado: detalhar(detalhe), pacienteId: c.pacienteId, jaEstavaRevogado }
  }
}

type LinhaDetalhe = Parameters<typeof paraConsentimento>[0] & {
  responsavel: { usuario: { nome: string } }
  escola: { nome: string }
  convites: Array<{ usadoEm: Date | null }>
  vinculos: Array<{ id: string; turma: string; professor: { usuario: { nome: string } } }>
}

function detalhar(c: LinhaDetalhe): ConsentimentoDetalhe {
  const consentimento = paraConsentimento(c)
  const vinculo = c.vinculos[0]
  return {
    ...consentimento,
    situacao: situacaoConsentimento(consentimento, new Date()),
    responsavel: c.responsavel.usuario.nome,
    escola: c.escola.nome,
    vinculoId: vinculo?.id ?? null,
    professor: vinculo?.professor.usuario.nome ?? null,
    turma: vinculo?.turma ?? null,
    conviteAceito: c.convites[0]?.usadoEm != null,
  }
}
