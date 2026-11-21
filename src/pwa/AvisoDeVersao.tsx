import { useEffect, useState } from 'react'
import { usarSessao } from '../contexto/Sessao'
import { usarPendentes } from '../fila'
import { atualizar, usarVersaoNova } from './versao'

/**
 * "Nova versao disponivel · Atualizar" (item 22), em qualquer tela. A pagina
 * nunca recarrega sozinha. Com toque ainda na fila, o "Atualizar" espera ela
 * esvaziar: recarregar no meio do envio nao perderia nada — o toque esta no
 * aparelho, e o reenvio e idempotente —, mas a pessoa nao precisa ver o
 * contador voltar.
 */
export function AvisoDeVersao() {
  const nova = usarVersaoNova()
  const { usuario } = usarSessao()
  const pendentes = usarPendentes(usuario?.id).length
  const [esperando, setEsperando] = useState(false)

  useEffect(() => {
    if (esperando && pendentes === 0) atualizar()
  }, [esperando, pendentes])

  if (!nova) return null
  return (
    <div role="status" className="nao-imprimir fixed inset-x-0 bottom-0 z-40 flex justify-center p-3">
      <div className="flex max-w-xl flex-wrap items-center gap-3 rounded-xl border border-cromo-linha bg-cromo px-4 py-3 text-cromo-tinta shadow-lg">
        <span className="font-bold">
          {esperando && pendentes > 0
            ? `Atualizando assim que ${pendentes === 1 ? 'o toque guardado subir' : `os ${pendentes} toques guardados subirem`}…`
            : 'Nova versão disponível'}
        </span>
        {!esperando && (
          <button
            type="button"
            onClick={() => setEsperando(true)}
            className="min-h-11 cursor-pointer rounded-lg border-2 border-cromo-tinta px-3 font-bold hover:bg-cromo2"
          >
            Atualizar
          </button>
        )}
      </div>
    </div>
  )
}
