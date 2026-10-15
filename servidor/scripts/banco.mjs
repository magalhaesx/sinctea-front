/**
 * npm run banco -w @sinctea/servidor
 *
 * Sobe um PostgreSQL 17 de verdade, embutido (pacote embedded-postgres), sem
 * instalacao nem Docker. Os dados ficam em servidor/.banco/, fora do git, e
 * sobrevivem entre execucoes. Ctrl+C para parar.
 *
 * initdb com UTF8 e locale C, como o Neon: ordenacao e comparacao de texto
 * iguais na maquina de desenvolvimento e em producao.
 */
import EmbeddedPostgres from 'embedded-postgres'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PASTA = fileURLToPath(new URL('../.banco/', import.meta.url))
const PORTA = 54329
const NOME = 'sinctea'

const postgres = new EmbeddedPostgres({
  databaseDir: PASTA,
  port: PORTA,
  user: 'sinctea',
  password: 'sinctea',
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: () => {},
})

if (!existsSync(join(PASTA, 'PG_VERSION'))) await postgres.initialise()
await postgres.start()

const cliente = postgres.getPgClient('postgres', 'localhost')
await cliente.connect()
const existe = await cliente.query('SELECT 1 FROM pg_database WHERE datname = $1', [NOME])
if (existe.rowCount === 0) await cliente.query(`CREATE DATABASE ${NOME}`)
await cliente.end()

console.log(`PostgreSQL no ar: postgresql://sinctea:sinctea@localhost:${PORTA}/${NOME}`)
console.log('Ctrl+C para parar.')

const parar = async () => {
  await postgres.stop()
  process.exit(0)
}
process.on('SIGINT', parar)
process.on('SIGTERM', parar)
