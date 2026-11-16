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
/** Banco-sombra do `prisma migrate diff`: o Prisma o apaga e recria. */
const SOMBRA = 'sinctea_sombra'

const postgres = new EmbeddedPostgres({
  databaseDir: PASTA,
  port: PORTA,
  user: 'sinctea',
  password: 'sinctea',
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  /* Em UTC, como o CI (postgres:17) e o Neon. O adaptador pg do Prisma manda
     o instante como relogio de UTC, sem o fuso, e o banco o le no fuso da
     sessao: com o fuso da maquina (aqui, -04:00), cada instante seria
     gravado 4 horas adiantado, e o indice do dia de Manaus do agendamento
     (item 19b) contaria o dia de UTC. */
  postgresFlags: ['-c', 'TimeZone=UTC'],
  onLog: () => {},
})

if (!existsSync(join(PASTA, 'PG_VERSION'))) await postgres.initialise()
await postgres.start()

const cliente = postgres.getPgClient('postgres', 'localhost')
await cliente.connect()
for (const banco of [NOME, SOMBRA]) {
  const existe = await cliente.query('SELECT 1 FROM pg_database WHERE datname = $1', [banco])
  if (existe.rowCount === 0) await cliente.query(`CREATE DATABASE ${banco}`)
}
await cliente.end()

console.log(`PostgreSQL no ar: postgresql://sinctea:sinctea@localhost:${PORTA}/${NOME}`)
console.log('Ctrl+C para parar.')

const parar = async () => {
  await postgres.stop()
  process.exit(0)
}
process.on('SIGINT', parar)
process.on('SIGTERM', parar)
