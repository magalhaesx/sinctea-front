import { existsSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../gerado/client.js'
import { retrato, zerarBanco } from './zerar.js'

/**
 * npm run zerar-banco -w @sinctea/servidor -- .env.dono
 *
 * Depois do ensaio, o banco volta a ficar vazio (docs/07, secao 0). Apaga o
 * esquema public inteiro — inclusive a auditoria —, aplica as migracoes sem
 * semente e devolve ao sinctea_app os privilegios do modelo versionado, sem
 * recriar o papel. Depois: npm run conferir-papel, e o primeiro administrador
 * de novo.
 *
 * O arquivo e obrigatorio, sem padrao: a URL direta do DONO, que o Lucas cola
 * num arquivo fora do git (servidor/.env.dono) e nunca no chat. O comando
 * nunca imprime a URL nem a senha. Antes de apagar, mostra o que existe e pede
 * que se digite o nome do banco.
 */

const PAPEL = 'sinctea_app'
const arquivo = process.argv[2]
if (!arquivo || !existsSync(arquivo)) {
  console.error('Diga o arquivo com a URL do dono: npm run zerar-banco -w @sinctea/servidor -- .env.dono')
  process.exit(1)
}
process.loadEnvFile(arquivo)
const url = process.env.DATABASE_URL
if (!url) {
  console.error(`${arquivo} nao tem DATABASE_URL.`)
  process.exit(1)
}
if (!process.stdin.isTTY) {
  console.error('Rode este comando num terminal interativo: ele pede confirmacao antes de apagar.')
  process.exit(1)
}

const dono = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
try {
  const antes = await retrato(dono)
  console.log(`Banco: ${antes.banco}, em ${new URL(url).hostname}`)
  console.log(`Conectado como: ${antes.usuario}`)
  console.log(`Hoje: ${antes.tabelas} tabelas, ${antes.usuarios ?? 0} usuarios, ${antes.pacientes ?? 0} pacientes.`)
  console.log('\nTudo isso sera apagado, inclusive a trilha de auditoria. Nao ha como desfazer.')
  const leitor = createInterface({ input: process.stdin, output: process.stdout })
  const digitado = (await leitor.question(`Para confirmar, digite o nome do banco (${antes.banco}): `)).trim()
  leitor.close()
  if (digitado !== antes.banco) {
    console.log('Nao confere. Nada foi apagado.')
    process.exitCode = 1
  } else {
    const aplicadas = await zerarBanco(dono, url, PAPEL)
    const depois = await retrato(dono)
    console.log(`\nZerado. Migracoes aplicadas: ${aplicadas.join(', ')}.`)
    console.log(`Agora: ${depois.tabelas} tabelas, ${depois.usuarios ?? 0} usuarios. Privilegios do ${PAPEL} reaplicados.`)
    console.log('\nFalta: npm run conferir-papel -w @sinctea/servidor -- .env.producao')
    console.log('e o primeiro administrador: npm run criar-administrador -w @sinctea/servidor -- .env.producao --nome "Nome Completo" --email voce@exemplo.com')
  }
} catch (erro) {
  console.error(`\nFalhou: ${(erro as Error).message}`)
  process.exitCode = 1
} finally {
  await dono.$disconnect()
}
