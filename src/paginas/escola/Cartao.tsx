import { Link } from 'react-router-dom'
import { Tela } from '../../componentes/Layout'
import { Botao, Titulo } from '../../componentes/ui'
import { cartao } from '../../dados/exemplo'

export function CartaoEstrategias() {
  return (
    <Tela
      area="esc"
      nome="Carla Nunes"
      papel="Professora regente · 2º ano B"
      caminho={['Início', 'Miguel S.', 'Cartão de estratégias']}
      estreito
    >
      <Titulo sub="Orientações práticas para o dia a dia em sala. Não é diagnóstico nem laudo.">
        Miguel S. · 2º ano B
      </Titulo>

      <section className="rounded-xl border border-linha border-l-4 border-l-ok bg-ok-sup p-4">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <span aria-hidden="true">✓</span> O que fazer
        </h2>
        <ul className="mt-2 list-disc pl-5 text-tinta2">
          {cartao.oQueFazer.map((i) => <li key={i} className="mb-1">{i}</li>)}
        </ul>
      </section>

      <section className="rounded-xl border border-linha border-l-4 border-l-cr bg-cr-sup p-4">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <span aria-hidden="true">✕</span> O que evitar
        </h2>
        <ul className="mt-2 list-disc pl-5 text-tinta2">
          {cartao.oQueEvitar.map((i) => <li key={i} className="mb-1">{i}</li>)}
        </ul>
      </section>

      <section className="rounded-xl border border-linha border-l-4 border-l-at bg-at-sup p-4">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <span aria-hidden="true">▲</span> Sinal de alerta
        </h2>
        <p className="mt-2 text-tinta2">{cartao.sinalAlerta}</p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-linha pt-3">
        <span className="text-sm text-tinta2">
          Autorizado pela família até 31/12/2026.
          <br />Sua consulta fica registrada.
        </span>
        <Link to="/escola/ocorrencia">
          <Botao area="esc">Registrar uma ocorrência</Botao>
        </Link>
      </div>
    </Tela>
  )
}
