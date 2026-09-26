import { describe, expect, it } from 'vitest'
import { jsonCanonico, resumoSha256 } from './hash'

describe('jsonCanonico', () => {
  it('ordena as chaves, em qualquer profundidade', () => {
    expect(jsonCanonico({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}')
  })

  it('mantem a ordem dos arrays: la a ordem e conteudo', () => {
    expect(jsonCanonico({ passos: ['segundo', 'primeiro'] })).toBe('{"passos":["segundo","primeiro"]}')
  })
})

describe('resumoSha256', () => {
  it('e o SHA-256 de verdade, nao um valor com cara de hash', async () => {
    // Vetor conhecido: SHA-256 da string JSON `"abc"`, com as aspas.
    const resumo = await resumoSha256('abc')
    expect(resumo).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(resumo).toBe('sha256:6cc43f858fbb763301637b5af970e2a46b46f461f27e5a0f41e009c59b827b25')
  })

  it('a ordem das chaves nao muda o resumo; o conteudo muda', async () => {
    const um = await resumoSha256({ a: 1, b: 2 })
    const outro = await resumoSha256({ b: 2, a: 1 })
    expect(um).toBe(outro)
    expect(await resumoSha256({ a: 1, b: 3 })).not.toBe(um)
  })
})
