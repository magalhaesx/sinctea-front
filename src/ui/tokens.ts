export type Area = 'cli' | 'fam' | 'esc'

/** Tons de estado (docs/02, secao 1). Reservados: nunca servem de cor de area. */
export type Tom = 'ok' | 'at' | 'cr' | 'neutro'

/**
 * Duas familias por area (docs/02, secao 1 — "Dois papeis, duas familias"):
 * `bg` e a cor de MARCA, so para manchas sem texto em cima (barras, pontos,
 * faixas); `preenchido` e a cor de TINTA, para superficies que recebem texto
 * branco. A marca reprova como fundo de texto (3,09:1 na clinica).
 */
export const acento: Record<Area, {
  bg: string; preenchido: string; preenchidoHover: string; texto: string; borda: string; sup: string
}> = {
  cli: {
    bg: 'bg-cli', preenchido: 'bg-cli-ink',
    preenchidoHover: 'hover:bg-[color-mix(in_oklab,var(--color-cli-ink),black_18%)]',
    texto: 'text-cli-ink', borda: 'border-cli', sup: 'bg-cli-sup',
  },
  fam: {
    bg: 'bg-fam', preenchido: 'bg-fam-ink',
    preenchidoHover: 'hover:bg-[color-mix(in_oklab,var(--color-fam-ink),black_18%)]',
    texto: 'text-fam-ink', borda: 'border-fam', sup: 'bg-fam-sup',
  },
  esc: {
    bg: 'bg-esc', preenchido: 'bg-esc-ink',
    preenchidoHover: 'hover:bg-[color-mix(in_oklab,var(--color-esc-ink),black_18%)]',
    texto: 'text-esc-ink', borda: 'border-esc', sup: 'bg-esc-sup',
  },
}
