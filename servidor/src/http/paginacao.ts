import { ErroServico, type FiltroPaginacao, type Pagina } from '@sinctea/compartilhado'

/**
 * A mesma pagina que o mock devolvia (src/servicos/mock/infra.ts): de 1 a 100
 * itens, pagina a partir de 1. As listas deste servidor sao pequenas e se
 * ordenam em memoria com a regra do portugues (localeCompare pt-BR), que a
 * ordenacao C do banco nao conhece.
 */
export function paginar<T>(itens: T[], filtro: FiltroPaginacao = {}): Pagina<T> {
  const porPagina = Math.min(100, Math.max(1, Math.floor(filtro.porPagina ?? 10)))
  const pagina = Math.max(1, Math.floor(filtro.pagina ?? 1))
  const inicio = (pagina - 1) * porPagina
  return { itens: itens.slice(inicio, inicio + porPagina), total: itens.length, pagina, porPagina }
}

/** A query string chega como texto: numero que nao e numero vira o padrao. */
export function lerPaginacao(query: Record<string, unknown>): FiltroPaginacao {
  const numero = (valor: unknown) => {
    const n = Number(valor)
    return typeof valor === 'string' && valor !== '' && Number.isFinite(n) ? n : undefined
  }
  return { pagina: numero(query.pagina), porPagina: numero(query.porPagina) }
}

export function lerTexto(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.trim() !== '' ? valor : undefined
}

/** Instante ISO na query; ausente, nulo. Texto que nao e data e erro de quem pediu. */
export function lerInstante(valor: unknown, campo: string): Date | undefined {
  const texto = lerTexto(valor)
  if (texto === undefined) return undefined
  const data = new Date(texto)
  if (Number.isNaN(data.getTime())) throw new ErroServico('VALIDACAO', 'Data inválida.', { [campo]: 'Data inválida.' })
  return data
}

export function lerBooleano(valor: unknown): boolean | undefined {
  return valor === 'true' ? true : valor === 'false' ? false : undefined
}

export const porNome = <T extends { nome: string }>(a: T, b: T) => a.nome.localeCompare(b.nome, 'pt-BR')
