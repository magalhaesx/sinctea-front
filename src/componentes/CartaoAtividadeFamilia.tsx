import { ehEnderecoDeVideo, frequenciaSemanalEmPalavras } from '@sinctea/compartilhado/dominio/regras'

/**
 * A atividade como a familia le. E o mesmo cartao nos dois lugares: na tela 9
 * ele acompanha o terapeuta enquanto ele escreve, e na tela 16 ele e a propria
 * tela da familia. Um so componente para que as duas leituras nunca divirjam.
 *
 * Nao ha nada de clinico aqui, e nao ha botao que reescreva o texto: a redacao
 * que a familia le e escrita por quem prescreve (regra 4 do CLAUDE.md).
 *
 * O video e um link que abre em nova aba (item 15), e so com endereco
 * https:// (ehEnderecoDeVideo): na previa da tela 9, o que ainda nao vale nao
 * vira link, e o que a familia toca nunca e um "javascript:".
 *
 * "Para que serve" (item 15b) e a redacao acessivel do objetivo, logo abaixo
 * do titulo. Na previa da tela 9, a do objetivo escolhido no formulario.
 *
 * O que se le — para que serve, descricao, passos e dicas — e texto corrido,
 * justificado (item 20).
 */

/** So o que a familia ve. O registro do dia nao e deste cartao. */
export interface AtividadeParaFamilia {
  titulo: string
  descricao: string
  passos: string[]
  dicas: string
  frequenciaSemanal: number
  urlVideo: string | null
  paraQue: string
}

export function CartaoAtividadeFamilia({ atividade }: { atividade: AtividadeParaFamilia }) {
  const passos = atividade.passos.map((p) => p.trim()).filter(Boolean)
  const titulo = atividade.titulo.trim()
  const descricao = atividade.descricao.trim()
  const dicas = atividade.dicas.trim()
  const video = atividade.urlVideo?.trim() ?? ''
  const paraQue = atividade.paraQue.trim()

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-fam bg-fam-sup p-4 sm:p-5">
      <h3 className="text-lg font-bold leading-tight">
        {titulo || <span className="text-tinta2">Sem título ainda</span>}
      </h3>

      {paraQue && (
        <div>
          <h4 className="text-base font-bold">Para que serve</h4>
          <p className="texto-corrido mt-1 text-[15px]">{paraQue}</p>
        </div>
      )}

      <div>
        <p className="text-sm text-tinta2">
          {frequenciaSemanalEmPalavras(atividade.frequenciaSemanal)}
        </p>
        {descricao && <p className="texto-corrido mt-1 text-[15px]">{descricao}</p>}
      </div>

      {ehEnderecoDeVideo(video) && (
        <a href={video} target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-lg border border-linha bg-sup px-3.5 font-bold text-fam-ink underline">
          <svg className="flex-none" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"
            focusable="false" fill="none" stroke="currentColor" strokeWidth="1.7">
            <circle cx="12" cy="12" r="10" />
            <path d="M10 8.5v7l6-3.5z" fill="currentColor" stroke="none" />
          </svg>
          Ver o vídeo<span className="sr-only"> (abre em nova aba)</span>
        </a>
      )}

      {passos.length > 0 && (
        <div>
          <h4 className="text-base font-bold">Como fazer</h4>
          <ol className="mt-2.5 flex flex-col gap-2.5">
            {passos.map((p, i) => (
              <li key={`${i}-${p}`} className="flex items-baseline gap-3 text-[15px]">
                <span aria-hidden="true"
                  className="grid h-7 w-7 flex-none place-items-center rounded-full bg-fam-ink text-[13px] font-bold text-white">
                  {i + 1}
                </span>
                <span className="texto-corrido min-w-0">{p}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {dicas && (
        <div className="rounded-lg border border-linha bg-sup p-3.5">
          <h4 className="text-base font-bold">Se não sair de primeira</h4>
          <p className="texto-corrido mt-1 text-[15px]">{dicas}</p>
        </div>
      )}
    </div>
  )
}
