import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, Res } from '@nestjs/common'
import type { ContaCriada, DadosProfissionais, Perfil, Usuario } from '@sinctea/compartilhado'
import { Auditar, Perfis, SemDadoDoPaciente } from '../acesso/metadados.js'
import { lerBooleano, lerPaginacao, lerTexto } from '../http/paginacao.js'
import type { RequisicaoHttp, RespostaHttp } from '../http/tipos-http.js'
import { ServicoUsuarios } from './servico-usuarios.js'

/**
 * /api/usuarios — o contrato ServicoUsuario. A gestao e do administrador; os
 * dados profissionais sao do proprio dono. Toda alteracao de conta entra na
 * trilha, pelo interceptador, como no mock.
 */
@Controller('usuarios')
export class ControladorUsuarios {
  constructor(private readonly usuarios: ServicoUsuarios) {}

  @Get()
  @Perfis('ADMINISTRADOR')
  @SemDadoDoPaciente('Usuario')
  listar(@Query() query: Record<string, unknown>) {
    return this.usuarios.listar({
      ...lerPaginacao(query),
      busca: lerTexto(query.busca),
      perfil: lerTexto(query.perfil) as Perfil | undefined,
      ativo: lerBooleano(query.ativo),
    })
  }

  @Post()
  @Perfis('ADMINISTRADOR')
  @Auditar({
    entidade: 'Usuario', acao: 'CRIACAO',
    idEntidade: (_req, r) => (r as ContaCriada).usuario.id,
    // O token nunca entra na trilha: so que o link foi gerado.
    detalhe: (_req, r) => {
      const { usuario } = r as ContaCriada
      return `Conta criada para ${usuario.email} (${usuario.perfis.join(', ')}). Link de primeiro acesso gerado.`
    },
  })
  convidar(@Body() corpo: Record<string, unknown> | undefined) {
    return this.usuarios.convidar(corpo ?? {})
  }

  /** Sem dados profissionais (responsavel, professor), resposta vazia: o cliente le nulo. */
  @Get('eu/dados-profissionais')
  @SemDadoDoPaciente('Usuario')
  async meusDadosProfissionais(@Req() req: RequisicaoHttp, @Res({ passthrough: true }) resposta: RespostaHttp) {
    const dados = await this.usuarios.meusDadosProfissionais(req.sinctea!.sessao!)
    if (!dados) resposta.status(204)
    return dados ?? undefined
  }

  @Put('eu/dados-profissionais')
  @Auditar({
    entidade: 'Usuario', acao: 'ALTERACAO',
    idEntidade: (req) => req.sinctea?.sessao?.usuario.id ?? null,
    detalhe: (_req, r) => {
      const d = r as DadosProfissionais
      return `Dados profissionais atualizados: ${d.especialidade}, ${d.registroConselho}.`
    },
  })
  atualizarMeusDadosProfissionais(@Req() req: RequisicaoHttp, @Body() corpo: Record<string, unknown> | undefined) {
    return this.usuarios.atualizarMeusDadosProfissionais(req.sinctea!.sessao!, corpo ?? {})
  }

  @Put(':id/perfis')
  @Perfis('ADMINISTRADOR')
  @Auditar({
    entidade: 'Usuario', acao: 'ALTERACAO', idEntidade: { parametro: 'id' },
    detalhe: (_req, r) => `Perfis: ${(r as Usuario).perfis.join(', ')}`,
  })
  alterarPerfis(@Req() req: RequisicaoHttp, @Param('id') id: string, @Body() corpo: { perfis?: unknown } | undefined) {
    return this.usuarios.alterarPerfis(req.sinctea!.sessao!, id, corpo?.perfis)
  }

  @Post(':id/desativacao')
  @HttpCode(200)
  @Perfis('ADMINISTRADOR')
  @Auditar({ entidade: 'Usuario', acao: 'ALTERACAO', idEntidade: { parametro: 'id' }, detalhe: 'Usuário desativado.' })
  desativar(@Req() req: RequisicaoHttp, @Param('id') id: string) {
    return this.usuarios.desativar(req.sinctea!.sessao!, id)
  }

  @Post(':id/reativacao')
  @HttpCode(200)
  @Perfis('ADMINISTRADOR')
  @Auditar({ entidade: 'Usuario', acao: 'ALTERACAO', idEntidade: { parametro: 'id' }, detalhe: 'Usuário reativado.' })
  reativar(@Param('id') id: string) {
    return this.usuarios.reativar(id)
  }

  @Post(':id/acesso-inicial')
  @HttpCode(200)
  @Perfis('ADMINISTRADOR')
  @Auditar({
    entidade: 'Usuario', acao: 'ALTERACAO', idEntidade: { parametro: 'id' },
    detalhe: 'Novo link de primeiro acesso gerado; o anterior deixou de valer.',
  })
  novoLinkDeAcesso(@Param('id') id: string) {
    return this.usuarios.novoLinkDeAcesso(id)
  }
}

/** /api/profissionais — para escolher o responsavel pelo caso e a equipe. */
@Controller('profissionais')
export class ControladorProfissionais {
  constructor(private readonly usuarios: ServicoUsuarios) {}

  @Get()
  @Perfis('TERAPEUTA', 'COORDENADOR', 'ADMINISTRADOR')
  @SemDadoDoPaciente('Profissional')
  listar(@Query() query: Record<string, unknown>) {
    return this.usuarios.listarProfissionais({ ...lerPaginacao(query), busca: lerTexto(query.busca) })
  }
}
