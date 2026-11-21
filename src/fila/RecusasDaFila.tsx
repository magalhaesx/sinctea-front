import { Aviso } from '../ui/Aviso'
import { Botao } from '../ui/Botao'
import { fila, usarRecusas } from '.'

/**
 * Os toques que o servidor recusou de vez (item 22): sairam da fila, e a tela
 * diz quantos e por que, agrupados pelo motivo. Nas telas 3 e 7, para a recusa
 * nunca sumir calada, venha o envio de que tela vier. Fica ate a pessoa dizer
 * que entendeu — ou fechar a aba: a recusa nao vai para o disco, que so guarda
 * os seis campos do toque.
 */
export function RecusasDaFila({ usuarioId }: { usuarioId: string | undefined }) {
  const recusas = usarRecusas(usuarioId)
  if (!usuarioId || recusas.length === 0) return null
  return (
    <div role="alert">
      <Aviso tom="cr" titulo="Toques não aceitos pelo servidor">
        <ul className="flex flex-col gap-1">
          {recusas.map((r) => (
            <li key={r.motivo}>
              {r.quantidade === 1 ? '1 toque não foi aceito' : `${r.quantidade} toques não foram aceitos`}: {r.motivo}
            </li>
          ))}
        </ul>
        <p className="mt-3">
          <Botao area="cli" variante="secundaria" onClick={() => fila.dispensarRecusas(usuarioId)}>Entendi</Botao>
        </p>
      </Aviso>
    </div>
  )
}
