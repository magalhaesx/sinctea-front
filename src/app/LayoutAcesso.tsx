import type { ReactNode } from 'react'
import { BarraPreferencias } from '../componentes/BarraPreferencias'

/**
 * Moldura das telas de acesso (entrar e aceite de convite): sem menu, porque
 * ainda nao ha sessao nem perfil que definam o que mostrar. As preferencias
 * sensoriais ficam disponiveis antes do login — quem precisa de texto maior
 * precisa dele para ler a propria tela de entrada.
 */
export function LayoutAcesso({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a className="pular" href="#conteudo">Pular para o conteúdo</a>

      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-cromo-linha px-5 py-3">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <b className="text-[17px] font-bold tracking-wide text-cromo-tinta">SINCTEA</b>
          <span className="text-xs text-cromo-tinta2">
            Continuidade terapêutica no <abbr title="Transtorno do Espectro Autista">TEA</abbr>
          </span>
        </div>
        <BarraPreferencias />
      </header>

      <main id="conteudo" tabIndex={-1} className="min-w-0 flex-1 bg-cromo2 p-3 sm:p-5">
        <div className="mx-auto min-w-0 max-w-lg">{children}</div>
      </main>
    </div>
  )
}
