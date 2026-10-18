import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { jsonCanonico } from '@sinctea/compartilhado/dominio/hash'
import type { PrismaClient } from '../src/gerado/client.js'
import { clienteDe, criarBancoMigrado } from './apoio/banco.js'
import { criarUsuario, subirApi, type Api } from './apoio/api.js'

/**
 * Item 8: o responsavel na rede de apoio. A equipe do paciente e a
 * coordenacao corrigem nome, telefone e parentesco a qualquer momento; o
 * e-mail, so enquanto o primeiro acesso esta pendente, porque depois ele e o
 * login da pessoa. Quem responde legalmente nao se edita (limite declarado).
 * A edicao e ALTERACAO na trilha, com o valor anterior so do que mudou.
 */

let prisma: PrismaClient
let api: Api
let apagar: () => Promise<void>
const u: Record<string, string> = {}
const c: Record<string, string> = {}
const p: Record<string, string> = {}

const MAE = { nome: 'Patrícia Ficticia', email: 'patricia@teste.example', telefone: '(92) 90000-0001', parentesco: 'Mãe', responsavelLegal: true }
const editar = (cookie: string, corpo: Record<string, unknown>, responsavelId = p.mae) =>
  api.pedir('PUT', `/pacientes/${p.paciente}/responsaveis/${responsavelId}`, { cookie, corpo })
const dados = (mudanca: Record<string, unknown> = {}) =>
  ({ nome: MAE.nome, telefone: MAE.telefone, parentesco: MAE.parentesco, ...mudanca })
const alteracoes = () => prisma.registroAuditoria.findMany({
  where: { idEntidade: p.mae, entidade: 'Responsavel', acao: 'ALTERACAO' }, orderBy: { ocorridoEm: 'asc' },
})

beforeAll(async () => {
  const banco = await criarBancoMigrado(inject('urlAdministrativa'), 'sinctea_responsavel')
  apagar = banco.apagar
  prisma = clienteDe(banco.url)
  u.ana = await criarUsuario(prisma, { email: 'ana@teste.example', nome: 'Ana Souza', perfis: ['TERAPEUTA'] })
  u.bruno = await criarUsuario(prisma, { email: 'bruno@teste.example', nome: 'Bruno Lima', perfis: ['TERAPEUTA'] })
  u.coord = await criarUsuario(prisma, { email: 'coord@teste.example', nome: 'Carla Coordenadora', perfis: ['COORDENADOR'] })
  u.prof = await criarUsuario(prisma, { email: 'prof@teste.example', perfis: ['PROFESSOR'], tipo: 'PROFESSOR_AEE' })
  u.outra = await criarUsuario(prisma, { email: 'outra@teste.example', perfis: ['RESPONSAVEL'], tipo: 'RESPONSAVEL' })
  api = await subirApi(banco.url)
  for (const nome of ['ana', 'bruno', 'coord', 'outra']) c[nome] = await api.entrar(`${nome}@teste.example`)
  p.paciente = (await api.pedir('POST', '/pacientes', {
    cookie: c.ana, corpo: { nome: 'Miguel Ficticio', dataNascimento: '2019-03-12', nivelSuporte: 2, profissionalResponsavelId: u.ana },
  })).corpo.id
  const mae = await api.pedir('POST', `/pacientes/${p.paciente}/responsaveis`, { cookie: c.ana, corpo: { ...MAE, email: 'patricia@teste.exmaple' } })
  p.mae = mae.corpo.responsavel.responsavelId
  p.link = mae.corpo.primeiroAcesso.token
})

afterAll(async () => {
  await api?.fechar()
  await prisma?.$disconnect()
  await apagar?.()
})

describe('editar o responsavel com o primeiro acesso pendente', () => {
  it('o e-mail digitado errado se corrige, em minusculas; a trilha guarda so o que mudou, com o paciente', async () => {
    const r = await editar(c.ana, dados({ email: ' Patricia@Teste.EXAMPLE ', telefone: '(92) 90000-0002' }))
    expect(r.status, JSON.stringify(r.corpo)).toBe(200)
    expect(r.corpo).toMatchObject({ email: 'patricia@teste.example', telefone: '(92) 90000-0002', primeiroAcessoPendente: true })
    const [registro] = await alteracoes()
    expect(registro).toMatchObject({
      usuarioId: u.ana, pacienteId: p.paciente,
      valorAnterior: jsonCanonico({ email: 'patricia@teste.exmaple', telefone: '(92) 90000-0001' }),
    })
    // O link que ja foi entregue continua valendo, e mostra o e-mail corrigido.
    expect((await api.pedir('GET', `/auth/primeiro-acesso/${p.link}`)).corpo).toMatchObject({ situacao: 'VALIDO', email: 'patricia@teste.example' })
  })

  it('sem mudanca, nada se escreve e nada entra na trilha', async () => {
    const antes = (await alteracoes()).length
    expect((await editar(c.ana, dados({ email: 'patricia@teste.example', telefone: '(92) 90000-0002' }))).status).toBe(200)
    expect((await alteracoes()).length).toBe(antes)
  })

  it('e-mail da equipe, da escola ou de outra pessoa e recusado; dado faltando tambem', async () => {
    for (const email of ['ANA@teste.example', 'prof@teste.example']) {
      const r = await editar(c.ana, dados({ email }))
      expect(r.status).toBe(409)
      expect(r.corpo.campos.email).toMatch(/equipe ou da escola/)
    }
    expect((await editar(c.ana, dados({ email: 'outra@teste.example' }))).corpo.campos.email).toMatch(/outra pessoa/)
    expect((await editar(c.ana, dados({ email: 'sem-arroba' }))).status).toBe(422)
    const vazio = await editar(c.ana, { nome: ' ', telefone: '', parentesco: '' })
    expect(Object.keys(vazio.corpo.campos).sort()).toEqual(['nome', 'parentesco', 'telefone'])
  })

  it('quem responde legalmente nao se edita', async () => {
    const r = await editar(c.ana, dados({ responsavelLegal: false }))
    expect(r.status).toBe(422)
    expect(r.corpo.campos).toHaveProperty('responsavelLegal')
    expect((await prisma.vinculoFamiliar.findFirstOrThrow({ where: { responsavelId: p.mae } })).responsavelLegal).toBe(true)
  })

  it('de fora da equipe, negado e registrado com o paciente; a familia nem chega a rota', async () => {
    expect((await editar(c.bruno, dados({ nome: 'Outro nome' }))).status).toBe(403)
    expect(await prisma.registroAuditoria.findFirst({ where: { usuarioId: u.bruno, acao: 'ACESSO_NEGADO' }, orderBy: { ocorridoEm: 'desc' } }))
      .toMatchObject({ pacienteId: p.paciente, entidade: 'Responsavel' })
    expect((await editar(c.outra, dados({ nome: 'Outro nome' }))).status).toBe(403)
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: p.mae } })).nome).toBe(MAE.nome)
  })
})

describe('editar o responsavel depois que ele definiu a senha', () => {
  beforeAll(async () => {
    expect((await api.pedir('POST', `/auth/primeiro-acesso/${p.link}`, { corpo: { senha: 'senha-da-patricia' } })).status).toBe(200)
  })

  it('o e-mail ja e o login: a clinica nao o troca, e a pessoa continua entrando com ele', async () => {
    const r = await editar(c.ana, dados({ email: 'patricia.nova@teste.example' }))
    expect(r.status).toBe(409)
    expect(r.corpo.campos.email).toMatch(/login/)
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: p.mae } })).email).toBe('patricia@teste.example')
    await api.entrar('patricia@teste.example', 'senha-da-patricia')
  })

  it('nome, telefone e parentesco continuam editaveis, pela coordenacao tambem; a trilha guarda so eles', async () => {
    const r = await editar(c.coord, dados({ nome: 'Patrícia Ficticia Souza', parentesco: 'Mãe biológica', telefone: '(92) 90000-0002' }))
    expect(r.status, JSON.stringify(r.corpo)).toBe(200)
    expect(r.corpo).toMatchObject({ nome: 'Patrícia Ficticia Souza', parentesco: 'Mãe biológica', primeiroAcessoPendente: false })
    expect((await alteracoes()).at(-1)).toMatchObject({
      usuarioId: u.coord, pacienteId: p.paciente,
      valorAnterior: jsonCanonico({ nome: 'Patrícia Ficticia', parentesco: 'Mãe' }),
    })
    const ficha = await api.pedir('GET', `/pacientes/${p.paciente}`, { cookie: c.ana })
    expect(ficha.corpo.redeApoio[0]).toMatchObject({ nome: 'Patrícia Ficticia Souza', parentesco: 'Mãe biológica', responsavelLegal: true })
  })

  it('o mesmo e-mail que ela ja tem nao e troca: a edicao sem o campo e com ele dao o mesmo', async () => {
    expect((await editar(c.ana, dados({ nome: 'Patrícia Ficticia Souza', parentesco: 'Mãe biológica', telefone: '(92) 90000-0002', email: 'patricia@teste.example' }))).status).toBe(200)
  })
})
