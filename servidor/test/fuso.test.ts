import 'reflect-metadata'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import type { INestApplication } from '@nestjs/common'
import { instanteEmManaus } from '@sinctea/compartilhado/dominio/agenda'
import { criarAplicacao } from '../src/aplicacao.js'
import type { PrismaClient } from '../src/gerado/client.js'
import { PASTA_DO_SERVIDOR, apagarBanco, clienteDe, migrar, nomeDescartavel } from './apoio/banco.js'
import { criarUsuario } from './apoio/api.js'

/**
 * Item 19c: o banco em UTC, gravado no proprio banco pela migracao
 * fuso_do_banco. O adaptador pg do Prisma manda o instante como relogio de
 * UTC, sem o deslocamento, e o PostgreSQL o le no fuso da sessao: fora de UTC,
 * cada instante seria gravado deslocado.
 *
 * O banco deste teste nasce com o padrao em America/Manaus, de proposito: o
 * padrao do proprio banco vale sobre o do servidor de teste, que sobe em UTC
 * (test/apoio/banco.ts) — e o primeiro teste confere que a sessao nasce mesmo
 * em -04:00. As migracoes sao aplicadas por um dono do banco que nao e
 * superusuario, como o neondb_owner no Neon.
 */

const SEGREDO = `s${Math.random().toString(36).slice(2)}`
const dono = nomeDescartavel('dono_fuso')
const intruso = nomeDescartavel('intruso_fuso')
const banco = nomeDescartavel('sinctea_fuso')
let admin: PrismaClient
let url: string
let urlDoDono: string

const MANAUS = -4 * 3600
const deslocamento = async (p: PrismaClient) =>
  Number((await p.$queryRaw<Array<{ d: number }>>`SELECT EXTRACT(TIMEZONE FROM now())::int AS d`)[0].d)

/** Uma conexao nova: o fuso da sessao e decidido quando ela abre. */
async function comConexaoNova<T>(endereco: string, fazer: (p: PrismaClient) => Promise<T>): Promise<T> {
  const p = clienteDe(endereco)
  try {
    return await fazer(p)
  } finally {
    await p.$disconnect()
  }
}

const comoBanco = (base: string, nome: string, usuario?: { nome: string; senha: string }) => {
  const u = new URL(base)
  u.pathname = `/${nome}`
  if (usuario) {
    u.username = usuario.nome
    u.password = usuario.senha
  }
  return u.toString()
}

beforeAll(async () => {
  const urlAdministrativa = inject('urlAdministrativa')
  admin = clienteDe(urlAdministrativa)
  await admin.$executeRawUnsafe(`CREATE ROLE "${dono}" LOGIN PASSWORD '${SEGREDO}' NOSUPERUSER NOCREATEDB NOCREATEROLE`)
  await admin.$executeRawUnsafe(`CREATE ROLE "${intruso}" LOGIN PASSWORD '${SEGREDO}' NOSUPERUSER NOCREATEDB NOCREATEROLE`)
  await admin.$executeRawUnsafe(`CREATE DATABASE "${banco}" OWNER "${dono}"`)
  await admin.$executeRawUnsafe(`ALTER DATABASE "${banco}" SET timezone TO 'America/Manaus'`)
  url = comoBanco(urlAdministrativa, banco)
  urlDoDono = comoBanco(urlAdministrativa, banco, { nome: dono, senha: SEGREDO })
}, 60_000)

afterAll(async () => {
  await apagarBanco(inject('urlAdministrativa'), banco)
  await admin.$executeRawUnsafe(`DROP ROLE IF EXISTS "${dono}"`)
  await admin.$executeRawUnsafe(`DROP ROLE IF EXISTS "${intruso}"`)
  await admin.$disconnect()
})

describe('a migracao fuso_do_banco (item 19c)', () => {
  it('antes das migracoes, a sessao nasce em -04:00: o padrao do banco vale sobre o do servidor de teste', async () => {
    expect(await comConexaoNova(urlDoDono, deslocamento)).toBe(MANAUS)
  })

  it('aplicada pelo dono do banco, que nao e superusuario, deixa toda conexao nova em UTC', async () => {
    migrar(urlDoDono)
    for (const endereco of [urlDoDono, url]) {
      expect(await comConexaoNova(endereco, deslocamento)).toBe(0)
      expect(await comConexaoNova(endereco, async (p) =>
        (await p.$queryRaw<Array<{ fuso: string }>>`SELECT current_setting('TimeZone') AS fuso`)[0].fuso)).toBe('UTC')
    }
  }, 120_000)

  it('o Prisma grava e le as 23h30 de Manaus no instante que o SQL calcula, e o indice do mesmo dia acerta a borda', async () => {
    await comConexaoNova(url, async (p) => {
      const ana = await criarUsuario(p, { email: 'ana@fuso.example', perfis: ['TERAPEUTA'] })
      const paciente = await p.paciente.create({ data: {
        nome: 'Paciente Ficticio', dataNascimento: new Date('2019-03-12T00:00:00Z'), nivelSuporte: 2,
        profissionalResponsavelId: ana, ativo: true,
      } })
      const agendada = (instante: Date) => p.sessao.create({ data: {
        pacienteId: paciente.id, profissionalId: ana, numero: null, inicioPrevistoEm: instante, inicio: null,
        local: 'Sala 1', situacao: 'AGENDADA', statusSync: 'SINCRONIZADO',
      } })

      const as2330 = instanteEmManaus('2026-11-16', '23:30')!
      expect(as2330.toISOString()).toBe('2026-11-17T03:30:00.000Z')
      const s = await agendada(as2330)
      expect(s.inicioPrevistoEm.toISOString()).toBe(as2330.toISOString())
      expect((await p.sessao.findUniqueOrThrow({ where: { id: s.id } })).inicioPrevistoEm.toISOString()).toBe(as2330.toISOString())
      const [sql] = await p.$queryRaw<Array<{ ms: number; manaus: string }>>`
        SELECT (EXTRACT(EPOCH FROM "inicioPrevistoEm") * 1000)::float8 AS ms,
               ("inicioPrevistoEm" AT TIME ZONE 'America/Manaus')::text AS manaus
        FROM sessao WHERE id = ${s.id}::uuid`
      expect(Number(sql.ms)).toBe(as2330.getTime())
      expect(sql.manaus).toBe('2026-11-16 23:30:00')

      // 00h30 do dia 17 e outro dia em Manaus, embora seja o mesmo dia em UTC.
      await expect(agendada(instanteEmManaus('2026-11-17', '00:30')!)).resolves.toBeTruthy()
      // 08h do dia 16 e o mesmo dia em Manaus, embora seja outro dia em UTC.
      await expect(agendada(instanteEmManaus('2026-11-16', '08:00')!)).rejects.toThrow(/Unique constraint|sessao_agendada_paciente_profissional_dia_key/)
    })
  })

  it('quem nao e dono do banco e recusado antes de mudar qualquer coisa', async () => {
    await admin.$executeRawUnsafe(`ALTER DATABASE "${banco}" SET timezone TO 'America/Manaus'`)
    const sql = readFileSync(join(PASTA_DO_SERVIDOR, 'prisma', 'migracoes', '20261116120000_fuso_do_banco', 'migration.sql'), 'utf8')
    await comConexaoNova(url, async (p) => {
      await expect(p.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "${intruso}"`)
        await tx.$executeRawUnsafe(sql)
      })).rejects.toThrow(/precisa ser aplicada pelo dono do banco/)
    })
    expect(await comConexaoNova(url, deslocamento)).toBe(MANAUS)
    // O dono aplica de novo, e o banco volta a UTC.
    await comConexaoNova(urlDoDono, (p) => p.$executeRawUnsafe(sql))
    expect(await comConexaoNova(url, deslocamento)).toBe(0)
  })
})

describe('GET /api/saude confere o fuso da sessao', () => {
  async function saude(): Promise<{ status: number; corpo: unknown }> {
    process.env.DATABASE_URL = url
    const aplicacao: INestApplication = await criarAplicacao({ logger: false })
    try {
      await aplicacao.listen(0, '127.0.0.1')
      const r = await fetch(`${await aplicacao.getUrl()}/api/saude`)
      return { status: r.status, corpo: await r.json() }
    } finally {
      await aplicacao.close()
    }
  }

  it('fora de UTC, 503 com o motivo, sem dizer qual e o fuso', async () => {
    await admin.$executeRawUnsafe(`ALTER DATABASE "${banco}" SET timezone TO 'America/Manaus'`)
    const r = await saude()
    expect(r.status).toBe(503)
    const corpo = JSON.stringify(r.corpo)
    expect(corpo).toContain('O banco de dados não está em UTC: os horários seriam gravados deslocados.')
    for (const configuracao of ['Manaus', 'America', '-04', '14400', banco, dono]) expect(corpo).not.toContain(configuracao)
  })

  it('em UTC, 200 com a ultima migracao', async () => {
    await admin.$executeRawUnsafe(`ALTER DATABASE "${banco}" SET timezone TO 'UTC'`)
    const r = await saude()
    expect(r.status).toBe(200)
    // A ultima da pasta: a fuso_do_banco foi a ultima ate o item 23.
    const ultima = readdirSync(join(PASTA_DO_SERVIDOR, 'prisma', 'migracoes'), { withFileTypes: true })
      .filter((d) => d.isDirectory()).map((d) => d.name).sort().at(-1)
    expect(r.corpo).toMatchObject({ situacao: 'no ar', banco: { migracao: ultima } })
  })
})
