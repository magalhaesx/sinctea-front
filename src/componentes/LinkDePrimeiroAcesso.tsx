import { useRef, useState } from 'react'
import { SE_A_PESSOA_NAO_RECEBER, textoDoEnvio } from '@sinctea/compartilhado/dominio/recuperacao'
import { Aviso } from '../ui/Aviso'
import { Botao } from '../ui/Botao'
import { Cartao } from '../ui/Cartao'
import type { FinalidadeAcesso, LinkPrimeiroAcesso } from '../servicos'

/**
 * O link de primeiro acesso, como quem cadastra o recebe (docs/07, secao 0,
 * lacuna 1). O token aparece aqui uma vez — o servidor guarda so o resumo, e
 * nao o mostra de novo.
 *
 * Desde o item 23, o servidor tambem manda o link por e-mail, e a resposta diz
 * se foi. Enviado, a tela diz para onde, e o "Copiar link" fica, para quando a
 * pessoa nao recebe. Falhou, a tela pede para copiar e entregar. Com o envio
 * desligado, fica como antes: quem cadastra entrega o link.
 */

/** O link chegou ao servico de e-mail: o aviso da tela nao pede para entregar. */
export function foiPorEmail(link: LinkPrimeiroAcesso): boolean {
  return link.envio.situacao === 'ENVIADO'
}

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

  const envio = textoDoEnvio(link.envio)
  const enviado = link.envio.situacao === 'ENVIADO'
  const paraQue = finalidade === 'NOVA_SENHA'
    ? 'é por ele que a pessoa escolhe a nova senha — ninguém mais a conhece. Ao ser usado, a senha anterior deixa de valer e as sessões abertas se encerram.'
    : 'é por ele que a pessoa define a própria senha — ninguém mais a conhece.'
  const validadeEAviso = `Vale até ${validade} e uma única vez. Ele não aparece de novo: se perder, gere outro.`

  return (
    <Cartao>
      <h3 className="text-base font-bold">
        {finalidade === 'NOVA_SENHA' ? `Link para nova senha de ${nome}` : `Link de primeiro acesso de ${nome}`}
      </h3>
      {enviado && envio && (
        <p className="mt-1 font-bold text-tinta"><span aria-hidden="true">✓ </span>{envio}</p>
      )}
      {link.envio.situacao === 'FALHOU' && envio && (
        <div className="mt-2"><Aviso tom="at">{envio}</Aviso></div>
      )}
      <p className="texto-corrido mt-1 text-sm text-tinta2">
        {enviado
          ? `${SE_A_PESSOA_NAO_RECEBER} É${paraQue.slice(1)} ${validadeEAviso}`
          : `Entregue este link a ${nome}: ${paraQue} ${validadeEAviso}`}
      </p>
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
