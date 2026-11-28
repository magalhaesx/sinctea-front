import { randomBytes } from 'node:crypto'
import { defineConfig, devices } from '@playwright/test'

/**
 * Verificacao automatica no navegador (item 25): acessibilidade com o axe e
 * os fluxos so com teclado, sobre o pacote de producao servido pelo Nest de
 * producao, num banco descartavel com os dados ficticios da semente
 * (verificacao/servidor.mjs). A semente nunca toca o Neon.
 *
 *   npm run build && npm run build:servidor
 *   npx playwright test
 *
 * A senha das contas ficticias e sorteada a cada execucao e passa pelo
 * ambiente: o servidor e os testes a recebem, e ela nao e impressa.
 */
process.env.SENHA_VERIFICACAO ??= randomBytes(18).toString('base64url')
const PORTA = Number(process.env.PORTA_VERIFICACAO ?? 4310)

export default defineConfig({
  testDir: 'verificacao/navegador',
  // Um banco so, com estado: os testes rodam em fila.
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI
    ? [['list'], ['html', { outputFolder: 'relatorios/playwright', open: 'never' }]]
    : [['list']],
  outputDir: 'relatorios/playwright-resultados',
  use: {
    baseURL: `http://localhost:${PORTA}`,
    locale: 'pt-BR',
    timezoneId: 'America/Manaus',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } }],
  webServer: {
    command: 'node verificacao/servidor.mjs',
    url: `http://localhost:${PORTA}/api/saude`,
    timeout: 240_000,
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
