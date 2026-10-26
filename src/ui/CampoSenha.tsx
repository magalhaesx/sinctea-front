import { forwardRef, useEffect, useReducer, useRef, type InputHTMLAttributes } from 'react'
import { ROTULO_DO_OLHO, esconderAoEnviar, proximaVisibilidade, tipoDoCampo } from './olhoDaSenha'

/**
 * Campo de senha com o botao de olho (item 14): o mesmo nos quatro campos,
 * na entrada, no convite e no definir senha.
 *
 * O botao e type="button", para nunca enviar o formulario, nem pelo Enter no
 * campo. O olho aberto mostra a senha; o cortado a esconde. Alvo de 44px
 * (docs/02, alvos de toque), com o foco visivel de todo elemento operavel. O
 * campo ganha espaco a direita, em rem, que cresce com o "Texto maior".
 * O rotulo, a dica e o erro continuam com o Campo de cada tela.
 */

export type PropsDoCampoSenha = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id' | 'autoComplete'> & {
  id: string
  /** current-password na entrada; new-password onde a senha e criada. */
  autoComplete: 'current-password' | 'new-password'
}

export function CampoSenha(props: PropsDoCampoSenha) {
  const [visivel, mudar] = useReducer(proximaVisibilidade, false)
  const campo = useRef<HTMLInputElement>(null)

  useEffect(() => (campo.current ? esconderAoEnviar(campo.current, () => mudar('enviar')) : undefined), [])

  return <CaixaDaSenha {...props} ref={campo} visivel={visivel} aoAlternar={() => mudar('alternar')} />
}

/** A marcacao nos dois estados, sem o estado: exportada para o teste. */
export const CaixaDaSenha = forwardRef<HTMLInputElement, PropsDoCampoSenha & {
  visivel: boolean
  aoAlternar: () => void
}>(function CaixaDaSenha({ id, className = '', visivel, aoAlternar, ...resto }, ref) {
  return (
    <div className="relative">
      {/* O Edge desenha o proprio olho no campo de senha: sai, para nao haver dois. */}
      <input
        ref={ref}
        id={id}
        type={tipoDoCampo(visivel)}
        className={`${className} w-full pr-12 [&::-ms-reveal]:hidden`}
        {...resto}
      />
      <button
        type="button"
        aria-label={ROTULO_DO_OLHO}
        aria-pressed={visivel}
        aria-controls={id}
        onClick={aoAlternar}
        className="absolute inset-y-0 right-0 my-auto inline-flex size-11 cursor-pointer items-center justify-center rounded-lg text-tinta2 hover:text-tinta"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {visivel && <path d="M3 3l18 18" />}
        </svg>
      </button>
    </div>
  )
})
