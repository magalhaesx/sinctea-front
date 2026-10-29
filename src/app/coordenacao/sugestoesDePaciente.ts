/**
 * A busca de paciente do filtro da tela 13 (item 17b), sem React: quando
 * buscar, quantos pedir e para onde a seta leva. O componente so desenha.
 */

/** A partir de duas letras: com uma, a lista seria quase todos os pacientes. */
export const LETRAS_PARA_BUSCAR = 2

/** Ate 20 sugestoes: mais que isso, a pessoa refina o nome. */
export const SUGESTOES_DA_BUSCA = 20

/** O texto que vai para pacientes.listar({ busca }), ou nulo se ainda e cedo para buscar. */
export function textoParaBuscar(digitado: string): string | null {
  const texto = digitado.trim()
  return texto.length >= LETRAS_PARA_BUSCAR ? texto : null
}

/** A sugestao marcada depois de uma seta: para baixo ou para cima, dando a volta; -1 e nenhuma. */
export function proximaSugestao(atual: number, tecla: 'ArrowDown' | 'ArrowUp', total: number): number {
  if (total === 0) return -1
  if (tecla === 'ArrowDown') return atual + 1 >= total ? 0 : atual + 1
  return atual <= 0 ? total - 1 : atual - 1
}

/** O que a regiao viva diz, para quem nao ve a lista. */
export function situacaoDaBusca(texto: string, total: number | null): string {
  if (textoParaBuscar(texto) === null) return `Digite ao menos ${LETRAS_PARA_BUSCAR} letras do nome.`
  if (total === null) return 'Buscando…'
  if (total === 0) return 'Nenhum paciente com esse nome.'
  return total === 1 ? '1 paciente encontrado.' : `${total} pacientes encontrados.`
}
