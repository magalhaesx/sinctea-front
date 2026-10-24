import { Injectable } from '@nestjs/common'
import { ErroServico, type ContaAberta, type Perfil } from '@sinctea/compartilhado'
import { ServicoBanco } from '../banco/servico-banco.js'
import type { OpcoesCookie, RequisicaoHttp, RespostaHttp, SessaoServidor } from '../http/tipos-http.js'
import { novoToken, resumoDoToken } from './tokens.js'

/**
 * Sessao de login (docs/07, D5): cookie httpOnly, Secure e SameSite=Lax, com
 * a sessao guardada no PostgreSQL.
 *
 * Uma conta por aba (item 9): o navegador tem cinco vagas, cada uma o seu
 * cookie, `sinctea_sessao_1` a `sinctea_sessao_5`. A aba diz qual vaga e a
 * dela pelo cabecalho X-Sinctea-Aba, e a sessao se resolve so pelo cookie
 * dessa vaga. O token continua so no cookie: a aba guarda o numero da vaga,
 * que nao abre nada sozinho.
 *
 * Duracao: 24 horas desde o ultimo uso. A tela 1 nao admite sessao que expire
 * sem aviso (WCAG 2.2.1), e a excecao do criterio e o limite acima de 20 horas.
 * A renovacao so grava quando falta menos da metade, para nao escrever no banco
 * a cada requisicao.
 */

export const VAGAS = 5
export const CABECALHO_DA_ABA = 'x-sinctea-aba'
/** O cookie de antes do item 9, um so por navegador: apagado onde aparecer. */
export const COOKIE_ANTIGO = 'sinctea_sessao'
export const cookieDaVaga = (vaga: number) => `sinctea_sessao_${vaga}`
export const DURACAO_SESSAO_HORAS = 24
const DURACAO_MS = DURACAO_SESSAO_HORAS * 3_600_000
export const VAGAS_OCUPADAS = `Já há ${VAGAS} contas abertas neste navegador. Saia de uma delas para entrar com outra.`

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

/** A vaga da aba, de 1 a 5, ou nulo: sem o cabecalho, ou com outro valor, nao ha sessao. */
export function vagaDaRequisicao(requisicao: RequisicaoHttp): number | null {
  const valor = requisicao.headers[CABECALHO_DA_ABA]
  if (typeof valor !== 'string' || !/^[1-9]$/.test(valor)) return null
  const vaga = Number(valor)
  return vaga <= VAGAS ? vaga : null
}

type LinhaDaSessao = { expiraEm: Date; perfilAtivo: Perfil; usuario: { ativo: boolean; perfis: Perfil[] } }

/** Sessao que ainda vale: nao venceu, a conta esta ativa e ainda tem o perfil. */
function vale(linha: LinhaDaSessao, agora: Date): boolean {
  return linha.expiraEm > agora && linha.usuario.ativo && linha.usuario.perfis.includes(linha.perfilAtivo)
}

@Injectable()
export class ServicoSessoes {
  constructor(private readonly banco: ServicoBanco) {}

  private linhaDoCookie(requisicao: RequisicaoHttp, vaga: number) {
    const token = lerCookie(requisicao, cookieDaVaga(vaga))
    if (!token) return null
    return this.banco.sessaoLogin.findUnique({ where: { tokenResumo: resumoDoToken(token) }, include: { usuario: true } })
  }

  /**
   * A primeira vaga deste navegador sem sessao que valha. Com as cinco
   * ocupadas, recusa. Quem abre sessao pergunta antes de gastar o link ou o
   * convite, para nao gastar e depois nao ter onde entrar.
   */
  async vagaLivre(requisicao: RequisicaoHttp): Promise<number> {
    const agora = new Date()
    for (let vaga = 1; vaga <= VAGAS; vaga++) {
      const linha = await this.linhaDoCookie(requisicao, vaga)
      if (!linha || !vale(linha, agora)) return vaga
    }
    throw new ErroServico('CONFLITO', VAGAS_OCUPADAS)
  }

  /** Abre a sessao na vaga dada, ou na primeira livre, e entrega o cookie dela. Devolve a vaga. */
  async abrir(usuarioId: string, perfilAtivo: Perfil, requisicao: RequisicaoHttp, resposta: RespostaHttp, vaga?: number): Promise<number> {
    const onde = vaga ?? await this.vagaLivre(requisicao)
    const token = novoToken()
    const agora = new Date()
    await this.banco.sessaoLogin.create({ data: {
      tokenResumo: resumoDoToken(token),
      usuarioId,
      perfilAtivo,
      criadaEm: agora,
      expiraEm: new Date(agora.getTime() + DURACAO_MS),
    } })
    resposta.cookie(cookieDaVaga(onde), token, { ...OPCOES_COOKIE, maxAge: DURACAO_MS })
    return onde
  }

  /**
   * A sessao da requisicao, ou nulo: so a da vaga que a aba disse. Sessao
   * vencida, de usuario desativado ou com perfil que a conta nao tem mais
   * deixa de existir aqui mesmo. O cookie antigo, de antes das vagas, e
   * apagado, com a linha dele.
   */
  async resolver(requisicao: RequisicaoHttp, resposta: RespostaHttp): Promise<SessaoServidor | null> {
    const antigo = lerCookie(requisicao, COOKIE_ANTIGO)
    if (antigo) {
      await this.banco.sessaoLogin.deleteMany({ where: { tokenResumo: resumoDoToken(antigo) } })
      resposta.clearCookie(COOKIE_ANTIGO, OPCOES_COOKIE)
    }

    const vaga = vagaDaRequisicao(requisicao)
    if (vaga === null) return null
    const token = lerCookie(requisicao, cookieDaVaga(vaga))
    if (!token) return null
    const linha = await this.banco.sessaoLogin.findUnique({
      where: { tokenResumo: resumoDoToken(token) },
      include: { usuario: true },
    })
    const agora = new Date()
    if (!linha) {
      resposta.clearCookie(cookieDaVaga(vaga), OPCOES_COOKIE)
      return null
    }
    const { usuario } = linha
    if (!vale(linha, agora)) {
      await this.banco.sessaoLogin.deleteMany({ where: { id: linha.id } })
      resposta.clearCookie(cookieDaVaga(vaga), OPCOES_COOKIE)
      return null
    }
    if (linha.expiraEm.getTime() - agora.getTime() < DURACAO_MS / 2) {
      await this.banco.sessaoLogin.update({
        where: { id: linha.id },
        data: { expiraEm: new Date(agora.getTime() + DURACAO_MS) },
      })
      resposta.cookie(cookieDaVaga(vaga), token, { ...OPCOES_COOKIE, maxAge: DURACAO_MS })
    }
    return {
      sessaoId: linha.id,
      perfilAtivo: linha.perfilAtivo,
      vaga,
      usuario: {
        id: usuario.id, nome: usuario.nome, email: usuario.email, perfis: usuario.perfis,
        ativo: usuario.ativo, ultimoAcessoEm: usuario.ultimoAcessoEm,
      },
    }
  }

  /**
   * As contas abertas neste navegador, para a aba nova escolher (item 9): de
   * cada vaga que vale, so o numero, o nome e o perfil ativo. Nunca o token,
   * nem o e-mail. So le: nao renova nem apaga nada.
   */
  async contasAbertas(requisicao: RequisicaoHttp): Promise<ContaAberta[]> {
    const agora = new Date()
    const contas: ContaAberta[] = []
    for (let vaga = 1; vaga <= VAGAS; vaga++) {
      const linha = await this.linhaDoCookie(requisicao, vaga)
      if (linha && vale(linha, agora)) contas.push({ vaga, nome: linha.usuario.nome, perfilAtivo: linha.perfilAtivo })
    }
    return contas
  }

  async trocarPerfil(sessaoId: string, perfil: Perfil): Promise<void> {
    await this.banco.sessaoLogin.update({ where: { id: sessaoId }, data: { perfilAtivo: perfil } })
  }

  /** Encerra a sessao da aba: a linha some, e o cookie da vaga dela com ela. As outras vagas ficam. */
  async encerrar(sessaoId: string | null, requisicao: RequisicaoHttp, resposta: RespostaHttp): Promise<void> {
    if (sessaoId) await this.banco.sessaoLogin.deleteMany({ where: { id: sessaoId } })
    const vaga = vagaDaRequisicao(requisicao)
    if (vaga !== null) resposta.clearCookie(cookieDaVaga(vaga), OPCOES_COOKIE)
  }

  /** Desativar a conta ou trocar a senha encerra todas as sessoes dela, em qualquer vaga. */
  async encerrarTodasDo(usuarioId: string): Promise<void> {
    await this.banco.sessaoLogin.deleteMany({ where: { usuarioId } })
  }
}
