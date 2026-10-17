import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req } from '@nestjs/common'
import type {
  CartaoEstrategia, NivelSuporte, Objetivo, OcorrenciaComportamental, Origem, PacienteDetalhe, Pagina, PlanoTerapeutico,
  RegistroAtividade, ResponsavelCadastrado, Sessao, SituacaoPlano, SituacaoSessao,
} from '@sinctea/compartilhado'
import { Auditar, Perfis } from '../acesso/metadados.js'
import { lerInstante, lerPaginacao, lerTexto } from '../http/paginacao.js'
import type { RequisicaoHttp } from '../http/tipos-http.js'
import { ServicoOcorrencias, type FiltroOcorrenciaServidor } from './servico-ocorrencias.js'
import { ServicoPacientes } from './servico-pacientes.js'
import { ServicoPlanos, type DoPaciente } from './servico-planos.js'
import { ServicoSessoesClinicas } from './servico-sessoes-clinicas.js'

/**
 * As rotas da area clinica (docs/07, secao 0, item 3). Toda leitura e escrita
 * de dado do paciente e registrada pelo interceptador, pela declaracao de cada
 * rota (regra 6). Quando a rota chega pelo plano, pelo objetivo ou pela sessao,
 * o servico devolve de que paciente era o dado, e o controlador o entrega a
 * auditoria.
 */

const CLINICA = ['TERAPEUTA', 'COORDENADOR'] as const
const sessaoDe = (req: RequisicaoHttp) => req.sinctea!.sessao!
function doPaciente<T>(req: RequisicaoHttp, { resultado, pacienteId }: DoPaciente<T>): T {
  req.sinctea!.pacienteId = pacienteId
  return resultado
}
const deParametro = { parametro: 'id' }
const ORIGENS: Origem[] = ['CLINICA', 'CASA', 'ESCOLA']

function lerFiltroOcorrencia(query: Record<string, unknown>): FiltroOcorrenciaServidor {
  const origem = lerTexto(query.origem) as Origem | undefined
  return {
    ...lerPaginacao(query),
    origem: origem && ORIGENS.includes(origem) ? origem : undefined,
    desde: lerInstante(query.desde, 'desde'),
  }
}

@Controller('pacientes')
@Perfis(...CLINICA)
export class ControladorPacientes {
  constructor(
    private readonly pacientes: ServicoPacientes,
    private readonly planos: ServicoPlanos,
    private readonly sessoes: ServicoSessoesClinicas,
    private readonly ocorrencias: ServicoOcorrencias,
  ) {}

  @Get()
  @Auditar({ entidade: 'Paciente', acao: 'LEITURA_AUTORIZADA', detalhe: (_q, r) => `Lista de pacientes: ${(r as Pagina<unknown>).total}.` })
  listar(@Req() req: RequisicaoHttp, @Query() query: Record<string, unknown>) {
    const nivel = Number(query.nivelSuporte)
    return this.pacientes.listar(sessaoDe(req), {
      ...lerPaginacao(query),
      busca: lerTexto(query.busca),
      profissionalId: lerTexto(query.profissionalId),
      nivelSuporte: [1, 2, 3].includes(nivel) ? (nivel as NivelSuporte) : undefined,
      situacaoPlano: lerTexto(query.situacaoPlano) as SituacaoPlano | undefined,
    })
  }

  @Get(':id')
  @Auditar({ entidade: 'Paciente', acao: 'LEITURA_AUTORIZADA', idEntidade: deParametro, pacienteId: deParametro, detalhe: 'Ficha do paciente.' })
  obter(@Req() req: RequisicaoHttp, @Param('id') id: string) {
    return this.pacientes.obter(sessaoDe(req), id)
  }

  @Post()
  @Auditar({
    entidade: 'Paciente', acao: 'CRIACAO', idEntidade: (_q, r) => (r as PacienteDetalhe).id,
    pacienteId: (_q, r) => (r as PacienteDetalhe).id, detalhe: 'Cadastro de paciente.',
  })
  criar(@Req() req: RequisicaoHttp, @Body() corpo: Record<string, unknown> | undefined) {
    return this.pacientes.criar(sessaoDe(req), corpo ?? {})
  }

  @Post(':id/responsaveis')
  @Auditar({
    entidade: 'VinculoFamiliar', acao: 'CRIACAO', pacienteId: deParametro,
    idEntidade: (_q, r) => (r as ResponsavelCadastrado).responsavel.id,
    // O token nunca entra na trilha: so que o link foi gerado.
    detalhe: (_q, r) => {
      const { responsavel: v, primeiroAcesso } = r as ResponsavelCadastrado
      return `Responsável na rede de apoio: ${v.nome} (${v.parentesco}${v.responsavelLegal ? ', responsável legal' : ''}).` +
        (primeiroAcesso ? ' Link de primeiro acesso gerado.' : '')
    },
  })
  cadastrarResponsavel(@Req() req: RequisicaoHttp, @Param('id') id: string, @Body() corpo: Record<string, unknown> | undefined) {
    return this.pacientes.cadastrarResponsavel(sessaoDe(req), id, corpo ?? {})
  }

  @Post(':id/responsaveis/:responsavelId/acesso-inicial')
  @HttpCode(200)
  @Auditar({
    entidade: 'Usuario', acao: 'ALTERACAO', pacienteId: deParametro, idEntidade: { parametro: 'responsavelId' },
    detalhe: 'Novo link de primeiro acesso do responsável; o anterior deixou de valer.',
  })
  novoLinkDoResponsavel(@Req() req: RequisicaoHttp, @Param('id') id: string, @Param('responsavelId') responsavelId: string) {
    return this.pacientes.novoLinkDoResponsavel(sessaoDe(req), id, responsavelId)
  }

  @Get(':id/plano')
  @Auditar({
    entidade: 'PlanoTerapeutico', acao: 'LEITURA_AUTORIZADA', pacienteId: deParametro,
    idEntidade: (_q, r) => (r as PlanoTerapeutico).id, detalhe: 'Leitura do plano.',
  })
  obterPlano(@Req() req: RequisicaoHttp, @Param('id') id: string) {
    return this.planos.obterPorPaciente(sessaoDe(req), id)
  }

  @Post(':id/plano')
  @Auditar({
    entidade: 'PlanoTerapeutico', acao: 'CRIACAO', pacienteId: deParametro,
    idEntidade: (_q, r) => (r as PlanoTerapeutico).id, detalhe: 'Plano criado em rascunho.',
  })
  criarPlano(@Req() req: RequisicaoHttp, @Param('id') id: string, @Body() corpo: Record<string, unknown> | undefined) {
    return this.planos.criar(sessaoDe(req), id, corpo ?? {})
  }

  @Get(':id/ocorrencias')
  @Auditar({ entidade: 'OcorrenciaComportamental', acao: 'LEITURA_AUTORIZADA', pacienteId: deParametro, detalhe: 'Eventos comportamentais.' })
  listarOcorrencias(@Req() req: RequisicaoHttp, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    return this.ocorrencias.listarPorPaciente(sessaoDe(req), id, lerFiltroOcorrencia(query))
  }

  @Get(':id/sessoes')
  @Auditar({ entidade: 'Sessao', acao: 'LEITURA_AUTORIZADA', pacienteId: deParametro, detalhe: 'Histórico de sessões.' })
  listarSessoes(@Req() req: RequisicaoHttp, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    return this.sessoes.listarPorPaciente(sessaoDe(req), id, {
      ...lerPaginacao(query), situacao: lerTexto(query.situacao) as SituacaoSessao | undefined,
    })
  }
}

@Controller()
@Perfis(...CLINICA)
export class ControladorPlanos {
  constructor(private readonly planos: ServicoPlanos) {}

  @Post('planos/:id/objetivos')
  @Auditar({
    entidade: 'Objetivo', acao: 'CRIACAO', idEntidade: (_q, r) => (r as Objetivo).id,
    detalhe: (_q, r) => `Objetivo em ${(r as Objetivo).dominio}.`,
  })
  async adicionarObjetivo(@Req() req: RequisicaoHttp, @Param('id') id: string, @Body() corpo: Record<string, unknown> | undefined) {
    return doPaciente(req, await this.planos.adicionarObjetivo(sessaoDe(req), id, corpo ?? {}))
  }

  @Post('planos/:id/envio')
  @HttpCode(200)
  @Auditar({
    entidade: 'PlanoTerapeutico', acao: 'ALTERACAO', idEntidade: deParametro,
    pacienteId: (_q, r) => (r as PlanoTerapeutico).pacienteId, detalhe: 'Enviado para validação.',
  })
  enviar(@Req() req: RequisicaoHttp, @Param('id') id: string) {
    return this.planos.enviarParaValidacao(sessaoDe(req), id)
  }

  @Get('planos/aguardando-validacao')
  @Perfis('COORDENADOR')
  @Auditar({
    entidade: 'PlanoTerapeutico', acao: 'LEITURA_AUTORIZADA',
    detalhe: (_q, r) => `Planos aguardando validação: ${(r as Pagina<unknown>).total}.`,
  })
  listarAguardando(@Query() query: Record<string, unknown>) {
    return this.planos.listarAguardandoValidacao(lerPaginacao(query))
  }

  @Post('planos/:id/aprovacao')
  @HttpCode(200)
  @Perfis('COORDENADOR')
  @Auditar({
    entidade: 'PlanoTerapeutico', acao: 'ALTERACAO', idEntidade: deParametro,
    pacienteId: (_q, r) => (r as PlanoTerapeutico).pacienteId, detalhe: 'Plano aprovado.',
  })
  aprovar(@Req() req: RequisicaoHttp, @Param('id') id: string) {
    return this.planos.aprovar(sessaoDe(req), id)
  }

  @Post('planos/:id/devolucao')
  @HttpCode(200)
  @Perfis('COORDENADOR')
  @Auditar({
    entidade: 'PlanoTerapeutico', acao: 'ALTERACAO', idEntidade: deParametro,
    pacienteId: (_q, r) => (r as PlanoTerapeutico).pacienteId, detalhe: 'Plano devolvido com observação.',
  })
  devolver(@Req() req: RequisicaoHttp, @Param('id') id: string, @Body() corpo: { observacao?: unknown } | undefined) {
    return this.planos.devolver(sessaoDe(req), id, corpo?.observacao)
  }

  @Post('objetivos/:id/dominio')
  @HttpCode(200)
  @Auditar({ entidade: 'Objetivo', acao: 'ALTERACAO', idEntidade: deParametro, detalhe: 'Domínio confirmado.' })
  async confirmarDominio(@Req() req: RequisicaoHttp, @Param('id') id: string) {
    return doPaciente(req, await this.planos.confirmarDominio(sessaoDe(req), id))
  }

  @Get('objetivos/:id/cartoes')
  @Auditar({ entidade: 'CartaoEstrategia', acao: 'LEITURA_AUTORIZADA', detalhe: 'Cartões de estratégias do objetivo.' })
  async listarCartoes(@Req() req: RequisicaoHttp, @Param('id') id: string) {
    return doPaciente(req, await this.planos.listarCartoes(sessaoDe(req), id))
  }

  @Post('objetivos/:id/cartoes')
  @Auditar({
    entidade: 'CartaoEstrategia', acao: 'CRIACAO', idEntidade: (_q, r) => (r as CartaoEstrategia).id,
    detalhe: (_q, r) => `Cartão de estratégias criado: ${(r as CartaoEstrategia).tituloSimples}.`,
  })
  async criarCartao(@Req() req: RequisicaoHttp, @Param('id') id: string, @Body() corpo: Record<string, unknown> | undefined) {
    return doPaciente(req, await this.planos.criarCartao(sessaoDe(req), id, corpo ?? {}))
  }

  @Put('cartoes/:id')
  @Auditar({
    entidade: 'CartaoEstrategia', acao: 'ALTERACAO', idEntidade: deParametro,
    detalhe: (_q, r) => `Cartão de estratégias editado: ${(r as CartaoEstrategia).tituloSimples}.`,
  })
  async editarCartao(@Req() req: RequisicaoHttp, @Param('id') id: string, @Body() corpo: Record<string, unknown> | undefined) {
    return doPaciente(req, await this.planos.editarCartao(sessaoDe(req), id, corpo ?? {}))
  }
}

/**
 * Avisos da escola e leitura clinica (item 6 do caminho principal): o fim do
 * ciclo clinica–escola. O relato do professor e evento preliminar; a leitura
 * clinica e do profissional habilitado.
 */
@Controller('ocorrencias')
@Perfis(...CLINICA)
export class ControladorOcorrencias {
  constructor(private readonly ocorrencias: ServicoOcorrencias) {}

  /** A lista atravessa pacientes: o registro guarda quantos avisos sairam, como a lista de pacientes. */
  @Get('avisos-escola')
  @Auditar({
    entidade: 'OcorrenciaEscolar', acao: 'LEITURA_AUTORIZADA',
    detalhe: (_q, r) => `Avisos da escola: ${(r as Pagina<unknown>).total}.`,
  })
  listarAvisos(@Req() req: RequisicaoHttp, @Query() query: Record<string, unknown>) {
    return this.ocorrencias.listarAvisosDaEscola(sessaoDe(req), lerFiltroOcorrencia(query))
  }

  @Post(':id/leitura-clinica')
  @HttpCode(200)
  @Auditar({
    entidade: 'OcorrenciaComportamental', acao: 'ALTERACAO', idEntidade: deParametro,
    detalhe: (_q, r) => `Leitura clínica registrada (evento de origem ${(r as OcorrenciaComportamental).origem}).`,
  })
  async registrarLeitura(@Req() req: RequisicaoHttp, @Param('id') id: string) {
    return doPaciente(req, await this.ocorrencias.registrarLeituraClinica(sessaoDe(req), id))
  }
}

@Controller('sessoes')
@Perfis(...CLINICA)
export class ControladorSessoes {
  constructor(private readonly sessoes: ServicoSessoesClinicas) {}

  @Get(':id')
  @Auditar({
    entidade: 'Sessao', acao: 'LEITURA_AUTORIZADA', idEntidade: deParametro,
    pacienteId: (_q, r) => (r as Sessao).pacienteId, detalhe: 'Leitura da sessão.',
  })
  obter(@Req() req: RequisicaoHttp, @Param('id') id: string) {
    return this.sessoes.obter(sessaoDe(req), id)
  }

  @Post()
  @Auditar({
    entidade: 'Sessao', acao: 'CRIACAO', idEntidade: (_q, r) => (r as Sessao).id,
    pacienteId: (_q, r) => (r as Sessao).pacienteId, detalhe: 'Sessão iniciada.',
  })
  iniciar(@Req() req: RequisicaoHttp, @Body() corpo: { pacienteId?: unknown; sessaoAgendadaId?: unknown } | undefined) {
    return this.sessoes.iniciar(sessaoDe(req), corpo?.pacienteId, corpo?.sessaoAgendadaId)
  }

  @Post(':id/registros')
  @Auditar({
    entidade: 'RegistroAtividade', acao: 'CRIACAO', idEntidade: (_q, r) => (r as RegistroAtividade).id,
    detalhe: (_q, r) => `Tentativa ${(r as RegistroAtividade).ordem}: ${(r as RegistroAtividade).resultado}.`,
  })
  async registrar(@Req() req: RequisicaoHttp, @Param('id') id: string, @Body() corpo: { objetivoId?: unknown; resultado?: unknown } | undefined) {
    return doPaciente(req, await this.sessoes.registrarAtividade(sessaoDe(req), id, corpo?.objetivoId, corpo?.resultado))
  }

  @Delete(':id/registros/ultimo')
  @Auditar({
    entidade: 'Sessao', acao: 'ALTERACAO', idEntidade: deParametro,
    pacienteId: (_q, r) => (r as Sessao).pacienteId, detalhe: 'Última tentativa desfeita.',
  })
  desfazer(@Req() req: RequisicaoHttp, @Param('id') id: string) {
    return this.sessoes.desfazerUltimoRegistro(sessaoDe(req), id)
  }

  @Post(':id/pausa')
  @HttpCode(200)
  @Auditar({
    entidade: 'Sessao', acao: 'ALTERACAO', idEntidade: deParametro,
    pacienteId: (_q, r) => (r as Sessao).pacienteId, detalhe: 'Sessão pausada.',
  })
  pausar(@Req() req: RequisicaoHttp, @Param('id') id: string) {
    return this.sessoes.pausar(sessaoDe(req), id)
  }

  @Post(':id/encerramento')
  @HttpCode(200)
  @Auditar({
    entidade: 'Sessao', acao: 'ALTERACAO', idEntidade: deParametro,
    pacienteId: (_q, r) => (r as Sessao).pacienteId,
    // A evolucao fica na sessao, e nao na trilha: a trilha diz que ela foi escrita, nao o que diz.
    detalhe: (_q, r) => `Sessão encerrada com ${(r as Sessao).registros.length} registros e a evolução.`,
  })
  encerrar(@Req() req: RequisicaoHttp, @Param('id') id: string, @Body() corpo: { evolucao?: unknown } | undefined) {
    return this.sessoes.encerrar(sessaoDe(req), id, corpo?.evolucao)
  }

  @Post(':id/ocorrencias')
  @Auditar({
    entidade: 'OcorrenciaComportamental', acao: 'CRIACAO', idEntidade: (_q, r) => (r as OcorrenciaComportamental).id,
    detalhe: 'Ocorrência registrada na sessão, com a leitura clínica de quem registrou.',
  })
  async registrarOcorrencia(@Req() req: RequisicaoHttp, @Param('id') id: string, @Body() corpo: Record<string, unknown> | undefined) {
    return doPaciente(req, await this.sessoes.registrarOcorrencia(sessaoDe(req), id, corpo ?? {}))
  }
}
