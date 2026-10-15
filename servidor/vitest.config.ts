import { defaultServerConditions } from 'vite'
import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

/**
 * Nos testes, o servidor le o compartilhado pelo fonte, como o front: sem
 * build previo. Em producao, o Node le o JavaScript de compartilhado/dist —
 * por isso o build do servidor compila o compartilhado antes.
 *
 * O SWC no lugar do esbuild: o esbuild nao emite os metadados de decorador
 * que o NestJS usa para injetar dependencias pelo construtor, e o teste
 * passaria a compilar diferente da producao (tsc, com emitDecoratorMetadata).
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
    name: 'servidor',
    include: ['test/**/*.test.ts'],
    // Sobe o banco (do CI ou embutido), migra e semeia uma vez, antes de tudo.
    globalSetup: ['test/apoio/global.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
})
