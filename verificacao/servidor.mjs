/**
 * O servidor da verificacao automatica (item 25): o pacote de producao do
 * front (dist/) servido pelo Nest de producao (servidor/dist), com a API em
 * /api, num banco descartavel, migrado e semeado com os dados ficticios da
 * semente. Usado pelo Playwright (acessibilidade e teclado) e pelo Lighthouse.
 *
 *   npm run build && npm run build:servidor
 *   SENHA_VERIFICACAO=... node verificacao/servidor.mjs
 *
 * O banco: com URL_ADMIN_VERIFICACAO (no CI, o postgres:17 do job), cria um
 * banco novo dentro dele; sem ela, sobe um PostgreSQL embutido e descartavel.
 * Nunca toca o Neon: nao le servidor/.env nem DATABASE_URL de fora, e roda
 * com a pasta verificacao/ como diretorio, onde nao ha .env.
 *
 * A senha das contas semeadas vem de SENHA_VERIFICACAO, que quem chama sorteia
 * a cada execucao. Ela nunca e impressa.
 */
import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SERVIDOR = join(RAIZ, 'servidor')
const doServidor = createRequire(join(SERVIDOR, 'package.json'))
const PORTA = Number(process.env.PORTA_VERIFICACAO ?? 4310)
const SENHA = process.env.SENHA_VERIFICACAO

if (!SENHA) {
  console.error('Defina SENHA_VERIFICACAO: a senha das contas ficticias deste banco descartavel.')
  process.exit(1)
}

const portaLivre = () => new Promise((resolver, rejeitar) => {
  const s = createServer()
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolver(port)) })
  s.on('error', rejeitar)
})

/** O servidor PostgreSQL: o do CI, ou um embutido nesta execucao. */
async function abrirPostgres() {
  const doCi = process.env.URL_ADMIN_VERIFICACAO
  if (doCi) return { urlAdministrativa: doCi, encerrar: async () => {} }
  const { default: EmbeddedPostgres } = await import(pathToFileURL(doServidor.resolve('embedded-postgres')).href)
  const porta = await portaLivre()
  const senha = randomBytes(12).toString('hex')
  const postgres = new EmbeddedPostgres({
    databaseDir: mkdtempSync(join(tmpdir(), 'sinctea-verificacao-')),
    port: porta, user: 'verificacao', password: senha, persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-c', 'TimeZone=UTC'], onLog: () => {},
  })
  await postgres.initialise()
  await postgres.start()
  return { urlAdministrativa: `postgresql://verificacao:${senha}@127.0.0.1:${porta}/postgres`, encerrar: () => postgres.stop() }
}

const comBanco = (urlAdministrativa, nome) => {
  const url = new URL(urlAdministrativa)
  url.pathname = `/${nome}`
  return url.toString()
}

async function executarSql(urlAdministrativa, sql) {
  const { default: pg } = await import(pathToFileURL(doServidor.resolve('pg')).href)
  const cliente = new pg.Client({ connectionString: urlAdministrativa })
  await cliente.connect()
  try { await cliente.query(sql) } finally { await cliente.end() }
}

const postgres = await abrirPostgres()
const nome = `sinctea_verificacao_${randomBytes(4).toString('hex')}`
await executarSql(postgres.urlAdministrativa, `CREATE DATABASE ${nome}`)
const urlDoBanco = comBanco(postgres.urlAdministrativa, nome)

let servidor = null
let encerrando = false
async function encerrar(codigo = 0) {
  if (encerrando) return
  encerrando = true
  servidor?.kill()
  try {
    await executarSql(postgres.urlAdministrativa, `DROP DATABASE IF EXISTS ${nome} WITH (FORCE)`)
  } catch { /* o banco embutido vai junto com a pasta */ }
  await postgres.encerrar()
  process.exit(codigo)
}
for (const sinal of ['SIGINT', 'SIGTERM']) process.on(sinal, () => { void encerrar(0) })

try {
  // As migracoes, com o Prisma CLI do servidor, como no CI.
  const migracao = spawnSync(process.execPath, [doServidor.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
    cwd: SERVIDOR, env: { ...process.env, DATABASE_URL: urlDoBanco }, encoding: 'utf8',
  })
  if (migracao.status !== 0) throw new Error(`As migracoes falharam:\n${migracao.stdout}\n${migracao.stderr}`)

  // A semente: so dados ficticios, com a senha desta execucao.
  const { semear } = await import(pathToFileURL(join(SERVIDOR, 'dist/prisma/semente.js')).href)
  const { PrismaClient } = await import(pathToFileURL(join(SERVIDOR, 'dist/src/gerado/client.js')).href)
  const { PrismaPg } = await import(pathToFileURL(doServidor.resolve('@prisma/adapter-pg')).href)
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: urlDoBanco }) })
  try {
    await semear(prisma, { senha: SENHA })
  } finally {
    await prisma.$disconnect()
  }

  // O servidor de producao, com o pacote de producao do front. Sem
  // RESEND_API_KEY: o envio de e-mail fica desligado, e nada sai daqui.
  const ambiente = { ...process.env, NODE_ENV: 'production', DATABASE_URL: urlDoBanco, PORT: String(PORTA), PASTA_DO_FRONT: join(RAIZ, 'dist') }
  for (const segredo of ['RESEND_API_KEY', 'EMAIL_REMETENTE', 'URL_PUBLICA', 'SENHA_VERIFICACAO', 'URL_ADMIN_VERIFICACAO']) delete ambiente[segredo]
  servidor = spawn(process.execPath, [join(SERVIDOR, 'dist/src/main.js')], { cwd: join(RAIZ, 'verificacao'), env: ambiente, stdio: 'inherit' })
  servidor.on('exit', (codigo) => { if (!encerrando) void encerrar(codigo ?? 1) })

  for (let i = 0; i < 60; i += 1) {
    try {
      const r = await fetch(`http://localhost:${PORTA}/api/saude`)
      if (r.ok) break
    } catch { /* ainda subindo */ }
    await new Promise((r) => setTimeout(r, 500))
  }
  console.log(`Servidor de verificacao em http://localhost:${PORTA} (banco descartavel, dados ficticios).`)
} catch (erro) {
  console.error(erro instanceof Error ? erro.message : erro)
  await encerrar(1)
}
