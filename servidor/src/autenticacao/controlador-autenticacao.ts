import { Body, Controller, Get, HttpCode, Param, Post, Req, Res } from '@nestjs/common'
import { ErroServico, type ContaAberta, type PrimeiroAcessoPublico, type SessaoUsuario } from '@sinctea/compartilhado'
import { Publico, SemDadoDoPaciente } from '../acesso/metadados.js'
import type { RequisicaoHttp, RespostaHttp } from '../http/tipos-http.js'
import { ServicoAutenticacao } from './servico-autenticacao.js'
import { ServicoSessoes, vagaDaRequisicao } from './servico-sessoes.js'

/**
 * /api/auth — o contrato ServicoAutenticacao (compartilhado/src/contratos.ts),
 * sem entrarDemonstracao (docs/07, D6): no sistema real, nao existe conta sem
 * senha.
 */
@Controller('auth')
export class ControladorAutenticacao {
  constructor(
    private readonly autenticacao: ServicoAutenticacao,
    private readonly sessoes: ServicoSessoes,
  ) {}

  @Post('entrar')
  @HttpCode(200)
  @Publico()
  @SemDadoDoPaciente('Usuario')
  entrar(
    @Req() requisicao: RequisicaoHttp,
    @Body() corpo: { email?: unknown; senha?: unknown } | undefined,
    @Res({ passthrough: true }) resposta: RespostaHttp,
  ): Promise<SessaoUsuario> {
    return this.autenticacao.entrar(corpo?.email, corpo?.senha, requisicao, resposta)
  }

  /** Sem sessao, 204: o cliente le como nulo. */
  @Get('sessao')
  @Publico()
  @SemDadoDoPaciente('Usuario')
  sessaoAtual(
    @Req() requisicao: RequisicaoHttp,
    @Res({ passthrough: true }) resposta: RespostaHttp,
  ): Promise<SessaoUsuario | undefined> | undefined {
    const sessao = requisicao.sinctea?.sessao
    if (!sessao) {
      resposta.status(204)
      return undefined
    }
    return this.autenticacao.sessaoUsuario(sessao.usuario, sessao.perfilAtivo, vagaDaRequisicao(requisicao))
  }

  /**
   * Item 9: as contas abertas neste navegador, lidas dos cookies das vagas,
   * para a aba sem conta escolher. Publica, como a sessao atual: so devolve
   * vaga, nome e perfil ativo, nunca o token.
   */
  @Get('contas-abertas')
  @Publico()
  @SemDadoDoPaciente('Usuario')
  contasAbertas(@Req() requisicao: RequisicaoHttp): Promise<ContaAberta[]> {
    return this.sessoes.contasAbertas(requisicao)
  }

  @Post('perfil')
  @HttpCode(200)
  @SemDadoDoPaciente('Usuario')
  trocarPerfil(@Req() requisicao: RequisicaoHttp, @Body() corpo: { perfil?: unknown } | undefined) {
    return this.autenticacao.trocarPerfil(requisicao.sinctea!.sessao!, corpo?.perfil)
  }

  /** Item 8: a pessoa leu o aviso de que a coordenacao redefiniu a senha. */
  @Post('aviso-de-nova-senha')
  @HttpCode(200)
  @SemDadoDoPaciente('Usuario')
  darCienciaDaNovaSenha(@Req() requisicao: RequisicaoHttp): Promise<SessaoUsuario> {
    return this.autenticacao.darCienciaDaNovaSenha(requisicao.sinctea!.sessao!)
  }

  /** Publica, para sair funcionar mesmo com a sessao ja vencida. */
  @Post('sair')
  @HttpCode(204)
  @Publico()
  @SemDadoDoPaciente('Usuario')
  async sair(
    @Req() requisicao: RequisicaoHttp,
    @Res({ passthrough: true }) resposta: RespostaHttp,
  ): Promise<void> {
    await this.sessoes.encerrar(requisicao.sinctea?.sessao?.sessaoId ?? null, requisicao, resposta)
  }

  @Post('demonstracao')
  @Publico()
  @SemDadoDoPaciente('Usuario')
  entrarDemonstracao(): never {
    throw new ErroServico('NAO_ENCONTRADO', 'A entrada de demonstração não existe no sistema real.')
  }

  @Get('primeiro-acesso/:token')
  @Publico()
  @SemDadoDoPaciente('Usuario')
  obterPrimeiroAcesso(@Param('token') token: string): Promise<PrimeiroAcessoPublico> {
    return this.autenticacao.obterPrimeiroAcesso(token)
  }

  @Post('primeiro-acesso/:token')
  @HttpCode(200)
  @Publico()
  @SemDadoDoPaciente('Usuario')
  concluirPrimeiroAcesso(
    @Req() requisicao: RequisicaoHttp,
    @Param('token') token: string,
    @Body() corpo: { senha?: unknown } | undefined,
    @Res({ passthrough: true }) resposta: RespostaHttp,
  ): Promise<SessaoUsuario> {
    return this.autenticacao.concluirPrimeiroAcesso(token, corpo?.senha, requisicao, resposta)
  }
}
