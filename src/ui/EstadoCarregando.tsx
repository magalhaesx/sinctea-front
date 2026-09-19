/**
 * Estado de carregamento: esqueleto com a forma do conteudo que vai chegar,
 * nunca um giro generico no meio da tela (docs/02, secao 4).
 *
 * Os blocos sao decorativos (aria-hidden). O leitor de tela recebe apenas o
 * rotulo, anunciado uma vez pela regiao de status. A pulsacao respeita
 * prefers-reduced-motion e a preferencia "Reduzir animacao" do produto,
 * pelas regras globais de index.css.
 */

/** Bloco basico. Use para compor formas que as predefinidas nao cobrem. */
export function Esqueleto({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-md bg-sup2 ${className}`} />
}

// Larguras variadas: linhas de mesmo tamanho parecem padrao, nao conteudo.
const LARGURAS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-5/6', 'w-2/5']
const largura = (i: number) => LARGURAS[i % LARGURAS.length]

type Forma =
  | { forma: 'tabela'; linhas?: number; colunas?: number }
  | { forma: 'lista'; linhas?: number }
  | { forma: 'cartoes'; quantidade?: number }
  | { forma: 'texto'; linhas?: number }

export type PropsEstadoCarregando = Forma & {
  /** O que esta carregando, para o leitor de tela: "Carregando a lista de pacientes". */
  rotulo: string
}

export function EstadoCarregando(props: PropsEstadoCarregando) {
  return (
    <div role="status" className="min-w-0">
      <span className="sr-only">{props.rotulo}</span>
      <div aria-hidden="true">{desenhar(props)}</div>
    </div>
  )
}

function desenhar(props: Forma) {
  switch (props.forma) {
    case 'tabela': {
      const linhas = props.linhas ?? 5
      const colunas = props.colunas ?? 4
      const grade = { gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }
      return (
        <div className="overflow-hidden rounded-xl border border-linha bg-sup">
          <div className="px-3 py-3"><Esqueleto className="h-4 w-48 max-w-full" /></div>
          <div className="grid gap-4 bg-sup2 px-3 py-3" style={grade}>
            {Array.from({ length: colunas }, (_, c) => (
              <span key={c} className="block h-3.5 w-2/3 rounded-md bg-linha" />
            ))}
          </div>
          {Array.from({ length: linhas }, (_, l) => (
            <div key={l} className="grid gap-4 border-t border-linha px-3 py-3.5" style={grade}>
              {Array.from({ length: colunas }, (_, c) => (
                <Esqueleto key={c} className={`h-4 ${c === 0 ? 'w-5/6' : largura(l + c)}`} />
              ))}
            </div>
          ))}
        </div>
      )
    }

    case 'lista':
      return (
        <ul className="flex flex-col gap-2">
          {Array.from({ length: props.linhas ?? 4 }, (_, i) => (
            <li key={i} className="flex min-h-16 items-center gap-3 rounded-xl border border-linha bg-sup px-4 py-3">
              <Esqueleto className="h-9 w-9 flex-none rounded-lg" />
              <span className="flex flex-1 flex-col gap-2">
                <Esqueleto className={`h-4 ${largura(i)}`} />
                <Esqueleto className={`h-3 ${largura(i + 2)}`} />
              </span>
            </li>
          ))}
        </ul>
      )

    case 'cartoes':
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: props.quantidade ?? 2 }, (_, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-xl border border-linha bg-sup p-4 sm:p-5">
              <Esqueleto className="h-5 w-1/2" />
              <Esqueleto className="h-3.5 w-full" />
              <Esqueleto className={`h-3.5 ${largura(i)}`} />
              <Esqueleto className="mt-1 h-2.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      )

    case 'texto': {
      const linhas = props.linhas ?? 3
      return (
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: linhas }, (_, i) => (
            <Esqueleto key={i} className={`h-4 ${i === linhas - 1 ? 'w-2/5' : 'w-full'}`} />
          ))}
        </div>
      )
    }
  }
}
