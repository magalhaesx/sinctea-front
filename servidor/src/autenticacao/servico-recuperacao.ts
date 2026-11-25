import { Injectable, Logger } from '@nestjs/common'
import type { AcaoAuditoria } from '@sinctea/compartilhado'
import {
  RECUPERACOES_POR_CONTA_POR_HORA, RECUPERACOES_POR_DIA, RECUPERACOES_POR_ORIGEM_POR_HORA,
} from '@sinctea/compartilhado/dominio/recuperacao'
import { emailValido, normalizarEmail } from '@sinctea/compartilhado/dominio/regras'
import { ServicoAuditoria } from '../auditoria/servico-auditoria.js'
import { ServicoBanco } from '../banco/servico-banco.js'
import { ServicoEmail } from '../email/servico-email.js'
import { ServicoAutenticacao } from './servico-autenticacao.js'

/**
 * "Esqueci minha senha" (item 23), sem passar pela clinica.
 *
 * A rota responde sempre igual — 202, sem corpo — e so depois que a resposta
 * saiu o pedido entra na fila. Assim nem o status, nem o corpo, nem o tempo
 * dizem se o e-mail tem conta: o trabalho que depende disso (procurar a conta,
 * gerar o link, falar com o servico de e-mail) acontece quando quem pediu ja
 * recebeu a resposta. A fila processa um pedido por vez, e as contagens dos
 * limites nao correm entre si.
 *
 * So recebe o link a conta ativa que ja definiu a senha; a que ainda nao
 * definiu tem o link de primeiro acesso, que a clinica gera. Todo pedido deixa
 * uma linha na trilha, na entidade RecuperacaoDeSenha, sem ator: quem pede nao
 * esta autenticado. O de conta existente fica com a conta (idEntidade); o de
 * e-mail sem conta, sem o e-mail digitado (minimizacao), so com a origem.
 *
 * Os limites sao contados na propria trilha, e nao em memoria: o reinicio do
 * servidor no Render nao os zera. Por conta e por origem, na ultima hora,
 * qualquer que tenha sido o resultado do pedido; o teto da clinica, nos links
 * gerados nas ultimas 24 horas — abaixo da cota gratis do Resend.
 */

export const ENTIDADE_DA_RECUPERACAO = 'RecuperacaoDeSenha'
const HORA_MS = 3_600_000
const DIA_MS = 24 * HORA_MS

/** O que a resposta da rota precisa ter para o pedido esperar por ela. */
export interface FimDaResposta { once(evento: 'finish' | 'close', ouvinte: () => void): unknown }

@Injectable()
export class ServicoRecuperacao {
  private readonly log = new Logger('Recuperacao')
  private fila: Promise<void> = Promise.resolve()
  /** Pedidos cuja resposta ainda nao terminou de sair. */
  private aguardando = 0
  /** Relogio substituivel, para o teste andar uma hora sem esperar. */
  agora: () => Date = () => new Date()

  constructor(
    private readonly banco: ServicoBanco,
    private readonly auditoria: ServicoAuditoria,
    private readonly autenticacao: ServicoAutenticacao,
    private readonly email: ServicoEmail,
  ) {}

  /** O pedido entra na fila quando a resposta terminou de sair (ou a conexao fechou). */
  depoisDaResposta(resposta: FimDaResposta, email: unknown, ip: string | null): void {
    this.aguardando++
    let feito = false
    const seguir = () => {
      if (feito) return
      feito = true
      this.aguardando--
      this.fila = this.fila
        .then(() => this.processar(email, ip))
        .catch(() => { this.log.error('Um pedido de nova senha não pôde ser processado.') })
    }
    resposta.once('finish', seguir)
    resposta.once('close', seguir)
  }

  /** Para os testes: espera os pedidos recebidos e a fila esvaziar. */
  async ocioso(): Promise<void> {
    for (;;) {
      while (this.aguardando > 0) await new Promise((r) => setTimeout(r, 5))
      const atual = this.fila
      await atual
      if (atual === this.fila && this.aguardando === 0) return
    }
  }

  private contar(where: Record<string, unknown>): Promise<number> {
    return this.banco.registroAuditoria.count({ where: { entidade: ENTIDADE_DA_RECUPERACAO, ...where } })
  }

  private async processar(email: unknown, ip: string | null): Promise<void> {
    const agora = this.agora().getTime()
    const ultimaHora = { gt: new Date(agora - HORA_MS), lte: new Date(agora) }
    const registrar = (acao: AcaoAuditoria, idEntidade: string | null, detalhe: string) =>
      this.auditoria.registrar(null, { acao, entidade: ENTIDADE_DA_RECUPERACAO, idEntidade, detalhe, ipOrigem: ip })

    // A origem primeiro, antes de procurar a conta: a linha da recusa nao diz
    // se o e-mail tem dono.
    if (ip !== null && await this.contar({ ipOrigem: ip, ocorridoEm: ultimaHora }) >= RECUPERACOES_POR_ORIGEM_POR_HORA) {
      return registrar('ACESSO_NEGADO', null,
        `Pedido de nova senha recusado: já são ${RECUPERACOES_POR_ORIGEM_POR_HORA} pedidos desta origem na última hora. Nada foi enviado.`)
    }

    const normal = typeof email === 'string' ? normalizarEmail(email) : ''
    const conta = normal.length <= 320 && emailValido(normal)
      ? await this.banco.usuario.findUnique({ where: { email: normal } })
      : null
    if (!conta) {
      return registrar('ACESSO_NEGADO', null,
        'Pedido de nova senha para um e-mail sem conta. O e-mail digitado não foi guardado; nada foi enviado.')
    }
    if (await this.contar({ idEntidade: conta.id, ocorridoEm: ultimaHora }) >= RECUPERACOES_POR_CONTA_POR_HORA) {
      return registrar('ACESSO_NEGADO', conta.id,
        `Pedido de nova senha recusado: já são ${RECUPERACOES_POR_CONTA_POR_HORA} pedidos para esta conta na última hora. Nada foi enviado.`)
    }
    if (!conta.ativo || conta.perfis.length === 0) {
      return registrar('ACESSO_NEGADO', conta.id, 'Pedido de nova senha para uma conta desativada. Nada foi enviado.')
    }
    if (conta.ultimoAcessoEm === null) {
      return registrar('ACESSO_NEGADO', conta.id,
        'Pedido de nova senha para uma conta que ainda não definiu a senha: o caminho é o link de primeiro acesso, que a clínica gera. Nada foi enviado.')
    }
    if (await this.contar({ acao: 'CRIACAO', ocorridoEm: { gt: new Date(agora - DIA_MS), lte: new Date(agora) } }) >= RECUPERACOES_POR_DIA) {
      this.log.warn(`Teto de ${RECUPERACOES_POR_DIA} links de recuperação em 24 horas atingido: os pedidos seguintes não recebem e-mail.`)
      return registrar('ACESSO_NEGADO', conta.id,
        `Pedido de nova senha recusado: a clínica chegou ao teto de ${RECUPERACOES_POR_DIA} links de recuperação em 24 horas. Nada foi enviado.`)
    }
    // Sem envio, o link nao chegaria a ninguem: nem se gera.
    if (!this.email.ligado) {
      return registrar('ACESSO_NEGADO', conta.id,
        'Pedido de nova senha sem resposta: o envio de e-mail está desligado. Nenhum link foi gerado.')
    }

    const pedido = { finalidade: 'RECUPERACAO' as const }
    const { token, expiraEm } = await this.autenticacao.gerarAcessoInicial(conta.id, pedido)
    const situacao = await this.autenticacao.enviarLink(conta, pedido, token, expiraEm)
    return registrar('CRIACAO', conta.id, situacao === 'ENVIADO'
      ? 'Link de recuperação de senha gerado e enviado por e-mail, válido por 1 hora; os links anteriores ainda não usados deixaram de valer.'
      : 'Link de recuperação de senha gerado, mas o e-mail não foi enviado: falha no serviço de e-mail. Os links anteriores ainda não usados deixaram de valer.')
  }
}
