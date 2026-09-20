import { useId, useState } from 'react'
import { Botao } from '../ui/Botao'

/**
 * Serie unica: nao leva legenda — o titulo nomeia a serie (docs/02, secao 5).
 * Grade recessiva, marcas finas e rotulo direto so na ultima sessao.
 *
 * Todo grafico tem alternativa em tabela, acionavel por botao: e o criterio
 * 1.1.1 da WCAG e as recomendacoes 3.9 e 3.10 do e-MAG.
 */

export interface PontoSessao {
  /** Rotulo curto do eixo: "S7". */
  rotulo: string
  /** Data da sessao, para a tabela. */
  data: string
  /** Percentual de tentativas independentes, de 0 a 100. */
  valor: number
}

const L = 46, R = 640, T = 16, B = 184

export function LinhaEvolucao({ titulo, pontos, criterio }: {
  titulo: string
  pontos: PontoSessao[]
  criterio: number
}) {
  const [tabela, setTabela] = useState(false)
  const idTitulo = useId()

  const y = (v: number) => B - (v / 100) * (B - T)
  const x = (i: number) => pontos.length <= 1
    ? (L + R) / 2
    : L + (i / (pontos.length - 1)) * (R - L)

  const linha = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.valor).toFixed(1)}`).join(' ')
  const ultimo = pontos[pontos.length - 1]

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
                <th scope="col" className="bg-sup2 px-3 py-2 text-left text-[13.5px] text-tinta2">Sessão</th>
                <th scope="col" className="bg-sup2 px-3 py-2 text-left text-[13.5px] text-tinta2">Data</th>
                <th scope="col" className="bg-sup2 px-3 py-2 text-right text-[13.5px] text-tinta2">Tentativas independentes</th>
              </tr>
            </thead>
            <tbody>
              {pontos.map((p) => (
                <tr key={p.rotulo} className="border-t border-linha">
                  <th scope="row" className="px-3 py-2 text-left font-bold">{p.rotulo}</th>
                  <td className="px-3 py-2">{new Date(p.data).toLocaleDateString('pt-BR')}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.valor}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${R + 16} 210`}
          className="w-full"
          role="img"
          aria-labelledby={idTitulo}
        >
          {/* Grade recessiva: o dado vem na frente. */}
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line x1={L} y1={y(v)} x2={R} y2={y(v)} stroke="#d2dfe0" strokeWidth="1" />
              <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#4e656b">{v}%</text>
            </g>
          ))}

          {/* Linha do criterio de dominio, em cor de estado. */}
          <line x1={L} y1={y(criterio)} x2={R} y2={y(criterio)} stroke="#8f6000" strokeWidth="2" strokeDasharray="6 4" />
          <text x={L + 4} y={y(criterio) - 7} fontSize="11" fontWeight="700" fill="#8f6000">
            critério de domínio · {criterio}%
          </text>

          <path d={linha} fill="none" stroke="#00a2af" strokeWidth="2.5" strokeLinejoin="round" />
          {pontos.map((p, i) => (
            <circle key={p.rotulo} cx={x(i)} cy={y(p.valor)} r={i === pontos.length - 1 ? 6 : 4}
              fill="#0a6c75" stroke="#fff" strokeWidth="2" />
          ))}

          {/* Rotulo direto so onde importa: o ultimo ponto. */}
          {ultimo && (
            <text x={Math.min(x(pontos.length - 1), R - 30)} y={y(ultimo.valor) - 12}
              textAnchor="middle" fontSize="13" fontWeight="700" fill="#0a6c75">
              {ultimo.valor}%
            </text>
          )}

          {pontos.map((p, i) => (
            <text key={p.rotulo} x={x(i)} y={B + 19} textAnchor="middle" fontSize="11" fill="#4e656b">
              {p.rotulo}
            </text>
          ))}
          <text x={(L + R) / 2} y={B + 36} textAnchor="middle" fontSize="11.5" fill="#4e656b">Sessão</text>
        </svg>
      )}
    </figure>
  )
}
