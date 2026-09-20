import { useId, useState } from 'react'
import { Botao } from '../ui/Botao'
import type { Desempenho } from '../servicos'

/**
 * Comparacao entre clinica, casa e escola.
 *
 * As tres medidas tem naturezas diferentes: percentual de tentativas na
 * clinica, escolha em tres niveis em casa, intensidade de 1 a 5 na escola.
 * Por isso sao TRES FAIXAS PARALELAS, cada uma com a sua propria escala
 * rotulada, alinhadas na mesma linha do tempo.
 *
 * NUNCA a mesma escala, nunca media, indice combinado ou pontuacao geral
 * entre elas, nunca dois eixos verticais (docs/02, secao 5). A leitura que
 * interessa e "sobe junto ou diverge", nao "qual e maior".
 *
 * Cada faixa usa uma MARCA diferente — linha na clinica, quadrado em casa,
 * triangulo na escola —, e nao so uma cor diferente: a forma faz o olho parar
 * de comparar altura entre faixas, que e exatamente o erro a impedir.
 */

export interface PontoClinica { data: string; valor: number }
export interface PontoCasa { data: string; desempenho: Desempenho }
export interface PontoEscola { data: string; intensidade: number }

const L = 128, R = 640, ALTURA = 116, T = 16, B = 92

const NIVEL_CASA: Record<Desempenho, number> = { NAO_QUIS: 1, COM_AJUDA: 2, SOZINHO: 3 }
const ROTULO_CASA: Record<Desempenho, string> = {
  SOZINHO: 'Sozinho', COM_AJUDA: 'Com ajuda', NAO_QUIS: 'Não quis',
}

const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

function Faixa({ titulo, descricao, children, rotulos, aoTempo }: {
  titulo: string
  descricao: string
  rotulos: { texto: string; y: number }[]
  aoTempo?: { inicio: string; fim: string }
  children: React.ReactNode
}) {
  const id = useId()
  return (
    <figure className="m-0 flex flex-col gap-1.5">
      <figcaption>
        <h4 id={id} className="text-[15px] font-bold">{titulo}</h4>
        <p className="text-sm text-tinta2">{descricao}</p>
      </figcaption>
      <svg viewBox={`0 0 ${R + 16} ${ALTURA + (aoTempo ? 26 : 0)}`} className="w-full" role="img" aria-labelledby={id}>
        <line x1={L} y1={B} x2={R} y2={B} stroke="#d2dfe0" strokeWidth="1" />
        <line x1={L} y1={T} x2={R} y2={T} stroke="#d2dfe0" strokeWidth="1" />
        {/* Cada faixa traz a propria escala, rotulada. */}
        {rotulos.map((r) => (
          <text key={r.texto} x={L - 10} y={r.y + 4} textAnchor="end" fontSize="11" fill="#4e656b">{r.texto}</text>
        ))}
        {children}
        {aoTempo && (
          <>
            <text x={L} y={ALTURA + 18} fontSize="11" fill="#4e656b">{dia(aoTempo.inicio)}</text>
            <text x={R} y={ALTURA + 18} textAnchor="end" fontSize="11" fill="#4e656b">{dia(aoTempo.fim)}</text>
            <text x={(L + R) / 2} y={ALTURA + 18} textAnchor="middle" fontSize="11" fill="#4e656b">
              mesma linha do tempo nas três faixas
            </text>
          </>
        )}
      </svg>
    </figure>
  )
}

export function FaixasContexto({ clinica, casa, escola }: {
  clinica: PontoClinica[]
  casa: PontoCasa[]
  escola: PontoEscola[]
}) {
  const [tabela, setTabela] = useState(false)

  const datas = [...clinica, ...casa, ...escola].map((p) => Date.parse(p.data))
  const inicio = Math.min(...datas)
  const fim = Math.max(...datas)
  const x = (iso: string) => fim === inicio
    ? (L + R) / 2
    : L + ((Date.parse(iso) - inicio) / (fim - inicio)) * (R - L)

  /** Cada faixa tem a sua escala: y so faz sentido dentro dela. */
  const yPercentual = (v: number) => B - (v / 100) * (B - T)
  const yNivel = (nivel: number, niveis: number) => B - ((nivel - 1) / (niveis - 1)) * (B - T)

  const linhaClinica = clinica
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.data).toFixed(1)} ${yPercentual(p.valor).toFixed(1)}`)
    .join(' ')

  const linhasDaTabela = [...new Set([...clinica, ...casa, ...escola].map((p) => p.data))]
    .sort()
    .map((data) => ({
      data,
      clinica: clinica.find((p) => p.data === data),
      casa: casa.find((p) => p.data === data),
      escola: escola.find((p) => p.data === data),
    }))

  return (
    <div className="flex flex-col gap-4">
      <p>
        <Botao variante="secundaria" area="cli" aria-pressed={tabela} onClick={() => setTabela((v) => !v)}>
          {tabela ? 'Ver como faixas' : 'Ver como tabela'}
        </Botao>
      </p>

      {tabela ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[15px]">
            <caption className="px-3 py-2 text-left text-[15px] font-bold">
              Registros dos três contextos, cada um na sua própria unidade
            </caption>
            <thead>
              <tr>
                <th scope="col" className="bg-sup2 px-3 py-2 text-left text-[13.5px] text-tinta2">Data</th>
                <th scope="col" className="bg-sup2 px-3 py-2 text-left text-[13.5px] text-tinta2">Clínica (% de tentativas)</th>
                <th scope="col" className="bg-sup2 px-3 py-2 text-left text-[13.5px] text-tinta2">Casa (como foi)</th>
                <th scope="col" className="bg-sup2 px-3 py-2 text-left text-[13.5px] text-tinta2">Escola (intensidade 1 a 5)</th>
              </tr>
            </thead>
            <tbody>
              {linhasDaTabela.map((l) => (
                <tr key={l.data} className="border-t border-linha">
                  <th scope="row" className="px-3 py-2 text-left font-bold whitespace-nowrap">
                    {new Date(l.data).toLocaleDateString('pt-BR')}
                  </th>
                  <td className="px-3 py-2 tabular-nums">{l.clinica ? `${l.clinica.valor}%` : '—'}</td>
                  <td className="px-3 py-2">{l.casa ? ROTULO_CASA[l.casa.desempenho] : '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{l.escola ? `${l.escola.intensidade} de 5` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-tinta3">
            Cada coluna está na unidade do seu contexto. Não há média nem pontuação entre elas.
          </p>
        </div>
      ) : (
        <>
          <Faixa
            titulo="Independência na clínica — percentual de tentativas por sessão"
            descricao="Escala de 0 a 100% das tentativas do objetivo."
            rotulos={[{ texto: '100%', y: yPercentual(100) }, { texto: '0%', y: yPercentual(0) }]}
          >
            <path d={linhaClinica} fill="none" stroke="#00a2af" strokeWidth="2.5" strokeLinejoin="round" />
            {clinica.map((p) => (
              <circle key={p.data} cx={x(p.data)} cy={yPercentual(p.valor)} r="4" fill="#0a6c75" />
            ))}
          </Faixa>

          <Faixa
            titulo="Atividades em casa — como foi cada execução"
            descricao="Escala de três níveis: não quis, com ajuda, sozinho."
            rotulos={[
              { texto: 'Sozinho', y: yNivel(3, 3) },
              { texto: 'Com ajuda', y: yNivel(2, 3) },
              { texto: 'Não quis', y: yNivel(1, 3) },
            ]}
          >
            {/* Marca quadrada: forma diferente impede comparar altura entre faixas. */}
            {casa.map((p) => (
              <rect key={p.data} x={x(p.data) - 5} y={yNivel(NIVEL_CASA[p.desempenho], 3) - 5}
                width="10" height="10" fill="#c8402e" />
            ))}
          </Faixa>

          {/*
            A faixa da escola NAO e deste objetivo: OcorrenciaEscolar e do
            aluno, nao do objetivo. O titulo diz isso, para a tela nao afirmar
            uma correlacao que o modelo nao sustenta.
          */}
          <Faixa
            titulo="Ocorrências registradas pela escola — do aluno, não deste objetivo"
            descricao="Escala de intensidade de 1 a 5, por ocorrência relatada."
            rotulos={[
              { texto: '5 · intensa', y: yNivel(5, 5) },
              { texto: '3', y: yNivel(3, 5) },
              { texto: '1 · leve', y: yNivel(1, 5) },
            ]}
            aoTempo={{ inicio: new Date(inicio).toISOString(), fim: new Date(fim).toISOString() }}
          >
            {/* Marca triangular. */}
            {escola.map((p) => {
              const cx = x(p.data)
              const cy = yNivel(p.intensidade, 5)
              return (
                <polygon key={p.data} points={`${cx},${cy - 6} ${cx + 6},${cy + 5} ${cx - 6},${cy + 5}`}
                  fill="#bf8506" />
              )
            })}
          </Faixa>

          <p className="max-w-[65ch] text-sm text-tinta2">
            As três medidas têm naturezas diferentes e cada faixa tem a sua própria escala. A
            leitura que interessa é se as faixas sobem juntas ou divergem — nunca qual delas é
            maior.
          </p>
        </>
      )}
    </div>
  )
}
