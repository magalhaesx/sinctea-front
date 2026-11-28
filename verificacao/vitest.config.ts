import { defaultServerConditions } from 'vite'
import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

/**
 * Os testes que atravessam os pacotes (item 25): a fila do front (src/fila)
 * contra o servidor de verdade (servidor/), num banco descartavel. Moram fora
 * dos dois pacotes porque o teste de arquitetura proibe, com razao, que um
 * importe o outro; aqui e a verificacao, e nao o produto.
 *
 * O banco sobe como nos testes do servidor (servidor/test/apoio/global.ts): o
 * PostgreSQL do CI, ou um embutido. O SWC, pelo mesmo motivo de la: os
 * metadados de decorador do NestJS.
 */
export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2023',
      },
    }),
  ],
  ssr: { resolve: { conditions: ['fonte', ...defaultServerConditions] } },
  test: {
    name: 'verificacao',
    include: ['offline/**/*.test.ts'],
    globalSetup: ['../servidor/test/apoio/global.ts'],
    testTimeout: 300_000,
    hookTimeout: 180_000,
  },
})
