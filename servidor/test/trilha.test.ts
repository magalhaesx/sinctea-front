import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { diaCivilEm } from '@sinctea/compartilhado/dominio/datas'
import type { PrismaClient } from '../src/gerado/client.js'
import { clienteDe, criarBancoMigrado } from './apoio/banco.js'
import { cookieDaSessao, criarUsuario, subirApi, type Api, type Resposta } from './apoio/api.js'

/**
 * Item 24: a trilha de autonomia, pela API, num banco que comeca vazio. A
 * mesma resposta pela clinica e pela familia; so o plano vigente; o texto
 * como a equipe o gravou, byte a byte. A escola, a administracao e quem nao
 * tem vinculo sao negados, e cada negativa fica na trilha de auditoria com o
 * paciente. Cada leitura deixa uma linha LEITURA_AUTORIZADA, tambem com ele.
 */

let prisma: PrismaClient
let api: Api
let apagar: () => Promise<void>
const u: Record<string, string> = {}
const c: Record<string, string> = {}
const p: Record<string, string> = {}

// Acento combinado (NFD), quebra de linha e espaco no fim: o que a equipe gravou sai igual.
const HABILIDADE_RECENTE = 'Lavar as mãos sozinho,\nseguindo os desenhos do passo a passo. '
const HABILIDADE_ANTIGA = 'Pedir ajuda com uma palavra: "ajuda".'
const EM_AQUISICAO = 'Esperar a vez na fila do lanche.'
const TECNICA = 'Redação técnica que nunca sai: lavagem das mãos com 6 etapas em 8 de 10 oportunidades.'
const DOMINIO = 'Autocuidado e vida diária'
const FORA = 'Do plano que não é o vigente'
const CARTAO = {
  tituloSimples: 'Na hora de lavar as mãos',
  oQueFazer: ['Deixe o cartaz dos passos à altura dos olhos.', 'Espere.\nDepois elogie o que deu certo.'],
  oQueEvitar: ['Não faça os passos no lugar da criança.'],
  sinalAlerta: 'Se tapar os ouvidos com o secador ligado,\nofereça a toalha de papel.',
}
const CARTAO_2 = { tituloSimples: 'Na fila', oQueFazer: ['Mostre quantos faltam.'], oQueEvitar: ['Não apresse.'], sinalAlerta: 'Balançar o corpo.' }

const daClinica = (cookie: string | undefined, pacienteId = p.miguel) => api.pedir('GET', `/pacientes/${pacienteId}/trilha`, { cookie })
const daFamilia = (cookie: string | undefined, pacienteId = p.miguel) => api.pedir('GET', `/familia/filhos/${pacienteId}/trilha`, { cookie })
const semInstante = (corpo: Record<string, unknown>) => ({ ...corpo, geradaEm: null })

/** Faz o pedido e confere que ele deixou exatamente uma linha na trilha; devolve a resposta e a linha. */
async function comUmaLinha(pedido: () => Promise<Resposta>) {
  const antes = (await prisma.registroAuditoria.findMany({ select: { id: true } })).map((x) => x.id)
  const r = await pedido()
  const linhas = await prisma.registroAuditoria.findMany({ where: { id: { notIn: antes } } })
  expect(linhas, JSON.stringify(r.corpo)).toHaveLength(1)
  return { r, linha: linhas[0] }
}

/** Plano gravado direto no banco: pela API, o paciente tem um plano so, e o dominio so se confirma no vigente. */
async function plano(pacienteId: string, status: 'VIGENTE' | 'RASCUNHO' | 'AGUARDANDO_VALIDACAO' | 'DEVOLVIDO') {
  return (await prisma.planoTerapeutico.create({ data: {
    pacienteId, autorId: u.ana, status, dataInicio: new Date('2026-08-01T00:00:00.000Z'), dataRevisao: new Date('2027-02-01T00:00:00.000Z'),
  } })).id
}
async function objetivo(planoId: string, descricaoAcessivel: string, dominadoEm: string | null, status = dominadoEm ? 'DOMINADO' : 'EM_AQUISICAO') {
  return (await prisma.objetivo.create({ data: {
    planoId, dominio: DOMINIO, descricaoTecnica: TECNICA, descricaoAcessivel, status: status as 'DOMINADO',
    dominadoEm: dominadoEm ? new Date(dominadoEm) : null, percentualAtual: 87.5, percentualMinimo: 80, sessoesConsecutivas: 2,
  } })).id
}
const cartao = (objetivoId: string, dados: typeof CARTAO) =>
  prisma.cartaoEstrategia.create({ data: { objetivoId, ...dados, atualizadoEm: new Date() } })

/** Um responsavel com a senha definida, pela ficha do paciente. */
async function responsavel(pacienteId: string, email: string, nome: string, parentesco: string, responsavelLegal: boolean) {
  const r = await api.pedir('POST', `/pacientes/${pacienteId}/responsaveis`, {
    cookie: c.ana, corpo: { nome, email, telefone: '(92) 90000-0000', parentesco, responsavelLegal },
  })
  expect(r.status, JSON.stringify(r.corpo)).toBe(201)
  if (r.corpo.primeiroAcesso) {
    await api.pedir('POST', `/auth/primeiro-acesso/${r.corpo.primeiroAcesso.token}`, { corpo: { senha: 'senha-da-familia-1' } })
  }
  u[email] = r.corpo.responsavel.responsavelId
  return api.entrar(email, 'senha-da-familia-1')
}

beforeAll(async () => {
  const banco = await criarBancoMigrado(inject('urlAdministrativa'), 'sinctea_trilha')
  apagar = banco.apagar
  prisma = clienteDe(banco.url)
  u.ana = await criarUsuario(prisma, { email: 'ana@teste.example', nome: 'Ana Souza', perfis: ['TERAPEUTA'] })
  u.bruno = await criarUsuario(prisma, { email: 'bruno@teste.example', nome: 'Bruno Lima', perfis: ['TERAPEUTA'] })
  u.coord = await criarUsuario(prisma, { email: 'coord@teste.example', nome: 'Caio Coordenador', perfis: ['COORDENADOR'] })
  u.admin = await criarUsuario(prisma, { email: 'admin@teste.example', nome: 'Zélia Administradora', perfis: ['ADMINISTRADOR'] })
  api = await subirApi(banco.url)
  for (const nome of ['ana', 'bruno', 'coord', 'admin']) c[nome] = await api.entrar(`${nome}@teste.example`)

  const paciente = async (nome: string) => (await api.pedir('POST', '/pacientes', {
    cookie: c.ana, corpo: { nome, dataNascimento: '2019-03-12', nivelSuporte: 2, profissionalResponsavelId: u.ana },
  })).corpo.id as string
  p.miguel = await paciente('Miguel Ficticio Santana')
  p.laura = await paciente('Laura Ficticia Reis')
  p.davi = await paciente('Davi Ficticio Farias')

  // Miguel: um plano antigo, que nao e o vigente, gravado antes, com um objetivo
  // dominado e um cartao; e o vigente, com dois dominados, um em aquisicao e
  // tres cartoes, em dois objetivos.
  const antigo = await plano(p.miguel, 'DEVOLVIDO')
  await cartao(await objetivo(antigo, FORA, '2026-11-20T15:00:00.000Z'), { ...CARTAO, tituloSimples: FORA })
  const vigente = await plano(p.miguel, 'VIGENTE')
  p.oAntigo = await objetivo(vigente, HABILIDADE_ANTIGA, '2026-09-10T15:00:00.000Z')
  p.oRecente = await objetivo(vigente, HABILIDADE_RECENTE, '2026-11-01T02:00:00.000Z')
  p.oAquisicao = await objetivo(vigente, EM_AQUISICAO, null)
  await cartao(p.oRecente, CARTAO)
  await cartao(p.oAquisicao, CARTAO_2)
  await cartao(p.oRecente, { ...CARTAO_2, tituloSimples: 'Depois do banheiro' })

  // Laura: so um plano aguardando validacao, com objetivo dominado e cartao. Davi: sem plano.
  const daLaura = await plano(p.laura, 'AGUARDANDO_VALIDACAO')
  await cartao(await objetivo(daLaura, FORA, '2026-10-05T15:00:00.000Z'), CARTAO)

  // A mae, responsavel legal; o avo, nao; a tia, so de outra crianca.
  c.mae = await responsavel(p.miguel, 'mae@teste.example', 'Patrícia Ficticia', 'Mãe', true)
  c.avo = await responsavel(p.miguel, 'avo@teste.example', 'Jorge Ficticio', 'Avô', false)
  c.tia = await responsavel(p.davi, 'tia@teste.example', 'Rita Ficticia', 'Tia', true)

  // A professora, pelo caminho inteiro, com o cartao autorizado: nem assim le a trilha.
  const escola = await api.pedir('POST', '/escolas', { cookie: c.mae, corpo: { nome: 'Escola Municipal Vitória-Régia', rede: 'Municipal', municipio: 'Manaus' } })
  const consentimento = await api.pedir('POST', '/consentimentos', {
    cookie: c.mae, corpo: { pacienteId: p.miguel, escolaId: escola.corpo.id, escopos: ['CARTAO_ESTRATEGIA', 'REGISTRO_OCORRENCIA'], validadeAte: diaCivilEm(new Date(Date.now() + 90 * 86_400_000)) },
  })
  const carla = await api.pedir('POST', `/convites/${consentimento.corpo.tokenConvite}/aceite`, {
    corpo: { nome: 'Carla Professora', email: 'carla@escola.example', senha: 'senha-da-carla', turma: '2º ano A', turno: 'Matutino', atuacao: 'Regente' },
  })
  expect(carla.status, JSON.stringify(carla.corpo)).toBe(200)
  c.carla = cookieDaSessao(carla)
  u.carla = carla.corpo.usuario.id
  expect((await api.pedir('GET', `/escola/alunos/${p.miguel}/cartao`, { cookie: c.carla })).status).toBe(200)
})

afterAll(async () => {
  await api?.fechar()
  await prisma?.$disconnect()
  await apagar?.()
})

describe('a equipe, a coordenacao e a familia leem a trilha', () => {
  it('a equipe: so o plano vigente, as habilidades do dominio mais recente para o mais antigo, e uma linha com o paciente', async () => {
    const { r, linha } = await comUmaLinha(() => daClinica(c.ana))
    expect(r.status, JSON.stringify(r.corpo)).toBe(200)
    // 2026-11-01T02:00Z ainda e 31 de outubro em Manaus.
    expect(r.corpo.habilidades).toEqual([
      { descricaoAcessivel: HABILIDADE_RECENTE, desde: '2026-10' },
      { descricaoAcessivel: HABILIDADE_ANTIGA, desde: '2026-09' },
    ])
    // Os cartoes do vigente, por objetivo e na ordem em que foram escritos; o do plano antigo fica fora.
    expect(r.corpo.estrategias.map((e: { tituloSimples: string }) => e.tituloSimples))
      .toEqual(['Na hora de lavar as mãos', 'Depois do banheiro', 'Na fila'])
    expect(r.corpo).toMatchObject({ pacienteId: p.miguel, nome: 'Miguel Ficticio Santana' })
    expect(JSON.stringify(r.corpo)).not.toContain(FORA)
    expect(linha).toMatchObject({
      acao: 'LEITURA_AUTORIZADA', entidade: 'TrilhaAutonomia', pacienteId: p.miguel, usuarioId: u.ana, perfil: 'TERAPEUTA',
      detalhe: 'Trilha de autonomia: 2 habilidades dominadas e 3 estratégias.',
    })
  })

  it('a coordenacao, a mae (legal) e o avo (nao legal): a mesma resposta, cada um com a sua linha', async () => {
    const referencia = semInstante((await daClinica(c.ana)).corpo)
    for (const [quem, pedido, perfil] of [
      ['coord', () => daClinica(c.coord), 'COORDENADOR'],
      ['mae@teste.example', () => daFamilia(c.mae), 'RESPONSAVEL'],
      ['avo@teste.example', () => daFamilia(c.avo), 'RESPONSAVEL'],
    ] as const) {
      const { r, linha } = await comUmaLinha(pedido)
      expect(r.status, quem).toBe(200)
      expect(semInstante(r.corpo), quem).toEqual(referencia)
      expect(linha, quem).toMatchObject({
        acao: 'LEITURA_AUTORIZADA', entidade: 'TrilhaAutonomia', pacienteId: p.miguel, usuarioId: u[quem], perfil,
      })
    }
  })

  it('o texto sai como foi gravado: acentos, quebras de linha e espacos, byte a byte', async () => {
    const r = await daFamilia(c.mae)
    const gravado = await prisma.objetivo.findUniqueOrThrow({ where: { id: p.oRecente } })
    expect(gravado.descricaoAcessivel).toBe(HABILIDADE_RECENTE)
    expect(Buffer.from(r.corpo.habilidades[0].descricaoAcessivel)).toEqual(Buffer.from(gravado.descricaoAcessivel))
    const cartaoGravado = await prisma.cartaoEstrategia.findFirstOrThrow({ where: { objetivoId: p.oRecente, tituloSimples: CARTAO.tituloSimples } })
    expect(r.corpo.estrategias[0]).toEqual({
      tituloSimples: cartaoGravado.tituloSimples, oQueFazer: cartaoGravado.oQueFazer,
      oQueEvitar: cartaoGravado.oQueEvitar, sinalAlerta: cartaoGravado.sinalAlerta,
    })
    expect(r.corpo.estrategias[0].oQueFazer[1]).toBe('Espere.\nDepois elogie o que deu certo.')
  })

  it('so as chaves do tipo: nem dominio, nem redacao tecnica, nem percentual, nem nivel de suporte', async () => {
    for (const r of [await daClinica(c.ana), await daFamilia(c.mae), await daFamilia(c.avo)]) {
      expect(Object.keys(r.corpo).sort()).toEqual(['estrategias', 'geradaEm', 'habilidades', 'nome', 'pacienteId'])
      for (const h of r.corpo.habilidades) expect(Object.keys(h).sort()).toEqual(['descricaoAcessivel', 'desde'])
      for (const e of r.corpo.estrategias) expect(Object.keys(e).sort()).toEqual(['oQueEvitar', 'oQueFazer', 'sinalAlerta', 'tituloSimples'])
      const texto = JSON.stringify(r.corpo)
      for (const proibido of ['descricaoTecnica', '"dominio', 'percentual', 'nivelSuporte', 'criterio', 'dominadoEm', TECNICA, DOMINIO, '87.5']) {
        expect(texto, proibido).not.toContain(proibido)
      }
    }
  })

  it('sem plano vigente: as duas partes vazias, mesmo com objetivo dominado e cartao no plano que aguarda validacao', async () => {
    const laura = await daClinica(c.ana, p.laura)
    expect(laura.status).toBe(200)
    expect(laura.corpo).toMatchObject({ habilidades: [], estrategias: [] })
    const davi = await comUmaLinha(() => daFamilia(c.tia, p.davi))
    expect(davi.r.status).toBe(200)
    expect(davi.r.corpo).toMatchObject({ pacienteId: p.davi, habilidades: [], estrategias: [] })
    expect(davi.linha).toMatchObject({ acao: 'LEITURA_AUTORIZADA', pacienteId: p.davi, detalhe: 'Trilha de autonomia: 0 habilidades dominadas e 0 estratégias.' })
  })

  it('id que nao existe ou nao e uuid: 404, pelas duas portas', async () => {
    for (const id of ['nao-e-uuid', '00000000-0000-7000-8000-000000000000']) {
      expect((await daClinica(c.ana, id)).status).toBe(404)
      expect((await daFamilia(c.mae, id)).status).toBe(404)
    }
  })
})

describe('a escola, a administracao e quem nao tem vinculo sao negados, e cada negativa fica na trilha', () => {
  const negado = (r: Resposta, quem: string) => {
    expect(r.status, quem).toBe(403)
    expect(r.corpo.codigo, quem).toBe('ACESSO_NEGADO')
    expect(JSON.stringify(r.corpo), quem).not.toContain('Lavar')
  }

  it('pela porta da clinica: profissional fora da equipe, familia, professora e administracao', async () => {
    for (const [quem, perfil] of [['bruno', 'TERAPEUTA'], ['mae@teste.example', 'RESPONSAVEL'], ['carla', 'PROFESSOR'], ['admin', 'ADMINISTRADOR']] as const) {
      const cookie = c[quem.split('@')[0]]
      const { r, linha } = await comUmaLinha(() => daClinica(cookie))
      negado(r, quem)
      expect(linha, quem).toMatchObject({ acao: 'ACESSO_NEGADO', entidade: 'TrilhaAutonomia', pacienteId: p.miguel, usuarioId: u[quem], perfil })
    }
  })

  it('pela porta da familia: responsavel de outra crianca, equipe, coordenacao, professora e administracao', async () => {
    for (const [quem, perfil] of [
      ['tia@teste.example', 'RESPONSAVEL'], ['ana', 'TERAPEUTA'], ['coord', 'COORDENADOR'], ['carla', 'PROFESSOR'], ['admin', 'ADMINISTRADOR'],
    ] as const) {
      const cookie = c[quem.split('@')[0]]
      const { r, linha } = await comUmaLinha(() => daFamilia(cookie))
      negado(r, quem)
      expect(linha, quem).toMatchObject({ acao: 'ACESSO_NEGADO', entidade: 'TrilhaAutonomia', pacienteId: p.miguel, usuarioId: u[quem], perfil })
    }
  })

  it('o motivo de cada negativa: o alcance para quem passa pela marca da rota, o perfil para quem nao passa', async () => {
    expect((await comUmaLinha(() => daClinica(c.bruno))).linha.detalhe).toBe('Paciente fora do alcance do perfil.')
    expect((await comUmaLinha(() => daFamilia(c.tia))).linha.detalhe).toBe('Responsável não vinculado ao paciente.')
    expect((await comUmaLinha(() => daClinica(c.carla))).linha.detalhe).toBe('Perfil PROFESSOR sem permissão.')
    expect((await comUmaLinha(() => daFamilia(c.admin))).linha.detalhe).toBe('Perfil ADMINISTRADOR sem permissão.')
  })

  it('sem sessao: 401, pelas duas portas', async () => {
    expect((await daClinica(undefined)).status).toBe(401)
    expect((await daFamilia(undefined)).status).toBe(401)
  })
})
