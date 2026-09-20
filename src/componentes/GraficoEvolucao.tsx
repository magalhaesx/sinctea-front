import { useState } from 'react'
import type { Sessao } from '../tipos/dominio'
import { Botao } from './ui'

/**
 * Serie unica: nao usa legenda (o titulo nomeia a serie) e traz linha de
 * referencia do criterio de dominio. Toda representacao grafica tem
 * alternativa em tabela — WCAG 1.1.1 / e-MAG 3.9 e 3.10.
 */
export function GraficoEvolucao({ sessoes, criterio }: { sessoes: Sessao[]; criterio: number }) {
  const [tabela, setTabela] = useState(false)

  const L = 48, R = 508, T = 20, B = 190
  const x = (i: number) => L + (i * (R - L - 8)) / (sessoes.length - 1)
  const y = (v: number) => B - (v / 100) * (B - T)
  const pontos = sessoes.map((s, i) => ({ ...s, cx: x(i), cy: y(s.percentualIndependente) }))
  const linha = pontos.map((p) => `${p.cx.toFixed(1)} ${p.cy.toFixed(1)}`).join(' L ')
  const ultimo = pontos[pontos.length - 1]

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-base font-bold">Evolução por sessão</h2>
        <Botao variante="secundaria" onClick={() => setTabela((t) => !t)} aria-pressed={tabela}>
          {tabela ? 'Ver como gráfico' : 'Ver como tabela'}
        </Botao>
      </div>

      {!tabela ? (
        <svg viewBox="0 0 520 226" width="100%" role="img" aria-labelledby="g-tit g-desc" className="mx-auto block w-full max-w-[660px]">
          <title id="g-tit">Percentual de tentativas independentes por sessão</title>
          <desc id="g-desc">
            Sobe de {sessoes[0].percentualIndependente}% na sessão 1 para{' '}
            {ultimo.percentualIndependente}% na sessão {ultimo.numero}, cruzando o critério de
            domínio de {criterio}% a partir da sessão 9.
          </desc>
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line x1={L} y1={y(v)} x2={R} y2={y(v)} stroke={v === 0 ? '#d2dfe0' : '#e9f0f0'} strokeWidth="1" />
              <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#4e656b">{v}%</text>
            </g>
          ))}
          <line x1={L} y1={y(criterio)} x2={R} y2={y(criterio)} stroke="#9a6800" strokeWidth="2" strokeDasharray="6 4" />
          <text x={L + 4} y={y(criterio) - 7} textAnchor="start" fontSize="11" fontWeight="700" fill="#9a6800">
            critério de domínio · {criterio}%
          </text>
          <path d={`M ${linha} L ${ultimo.cx.toFixed(1)} ${B} L ${L} ${B} Z`} fill="#00a2af" fillOpacity="0.1" />
          <path d={`M ${linha}`} fill="none" stroke="#0a6c75" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {pontos.map((p, i) => (
            <circle key={p.id} cx={p.cx} cy={p.cy} r={i === pontos.length - 1 ? 6.5 : 4.5} fill="#0a6c75" stroke="#fff" strokeWidth="2">
              <title>Sessão {p.numero}: {p.percentualIndependente}%</title>
            </circle>
          ))}
          <text x={ultimo.cx - 6} y={ultimo.cy - 12} textAnchor="end" fontSize="13" fontWeight="700" fill="#0a6c75">
            {ultimo.percentualIndependente}%
          </text>
          {pontos.filter((_, i) => i % 2 === 0 || i === pontos.length - 1).map((p) => (
            <text key={p.id} x={p.cx} y={B + 19} textAnchor="middle" fontSize="11" fill="#4e656b">S{p.numero}</text>
          ))}
          <text x={(L + R) / 2} y={B + 36} textAnchor="middle" fontSize="11.5" fill="#4e656b">Sessão</text>
        </svg>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="text-left font-bold pb-2">
              Percentual de tentativas independentes por sessão — mesmos dados do gráfico
            </caption>
            <thead>
              <tr>
                {['Sessão', 'Data', 'Independentes', 'Atingiu o critério'].map((c) => (
                  <th key={c} scope="col" className="border border-linha bg-sup2 px-2.5 py-1.5 text-left">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessoes.map((s) => (
                <tr key={s.id}>
                  <th scope="row" className="border border-linha px-2.5 py-1.5 text-left tabular-nums">{s.numero}</th>
                  <td className="border border-linha px-2.5 py-1.5 tabular-nums">{s.data}</td>
                  <td className="border border-linha px-2.5 py-1.5 tabular-nums">{s.percentualIndependente}%</td>
                  <td className="border border-linha px-2.5 py-1.5">
                    {s.percentualIndependente >= criterio ? 'Sim' : 'Não'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
