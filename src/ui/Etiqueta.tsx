import type { ReactNode } from 'react'

export type Tom = 'ok' | 'at' | 'cr' | 'neutro'

const tons: Record<Tom, string> = {
  ok: 'text-ok bg-ok-sup border-ok',
  at: 'text-at bg-at-sup border-at',
  cr: 'text-cr bg-cr-sup border-cr',
  neutro: 'text-tinta2 bg-sup2 border-linha',
}

/** Nenhum estado depende apenas de cor: sempre simbolo + texto.
 *  WCAG 1.4.1 / e-MAG 4.2. */
export function Etiqueta({ tom = 'neutro', simbolo, children }: {
  tom?: Tom; simbolo?: string; children: ReactNode
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${tons[tom]}`}>
      {simbolo && <span aria-hidden="true">{simbolo}</span>}
      {children}
    </span>
  )
}
