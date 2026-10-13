import { defaultServerConditions } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * Nos testes, o servidor le o compartilhado pelo fonte, como o front: sem
 * build previo. Em producao, o Node le o JavaScript de compartilhado/dist —
 * por isso o build do servidor compila o compartilhado antes.
 */
export default defineConfig({
  ssr: { resolve: { conditions: ['fonte', ...defaultServerConditions] } },
  test: {
    name: 'servidor',
    include: ['test/**/*.test.ts'],
  },
})
