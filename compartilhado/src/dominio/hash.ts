/**
 * Resumo criptografico do conteudo de um documento.
 *
 * O relatorio emitido carrega o hash do que saiu. Ele so prova alguma coisa se
 * for calculado sobre o conteudo — um valor aleatorio com prefixo "sha256:"
 * tem a aparencia da prova e nenhuma das suas propriedades.
 *
 * Duas pecas: um JSON canonico, para que o mesmo conteudo produza sempre o
 * mesmo texto, e o SHA-256 sobre ele. Sem o canonico, trocar a ordem das
 * chaves mudaria o hash sem mudar o documento.
 */

/** JSON com as chaves de todo objeto em ordem. Arrays mantem a sua ordem. */
export function jsonCanonico(valor: unknown): string {
  return JSON.stringify(ordenar(valor))
}

function ordenar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenar)
  if (valor === null || typeof valor !== 'object') return valor
  const entradas = Object.entries(valor as Record<string, unknown>)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return Object.fromEntries(entradas.map(([chave, v]) => [chave, ordenar(v)]))
}

/** "sha256:" seguido do resumo em hexadecimal minusculo. */
export async function resumoSha256(valor: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(jsonCanonico(valor))
  const resumo = await crypto.subtle.digest('SHA-256', bytes)
  const hex = [...new Uint8Array(resumo)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `sha256:${hex}`
}
