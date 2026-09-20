import { acento, type Area } from './tokens'

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
