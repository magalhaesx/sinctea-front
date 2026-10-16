import { Injectable } from '@nestjs/common'
import { ErroServico } from '@sinctea/compartilhado'

/**
 * Limite de tentativas de entrada (pedido do Cowork em 16/10, antes de o
 * endereco ficar publico).
 *
 * - Por e-mail: 5 senhas erradas em 15 minutos bloqueiam aquele e-mail por 15
 *   minutos. Conta o e-mail digitado, exista ou nao — o bloqueio nao revela
 *   quem tem conta.
 * - Por IP: 20 erradas em 15 minutos bloqueiam o IP por 15 minutos. Maior,
 *   porque uma clinica inteira pode sair pelo mesmo IP.
 *
 * Bloqueado, o pedido e recusado antes de conferir a senha, mesmo certa.
 *
 * Em memoria: o Render roda uma instancia so. Reiniciar o servidor zera a
 * contagem — limite declarado no docs/06.
 */

export const JANELA_MS = 15 * 60_000
export const BLOQUEIO_MS = 15 * 60_000
export const LIMITE_POR_EMAIL = 5
export const LIMITE_POR_IP = 20

interface Contagem { falhas: number[]; bloqueadoAte: number }

class Contador {
  private readonly chaves = new Map<string, Contagem>()

  constructor(private readonly limite: number) {}

  bloqueado(chave: string, agora: number): boolean {
    const c = this.chaves.get(chave)
    return c !== undefined && c.bloqueadoAte > agora
  }

  falhou(chave: string, agora: number): void {
    const c = this.chaves.get(chave) ?? { falhas: [], bloqueadoAte: 0 }
    c.falhas = c.falhas.filter((t) => agora - t < JANELA_MS)
    c.falhas.push(agora)
    if (c.falhas.length >= this.limite) {
      c.bloqueadoAte = agora + BLOQUEIO_MS
      c.falhas = []
    }
    this.chaves.set(chave, c)
    if (this.chaves.size > 10_000) this.varrer(agora)
  }

  esquecer(chave: string): void {
    this.chaves.delete(chave)
  }

  limpar(): void {
    this.chaves.clear()
  }

  /** Tira o que ja nao conta, para a memoria nao crescer sem fim. */
  private varrer(agora: number): void {
    for (const [chave, c] of this.chaves) {
      if (c.bloqueadoAte <= agora && c.falhas.every((t) => agora - t >= JANELA_MS)) this.chaves.delete(chave)
    }
  }
}

@Injectable()
export class LimiteDeTentativas {
  private readonly porEmail = new Contador(LIMITE_POR_EMAIL)
  private readonly porIp = new Contador(LIMITE_POR_IP)

  /** Relogio substituivel, para o teste andar 15 minutos sem esperar. */
  agora: () => number = () => Date.now()

  exigirLiberado(email: string, ip: string | null): void {
    const agora = this.agora()
    if (this.porEmail.bloqueado(email, agora) || (ip !== null && this.porIp.bloqueado(ip, agora))) {
      throw new ErroServico('LIMITE_TENTATIVAS',
        'Muitas tentativas de entrada em pouco tempo. Por segurança, espere 15 minutos e tente de novo.')
    }
  }

  falhou(email: string, ip: string | null): void {
    const agora = this.agora()
    this.porEmail.falhou(email, agora)
    if (ip !== null) this.porIp.falhou(ip, agora)
  }

  /** Entrou: as falhas daquele e-mail deixam de contar. As do IP continuam. */
  entrou(email: string): void {
    this.porEmail.esquecer(email)
  }

  /** So para os testes. */
  limpar(): void {
    this.porEmail.limpar()
    this.porIp.limpar()
  }
}
