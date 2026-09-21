import { useId, useState } from 'react'
import { Botao } from '../ui/Botao'

/**
 * Barras horizontais: o rotulo e nome de pessoa, e nome comprido cabe deitado.
 * Serie unica, entao sem legenda — o titulo nomeia a serie e o periodo
 * (docs/02, secao 5).
 *
 * Sem grade: com poucas barras cada valor esta escrito na ponta da sua, e uma
 * grade so competiria com o dado. Nome e valor sao texto de verdade; a barra e
 * a mancha que compara, e por isso fica aria-hidden.
 */

export interface BarraProfissional {
  id: string
  nome: string
  sessoes: number
}

/**
 * A maior barra para em 88% da pista, para o numero caber depois dela. Todas
 * encolhem pelo mesmo fator, entao a comparacao entre elas nao muda.
 */
const LARGURA_MAXIMA = 88

export function BarrasProfissional({ titulo, itens }: {
  titulo: string
  itens: BarraProfissional[]
}) {
  const [tabela, setTabela] = useState(false)
  const idTitulo = useId()
  const maior = Math.max(1, ...itens.map((i) => i.sessoes))

  return (
    <figure className="m-0 flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={idTitulo} className="text-base font-bold">{titulo}</h3>
        <Botao variante="secundaria" area="cli" aria-pressed={tabela} onClick={() => setTabela((v) => !v)}>
          {tabela ? 'Ver como gráfico' : 'Ver como tabela'}
        </Botao>
      </figcaption>

      {tabela ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[15px]">
            <caption className="sr-only">{titulo}</caption>
            <thead>
              <tr>
                <th scope="col" className="bg-sup2 px-3 py-2 text-left text-[13.5px] text-tinta2">Profissional</th>
                <th scope="col" className="bg-sup2 px-3 py-2 text-right text-[13.5px] text-tinta2">Sessões</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((i) => (
                <tr key={i.id} className="border-t border-linha">
                  <th scope="row" className="px-3 py-2 text-left font-bold">{i.nome}</th>
                  {/* Em coluna de tabela o algarismo tabular e o certo: os
                      numeros se alinham uns sob os outros. */}
                  <td className="px-3 py-2 text-right tabular-nums">{i.sessoes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // Ate sm, o nome fica sobre a barra; a partir dali, a esquerda dela,
        // com as barras a 2px uma da outra.
        <ul className="flex flex-col gap-2 sm:gap-0.5">
          {itens.map((i) => (
            <li key={i.id} className="sm:flex sm:items-center sm:gap-3">
              <span className="block text-[15px] leading-snug sm:w-48 sm:shrink-0 sm:text-right">
                {i.nome}
              </span>
              <span className="mt-1 flex min-w-0 flex-1 items-center gap-2 sm:mt-0">
                <span
                  aria-hidden="true"
                  className="block h-3 shrink-0 rounded-r-[4px] bg-cli"
                  style={{ width: `${(i.sessoes / maior) * LARGURA_MAXIMA}%` }}
                />
                {/* Valor na cor de tinta, nunca na cor da serie. */}
                <span className="shrink-0 text-sm font-bold text-tinta">{i.sessoes}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  )
}
