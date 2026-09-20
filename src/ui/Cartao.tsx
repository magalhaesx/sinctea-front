import type { ReactNode } from 'react'

export function Cartao({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-sup border border-linha rounded-xl p-4 sm:p-5 ${className}`}>
      {children}
    </div>
  )
}
