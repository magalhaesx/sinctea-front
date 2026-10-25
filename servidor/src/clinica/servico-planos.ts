import { Injectable } from '@nestjs/common'
import {
  ErroServico, type CartaoEstrategia, type NovoObjetivo, type Objetivo, type Pagina, type FiltroPaginacao,
  type PlanoParaValidacao, type PlanoTerapeutico,
} from '@sinctea/compartilhado'
import { inicioDoDia } from '@sinctea/compartilhado/dominio/datas'
import { anterioresQueMudaram } from '@sinctea/compartilhado/dominio/auditoria'
import { jsonCanonico } from '@sinctea/compartilhado/dominio/hash'
import {
  itensPreenchidos, objetivoAtingiuCriterio, planoEditavel, validarCartao, validarDevolucaoPlano, validarNovoObjetivo,
  validarNovoPlano,
} from '@sinctea/compartilhado/dominio/regras'
import { ServicoBanco } from '../banco/servico-banco.js'
import { paginar } from '../http/paginacao.js'
import type { SessaoServidor } from '../http/tipos-http.js'
import { exigirUuid, exigirValido, textoOuVazio } from '../http/validacao.js'
import { exigirPacienteClinico } from './alcance.js'
import { deDataCivil, paraCartao, paraDataCivil, paraObjetivo, paraPlano, paraSessao } from './mapeadores.js'

/** O resultado e de que paciente ele era: o controlador entrega o paciente a auditoria. */
export interface DoPaciente<T> { resultado: T; pacienteId: string }

/** Uma edicao: o valor anterior so dos campos que mudaram, ou nulo se nada mudou. */
export interface Editado<T> extends DoPaciente<T> { valorAnterior: string | null }

const exigirPlanoEditavel = (status: Parameters<typeof planoEditavel>[0]) => {
  if (!planoEditavel(status)) {
    throw new ErroServico('CONFLITO', 'O plano só se edita em rascunho ou devolvido pela coordenação. Vigente ou em validação, ele fica como está.')
  }
}

/**
 * Plano terapeutico, objetivos, dominio e cartao de estrategias (UC04, UC05,
 * UC06, UC15; telas 6 e 9), portado de src/servicos/mock/clinica.ts, mais o
 * "Criar plano" e o cartao escrito com conteudo (docs/07, secao 0, lacunas 3 e 5).
 */
@Injectable()
export class ServicoPlanos {
  constructor(private readonly banco: ServicoBanco) {}

  async obterPorPaciente(sessao: SessaoServidor, pacienteId: string): Promise<PlanoTerapeutico> {
    const paciente = await exigirPacienteClinico(this.banco, sessao, pacienteId)
    const plano = await this.banco.planoTerapeutico.findFirst({
      where: { pacienteId: paciente.id }, orderBy: { dataInicio: 'desc' }, include: { objetivos: true },
    })
    if (!plano) throw new ErroServico('NAO_ENCONTRADO', 'Plano terapêutico não encontrado.')
    return paraPlano(plano)
  }

  /** Lacuna 3: o paciente sem plano ganha um, em RASCUNHO, com as duas datas. */
  async criar(sessao: SessaoServidor, pacienteId: string, dados: Record<string, unknown>): Promise<PlanoTerapeutico> {
    const paciente = await exigirPacienteClinico(this.banco, sessao, pacienteId)
    const datas = { dataInicio: textoOuVazio(dados.dataInicio), dataRevisao: textoOuVazio(dados.dataRevisao) }
    exigirValido(validarNovoPlano(datas))
    if (await this.banco.planoTerapeutico.count({ where: { pacienteId: paciente.id } }) > 0) {
      throw new ErroServico('CONFLITO', 'Este paciente já tem plano terapêutico.')
    }
    const plano = await this.banco.planoTerapeutico.create({
      data: {
        pacienteId: paciente.id, autorId: sessao.usuario.id, status: 'RASCUNHO',
        dataInicio: deDataCivil(datas.dataInicio), dataRevisao: deDataCivil(datas.dataRevisao),
      },
      include: { objetivos: true },
    })
    return paraPlano(plano)
  }

  /** Equipe do paciente ou coordenacao. */
  private async planoAlcancado(sessao: SessaoServidor, planoId: string) {
    const plano = await this.banco.planoTerapeutico.findUnique({
      where: { id: exigirUuid(planoId, 'Plano terapêutico') }, include: { objetivos: true },
    })
    if (!plano) throw new ErroServico('NAO_ENCONTRADO', 'Plano terapêutico não encontrado.')
    await exigirPacienteClinico(this.banco, sessao, plano.pacienteId)
    return plano
  }

  /**
   * Rejeita objetivo sem descricao acessivel (regra 4). Nao existe geracao
   * automatica. So em rascunho ou devolvido, como a edicao (item 10): no plano
   * vigente ou na fila, o objetivo novo entraria sem passar pela coordenacao
   * (UC17), e a familia leria a redacao acessivel dele na hora.
   */
  async adicionarObjetivo(sessao: SessaoServidor, planoId: string, dados: Record<string, unknown>): Promise<DoPaciente<Objetivo>> {
    const plano = await this.planoAlcancado(sessao, planoId)
    exigirPlanoEditavel(plano.status)
    const criterio = (dados.criterio ?? {}) as Record<string, unknown>
    const novo: NovoObjetivo = {
      dominio: textoOuVazio(dados.dominio),
      descricaoTecnica: textoOuVazio(dados.descricaoTecnica),
      descricaoAcessivel: textoOuVazio(dados.descricaoAcessivel),
      criterio: { percentualMinimo: Number(criterio.percentualMinimo), sessoesConsecutivas: Number(criterio.sessoesConsecutivas) },
    }
    exigirValido(validarNovoObjetivo(novo))
    const objetivo = await this.banco.objetivo.create({ data: {
      planoId: plano.id, dominio: novo.dominio, descricaoTecnica: novo.descricaoTecnica,
      // Gravada exatamente como o terapeuta escreveu. Nenhuma geracao automatica.
      descricaoAcessivel: novo.descricaoAcessivel,
      status: 'NAO_INICIADO', dominadoEm: null, percentualAtual: 0,
      percentualMinimo: novo.criterio.percentualMinimo, sessoesConsecutivas: novo.criterio.sessoesConsecutivas,
    } })
    return { resultado: paraObjetivo(objetivo), pacienteId: plano.pacienteId }
  }

  /**
   * Item 7: as duas redacoes e o criterio, com o plano em rascunho ou
   * devolvido. A redacao acessivel continua sendo a do terapeuta (regra 4):
   * a edicao grava o que ele escreveu agora, e nada e derivado da tecnica.
   */
  async editarObjetivo(sessao: SessaoServidor, objetivoId: string, dados: Record<string, unknown>): Promise<Editado<Objetivo>> {
    const objetivo = await this.objetivoAlcancado(sessao, objetivoId)
    exigirPlanoEditavel(objetivo.plano.status)
    const criterio = (dados.criterio ?? {}) as Record<string, unknown>
    const novo: NovoObjetivo = {
      dominio: objetivo.dominio,
      descricaoTecnica: textoOuVazio(dados.descricaoTecnica),
      descricaoAcessivel: textoOuVazio(dados.descricaoAcessivel),
      criterio: { percentualMinimo: Number(criterio.percentualMinimo), sessoesConsecutivas: Number(criterio.sessoesConsecutivas) },
    }
    exigirValido(validarNovoObjetivo(novo))
    const depois = {
      descricaoTecnica: novo.descricaoTecnica, descricaoAcessivel: novo.descricaoAcessivel,
      percentualMinimo: novo.criterio.percentualMinimo, sessoesConsecutivas: novo.criterio.sessoesConsecutivas,
    }
    const anteriores = anterioresQueMudaram({
      descricaoTecnica: objetivo.descricaoTecnica, descricaoAcessivel: objetivo.descricaoAcessivel,
      percentualMinimo: objetivo.percentualMinimo, sessoesConsecutivas: objetivo.sessoesConsecutivas,
    }, depois)
    const pacienteId = objetivo.plano.pacienteId
    if (!anteriores) return { resultado: paraObjetivo(objetivo), pacienteId, valorAnterior: null }
    const editado = await this.banco.objetivo.update({ where: { id: objetivo.id }, data: depois })
    return { resultado: paraObjetivo(editado), pacienteId, valorAnterior: jsonCanonico(anteriores) }
  }

  /** Item 7: as datas do plano, nas mesmas condicoes da edicao do objetivo. */
  async editarDatas(sessao: SessaoServidor, planoId: string, dados: Record<string, unknown>): Promise<Editado<PlanoTerapeutico>> {
    const plano = await this.planoAlcancado(sessao, planoId)
    exigirPlanoEditavel(plano.status)
    const depois = { dataInicio: textoOuVazio(dados.dataInicio), dataRevisao: textoOuVazio(dados.dataRevisao) }
    exigirValido(validarNovoPlano(depois))
    const anteriores = anterioresQueMudaram(
      { dataInicio: paraDataCivil(plano.dataInicio), dataRevisao: paraDataCivil(plano.dataRevisao) }, depois)
    if (!anteriores) return { resultado: paraPlano(plano), pacienteId: plano.pacienteId, valorAnterior: null }
    const editado = await this.banco.planoTerapeutico.update({
      where: { id: plano.id },
      data: { dataInicio: deDataCivil(depois.dataInicio), dataRevisao: deDataCivil(depois.dataRevisao) },
      include: { objetivos: true },
    })
    return { resultado: paraPlano(editado), pacienteId: plano.pacienteId, valorAnterior: jsonCanonico(anteriores) }
  }

  async enviarParaValidacao(sessao: SessaoServidor, planoId: string): Promise<PlanoTerapeutico> {
    const plano = await this.planoAlcancado(sessao, planoId)
    if (plano.objetivos.length === 0) {
      throw new ErroServico('VALIDACAO', 'Adicione ao menos um objetivo antes de enviar o plano.')
    }
    if (plano.status === 'AGUARDANDO_VALIDACAO') throw new ErroServico('CONFLITO', 'O plano já aguarda validação.')
    return paraPlano(await this.banco.planoTerapeutico.update({
      where: { id: plano.id }, data: { status: 'AGUARDANDO_VALIDACAO' }, include: { objetivos: true },
    }))
  }

  async listarAguardandoValidacao(filtro: FiltroPaginacao): Promise<Pagina<PlanoParaValidacao>> {
    const planos = await this.banco.planoTerapeutico.findMany({
      where: { status: 'AGUARDANDO_VALIDACAO' },
      include: { objetivos: { select: { id: true } }, paciente: true, autor: { include: { usuario: true } } },
    })
    // A data do envio e a da trilha: o plano nao guarda quando foi enviado.
    const envios = await this.banco.registroAuditoria.findMany({
      where: { entidade: 'PlanoTerapeutico', acao: 'ALTERACAO', detalhe: 'Enviado para validação.', idEntidade: { in: planos.map((p) => p.id) } },
      select: { idEntidade: true, ocorridoEm: true },
    })
    const ultimoEnvio = new Map<string, Date>()
    for (const e of envios) {
      if (e.idEntidade && (!ultimoEnvio.has(e.idEntidade) || e.ocorridoEm > ultimoEnvio.get(e.idEntidade)!)) ultimoEnvio.set(e.idEntidade, e.ocorridoEm)
    }
    const itens = planos.map((p) => ({
      planoId: p.id,
      paciente: { id: p.pacienteId, nome: p.paciente.nome },
      autor: { id: p.autorId, nome: p.autor.usuario.nome, especialidade: p.autor.especialidade },
      enviadoEm: (ultimoEnvio.get(p.id) ?? inicioDoDia(p.dataInicio.toISOString().slice(0, 10))).toISOString(),
      totalObjetivos: p.objetivos.length,
    })).sort((a, b) => a.enviadoEm.localeCompare(b.enviadoEm))
    return paginar(itens, filtro)
  }

  /**
   * Quem escreveu nao valida. O coordenador tambem atende, e sem esta recusa a
   * validacao viraria assinatura do proprio trabalho.
   */
  private async planoAguardando(sessao: SessaoServidor, planoId: string) {
    const plano = await this.planoAlcancado(sessao, planoId)
    if (plano.status !== 'AGUARDANDO_VALIDACAO') throw new ErroServico('CONFLITO', 'Este plano não está aguardando validação.')
    if (plano.autorId === sessao.usuario.id) {
      throw new ErroServico('CONFLITO', 'Você escreveu este plano. A validação precisa de outra pessoa da coordenação.')
    }
    return plano
  }

  async aprovar(sessao: SessaoServidor, planoId: string): Promise<PlanoTerapeutico> {
    const plano = await this.planoAguardando(sessao, planoId)
    return paraPlano(await this.banco.planoTerapeutico.update({
      where: { id: plano.id },
      data: { status: 'VIGENTE', observacaoValidacao: null, ultimaRevisaoEm: new Date() },
      include: { objetivos: true },
    }))
  }

  async devolver(sessao: SessaoServidor, planoId: string, observacao: unknown): Promise<PlanoTerapeutico> {
    const plano = await this.planoAguardando(sessao, planoId)
    const texto = textoOuVazio(observacao)
    const erro = validarDevolucaoPlano(texto)
    if (erro) exigirValido({ observacao: erro })
    return paraPlano(await this.banco.planoTerapeutico.update({
      where: { id: plano.id }, data: { status: 'DEVOLVIDO', observacaoValidacao: texto }, include: { objetivos: true },
    }))
  }

  private async objetivoAlcancado(sessao: SessaoServidor, objetivoId: string) {
    const objetivo = await this.banco.objetivo.findUnique({
      where: { id: exigirUuid(objetivoId, 'Objetivo') }, include: { plano: true },
    })
    if (!objetivo) throw new ErroServico('NAO_ENCONTRADO', 'Objetivo não encontrado.')
    await exigirPacienteClinico(this.banco, sessao, objetivo.plano.pacienteId)
    return objetivo
  }

  /**
   * Unico caminho para DOMINADO. Status e dominadoEm mudam juntos, e so com o
   * criterio atingido nas sessoes do paciente.
   */
  async confirmarDominio(sessao: SessaoServidor, objetivoId: string): Promise<DoPaciente<Objetivo>> {
    const objetivo = await this.objetivoAlcancado(sessao, objetivoId)
    const pacienteId = objetivo.plano.pacienteId
    if (objetivo.status === 'DOMINADO') throw new ErroServico('CONFLITO', 'Este objetivo já está marcado como dominado.')
    const sessoes = (await this.banco.sessao.findMany({ where: { pacienteId }, include: { registros: true } })).map(paraSessao)
    const criterio = { percentualMinimo: objetivo.percentualMinimo, sessoesConsecutivas: objetivo.sessoesConsecutivas }
    if (!objetivoAtingiuCriterio(sessoes, objetivo.id, criterio)) {
      throw new ErroServico('CONFLITO',
        `O critério ainda não foi atingido: ${criterio.percentualMinimo}% em ${criterio.sessoesConsecutivas} sessões consecutivas.`)
    }
    const atualizado = await this.banco.objetivo.update({ where: { id: objetivo.id }, data: { status: 'DOMINADO', dominadoEm: new Date() } })
    return { resultado: paraObjetivo(atualizado), pacienteId }
  }

  // ------------------------------------------------------------ Cartao de estrategias

  async listarCartoes(sessao: SessaoServidor, objetivoId: string): Promise<DoPaciente<CartaoEstrategia[]>> {
    const objetivo = await this.objetivoAlcancado(sessao, objetivoId)
    const cartoes = await this.banco.cartaoEstrategia.findMany({ where: { objetivoId: objetivo.id }, orderBy: { atualizadoEm: 'asc' } })
    return { resultado: cartoes.map(paraCartao), pacienteId: objetivo.plano.pacienteId }
  }

  /** Lacuna 5: o cartao nasce com conteudo. Nada vem do objetivo (regra 4). */
  async criarCartao(sessao: SessaoServidor, objetivoId: string, dados: Record<string, unknown>): Promise<DoPaciente<CartaoEstrategia>> {
    const objetivo = await this.objetivoAlcancado(sessao, objetivoId)
    const conteudo = conteudoDoCartao(dados)
    const cartao = await this.banco.cartaoEstrategia.create({ data: { objetivoId: objetivo.id, ...conteudo, atualizadoEm: new Date() } })
    return { resultado: paraCartao(cartao), pacienteId: objetivo.plano.pacienteId }
  }

  async editarCartao(sessao: SessaoServidor, cartaoId: string, dados: Record<string, unknown>): Promise<DoPaciente<CartaoEstrategia>> {
    const cartao = await this.banco.cartaoEstrategia.findUnique({ where: { id: exigirUuid(cartaoId, 'Cartão') } })
    if (!cartao) throw new ErroServico('NAO_ENCONTRADO', 'Cartão não encontrado.')
    const objetivo = await this.objetivoAlcancado(sessao, cartao.objetivoId)
    const conteudo = conteudoDoCartao(dados)
    const atualizado = await this.banco.cartaoEstrategia.update({ where: { id: cartao.id }, data: { ...conteudo, atualizadoEm: new Date() } })
    return { resultado: paraCartao(atualizado), pacienteId: objetivo.plano.pacienteId }
  }
}

function conteudoDoCartao(dados: Record<string, unknown>) {
  const lista = (v: unknown) => (Array.isArray(v) ? v.filter((i): i is string => typeof i === 'string') : [])
  const conteudo = {
    tituloSimples: textoOuVazio(dados.tituloSimples),
    oQueFazer: itensPreenchidos(lista(dados.oQueFazer)),
    oQueEvitar: itensPreenchidos(lista(dados.oQueEvitar)),
    sinalAlerta: textoOuVazio(dados.sinalAlerta),
  }
  exigirValido(validarCartao(conteudo))
  return conteudo
}
