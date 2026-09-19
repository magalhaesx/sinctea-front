import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { Botao, type Area } from '../componentes/ui'

/**
 * Estado vazio: diz o que e a lista, por que esta vazia e qual a acao para
 * preenche-la (docs/02, secao 4).
 *
 * Ruim: "Nenhum registro encontrado."
 * Bom:  "Nenhum paciente cadastrado ainda." + por que + "Cadastrar paciente".
 *
 * A acao e obrigatoria no tipo. Quando ela navega, passe um <Link> pronto;
 * quando executa algo na propria tela, passe { rotulo, aoAcionar }.
 */

export interface AcaoEstado {
  rotulo: string
  aoAcionar: () => void
}

export interface PropsEstadoVazio {
  /** O que esta vazio, do lado do usuario: "Nenhum paciente cadastrado ainda". */
  titulo: string
  /** Por que esta vazio e o que fazer. */
  explicacao: ReactNode
  acao: AcaoEstado | ReactElement
  /** Nivel do titulo, para nao saltar a hierarquia da tela. Padrao: 2. */
  nivel?: 2 | 3
  area?: Area
}

export function EstadoVazio({ titulo, explicacao, acao, nivel = 2, area = 'cli' }: PropsEstadoVazio) {
  const Titulo = nivel === 2 ? 'h2' : 'h3'
  return (
    <section className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-linha bg-sup p-5 sm:p-6">
      <span aria-hidden="true" className="text-2xl leading-none text-tinta3">○</span>
      <Titulo className={`${nivel === 2 ? 'text-lg' : 'text-[15px]'} font-bold leading-tight`}>{titulo}</Titulo>
      <div className="max-w-[65ch] text-tinta2">{explicacao}</div>
      <div className="pt-1">
        {isValidElement(acao)
          ? acao
          : <Botao area={area} onClick={(acao as AcaoEstado).aoAcionar}>{(acao as AcaoEstado).rotulo}</Botao>}
      </div>
    </section>
  )
}
