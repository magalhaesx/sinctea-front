import type { ReactNode } from 'react'

export function Titulo({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold leading-tight text-balance">{children}</h1>
      {sub && <p className="text-tinta2 mt-1">{sub}</p>}
    </div>
  )
}
