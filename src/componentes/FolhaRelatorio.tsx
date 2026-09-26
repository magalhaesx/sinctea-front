import type { ReactNode } from 'react'
import type { ConteudoRelatorio, Destinatario, ObjetivoNoRelatorio } from '../servicos'

/**
 * A folha do relatorio de evolucao. O mesmo componente desenha a
 * pre-visualizacao e o documento emitido — se fossem dois, o que a pessoa
 * confere antes de emitir nao seria o que sai.
 *
 * Vai para o papel como esta: as regras de impressao estao em index.css,
 * presas a classe `folha-relatorio`.
 */

export const NOME_DO_DESTINATARIO: Record<Destinatario, string> = {
  PROFISSIONAIS: 'Equipe e outros profissionais',
  FAMILIA: 'Família',
}

const SITUACAO: Record<ObjetivoNoRelatorio['status'], string> = {
  NAO_INICIADO: 'Não iniciado',
  EM_AQUISICAO: 'Em aquisição',
  DOMINADO: 'Dominado',
}

/**
 * Data em AAAA-MM-DD vira meio-dia local antes de virar Date: sem isso o
 * navegador le a data-only como meia-noite UTC e o fuso puxa o dia para tras —
 * 12/03 nasce virando 11/03. Texto com hora passa direto.
 */
const emData = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('pt-BR')
const percentual = (v: number | null) => v === null ? '—' : `${v}%`

/*
 * As listas de definicao so viram duas colunas a partir de sm: a 320px, com
 * "Texto maior" ligado, rotulo e valor lado a lado estouram a borda do bloco.
 */
export function FolhaRelatorio({ conteudo, rodape }: {
  conteudo: ConteudoRelatorio
  /** So o documento emitido tem rodape: autor, data, hash e a conferencia. */
  rodape?: ReactNode
}) {
  const { paciente } = conteudo
  return (
    <article className="folha-relatorio rounded-xl border border-linha bg-sup p-5 sm:p-7">
      <header>
        <h2 className="text-xl font-bold leading-tight">Relatório de evolução</h2>
        <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-[15px] sm:grid-cols-[auto_1fr]">
          <dt className="font-bold">Paciente</dt>
          <dd>{paciente.nome} · nascimento em {emData(paciente.dataNascimento)}</dd>
          <dt className="font-bold">Período</dt>
          <dd>{emData(conteudo.periodoInicio)} a {emData(conteudo.periodoFim)}</dd>
          <dt className="font-bold">Destinatário</dt>
          <dd>{NOME_DO_DESTINATARIO[conteudo.destinatario]}</dd>
          <dt className="font-bold">Sessões no período</dt>
          <dd>{conteudo.sessoesNoPeriodo}</dd>
        </dl>
      </header>

      <section className="mt-6" aria-labelledby="h-objetivos-relatorio">
        <h3 id="h-objetivos-relatorio" className="text-lg font-bold">Objetivos</h3>
        {conteudo.objetivos.length === 0 ? (
          <p className="mt-2 text-tinta2">Nenhum objetivo selecionado.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-4">
            {conteudo.objetivos.map((o) => (
              <li key={o.objetivoId} className="rounded-lg border border-linha p-4">
                <h4 className="text-[13px] font-bold uppercase tracking-wider text-tinta2">
                  {o.dominio}
                </h4>
                <p className="mt-1 text-[15px]">{o.redacao}</p>

                <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-[15px] sm:grid-cols-[auto_1fr]">
                  <dt className="font-bold">Critério de domínio</dt>
                  <dd>
                    {o.criterio.percentualMinimo}% em {o.criterio.sessoesConsecutivas}{' '}
                    {o.criterio.sessoesConsecutivas === 1 ? 'sessão consecutiva' : 'sessões consecutivas'}
                  </dd>
                  <dt className="font-bold">Sessões com este objetivo</dt>
                  <dd className="tabular-nums">{o.sessoesNoPeriodo}</dd>
                  <dt className="font-bold">No período</dt>
                  <dd className="tabular-nums">
                    {o.sessoesNoPeriodo === 0
                      ? 'Sem registro no período'
                      : `primeiro ${percentual(o.primeiroPercentual)} · último ${percentual(o.ultimoPercentual)} · melhor ${percentual(o.melhorPercentual)}`}
                  </dd>
                  <dt className="font-bold">Situação</dt>
                  <dd>
                    {SITUACAO[o.status]}
                    {o.dominadoEm && ` · domínio confirmado em ${emData(o.dominadoEm)}`}
                  </dd>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>

      {conteudo.consideracoes && (
        <section className="mt-6" aria-labelledby="h-consideracoes-relatorio">
          <h3 id="h-consideracoes-relatorio" className="text-lg font-bold">
            Considerações do profissional
          </h3>
          {/* Escrito por quem assina: o sistema nao gera esta parte. */}
          <p className="mt-2 max-w-[70ch] whitespace-pre-line text-[15px]">
            {conteudo.consideracoes}
          </p>
        </section>
      )}

      {rodape}
    </article>
  )
}
