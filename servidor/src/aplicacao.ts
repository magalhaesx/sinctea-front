import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { NestFactory } from '@nestjs/core'
import type { NestApplicationOptions } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { ModuloAplicacao } from './modulo-aplicacao.js'

/**
 * Monta o servidor sem abrir porta. O main.ts e os testes chamam a mesma
 * funcao: o que o teste confere e o que vai ao ar.
 *
 * docs/07, D3: front e API no mesmo endereco. A API mora em /api; o build do
 * front, na raiz, quando PASTA_DO_FRONT diz onde ele esta (na imagem Docker,
 * /app/dist). Sem a variavel, so a API: no desenvolvimento, o front e o Vite.
 *
 * Nao ha fallback para o index.html: o HashRouter guarda a rota depois do #,
 * e o servidor so recebe "/". Caminho que nao e arquivo do front cai no 404
 * do Nest, em JSON — inclusive /api/qualquer-coisa.
 */
export async function criarAplicacao(opcoes: NestApplicationOptions = {}): Promise<NestExpressApplication> {
  const aplicacao = await NestFactory.create<NestExpressApplication>(ModuloAplicacao, opcoes)
  aplicacao.setGlobalPrefix('api')
  // Em toda resposta, da API e do front (docs/07, secao 0, item 5): o
  // navegador nao adivinha o tipo do arquivo, nao manda o endereco de origem
  // a outro site e nao deixa outra pagina emoldurar o sistema. Sem CSP, por
  // ora. Vem antes dos arquivos do front, para valer tambem para eles.
  aplicacao.disable('x-powered-by')
  aplicacao.use((_pedido: unknown, resposta: { setHeader(nome: string, valor: string): void }, seguir: () => void) => {
    resposta.setHeader('X-Content-Type-Options', 'nosniff')
    resposta.setHeader('Referrer-Policy', 'no-referrer')
    resposta.setHeader('X-Frame-Options', 'DENY')
    seguir()
  })
  // No Render, o pedido chega por um proxy: o IP da auditoria e o do
  // X-Forwarded-For que ele poe, e so o dele. Fora de producao, nenhum proxy.
  if (process.env.NODE_ENV === 'production') aplicacao.set('trust proxy', 1)

  const pastaDoFront = process.env.PASTA_DO_FRONT
  if (pastaDoFront) {
    const pasta = resolve(pastaDoFront)
    // Variavel apontando para lugar errado e erro de configuracao: o servidor
    // nao sobe, em vez de subir sem front e so responder 404.
    if (!existsSync(join(pasta, 'index.html'))) {
      throw new Error(`PASTA_DO_FRONT nao tem index.html: ${pasta}`)
    }
    aplicacao.useStaticAssets(pasta, { index: 'index.html', redirect: false })
  }
  return aplicacao
}
