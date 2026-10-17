import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, Res } from '@nestjs/common'
import type { AlunoEscola, ConsentimentoConcedido, ConsentimentoDetalhe, Escola, OcorrenciaEscolar, Pagina } from '@sinctea/compartilhado'
import { Auditar, Perfis, Publico, SemDadoDoPaciente } from '../acesso/metadados.js'
import type { DoPaciente } from '../clinica/servico-planos.js'
import { ServicoFamilia } from '../familia/servico-familia.js'
import { lerPaginacao } from '../http/paginacao.js'
import type { RequisicaoHttp, RespostaHttp } from '../http/tipos-http.js'
import { ServicoAreaEscola } from './servico-area-escola.js'
import { ServicoConvites } from './servico-convites.js'
import { ServicoEscolas } from './servico-escolas.js'

/**
 * Familia, escolas, consentimento, convite e area da escola (docs/07, secao 0,
 * item 4). Toda leitura e escrita de dado do paciente entra na trilha pelo
 * interceptador; a concessao e a revogacao, com as acoes proprias (regra 6).
 */

const sessaoDe = (req: RequisicaoHttp) => req.sinctea!.sessao!
const deParametro = { parametro: 'id' }
function doPaciente<T>(req: RequisicaoHttp, { resultado, pacienteId }: DoPaciente<T>): T {
  req.sinctea!.pacienteId = pacienteId
  return resultado
}

@Controller('familia')
@Perfis('RESPONSAVEL')
export class ControladorFamilia {
  constructor(private readonly familia: ServicoFamilia) {}

  @Get('filhos')
  @Auditar({ entidade: 'Paciente', acao: 'LEITURA_AUTORIZADA', detalhe: (_q, r) => `Filhos da família: ${(r as Pagina<unknown>).total}.` })
  listarFilhos(@Req() req: RequisicaoHttp, @Query() query: Record<string, unknown>) {
    return this.familia.listarFilhos(sessaoDe(req), lerPaginacao(query))
  }

  @Get('filhos/:id/objetivos')
  @Auditar({ entidade: 'Objetivo', acao: 'LEITURA_AUTORIZADA', pacienteId: deParametro, detalhe: 'Evolução em linguagem acessível.' })
  listarObjetivos(@Req() req: RequisicaoHttp, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    return this.familia.listarObjetivos(sessaoDe(req), id, lerPaginacao(query))
  }
}

@Controller()
export class ControladorConsentimentos {
  constructor(private readonly familia: ServicoFamilia) {}

  @Get('pacientes/:id/consentimentos')
  @Perfis('TERAPEUTA', 'COORDENADOR', 'RESPONSAVEL')
  @Auditar({ entidade: 'Consentimento', acao: 'LEITURA_AUTORIZADA', pacienteId: deParametro, detalhe: 'Autorizações da escola.' })
  listar(@Req() req: RequisicaoHttp, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    return this.familia.listarConsentimentos(sessaoDe(req), id, lerPaginacao(query))
  }

  @Post('consentimentos')
  @Perfis('RESPONSAVEL')
  @Auditar({
    entidade: 'Consentimento', acao: 'CONCESSAO_ACESSO',
    idEntidade: (_q, r) => (r as ConsentimentoConcedido).consentimento.id,
    // E este registro que prova o que a familia autorizou. O token nao entra.
    detalhe: (_q, r) => {
      const { consentimento: c } = r as ConsentimentoConcedido
      return `Escola: ${c.escola} · escopos: ${c.escopos.join(', ')}`
    },
  })
  async conceder(@Req() req: RequisicaoHttp, @Body() corpo: Record<string, unknown> | undefined) {
    return doPaciente(req, await this.familia.conceder(sessaoDe(req), corpo ?? {}))
  }

  @Post('consentimentos/:id/convites')
  @Perfis('RESPONSAVEL')
  @Auditar({
    entidade: 'ConviteEscolar', acao: 'CRIACAO', idEntidade: (_q, r) => (r as { conviteId: string }).conviteId,
    detalhe: 'Novo convite emitido; o anterior deixou de valer.',
  })
  async reemitir(@Req() req: RequisicaoHttp, @Param('id') id: string) {
    return doPaciente(req, await this.familia.reemitirConvite(sessaoDe(req), id))
  }

  @Post('consentimentos/:id/revogacao')
  @HttpCode(200)
  @Perfis('RESPONSAVEL')
  @Auditar({ entidade: 'Consentimento', acao: 'REVOGACAO_ACESSO', idEntidade: deParametro, detalhe: 'Revogado pelo responsável.' })
  async revogar(@Req() req: RequisicaoHttp, @Param('id') id: string): Promise<ConsentimentoDetalhe> {
    const { jaEstavaRevogado, ...resto } = await this.familia.revogar(sessaoDe(req), id)
    // Revogar o que ja estava revogado nao muda nada: nada a registrar.
    req.sinctea!.dispensarRegistro = jaEstavaRevogado
    return doPaciente(req, resto)
  }
}

@Controller('escolas')
export class ControladorEscolas {
  constructor(private readonly escolas: ServicoEscolas) {}

  @Get()
  @Perfis('TERAPEUTA', 'COORDENADOR', 'ADMINISTRADOR', 'RESPONSAVEL')
  @SemDadoDoPaciente('Escola')
  listar(@Query() query: Record<string, unknown>) {
    return this.escolas.listar(lerPaginacao(query))
  }

  @Get('parecidas')
  @Perfis('RESPONSAVEL')
  @SemDadoDoPaciente('Escola')
  parecidas(@Query() query: Record<string, unknown>) {
    return this.escolas.parecidas(query.nome, query.municipio)
  }

  /** Lacuna 4: quem cadastra e o responsavel. A operacao entra na trilha. */
  @Post()
  @Perfis('RESPONSAVEL')
  @Auditar({
    entidade: 'Escola', acao: 'CRIACAO', idEntidade: (_q, r) => (r as Escola).id,
    detalhe: (_q, r) => `Escola cadastrada pela família: ${(r as Escola).nome} (${(r as Escola).rede}, ${(r as Escola).municipio}).`,
  })
  cadastrar(@Body() corpo: Record<string, unknown> | undefined) {
    return this.escolas.cadastrar(corpo ?? {})
  }
}

@Controller('convites')
export class ControladorConvites {
  constructor(private readonly convites: ServicoConvites) {}

  /** Publica: o professor ainda nao tem conta. So o convite valido revela o aluno, e so ele e registrado. */
  @Get(':token')
  @Publico()
  @Auditar({ entidade: 'ConviteEscolar', acao: 'LEITURA_AUTORIZADA', detalhe: 'Convite consultado por quem tem o link.' })
  async obter(@Req() req: RequisicaoHttp, @Param('token') token: string) {
    const { convite, pacienteId } = await this.convites.obter(token)
    if (pacienteId) req.sinctea!.pacienteId = pacienteId
    else req.sinctea!.dispensarRegistro = true
    return convite
  }

  /** O vinculo nasce aqui, e a concessao fica na trilha em nome do professor que aceitou. */
  @Post(':token/aceite')
  @HttpCode(200)
  @Publico()
  @Auditar({ entidade: 'VinculoEscolar', acao: 'CONCESSAO_ACESSO', detalhe: 'Convite aceito pelo professor.' })
  async aceitar(
    @Req() req: RequisicaoHttp,
    @Param('token') token: string,
    @Body() corpo: Record<string, unknown> | undefined,
    @Res({ passthrough: true }) resposta: RespostaHttp,
  ) {
    const aceito = await this.convites.aceitar(token, corpo ?? {}, req.ip ?? null, resposta)
    req.sinctea!.sessao = aceito.sessao
    req.sinctea!.pacienteId = aceito.pacienteId
    req.sinctea!.idEntidade = aceito.vinculoId
    return aceito.sessaoUsuario
  }
}

@Controller('escola')
@Perfis('PROFESSOR')
export class ControladorAreaEscola {
  constructor(private readonly escola: ServicoAreaEscola) {}

  @Get('alunos')
  @Auditar({ entidade: 'VinculoEscolar', acao: 'LEITURA_AUTORIZADA', detalhe: (_q, r) => `Consulta da lista de alunos (${(r as Pagina<AlunoEscola>).total}).` })
  listarAlunos(@Req() req: RequisicaoHttp, @Query() query: Record<string, unknown>) {
    return this.escola.listarAlunos(sessaoDe(req), lerPaginacao(query))
  }

  @Get('alunos/:id/cartao')
  @Auditar({ entidade: 'CartaoEstrategia', acao: 'LEITURA_AUTORIZADA', pacienteId: deParametro, detalhe: 'Consulta do cartão de estratégias.' })
  obterCartao(@Req() req: RequisicaoHttp, @Param('id') id: string) {
    return this.escola.obterCartao(sessaoDe(req), id)
  }

  @Post('alunos/:id/ocorrencias')
  @Auditar({
    entidade: 'OcorrenciaEscolar', acao: 'CRIACAO', pacienteId: deParametro,
    idEntidade: (_q, r) => (r as OcorrenciaEscolar).id, detalhe: 'Ocorrência registrada pela escola.',
  })
  registrar(@Req() req: RequisicaoHttp, @Param('id') id: string, @Body() corpo: Record<string, unknown> | undefined) {
    return this.escola.registrarOcorrencia(sessaoDe(req), id, corpo ?? {})
  }

  @Put('ocorrencias/:id')
  @Auditar({
    entidade: 'OcorrenciaEscolar', acao: 'ALTERACAO', idEntidade: deParametro,
    detalhe: 'Ocorrência corrigida pelo professor que a registrou, dentro da janela de 30 minutos.',
  })
  async corrigir(@Req() req: RequisicaoHttp, @Param('id') id: string, @Body() corpo: Record<string, unknown> | undefined) {
    const { valorAnterior, ...resto } = await this.escola.corrigirOcorrencia(sessaoDe(req), id, corpo ?? {})
    // A versao original dos campos que mudaram fica na trilha (valorAnterior).
    req.sinctea!.valorAnterior = valorAnterior
    return doPaciente(req, resto)
  }
}
