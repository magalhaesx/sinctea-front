import type { ReactNode } from 'react'
import { acento, type Area } from './area'

/** Altura minima de 44px: o dobro dos 24px exigidos pelo criterio 2.5.8 da
 *  WCAG 2.2. Terapeuta e professor operam com atencao dividida. */
export function Botao({
  children, onClick, variante = 'primaria', area = 'cli', type = 'button',
  className = '', ...resto
}: {
  children: ReactNode
  onClick?: () => void
  variante?: 'primaria' | 'secundaria' | 'grande'
  area?: Area
  type?: 'button' | 'submit'
  className?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const a = acento[area]
  const base =
    'font-bold rounded-lg min-h-11 inline-flex items-center justify-center gap-2 cursor-pointer border-2 transition-colors'
  const estilo =
    variante === 'primaria'
      ? `${base} px-4 py-2.5 ${a.preenchido} ${a.preenchidoHover} text-white border-transparent`
      : variante === 'secundaria'
        ? `${base} px-4 py-2.5 bg-sup ${a.texto} border-current hover:bg-sup2`
        : `${base} w-full px-4 py-4 text-left justify-start bg-sup border-linha text-tinta aria-pressed:border-current`
  return (
    <button type={type} onClick={onClick} className={`${estilo} ${className}`} {...resto}>
      {children}
    </button>
  )
}
