import { createHash, randomBytes } from 'node:crypto'

/**
 * Tokens de sessao, de primeiro acesso e de convite escolar: o token vai no
 * cookie ou no link, e o banco guarda so o resumo. Sem Nest aqui: a semente e
 * os testes usam as mesmas funcoes, fora do servidor.
 */

/** SHA-256 em hexadecimal: e o que o banco guarda de cada token. */
export function resumoDoToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/** 32 bytes aleatorios, em base64url: vai no cookie ou no link, nunca no banco. */
export function novoToken(): string {
  return randomBytes(32).toString('base64url')
}
