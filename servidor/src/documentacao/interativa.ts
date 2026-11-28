import type { INestApplication } from '@nestjs/common'
import { SwaggerModule } from '@nestjs/swagger'
import { documentoOpenApi } from './openapi.js'

/** Onde a interface do Swagger mora, no desenvolvimento. */
export const CAMINHO_DA_DOCUMENTACAO = 'api/docs'

/**
 * A interface interativa do Swagger (item 25), so no desenvolvimento: quem
 * chama e criarAplicacao, fora de producao e de teste. Na imagem Docker o
 * @nestjs/swagger nem esta instalado.
 */
export function montarDocumentacaoInterativa(aplicacao: INestApplication, versao: string): void {
  SwaggerModule.setup(CAMINHO_DA_DOCUMENTACAO, aplicacao, () => documentoOpenApi(aplicacao, versao), {
    customSiteTitle: 'SINCTEA — API (desenvolvimento)',
  })
}
