import { useEffect, useId, useRef, useState } from 'react'
import { Botao } from '../../ui/Botao'
import { servicos } from '../../servicos'

/**
 * O "Cancelar" de um agendamento (item 19b), nas telas 3 e 5. Nao se desfaz:
 * remarcar e agendar de novo. Por isso a confirmacao em duas etapas, como o
 * "Encerrar o acesso" da tela 17 — o foco vai para a pergunta, e "Manter" o
 * devolve ao botao.
 *
 * So aparece para quem vai conduzir a sessao; o servidor recusa os demais.
 */
export function CancelarAgendamento({ sessaoId, descricao, aoCancelar }: {
  sessaoId: string
  /** "Miguel Santana, 16/11/2026 às 14:00": o que a pergunta nomeia. */
  descricao: string
  aoCancelar: (mensagem: string) => void
}) {
  const id = useId()
  const [confirmando, setConfirmando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const caixa = useRef<HTMLDivElement>(null)
  const botao = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (confirmando) caixa.current?.focus()
  }, [confirmando])

  const manter = () => {
    setConfirmando(false)
    setErro(null)
    setTimeout(() => botao.current?.focus())
  }

  const confirmar = async () => {
    setOcupado(true)
    setErro(null)
    try {
      await servicos.sessoes.cancelar(sessaoId)
      aoCancelar(`Agendamento cancelado: ${descricao}.`)
    } catch (e) {
      setErro((e as Error).message || 'Não foi possível cancelar agora.')
    } finally {
      setOcupado(false)
    }
  }

  if (!confirmando) {
    return (
      <Botao ref={botao} area="cli" variante="secundaria" onClick={() => setConfirmando(true)}>
        Cancelar
      </Botao>
    )
  }

  return (
    <div ref={caixa} tabIndex={-1} role="group" aria-labelledby={id}
      className="w-full rounded-lg border border-cr bg-cr-sup p-3.5">
      <p id={id} className="font-bold">Cancelar o agendamento de {descricao}?</p>
      <p className="mt-1 text-sm text-tinta2">O horário fica livre. Para remarcar, agende de novo.</p>
      {erro && <p className="mt-2 text-sm font-bold text-cr" role="alert">{erro}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Botao area="cli" onClick={() => void confirmar()} disabled={ocupado}>
          {ocupado ? 'Cancelando…' : 'Sim, cancelar'}
        </Botao>
        <Botao area="cli" variante="secundaria" onClick={manter} disabled={ocupado}>Manter o agendamento</Botao>
      </div>
    </div>
  )
}
