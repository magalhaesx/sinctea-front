import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { acento, type Area } from './tokens'

export type VarianteBotao = 'primaria' | 'secundaria' | 'grande'

/** As classes das variantes, compartilhadas por Botao e BotaoLink. */
export function classesDoBotao(variante: VarianteBotao, area: Area): string {
  const a = acento[area]
  const base =
    'font-bold rounded-lg min-h-11 inline-flex items-center justify-center gap-2 cursor-pointer border-2 transition-colors'
  return variante === 'primaria'
    ? `${base} px-4 py-2.5 ${a.preenchido} ${a.preenchidoHover} text-white border-transparent`
    : variante === 'secundaria'
      ? `${base} px-4 py-2.5 bg-sup ${a.texto} border-current hover:bg-sup2`
      : `${base} w-full px-4 py-4 text-left justify-start bg-sup border-linha text-tinta aria-pressed:border-current`
}

/** Altura minima de 44px: o dobro dos 24px exigidos pelo criterio 2.5.8 da
 *  WCAG 2.2. Terapeuta e professor operam com atencao dividida. */
export function Botao({
  children, onClick, variante = 'primaria', area = 'cli', type = 'button',
  className = '', ...resto
}: {
  children: ReactNode
  onClick?: () => void
  variante?: VarianteBotao
  area?: Area
  type?: 'button' | 'submit'
  className?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`${classesDoBotao(variante, area)} ${className}`}
      {...resto}
    >
      {children}
    </button>
  )
}

/**
 * Acao que NAVEGA: e um link, com a aparencia de botao.
 *
 * Envolver um Botao num Link produz `<a><button>`: marcacao invalida, dois
 * pontos de tabulacao para a mesma acao e semantica dupla para o leitor de
 * tela. Quando a acao muda de tela, use este componente.
 */
export function BotaoLink({
  para, children, variante = 'primaria', area = 'cli', className = '',
}: {
  para: string
  children: ReactNode
  variante?: VarianteBotao
  area?: Area
  className?: string
}) {
  return (
    <Link to={para} className={`${classesDoBotao(variante, area)} ${className}`}>
      {children}
    </Link>
  )
}
