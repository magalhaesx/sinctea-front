import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import type { PrismaClient } from '../src/gerado/client.js'
import { clienteDe, criarBancoMigrado } from './apoio/banco.js'
import { criarUsuario, subirApi, type Api } from './apoio/api.js'

/**
 * Item 2 do caminho principal (docs/07, secao 0): usuarios, profissionais e
 * meus dados profissionais, pela API, num banco que comeca vazio.
 */

let prisma: PrismaClient
let api: Api
let apagar: () => Promise<void>
const ids: Record<string, string> = {}
const cookies: Record<string, string> = {}

beforeAll(async () => {
  const banco = await criarBancoMigrado(inject('urlAdministrativa'), 'sinctea_usuarios')
  apagar = banco.apagar
  prisma = clienteDe(banco.url)
  ids.admin = await criarUsuario(prisma, { email: 'admin@teste.example', nome: 'Zélia Administradora', perfis: ['ADMINISTRADOR'] })
  ids.terapeuta = await criarUsuario(prisma, { email: 'terapeuta@teste.example', nome: 'Álvaro Terapeuta', perfis: ['TERAPEUTA'] })
  ids.coordenadora = await criarUsuario(prisma, { email: 'coord@teste.example', nome: 'Bruna Coordenadora', perfis: ['COORDENADOR', 'TERAPEUTA'] })
  ids.responsavel = await criarUsuario(prisma, { email: 'mae@teste.example', nome: 'Carla Responsável', perfis: ['RESPONSAVEL'], tipo: 'RESPONSAVEL' })
  ids.professora = await criarUsuario(prisma, { email: 'prof@teste.example', nome: 'Dora Professora', perfis: ['PROFESSOR'], tipo: 'PROFESSOR_AEE' })
  ids.desligado = await criarUsuario(prisma, { email: 'desligado@teste.example', nome: 'Edu Desligado', perfis: ['TERAPEUTA'], ativo: false })
  api = await subirApi(banco.url)
  cookies.admin = await api.entrar('admin@teste.example')
  cookies.terapeuta = await api.entrar('terapeuta@teste.example')
  cookies.responsavel = await api.entrar('mae@teste.example')
})

afterAll(async () => {
  await api?.fechar()
  await prisma?.$disconnect()
  await apagar?.()
})

const negadasDe = (usuarioId: string) =>
  prisma.registroAuditoria.count({ where: { acao: 'ACESSO_NEGADO', usuarioId, entidade: 'Usuario' } })

describe('gestao de usuarios: so o administrador', () => {
  it('outro perfil e negado ao listar e ao convidar, e a negativa entra na trilha', async () => {
    const antes = await negadasDe(ids.terapeuta)
    expect((await api.pedir('GET', '/usuarios', { cookie: cookies.terapeuta })).status).toBe(403)
    expect((await api.pedir('POST', '/usuarios', { cookie: cookies.terapeuta, corpo: { nome: 'X', email: 'x@teste.example', perfis: ['TERAPEUTA'] } })).status).toBe(403)
    expect(await negadasDe(ids.terapeuta)).toBe(antes + 2)
    expect((await api.pedir('GET', '/usuarios')).status).toBe(401)
  })

  it('lista com busca sem acento nem caixa, filtros de perfil e situacao, e ordem do portugues', async () => {
    const todos = await api.pedir('GET', '/usuarios?porPagina=100', { cookie: cookies.admin })
    expect(todos.status).toBe(200)
    const nomes: string[] = todos.corpo.itens.map((u: { nome: string }) => u.nome)
    expect(nomes.indexOf('Álvaro Terapeuta')).toBeLessThan(nomes.indexOf('Bruna Coordenadora'))
    expect(nomes.at(-1)).toBe('Zélia Administradora')
    expect(JSON.stringify(todos.corpo)).not.toMatch(/senha|registroConselho/i)

    const busca = await api.pedir('GET', '/usuarios?busca=ALVARO', { cookie: cookies.admin })
    expect(busca.corpo.itens.map((u: { id: string }) => u.id)).toEqual([ids.terapeuta])

    const resp = await api.pedir('GET', '/usuarios?perfil=RESPONSAVEL', { cookie: cookies.admin })
    expect(resp.corpo.itens.map((u: { id: string }) => u.id)).toEqual([ids.responsavel])

    const desativados = await api.pedir('GET', '/usuarios?ativo=false', { cookie: cookies.admin })
    expect(desativados.corpo.itens.map((u: { id: string }) => u.id)).toEqual([ids.desligado])

    const pagina = await api.pedir('GET', '/usuarios?porPagina=2&pagina=2', { cookie: cookies.admin })
    expect(pagina.corpo).toMatchObject({ pagina: 2, porPagina: 2, total: 6 })
    expect(pagina.corpo.itens).toHaveLength(2)
  })
})

describe('convidar: a conta da equipe nasce com link, e a senha e da pessoa', () => {
  it('cria com e-mail em minusculas, devolve o link uma vez, e a pessoa entra pela senha que escolheu', async () => {
    const r = await api.pedir('POST', '/usuarios', {
      cookie: cookies.admin,
      corpo: { nome: '  Fábio Novo ', email: ' Fabio.Novo@Teste.EXAMPLE ', perfis: ['TERAPEUTA', 'TERAPEUTA'], especialidade: 'Psicologia' },
    })
    expect(r.status).toBe(201)
    expect(r.corpo.usuario).toMatchObject({ nome: 'Fábio Novo', email: 'fabio.novo@teste.example', perfis: ['TERAPEUTA'], ativo: true, ultimoAcessoEm: null })
    const { token } = r.corpo.primeiroAcesso
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)

    // Antes do link, nenhuma senha entra: nem uma vazia, nem um palpite.
    expect((await api.pedir('POST', '/auth/entrar', { corpo: { email: 'fabio.novo@teste.example', senha: '' } })).status).toBe(401)

    const trilha = await prisma.registroAuditoria.findFirst({ where: { acao: 'CRIACAO', idEntidade: r.corpo.usuario.id } })
    expect(trilha).toMatchObject({ entidade: 'Usuario', usuarioId: ids.admin })
    expect(trilha!.detalhe).not.toContain(token)

    const definida = await api.pedir('POST', `/auth/primeiro-acesso/${token}`, { corpo: { senha: 'a-senha-do-fabio' } })
    expect(definida.status).toBe(200)
    // Item 7: a sessao leva a especialidade, que a tela mostra no lugar do perfil.
    expect(definida.corpo).toMatchObject({ perfilAtivo: 'TERAPEUTA', especialidade: 'Psicologia' })
    await api.entrar('fabio.novo@teste.example', 'a-senha-do-fabio')
  })

  it('item 7: o profissional da clinica nasce com a especialidade; a coordenacao, nao precisa', async () => {
    const convidar = (corpo: unknown) => api.pedir('POST', '/usuarios', { cookie: cookies.admin, corpo })
    const sem = await convidar({ nome: 'Sem Especialidade', email: 'sem@teste.example', perfis: ['TERAPEUTA', 'COORDENADOR'], especialidade: '  ' })
    expect(sem.status).toBe(422)
    expect(sem.corpo.campos.especialidade).toMatch(/especialidade/)
    expect(await prisma.usuario.count({ where: { email: 'sem@teste.example' } })).toBe(0)
    expect((await convidar({ nome: 'Coordenação Só', email: 'coord-so@teste.example', perfis: ['COORDENADOR'] })).status).toBe(201)
  })

  it('recusa responsavel e professor, e-mail repetido em outra caixa e dados faltando', async () => {
    const convidar = (corpo: unknown) => api.pedir('POST', '/usuarios', { cookie: cookies.admin, corpo })
    const familia = await convidar({ nome: 'X', email: 'x1@teste.example', perfis: ['RESPONSAVEL'] })
    expect(familia.status).toBe(422)
    expect(familia.corpo.campos.perfis).toMatch(/apenas a equipe/)
    expect((await convidar({ nome: 'X', email: 'x2@teste.example', perfis: ['PROFESSOR'] })).status).toBe(422)
    const repetido = await convidar({ nome: 'X', email: 'TERAPEUTA@teste.example', perfis: ['TERAPEUTA'], especialidade: 'Psicologia' })
    expect(repetido.status).toBe(409)
    const vazio = await convidar({})
    expect(vazio.status).toBe(422)
    expect(Object.keys(vazio.corpo.campos).sort()).toEqual(['email', 'nome', 'perfis'])
    expect(await prisma.usuario.count({ where: { email: { in: ['x1@teste.example', 'x2@teste.example'] } } })).toBe(0)
  })

  it('link novo para a equipe: o anterior deixa de valer; nao serve para familia, escola nem conta desativada', async () => {
    const criada = await api.pedir('POST', '/usuarios', {
      cookie: cookies.admin, corpo: { nome: 'Gil Link', email: 'gil@teste.example', perfis: ['COORDENADOR'] },
    })
    const antigo = criada.corpo.primeiroAcesso.token
    const novo = await api.pedir('POST', `/usuarios/${criada.corpo.usuario.id}/acesso-inicial`, { cookie: cookies.admin })
    expect(novo.status).toBe(200)
    expect(novo.corpo.token).not.toBe(antigo)
    expect((await api.pedir('GET', `/auth/primeiro-acesso/${antigo}`)).corpo.situacao).toBe('INEXISTENTE')
    expect((await api.pedir('GET', `/auth/primeiro-acesso/${novo.corpo.token}`)).corpo.situacao).toBe('VALIDO')

    expect((await api.pedir('POST', `/usuarios/${ids.responsavel}/acesso-inicial`, { cookie: cookies.admin })).status).toBe(409)
    expect((await api.pedir('POST', `/usuarios/${ids.professora}/acesso-inicial`, { cookie: cookies.admin })).status).toBe(409)
    expect((await api.pedir('POST', `/usuarios/${ids.desligado}/acesso-inicial`, { cookie: cookies.admin })).status).toBe(409)
  })
})

describe('perfis, desativar e reativar', () => {
  it('so perfis do tipo de cadastro; o administrador nao tira o proprio', async () => {
    const perfis = (id: string, lista: string[]) => api.pedir('PUT', `/usuarios/${id}/perfis`, { cookie: cookies.admin, corpo: { perfis: lista } })
    expect((await perfis(ids.responsavel, ['TERAPEUTA'])).status).toBe(422)
    expect((await perfis(ids.professora, ['RESPONSAVEL'])).status).toBe(422)
    expect((await perfis(ids.coordenadora, [])).status).toBe(422)
    expect((await perfis(ids.admin, ['TERAPEUTA'])).status).toBe(409)
    const ok = await perfis(ids.coordenadora, ['COORDENADOR'])
    expect(ok.status).toBe(200)
    expect(ok.corpo.perfis).toEqual(['COORDENADOR'])
  })

  it('quem perde o perfil com que esta agindo cai na chamada seguinte', async () => {
    const id = await criarUsuario(prisma, { email: 'perde@teste.example', perfis: ['TERAPEUTA', 'COORDENADOR'] })
    const cookie = await api.entrar('perde@teste.example')
    expect((await api.pedir('GET', '/profissionais', { cookie })).status).toBe(200)
    await api.pedir('PUT', `/usuarios/${id}/perfis`, { cookie: cookies.admin, corpo: { perfis: ['COORDENADOR'] } })
    expect((await api.pedir('GET', '/profissionais', { cookie })).status).toBe(401)
  })

  it('desativar derruba todas as sessoes; reativar devolve a entrada; o administrador nao se desativa', async () => {
    const id = await criarUsuario(prisma, { email: 'sai@teste.example', perfis: ['TERAPEUTA'] })
    const cookie = await api.entrar('sai@teste.example')
    const r = await api.pedir('POST', `/usuarios/${id}/desativacao`, { cookie: cookies.admin })
    expect(r.status).toBe(200)
    expect(r.corpo.ativo).toBe(false)
    expect(await prisma.sessaoLogin.count({ where: { usuarioId: id } })).toBe(0)
    expect((await api.pedir('GET', '/auth/sessao', { cookie })).status).toBe(204)
    expect((await api.pedir('POST', '/auth/entrar', { corpo: { email: 'sai@teste.example', senha: 'senha-de-teste-123' } })).status).toBe(401)

    expect((await api.pedir('POST', `/usuarios/${id}/reativacao`, { cookie: cookies.admin })).corpo.ativo).toBe(true)
    await api.entrar('sai@teste.example')

    expect((await api.pedir('POST', `/usuarios/${ids.admin}/desativacao`, { cookie: cookies.admin })).status).toBe(409)
    expect(await prisma.registroAuditoria.count({ where: { acao: 'ALTERACAO', idEntidade: id } })).toBe(2)
  })

  it('id que nao e uuid, ou que nao existe, e 404 — nunca erro do banco', async () => {
    expect((await api.pedir('POST', '/usuarios/nao-e-uuid/desativacao', { cookie: cookies.admin })).status).toBe(404)
    expect((await api.pedir('POST', '/usuarios/0199a000-0000-7000-8000-000000000000/reativacao', { cookie: cookies.admin })).status).toBe(404)
  })
})

describe('dados profissionais: so o dono', () => {
  it('o profissional le e altera os proprios, com os dois campos obrigatorios, e a alteracao entra na trilha', async () => {
    expect((await api.pedir('GET', '/usuarios/eu/dados-profissionais', { cookie: cookies.terapeuta })).corpo)
      .toEqual({ especialidade: 'Fonoaudiologia', registroConselho: 'CRFa 0000-FICT' })
    const vazio = await api.pedir('PUT', '/usuarios/eu/dados-profissionais', { cookie: cookies.terapeuta, corpo: { especialidade: ' ', registroConselho: '' } })
    expect(vazio.status).toBe(422)
    const r = await api.pedir('PUT', '/usuarios/eu/dados-profissionais', { cookie: cookies.terapeuta, corpo: { especialidade: ' Terapia Ocupacional ', registroConselho: 'CREFITO 1234-FICT' } })
    expect(r.corpo).toEqual({ especialidade: 'Terapia Ocupacional', registroConselho: 'CREFITO 1234-FICT' })
    expect(await prisma.registroAuditoria.findFirst({ where: { acao: 'ALTERACAO', idEntidade: ids.terapeuta, usuarioId: ids.terapeuta } }))
      .toMatchObject({ detalhe: 'Dados profissionais atualizados: Terapia Ocupacional, CREFITO 1234-FICT.' })
  })

  it('o responsavel nao tem dados profissionais: leitura vazia, e alterar e recusado', async () => {
    const leitura = await api.pedir('GET', '/usuarios/eu/dados-profissionais', { cookie: cookies.responsavel })
    expect(leitura.status).toBe(204)
    expect((await api.pedir('PUT', '/usuarios/eu/dados-profissionais', { cookie: cookies.responsavel, corpo: { especialidade: 'X', registroConselho: 'Y' } })).status).toBe(409)
  })
})

describe('profissionais', () => {
  it('lista so os ativos com dados profissionais, para a clinica e a administracao; familia e negada', async () => {
    const r = await api.pedir('GET', '/profissionais?porPagina=100', { cookie: cookies.terapeuta })
    expect(r.status).toBe(200)
    const ids_ = r.corpo.itens.map((p: { id: string }) => p.id)
    expect(ids_).toContain(ids.terapeuta)
    expect(ids_).not.toContain(ids.desligado)
    expect(ids_).not.toContain(ids.responsavel)
    expect(r.corpo.itens[0]).toMatchObject({ tipo: 'PROFISSIONAL' })
    expect((await api.pedir('GET', '/profissionais?busca=alvaro', { cookie: cookies.admin })).corpo.itens.map((p: { id: string }) => p.id)).toEqual([ids.terapeuta])
    expect((await api.pedir('GET', '/profissionais', { cookie: cookies.responsavel })).status).toBe(403)
  })
})
