import { defineConfig } from 'vitest/config'

// Os testes do dominio rodam sobre o fonte, sem build: importam por caminho
// relativo, de dentro do proprio pacote.
export default defineConfig({
  test: {
    name: 'compartilhado',
    include: ['src/**/*.test.ts'],
  },
})
