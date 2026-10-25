import type { ReactNode } from 'react'

/** Todo campo tem rotulo associado e instrucao contextual.
 *  WCAG 3.3.2 / e-MAG 6.2 e 6.5. */
export function Campo({ id, rotulo, dica, className = '', children }: {
  /** `className`: o lugar do campo na grade do formulario (item 11). */
  id: string; rotulo: string; dica?: string; className?: string; children: ReactNode
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="font-bold text-sm">{rotulo}</label>
      {dica && <span id={`${id}-dica`} className="max-w-[65ch] text-sm text-tinta2">{dica}</span>}
      {children}
    </div>
  )
}
