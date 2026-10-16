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

// base relativo: o mesmo build funciona na raiz, servido pelo Nest (docs/07,
// D3), ou em qualquer outro caminho, sem precisar reconfigurar.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: { conditions: [FONTE, ...defaultClientConditions] },
  ssr: { resolve: { conditions: [FONTE, ...defaultServerConditions] } },
  // No desenvolvimento, com VITE_API_URL=/api, o Vite repassa a API ao Nest
  // (npm start -w @sinctea/servidor, porta 3000): o mesmo endereco unico que o
  // Render serve, e o cookie de sessao funciona sem CORS.
  server: { proxy: { '/api': 'http://localhost:3000' } },
  test: {
    // Um "npm test" na raiz roda os tres pacotes, e e esse o comando do CI.
    projects: [
      { extends: true, test: { name: 'front', include: ['src/**/*.test.{ts,tsx}'] } },
      'compartilhado',
      'servidor',
    ],
  },
})
