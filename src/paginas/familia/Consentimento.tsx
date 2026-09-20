import { useState } from 'react'
import { Tela } from '../../componentes/Layout'
import { Aviso, Botao, Campo, Cartao, Titulo } from '../../componentes/ui'
import { consentimento } from '../../dados/exemplo'

const bloqueado = [
  'O plano terapêutico e os gráficos de evolução',
  'Diagnóstico, laudos e relatórios clínicos',
  'O histórico de sessões da clínica',
]

export function Consentimento() {
  const [confirmando, setConfirmando] = useState(false)
  const [encerrado, setEncerrado] = useState(false)

  return (
    <Tela
      area="fam"
      nome="Acesso da escola"
      papel="Quem autoriza é você"
      caminho={['Início', 'Autorizar o acesso da escola']}
      estreito
    >
      <Titulo sub="Você escolhe o que a escola vê e por quanto tempo. Pode encerrar a qualquer momento, e o encerramento vale na hora.">
        Autorizar o acesso da escola
      </Titulo>

      <Cartao>
        <fieldset className="rounded-lg border border-linha p-4">
          <legend className="px-1.5 font-bold">O que a escola poderá acessar</legend>
          <div className="flex items-start gap-2.5 py-2.5">
            <input id="esc-cartao" type="checkbox" defaultChecked className="mt-1 h-6 w-6 flex-none accent-[#c8402e]" />
            <label htmlFor="esc-cartao">
              <b>Cartão de estratégias</b>
              <span className="block text-sm text-tinta2">
                Orientações práticas do que fazer e do que evitar, em linguagem simples.
              </span>
            </label>
          </div>
          <div className="flex items-start gap-2.5 py-2.5">
            <input id="esc-ocor" type="checkbox" defaultChecked className="mt-1 h-6 w-6 flex-none accent-[#c8402e]" />
            <label htmlFor="esc-ocor">
              <b>Registrar o que acontece na escola</b>
              <span className="block text-sm text-tinta2">
                O professor descreve situações; a leitura clínica continua com a terapeuta.
              </span>
            </label>
          </div>
        </fieldset>

        <div className="mt-4 rounded-lg bg-sup2 p-4">
          <h3 className="font-bold">O que a escola nunca verá</h3>
          <ul className="mt-2.5 flex flex-col gap-2">
            {bloqueado.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-tinta2">
                <svg className="mt-0.5 h-5 w-5 flex-none" viewBox="0 0 24 24" role="img" aria-label="Bloqueado" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M5.6 5.6l12.8 12.8" />
                </svg>
                {b}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4">
          <Campo id="validade" rotulo="Autorizar até" dica="Depois dessa data o acesso se encerra sozinho, sem você precisar fazer nada.">
            <input
              id="validade" type="date" defaultValue={consentimento.validadeAte}
              aria-describedby="validade-dica"
              className="min-h-11 w-full rounded-lg border-2 border-linha bg-sup px-3 py-2.5 text-tinta"
            />
          </Campo>
        </div>

        <p className="mt-4 text-sm text-tinta2">
          Ao autorizar, registramos a data, a hora e uma cópia do termo que você aceitou. Esse
          registro serve para provar, depois, exatamente o que foi autorizado.
        </p>
        <div className="mt-4">
          <Botao area="fam" className="w-full">Gerar convite para a escola</Botao>
        </div>
      </Cartao>

      <Cartao>
        <h2 className="text-base font-bold">Convite gerado</h2>
        <p className="mb-3 text-sm text-tinta2">
          Entregue este convite à professora. Ele vale para um único cadastro e expira em 72 horas.
        </p>
        <p className="font-bold tabular-nums break-all">sinctea.app/convite/7K4P-92RB</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Botao area="fam" variante="secundaria">Copiar o link</Botao>
          <Botao area="fam" variante="secundaria">Enviar por mensagem</Botao>
        </div>
      </Cartao>

      {/* Acao destrutiva com efeito imediato: confirmacao em duas etapas (heuristica H5). */}
      <div aria-live="polite">
        {encerrado ? (
          <Aviso tom="ok" titulo="Acesso encerrado">
            A escola não consegue mais abrir o cartão de estratégias nem registrar ocorrências. O
            encerramento passou a valer agora e ficou registrado.
          </Aviso>
        ) : (
          <div className="rounded-xl border border-linha border-l-4 border-l-cr bg-cr-sup p-4">
            <h3 className="font-bold">Acesso ativo agora</h3>
            <p className="mt-1 text-sm text-tinta2">
              Prof.ª {consentimento.professor} · {consentimento.escola} · desde {consentimento.concedidoEm}
            </p>
            {!confirmando ? (
              <div className="mt-3">
                <Botao area="fam" variante="secundaria" onClick={() => setConfirmando(true)}>
                  Encerrar este acesso
                </Botao>
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-cr bg-sup p-3.5">
                <p className="font-bold">Encerrar o acesso de {consentimento.professor}?</p>
                <p className="mt-1 text-sm text-tinta2">
                  A partir de agora ela deixa de ver o cartão de estratégias e não consegue mais
                  registrar ocorrências. Você pode autorizar de novo quando quiser.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Botao area="fam" onClick={() => { setEncerrado(true); setConfirmando(false) }}>
                    Sim, encerrar agora
                  </Botao>
                  <Botao area="fam" variante="secundaria" onClick={() => setConfirmando(false)}>
                    Cancelar
                  </Botao>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Tela>
  )
}
