import { acento, type Area } from '../componentes/ui'

/**
 * Paginacao de listagens (toda listagem e paginada — docs/01, secao 4).
 * Recebe os mesmos campos de Pagina<T>: `pagina`, `porPagina` e `total`.
 *
 * O resumo ("Mostrando 11 a 20 de 23 pacientes") fica numa regiao viva, para
 * que a troca de pagina seja anunciada. Em tela estreita os numeros dao lugar
 * a "Pagina 2 de 3", para nao transbordar a 400px. Alvos de 44px.
 */

export type ItemPaginacao = number | 'reticencias'

/**
 * Paginas a exibir, sempre no maximo sete posicoes: primeira, ultima, a atual
 * e suas vizinhas, com reticencias onde ha salto.
 */
export function paginasVisiveis(atual: number, totalPaginas: number): ItemPaginacao[] {
  if (totalPaginas <= 7) return Array.from({ length: totalPaginas }, (_, i) => i + 1)
  if (atual <= 4) return [1, 2, 3, 4, 5, 'reticencias', totalPaginas]
  if (atual >= totalPaginas - 3) {
    return [1, 'reticencias', ...Array.from({ length: 5 }, (_, i) => totalPaginas - 4 + i)]
  }
  return [1, 'reticencias', atual - 1, atual, atual + 1, 'reticencias', totalPaginas]
}

export interface PropsPaginacao {
  pagina: number
  porPagina: number
  total: number
  aoMudar: (pagina: number) => void
  /** Nome acessivel da navegacao: "Páginas da lista de pacientes". */
  rotulo: string
  /** Como contar os itens no resumo: { singular: 'paciente', plural: 'pacientes' }. */
  nomeItens: { singular: string; plural: string }
  area?: Area
}

const alvo =
  'inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg border-2 px-3 font-bold tabular-nums'

export function Paginacao({ pagina, porPagina, total, aoMudar, rotulo, nomeItens, area = 'cli' }: PropsPaginacao) {
  if (total <= 0) return null

  const totalPaginas = Math.max(1, Math.ceil(total / porPagina))
  const atual = Math.min(Math.max(1, pagina), totalPaginas)
  const primeiro = (atual - 1) * porPagina + 1
  const ultimo = Math.min(atual * porPagina, total)
  const nome = total === 1 ? nomeItens.singular : nomeItens.plural
  const fmt = (n: number) => n.toLocaleString('pt-BR')

  const resumo = totalPaginas === 1
    ? `${fmt(total)} ${nome}`
    : `Mostrando ${fmt(primeiro)} a ${fmt(ultimo)} de ${fmt(total)} ${nome}`

  // tinta3 so aqui: componente inativo, isento de contraste pelo criterio 1.4.3
  // da WCAG (docs/02, secao 1). Texto ativo nunca usa tinta3.
  const inativo = 'border-linha bg-sup text-tinta3 cursor-not-allowed'
  const ativo = `border-current bg-sup ${acento[area].texto} hover:bg-sup2 cursor-pointer`

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-[13.5px] text-tinta2 tabular-nums" aria-live="polite">{resumo}</p>

      {totalPaginas > 1 && (
        <nav aria-label={rotulo}>
          <ul className="flex flex-wrap items-center gap-2">
            <li>
              <button
                type="button"
                className={`${alvo} ${atual === 1 ? inativo : ativo}`}
                disabled={atual === 1}
                onClick={() => aoMudar(atual - 1)}
              >
                <span aria-hidden="true">‹</span> Anterior
              </button>
            </li>

            {paginasVisiveis(atual, totalPaginas).map((item, i) => (
              <li key={item === 'reticencias' ? `r${i}` : item} className="hidden sm:block">
                {item === 'reticencias'
                  ? <span className="inline-flex min-h-11 min-w-6 items-center justify-center text-tinta2" aria-hidden="true">…</span>
                  : item === atual
                    ? (
                      <button type="button" aria-current="page" className={`${alvo} ${acento[area].preenchido} border-transparent text-white`}>
                        <span className="sr-only">Página </span>{item}
                      </button>
                    )
                    : (
                      <button type="button" className={`${alvo} ${ativo}`} onClick={() => aoMudar(item)}>
                        <span className="sr-only">Página </span>{item}
                      </button>
                    )}
              </li>
            ))}

            <li className="sm:hidden">
              <span className="inline-flex min-h-11 items-center px-1 text-[13.5px] font-bold tabular-nums">
                Página {atual} de {totalPaginas}
              </span>
            </li>

            <li>
              <button
                type="button"
                className={`${alvo} ${atual === totalPaginas ? inativo : ativo}`}
                disabled={atual === totalPaginas}
                onClick={() => aoMudar(atual + 1)}
              >
                Próxima <span aria-hidden="true">›</span>
              </button>
            </li>
          </ul>
        </nav>
      )}
    </div>
  )
}
