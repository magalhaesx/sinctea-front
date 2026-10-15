import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import EmbeddedPostgres from 'embedded-postgres'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../src/gerado/client.js'

/**
 * Bancos de teste. Cada suite que altera o banco ganha o seu, criado do zero
 * e migrado: a auditoria e o relatorio emitido nao aceitam DELETE nem
 * TRUNCATE, entao limpar entre testes e recriar, e nao apagar linha.
 *
 * Com DATABASE_URL_TESTE (o CI, com o servico postgres:17), os bancos sao
 * criados dentro dele. Sem ela, sobe um PostgreSQL 17 embutido, descartavel,
 * numa pasta temporaria. Nos dois casos, se nao subir, a suite falha — nenhum
 * teste de banco e pulado em silencio.
 */

export const PASTA_DO_SERVIDOR = fileURLToPath(new URL('../../', import.meta.url))
const CLI_DO_PRISMA = createRequire(import.meta.url).resolve('prisma/build/index.js')

export function clienteDe(url: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
}

/** Troca o banco de uma URL de conexao. */
function comBanco(url: string, banco: string): string {
  const u = new URL(url)
  u.pathname = `/${banco}`
  return u.toString()
}

export function nomeDescartavel(prefixo: string): string {
  return `${prefixo}_${randomBytes(4).toString('hex')}`
}

/** prisma migrate deploy, como em producao: aplica as migracoes versionadas. */
export function migrar(url: string): void {
  const r = spawnSync(process.execPath, [CLI_DO_PRISMA, 'migrate', 'deploy'], {
    cwd: PASTA_DO_SERVIDOR,
    env: { ...process.env, DATABASE_URL: url },
    encoding: 'utf8',
  })
  if (r.status !== 0) throw new Error(`prisma migrate deploy falhou:\n${r.stdout}\n${r.stderr}`)
}

/** Cria um banco vazio no servidor de teste e devolve a URL dele. */
export async function criarBanco(urlAdministrativa: string, nome: string): Promise<string> {
  const admin = clienteDe(urlAdministrativa)
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${nome}"`)
  } finally {
    await admin.$disconnect()
  }
  return comBanco(urlAdministrativa, nome)
}

export async function apagarBanco(urlAdministrativa: string, nome: string): Promise<void> {
  const admin = clienteDe(urlAdministrativa)
  try {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${nome}" WITH (FORCE)`)
  } finally {
    await admin.$disconnect()
  }
}

/** Um banco novo, ja migrado e sem semente: para quem testa o esquema. */
export async function criarBancoMigrado(urlAdministrativa: string, prefixo: string): Promise<{
  url: string
  apagar: () => Promise<void>
}> {
  const nome = nomeDescartavel(prefixo)
  const url = await criarBanco(urlAdministrativa, nome)
  migrar(url)
  return { url, apagar: () => apagarBanco(urlAdministrativa, nome) }
}

function portaLivre(): Promise<number> {
  return new Promise((resolver, rejeitar) => {
    const s = createServer()
    s.once('error', rejeitar)
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address() as { port: number }
      s.close(() => resolver(port))
    })
  })
}

export interface ServidorDeTeste {
  /** URL do banco "postgres" do servidor, de onde se criam os outros. */
  urlAdministrativa: string
  encerrar: () => Promise<void>
}

export async function abrirServidorDeTeste(): Promise<ServidorDeTeste> {
  const doCi = process.env.DATABASE_URL_TESTE
  if (doCi) return { urlAdministrativa: doCi, encerrar: async () => {} }

  const porta = await portaLivre()
  const senha = randomBytes(12).toString('hex')
  const postgres = new EmbeddedPostgres({
    databaseDir: mkdtempSync(join(tmpdir(), 'sinctea-teste-')),
    port: porta,
    user: 'teste',
    password: senha,
    // Descartavel: parar apaga a pasta.
    persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {},
  })
  await postgres.initialise()
  await postgres.start()
  return {
    urlAdministrativa: `postgresql://teste:${senha}@127.0.0.1:${porta}/postgres`,
    encerrar: () => postgres.stop(),
  }
}
