import { useState } from 'react'
import { Tela } from '../LayoutApp'
import { Aviso, Botao, Campo, Cartao, Titulo } from '../../componentes/ui'
import { atividades } from '../../dados/exemplo'
import type { Desempenho } from '../../tipos/dominio'

const opcoes: { valor: Desempenho; rotulo: string }[] = [
  { valor: 'SOZINHO', rotulo: 'Fez sozinho' },
  { valor: 'COM_AJUDA', rotulo: 'Fez com a minha ajuda' },
  { valor: 'NAO_QUIS', rotulo: 'Não quis fazer hoje' },
]

export function Atividade() {
  const atividade = atividades[2]
  const [desempenho, setDesempenho] = useState<Desempenho | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState(false)

  const salvar = () => {
    if (!desempenho) { setErro(true); setSalvo(false); return }
    setErro(false); setSalvo(true)
  }

  return (
    <Tela
      area="fam"
      nome="Atividade de casa"
      papel="Sugerida por Ana Lúcia em 12/09"
      caminho={['Início', atividade.titulo]}
      estreito
    >
      <Titulo sub={`Duas vezes por semana · leva cerca de 5 minutos`}>{atividade.titulo}</Titulo>

      <div className="grid aspect-video max-w-full place-items-center gap-2 rounded-xl border border-linha bg-sup2 p-4 text-center text-tinta2">
        <svg width="44" height="44" viewBox="0 0 24 24" role="img" aria-label="Vídeo demonstrativo de 40 segundos" fill="none" stroke="currentColor" strokeWidth="1.7">
          <circle cx="12" cy="12" r="10" />
          <path d="M10 8.5v7l6-3.5z" fill="currentColor" stroke="none" />
        </svg>
        <span className="text-sm">Vídeo de 40 segundos mostrando como fazer<br />Legendas e transcrição disponíveis</span>
      </div>

      <Cartao>
        <h2 className="text-base font-bold">Como fazer</h2>
        <ol className="mt-3 flex flex-col gap-3">
          {atividade.passos.map((p, i) => (
            <li key={p} className="flex items-baseline gap-3">
              <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-fam-ink text-[13px] font-bold text-white" aria-hidden="true">
                {i + 1}
              </span>
              <span>{p}</span>
            </li>
          ))}
        </ol>
      </Cartao>

      <Cartao>
        <fieldset className="border-0 p-0">
          <legend className="text-base font-bold">Como foi hoje?</legend>
          <div className="mt-3 flex flex-col gap-2.5">
            {opcoes.map((o) => (
              <button
                key={o.valor}
                onClick={() => { setDesempenho(o.valor); setErro(false) }}
                aria-pressed={desempenho === o.valor}
                className={`min-h-14 rounded-lg border-2 px-4 py-4 text-left font-bold cursor-pointer ${
                  desempenho === o.valor ? 'border-fam bg-fam-sup' : 'border-linha bg-sup hover:border-fam'
                }`}
              >
                {desempenho === o.valor && <span aria-hidden="true">✓ </span>}
                {o.rotulo}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-4">
          <Campo id="obs" rotulo="Quer contar alguma coisa? (opcional)" dica="Escreva com as suas palavras. Não precisa usar termo técnico.">
            <textarea
              id="obs"
              rows={3}
              aria-describedby="obs-dica"
              placeholder="Ex.: ele tapou os ouvidos antes de apontar o cartão"
              className="min-h-11 w-full rounded-lg border-2 border-linha bg-sup px-3 py-2.5 text-tinta"
            />
          </Campo>
        </div>

        {erro && (
          <p className="mt-3 font-bold text-cr" role="alert">
            Falta escolher como foi hoje. Toque em uma das três opções acima.
          </p>
        )}

        <div className="mt-4">
          <Botao area="fam" className="w-full" onClick={salvar}>Salvar</Botao>
        </div>

        <div aria-live="polite" className="mt-3">
          {salvo && (
            <Aviso tom="ok" titulo="Registro salvo">
              A terapeuta vai ver isso antes da próxima sessão. Obrigado por registrar.
            </Aviso>
          )}
        </div>
      </Cartao>
    </Tela>
  )
}
