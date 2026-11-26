import {
  desdeOMes, emitidaEm, SEM_HABILIDADES, semEstrategias, SUBTITULO_DA_TRILHA, TITULO_DA_TRILHA, tituloDasHabilidades,
  tituloDoApoio,
} from '@sinctea/compartilhado/dominio/trilha'
import type { TrilhaAutonomia } from '../servicos'

/**
 * A folha da trilha de autonomia (tela 26, item 24). A mesma na clinica e na
 * familia, e a mesma na tela e no papel: o que a pessoa le e o que imprime.
 * As regras de impressao estao em index.css, presas a classe `folha-trilha`,
 * como as da folha do relatorio (tela 10b).
 *
 * Regra 4, inteira: o texto e o que a equipe escreveu, como foi gravado. A
 * quebra de linha que ela pos aparece; nada e resumido nem completado.
 *
 * Nas frases, o primeiro nome, como no painel da familia (tela 15); no
 * cabecalho da folha, o nome do cadastro.
 */
export function FolhaTrilha({ trilha }: { trilha: TrilhaAutonomia }) {
  const primeiroNome = trilha.nome.split(' ')[0]
  return (
    <article className="folha-trilha rounded-xl border border-linha bg-sup p-5 sm:p-7">
      <header>
        {/* Na tela, o titulo e o h1 da pagina, logo acima; no papel, a folha traz o dela. */}
        <p className="so-no-papel mb-2 text-xl font-bold leading-tight">{TITULO_DA_TRILHA}</p>
        <p className="text-xl font-bold leading-tight">{trilha.nome}</p>
        <p className="mt-1 text-sm text-tinta2">{emitidaEm(trilha.geradaEm)}</p>
        <p className="mt-3 max-w-[65ch] text-[15px]">{SUBTITULO_DA_TRILHA}</p>
      </header>

      <section className="mt-6" aria-labelledby="h-habilidades">
        <h2 id="h-habilidades" className="text-lg font-bold">{tituloDasHabilidades(primeiroNome)}</h2>
        {trilha.habilidades.length === 0 ? (
          <p className="texto-corrido mt-2 text-tinta2">{SEM_HABILIDADES}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {trilha.habilidades.map((h, i) => (
              <li key={i} className="rounded-lg border border-linha border-l-4 border-l-ok p-4">
                <p className="texto-corrido whitespace-pre-line text-[15px]">{h.descricaoAcessivel}</p>
                <p className="mt-1.5 text-sm font-bold text-ok">
                  <span aria-hidden="true">✓ </span>{desdeOMes(h.desde)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8" aria-labelledby="h-apoio">
        <h2 id="h-apoio" className="text-lg font-bold">{tituloDoApoio(primeiroNome)}</h2>
        {trilha.estrategias.length === 0 ? (
          <p className="texto-corrido mt-2 text-tinta2">{semEstrategias(primeiroNome)}</p>
        ) : (
          <div className="mt-3 flex flex-col gap-6">
            {trilha.estrategias.map((e, i) => (
              <article key={i} className="estrategia flex flex-col gap-3 border-linha not-first:border-t not-first:pt-6">
                <h3 className="text-base font-bold whitespace-pre-line">{e.tituloSimples}</h3>
                <div className="grid gap-3 [&>*]:min-w-0 md:grid-cols-2 lg:grid-cols-3">
                  <section className="rounded-xl border border-linha border-l-4 border-l-ok bg-ok-sup p-4">
                    <h4 className="flex items-center gap-2 text-[15px] font-bold">
                      <span aria-hidden="true">✓</span> O que fazer
                    </h4>
                    <ul className="mt-2 grid list-disc gap-2 pl-5 text-[15px] text-tinta2">
                      {e.oQueFazer.map((item, j) => <li key={j} className="texto-corrido whitespace-pre-line">{item}</li>)}
                    </ul>
                  </section>
                  <section className="rounded-xl border border-linha border-l-4 border-l-cr bg-cr-sup p-4">
                    <h4 className="flex items-center gap-2 text-[15px] font-bold">
                      <span aria-hidden="true">✕</span> O que evitar
                    </h4>
                    <ul className="mt-2 grid list-disc gap-2 pl-5 text-[15px] text-tinta2">
                      {e.oQueEvitar.map((item, j) => <li key={j} className="texto-corrido whitespace-pre-line">{item}</li>)}
                    </ul>
                  </section>
                  <section className="rounded-xl border border-linha border-l-4 border-l-at bg-at-sup p-4 md:col-span-2 lg:col-span-1">
                    <h4 className="flex items-center gap-2 text-[15px] font-bold">
                      <span aria-hidden="true">▲</span> Sinal de alerta
                    </h4>
                    <p className="texto-corrido mt-2 whitespace-pre-line text-[15px] text-tinta2">{e.sinalAlerta}</p>
                  </section>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </article>
  )
}
