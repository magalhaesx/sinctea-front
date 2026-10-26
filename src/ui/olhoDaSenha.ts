/**
 * O botao de olho do campo de senha (item 14), fora do React para poder ser
 * testado sem navegador, como a gaveta do menu.
 */

/** O rotulo nao muda: quem diz se a senha esta a mostra e o aria-pressed. */
export const ROTULO_DO_OLHO = 'Mostrar senha'

export type AcaoDoOlho = 'alternar' | 'enviar'

/** O botao alterna; o envio do formulario sempre esconde. */
export function proximaVisibilidade(visivel: boolean, acao: AcaoDoOlho): boolean {
  return acao === 'alternar' ? !visivel : false
}

export const tipoDoCampo = (visivel: boolean): 'text' | 'password' => (visivel ? 'text' : 'password')

/** O que o ouvinte do envio precisa do campo: o HTMLInputElement atende. */
export interface CampoNoFormulario {
  type: string
  readonly form: EventTarget | null
}

/**
 * Ao enviar o formulario, a senha volta a ficar escondida, para o navegador
 * nao guarda-la como texto comum. O tipo muda no proprio evento, antes do
 * onSubmit da tela e sem esperar a renderizacao do React; `aoEsconder` acerta
 * o estado depois. Devolve a funcao que tira o ouvinte.
 */
export function esconderAoEnviar(campo: CampoNoFormulario, aoEsconder: () => void): () => void {
  const formulario = campo.form
  if (!formulario) return () => {}
  const esconder = () => {
    campo.type = 'password'
    aoEsconder()
  }
  formulario.addEventListener('submit', esconder, { capture: true })
  return () => formulario.removeEventListener('submit', esconder, { capture: true })
}
