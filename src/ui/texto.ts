/**
 * Ajustes de lingua do texto da interface.
 *
 * Aqui mora o que nao pode ser resolvido no lugar onde a frase e montada: a
 * mesma frase recebe expressoes de generos e numeros diferentes, e trocar "a o"
 * por "ao" na mao acerta um caso e erra os outros tres.
 */

const CONTRACOES: Record<string, string> = { o: 'ao', a: 'à', os: 'aos', as: 'às' }

/** Preposicao "a" contraida com o artigo: ao, à, aos, às. */
export function aoArtigo(expressao: string): string {
  const m = /^(o|a|os|as)\s+(.*)$/.exec(expressao)
  if (!m) return `a ${expressao}`
  return `${CONTRACOES[m[1]]} ${m[2]}`
}
