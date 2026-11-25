import { Injectable, Logger } from '@nestjs/common'
import type { SituacaoDoEnvio } from '@sinctea/compartilhado'
import { NOME_DO_TIPO, linkDeDefinirSenha, type Mensagem } from './mensagens.js'

/**
 * O envio de e-mail (item 23), com um transporte so: POST na API do Resend,
 * por fetch, sem SDK, com tempo limite de 10 s.
 *
 * Tres modos, escolhidos ao subir:
 * - RESEND: com RESEND_API_KEY, EMAIL_REMETENTE e URL_PUBLICA.
 * - MEMORIA: sem a chave, fora de producao (desenvolvimento e testes). A
 *   mensagem fica na `caixa` e nunca sai da maquina.
 * - DESLIGADO: sem a chave em producao, ou com a chave e sem as outras duas.
 *   O servidor sobe, avisa no log, e tudo funciona como antes do item 23: a
 *   tela mostra o link para copiar.
 *
 * O envio nunca derruba a operacao: tempo esgotado, 4xx ou 5xx viram FALHOU,
 * a falha vai para o log e quem chamou mostra o link. A chave so existe dentro
 * do transporte, numa closure: nao e campo deste objeto, nao vai para log, erro
 * nem resposta. O log diz o tipo da mensagem, e nunca o destinatario, o
 * corpo da resposta do Resend nem o link.
 */

export const ENDERECO_DO_RESEND = 'https://api.resend.com/emails'
export const TEMPO_LIMITE_DO_ENVIO_MS = 10_000

/** Sem URL_PUBLICA no desenvolvimento, o link da caixa aponta para o Vite. */
const URL_DO_DESENVOLVIMENTO = 'http://localhost:5173'
/** A caixa de memoria guarda as ultimas, para o desenvolvimento nao crescer sem fim. */
const TAMANHO_DA_CAIXA = 200

export type ModoDoEnvio = 'RESEND' | 'MEMORIA' | 'DESLIGADO'

type Transporte = (mensagem: Mensagem) => Promise<SituacaoDoEnvio>

/** Endereco http(s) sem credencial, consulta nem fragmento; o resto e configuracao errada. */
function urlPublicaValida(valor: string | undefined): string | null {
  if (!valor?.trim()) return null
  try {
    const u = new URL(valor.trim())
    if ((u.protocol !== 'https:' && u.protocol !== 'http:') || u.username || u.password || u.search || u.hash) return null
    return u.toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

function transporteResend(chave: string, remetente: string, log: Logger, tempoLimite: () => number): Transporte {
  return async (m) => {
    const limite = tempoLimite()
    let resposta: Response
    try {
      resposta = await fetch(ENDERECO_DO_RESEND, {
        method: 'POST',
        headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: remetente, to: [m.para], subject: m.assunto, text: m.texto, html: m.html }),
        signal: AbortSignal.timeout(limite),
      })
    } catch (erro) {
      // O erro do fetch nunca vai inteiro para o log: so o que aconteceu.
      const esgotado = erro instanceof Error && (erro.name === 'TimeoutError' || erro.name === 'AbortError')
      log.warn(esgotado
        ? `O serviço de e-mail não respondeu em ${Math.round(limite / 1000)} s: ${NOME_DO_TIPO[m.tipo]} não enviado.`
        : `O serviço de e-mail não foi alcançado: ${NOME_DO_TIPO[m.tipo]} não enviado.`)
      return 'FALHOU'
    }
    // O corpo da resposta nao interessa e nunca vai para o log: pode ecoar o pedido.
    await resposta.body?.cancel().catch(() => undefined)
    if (!resposta.ok) {
      log.warn(`O serviço de e-mail recusou a mensagem (HTTP ${resposta.status}): ${NOME_DO_TIPO[m.tipo]} não enviado.`)
      return 'FALHOU'
    }
    return 'ENVIADO'
  }
}

@Injectable()
export class ServicoEmail {
  private readonly log = new Logger('Email')
  readonly modo: ModoDoEnvio
  private readonly urlPublica: string | null
  private readonly transporte: Transporte
  /** O transporte de memoria: o que teria saido. Vazia nos outros modos. */
  readonly caixa: Mensagem[] = []
  /** Substituivel nos testes, para o tempo esgotado nao levar 10 s. */
  tempoLimiteMs = TEMPO_LIMITE_DO_ENVIO_MS
  private readonly pendentes = new Set<Promise<unknown>>()

  constructor() {
    const env = process.env
    const chave = (env.RESEND_API_KEY ?? '').trim()
    const remetente = (env.EMAIL_REMETENTE ?? '').trim()
    const url = urlPublicaValida(env.URL_PUBLICA)
    const desligado: Transporte = async () => 'DESLIGADO'

    if (chave) {
      const faltam = [!remetente && 'EMAIL_REMETENTE', !url && 'URL_PUBLICA'].filter(Boolean)
      if (faltam.length > 0) {
        this.modo = 'DESLIGADO'
        this.urlPublica = null
        this.transporte = desligado
        this.log.warn(`Envio de e-mail desligado: ${faltam.join(' e ')} ausente ou inválida. Os links continuam na tela, para copiar.`)
      } else {
        this.modo = 'RESEND'
        this.urlPublica = url
        this.transporte = transporteResend(chave, remetente, this.log, () => this.tempoLimiteMs)
        this.log.log('Envio de e-mail ligado.')
      }
    } else if (env.NODE_ENV === 'production') {
      this.modo = 'DESLIGADO'
      this.urlPublica = null
      this.transporte = desligado
      this.log.warn('Envio de e-mail desligado: RESEND_API_KEY não está definida. Os links continuam na tela, para copiar.')
    } else {
      this.modo = 'MEMORIA'
      this.urlPublica = url ?? URL_DO_DESENVOLVIMENTO
      this.transporte = async (m) => {
        this.caixa.push(m)
        if (this.caixa.length > TAMANHO_DA_CAIXA) this.caixa.shift()
        return 'ENVIADO'
      }
    }
  }

  get ligado(): boolean {
    return this.modo !== 'DESLIGADO'
  }

  /** O link da tela 23, montado de URL_PUBLICA. Nulo com o envio desligado. */
  linkPara(token: string): string | null {
    return this.urlPublica ? linkDeDefinirSenha(this.urlPublica, token) : null
  }

  /** Envia e diz como foi. Nunca lanca. */
  async enviar(mensagem: Mensagem): Promise<SituacaoDoEnvio> {
    try {
      return await this.transporte(mensagem)
    } catch {
      this.log.warn(`Falha ao enviar: ${NOME_DO_TIPO[mensagem.tipo]} não enviado.`)
      return 'FALHOU'
    }
  }

  /** Envia sem esperar, para o que nao tem tela esperando: a confirmacao de senha alterada. */
  enviarDepois(mensagem: Mensagem): void {
    const envio: Promise<unknown> = this.enviar(mensagem).finally(() => this.pendentes.delete(envio))
    this.pendentes.add(envio)
  }

  /** Para os testes: espera os envios que ainda estao a caminho. */
  async ocioso(): Promise<void> {
    while (this.pendentes.size > 0) await Promise.all([...this.pendentes])
  }
}
