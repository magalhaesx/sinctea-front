/**
 * Desempenho (item 25): o Lighthouse na tela de entrada, sobre o pacote de
 * producao servido localmente pelo Nest de producao (verificacao/servidor.mjs),
 * com o celular emulado e a rede de 3G. So relatorio: a meta do pre-projeto e
 * o primeiro conteudo em menos de 2 s em 3G, e o resultado vai para o log,
 * para o resumo do run e para relatorios/lighthouse, sem reprovar o CI.
 *
 *   npm run build && npm run build:servidor
 *   npx playwright install chromium
 *   npm run verificar:desempenho
 *
 * O perfil de rede e o "3G" do proprio Lighthouse (mobileRegular3G, em
 * lighthouse/core/config/constants.js): 300 ms de ida e volta, 700 kbit/s, e a
 * CPU 4 vezes mais lenta, pelo metodo simulado. O Chromium e o do Playwright,
 * o mesmo no CI e na maquina de desenvolvimento, aberto com uma porta de
 * depuracao a que o Lighthouse se conecta.
 */
import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORTA = 4320
const PORTA_DO_NAVEGADOR = 9333
const VERSAO_DO_LIGHTHOUSE = '13.6.0'
const ENDERECO = `http://localhost:${PORTA}/#/app/entrar`
const SAIDA = join(RAIZ, 'relatorios', 'lighthouse')
const META_FCP_MS = 2000
export const PERFIL_3G = { rttMs: 300, throughputKbps: 700, cpuSlowdownMultiplier: 4 }

mkdirSync(SAIDA, { recursive: true })
const servidor = spawn(process.execPath, [join(RAIZ, 'verificacao', 'servidor.mjs')], {
  cwd: RAIZ, stdio: 'inherit',
  env: { ...process.env, PORTA_VERIFICACAO: String(PORTA), SENHA_VERIFICACAO: randomBytes(18).toString('base64url') },
})

/**
 * O "headless shell" que o Playwright instala junto com o Chromium: e o que ele
 * mesmo usa nos testes, e abre em qualquer maquina em que os testes abrem. Sem
 * ele, o Chromium completo.
 */
function navegadorDoPlaywright() {
  const completo = chromium.executablePath()
  const shell = completo.replace(/chromium-(\d+)([\\/])chrome-([^\\/]+)[\\/]chrome(\.exe)?$/,
    (_t, versao, barra, plataforma, exe = '') => `chromium_headless_shell-${versao}${barra}chrome-headless-shell-${plataforma}${barra}chrome-headless-shell${exe}`)
  return shell !== completo && existsSync(shell) ? shell : completo
}

function encerrarServidor() {
  if (servidor.exitCode !== null) return
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' })
  else servidor.kill('SIGTERM')
}

let codigo = 0
let navegador = null
try {
  let pronto = false
  for (let i = 0; i < 240 && !pronto; i += 1) {
    try { pronto = (await fetch(`http://localhost:${PORTA}/api/saude`)).ok } catch { /* subindo */ }
    if (!pronto) await new Promise((r) => setTimeout(r, 500))
  }
  if (!pronto) throw new Error('O servidor de verificacao nao subiu.')

  // O Chromium do Playwright, aberto aqui com uma porta de depuracao e um perfil
  // descartavel: o Lighthouse se conecta a ele, em vez de lancar um navegador.
  const executavel = navegadorDoPlaywright()
  navegador = spawn(executavel, [
    ...(executavel.includes('headless') ? [] : ['--headless=new']), `--remote-debugging-port=${PORTA_DO_NAVEGADOR}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'sinctea-lighthouse-'))}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', ...(process.platform === 'linux' ? ['--no-sandbox'] : []), 'about:blank',
  ], { stdio: 'ignore' })
  let navegadorPronto = false
  for (let i = 0; i < 60 && !navegadorPronto; i += 1) {
    try { navegadorPronto = (await fetch(`http://127.0.0.1:${PORTA_DO_NAVEGADOR}/json/version`)).ok } catch { /* abrindo */ }
    if (!navegadorPronto) await new Promise((r) => setTimeout(r, 250))
  }
  if (!navegadorPronto) throw new Error('O Chromium nao abriu a porta de depuracao.')
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  const r = spawnSync(npx, [
    '--yes', `lighthouse@${VERSAO_DO_LIGHTHOUSE}`, ENDERECO,
    '--only-categories=performance', '--form-factor=mobile', '--throttling-method=simulate',
    `--throttling.rttMs=${PERFIL_3G.rttMs}`, `--throttling.throughputKbps=${PERFIL_3G.throughputKbps}`,
    `--throttling.cpuSlowdownMultiplier=${PERFIL_3G.cpuSlowdownMultiplier}`,
    '--output=json', '--output=html', `--output-path=${join(SAIDA, 'entrada')}`,
    `--port=${PORTA_DO_NAVEGADOR}`, '--quiet',
  ], { cwd: RAIZ, stdio: 'inherit', shell: process.platform === 'win32' })
  if (r.status !== 0) throw new Error(`O Lighthouse falhou (saida ${r.status}).`)

  const laudo = JSON.parse(readFileSync(join(SAIDA, 'entrada.report.json'), 'utf8'))
  const ms = (id) => Math.round(laudo.audits[id].numericValue)
  const medidas = {
    fcp: ms('first-contentful-paint'), lcp: ms('largest-contentful-paint'), si: ms('speed-index'),
    tbt: ms('total-blocking-time'), nota: Math.round(laudo.categories.performance.score * 100),
  }
  const veredito = medidas.fcp < META_FCP_MS ? 'dentro da meta' : 'fora da meta'
  const linha = `Lighthouse ${laudo.lighthouseVersion}, tela de entrada, celular em 3G (${PERFIL_3G.rttMs} ms, ${PERFIL_3G.throughputKbps} kbit/s, CPU ${PERFIL_3G.cpuSlowdownMultiplier}x): ` +
    `FCP ${medidas.fcp} ms (${veredito} de ${META_FCP_MS} ms) · LCP ${medidas.lcp} ms · Speed Index ${medidas.si} ms · TBT ${medidas.tbt} ms · nota ${medidas.nota}.`
  console.log(`\n${linha}`)
  if (process.env.GITHUB_ACTIONS) console.log(`::notice title=Desempenho (Lighthouse)::${linha}`)
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
      '### Desempenho (item 25)', '', '| Medida | Valor |', '|---|---:|',
      `| Primeiro conteúdo (FCP) | ${medidas.fcp} ms |`, `| Maior conteúdo (LCP) | ${medidas.lcp} ms |`,
      `| Speed Index | ${medidas.si} ms |`, `| Tempo de bloqueio (TBT) | ${medidas.tbt} ms |`, `| Nota de desempenho | ${medidas.nota} |`,
      '', `Tela de entrada, pacote de produção, celular emulado, rede 3G simulada (${PERFIL_3G.rttMs} ms, ${PERFIL_3G.throughputKbps} kbit/s, CPU ${PERFIL_3G.cpuSlowdownMultiplier}x). Meta: FCP abaixo de ${META_FCP_MS} ms — ${veredito}.`, '',
    ].join('\n'))
  }
} catch (erro) {
  console.error(erro instanceof Error ? erro.message : erro)
  codigo = 1
} finally {
  navegador?.kill()
  encerrarServidor()
}
process.exit(codigo)
