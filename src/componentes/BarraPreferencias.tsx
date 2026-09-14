import { usarPreferencias, type Preferencias } from '../contexto/Preferencias'

const opcoes: { chave: keyof Preferencias; rotulo: string }[] = [
  { chave: 'textoMaior', rotulo: 'Texto maior' },
  { chave: 'altoContraste', rotulo: 'Alto contraste' },
  { chave: 'semAnimacao', rotulo: 'Reduzir animação' },
]

export function BarraPreferencias() {
  const prefs = usarPreferencias()
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span id="rot-prefs" className="text-[11px] uppercase tracking-widest text-cromo-tinta2">
        Preferências
      </span>
      {opcoes.map(({ chave, rotulo }) => {
        const ativo = prefs[chave]
        return (
          <button
            key={chave}
            onClick={() => prefs.alternar(chave)}
            aria-pressed={ativo}
            aria-describedby="rot-prefs"
            className={`min-h-10 rounded-full border px-3.5 py-2 text-[13px] cursor-pointer ${
              ativo
                ? 'bg-[#7fd6de] text-[#0b2b2f] border-[#7fd6de] font-bold'
                : 'bg-cromo2 text-cromo-tinta border-cromo-linha'
            }`}
          >
            {ativo ? '✓ ' : ''}{rotulo}
          </button>
        )
      })}
    </div>
  )
}
