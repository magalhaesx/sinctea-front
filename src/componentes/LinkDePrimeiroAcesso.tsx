import { useRef, useState } from 'react'
import { Botao } from '../ui/Botao'
import { Cartao } from '../ui/Cartao'
import type { FinalidadeAcesso, LinkPrimeiroAcesso } from '../servicos'

/**
 * O link de primeiro acesso, como quem cadastra o recebe (docs/07, secao 0,
 * lacuna 1). Nao ha servidor de e-mail: quem cadastra entrega o link a pessoa,
 * que define a propria senha por ele. O token aparece aqui uma vez — o
 * servidor guarda so o resumo, e nao o mostra de novo.
 */

/** O endereco completo do link, no mesmo lugar em que o sistema esta aberto. */
export function enderecoDoPrimeiroAcesso(token: string): string {
  const base = window.location.href.split('#')[0]
  return `${base}#/app/primeiro-acesso/${encodeURIComponent(token)}`
}

export function LinkDePrimeiroAcesso({ nome, link, finalidade = 'PRIMEIRO_ACESSO' }: {
  nome: string
  link: LinkPrimeiroAcesso
  /** NOVA_SENHA: o link que a coordenacao gerou para o responsavel (item 8). */
  finalidade?: FinalidadeAcesso
}) {
  const endereco = enderecoDoPrimeiroAcesso(link.token)
  const campo = useRef<HTMLInputElement>(null)
  const [copiado, setCopiado] = useState(false)
  const validade = new Date(link.expiraEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(endereco)
      setCopiado(true)
    } catch {
      // Sem acesso a area de transferencia: o link fica selecionado para copiar a mao.
      campo.current?.select()
    }
  }

  return (
    <Cartao>
      {finalidade === 'NOVA_SENHA' ? (
        <>
          <h3 className="text-base font-bold">Link para nova senha de {nome}</h3>
          <p className="mt-1 max-w-[65ch] text-sm text-tinta2">
            Entregue este link a {nome}: é por ele que a pessoa escolhe a nova senha — ninguém mais a
            conhece. Ao ser usado, a senha anterior deixa de valer e as sessões abertas se encerram. Vale
            até {validade} e uma única vez. Ele não aparece de novo: se perder, gere outro.
          </p>
        </>
      ) : (
        <>
          <h3 className="text-base font-bold">Link de primeiro acesso de {nome}</h3>
          <p className="mt-1 max-w-[65ch] text-sm text-tinta2">
            Entregue este link a {nome}: é por ele que a pessoa define a própria senha — ninguém mais
            a conhece. Vale até {validade} e uma única vez. Ele não aparece de novo: se perder, gere outro.
          </p>
        </>
      )}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="link-primeiro-acesso" className="sr-only">
          {finalidade === 'NOVA_SENHA' ? 'Link para nova senha' : 'Link de primeiro acesso'}
        </label>
        <input
          ref={campo}
          id="link-primeiro-acesso"
          readOnly
          value={endereco}
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-11 w-full min-w-0 rounded-lg border-2 border-linha bg-sup px-3 py-2.5 font-mono text-sm text-tinta"
        />
        <Botao area="cli" variante="secundaria" onClick={() => void copiar()}>
          {copiado ? 'Copiado' : 'Copiar link'}
        </Botao>
      </div>
    </Cartao>
  )
}
