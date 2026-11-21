import { useEffect, useState } from 'react'
import { usarSessao } from '../contexto/Sessao'
import { fila } from '../fila'
import { Botao } from '../ui/Botao'

/**
 * O app abriu pelo service worker, mas o servidor nao respondeu (item 22).
 * Sem ele, nao da para saber de quem e a sessao, e a sessao do atendimento nao
 * tem copia no aparelho, de proposito: o aparelho nao guarda dado clinico. So
 * os toques ja feitos esperam na fila, e sobem quando a conexao voltar.
 */
export function SemConexao() {
  const { reconectar } = usarSessao()
  const [guardados, setGuardados] = useState(0)

  useEffect(() => {
    void fila.contarNoAparelho().then(setGuardados, () => setGuardados(0))
  }, [])

  return (
    <main id="conteudo" className="mx-auto flex max-w-xl flex-col gap-3 p-6">
      <h1 className="text-xl font-bold">Sem conexão com o servidor</h1>
      <p className="texto-corrido">
        Para registrar, a tela da sessão precisa estar aberta: este aparelho não guarda cópia da sessão,
        para não guardar dado clínico.
        {guardados > 0 && ` ${guardados === 1 ? 'O toque guardado neste aparelho sobe' : `Os ${guardados} toques guardados neste aparelho sobem`} quando a conexão voltar.`}
      </p>
      <p className="text-sm text-tinta2">O app tenta de novo sozinho quando a conexão voltar.</p>
      <p>
        <Botao area="cli" variante="secundaria" onClick={reconectar}>Tentar de novo</Botao>
      </p>
    </main>
  )
}
