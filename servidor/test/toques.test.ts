import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import {
  TOLERANCIA_DO_RELOGIO_MS, TOQUE_ANTES_DO_INICIO, TOQUE_COM_OUTRO_CONTEUDO, TOQUE_NO_FUTURO, TOQUE_SEM_UUID, gerarUuidV7,
} from '@sinctea/compartilhado/dominio/toque'
import type { PrismaClient } from '../src/gerado/client.js'
import { clienteDe, criarBancoMigrado } from './apoio/banco.js'
import { criarUsuario, subirApi, type Api } from './apoio/api.js'

/**
 * Item 22: o toque que vem da fila do aparelho, com o id e o instante dados
 * la. O reenvio e idempotente — o mesmo id com o mesmo conteudo devolve o que
 * ja estava gravado, sem segunda linha nem segunda criacao na trilha —, o
 * instante tem de caber entre o inicio da sessao e agora, com 5 minutos de
 * tolerancia, e a ordem e a de chegada. Sem id nem instante, tudo como antes.
 */

let prisma: PrismaClient
let api: Api
let apagar: () => Promise<void>
const u: Record<string, string> = {}
const c: Record<string, string> = {}
const p: Record<string, string> = {}

const tocar = (cookie: string, sessaoId: string, corpo: Record<string, unknown>) =>
  api.pedir('POST', `/sessoes/${sessaoId}/registros`, { cookie, corpo })
const criacoes = (id: string) => prisma.registroAuditoria.count({ where: { acao: 'CRIACAO', entidade: 'RegistroAtividade', idEntidade: id } })
const toque = (resultado = 'INDEPENDENTE', ocorridoEm = new Date().toISOString(), objetivoId = p.objetivo) =>
  ({ id: gerarUuidV7(), objetivoId, resultado, ocorridoEm })

async function novaSessao(): Promise<{ id: string; inicio: string }> {
  // Cada teste com a sua sessao: a anterior sai encerrada pelo banco.
  await prisma.sessao.updateMany({
    where: { pacienteId: p.miguel, situacao: { in: ['EM_ANDAMENTO', 'PAUSADA'] } },
    data: { situacao: 'ENCERRADA', fim: new Date(), evolucao: 'Registro de teste.' },
  })
  const s = await api.pedir('POST', '/sessoes', { cookie: c.ana, corpo: { pacienteId: p.miguel } })
  expect(s.status, JSON.stringify(s.corpo)).toBe(201)
  return { id: s.corpo.id, inicio: s.corpo.inicio }
}

beforeAll(async () => {
  const banco = await criarBancoMigrado(inject('urlAdministrativa'), 'sinctea_toques')
  apagar = banco.apagar
  prisma = clienteDe(banco.url)
  u.ana = await criarUsuario(prisma, { email: 'ana@teste.example', nome: 'Ana Souza', perfis: ['TERAPEUTA'] })
  u.bruno = await criarUsuario(prisma, { email: 'bruno@teste.example', nome: 'Bruno Lima', perfis: ['TERAPEUTA'] })
  u.coord = await criarUsuario(prisma, { email: 'coord@teste.example', nome: 'Caio Coordenador', perfis: ['COORDENADOR'] })
  api = await subirApi(banco.url)
  for (const nome of ['ana', 'bruno', 'coord']) c[nome] = await api.entrar(`${nome}@teste.example`)

  for (const [chave, nome] of [['miguel', 'Miguel Ficticio'], ['luna', 'Luna Ficticia']] as const) {
    p[chave] = (await api.pedir('POST', '/pacientes', {
      cookie: c.ana, corpo: { nome, dataNascimento: '2019-03-12', nivelSuporte: 2, profissionalResponsavelId: u.ana },
    })).corpo.id
    const plano = await api.pedir('POST', `/pacientes/${p[chave]}/plano`, { cookie: c.ana, corpo: { dataInicio: '2026-10-01', dataRevisao: '2027-04-01' } })
    p[`objetivo${chave === 'luna' ? 'Luna' : ''}`] = (await api.pedir('POST', `/planos/${plano.corpo.id}/objetivos`, {
      cookie: c.ana,
      corpo: { dominio: 'Comunicação', descricaoTecnica: 'Mando com figura.', descricaoAcessivel: 'Pedir o que quer.', criterio: { percentualMinimo: 80, sessoesConsecutivas: 2 } },
    })).corpo.id
  }
  await prisma.equipePaciente.create({ data: { pacienteId: p.miguel, profissionalId: u.bruno } })
}, 120_000)

afterAll(async () => {
  await api?.fechar()
  await prisma?.$disconnect()
  await apagar?.()
})

describe('o toque com o id e o instante do aparelho (item 22)', () => {
  it('sem id nem instante, como antes: o servidor gera os dois, e a trilha ganha a criacao', async () => {
    const s = await novaSessao()
    const r = await tocar(c.ana, s.id, { objetivoId: p.objetivo, resultado: 'INDEPENDENTE' })
    expect(r.status, JSON.stringify(r.corpo)).toBe(201)
    expect(r.corpo).toMatchObject({ ordem: 1, resultado: 'INDEPENDENTE', objetivoId: p.objetivo })
    expect(Math.abs(Date.parse(r.corpo.ocorridoEm) - Date.now())).toBeLessThan(10_000)
    expect(await criacoes(r.corpo.id)).toBe(1)
  })

  it('com id e instante, grava com o id e o instante do aparelho', async () => {
    const s = await novaSessao()
    const t = toque('AJUDA_GESTUAL', new Date(Date.now() - 60_000).toISOString())
    const r = await tocar(c.ana, s.id, t)
    expect(r.status).toBe(201)
    expect(r.corpo).toEqual({ id: t.id, objetivoId: p.objetivo, ordem: 1, resultado: 'AJUDA_GESTUAL', ocorridoEm: t.ocorridoEm })
    expect(await prisma.registroAtividade.findUniqueOrThrow({ where: { id: t.id } })).toMatchObject({ sessaoId: s.id, ordem: 1 })
  })

  it('o reenvio do mesmo toque devolve o registro ja gravado, sem segunda linha nem segunda criacao na trilha', async () => {
    const s = await novaSessao()
    const t = toque()
    const primeiro = await tocar(c.ana, s.id, t)
    const linhasDaTrilha = await prisma.registroAuditoria.count()
    for (let i = 0; i < 3; i++) {
      const de_novo = await tocar(c.ana, s.id, t)
      expect(de_novo.status).toBe(201)
      expect(de_novo.corpo).toEqual(primeiro.corpo)
    }
    expect(await prisma.registroAtividade.count({ where: { sessaoId: s.id } })).toBe(1)
    expect(await criacoes(t.id)).toBe(1)
    expect(await prisma.registroAuditoria.count()).toBe(linhasDaTrilha)
  })

  it('o reenvio vale mesmo depois de a sessao ser pausada: o toque ja tinha sido aceito', async () => {
    const s = await novaSessao()
    const t = toque()
    await tocar(c.ana, s.id, t)
    await api.pedir('POST', `/sessoes/${s.id}/pausa`, { cookie: c.ana })
    expect((await tocar(c.ana, s.id, t)).status).toBe(201)
    // O toque novo, este sim, a sessao pausada recusa.
    expect((await tocar(c.ana, s.id, toque())).status).toBe(409)
  })

  it('o mesmo id com outro conteudo e CONFLITO, e nada muda', async () => {
    const s = await novaSessao()
    const t = toque()
    await tocar(c.ana, s.id, t)
    for (const outro of [
      { ...t, resultado: 'SEM_RESPOSTA' },
      { ...t, ocorridoEm: new Date(Date.parse(t.ocorridoEm) + 1000).toISOString() },
    ]) {
      const r = await tocar(c.ana, s.id, outro)
      expect(r.status).toBe(409)
      expect(r.corpo.mensagem).toBe(TOQUE_COM_OUTRO_CONTEUDO)
    }
    expect(await prisma.registroAtividade.findUniqueOrThrow({ where: { id: t.id } })).toMatchObject({ resultado: 'INDEPENDENTE' })
    expect(await criacoes(t.id)).toBe(1)
  })

  it('dois envios simultaneos do mesmo id: um registro so, as duas respostas iguais, uma criacao', async () => {
    const s = await novaSessao()
    const t = toque()
    const respostas = await Promise.all([tocar(c.ana, s.id, t), tocar(c.ana, s.id, t), tocar(c.ana, s.id, t)])
    expect(respostas.map((r) => r.status)).toEqual([201, 201, 201])
    expect(new Set(respostas.map((r) => JSON.stringify(r.corpo))).size).toBe(1)
    expect(await prisma.registroAtividade.count({ where: { sessaoId: s.id } })).toBe(1)
    expect(await criacoes(t.id)).toBe(1)
  })

  it('o instante nem no futuro nem antes do inicio, com 5 minutos de tolerancia de relogio', async () => {
    const s = await novaSessao()
    const inicio = Date.parse(s.inicio)
    const futuro = await tocar(c.ana, s.id, toque('INDEPENDENTE', new Date(Date.now() + TOLERANCIA_DO_RELOGIO_MS + 60_000).toISOString()))
    expect(futuro.status).toBe(422)
    expect(futuro.corpo.campos).toEqual({ ocorridoEm: TOQUE_NO_FUTURO })
    const antes = await tocar(c.ana, s.id, toque('INDEPENDENTE', new Date(inicio - TOLERANCIA_DO_RELOGIO_MS - 60_000).toISOString()))
    expect(antes.status).toBe(422)
    expect(antes.corpo.campos).toEqual({ ocorridoEm: TOQUE_ANTES_DO_INICIO })
    // Dentro da tolerancia, nas duas pontas: o relogio do aparelho pode estar um pouco fora.
    expect((await tocar(c.ana, s.id, toque('INDEPENDENTE', new Date(inicio - 60_000).toISOString()))).status).toBe(201)
    expect((await tocar(c.ana, s.id, toque('INDEPENDENTE', new Date(Date.now() + 60_000).toISOString()))).status).toBe(201)
    const semUuid = await tocar(c.ana, s.id, { ...toque(), id: 'toque-1' })
    expect(semUuid.corpo.campos).toEqual({ id: TOQUE_SEM_UUID })
    expect(await prisma.registroAtividade.count({ where: { sessaoId: s.id } })).toBe(2)
  })

  it('a ordem e a de chegada, e nao a do instante; em corrida, ninguem repete a ordem', async () => {
    const s = await novaSessao()
    // Enviados em sequencia, com os instantes de tras para a frente.
    const toques = Array.from({ length: 5 }, (_, i) => toque('INDEPENDENTE', new Date(Date.now() - (5 - i) * 1000).toISOString())).reverse()
    for (const t of toques) expect((await tocar(c.ana, s.id, t)).status).toBe(201)
    const gravados = await prisma.registroAtividade.findMany({ where: { sessaoId: s.id }, orderBy: { ordem: 'asc' } })
    expect(gravados.map((g) => g.id)).toEqual(toques.map((t) => t.id))
    expect(gravados.map((g) => g.ordem)).toEqual([1, 2, 3, 4, 5])

    const juntos = await Promise.all(Array.from({ length: 5 }, () => tocar(c.ana, s.id, toque())))
    expect(juntos.map((r) => r.status)).toEqual([201, 201, 201, 201, 201])
    expect(juntos.map((r) => r.corpo.ordem).sort((a: number, b: number) => a - b)).toEqual([6, 7, 8, 9, 10])
  })

  it('as regras de hoje continuam: so quem conduz, so sessao em andamento, so objetivo do plano do paciente', async () => {
    const s = await novaSessao()
    expect((await tocar(c.bruno, s.id, toque())).status).toBe(403)
    expect((await tocar(c.coord, s.id, toque())).status).toBe(403)
    expect((await tocar(c.ana, s.id, toque('INDEPENDENTE', new Date().toISOString(), p.objetivoLuna))).status).toBe(422)
    expect((await tocar(c.ana, s.id, toque('MAIS_OU_MENOS'))).status).toBe(422)
    await api.pedir('POST', `/sessoes/${s.id}/encerramento`, { cookie: c.ana, corpo: { evolucao: 'Registro de teste.' } })
    expect((await tocar(c.ana, s.id, toque())).status).toBe(409)
    expect(await prisma.registroAtividade.count({ where: { sessaoId: s.id } })).toBe(0)
  })
})
