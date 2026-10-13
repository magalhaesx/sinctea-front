/// <reference types="vitest/config" />
import { defaultClientConditions, defaultServerConditions, defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * @sinctea/compartilhado expoe o fonte TypeScript pela condicao "fonte". O
 * front compila esse fonte direto, sem build previo do pacote; o servidor, que
 * roda no Node, recebe o JavaScript de dist/. E o mesmo codigo nos dois lados.
 *
 * As duas listas valem: a do cliente para o navegador e o build, a do servidor
 * para o Vitest, que roda os testes no Node.
 */
const FONTE = 'fonte'

// base relativo: o site funciona em qualquer caminho do GitHub Pages
// (usuario.github.io/qualquer-nome-de-repositorio) sem precisar reconfigurar.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: { conditions: [FONTE, ...defaultClientConditions] },
  ssr: { resolve: { conditions: [FONTE, ...defaultServerConditions] } },
  test: {
    // Um "npm test" na raiz roda os tres pacotes, e e esse o comando do CI.
    projects: [
      { extends: true, test: { name: 'front', include: ['src/**/*.test.{ts,tsx}'] } },
      'compartilhado',
      'servidor',
    ],
  },
})
