import { randomBytes } from 'node:crypto'
import argon2 from 'argon2'

/**
 * Senha so em argon2id (docs/07, D5). Sem Nest aqui: o comando do primeiro
 * administrador usa o mesmo hash, fora do servidor.
 */
export function hashDaSenha(senha: string): Promise<string> {
  return argon2.hash(senha, { type: argon2.argon2id })
}

export function conferirSenha(hash: string, senha: string): Promise<boolean> {
  return argon2.verify(hash, senha).catch(() => false)
}

/**
 * Hash de uma senha que ninguem conhece. Serve para dois fins: a conta que
 * ainda nao fez o primeiro acesso nasce com ele, e o login com e-mail que nao
 * existe confere contra ele — o tempo de resposta nao revela se o e-mail existe.
 */
let hashSemDono: Promise<string> | null = null
export function hashDeSenhaDesconhecida(): Promise<string> {
  hashSemDono ??= hashDaSenha(randomBytes(32).toString('base64url'))
  return hashSemDono
}
