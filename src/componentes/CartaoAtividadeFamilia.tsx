import { frequenciaSemanalEmPalavras } from '../dominio/regras'

/**
 * A atividade como a familia le. E o mesmo cartao nos dois lugares: na tela 9
 * ele acompanha o terapeuta enquanto ele escreve, e na tela 16 ele e a propria
 * tela da familia. Um so componente para que as duas leituras nunca divirjam.
 *
 * Nao ha nada de clinico aqui, e nao ha botao que reescreva o texto: a redacao
 * que a familia le e escrita por quem prescreve (regra 4 do CLAUDE.md).
 */

/** So o que a familia ve. O registro do dia nao e deste cartao. */
export interface AtividadeParaFamilia {
  titulo: string
  descricao: string
  passos: string[]
  dicas: string
  frequenciaSemanal: number
  urlVideo: string | null
}

export function CartaoAtividadeFamilia({ atividade }: { atividade: AtividadeParaFamilia }) {
  const passos = atividade.passos.map((p) => p.trim()).filter(Boolean)
  const titulo = atividade.titulo.trim()
  const descricao = atividade.descricao.trim()
  const dicas = atividade.dicas.trim()

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-fam bg-fam-sup p-4 sm:p-5">
      <div>
        <h3 className="text-lg font-bold leading-tight">
          {titulo || <span className="text-tinta2">Sem título ainda</span>}
        </h3>
        <p className="mt-1 text-sm text-tinta2">
          {frequenciaSemanalEmPalavras(atividade.frequenciaSemanal)}
        </p>
      </div>

      {descricao && <p className="text-[15px]">{descricao}</p>}

      {atividade.urlVideo && (
        <div className="grid aspect-video place-items-center gap-2 rounded-lg border border-linha bg-sup p-4 text-center text-tinta2">
          <svg width="40" height="40" viewBox="0 0 24 24" role="img"
            aria-label="Vídeo demonstrativo" fill="none" stroke="currentColor" strokeWidth="1.7">
            <circle cx="12" cy="12" r="10" />
            <path d="M10 8.5v7l6-3.5z" fill="currentColor" stroke="none" />
          </svg>
          <span className="text-sm">Vídeo mostrando como fazer</span>
        </div>
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
                <span>{p}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {dicas && (
        <div className="rounded-lg border border-linha bg-sup p-3.5">
          <h4 className="text-base font-bold">Se não sair de primeira</h4>
          <p className="mt-1 text-[15px]">{dicas}</p>
        </div>
      )}
    </div>
  )
}
