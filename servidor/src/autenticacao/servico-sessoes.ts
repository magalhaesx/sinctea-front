import { Injectable } from '@nestjs/common'
import type { Perfil } from '@sinctea/compartilhado'
import { ServicoBanco } from '../banco/servico-banco.js'
import type { OpcoesCookie, RequisicaoHttp, RespostaHttp, SessaoServidor } from '../http/tipos-http.js'
import { novoToken, resumoDoToken } from './tokens.js'

/**
 * Sessao de login (docs/07, D5): cookie httpOnly, Secure e SameSite=Lax, com
 * a sessao guardada no PostgreSQL.
 *
 * Duracao: 24 horas desde o ultimo uso. A tela 1 nao admite sessao que expire
 * sem aviso (WCAG 2.2.1), e a excecao do criterio e o limite acima de 20 horas.
 * A renovacao so grava quando falta menos da metade, para nao escrever no banco
 * a cada requisicao.
 */

export const NOME_DO_COOKIE = 'sinctea_sessao'
export const DURACAO_SESSAO_HORAS = 24
const DURACAO_MS = DURACAO_SESSAO_HORAS * 3_600_000

// Os tokens moram em tokens.ts, sem Nest; reexportados aqui por conveniencia.
export { novoToken, resumoDoToken } from './tokens.js'

const OPCOES_COOKIE: OpcoesCookie = { httpOnly: true, secure: true, sameSite: 'lax', path: '/' }

function lerCookie(requisicao: RequisicaoHttp, nome: string): string | null {
  const cabecalho = requisicao.headers.cookie
  const texto = Array.isArray(cabecalho) ? cabecalho.join('; ') : cabecalho
  if (!texto) return null
  for (const parte of texto.split(';')) {
    const [chave, ...valor] = parte.trim().split('=')
    if (chave === nome) return decodeURIComponent(valor.join('='))
  }
  return null
}

@Injectable()
export class ServicoSessoes {
  constructor(private readonly banco: ServicoBanco) {}

  /** Abre a sessao e entrega o cookie. */
  async abrir(usuarioId: string, perfilAtivo: Perfil, resposta: RespostaHttp): Promise<void> {
    const token = novoToken()
    const agora = new Date()
    await this.banco.sessaoLogin.create({ data: {
      tokenResumo: resumoDoToken(token),
      usuarioId,
      perfilAtivo,
      criadaEm: agora,
      expiraEm: new Date(agora.getTime() + DURACAO_MS),
    } })
    resposta.cookie(NOME_DO_COOKIE, token, { ...OPCOES_COOKIE, maxAge: DURACAO_MS })
  }

  /**
   * A sessao da requisicao, ou nulo. Sessao vencida, de usuario desativado ou
   * com perfil que a conta nao tem mais deixa de existir aqui mesmo.
   */
  async resolver(requisicao: RequisicaoHttp, resposta: RespostaHttp): Promise<SessaoServidor | null> {
    const token = lerCookie(requisicao, NOME_DO_COOKIE)
    if (!token) return null
    const linha = await this.banco.sessaoLogin.findUnique({
      where: { tokenResumo: resumoDoToken(token) },
      include: { usuario: true },
    })
    const agora = new Date()
    if (!linha) {
      resposta.clearCookie(NOME_DO_COOKIE, OPCOES_COOKIE)
      return null
    }
    const { usuario } = linha
    if (linha.expiraEm <= agora || !usuario.ativo || !usuario.perfis.includes(linha.perfilAtivo)) {
      await this.banco.sessaoLogin.deleteMany({ where: { id: linha.id } })
      resposta.clearCookie(NOME_DO_COOKIE, OPCOES_COOKIE)
      return null
    }
    if (linha.expiraEm.getTime() - agora.getTime() < DURACAO_MS / 2) {
      await this.banco.sessaoLogin.update({
        where: { id: linha.id },
        data: { expiraEm: new Date(agora.getTime() + DURACAO_MS) },
      })
      resposta.cookie(NOME_DO_COOKIE, token, { ...OPCOES_COOKIE, maxAge: DURACAO_MS })
    }
    return {
      sessaoId: linha.id,
      perfilAtivo: linha.perfilAtivo,
      usuario: {
        id: usuario.id, nome: usuario.nome, email: usuario.email, perfis: usuario.perfis,
        ativo: usuario.ativo, ultimoAcessoEm: usuario.ultimoAcessoEm,
      },
    }
  }

  async trocarPerfil(sessaoId: string, perfil: Perfil): Promise<void> {
    await this.banco.sessaoLogin.update({ where: { id: sessaoId }, data: { perfilAtivo: perfil } })
  }

  /** Encerra a sessao: a linha some, e o cookie com ela. */
  async encerrar(sessaoId: string | null, resposta: RespostaHttp): Promise<void> {
    if (sessaoId) await this.banco.sessaoLogin.deleteMany({ where: { id: sessaoId } })
    resposta.clearCookie(NOME_DO_COOKIE, OPCOES_COOKIE)
  }

  /** Desativar a conta ou trocar a senha encerra todas as sessoes dela. */
  async encerrarTodasDo(usuarioId: string): Promise<void> {
    await this.banco.sessaoLogin.deleteMany({ where: { usuarioId } })
  }
}
