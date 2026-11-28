import { existsSync, readFileSync } from 'node:fs'

/**
 * A versao do servidor, do package.json dele: a do documento OpenAPI. Sobe as
 * pastas ate achar, porque o fonte (testes) e o dist/ ficam em alturas diferentes.
 */
function lerVersao(): string {
  for (let pasta = new URL('./', import.meta.url); ; pasta = new URL('../', pasta)) {
    const arquivo = new URL('package.json', pasta)
    if (existsSync(arquivo)) {
      const pacote = JSON.parse(readFileSync(arquivo, 'utf8')) as { name?: string; version: string }
      if (pacote.name === '@sinctea/servidor') return pacote.version
    }
    if (pasta.pathname === new URL('../', pasta).pathname) throw new Error('package.json do servidor nao encontrado.')
  }
}

export const VERSAO_DO_SERVIDOR = lerVersao()
