import 'reflect-metadata'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import type { INestApplication } from '@nestjs/common'
import { criarAplicacao } from '../src/aplicacao.js'

/**
 * O front servido pelo Nest (docs/07, D3): o build na raiz, a API em /api, e
 * nada de /api virando index.html. O front aqui e falso — uma pasta temporaria
 * com um index.html marcado —, para o teste nao depender do build.
 */

const MARCA = 'front-falso-do-teste'
let pasta: string

async function subir(pastaDoFront: string | undefined): Promise<{ aplicacao: INestApplication; endereco: string }> {
  process.env.DATABASE_URL = inject('urlSemeado')
  if (pastaDoFront === undefined) delete process.env.PASTA_DO_FRONT
  else process.env.PASTA_DO_FRONT = pastaDoFront
  const aplicacao = await criarAplicacao({ logger: false })
  await aplicacao.listen(0, '127.0.0.1')
  return { aplicacao, endereco: await aplicacao.getUrl() }
}

beforeAll(() => {
  pasta = mkdtempSync(join(tmpdir(), 'sinctea-front-'))
  writeFileSync(join(pasta, 'index.html'), `<!doctype html><title>${MARCA}</title><div id="root"></div>`)
  mkdirSync(join(pasta, 'assets'))
  writeFileSync(join(pasta, 'assets', 'app.js'), 'console.log("front falso")')
})

afterAll(() => {
  delete process.env.PASTA_DO_FRONT
  rmSync(pasta, { recursive: true, force: true })
})

describe('com PASTA_DO_FRONT', () => {
  let aplicacao: INestApplication
  let endereco: string

  beforeAll(async () => ({ aplicacao, endereco } = await subir(pasta)))
  afterAll(() => aplicacao.close())

  it('GET / devolve o index.html do front', async () => {
    const resposta = await fetch(`${endereco}/`)
    expect(resposta.status).toBe(200)
    expect(resposta.headers.get('content-type')).toMatch(/text\/html/)
    expect(await resposta.text()).toContain(MARCA)
  })

  it('os arquivos do build saem pelo caminho relativo', async () => {
    const resposta = await fetch(`${endereco}/assets/app.js`)
    expect(resposta.status).toBe(200)
    expect(await resposta.text()).toContain('front falso')
  })

  it('/api/saude continua JSON', async () => {
    const resposta = await fetch(`${endereco}/api/saude`)
    expect(resposta.status).toBe(200)
    expect(resposta.headers.get('content-type')).toMatch(/application\/json/)
    expect(await resposta.json()).toMatchObject({ situacao: 'no ar' })
  })

  it('/api/inexistente devolve 404 em JSON, nunca o index.html', async () => {
    for (const caminho of ['/api/inexistente', '/api', '/api/']) {
      const resposta = await fetch(`${endereco}${caminho}`)
      expect(resposta.status, caminho).toBe(404)
      expect(resposta.headers.get('content-type'), caminho).toMatch(/application\/json/)
      expect(await resposta.text(), caminho).not.toContain(MARCA)
    }
  })

  it('caminho que nao e arquivo do front tambem e 404, sem fallback: o HashRouter nao precisa', async () => {
    const resposta = await fetch(`${endereco}/familia/consentimento`)
    expect(resposta.status).toBe(404)
    expect(await resposta.text()).not.toContain(MARCA)
  })
})

describe('sem PASTA_DO_FRONT', () => {
  let aplicacao: INestApplication
  let endereco: string

  beforeAll(async () => ({ aplicacao, endereco } = await subir(undefined)))
  afterAll(() => aplicacao.close())

  it('so a API: GET / e 404', async () => {
    expect((await fetch(`${endereco}/`)).status).toBe(404)
    expect((await fetch(`${endereco}/api/saude`)).status).toBe(200)
  })
})

describe('com PASTA_DO_FRONT errada', () => {
  it('o servidor nao sobe', async () => {
    await expect(subir(join(pasta, 'assets'))).rejects.toThrow(/PASTA_DO_FRONT nao tem index.html/)
  })
})
