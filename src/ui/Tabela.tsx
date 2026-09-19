import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

/**
 * Tabela de dados (docs/02, secao 4): `caption`, `th` com `scope` e rolagem
 * horizontal em recipiente proprio — a tabela rola sozinha, sem empurrar a
 * pagina (item 10 do piso de acessibilidade: sem rolagem horizontal a 400px).
 *
 * Quando a tabela nao cabe, o recipiente vira uma regiao nomeada e focalizavel,
 * para que quem usa teclado tambem consiga rolar (WCAG 2.1.1), e aparece uma
 * dica em texto.
 *
 * A tabela nao desenha estado vazio: com zero linhas, a tela mostra EstadoVazio.
 */

export interface Coluna<T> {
  id: string
  titulo: ReactNode
  celula: (linha: T) => ReactNode
  /** Numeros: alinhados a direita, com algarismos tabulares. */
  numerica?: boolean
  /** Permite quebra de linha em textos longos. Padrao: sem quebra — a tabela rola. */
  quebrar?: boolean
}

export interface PropsTabela<T> {
  /** Vira o `caption`: diz o que a tabela mostra. */
  legenda: ReactNode
  /** Esconde a legenda visualmente, mantendo-a para leitor de tela. */
  legendaOculta?: boolean
  colunas: Coluna<T>[]
  linhas: T[]
  chave: (linha: T) => string
  /** Coluna que identifica cada linha, marcada como `th scope="row"`. Padrao: a primeira. */
  colunaCabecalho?: number | null
  /** Nota de rodape (fonte, periodo, observacao). */
  nota?: ReactNode
  /** Mantem as linhas atuais visiveis enquanto a proxima pagina carrega. */
  atualizando?: boolean
}

export function Tabela<T>({
  legenda, legendaOculta = false, colunas, linhas, chave, colunaCabecalho = 0, nota,
  atualizando = false,
}: PropsTabela<T>) {
  const idLegenda = useId()
  const idDica = useId()
  const recipiente = useRef<HTMLDivElement>(null)
  const [transborda, setTransborda] = useState(false)

  useEffect(() => {
    const el = recipiente.current
    if (!el) return
    const medir = () => setTransborda(el.scrollWidth > el.clientWidth + 1)
    medir()
    if (typeof ResizeObserver === 'undefined') return
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    if (el.firstElementChild) observador.observe(el.firstElementChild)
    return () => observador.disconnect()
  }, [linhas, colunas])

  const alinhamento = (c: Coluna<T>) => (c.numerica ? 'text-right tabular-nums' : 'text-left')
  const quebra = (c: Coluna<T>) => (c.quebrar ? 'min-w-48' : 'whitespace-nowrap')

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-1.5">
      <div
        ref={recipiente}
        className="min-w-0 max-w-full overflow-x-auto rounded-xl border border-linha bg-sup"
        {...(transborda
          ? { role: 'region', 'aria-labelledby': idLegenda, 'aria-describedby': idDica, tabIndex: 0 }
          : {})}
      >
        <table
          className={`w-full border-collapse text-[15px] transition-opacity ${atualizando ? 'opacity-60' : ''}`}
          aria-busy={atualizando || undefined}
        >
          <caption
            id={idLegenda}
            className={legendaOculta ? 'sr-only' : 'px-3 py-3 text-left text-[15px] font-bold'}
          >
            {legenda}
          </caption>
          <thead>
            <tr>
              {colunas.map((c) => (
                <th
                  key={c.id}
                  scope="col"
                  className={`bg-sup2 px-3 py-2.5 text-[13.5px] font-bold whitespace-nowrap text-tinta2 ${alinhamento(c)}`}
                >
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={chave(linha)} className="border-t border-linha">
                {colunas.map((c, i) => {
                  const classe = `px-3 py-3 align-top ${alinhamento(c)} ${quebra(c)}`
                  return i === colunaCabecalho
                    ? <th key={c.id} scope="row" className={`${classe} font-bold`}>{c.celula(linha)}</th>
                    : <td key={c.id} className={classe}>{c.celula(linha)}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {transborda && (
        <p id={idDica} className="text-[13.5px] text-tinta2">
          <span aria-hidden="true">↔ </span>Role para o lado para ver todas as colunas.
        </p>
      )}
      {nota && <p className="text-[11px] text-tinta3">{nota}</p>}
    </div>
  )
}
