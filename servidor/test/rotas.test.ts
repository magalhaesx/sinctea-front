import 'reflect-metadata'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { INestApplication } from '@nestjs/common'
import { ModulesContainer } from '@nestjs/core'
import { PATH_METADATA } from '@nestjs/common/constants.js'
import { CHAVE_AUDITORIA, CHAVE_PERFIS, CHAVE_PUBLICO, type DeclaracaoAuditoria } from '../src/acesso/metadados.js'
import { criarAplicacao } from '../src/aplicacao.js'

/**
 * Toda rota do servidor declara a auditoria (regra 6; docs/07, D7). A guarda
 * ja recusa a rota sem declaracao em tempo de execucao; este teste acusa antes,
 * percorrendo os controladores registrados — inclusive os que ainda nao
 * existem hoje e entrarem depois.
 */

interface Rota { controlador: string; metodo: string; declaracao?: DeclaracaoAuditoria; publica: boolean; perfis?: string[] }

let aplicacao: INestApplication
const rotas: Rota[] = []

beforeAll(async () => {
  process.env.DATABASE_URL ??= 'postgresql://ninguem:x@127.0.0.1:1/nada'
  aplicacao = await criarAplicacao({ logger: false })
  for (const modulo of aplicacao.get(ModulesContainer).values()) {
    for (const { metatype } of modulo.controllers.values()) {
      if (!metatype || typeof metatype !== 'function') continue
      const prototipo = metatype.prototype as Record<string, unknown>
      for (const nome of Object.getOwnPropertyNames(prototipo)) {
        const metodo = prototipo[nome]
        if (nome === 'constructor' || typeof metodo !== 'function') continue
        if (Reflect.getMetadata(PATH_METADATA, metodo) === undefined) continue
        const ler = <T>(chave: string): T | undefined =>
          Reflect.getMetadata(chave, metodo) ?? Reflect.getMetadata(chave, metatype)
        rotas.push({
          controlador: metatype.name, metodo: nome,
          declaracao: ler<DeclaracaoAuditoria>(CHAVE_AUDITORIA),
          publica: ler<boolean>(CHAVE_PUBLICO) ?? false,
          perfis: ler<string[]>(CHAVE_PERFIS),
        })
      }
    }
  }
})

afterAll(() => aplicacao?.close())

describe('rotas do servidor', () => {
  it('existem, e o percurso as encontra', () => {
    expect(rotas.map((r) => `${r.controlador}.${r.metodo}`)).toEqual(expect.arrayContaining([
      'ControladorSaude.verificar', 'ControladorAutenticacao.entrar', 'ControladorAutenticacao.concluirPrimeiroAcesso',
    ]))
  })

  it('toda rota declara a auditoria, com @Auditar ou @SemDadoDoPaciente', () => {
    const semDeclaracao = rotas.filter((r) => !r.declaracao).map((r) => `${r.controlador}.${r.metodo}`)
    expect(semDeclaracao).toEqual([])
  })

  it('rota publica nao declara perfis: as duas marcas juntas se contradizem', () => {
    const contraditorias = rotas.filter((r) => r.publica && r.perfis).map((r) => `${r.controlador}.${r.metodo}`)
    expect(contraditorias).toEqual([])
  })
})
