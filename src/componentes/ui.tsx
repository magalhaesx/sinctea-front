import type { ReactNode } from 'react'

export type Area = 'cli' | 'fam' | 'esc'

export const acento: Record<Area, { bg: string; texto: string; borda: string; sup: string }> = {
  cli: { bg: 'bg-cli', texto: 'text-cli-ink', borda: 'border-cli', sup: 'bg-cli-sup' },
  fam: { bg: 'bg-fam', texto: 'text-fam-ink', borda: 'border-fam', sup: 'bg-fam-sup' },
  esc: { bg: 'bg-esc', texto: 'text-esc-ink', borda: 'border-esc', sup: 'bg-esc-sup' },
}

export function Cartao({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-sup border border-linha rounded-xl p-4 sm:p-5 ${className}`}>
      {children}
    </div>
  )
}

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
      ? `${base} px-4 py-2.5 ${a.bg} text-white border-transparent hover:brightness-90`
      : variante === 'secundaria'
        ? `${base} px-4 py-2.5 bg-sup ${a.texto} border-current hover:bg-sup2`
        : `${base} w-full px-4 py-4 text-left justify-start bg-sup border-linha text-tinta aria-pressed:border-current`
  return (
    <button type={type} onClick={onClick} className={`${estilo} ${className}`} {...resto}>
      {children}
    </button>
  )
}

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

export function Medidor({ valor, area = 'cli', rotulo }: { valor: number; area?: Area; rotulo: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-2.5 flex-1 min-w-24 rounded-full bg-sup2 overflow-hidden"
        role="meter"
        aria-valuenow={valor}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={rotulo}
      >
        <div className={`h-full ${acento[area].bg}`} style={{ width: `${valor}%` }} />
      </div>
      <span className="font-bold tabular-nums">{valor}%</span>
    </div>
  )
}

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

export function Titulo({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold leading-tight text-balance">{children}</h1>
      {sub && <p className="text-tinta2 mt-1">{sub}</p>}
    </div>
  )
}
