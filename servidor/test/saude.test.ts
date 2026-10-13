import 'reflect-metadata'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { INestApplication } from '@nestjs/common'
import { frequenciaEmLinguagemCotidiana } from '@sinctea/compartilhado/dominio/regras'
import { criarAplicacao } from '../src/aplicacao.js'

/**
 * O servidor de verdade, numa porta qualquer, respondendo por HTTP. Prova o
 * prefixo /api e que o dominio importado e o mesmo que o front usa.
 */
describe('GET /api/saude', () => {
  let aplicacao: INestApplication
  let endereco: string

  beforeAll(async () => {
    aplicacao = await criarAplicacao({ logger: false })
    await aplicacao.listen(0, '127.0.0.1')
    endereco = await aplicacao.getUrl()
  })

  afterAll(async () => {
    await aplicacao.close()
  })

  it('responde com um calculo do dominio compartilhado', async () => {
    const resposta = await fetch(`${endereco}/api/saude`)
    expect(resposta.status).toBe(200)
    expect(await resposta.json()).toEqual({
      situacao: 'no ar',
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
