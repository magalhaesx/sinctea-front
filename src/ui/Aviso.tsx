import type { ReactNode } from 'react'
import type { Tom } from './Etiqueta'

export function Aviso({ tom = 'neutro', titulo, children }: {
  tom?: Tom; titulo?: string; children: ReactNode
}) {
  const borda = { ok: 'border-l-ok bg-ok-sup', at: 'border-l-at bg-at-sup', cr: 'border-l-cr bg-cr-sup', neutro: 'border-l-linha bg-sup' }[tom]
  return (
    <div className={`rounded-xl border border-linha border-l-4 p-4 ${borda}`}>
      {titulo && <h3 className="font-bold text-base mb-1">{titulo}</h3>}
      <div className="text-sm text-tinta2">{children}</div>
    </div>
  )
}
