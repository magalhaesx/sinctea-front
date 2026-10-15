import 'reflect-metadata'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import type { INestApplication } from '@nestjs/common'
import { frequenciaEmLinguagemCotidiana } from '@sinctea/compartilhado/dominio/regras'
import { criarAplicacao } from '../src/aplicacao.js'
import { PASTA_DO_SERVIDOR } from './apoio/banco.js'

/**
 * O servidor de verdade, numa porta qualquer, respondendo por HTTP: o prefixo
 * /api, a leitura do banco e o dominio compartilhado. A injecao do ServicoBanco
 * no controlador depende dos metadados de decorador — o que o SWC emite.
 */

const ULTIMA_MIGRACAO = readdirSync(join(PASTA_DO_SERVIDOR, 'prisma', 'migracoes'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort()
  .at(-1)

async function subir(urlBanco: string): Promise<{ aplicacao: INestApplication; endereco: string }> {
  // O ServicoBanco le a URL ao ser criado: trocar antes de montar a aplicacao.
  process.env.DATABASE_URL = urlBanco
  const aplicacao = await criarAplicacao({ logger: false })
  await aplicacao.listen(0, '127.0.0.1')
  return { aplicacao, endereco: await aplicacao.getUrl() }
}

describe('GET /api/saude com o banco no ar', () => {
  let aplicacao: INestApplication
  let endereco: string

  beforeAll(async () => ({ aplicacao, endereco } = await subir(inject('urlSemeado'))))
  afterAll(() => aplicacao.close())

  it('responde 200 com a ultima migracao e o dominio compartilhado — e nada alem', async () => {
    expect(ULTIMA_MIGRACAO).toBeTruthy()
    const resposta = await fetch(`${endereco}/api/saude`)
    expect(resposta.status).toBe(200)
    // toEqual, e nao toMatchObject: nenhuma contagem nem registro a mais.
    expect(await resposta.json()).toEqual({
      situacao: 'no ar',
      banco: { migracao: ULTIMA_MIGRACAO },
      dominio: {
        funcao: 'frequenciaEmLinguagemCotidiana',
        entrada: 70,
        saida: frequenciaEmLinguagemCotidiana(70),
      },
    })
  })

  it('so responde sob /api', async () => {
    expect((await fetch(`${endereco}/saude`)).status).toBe(404)
  })
})

describe('GET /api/saude com o banco fora do ar', () => {
  let aplicacao: INestApplication
  let endereco: string

  // Porta 1: ninguem escuta, e a conexao e recusada na hora.
  beforeAll(async () => ({ aplicacao, endereco } = await subir('postgresql://ninguem:x@127.0.0.1:1/nada')))
  afterAll(() => aplicacao.close())

  it('responde 503, sem descrever a infraestrutura', async () => {
    const resposta = await fetch(`${endereco}/api/saude`)
    expect(resposta.status).toBe(503)
    const corpo = JSON.stringify(await resposta.json())
    expect(corpo).not.toContain('127.0.0.1')
    expect(corpo).not.toContain('ninguem')
    expect(corpo).not.toContain('migracao')
  })
})
