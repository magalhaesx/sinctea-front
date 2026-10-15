import { randomBytes } from 'node:crypto'

/**
 * UUID versao 7 (RFC 9562): 48 bits de milissegundos desde a epoca, e o resto
 * aleatorio. Ordenavel pelo momento de criacao, que e por que o banco o usa.
 *
 * A semente precisa dos ids antes de gravar, para ligar as linhas entre si; o
 * @default(uuid(7)) do esquema so serve a quem grava uma linha de cada vez.
 */
export function uuidV7(agora: number = Date.now()): string {
  const bytes = randomBytes(16)
  let ms = BigInt(agora)
  for (let i = 5; i >= 0; i -= 1) {
    bytes[i] = Number(ms & 0xffn)
    ms >>= 8n
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70 // versao 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variante RFC
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
