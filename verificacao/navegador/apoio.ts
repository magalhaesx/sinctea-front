import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, type TestInfo } from '@playwright/test'

/**
 * O apoio comum dos testes no navegador (item 25): entrar com uma conta
 * ficticia da semente, chamar a API como a propria aba chamaria, e passar o
 * axe com as tags da meta (WCAG 2.2 AA).
 */

/** As contas da semente (servidor/prisma/semente/dados.ts), todas ficticias. */
export const CONTAS = {
  profissional: 'ana.correia@clinica.example',
  coordenacao: 'juliana.maciel@clinica.example',
  familia: 'patricia.santana@familia.example',
  escola: 'carla.nunes@escola.example',
} as const

export const TAGS_WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
/** O CI falha com estas; as outras ficam no relatorio. */
export const IMPACTOS_QUE_FALHAM = ['critical', 'serious']

export const senha = () => {
  const s = process.env.SENHA_VERIFICACAO
  if (!s) throw new Error('SENHA_VERIFICACAO nao veio do playwright.config.ts.')
  return s
}

/** Entra pela tela 1, como a pessoa entraria, e espera o painel do perfil. */
export async function entrar(page: Page, email: string): Promise<void> {
  await page.goto('/#/app/entrar')
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(senha())
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.waitForURL((url) => /#\/app\/(?!entrar)/.test(url.hash) || /#\/app\/(?!entrar)/.test(url.href))
  await esperarCarregar(page)
}

/**
 * A API como a aba a chama: com o cookie da vaga e o cabecalho X-Sinctea-Aba
 * (item 9). Serve para descobrir os ids da semente e preparar o que a tela
 * precisa mostrar.
 */
export async function api<T = any>(page: Page, metodo: string, caminho: string, corpo?: unknown): Promise<{ status: number; corpo: T }> {
  return page.evaluate(async ({ metodo, caminho, corpo }) => {
    const vaga = sessionStorage.getItem('sinctea_aba')
    const r = await fetch(`/api${caminho}`, {
      method: metodo,
      headers: { ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }), ...(vaga ? { 'X-Sinctea-Aba': vaga } : {}) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    })
    const texto = await r.text()
    return { status: r.status, corpo: texto ? JSON.parse(texto) : null }
  }, { metodo, caminho, corpo })
}

/** Troca o perfil ativo da conta (a coordenacao da semente tambem administra) e recarrega. */
export async function trocarPerfil(page: Page, perfil: string): Promise<void> {
  const r = await api(page, 'POST', '/auth/perfil', { perfil })
  expect(r.status, JSON.stringify(r.corpo)).toBe(200)
  // A tela le a sessao ao abrir: sem recarregar, ela acharia que outra janela
  // trocou o perfil (item 7, parte 3) e avisaria por cima de tudo.
  await page.reload()
  await esperarCarregar(page)
}

/** A tela terminou de carregar: sem pedido pendente e sem esqueleto de carregamento (EstadoCarregando). */
export async function esperarCarregar(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('status').filter({ hasText: /^Carregando/ })).toHaveCount(0)
}

export interface Violacao { id: string; impacto: string; ajuda: string; alvos: string[] }

/**
 * Passa o axe na pagina inteira com as tags da meta. Devolve as violacoes
 * que derrubam o CI; as outras vao para o relatorio do teste, como anexo.
 */
export async function verificarAxe(page: Page, info: TestInfo, rotulo: string): Promise<Violacao[]> {
  const resultado = await new AxeBuilder({ page }).withTags(TAGS_WCAG).analyze()
  const todas: Violacao[] = resultado.violations.map((v) => ({
    id: v.id, impacto: v.impact ?? 'desconhecido', ajuda: v.help,
    alvos: v.nodes.map((n) => n.target.join(' ')).slice(0, 10),
  }))
  await info.attach(`axe · ${rotulo}`, { body: JSON.stringify(todas, null, 2), contentType: 'application/json' })
  for (const v of todas.filter((x) => !IMPACTOS_QUE_FALHAM.includes(x.impacto))) {
    info.annotations.push({ type: `axe ${v.impacto}`, description: `${rotulo}: ${v.id} — ${v.ajuda}` })
  }
  return todas.filter((v) => IMPACTOS_QUE_FALHAM.includes(v.impacto))
}

/** As preferencias da tela, gravadas antes de a pagina abrir (src/contexto/Preferencias.tsx). */
export async function comPreferencias(page: Page, prefs: { textoMaior: boolean; altoContraste: boolean }): Promise<void> {
  await page.addInitScript((p) => {
    try { localStorage.setItem('sinctea.preferencias', JSON.stringify({ ...p, semAnimacao: false })) } catch { /* sem armazenamento */ }
  }, prefs)
}

/** Aperta Tab ate o foco chegar no elemento, sem mouse. Falha se nao chegar. */
export async function tabAte(page: Page, alvo: ReturnType<Page['locator']>, limite = 80, para: 'Tab' | 'Shift+Tab' = 'Tab'): Promise<void> {
  // O alvo precisa existir; esperar por ele e tarefa da tela, e nao do teclado.
  const elemento = await alvo.elementHandle({ timeout: 15_000 })
  if (!elemento) throw new Error(`O elemento nao existe: ${alvo}`)
  for (let i = 0; i < limite; i += 1) {
    if (await elemento.evaluate((el) => el === document.activeElement)) return
    await page.keyboard.press(para)
  }
  throw new Error(`O foco nao chegou a ${alvo} em ${limite} toques de ${para}.`)
}
