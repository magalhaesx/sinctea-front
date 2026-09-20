import type { ReactNode } from 'react'

/** Todo campo tem rotulo associado e instrucao contextual.
 *  WCAG 3.3.2 / e-MAG 6.2 e 6.5. */
export function Campo({ id, rotulo, dica, children }: {
  id: string; rotulo: string; dica?: string; children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-bold text-sm">{rotulo}</label>
      {dica && <span id={`${id}-dica`} className="text-sm text-tinta2">{dica}</span>}
      {children}
    </div>
  )
}
