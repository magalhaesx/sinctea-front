import { ErroServico } from '@sinctea/compartilhado'

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Id de rota que nao e uuid nao chega ao banco — la, a coluna uuid recusaria
 * com erro 500. Para quem pergunta, e simplesmente algo que nao existe.
 */
export function exigirUuid(id: string, oQue: string): string {
  if (!FORMATO_UUID.test(id)) throw new ErroServico('NAO_ENCONTRADO', `${oQue} não encontrado.`)
  return id.toLowerCase()
}

/** Erros por campo viram VALIDACAO, com a primeira mensagem na frente. */
export function exigirValido(erros: Record<string, string>): void {
  if (Object.keys(erros).length > 0) {
    throw new ErroServico('VALIDACAO', Object.values(erros)[0], erros)
  }
}

export function textoOuVazio(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : ''
}
