import { expect, test, type Browser, type Page } from '@playwright/test'
import { api, CONTAS, comPreferencias, entrar, esperarCarregar, trocarPerfil, verificarAxe, type Violacao } from './apoio'

/**
 * Item 25, acessibilidade: o axe (WCAG 2.2 AA: wcag2a, wcag2aa, wcag21a,
 * wcag21aa e wcag22aa) em todas as rotas do produto, de cada perfil, sobre o
 * pacote de producao e os dados ficticios da semente. Uma violacao "critical"
 * ou "serious" derruba o teste; as outras ficam anexadas ao relatorio.
 *
 * Cada perfil passa nas quatro variantes: a tela larga e 375 px, cada uma sem
 * e com "Alto contraste" e "Texto maior" ligados.
 */

interface Variante { nome: string; largura: number; altura: number; preferencias: boolean }
const VARIANTES: Variante[] = [
  { nome: '1280 px', largura: 1280, altura: 800, preferencias: false },
  { nome: '375 px', largura: 375, altura: 812, preferencias: false },
  { nome: '1280 px, alto contraste e texto maior', largura: 1280, altura: 800, preferencias: true },
  { nome: '375 px, alto contraste e texto maior', largura: 375, altura: 812, preferencias: true },
]

type Rota = [rotulo: string, caminho: string]

interface Perfil {
  nome: string
  /** Sem conta: as telas de acesso. */
  email: string | null
  /** As rotas desta conta, com os ids da semente descobertos pela API. */
  rotas(page: Page): Promise<Rota[]>
}

const um = <T>(lista: T[] | undefined, oQue: string): T => {
  const item = lista?.[0]
  if (!item) throw new Error(`A semente nao tem ${oQue}.`)
  return item
}

/** Os links de primeiro acesso e o convite valido, criados uma vez, pela API, com as contas da semente. */
let tokensDasTelasDeAcesso: { primeiroAcesso: string; convite: string } | null = null
async function prepararTelasDeAcesso(browser: Browser) {
  if (tokensDasTelasDeAcesso) return tokensDasTelasDeAcesso
  const contexto = await browser.newContext()
  const page = await contexto.newPage()
  try {
    // A administracao cria uma conta ficticia: o link de primeiro acesso dela.
    await entrar(page, CONTAS.coordenacao)
    await trocarPerfil(page, 'ADMINISTRADOR')
    const conta = await api(page, 'POST', '/usuarios', { nome: 'Pessoa Ficticia da Verificacao', email: 'verificacao@clinica.example', perfis: ['COORDENADOR'] })
    expect(conta.status, JSON.stringify(conta.corpo)).toBe(201)
    await api(page, 'POST', '/auth/sair')

    // A mae, responsavel legal, autoriza uma escola: o convite valido.
    await entrar(page, CONTAS.familia)
    const filho = um((await api(page, 'GET', '/familia/filhos')).corpo.itens, 'filho da familia')
    const escola = um((await api(page, 'GET', '/escolas')).corpo.itens, 'escola')
    const validade = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10)
    const consentimento = await api(page, 'POST', '/consentimentos', {
      pacienteId: filho.id, escolaId: escola.id, escopos: ['CARTAO_ESTRATEGIA'], validadeAte: validade,
    })
    expect(consentimento.status, JSON.stringify(consentimento.corpo)).toBe(201)
    tokensDasTelasDeAcesso = { primeiroAcesso: conta.corpo.primeiroAcesso.token, convite: consentimento.corpo.tokenConvite }
    return tokensDasTelasDeAcesso
  } finally {
    await contexto.close()
  }
}

const PERFIS: Perfil[] = [
  {
    nome: 'acesso (sem conta)',
    email: null,
    rotas: async (page) => {
      const tokens = await prepararTelasDeAcesso(page.context().browser()!)
      return [
        ['Tela 1, entrar', '/app/entrar'],
        ['Tela 1, esqueci minha senha', '/app/entrar?esqueci'],
        ['Tela 2, convite valido', `/app/convite/${tokens.convite}`],
        ['Tela 2, convite que nao existe', '/app/convite/convite-que-nao-existe'],
        ['Tela 23, primeiro acesso valido', `/app/primeiro-acesso/${tokens.primeiroAcesso}`],
        ['Tela 23, link que nao existe', '/app/primeiro-acesso/link-que-nao-existe'],
        ['A solucao', '/sobre'],
      ]
    },
  },
  {
    nome: 'profissional da clinica',
    email: CONTAS.profissional,
    rotas: async (page) => {
      const pacientes = (await api(page, 'GET', '/pacientes?porPagina=50')).corpo.itens as Array<{ id: string; nome: string }>
      const miguel = pacientes.find((p) => p.nome.startsWith('Miguel'))!.id
      const davi = pacientes.find((p) => p.nome.startsWith('Davi'))!.id
      const relatorio = um((await api(page, 'GET', `/pacientes/${miguel}/relatorios`)).corpo.itens, 'relatorio emitido')
      // Uma sessao em andamento, para a tela 7 mostrar o "Como foi esta tentativa?".
      await api(page, 'POST', '/sessoes', { pacienteId: davi })
      return [
        ['Tela 3, painel', '/app/clinica'],
        ['Tela 4, pacientes', '/app/clinica/pacientes'],
        ['Cadastrar paciente', '/app/clinica/pacientes/novo'],
        ['Tela 5, ficha', `/app/clinica/pacientes/${miguel}`],
        ['Tela 6, plano', `/app/clinica/pacientes/${miguel}/plano`],
        ['Tela 7, sessao a iniciar', `/app/clinica/pacientes/${miguel}/sessao`],
        ['Tela 7, sessao em andamento', `/app/clinica/pacientes/${davi}/sessao`],
        ['Tela 8, evolucao', `/app/clinica/pacientes/${miguel}/evolucao`],
        ['Tela 9, atividades', `/app/clinica/pacientes/${miguel}/atividades`],
        ['Tela 10, relatorio', `/app/clinica/pacientes/${miguel}/relatorio`],
        ['Tela 10b, relatorio emitido', `/app/clinica/pacientes/${miguel}/relatorio/${relatorio.id}`],
        ['Tela 26, trilha de autonomia', `/app/clinica/pacientes/${miguel}/trilha`],
        ['Tela 21, perfil e preferencias', '/app/conta'],
        ['Tela 20, ajuda', '/app/ajuda'],
      ]
    },
  },
  {
    nome: 'coordenacao',
    email: CONTAS.coordenacao,
    rotas: async () => [
      ['Tela 11, indicadores', '/app/coordenacao'],
      ['Tela 12, validar planos', '/app/coordenacao/planos'],
      ['Tela 13, auditoria', '/app/coordenacao/auditoria'],
      ['Tela 21, perfil e preferencias', '/app/conta'],
      ['Tela 20, ajuda', '/app/ajuda'],
    ],
  },
  {
    nome: 'administracao',
    email: CONTAS.coordenacao,
    rotas: async (page) => {
      await trocarPerfil(page, 'ADMINISTRADOR')
      return [
        ['Tela 14, usuarios', '/app/admin/usuarios'],
        ['Tela 25, trilha administrativa', '/app/admin/trilha'],
        ['Tela 21, perfil e preferencias', '/app/conta'],
      ]
    },
  },
  {
    nome: 'familia',
    email: CONTAS.familia,
    rotas: async (page) => {
      const filho = um((await api(page, 'GET', '/familia/filhos')).corpo.itens, 'filho da familia')
      const atividade = um((await api(page, 'GET', `/pacientes/${filho.id}/atividades?ativa=true`)).corpo.itens, 'atividade de casa')
      return [
        ['Tela 15, painel da familia', '/app/familia'],
        ['Tela 17, autorizar a escola', '/app/familia/consentimento'],
        ['Tela 16, atividade de casa', `/app/familia/atividades/${atividade.id}`],
        ['Tela 26, trilha de autonomia', `/app/familia/filhos/${filho.id}/trilha`],
        ['Tela 21, perfil e preferencias', '/app/conta'],
        ['Tela 20, ajuda', '/app/ajuda'],
      ]
    },
  },
  {
    nome: 'escola',
    email: CONTAS.escola,
    rotas: async (page) => {
      const alunos = (await api(page, 'GET', '/escola/alunos')).corpo.itens as Array<{ pacienteId: string; situacao: string; escopos: string[] }>
      const aluno = alunos.find((a) => a.situacao === 'VIGENTE' && a.escopos.includes('REGISTRO_OCORRENCIA'))
      if (!aluno) throw new Error('A semente nao tem aluno com registro autorizado para a professora.')
      return [
        ['Tela 22, meus alunos', '/app/escola'],
        ['Tela 18, cartao de estrategias', `/app/escola/${aluno.pacienteId}`],
        ['Tela 19, registrar ocorrencia', `/app/escola/${aluno.pacienteId}/ocorrencia`],
        ['Tela 21, perfil e preferencias', '/app/conta'],
        ['Tela 20, ajuda', '/app/ajuda'],
      ]
    },
  },
]

for (const perfil of PERFIS) {
  test.describe(`acessibilidade · ${perfil.nome}`, () => {
    for (const variante of VARIANTES) {
      test(variante.nome, async ({ browser }, info) => {
        const contexto = await browser.newContext({ viewport: { width: variante.largura, height: variante.altura } })
        const page = await contexto.newPage()
        if (variante.preferencias) await comPreferencias(page, { textoMaior: true, altoContraste: true })
        try {
          if (perfil.email) await entrar(page, perfil.email)
          else await page.goto('/#/app/entrar')
          const rotas = await perfil.rotas(page)
          const achados: Array<{ rota: string; violacoes: Violacao[] }> = []

          for (const [rotulo, caminho] of rotas) {
            await page.goto(`/#${caminho}`)
            await esperarCarregar(page)
            const violacoes = await verificarAxe(page, info, `${rotulo} · ${variante.nome}`)
            if (violacoes.length > 0) achados.push({ rota: `${rotulo} (${caminho})`, violacoes })
          }

          // O menu aberto (item 12): a gaveta e um dialogo modal, com o resto inerte.
          if (perfil.email) {
            await page.goto(`/#${rotas[0][1]}`)
            await esperarCarregar(page)
            await page.getByRole('button', { name: 'Abrir o menu' }).click()
            await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible()
            const violacoes = await verificarAxe(page, info, `menu aberto · ${variante.nome}`)
            if (violacoes.length > 0) achados.push({ rota: 'menu aberto', violacoes })
          }

          expect(achados, JSON.stringify(achados, null, 2)).toEqual([])
        } finally {
          await contexto.close()
        }
      })
    }
  })
}
