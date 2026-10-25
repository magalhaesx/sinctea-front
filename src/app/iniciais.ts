/** Palavras que ligam o nome e nao entram nas iniciais: "Patrícia da Silva" e "PS". */
const LIGACOES = new Set(['da', 'das', 'de', 'do', 'dos', 'e'])

/**
 * As iniciais do icone do cabecalho da tela: da pessoa de que a tela trata,
 * ate duas, em maiusculas. Sem nome, nenhuma — o icone nao aparece.
 */
export function iniciaisDe(nome: string | null | undefined): string {
  if (!nome) return ''
  return nome.trim().split(/\s+/)
    .filter((palavra) => palavra && !LIGACOES.has(palavra.toLowerCase()))
    .slice(0, 2)
    .map((palavra) => palavra[0].toLocaleUpperCase('pt-BR'))
    .join('')
}
