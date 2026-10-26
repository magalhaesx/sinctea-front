import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, Res } from '@nestjs/common'
import type {
  AcaoAuditoria, ContaCriada, DadosProfissionais, DataCivil, Pagina, Perfil, RegistroAdministrativo, Usuario,
} from '@sinctea/compartilhado'
import { Auditar, Perfis, SemDadoDoPaciente } from '../acesso/metadados.js'
import { lerBooleano, lerPaginacao, lerTexto } from '../http/paginacao.js'
import type { RequisicaoHttp, RespostaHttp } from '../http/tipos-http.js'
import { textoOuVazio } from '../http/validacao.js'
import { ServicoTrilhaAdministrativa } from './servico-trilha.js'
import { ServicoUsuarios, type ComAnterior } from './servico-usuarios.js'

/** Item 13b: a versao anterior do que mudou vai para a trilha, pelo interceptador. */
function comAnterior<T>(req: RequisicaoHttp, { resultado, valorAnterior }: ComAnterior<T>): T {
  if (valorAnterior !== null) req.sinctea!.valorAnterior = valorAnterior
  return resultado
}

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
  async atualizarMeusDadosProfissionais(@Req() req: RequisicaoHttp, @Body() corpo: Record<string, unknown> | undefined) {
    return comAnterior(req, await this.usuarios.atualizarMeusDadosProfissionais(req.sinctea!.sessao!, corpo ?? {}))
  }

  @Put(':id/perfis')
  @Perfis('ADMINISTRADOR')
  @Auditar({
    entidade: 'Usuario', acao: 'ALTERACAO', idEntidade: { parametro: 'id' },
    detalhe: (_req, r) => `Perfis: ${(r as Usuario).perfis.join(', ')}`,
  })
  async alterarPerfis(@Req() req: RequisicaoHttp, @Param('id') id: string, @Body() corpo: { perfis?: unknown } | undefined) {
    return comAnterior(req, await this.usuarios.alterarPerfis(req.sinctea!.sessao!, id, corpo?.perfis))
  }

  @Post(':id/desativacao')
  @HttpCode(200)
  @Perfis('ADMINISTRADOR')
  @Auditar({ entidade: 'Usuario', acao: 'ALTERACAO', idEntidade: { parametro: 'id' }, detalhe: 'Usuário desativado.' })
  async desativar(@Req() req: RequisicaoHttp, @Param('id') id: string) {
    return comAnterior(req, await this.usuarios.desativar(req.sinctea!.sessao!, id))
  }

  @Post(':id/reativacao')
  @HttpCode(200)
  @Perfis('ADMINISTRADOR')
  @Auditar({ entidade: 'Usuario', acao: 'ALTERACAO', idEntidade: { parametro: 'id' }, detalhe: 'Usuário reativado.' })
  async reativar(@Req() req: RequisicaoHttp, @Param('id') id: string) {
    return comAnterior(req, await this.usuarios.reativar(id))
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

  /** Item 13: o motivo vai para a trilha, com quem gerou; o token, nunca. */
  @Post(':id/nova-senha')
  @HttpCode(200)
  @Perfis('ADMINISTRADOR')
  @Auditar({
    entidade: 'Usuario', acao: 'ALTERACAO', idEntidade: { parametro: 'id' },
    detalhe: (req) => 'Link para nova senha gerado pela administração; o anterior deixou de valer. ' +
      `Motivo: ${textoOuVazio((req.body as { motivo?: unknown } | undefined)?.motivo)}`,
  })
  linkNovaSenha(@Req() req: RequisicaoHttp, @Param('id') id: string, @Body() corpo: { motivo?: unknown } | undefined) {
    return this.usuarios.linkNovaSenha(req.sinctea!.sessao!, id, corpo?.motivo)
  }
}

/**
 * /api/admin/trilha — a trilha administrativa (item 13, tela 25), so do
 * administrador. Ler a trilha tambem entra na trilha, e a negativa de quem nao
 * e administrador fica nela, pela entidade desta rota.
 */
@Controller('admin/trilha')
export class ControladorTrilhaAdministrativa {
  constructor(private readonly trilha: ServicoTrilhaAdministrativa) {}

  @Get()
  @Perfis('ADMINISTRADOR')
  @Auditar({
    entidade: 'RegistroAuditoria', acao: 'LEITURA_AUTORIZADA',
    detalhe: (_req, r) => `Trilha administrativa consultada (${(r as Pagina<RegistroAdministrativo>).total} registros).`,
  })
  listar(@Query() query: Record<string, unknown>) {
    return this.trilha.listar({
      pagina: lerPaginacao(query).pagina,
      desde: lerTexto(query.desde) as DataCivil | undefined,
      ate: lerTexto(query.ate) as DataCivil | undefined,
      usuarioId: lerTexto(query.usuarioId),
      acao: lerTexto(query.acao) as AcaoAuditoria | undefined,
    })
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
