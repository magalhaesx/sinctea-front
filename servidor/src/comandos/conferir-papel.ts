import { existsSync } from 'node:fs'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../gerado/client.js'
import { conferirPapel } from './zerar.js'

/**
 * npm run conferir-papel -w @sinctea/servidor -- .env.producao
 *
 * A conferencia do B3, versionada: conecta como o papel da aplicacao, com a
 * mesma URL do Render, e confere que ele le e escreve linha, nao e dono de
 * nada, nao cria tabela, nao da TRUNCATE nem desliga o trigger da auditoria,
 * e que o banco tem as migracoes versionadas. Nao grava nada: as duas
 * tentativas sao desfeitas. Nunca imprime a URL nem a senha.
 */

const PAPEL = 'sinctea_app'
const arquivo = process.argv[2] ?? '.env.producao'
if (!existsSync(arquivo)) {
  console.error(`Arquivo de ambiente nao encontrado: ${arquivo}`)
  process.exit(1)
}
process.loadEnvFile(arquivo)
if (!process.env.DATABASE_URL) {
  console.error(`${arquivo} nao tem DATABASE_URL.`)
  process.exit(1)
}

const comoPapel = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
try {
  const itens = await conferirPapel(comoPapel, PAPEL)
  for (const { rotulo, valor, ok } of itens) console.log(`${ok ? 'OK   ' : 'FALHA'} ${rotulo}: ${valor}`)
  const [{ usuarios }] = await comoPapel.$queryRawUnsafe<Array<{ usuarios: number }>>('SELECT count(*)::int AS usuarios FROM usuario')
  console.log(`info usuarios no banco: ${usuarios}`)
  const falhas = itens.filter((i) => !i.ok).length
  console.log(falhas === 0 ? '\nTudo conferido.' : `\n${falhas} conferencia(s) falharam.`)
  process.exitCode = falhas === 0 ? 0 : 1
} catch (erro) {
  console.error(`Falhou: ${(erro as Error).message}`)
  process.exitCode = 1
} finally {
  await comoPapel.$disconnect()
}
