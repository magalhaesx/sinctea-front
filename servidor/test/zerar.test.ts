import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import type { PrismaClient } from '../src/gerado/client.js'
import {
  conferirPapel, migracoesVersionadas, privilegiosDoModelo, retrato, zerarBanco,
} from '../src/comandos/zerar.js'
import { PASTA_DO_SERVIDOR, clienteDe, criarBancoMigrado, nomeDescartavel } from './apoio/banco.js'

/**
 * O procedimento de zerar o banco depois do ensaio, antes de ele rodar no
 * Neon: o papel nasce do modelo versionado, o banco ganha dados, e o zerar
 * tem de deixar o esquema vazio, migrado, e o papel com os mesmos
 * privilegios — sem recriar o papel, para a senha do Render continuar valendo.
 * A conferencia do B3 roda depois, como o papel.
 */

const MODELO = readFileSync(join(PASTA_DO_SERVIDOR, 'prisma', 'papel-aplicacao.exemplo.sql'), 'utf8')
const papel = nomeDescartavel('sinctea_app_zerar')
const senha = randomBytes(16).toString('hex')
let url: string
let urlDoPapel: string
let dono: PrismaClient
let apagar: () => Promise<void>

beforeAll(async () => {
  const banco = await criarBancoMigrado(inject('urlAdministrativa'), 'sinctea_zerar')
  url = banco.url
  apagar = banco.apagar
  dono = clienteDe(url)
  const comandos = MODELO
    .split('\n').filter((linha) => !linha.startsWith('--')).join('\n')
    .replaceAll('sinctea_app', papel)
    .replaceAll('neondb', `"${new URL(url).pathname.slice(1)}"`)
    .replace('<senha>', senha)
    .split(';').map((c) => c.trim()).filter(Boolean)
  for (const comando of comandos) await dono.$executeRawUnsafe(comando)
  const u = new URL(url)
  u.username = papel
  u.password = senha
  urlDoPapel = u.toString()
  // O ensaio: dado gravado pela aplicacao, e a trilha que o trigger protege.
  const comoPapel = clienteDe(urlDoPapel)
  try {
    await comoPapel.escola.create({ data: { nome: 'Escola do Ensaio', rede: 'Municipal', municipio: 'Manaus' } })
    await comoPapel.registroAuditoria.create({ data: {
      ocorridoEm: new Date(), acao: 'CRIACAO', entidade: 'Escola', origem: 'FAMILIA', detalhe: 'Ensaio.',
    } })
  } finally {
    await comoPapel.$disconnect()
  }
})

afterAll(async () => {
  await dono?.$disconnect()
  await apagar?.()
  const servidor = clienteDe(inject('urlAdministrativa'))
  try {
    await servidor.$executeRawUnsafe(`DROP ROLE IF EXISTS "${papel}"`)
  } finally {
    await servidor.$disconnect()
  }
})

describe('zerar o banco depois do ensaio', () => {
  it('os privilegios saem do modelo versionado, sem o CREATE ROLE e sem o CONNECT', () => {
    expect(privilegiosDoModelo('x')).toEqual([
      'GRANT USAGE ON SCHEMA public TO "x"',
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "x"',
      'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "x"',
    ])
  })

  it('com a URL do papel, recusa antes de apagar qualquer coisa', async () => {
    const comoPapel = clienteDe(urlDoPapel)
    try {
      await expect(zerarBanco(comoPapel, urlDoPapel, papel)).rejects.toThrow(/papel da aplicacao/)
    } finally {
      await comoPapel.$disconnect()
    }
    expect(await dono.escola.count()).toBe(1)
  })

  it('com a do dono: esquema vazio, migrado, e a auditoria do ensaio tambem sai', async () => {
    expect((await retrato(dono)).tabelas).toBe(25)
    const aplicadas = await zerarBanco(dono, url, papel)
    expect(aplicadas).toEqual(migracoesVersionadas())
    const depois = await retrato(dono)
    expect(depois).toMatchObject({ tabelas: 25, usuarios: 0, pacientes: 0 })
    expect(await dono.escola.count()).toBe(0)
    expect(await dono.registroAuditoria.count()).toBe(0)
  })

  it('o papel continua, com a mesma senha, e passa na conferencia do B3', async () => {
    const comoPapel = clienteDe(urlDoPapel)
    try {
      const itens = await conferirPapel(comoPapel, papel)
      expect(itens.filter((i) => !i.ok)).toEqual([])
      expect(itens.map((i) => i.rotulo)).toEqual(expect.arrayContaining(['CREATE TABLE', 'desligar o trigger da auditoria']))
      // E a aplicacao volta a gravar.
      await expect(comoPapel.escola.create({ data: { nome: 'Depois', rede: 'Municipal', municipio: 'Manaus' } })).resolves.toBeTruthy()
    } finally {
      await comoPapel.$disconnect()
    }
  })

  it('a conferencia aponta o banco que ficou para tras das migracoes versionadas', async () => {
    const ultima = migracoesVersionadas().at(-1)!
    await dono.$executeRawUnsafe(`UPDATE _prisma_migrations SET rolled_back_at = now() WHERE migration_name = '${ultima}'`)
    const comoPapel = clienteDe(urlDoPapel)
    try {
      const falhas = (await conferirPapel(comoPapel, papel)).filter((i) => !i.ok)
      expect(falhas.map((i) => i.rotulo)).toEqual(['migracoes aplicadas'])
    } finally {
      await comoPapel.$disconnect()
      await dono.$executeRawUnsafe(`UPDATE _prisma_migrations SET rolled_back_at = NULL WHERE migration_name = '${ultima}'`)
    }
  })

  it('a tabela que uma migracao futura criar tambem chega ao papel: o ALTER DEFAULT PRIVILEGES voltou', async () => {
    await dono.$executeRawUnsafe('CREATE TABLE tabela_futura (id int)')
    const [{ basicos }] = await dono.$queryRawUnsafe<Array<{ basicos: boolean }>>(
      `SELECT has_table_privilege('${papel}', 'public.tabela_futura', 'SELECT,INSERT,UPDATE,DELETE') AS basicos`)
    expect(basicos).toBe(true)
    await dono.$executeRawUnsafe('DROP TABLE tabela_futura')
  })
})
