/**
 * O resumo da cobertura (item 25), depois de "vitest run --coverage": linhas
 * e ramos de cada pacote e de cada modulo das regras criticas, somados a
 * partir de relatorios/cobertura/coverage-summary.json. Vai para o log e, no
 * CI, para o resumo do run. Quem reprova abaixo de 60% e o proprio vitest
 * (vite.config.ts, coverage.thresholds); aqui so se informa.
 */
import { appendFileSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const RAIZ = resolve(import.meta.dirname, '..')
const resumo = JSON.parse(readFileSync(resolve(RAIZ, 'relatorios/cobertura/coverage-summary.json'), 'utf8'))
const arquivos = Object.entries(resumo)
  .filter(([chave]) => chave !== 'total')
  .map(([caminho, m]) => ({ caminho: relative(RAIZ, caminho).replaceAll('\\', '/'), m }))

const GRUPOS = [
  ['Front (src)', (c) => c.startsWith('src/')],
  ['Compartilhado (compartilhado/src)', (c) => c.startsWith('compartilhado/src/')],
  ['Servidor (servidor/src e a semente)', (c) => c.startsWith('servidor/')],
  ['Todos os pacotes', () => true],
  ['Regra crítica · domínio (compartilhado/src/dominio)', (c) => c.startsWith('compartilhado/src/dominio/')],
  ['Regra crítica · acesso (servidor/src/acesso)', (c) => c.startsWith('servidor/src/acesso/')],
  ['Regra crítica · consentimento (servidor/src/familia)', (c) => c.startsWith('servidor/src/familia/')],
  ['Regra crítica · escola (servidor/src/escola)', (c) => c.startsWith('servidor/src/escola/')],
  ['Regra crítica · auditoria (servidor/src/auditoria)', (c) => c.startsWith('servidor/src/auditoria/')],
  ['Regra crítica · autenticação (servidor/src/autenticacao)', (c) => c.startsWith('servidor/src/autenticacao/')],
]

const pct = (coberto, total) => (total === 0 ? '—' : `${((100 * coberto) / total).toFixed(1)}%`)
const linhas = GRUPOS.map(([nome, pertence]) => {
  const soma = { l: 0, lt: 0, r: 0, rt: 0, n: 0 }
  for (const { caminho, m } of arquivos.filter((a) => pertence(a.caminho))) {
    soma.l += m.lines.covered; soma.lt += m.lines.total
    soma.r += m.branches.covered; soma.rt += m.branches.total
    soma.n += 1
  }
  return { nome, arquivos: soma.n, linhas: pct(soma.l, soma.lt), ramos: pct(soma.r, soma.rt) }
})

console.log('\nCobertura (linhas · ramos):')
for (const l of linhas) console.log(`  ${l.nome.padEnd(58)} ${l.linhas.padStart(7)} · ${l.ramos.padStart(7)}  (${l.arquivos} arquivos)`)

if (process.env.GITHUB_STEP_SUMMARY) {
  const tabela = ['### Cobertura (item 25)', '', '| Recorte | Linhas | Ramos | Arquivos |', '|---|---:|---:|---:|',
    ...linhas.map((l) => `| ${l.nome} | ${l.linhas} | ${l.ramos} | ${l.arquivos} |`),
    '', 'Limite: 60% de linhas e de ramos nas regras críticas (vite.config.ts).', '']
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, tabela.join('\n'))
}
