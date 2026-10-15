import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import type { PrismaClient } from '../src/gerado/client.js'
import { PASTA_DO_SERVIDOR, clienteDe, criarBancoMigrado, nomeDescartavel } from './apoio/banco.js'

/**
 * O papel da aplicacao (docs/07, D4), criado com o SQL versionado de
 * prisma/papel-aplicacao.exemplo.sql — o mesmo que vai ao Neon, so com outro
 * nome de papel, outro banco e uma senha descartavel.
 *
 * A imutabilidade da auditoria tem duas camadas: o trigger recusa UPDATE e
 * DELETE, e o papel, que nao e dono, nao consegue desligar o trigger, dar
 * TRUNCATE nem criar tabela. Cada recusa e conferida pela mensagem do
 * PostgreSQL, e o que o papel pode fazer passa ao lado.
 */

const MODELO = readFileSync(join(PASTA_DO_SERVIDOR, 'prisma', 'papel-aplicacao.exemplo.sql'), 'utf8')

let admin: PrismaClient
let comoApp: PrismaClient
let apagar: () => Promise<void>
const papel = nomeDescartavel('sinctea_app_teste')

/** Os comandos do modelo, sem comentario, com o papel, o banco e a senha do teste. */
function comandosDoModelo(banco: string, senha: string): string[] {
  return MODELO
    .split('\n').filter((linha) => !linha.startsWith('--')).join('\n')
    .replaceAll('sinctea_app', papel)
    .replaceAll('neondb', `"${banco}"`)
    .replace('<senha>', senha)
    .split(';').map((c) => c.trim()).filter(Boolean)
}

beforeAll(async () => {
  const banco = await criarBancoMigrado(inject('urlAdministrativa'), 'sinctea_papel')
  apagar = banco.apagar
  const nomeDoBanco = new URL(banco.url).pathname.slice(1)
  const senha = randomBytes(16).toString('hex')

  // O dono do banco de teste roda o modelo, como o neondb_owner no Neon.
  admin = clienteDe(banco.url)
  for (const comando of comandosDoModelo(nomeDoBanco, senha)) await admin.$executeRawUnsafe(comando)

  const urlDoPapel = new URL(banco.url)
  urlDoPapel.username = papel
  urlDoPapel.password = senha
  comoApp = clienteDe(urlDoPapel.toString())
})

afterAll(async () => {
  await comoApp?.$disconnect()
  await admin?.$disconnect()
  await apagar?.()
  // O papel e do servidor inteiro, e nao do banco: sai depois que o banco sai.
  const servidor = clienteDe(inject('urlAdministrativa'))
  try {
    await servidor.$executeRawUnsafe(`DROP ROLE IF EXISTS "${papel}"`)
  } finally {
    await servidor.$disconnect()
  }
})

const auditoria = () => comoApp.registroAuditoria.create({ data: {
  ocorridoEm: new Date(), acao: 'LEITURA_AUTORIZADA', entidade: 'Paciente', origem: 'CLINICA',
  detalhe: 'Leitura feita pelo papel da aplicacao.',
} })

describe('o papel da aplicacao', () => {
  it('le e escreve linha: INSERT e SELECT na auditoria, e UPDATE e DELETE onde a tabela permite', async () => {
    const { id } = await auditoria()
    expect(await comoApp.registroAuditoria.findUnique({ where: { id } })).toMatchObject({ id })

    const escola = await comoApp.escola.create({ data: { nome: 'Escola Ficticia', rede: 'Municipal', municipio: 'Manaus' } })
    await expect(comoApp.escola.update({ where: { id: escola.id }, data: { nome: 'Outra' } })).resolves.toBeTruthy()
    await expect(comoApp.escola.delete({ where: { id: escola.id } })).resolves.toBeTruthy()
  })

  it('UPDATE e DELETE na auditoria sao recusados pelo trigger', async () => {
    const { id } = await auditoria()
    await expect(comoApp.registroAuditoria.update({ where: { id }, data: { detalhe: 'Reescrita.' } }))
      .rejects.toThrow(/registro imutavel/)
    await expect(comoApp.registroAuditoria.delete({ where: { id } })).rejects.toThrow(/registro imutavel/)
  })

  it('TRUNCATE e recusado por falta de privilegio', async () => {
    await expect(comoApp.$executeRawUnsafe('TRUNCATE registro_auditoria'))
      .rejects.toThrow(/permission denied for table registro_auditoria/)
  })

  it('desligar o trigger e recusado: o papel nao e dono da tabela', async () => {
    await expect(comoApp.$executeRawUnsafe('ALTER TABLE registro_auditoria DISABLE TRIGGER registro_auditoria_imutavel'))
      .rejects.toThrow(/must be owner of table registro_auditoria/)
  })

  it('criar tabela e recusado: sem CREATE no esquema', async () => {
    await expect(comoApp.$executeRawUnsafe('CREATE TABLE intrusa (id int)'))
      .rejects.toThrow(/permission denied for schema public/)
  })
})
