import { useEffect, useRef } from 'react'
import { usarSessao } from '../contexto/Sessao'
import { NOME_DO_PERFIL } from './perfis'

/**
 * Duas contas no mesmo navegador (item 7). Outra janela trocou a conta, o
 * perfil, ou saiu: esta diz o que aconteceu e pede para recarregar, em vez de
 * falhar em silencio. Fica por cima de qualquer tela, e o foco vai para ele.
 */
export function AvisoDeJanela() {
  const { mudanca } = usarSessao()
  const caixa = useRef<HTMLDivElement>(null)
  useEffect(() => { if (mudanca.tipo !== 'MESMA') caixa.current?.focus() }, [mudanca])
  if (mudanca.tipo === 'MESMA') return null

  const texto = mudanca.tipo === 'OUTRA_CONTA'
    ? `Esta janela agora está com a conta de ${mudanca.nome}. Recarregue a página para continuar.`
    : mudanca.tipo === 'OUTRO_PERFIL'
      ? `Esta janela agora está com o perfil ${NOME_DO_PERFIL[mudanca.perfil]}. Recarregue a página para continuar.`
      : 'A conta desta janela saiu em outra janela. Recarregue a página para entrar de novo.'

  return (
    <div
      ref={caixa}
      tabIndex={-1}
      role="alert"
      className="fixed inset-x-0 top-0 z-50 flex flex-wrap items-center justify-center gap-3 border-b-4 border-at bg-at-sup px-4 py-3 text-tinta shadow"
    >
      <p className="font-bold">{texto}</p>
      <button
        type="button"
        className="min-h-11 cursor-pointer rounded-lg border-2 border-current px-3 font-bold"
        onClick={() => window.location.reload()}
      >
        Recarregar a página
      </button>
    </div>
  )
}
