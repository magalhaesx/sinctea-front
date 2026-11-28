import 'reflect-metadata'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * npm run openapi -w @sinctea/servidor
 *
 * Gera docs/api/openapi.json do proprio codigo (item 25). Nao conecta a banco
 * nenhum: monta o servidor sem abrir porta, le as rotas e grava o documento.
 * O teste servidor/test/openapi.test.ts reprova o CI se o arquivo versionado
 * ficar diferente do que este comando gera.
 */
process.env.DATABASE_URL = 'postgresql://ninguem:x@127.0.0.1:1/nada'
process.env.NODE_ENV = 'test'
const { criarAplicacao } = await import('../aplicacao.js')
const { documentoOpenApi } = await import('../documentacao/openapi.js')
const { VERSAO_DO_SERVIDOR } = await import('../documentacao/versao.js')

const destino = fileURLToPath(new URL('../../../../docs/api/openapi.json', import.meta.url))
const aplicacao = await criarAplicacao({ logger: false })
try {
  const documento = documentoOpenApi(aplicacao, VERSAO_DO_SERVIDOR)
  mkdirSync(dirname(destino), { recursive: true })
  writeFileSync(destino, `${JSON.stringify(documento, null, 2)}\n`)
  console.log(`Gravado: docs/api/openapi.json (${Object.keys(documento.paths).length} caminhos).`)
} finally {
  await aplicacao.close()
}
