import type { DataIso } from '../tipos.js'

/**
 * O toque do "Como foi esta tentativa?" (tela 7, item 22), feito com ou sem
 * conexao. O aparelho da a ele um id e o instante em que aconteceu, grava na
 * fila e so depois envia; o servidor grava o registro com esse mesmo id. Por
 * isso o reenvio e seguro: o mesmo id, com o mesmo conteudo, devolve o que ja
 * estava gravado, e nao grava de novo (docs/07, secao 3A: a chave de
 * idempotencia e gerada no aparelho).
 */

/** O quanto o relogio do aparelho pode divergir do servidor: 5 minutos. */
export const TOLERANCIA_DO_RELOGIO_MS = 5 * 60_000

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Instante com o fuso escrito: sem ele, o texto seria lido na hora da maquina. */
const INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/

export function ehUuid(texto: unknown): texto is string {
  return typeof texto === 'string' && FORMATO_UUID.test(texto)
}

/** O instante do texto, se ele traz data, hora e fuso; nulo se nao. */
export function lerInstanteComFuso(texto: unknown): Date | null {
  if (typeof texto !== 'string' || !INSTANTE.test(texto)) return null
  const ms = Date.parse(texto)
  return Number.isNaN(ms) ? null : new Date(ms)
}

export const TOQUE_SEM_UUID = 'O identificador do toque precisa ser um UUID.'
export const TOQUE_SEM_INSTANTE = 'O horário do toque precisa trazer data, hora e fuso.'
export const TOQUE_NO_FUTURO = 'O toque está com horário no futuro. Confira o relógio do aparelho.'
export const TOQUE_ANTES_DO_INICIO = 'O toque está com horário anterior ao início da sessão.'
export const TOQUE_COM_OUTRO_CONTEUDO = 'Este toque já foi registrado com outro conteúdo.'

/**
 * O id e o instante que o aparelho mandou, ou o erro de cada um. Os dois sao
 * opcionais: sem eles, o servidor gera o id e usa o proprio relogio, como
 * antes do item 22.
 */
export function erroDaIdentificacaoDoToque(
  dados: { id?: unknown; ocorridoEm?: unknown },
  inicioDaSessao: Date | DataIso | null,
  agora: Date,
): Record<string, string> {
  const erros: Record<string, string> = {}
  if (dados.id !== undefined && !ehUuid(dados.id)) erros.id = TOQUE_SEM_UUID
  if (dados.ocorridoEm !== undefined) {
    const instante = lerInstanteComFuso(dados.ocorridoEm)
    const inicio = inicioDaSessao === null ? null : new Date(inicioDaSessao)
    if (!instante) erros.ocorridoEm = TOQUE_SEM_INSTANTE
    else if (instante.getTime() > agora.getTime() + TOLERANCIA_DO_RELOGIO_MS) erros.ocorridoEm = TOQUE_NO_FUTURO
    else if (inicio && instante.getTime() < inicio.getTime() - TOLERANCIA_DO_RELOGIO_MS) erros.ocorridoEm = TOQUE_ANTES_DO_INICIO
  }
  return erros
}

/**
 * O mesmo toque: mesma sessao, mesmo objetivo, mesmo resultado e, se o
 * aparelho mandou o instante, o mesmo instante. Com o mesmo id e outro
 * conteudo, e conflito, e nao reenvio.
 */
export function mesmoToque(
  gravado: { sessaoId: string; objetivoId: string; resultado: string; ocorridoEm: Date | DataIso },
  enviado: { sessaoId: string; objetivoId: unknown; resultado: unknown; ocorridoEm?: unknown },
): boolean {
  if (gravado.sessaoId !== enviado.sessaoId || gravado.objetivoId !== enviado.objetivoId || gravado.resultado !== enviado.resultado) {
    return false
  }
  if (enviado.ocorridoEm === undefined) return true
  const instante = lerInstanteComFuso(enviado.ocorridoEm)
  return instante !== null && instante.getTime() === new Date(gravado.ocorridoEm).getTime()
}

// ---------------------------------------------------------------- UUID v7

const bytesAleatorios = (n: number): Uint8Array => globalThis.crypto.getRandomValues(new Uint8Array(n))

let ultimoMs = -1
let ultimoContador = 0

/**
 * UUID v7 (RFC 9562): os 48 primeiros bits sao o instante em milissegundos, e
 * o resto e aleatorio. Gerado no mesmo aparelho, cresce na ordem em que foi
 * gerado — no mesmo milissegundo, um contador de 12 bits garante isso —, e a
 * fila usa o proprio id como ordem dos toques.
 */
export function gerarUuidV7(agora: number = Date.now(), aleatorios: (n: number) => Uint8Array = bytesAleatorios): string {
  const sorte = aleatorios(16)
  let ms = Math.floor(agora)
  let contador: number
  if (ms <= ultimoMs) {
    ms = ultimoMs
    contador = ultimoContador + 1
    if (contador > 0xfff) {
      ms += 1
      contador = 0
    }
  } else {
    // Comeca na metade de baixo: sobra espaco para os do mesmo milissegundo.
    contador = ((sorte[6] & 0x07) << 8) | sorte[7]
  }
  ultimoMs = ms
  ultimoContador = contador

  const b = new Uint8Array(16)
  for (let i = 5, resto = ms; i >= 0; i--, resto = Math.floor(resto / 256)) b[i] = resto % 256
  b[6] = 0x70 | (contador >> 8)
  b[7] = contador & 0xff
  b[8] = 0x80 | (sorte[8] & 0x3f)
  for (let i = 9; i < 16; i++) b[i] = sorte[i]
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
