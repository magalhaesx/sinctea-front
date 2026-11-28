import { expect, test, type Page } from '@playwright/test'
import { api, CONTAS, esperarCarregar, senha, tabAte } from './apoio'

/**
 * Item 25, teclado: o "Pular para o conteudo" e o primeiro foco; o menu abre,
 * prende e devolve o foco; e tres fluxos vao ate o fim so com teclado —
 * entrar, registrar um toque na sessao e autorizar o acesso da escola. Nenhum
 * clique: so Tab, Shift+Tab, Enter, Espaco, setas, Esc e digitacao.
 */

const focado = (page: Page) => page.evaluate(() => {
  const el = document.activeElement as HTMLElement | null
  return { tag: el?.tagName ?? '', texto: (el?.textContent ?? '').trim(), rotulo: el?.getAttribute('aria-label') ?? '', id: el?.id ?? '' }
})
const focoDentroDoMenu = (page: Page) => page.evaluate(() => !!document.activeElement?.closest('#menu-do-app'))

/** Entra pela tela 1 so com teclado, a partir do primeiro Tab. */
async function entrarComTeclado(page: Page, email: string) {
  await page.goto('/#/app/entrar')
  await esperarCarregar(page)
  await tabAte(page, page.getByLabel('E-mail', { exact: true }))
  await page.keyboard.type(email)
  await tabAte(page, page.getByLabel('Senha', { exact: true }))
  await page.keyboard.type(senha())
  await page.keyboard.press('Enter')
  await page.waitForURL((url) => !url.hash.includes('/app/entrar'))
  await esperarCarregar(page)
}

/** Abre o menu pelo teclado e segue o link da tela pedida. */
async function irPeloMenu(page: Page, tela: string) {
  await tabAte(page, page.getByRole('button', { name: 'Abrir o menu' }))
  await page.keyboard.press('Enter')
  // Na tela larga, o link traz tambem o numero do caso de uso.
  await tabAte(page, page.getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: new RegExp(`^${tela}( UC[0-9]+)?$`) }))
  await page.keyboard.press('Enter')
  await esperarCarregar(page)
}

test.describe('teclado', () => {
  test('"Pular para o conteudo" e o primeiro foco, na entrada e no app, e leva ao conteudo', async ({ page }) => {
    await page.goto('/#/app/entrar')
    await esperarCarregar(page)
    await page.keyboard.press('Tab')
    expect((await focado(page)).texto).toBe('Pular para o conteúdo')

    await entrarComTeclado(page, CONTAS.profissional)
    await page.reload()
    await esperarCarregar(page)
    await page.keyboard.press('Tab')
    const primeiro = await focado(page)
    expect(primeiro.texto).toBe('Pular para o conteúdo')
    await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeVisible()
    await page.keyboard.press('Enter')
    expect((await focado(page)).id).toBe('conteudo')
  })

  test('o menu abre pelo teclado, prende o foco e o devolve ao botao ao fechar', async ({ page }) => {
    await entrarComTeclado(page, CONTAS.profissional)
    const botao = page.getByRole('button', { name: 'Abrir o menu' })
    await tabAte(page, botao)
    await page.keyboard.press('Enter')
    const menu = page.getByRole('dialog', { name: 'Menu' })
    await expect(menu).toBeVisible()
    expect(await focoDentroDoMenu(page)).toBe(true)

    // Preso: Tab e Shift+Tab, muitas vezes, nunca saem da gaveta.
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press('Tab')
      expect(await focoDentroDoMenu(page), `Tab ${i + 1}`).toBe(true)
    }
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press('Shift+Tab')
      expect(await focoDentroDoMenu(page), `Shift+Tab ${i + 1}`).toBe(true)
    }

    // Esc fecha e devolve o foco ao botao do menu.
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    expect((await focado(page)).rotulo).toBe('Abrir o menu')

    // O mesmo pelo botao de fechar, com Enter.
    await page.keyboard.press('Enter')
    await expect(menu).toBeVisible()
    await tabAte(page, menu.getByRole('button', { name: 'Fechar o menu' }))
    await page.keyboard.press('Enter')
    await expect(menu).toBeHidden()
    expect((await focado(page)).rotulo).toBe('Abrir o menu')
  })

  test('entrar, so com teclado', async ({ page }) => {
    await entrarComTeclado(page, CONTAS.profissional)
    expect(page.url()).toContain('#/app/clinica')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('registrar um toque na sessao, so com teclado, do painel ao servidor', async ({ page }) => {
    await entrarComTeclado(page, CONTAS.profissional)
    await irPeloMenu(page, 'Pacientes')
    await tabAte(page, page.getByRole('link', { name: /^Miguel/ }).first())
    await page.keyboard.press('Enter')
    await esperarCarregar(page)
    await tabAte(page, page.getByRole('link', { name: 'Iniciar sessão' }))
    await page.keyboard.press('Enter')
    await esperarCarregar(page)

    await tabAte(page, page.getByRole('button', { name: /^(Iniciar a sessão|Retomar a sessão|Iniciar uma sessão nova)$/ }))
    await page.keyboard.press('Enter')
    const independente = page.getByRole('button', { name: 'Independente', exact: true })
    await expect(independente).toBeVisible()
    await tabAte(page, independente)
    await page.keyboard.press('Enter')

    // O toque subiu: a fila esvaziou, e o servidor tem o registro.
    const pacienteId = page.url().match(/pacientes\/([^/]+)\/sessao/)![1]
    await expect.poll(async () => {
      const sessoes = (await api(page, 'GET', `/pacientes/${pacienteId}/sessoes?porPagina=50`)).corpo.itens as Array<{ situacao: string; registros: Array<{ resultado: string }> }>
      return sessoes.find((s) => s.situacao === 'EM_ANDAMENTO')?.registros.map((r) => r.resultado) ?? []
    }).toEqual(['INDEPENDENTE'])
  })

  test('autorizar o acesso da escola, so com teclado, ate o convite', async ({ page }) => {
    await entrarComTeclado(page, CONTAS.familia)
    const antes = (await api(page, 'GET', '/familia/filhos')).corpo.itens[0].id as string
    const autorizacoes = async () => (await api(page, 'GET', `/pacientes/${antes}/consentimentos?porPagina=50`)).corpo.total as number
    const totalAntes = await autorizacoes()

    await irPeloMenu(page, 'Autorizar a escola')
    // A escola: a primeira da lista, pela seta.
    await tabAte(page, page.getByLabel('Escola', { exact: true }))
    await page.keyboard.press('ArrowDown')
    // O que a escola pode acessar: os dois vem marcados; Espaco tira o registro, e fica so o cartao.
    const registro = page.getByRole('checkbox', { name: /^Registrar o que acontece na escola/ })
    await tabAte(page, registro)
    await page.keyboard.press('Space')
    await expect(registro).not.toBeChecked()
    await expect(page.getByRole('checkbox', { name: /^Cartão de estratégias/ })).toBeChecked()
    // Ate quando: 1o de janeiro do ano que vem, digitado no campo de data. Dia e
    // mes iguais: vale na ordem dd/mm e na mm/dd do navegador.
    await tabAte(page, page.getByLabel('Autorizar até'))
    await page.keyboard.type(`0101${new Date().getFullYear() + 1}`)
    await expect(page.getByLabel('Autorizar até')).toHaveValue(`${new Date().getFullYear() + 1}-01-01`)
    await tabAte(page, page.getByRole('button', { name: 'Ler o termo e autorizar' }))
    await page.keyboard.press('Enter')

    // O termo, e entao "Autorizar".
    await expect(page.getByRole('heading', { name: 'Leia antes de autorizar' })).toBeVisible()
    await tabAte(page, page.getByRole('button', { name: 'Autorizar', exact: true }))
    await page.keyboard.press('Enter')
    await expect(page.getByText('Pronto', { exact: true })).toBeVisible()
    expect(await autorizacoes()).toBe(totalAntes + 1)
  })
})
