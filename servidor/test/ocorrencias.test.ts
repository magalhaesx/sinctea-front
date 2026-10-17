import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { diaCivilEm } from '@sinctea/compartilhado/dominio/datas'
import type { PrismaClient } from '../src/gerado/client.js'
import { clienteDe, criarBancoMigrado } from './apoio/banco.js'
import { cookieDaSessao, criarUsuario, subirApi, type Api } from './apoio/api.js'

/**
 * Item 6 do caminho principal: o fim do ciclo clinica–escola, pela API, num
 * banco que comeca vazio. O professor relata; o relato chega a clinica como
 * evento preliminar e aviso; a leitura clinica e do profissional habilitado
 * (vocabulario obrigatorio do CLAUDE.md). So a equipe do paciente e a
 * coordenacao alcancam o evento (regra 3), e toda leitura, a leitura clinica
 * e a negativa entram na trilha (regra 6).
 */

let prisma: PrismaClient
let api: Api
let apagar: () => Promise<void>
const u: Record<string, string> = {}
const c: Record<string, string> = {}
const p: Record<string, string> = {}
const em90dias = () => diaCivilEm(new Date(Date.now() + 90 * 86_400_000))

const ultimaDe = async (where: Record<string, unknown>) =>
  (await prisma.registroAuditoria.findMany({ where, orderBy: { ocorridoEm: 'asc' } })).at(-1)

/** Um relato do professor, como a tela 19 o faz. */
const relatar = (tipo: string, intensidade = 2) =>
  api.pedir('POST', `/escola/alunos/${p.miguel}/ocorrencias`, { cookie: c.carla, corpo: { tipo, intensidade, contexto: 'Recreio' } })

beforeAll(async () => {
  const banco = await criarBancoMigrado(inject('urlAdministrativa'), 'sinctea_ocorrencias')
  apagar = banco.apagar
  prisma = clienteDe(banco.url)
  u.ana = await criarUsuario(prisma, { email: 'ana@teste.example', nome: 'Ana Terapeuta', perfis: ['TERAPEUTA'] })
  u.bruno = await criarUsuario(prisma, { email: 'bruno@teste.example', nome: 'Bruno Terapeuta', perfis: ['TERAPEUTA'] })
  u.coord = await criarUsuario(prisma, { email: 'coord@teste.example', nome: 'Caio Coordenador', perfis: ['COORDENADOR'] })
  api = await subirApi(banco.url)
  for (const nome of ['ana', 'bruno', 'coord']) c[nome] = await api.entrar(`${nome}@teste.example`)

  // O caminho inteiro, pelas rotas: paciente da Ana, responsavel legal,
  // escola, consentimento com registro de ocorrencia e o professor do convite.
  p.miguel = (await api.pedir('POST', '/pacientes', {
    cookie: c.ana, corpo: { nome: 'Miguel Ficticio Santana', dataNascimento: '2019-03-12', nivelSuporte: 2, profissionalResponsavelId: u.ana },
  })).corpo.id
  const mae = await api.pedir('POST', `/pacientes/${p.miguel}/responsaveis`, {
    cookie: c.ana, corpo: { nome: 'Patrícia Ficticia', email: 'mae@teste.example', telefone: '(92) 90000-0000', parentesco: 'Mãe', responsavelLegal: true },
  })
  await api.pedir('POST', `/auth/primeiro-acesso/${mae.corpo.primeiroAcesso.token}`, { corpo: { senha: 'senha-da-mae-1' } })
  c.mae = await api.entrar('mae@teste.example', 'senha-da-mae-1')
  const escola = await api.pedir('POST', '/escolas', { cookie: c.mae, corpo: { nome: 'Escola Municipal Vitória-Régia', rede: 'Municipal', municipio: 'Manaus' } })
  const consentimento = await api.pedir('POST', '/consentimentos', {
    cookie: c.mae, corpo: { pacienteId: p.miguel, escolaId: escola.corpo.id, escopos: ['CARTAO_ESTRATEGIA', 'REGISTRO_OCORRENCIA'], validadeAte: em90dias() },
  })
  p.consentimento = consentimento.corpo.consentimento.id
  const carla = await api.pedir('POST', `/convites/${consentimento.corpo.tokenConvite}/aceite`, {
    corpo: { nome: 'Carla Professora', email: 'carla@escola.example', senha: 'senha-da-carla', turma: '2º ano A', turno: 'Matutino', atuacao: 'Regente' },
  })
  expect(carla.status, JSON.stringify(carla.corpo)).toBe(200)
  c.carla = cookieDaSessao(carla)
})

afterAll(async () => {
  await api?.fechar()
  await prisma?.$disconnect()
  await apagar?.()
})

describe('o relato da escola chega a clinica', () => {
  it('como aviso, so para a equipe do paciente e a coordenacao; a consulta fica na trilha', async () => {
    const r = await relatar('Tapou os ouvidos')
    expect(r.status).toBe(201)
    p.escolar = r.corpo.id
    p.evento = (await prisma.ocorrenciaComportamental.findFirstOrThrow({ where: { ocorrenciaEscolarId: p.escolar } })).id

    const daAna = await api.pedir('GET', '/ocorrencias/avisos-escola', { cookie: c.ana })
    expect(daAna.status).toBe(200)
    expect(daAna.corpo.itens).toEqual([{
      ocorrenciaId: p.evento, paciente: { id: p.miguel, nome: 'Miguel Ficticio Santana' }, escola: 'Escola Municipal Vitória-Régia',
      registradaEm: r.corpo.registradaEm, tipo: 'Tapou os ouvidos', intensidade: 2,
    }])
    expect(await ultimaDe({ usuarioId: u.ana, entidade: 'OcorrenciaEscolar' })).toMatchObject({ acao: 'LEITURA_AUTORIZADA', detalhe: 'Avisos da escola: 1.' })

    expect((await api.pedir('GET', '/ocorrencias/avisos-escola', { cookie: c.coord })).corpo.total).toBe(1)
    // Fora da equipe, o aviso nao aparece: nem o nome do paciente sai.
    expect((await api.pedir('GET', '/ocorrencias/avisos-escola', { cookie: c.bruno })).corpo).toMatchObject({ total: 0, itens: [] })
  })

  it('como evento preliminar na ficha, com a origem; a leitura fica na trilha com o paciente', async () => {
    const r = await api.pedir('GET', `/pacientes/${p.miguel}/ocorrencias`, { cookie: c.ana })
    expect(r.corpo.itens).toEqual([expect.objectContaining({
      id: p.evento, origem: 'ESCOLA', comportamento: 'Tapou os ouvidos', leituraClinicaEm: null, ocorrenciaEscolarId: p.escolar,
    })])
    expect(await ultimaDe({ usuarioId: u.ana, entidade: 'OcorrenciaComportamental' })).toMatchObject({
      acao: 'LEITURA_AUTORIZADA', pacienteId: p.miguel,
    })
    expect((await api.pedir('GET', `/pacientes/${p.miguel}/ocorrencias?origem=CLINICA`, { cookie: c.ana })).corpo.total).toBe(0)
    expect((await api.pedir('GET', `/pacientes/${p.miguel}/ocorrencias?desde=nao-e-data`, { cookie: c.ana })).status).toBe(422)
  })

  it('regra 3: fora da equipe, a ficha nega e a negativa fica com o paciente; escola e familia nao entram', async () => {
    expect((await api.pedir('GET', `/pacientes/${p.miguel}/ocorrencias`, { cookie: c.bruno })).status).toBe(403)
    expect(await ultimaDe({ usuarioId: u.bruno, acao: 'ACESSO_NEGADO' })).toMatchObject({ pacienteId: p.miguel })
    for (const quem of ['carla', 'mae']) {
      expect((await api.pedir('GET', '/ocorrencias/avisos-escola', { cookie: c[quem] })).status, quem).toBe(403)
      expect((await api.pedir('GET', `/pacientes/${p.miguel}/ocorrencias`, { cookie: c[quem] })).status, quem).toBe(403)
      expect((await api.pedir('POST', `/ocorrencias/${p.evento}/leitura-clinica`, { cookie: c[quem] })).status, quem).toBe(403)
    }
    expect((await api.pedir('GET', '/ocorrencias/avisos-escola')).status).toBe(401)
  })
})

describe('a leitura clinica e do profissional habilitado', () => {
  it('fora da equipe, recusada e registrada; da equipe, gravada, e o aviso sai da lista', async () => {
    expect((await api.pedir('POST', `/ocorrencias/${p.evento}/leitura-clinica`, { cookie: c.bruno })).status).toBe(403)
    expect(await ultimaDe({ usuarioId: u.bruno, acao: 'ACESSO_NEGADO' })).toMatchObject({ pacienteId: p.miguel })

    const r = await api.pedir('POST', `/ocorrencias/${p.evento}/leitura-clinica`, { cookie: c.ana })
    expect(r.status).toBe(200)
    expect(r.corpo.leituraClinicaEm).toEqual(expect.any(String))
    expect(await ultimaDe({ usuarioId: u.ana, acao: 'ALTERACAO' })).toMatchObject({
      entidade: 'OcorrenciaComportamental', idEntidade: p.evento, pacienteId: p.miguel,
      detalhe: 'Leitura clínica registrada (evento de origem ESCOLA).',
    })
    expect((await api.pedir('GET', '/ocorrencias/avisos-escola', { cookie: c.ana })).corpo.total).toBe(0)
    const naFicha = await api.pedir('GET', `/pacientes/${p.miguel}/ocorrencias`, { cookie: c.ana })
    expect(naFicha.corpo.itens[0].leituraClinicaEm).toBe(r.corpo.leituraClinicaEm)
  })

  it('uma vez so: a segunda leitura e conflito, e a data da primeira fica', async () => {
    const antes = (await prisma.ocorrenciaComportamental.findUniqueOrThrow({ where: { id: p.evento } })).leituraClinicaEm
    expect((await api.pedir('POST', `/ocorrencias/${p.evento}/leitura-clinica`, { cookie: c.coord })).status).toBe(409)
    expect((await prisma.ocorrenciaComportamental.findUniqueOrThrow({ where: { id: p.evento } })).leituraClinicaEm).toEqual(antes)
    expect((await api.pedir('POST', '/ocorrencias/nao-e-uuid/leitura-clinica', { cookie: c.ana })).status).toBe(404)
  })

  it('o aviso vale por sete dias; o relato antigo continua na ficha, esperando a leitura', async () => {
    const r = await relatar('Saiu da sala', 3)
    await prisma.ocorrenciaEscolar.update({ where: { id: r.corpo.id }, data: { registradaEm: new Date(Date.now() - 8 * 86_400_000) } })
    expect((await api.pedir('GET', '/ocorrencias/avisos-escola', { cookie: c.ana })).corpo.total).toBe(0)
    const desde = new Date(Date.now() - 10 * 86_400_000).toISOString()
    expect((await api.pedir('GET', `/ocorrencias/avisos-escola?desde=${encodeURIComponent(desde)}`, { cookie: c.ana })).corpo.total).toBe(1)
    const naFicha = await api.pedir('GET', `/pacientes/${p.miguel}/ocorrencias`, { cookie: c.ana })
    expect(naFicha.corpo.itens.filter((o: { leituraClinicaEm: string | null }) => o.leituraClinicaEm === null)).toHaveLength(1)
  })

  it('quatro pedidos ao mesmo tempo: so uma leitura e gravada, e so ela entra na trilha', async () => {
    const r = await relatar('Recusou a tarefa')
    const evento = (await prisma.ocorrenciaComportamental.findFirstOrThrow({ where: { ocorrenciaEscolarId: r.corpo.id } })).id
    const respostas = await Promise.all([c.ana, c.coord, c.ana, c.coord].map((cookie) =>
      api.pedir('POST', `/ocorrencias/${evento}/leitura-clinica`, { cookie })))
    expect(respostas.map((x) => x.status).sort()).toEqual([200, 409, 409, 409])
    expect(await prisma.registroAuditoria.count({ where: { idEntidade: evento, acao: 'ALTERACAO' } })).toBe(1)
  })

  it('encerrado o acesso da escola, o que ela relatou continua na clinica', async () => {
    await api.pedir('POST', `/consentimentos/${p.consentimento}/revogacao`, { cookie: c.mae })
    expect((await relatar('Chorou')).status).toBe(403)
    expect((await api.pedir('GET', `/pacientes/${p.miguel}/ocorrencias`, { cookie: c.ana })).corpo.total).toBe(3)
  })
})
