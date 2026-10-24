import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { resumoDoToken } from '../src/autenticacao/servico-sessoes.js'
import type { PrismaClient } from '../src/gerado/client.js'
import { clienteDe, criarBancoMigrado } from './apoio/banco.js'
import { criarUsuario, SENHA_DE_TESTE, subirApi, type Api, type Resposta } from './apoio/api.js'

/**
 * Item 9: uma conta por aba no mesmo navegador. O navegador tem cinco vagas,
 * cada uma o seu cookie httpOnly; a aba diz a dela pelo X-Sinctea-Aba, e a
 * sessao se resolve so pelo cookie dessa vaga.
 *
 * O "navegador" aqui e um pote de cookies: o que o servidor manda guardar
 * entra, o que ele manda apagar sai, e todo pedido leva o pote inteiro.
 */

let prisma: PrismaClient
let api: Api
let apagar: () => Promise<void>
const u: Record<string, string> = {}

class Navegador {
  readonly cookies = new Map<string, string>()
  constructor(private readonly api: Api) {}

  get cabecalho(): string {
    return [...this.cookies].map(([nome, valor]) => `${nome}=${valor}`).join('; ')
  }

  guardar(r: Resposta): Resposta {
    for (const linha of r.cookies) {
      const [par] = linha.split(';')
      const [nome, ...valor] = par.split('=')
      const texto = valor.join('=')
      if (!texto || /Expires=Thu, 01 Jan 1970/i.test(linha)) this.cookies.delete(nome)
      else this.cookies.set(nome, texto)
    }
    return r
  }

  async pedir(metodo: string, caminho: string, aba: number | string | null, corpo?: unknown): Promise<Resposta> {
    return this.guardar(await this.api.pedir(metodo, caminho, { cookie: this.cabecalho || undefined, aba, corpo }))
  }

  async entrar(email: string, senha = SENHA_DE_TESTE): Promise<Resposta> {
    return this.pedir('POST', '/auth/entrar', null, { email, senha })
  }

  sessao(aba: number | string | null) {
    return this.pedir('GET', '/auth/sessao', aba)
  }
}

beforeAll(async () => {
  const banco = await criarBancoMigrado(inject('urlAdministrativa'), 'sinctea_vagas')
  apagar = banco.apagar
  prisma = clienteDe(banco.url)
  u.admin = await criarUsuario(prisma, { email: 'admin@teste.example', nome: 'Alice Administradora', perfis: ['ADMINISTRADOR'] })
  u.ana = await criarUsuario(prisma, { email: 'ana@teste.example', nome: 'Ana Souza', perfis: ['TERAPEUTA', 'COORDENADOR'] })
  u.mae = await criarUsuario(prisma, { email: 'mae@teste.example', nome: 'Patrícia Ficticia', perfis: ['RESPONSAVEL'], tipo: 'RESPONSAVEL' })
  for (const n of [1, 2, 3, 4, 5, 6]) {
    u[`extra${n}`] = await criarUsuario(prisma, { email: `extra${n}@teste.example`, nome: `Extra ${n}`, perfis: ['TERAPEUTA'] })
  }
  api = await subirApi(banco.url)
})

afterAll(async () => {
  await api?.fechar()
  await prisma?.$disconnect()
  await apagar?.()
})

describe('uma conta por aba', () => {
  it('tres contas no mesmo navegador, cada aba com a sua', async () => {
    const navegador = new Navegador(api)
    const contas = ['admin@teste.example', 'ana@teste.example', 'mae@teste.example']
    const vagas: number[] = []
    for (const email of contas) {
      const r = await navegador.entrar(email)
      expect(r.status, JSON.stringify(r.corpo)).toBe(200)
      vagas.push(r.corpo.vaga)
      // O token so viaja no cookie httpOnly: a resposta nunca o traz.
      const token = navegador.cookies.get(`sinctea_sessao_${r.corpo.vaga}`)!
      expect(JSON.stringify(r.corpo)).not.toContain(token)
    }
    // A primeira vaga livre, uma depois da outra, e o cookie de cada uma.
    expect(vagas).toEqual([1, 2, 3])
    expect([...navegador.cookies.keys()].sort()).toEqual(['sinctea_sessao_1', 'sinctea_sessao_2', 'sinctea_sessao_3'])

    expect((await navegador.sessao(1)).corpo).toMatchObject({ usuario: { id: u.admin }, perfilAtivo: 'ADMINISTRADOR', vaga: 1 })
    expect((await navegador.sessao(2)).corpo).toMatchObject({ usuario: { id: u.ana }, perfilAtivo: 'TERAPEUTA', vaga: 2 })
    expect((await navegador.sessao(3)).corpo).toMatchObject({ usuario: { id: u.mae }, perfilAtivo: 'RESPONSAVEL', vaga: 3 })
    // Cada aba ve so o que a conta dela alcanca.
    expect((await navegador.pedir('GET', '/usuarios', 1)).status).toBe(200)
    expect((await navegador.pedir('GET', '/usuarios', 3)).status).toBe(403)
  })

  it('sem o cabecalho da aba, nao ha sessao, mesmo com os cookies todos', async () => {
    const navegador = new Navegador(api)
    await navegador.entrar('ana@teste.example')
    expect((await navegador.sessao(1)).status).toBe(200)
    expect((await navegador.sessao(null)).status).toBe(204)
    expect((await navegador.pedir('GET', '/pacientes', null)).status).toBe(401)
    for (const invalido of ['0', '6', '9', '01', '1a', '1, 2', 'um']) {
      expect((await navegador.sessao(invalido)).status, invalido).toBe(204)
    }
  })

  it('vaga sem cookie nao tem sessao, e nao toma a de outra vaga', async () => {
    const navegador = new Navegador(api)
    await navegador.entrar('ana@teste.example')
    expect((await navegador.sessao(2)).status).toBe(204)
    expect((await navegador.pedir('GET', '/pacientes', 2)).status).toBe(401)
    expect((await navegador.sessao(1)).corpo.usuario.id).toBe(u.ana)
  })

  it('a 6ª conta e recusada, antes de conferir a senha, e nenhuma sessao nasce', async () => {
    const navegador = new Navegador(api)
    for (const n of [1, 2, 3, 4, 5]) expect((await navegador.entrar(`extra${n}@teste.example`)).corpo.vaga).toBe(n)
    const antes = await prisma.sessaoLogin.count()
    const sexta = await navegador.entrar('extra6@teste.example')
    expect(sexta.status).toBe(409)
    expect(sexta.corpo.mensagem).toBe('Já há 5 contas abertas neste navegador. Saia de uma delas para entrar com outra.')
    expect(await prisma.sessaoLogin.count()).toBe(antes)
    expect((await navegador.entrar('extra6@teste.example', 'senha-errada-qualquer')).status).toBe(409)

    // Saiu de uma, a vaga dela volta a ser a primeira livre.
    expect((await navegador.pedir('POST', '/auth/sair', 3)).status).toBe(204)
    expect((await navegador.entrar('extra6@teste.example')).corpo.vaga).toBe(3)
  })

  it('sair numa vaga nao derruba a outra, nem quando e a mesma conta', async () => {
    const navegador = new Navegador(api)
    await navegador.entrar('ana@teste.example')
    await navegador.entrar('ana@teste.example')
    const saida = await navegador.pedir('POST', '/auth/sair', 1)
    expect(saida.status).toBe(204)
    expect(saida.cookies.some((c) => c.startsWith('sinctea_sessao_1=;'))).toBe(true)
    expect(saida.cookies.some((c) => c.startsWith('sinctea_sessao_2='))).toBe(false)
    expect((await navegador.sessao(1)).status).toBe(204)
    expect((await navegador.sessao(2)).corpo).toMatchObject({ usuario: { id: u.ana }, vaga: 2 })
  })

  it('trocar de perfil vale so para a vaga da aba', async () => {
    const navegador = new Navegador(api)
    await navegador.entrar('ana@teste.example')
    await navegador.entrar('ana@teste.example')
    expect((await navegador.pedir('POST', '/auth/perfil', 1, { perfil: 'COORDENADOR' })).corpo).toMatchObject({ perfilAtivo: 'COORDENADOR', vaga: 1 })
    expect((await navegador.sessao(1)).corpo.perfilAtivo).toBe('COORDENADOR')
    expect((await navegador.sessao(2)).corpo.perfilAtivo).toBe('TERAPEUTA')
  })

  it('desativar a conta encerra as sessoes dela em todas as vagas, e so as dela', async () => {
    const navegador = new Navegador(api)
    const admin = (await navegador.entrar('admin@teste.example')).corpo.vaga
    const extra = [(await navegador.entrar('extra1@teste.example')).corpo.vaga, (await navegador.entrar('extra1@teste.example')).corpo.vaga]
    const r = await navegador.pedir('POST', `/usuarios/${u.extra1}/desativacao`, admin)
    expect(r.status, JSON.stringify(r.corpo)).toBe(200)
    for (const vaga of extra) expect((await navegador.sessao(vaga)).status).toBe(204)
    expect((await navegador.sessao(admin)).corpo.usuario.id).toBe(u.admin)
    await prisma.usuario.update({ where: { id: u.extra1 }, data: { ativo: true } })
  })
})

describe('a aba nova escolhe entre as contas abertas', () => {
  it('contas-abertas: so vaga, nome e perfil ativo das vagas que valem, nunca o token', async () => {
    const navegador = new Navegador(api)
    await navegador.entrar('admin@teste.example')
    await navegador.entrar('mae@teste.example')
    // Uma sessao de verdade, mas vencida, na vaga 3; e um cookie inventado na 4.
    await navegador.entrar('ana@teste.example')
    const vencida = resumoDoToken(decodeURIComponent(navegador.cookies.get('sinctea_sessao_3')!))
    await prisma.sessaoLogin.update({ where: { tokenResumo: vencida }, data: { criadaEm: new Date(Date.now() - 48 * 3_600_000), expiraEm: new Date(Date.now() - 1000) } })
    navegador.cookies.set('sinctea_sessao_4', 'inventado')
    const r = await navegador.pedir('GET', '/auth/contas-abertas', null)
    expect(r.status).toBe(200)
    expect(r.corpo).toEqual([
      { vaga: 1, nome: 'Alice Administradora', perfilAtivo: 'ADMINISTRADOR' },
      { vaga: 2, nome: 'Patrícia Ficticia', perfilAtivo: 'RESPONSAVEL' },
    ])
    const texto = JSON.stringify(r.corpo)
    for (const valor of navegador.cookies.values()) {
      expect(texto).not.toContain(valor)
      expect(texto).not.toContain(resumoDoToken(decodeURIComponent(valor)))
    }
    expect(texto).not.toMatch(/email|token|sessaoId/i)
  })

  it('sem cookie nenhum, a lista e vazia; ler a lista nao abre sessao', async () => {
    expect((await api.pedir('GET', '/auth/contas-abertas', { aba: null })).corpo).toEqual([])
    const navegador = new Navegador(api)
    await navegador.entrar('ana@teste.example')
    await navegador.pedir('GET', '/auth/contas-abertas', null)
    expect((await navegador.sessao(null)).status).toBe(204)
  })
})

describe('abrir sessao pelo link e o cookie antigo', () => {
  it('o primeiro acesso usa a primeira vaga livre e devolve o numero dela', async () => {
    const navegador = new Navegador(api)
    await navegador.entrar('admin@teste.example')
    const convidada = await navegador.pedir('POST', '/usuarios', 1, {
      nome: 'Bruna Nova', email: 'bruna@teste.example', perfis: ['TERAPEUTA'], especialidade: 'Psicologia',
    })
    expect(convidada.status, JSON.stringify(convidada.corpo)).toBe(201)
    const r = await navegador.pedir('POST', `/auth/primeiro-acesso/${convidada.corpo.primeiroAcesso.token}`, null, { senha: 'senha-da-bruna' })
    expect(r.status).toBe(200)
    expect(r.corpo.vaga).toBe(2)
    expect((await navegador.sessao(2)).corpo.usuario.nome).toBe('Bruna Nova')
    expect((await navegador.sessao(1)).corpo.usuario.id).toBe(u.admin)
  })

  it('com as 5 vagas ocupadas, o link de primeiro acesso e recusado e continua valendo', async () => {
    const navegador = new Navegador(api)
    const admin = (await navegador.entrar('admin@teste.example')).corpo.vaga
    const convidada = await navegador.pedir('POST', '/usuarios', admin, {
      nome: 'Carla Nova', email: 'carla@teste.example', perfis: ['TERAPEUTA'], especialidade: 'Psicologia',
    })
    for (const n of [2, 3, 4, 5]) await navegador.entrar(`extra${n}@teste.example`)
    const { token } = convidada.corpo.primeiroAcesso
    const r = await navegador.pedir('POST', `/auth/primeiro-acesso/${token}`, null, { senha: 'senha-da-carla' })
    expect(r.status).toBe(409)
    expect((await api.pedir('GET', `/auth/primeiro-acesso/${token}`)).corpo.situacao).toBe('VALIDO')
  })

  it('o cookie de antes das vagas e apagado, com a linha dele, e nao abre sessao', async () => {
    const entrada = await api.pedir('POST', '/auth/entrar', { corpo: { email: 'ana@teste.example', senha: SENHA_DE_TESTE } })
    const token = decodeURIComponent(entrada.cookies.find((c) => c.startsWith('sinctea_sessao_1='))!.split(';')[0].split('=')[1])
    // Uma sessao viva no banco, mas no nome antigo do cookie.
    const r = await api.pedir('GET', '/auth/sessao', { cookie: `sinctea_sessao=${encodeURIComponent(token)}`, aba: 1 })
    expect(r.status).toBe(204)
    expect(r.cookies.some((c) => c.startsWith('sinctea_sessao=;'))).toBe(true)
    expect(await prisma.sessaoLogin.count({ where: { tokenResumo: resumoDoToken(token) } })).toBe(0)
  })
})
