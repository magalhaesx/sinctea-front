/**
 * Leitura da trilha de auditoria.
 *
 * O `valorAnterior` do RegistroAuditoria e JSON canonico — bom para comparar e
 * guardar, ruim para ler. Aqui ele vira campo e valor em linguagem de gente,
 * nas duas saidas que precisam dele: a tela 13 e o CSV exportado. Fica no
 * dominio para que as duas digam a mesma coisa.
 */

/** Os campos que a trilha guarda hoje, com nome de gente. */
export const NOME_DO_CAMPO: Record<string, string> = {
  tipo: 'O que aconteceu',
  intensidade: 'Intensidade',
  contexto: 'Em que momento',
}

/**
 * Os pares do valor anterior, na ordem em que o JSON canonico os guardou.
 *
 * Chave desconhecida cai no proprio nome: a trilha vai receber alteracoes de
 * outras entidades, e esconder o que ainda nao se sabe nomear seria pior do
 * que mostrar a chave crua.
 */
export function camposAnteriores(valorAnterior: string): Array<[string, string]> {
  try {
    const valor: unknown = JSON.parse(valorAnterior)
    if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
      return Object.entries(valor as Record<string, unknown>).map(([k, v]) => [k, String(v)])
    }
  } catch { /* nao era JSON: cai no bruto, abaixo */ }
  return [['Valor anterior', valorAnterior]]
}

/** "Em que momento: Recreio · Intensidade: 3 · O que aconteceu: Tapou os ouvidos" */
export function versaoAnteriorEmTexto(valorAnterior: string | null): string {
  if (!valorAnterior) return ''
  return camposAnteriores(valorAnterior)
    .map(([campo, valor]) => `${NOME_DO_CAMPO[campo] ?? campo}: ${valor}`)
    .join(' · ')
}
