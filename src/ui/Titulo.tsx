import type { ReactNode } from 'react'

export function Titulo({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold leading-tight text-balance">{children}</h1>
      {/* Texto corrido: no maximo 65 caracteres por linha, em qualquer largura (item 11). */}
      {sub && <p className="text-tinta2 mt-1 max-w-[65ch]">{sub}</p>}
    </div>
  )
}
