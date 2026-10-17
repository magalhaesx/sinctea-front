import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { diaCivilEm } from '@sinctea/compartilhado/dominio/datas'
import { EVOLUCAO_MAXIMO } from '@sinctea/compartilhado/dominio/regras'
import type { PrismaClient } from '../src/gerado/client.js'
import { clienteDe, criarBancoMigrado } from './apoio/banco.js'
import { cookieDaSessao, criarUsuario, subirApi, type Api } from './apoio/api.js'

/**
 * Item 7, parte 1: a evolucao da sessao (Resolucao CFP 001/2009) e a
 * ocorrencia registrada na sessao, pela API, num banco que comeca vazio.
 * Encerrar exige a evolucao, escrita pelo profissional e gravada como veio; so
 * a equipe e a coordenacao a leem — a familia e a escola, nunca (regra 3); a
 * escrita e a leitura entram na trilha (regra 6).
 */

let prisma: PrismaClient
let api: Api
let apagar: () => Promise<void>
const u: Record<string, string> = {}
const c: Record<string, string> = {}
const p: Record<string, string> = {}
/** Marca que nao aparece em nenhum outro lugar: se vazar, o teste acha. */
const EVOLUCAO = '  Trabalhou mando com figura; respondeu melhor depois do intervalo.\nPróxima: generalizar para o lanche. MARCA-EVOLUCAO-7  '
const em90dias = () => diaCivilEm(new Date(Date.now() + 90 * 86_400_000))

const ultimaDe = async (where: Record<string, unknown>) =>
  (await prisma.registroAuditoria.findMany({ where, orderBy: { ocorridoEm: 'asc' } })).at(-1)

beforeAll(async () => {
  const banco = await criarBancoMigrado(inject('urlAdministrativa'), 'sinctea_sessao')
  apagar = banco.apagar
  prisma = clienteDe(banco.url)
  u.ana = await criarUsuario(prisma, { email: 'ana@teste.example', nome: 'Ana Souza', perfis: ['TERAPEUTA'] })
  u.bruno = await criarUsuario(prisma, { email: 'bruno@teste.example', nome: 'Bruno Lima', perfis: ['TERAPEUTA'] })
  u.coord = await criarUsuario(prisma, { email: 'coord@teste.example', nome: 'Caio Coordenador', perfis: ['COORDENADOR'] })
  api = await subirApi(banco.url)
  for (const nome of ['ana', 'bruno', 'coord']) c[nome] = await api.entrar(`${nome}@teste.example`)

  // O caminho inteiro: paciente com plano vigente, responsavel legal, escola e professor.
  p.miguel = (await api.pedir('POST', '/pacientes', {
    cookie: c.ana, corpo: { nome: 'Miguel Ficticio', dataNascimento: '2019-03-12', nivelSuporte: 2, profissionalResponsavelId: u.ana },
  })).corpo.id
  const plano = await api.pedir('POST', `/pacientes/${p.miguel}/plano`, { cookie: c.ana, corpo: { dataInicio: '2026-10-01', dataRevisao: '2027-04-01' } })
  p.objetivo = (await api.pedir('POST', `/planos/${plano.corpo.id}/objetivos`, {
    cookie: c.ana,
    corpo: { dominio: 'Comunicação', descricaoTecnica: 'Mando com figura.', descricaoAcessivel: 'Pedir o que quer.', criterio: { percentualMinimo: 80, sessoesConsecutivas: 2 } },
  })).corpo.id
  await api.pedir('POST', `/objetivos/${p.objetivo}/cartoes`, {
    cookie: c.ana, corpo: { tituloSimples: 'Pedir ajuda', oQueFazer: ['Mostrar a figura'], oQueEvitar: ['Falar alto'], sinalAlerta: 'Tapa os ouvidos.' },
  })
  await api.pedir('POST', `/planos/${plano.corpo.id}/envio`, { cookie: c.ana })
  await api.pedir('POST', `/planos/${plano.corpo.id}/aprovacao`, { cookie: c.coord })
  const mae = await api.pedir('POST', `/pacientes/${p.miguel}/responsaveis`, {
    cookie: c.ana, corpo: { nome: 'Patrícia Ficticia', email: 'mae@teste.example', telefone: '(92) 90000-0000', parentesco: 'Mãe', responsavelLegal: true },
  })
  await api.pedir('POST', `/auth/primeiro-acesso/${mae.corpo.primeiroAcesso.token}`, { corpo: { senha: 'senha-da-mae-1' } })
  c.mae = await api.entrar('mae@teste.example', 'senha-da-mae-1')
  const escola = await api.pedir('POST', '/escolas', { cookie: c.mae, corpo: { nome: 'Escola Municipal Vitória-Régia', rede: 'Municipal', municipio: 'Manaus' } })
  const consentimento = await api.pedir('POST', '/consentimentos', {
    cookie: c.mae, corpo: { pacienteId: p.miguel, escolaId: escola.corpo.id, escopos: ['CARTAO_ESTRATEGIA', 'REGISTRO_OCORRENCIA'], validadeAte: em90dias() },
  })
  const carla = await api.pedir('POST', `/convites/${consentimento.corpo.tokenConvite}/aceite`, {
    corpo: { nome: 'Carla Professora', email: 'carla@escola.example', senha: 'senha-da-carla', turma: '2º ano A', turno: 'Matutino', atuacao: 'Regente' },
  })
  c.carla = cookieDaSessao(carla)
  p.sessao = (await api.pedir('POST', '/sessoes', { cookie: c.ana, corpo: { pacienteId: p.miguel } })).corpo.id
  await api.pedir('POST', `/sessoes/${p.sessao}/registros`, { cookie: c.ana, corpo: { objetivoId: p.objetivo, resultado: 'INDEPENDENTE' } })
})

afterAll(async () => {
  await api?.fechar()
  await prisma?.$disconnect()
  await apagar?.()
})

describe('a ocorrencia registrada na sessao', () => {
  const ABC = { antecedente: 'Troca de atividade', comportamento: 'Saiu da mesa', consequencia: 'Voltou com o aviso visual', intensidade: 2 }

  it('so quem conduz registra; a negativa fica com o paciente', async () => {
    const r = await api.pedir('POST', `/sessoes/${p.sessao}/ocorrencias`, { cookie: c.coord, corpo: ABC })
    expect(r.status).toBe(403)
    expect(await ultimaDe({ usuarioId: u.coord, acao: 'ACESSO_NEGADO' })).toMatchObject({ pacienteId: p.miguel })
  })

  it('registro ABC incompleto e recusado, campo a campo', async () => {
    const r = await api.pedir('POST', `/sessoes/${p.sessao}/ocorrencias`, { cookie: c.ana, corpo: { ...ABC, consequencia: ' ', intensidade: 7 } })
    expect(r.status).toBe(422)
    expect(Object.keys(r.corpo.campos).sort()).toEqual(['consequencia', 'intensidade'])
  })

  it('quem registra e o profissional: a leitura clinica e esta, o evento vai para a ficha e nao vira aviso', async () => {
    const r = await api.pedir('POST', `/sessoes/${p.sessao}/ocorrencias`, { cookie: c.ana, corpo: ABC })
    expect(r.status).toBe(201)
    expect(r.corpo).toMatchObject({ origem: 'CLINICA', sessaoId: p.sessao, comportamento: 'Saiu da mesa', intensidade: 2 })
    expect(r.corpo.leituraClinicaEm).toEqual(expect.any(String))
    expect(await ultimaDe({ acao: 'CRIACAO', entidade: 'OcorrenciaComportamental' })).toMatchObject({ usuarioId: u.ana, pacienteId: p.miguel, idEntidade: r.corpo.id })
    const naFicha = await api.pedir('GET', `/pacientes/${p.miguel}/ocorrencias`, { cookie: c.ana })
    expect(naFicha.corpo.itens.map((o: { id: string }) => o.id)).toContain(r.corpo.id)
    expect((await api.pedir('GET', '/ocorrencias/avisos-escola', { cookie: c.ana })).corpo.total).toBe(0)
  })
})

describe('a evolucao da sessao (Resolucao CFP 001/2009)', () => {
  it('aberta, a sessao nao tem evolucao', async () => {
    expect((await api.pedir('GET', `/sessoes/${p.sessao}`, { cookie: c.ana })).corpo.evolucao).toBeNull()
  })

  it('encerrar sem evolucao, em branco ou longa demais e recusado, e a sessao continua aberta', async () => {
    for (const corpo of [undefined, { evolucao: '   \n ' }, { evolucao: 42 }, { evolucao: 'x'.repeat(EVOLUCAO_MAXIMO + 1) }]) {
      const r = await api.pedir('POST', `/sessoes/${p.sessao}/encerramento`, { cookie: c.ana, corpo })
      expect(r.status, JSON.stringify(corpo)?.slice(0, 40)).toBe(422)
      expect(r.corpo.campos).toHaveProperty('evolucao')
    }
    expect((await api.pedir('GET', `/sessoes/${p.sessao}`, { cookie: c.ana })).corpo.situacao).toBe('EM_ANDAMENTO')
  })

  it('so quem conduz encerra', async () => {
    expect((await api.pedir('POST', `/sessoes/${p.sessao}/encerramento`, { cookie: c.coord, corpo: { evolucao: 'Outra pessoa.' } })).status).toBe(403)
  })

  it('com a evolucao, encerra e grava o texto como veio; a trilha diz que ela foi escrita, e nao o que diz', async () => {
    const r = await api.pedir('POST', `/sessoes/${p.sessao}/encerramento`, { cookie: c.ana, corpo: { evolucao: EVOLUCAO } })
    expect(r.status).toBe(200)
    expect(r.corpo).toMatchObject({ situacao: 'ENCERRADA', evolucao: EVOLUCAO })
    const registro = await ultimaDe({ acao: 'ALTERACAO', entidade: 'Sessao', idEntidade: p.sessao })
    expect(registro).toMatchObject({ usuarioId: u.ana, pacienteId: p.miguel, detalhe: 'Sessão encerrada com 1 registros e a evolução.' })
    expect(JSON.stringify(await prisma.registroAuditoria.findMany())).not.toContain('MARCA-EVOLUCAO-7')
  })

  it('a equipe e a coordenacao leem no historico; o profissional de fora, nao, e a negativa fica registrada', async () => {
    for (const quem of ['ana', 'coord']) {
      const historico = await api.pedir('GET', `/pacientes/${p.miguel}/sessoes?situacao=ENCERRADA`, { cookie: c[quem] })
      expect(historico.corpo.itens[0].evolucao, quem).toBe(EVOLUCAO)
    }
    expect(await ultimaDe({ usuarioId: u.coord, entidade: 'Sessao', acao: 'LEITURA_AUTORIZADA' })).toMatchObject({ pacienteId: p.miguel })
    expect((await api.pedir('GET', `/pacientes/${p.miguel}/sessoes`, { cookie: c.bruno })).status).toBe(403)
    expect((await api.pedir('GET', `/sessoes/${p.sessao}`, { cookie: c.bruno })).status).toBe(403)
    expect(await ultimaDe({ usuarioId: u.bruno, acao: 'ACESSO_NEGADO' })).toMatchObject({ pacienteId: p.miguel })
  })

  it('regra 3: a familia e a escola nunca recebem a evolucao, nem pelas rotas da clinica, nem pelas suas', async () => {
    for (const quem of ['mae', 'carla']) {
      expect((await api.pedir('GET', `/pacientes/${p.miguel}/sessoes`, { cookie: c[quem] })).status, quem).toBe(403)
      expect((await api.pedir('GET', `/sessoes/${p.sessao}`, { cookie: c[quem] })).status, quem).toBe(403)
    }
    const daFamilia = [
      await api.pedir('GET', '/familia/filhos', { cookie: c.mae }),
      await api.pedir('GET', `/familia/filhos/${p.miguel}/objetivos`, { cookie: c.mae }),
      await api.pedir('GET', `/pacientes/${p.miguel}/consentimentos`, { cookie: c.mae }),
    ]
    const daEscola = [
      await api.pedir('GET', '/escola/alunos', { cookie: c.carla }),
      await api.pedir('GET', `/escola/alunos/${p.miguel}/cartao`, { cookie: c.carla }),
    ]
    for (const r of [...daFamilia, ...daEscola]) {
      expect(r.status).toBe(200)
      expect(JSON.stringify(r.corpo)).not.toContain('MARCA-EVOLUCAO-7')
      expect(JSON.stringify(r.corpo)).not.toContain('evolucao')
    }
  })
})

describe('o banco tambem guarda a regra', () => {
  it('evolucao em sessao aberta, sessao encerrada sem evolucao ou com evolucao em branco: recusadas pelo CHECK', async () => {
    const aberta = (await api.pedir('POST', '/sessoes', { cookie: c.ana, corpo: { pacienteId: p.miguel } })).corpo.id
    const recusa = /sessao_evolucao_so_encerrada/
    await expect(prisma.sessao.update({ where: { id: aberta }, data: { evolucao: 'Antes da hora.' } })).rejects.toThrow(recusa)
    await expect(prisma.sessao.update({ where: { id: aberta }, data: { situacao: 'ENCERRADA' } })).rejects.toThrow(recusa)
    await expect(prisma.sessao.update({ where: { id: aberta }, data: { situacao: 'ENCERRADA', evolucao: '  ' } })).rejects.toThrow(recusa)
    await expect(prisma.sessao.update({ where: { id: aberta }, data: { situacao: 'ENCERRADA', evolucao: 'Escrita.' } })).resolves.toBeTruthy()
  })
})
