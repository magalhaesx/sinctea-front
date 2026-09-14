import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

/**
 * Preferencias sensoriais oferecidas pelo proprio produto.
 * Atendem WCAG 1.4.4 (redimensionar texto), 1.4.3 (contraste) e
 * 2.3.3 / e-MAG 2.7 (controle sobre alteracoes temporais).
 */
export interface Preferencias {
  textoMaior: boolean
  altoContraste: boolean
  semAnimacao: boolean
}

interface Ctx extends Preferencias {
  alternar: (chave: keyof Preferencias) => void
}

const PreferenciasCtx = createContext<Ctx | null>(null)

export function ProvedorPreferencias({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferencias>({
    textoMaior: false,
    altoContraste: false,
    semAnimacao: false,
  })

  const alternar = (chave: keyof Preferencias) =>
    setPrefs((p) => ({ ...p, [chave]: !p[chave] }))

  useEffect(() => {
    const raiz = document.documentElement
    raiz.style.setProperty('--escala-texto', prefs.textoMaior ? '1.2' : '1')
    raiz.classList.toggle('contraste', prefs.altoContraste)
    raiz.classList.toggle('sem-animacao', prefs.semAnimacao)
  }, [prefs])

  return (
    <PreferenciasCtx.Provider value={{ ...prefs, alternar }}>
      {children}
    </PreferenciasCtx.Provider>
  )
}

export function usarPreferencias() {
  const ctx = useContext(PreferenciasCtx)
  if (!ctx) throw new Error('usarPreferencias precisa estar dentro de ProvedorPreferencias')
  return ctx
}
