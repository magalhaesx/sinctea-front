import 'reflect-metadata'
import { readFileSync } from 'node:fs'
import type { INestApplication } from '@nestjs/common'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { criarAplicacao } from '../src/aplicacao.js'
import { documentoOpenApi } from '../src/documentacao/openapi.js'
import { VERSAO_DO_SERVIDOR } from '../src/documentacao/versao.js'

/**
 * Item 25: o contrato da API em docs/api/openapi.json e o que o codigo gera.
 * Rota nova, perfil trocado ou declaracao de auditoria mudada sem gerar de
 * novo: o CI reprova. Para gerar: npm run openapi -w @sinctea/servidor.
 *
 * E a interface do Swagger so no desenvolvimento: em producao, 404.
 */

const VERSIONADO = new URL('../../docs/api/openapi.json', import.meta.url)
let aplicacao: INestApplication
let gerado: Record<string, any>

beforeAll(async () => {
  process.env.DATABASE_URL ??= 'postgresql://ninguem:x@127.0.0.1:1/nada'
  aplicacao = await criarAplicacao({ logger: false })
  // Pelo JSON, como o comando grava: o que conta e o arquivo, e nao o objeto em memoria.
  gerado = JSON.parse(JSON.stringify(documentoOpenApi(aplicacao, VERSAO_DO_SERVIDOR)))
})

afterAll(() => aplicacao?.close())

const operacoes = (doc: Record<string, any>) =>
  Object.entries(doc.paths as Record<string, Record<string, any>>).flatMap(([caminho, metodos]) =>
    Object.entries(metodos).map(([metodo, op]) => ({ caminho, metodo, op })))

describe('o contrato da API (item 25)', () => {
  it('docs/api/openapi.json esta em dia com as rotas: se nao, rode "npm run openapi -w @sinctea/servidor"', () => {
    const versionado = JSON.parse(readFileSync(VERSIONADO, 'utf8'))
    expect(versionado, 'docs/api/openapi.json desatualizado: rode "npm run openapi -w @sinctea/servidor" e versione o resultado').toEqual(gerado)
  })

  it('toda operacao tem area, perfis ou a marca de publica, e o que registra na trilha', () => {
    const lista = operacoes(gerado)
    expect(lista.length).toBeGreaterThan(80)
    for (const { caminho, metodo, op } of lista) {
      const onde = `${metodo.toUpperCase()} ${caminho}`
      expect(caminho, onde).toMatch(/^\/api\//)
      expect(op.tags, onde).toHaveLength(1)
      expect(op.tags[0], onde).not.toMatch(/^Controlador/)
      expect(op.description, onde).toMatch(/^(Pública: não pede sessão\.|Qualquer perfil com sessão\.|Perfis: [A-Z_, ]+\.) /)
      expect(op.description, onde).not.toContain('Sem declaração de auditoria')
      expect(op.security, onde).toEqual(op.description.startsWith('Pública') ? [] : [{ sessao: [], aba: [] }])
    }
    // As rotas de dado do paciente dizem o que registram; a trilha de autonomia, por exemplo.
    const trilha = lista.find((o) => o.caminho === '/api/familia/filhos/{id}/trilha')!
    expect(trilha.op.description).toBe('Perfis: RESPONSAVEL. Registra LEITURA_AUTORIZADA na entidade TrilhaAutonomia, com o paciente; a negativa entra como ACESSO_NEGADO.')
  })

  it('nenhum exemplo, e-mail, senha nem token no documento', () => {
    const texto = JSON.stringify(gerado)
    expect(texto).not.toMatch(/"examples?"\s*:/)
    expect(texto).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)
    // Nada com cara de token: hexadecimal longo, ou 24 ou mais caracteres de
    // base64 com digitos misturados (o nome de um controlador nao tem digito).
    expect(texto).not.toMatch(/[0-9a-f]{32,}/i)
    expect(texto).not.toMatch(/(?=[A-Za-z0-9_-]*\d[A-Za-z0-9_-]*\d[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{24,}/)
  })
})

describe('a interface do Swagger, so no desenvolvimento', () => {
  const pedirDocumentacao = async (ambiente: string) => {
    const antes = process.env.NODE_ENV
    process.env.NODE_ENV = ambiente
    const app = await criarAplicacao({ logger: false })
    process.env.NODE_ENV = antes
    try {
      await app.listen(0, '127.0.0.1')
      const r = await fetch(`${await app.getUrl()}/api/docs`)
      return { status: r.status, texto: await r.text() }
    } finally {
      await app.close()
    }
  }

  it('fora de producao, /api/docs abre a interface', async () => {
    const r = await pedirDocumentacao('development')
    expect(r.status).toBe(200)
    expect(r.texto).toContain('swagger-ui')
  })

  it('em producao, /api/docs nao existe', async () => {
    const r = await pedirDocumentacao('production')
    expect(r.status).toBe(404)
    expect(r.texto).not.toContain('swagger')
  })
})
