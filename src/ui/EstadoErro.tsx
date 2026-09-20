import { Botao } from './Botao'
import { type Area } from './tokens'
import { ErroServico } from '../servicos'

/**
 * Estado de erro: o que falhou, em linguagem de gente, e um botao de tentar
 * de novo (docs/02, secao 4). Nunca mostra codigo tecnico nem rastro de pilha.
 *
 * A regiao usa role="alert": quem usa leitor de tela ouve a falha assim que
 * ela aparece, sem precisar procurar.
 */

export interface DescricaoErro {
  titulo: string
  texto: string
}

/**
 * Traduz o erro da camada de servicos para a voz da interface (docs/02, secao 7).
 * `oQue` completa a frase: "Nao foi possivel carregar a lista de pacientes".
 */
export function descreverErro(erro: unknown, oQue: string): DescricaoErro {
  const codigo = erro instanceof ErroServico ? erro.codigo : null
  switch (codigo) {
    case 'NAO_AUTENTICADO':
      return {
        titulo: 'Sua sessão terminou',
        texto: 'Por segurança, entre novamente para continuar. O que já foi registrado está guardado.',
      }
    case 'ACESSO_NEGADO':
      // A mensagem do servico ja explica o motivo (ex.: acesso encerrado pela familia).
      return { titulo: `Você não tem acesso a ${oQue}`, texto: (erro as ErroServico).message }
    case 'NAO_ENCONTRADO':
      return {
        titulo: `Não encontramos ${oQue}`,
        texto: 'O endereço pode estar incompleto, ou o registro não existe mais.',
      }
    case 'VALIDACAO':
    case 'CONFLITO':
      return { titulo: `Não foi possível concluir: ${oQue}`, texto: (erro as ErroServico).message }
    case 'INDISPONIVEL':
      return {
        titulo: `Não foi possível carregar ${oQue}`,
        texto: 'A conexão com o servidor falhou. Nada do que você registrou foi perdido. Tente de novo em alguns segundos.',
      }
    default:
      return {
        titulo: `Não foi possível carregar ${oQue}`,
        texto: 'Algo deu errado do nosso lado. Nada do que você registrou foi perdido. Tente de novo em alguns segundos.',
      }
  }
}

export interface PropsEstadoErro {
  erro: unknown
  /** Complemento da frase, com artigo: "a lista de pacientes", "o plano terapêutico". */
  oQue: string
  /**
   * Sem esta funcao, o botao nao aparece: ha falhas em que tentar de novo nao
   * muda nada, como abrir a ficha de um paciente que nao e seu.
   */
  aoTentarDeNovo?: () => void
  /** Sobrescrevem o texto derivado do erro, quando a tela sabe dizer melhor. */
  titulo?: string
  texto?: string
  /** Nivel do titulo, para nao saltar a hierarquia da tela. Padrao: 2. */
  nivel?: 2 | 3
  area?: Area
}

export function EstadoErro({
  erro, oQue, aoTentarDeNovo, titulo: tituloDado, texto: textoDado, nivel = 2, area = 'cli',
}: PropsEstadoErro) {
  const derivado = descreverErro(erro, oQue)
  const titulo = tituloDado ?? derivado.titulo
  const texto = textoDado ?? derivado.texto
  const Titulo = nivel === 2 ? 'h2' : 'h3'
  return (
    <section role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-linha border-l-4 border-l-cr bg-cr-sup p-5 sm:p-6">
      <Titulo className={`flex items-baseline gap-2 ${nivel === 2 ? 'text-lg' : 'text-[15px]'} font-bold leading-tight text-cr`}>
        <span aria-hidden="true">▲</span>
        {titulo}
      </Titulo>
      <p className="max-w-[65ch] text-tinta">{texto}</p>
      {aoTentarDeNovo && (
        <Botao variante="secundaria" area={area} onClick={aoTentarDeNovo}>Tentar de novo</Botao>
      )}
    </section>
  )
}
