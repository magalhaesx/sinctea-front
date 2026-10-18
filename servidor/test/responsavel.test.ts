import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { jsonCanonico } from '@sinctea/compartilhado/dominio/hash'
import { resumoDoToken } from '../src/autenticacao/servico-sessoes.js'
import type { PrismaClient } from '../src/gerado/client.js'
import { clienteDe, criarBancoMigrado } from './apoio/banco.js'
import { criarUsuario, subirApi, type Api } from './apoio/api.js'

/**
 * Item 8: o responsavel na rede de apoio. A equipe do paciente e a
 * coordenacao corrigem nome, telefone e parentesco a qualquer momento; o
 * e-mail, so enquanto o primeiro acesso esta pendente, porque depois ele e o
 * login da pessoa. Quem responde legalmente nao se edita (limite declarado).
 * A edicao e ALTERACAO na trilha, com o valor anterior so do que mudou.
 *
 * Depois da senha definida, o link para nova senha e so da coordenacao, com
 * motivo na trilha; usado, troca a senha e encerra as sessoes, e o proximo
 * acesso avisa quem pediu, ate a pessoa dar ciencia.
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

describe('link para nova senha do responsavel', () => {
  const MOTIVO = 'A mãe ligou para a recepção: esqueceu a senha.'
  const novaSenha = (cookie: string, corpo: unknown, responsavelId = p.mae) =>
    api.pedir('POST', `/pacientes/${p.paciente}/responsaveis/${responsavelId}/nova-senha`, { cookie, corpo })
  const linksDeNovaSenha = () => prisma.acessoInicial.count({ where: { usuarioId: p.mae, finalidade: 'NOVA_SENHA' } })
  const sessaoDe = (cookie: string) => api.pedir('GET', '/auth/sessao', { cookie })
  const ultimaAlteracaoDaConta = () => prisma.registroAuditoria.findFirstOrThrow({
    where: { idEntidade: p.mae, entidade: 'Usuario', acao: 'ALTERACAO' }, orderBy: { ocorridoEm: 'desc' },
  })

  beforeAll(async () => {
    const pai = await api.pedir('POST', `/pacientes/${p.paciente}/responsaveis`, {
      cookie: c.ana, corpo: { nome: 'Paulo Ficticio', email: 'paulo@teste.example', telefone: '(92) 90000-0003', parentesco: 'Pai', responsavelLegal: false },
    })
    p.pai = pai.corpo.responsavel.responsavelId
    p.linkDoPai = pai.corpo.primeiroAcesso.token
  })

  it('a equipe nao gera, nem com motivo: negado e registrado com o paciente; o link de primeiro acesso tambem nao serve mais', async () => {
    expect((await novaSenha(c.ana, { motivo: MOTIVO })).status).toBe(403)
    expect(await prisma.registroAuditoria.findFirst({ where: { usuarioId: u.ana, acao: 'ACESSO_NEGADO' }, orderBy: { ocorridoEm: 'desc' } }))
      .toMatchObject({ pacienteId: p.paciente, entidade: 'Usuario', idEntidade: p.mae })
    expect((await api.pedir('POST', `/pacientes/${p.paciente}/responsaveis/${p.mae}/acesso-inicial`, { cookie: c.ana })).status).toBe(409)
    expect(await linksDeNovaSenha()).toBe(0)
  })

  it('sem motivo, ou so com espacos, a coordenacao e recusada, e nenhum link nasce', async () => {
    for (const corpo of [{}, { motivo: '   ' }, { motivo: 42 }]) {
      const r = await novaSenha(c.coord, corpo)
      expect(r.status).toBe(422)
      expect(r.corpo.campos).toHaveProperty('motivo')
    }
    expect((await novaSenha(c.coord, { motivo: 'x'.repeat(501) })).status).toBe(422)
    expect(await linksDeNovaSenha()).toBe(0)
  })

  it('quem ainda nao definiu a senha recebe o link de primeiro acesso, e nao este', async () => {
    expect((await novaSenha(c.coord, { motivo: MOTIVO }, p.pai)).status).toBe(409)
  })

  it('com motivo: o link nasce, o banco guarda so o resumo, e a trilha diz quem gerou e por que', async () => {
    const r = await novaSenha(c.coord, { motivo: `  ${MOTIVO}  ` })
    expect(r.status, JSON.stringify(r.corpo)).toBe(200)
    p.linkNovaSenha = r.corpo.token
    const horas = (new Date(r.corpo.expiraEm).getTime() - Date.now()) / 3_600_000
    expect(horas).toBeGreaterThan(71.9)
    expect(horas).toBeLessThanOrEqual(72)

    const linha = await prisma.acessoInicial.findFirstOrThrow({ where: { usuarioId: p.mae, finalidade: 'NOVA_SENHA' } })
    expect(linha).toMatchObject({ tokenResumo: resumoDoToken(p.linkNovaSenha), geradoPorId: u.coord, usadoEm: null, avisadoEm: null })
    expect(JSON.stringify(linha)).not.toContain(p.linkNovaSenha)

    const registro = await ultimaAlteracaoDaConta()
    expect(registro).toMatchObject({ usuarioId: u.coord, usuarioNome: 'Carla Coordenadora', perfil: 'COORDENADOR', pacienteId: p.paciente })
    expect(registro.detalhe).toContain(`Motivo: ${MOTIVO}`)
    expect(registro.detalhe).not.toContain(p.linkNovaSenha)

    expect((await api.pedir('GET', `/auth/primeiro-acesso/${p.linkNovaSenha}`)).corpo)
      .toMatchObject({ situacao: 'VALIDO', finalidade: 'NOVA_SENHA', email: 'patricia@teste.example' })
  })

  it('usado, troca a senha e encerra todas as sessoes da pessoa; o link nao vale de novo', async () => {
    const abertas = [await api.entrar('patricia@teste.example', 'senha-da-patricia'), await api.entrar('patricia@teste.example', 'senha-da-patricia')]
    for (const cookie of abertas) expect((await sessaoDe(cookie)).status).toBe(200)

    const usado = await api.pedir('POST', `/auth/primeiro-acesso/${p.linkNovaSenha}`, { corpo: { senha: 'nova-senha-da-patricia' } })
    expect(usado.status).toBe(200)
    for (const cookie of abertas) expect((await sessaoDe(cookie)).status).toBe(204)
    // So a sessao que o proprio link abriu.
    expect(await prisma.sessaoLogin.count({ where: { usuarioId: p.mae } })).toBe(1)
    expect((await api.pedir('POST', '/auth/entrar', { corpo: { email: 'patricia@teste.example', senha: 'senha-da-patricia' } })).status).toBe(401)
    expect((await api.pedir('POST', `/auth/primeiro-acesso/${p.linkNovaSenha}`, { corpo: { senha: 'outra-senha-qualquer' } })).status).toBe(409)
    expect((await ultimaAlteracaoDaConta()).detalhe).toMatch(/redefinida.*sessões abertas foram encerradas/)
  })

  it('no proximo acesso, o aviso diz quando e a pedido de quem; so a ciencia o tira', async () => {
    const { usadoEm } = await prisma.acessoInicial.findFirstOrThrow({ where: { usuarioId: p.mae, finalidade: 'NOVA_SENHA' } })
    const aviso = { redefinidaEm: usadoEm!.toISOString(), aPedidoDe: 'Carla Coordenadora' }

    const entrada = await api.pedir('POST', '/auth/entrar', { corpo: { email: 'patricia@teste.example', senha: 'nova-senha-da-patricia' } })
    expect(entrada.corpo.avisoDeRedefinicao).toEqual(aviso)
    const daMae = await api.entrar('patricia@teste.example', 'nova-senha-da-patricia')
    expect((await sessaoDe(daMae)).corpo.avisoDeRedefinicao).toEqual(aviso)

    const ciente = await api.pedir('POST', '/auth/aviso-de-nova-senha', { cookie: daMae })
    expect(ciente.status).toBe(200)
    expect(ciente.corpo.avisoDeRedefinicao).toBeNull()
    const depois = await api.entrar('patricia@teste.example', 'nova-senha-da-patricia')
    expect((await sessaoDe(depois)).corpo.avisoDeRedefinicao).toBeNull()
  })

  it('o banco recusa link de nova senha sem quem gerou, primeiro acesso com autor e ciencia antes do uso', async () => {
    const agora = new Date()
    const linha = (dados: Record<string, unknown>) => prisma.acessoInicial.create({ data: {
      tokenResumo: resumoDoToken(`teste-${Math.random()}`), usuarioId: p.mae, criadoEm: agora,
      expiraEm: new Date(agora.getTime() + 3_600_000), ...dados,
    } })
    await expect(linha({ finalidade: 'NOVA_SENHA' })).rejects.toThrow(/acesso_inicial_nova_senha_com_autor/)
    await expect(linha({ geradoPorId: u.coord })).rejects.toThrow(/acesso_inicial_nova_senha_com_autor/)
    await expect(linha({ finalidade: 'NOVA_SENHA', geradoPorId: u.coord, avisadoEm: agora })).rejects.toThrow(/acesso_inicial_ciencia_depois_do_uso/)
  })

  it('o primeiro acesso nao traz aviso, e a ciencia sem sessao e recusada', async () => {
    const r = await api.pedir('POST', `/auth/primeiro-acesso/${p.linkDoPai}`, { corpo: { senha: 'senha-do-paulo' } })
    expect(r.status).toBe(200)
    expect(r.corpo.avisoDeRedefinicao).toBeNull()
    expect((await api.pedir('POST', '/auth/aviso-de-nova-senha')).status).toBe(401)
  })
})
