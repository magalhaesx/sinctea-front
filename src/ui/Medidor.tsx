import { acento, type Area } from './tokens'

/**
 * A barra e a mesma nas tres areas; o que muda e como o valor e dito.
 *
 * Com `emPalavras`, o numero sai dos DOIS canais: do texto ao lado e da
 * exposicao acessivel, que deixa de ser `meter` com `aria-valuenow` e passa a
 * `img` rotulada pela frase. Na area da familia, percentual cru nao comunica —
 * "6 ou 7 de cada 10 vezes" comunica —, e nao adianta tirar da tela e deixar no
 * leitor de tela.
 */
export function Medidor({ valor, area = 'cli', rotulo, emPalavras }: {
  valor: number
  area?: Area
  rotulo: string
  /** Quando vier, substitui o percentual no texto e no leitor de tela. */
  emPalavras?: string
}) {
  const exposicao = emPalavras
    ? { role: 'img' as const, 'aria-label': `${rotulo}: ${emPalavras}` }
    : {
      role: 'meter' as const,
      'aria-valuenow': valor,
      'aria-valuemin': 0,
      'aria-valuemax': 100,
      'aria-label': rotulo,
    }
  return (
    <div className="flex items-center gap-3">
      <div className="h-2.5 flex-1 min-w-24 rounded-full bg-sup2 overflow-hidden" {...exposicao}>
        <div className={`h-full ${acento[area].bg}`} style={{ width: `${valor}%` }} />
      </div>
      {emPalavras
        ? <span className="text-sm font-bold">{emPalavras}</span>
        : <span className="font-bold tabular-nums">{valor}%</span>}
    </div>
  )
}
