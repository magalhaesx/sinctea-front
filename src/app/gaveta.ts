/**
 * A gaveta do menu (item 12) e um dialogo modal: o foco nao sai dela enquanto
 * esta aberta. Do ultimo item, Tab volta ao primeiro; do primeiro, Shift+Tab
 * vai ao ultimo. Nos demais, o navegador segue sozinho, e a funcao diz nulo.
 */
export function focoPresoNaGaveta(atual: number, total: number, paraTras: boolean): number | null {
  if (total === 0) return null
  if (atual < 0) return paraTras ? total - 1 : 0
  if (paraTras && atual === 0) return total - 1
  if (!paraTras && atual === total - 1) return 0
  return null
}

/** O nome do botao ☰, conforme o estado da gaveta. */
export const rotuloDoBotaoDoMenu = (aberto: boolean) => (aberto ? 'Fechar o menu' : 'Abrir o menu')

/** O que recebe foco dentro da gaveta. */
export const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
