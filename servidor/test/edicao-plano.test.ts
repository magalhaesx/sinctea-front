import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { jsonCanonico } from '@sinctea/compartilhado/dominio/hash'
import type { PrismaClient } from '../src/gerado/client.js'
import { clienteDe, criarBancoMigrado } from './apoio/banco.js'
import { criarUsuario, subirApi, type Api } from './apoio/api.js'

/**
 * Item 7, parte 2: editar objetivo (as duas redacoes e o criterio) e as datas
 * do plano, so em RASCUNHO ou DEVOLVIDO. A edicao e ALTERACAO na trilha, com o
 * valor anterior so dos campos que mudaram (revisao do modelo de 11/10); sem
 * mudanca, nada se escreve e nada se registra.
 */

let prisma: PrismaClient
let api: Api
let apagar: () => Promise<void>
const u: Record<string, string> = {}
const c: Record<string, string> = {}
const p: Record<string, string> = {}

const OBJETIVO = {
  dominio: 'Comunicação', descricaoTecnica: 'Mando com figura em 8 de 10.', descricaoAcessivel: 'Pedir o que quer.',
  criterio: { percentualMinimo: 80, sessoesConsecutivas: 2 },
}
const edicao = (mudanca: Partial<{ descricaoTecnica: string; descricaoAcessivel: string; percentualMinimo: number; sessoesConsecutivas: number }> = {}) => ({
  descricaoTecnica: mudanca.descricaoTecnica ?? OBJETIVO.descricaoTecnica,
  descricaoAcessivel: mudanca.descricaoAcessivel ?? OBJETIVO.descricaoAcessivel,
  criterio: {
    percentualMinimo: mudanca.percentualMinimo ?? OBJETIVO.criterio.percentualMinimo,
    sessoesConsecutivas: mudanca.sessoesConsecutivas ?? OBJETIVO.criterio.sessoesConsecutivas,
  },
})
const editarObjetivo = (cookie: string, corpo: unknown) => api.pedir('PUT', `/objetivos/${p.objetivo}`, { cookie, corpo })
const editarDatas = (cookie: string, corpo: unknown) => api.pedir('PUT', `/planos/${p.plano}/datas`, { cookie, corpo })
const alteracoes = (idEntidade: string) => prisma.registroAuditoria.findMany({ where: { idEntidade, acao: 'ALTERACAO' }, orderBy: { ocorridoEm: 'asc' } })

beforeAll(async () => {
  const banco = await criarBancoMigrado(inject('urlAdministrativa'), 'sinctea_edicao')
  apagar = banco.apagar
  prisma = clienteDe(banco.url)
  u.ana = await criarUsuario(prisma, { email: 'ana@teste.example', nome: 'Ana Souza', perfis: ['TERAPEUTA'] })
  u.bruno = await criarUsuario(prisma, { email: 'bruno@teste.example', nome: 'Bruno Lima', perfis: ['TERAPEUTA'] })
  u.coord = await criarUsuario(prisma, { email: 'coord@teste.example', nome: 'Caio Coordenador', perfis: ['COORDENADOR'] })
  u.resp = await criarUsuario(prisma, { email: 'resp@teste.example', perfis: ['RESPONSAVEL'], tipo: 'RESPONSAVEL' })
  api = await subirApi(banco.url)
  for (const nome of ['ana', 'bruno', 'coord', 'resp']) c[nome] = await api.entrar(`${nome}@teste.example`)
  p.paciente = (await api.pedir('POST', '/pacientes', {
    cookie: c.ana, corpo: { nome: 'Miguel Ficticio', dataNascimento: '2019-03-12', nivelSuporte: 2, profissionalResponsavelId: u.ana },
  })).corpo.id
  p.plano = (await api.pedir('POST', `/pacientes/${p.paciente}/plano`, { cookie: c.ana, corpo: { dataInicio: '2026-10-01', dataRevisao: '2027-04-01' } })).corpo.id
  p.objetivo = (await api.pedir('POST', `/planos/${p.plano}/objetivos`, { cookie: c.ana, corpo: OBJETIVO })).corpo.id
})

afterAll(async () => {
  await api?.fechar()
  await prisma?.$disconnect()
  await apagar?.()
})

describe('editar objetivo em rascunho', () => {
  it('so a redacao acessivel muda: a trilha guarda so ela, na versao anterior, com o paciente', async () => {
    const r = await editarObjetivo(c.ana, edicao({ descricaoAcessivel: 'Pedir o que quer, apontando ou falando.' }))
    expect(r.status, JSON.stringify(r.corpo)).toBe(200)
    expect(r.corpo).toMatchObject({ descricaoAcessivel: 'Pedir o que quer, apontando ou falando.', descricaoTecnica: OBJETIVO.descricaoTecnica, dominio: 'Comunicação' })
    const [registro] = await alteracoes(p.objetivo)
    expect(registro).toMatchObject({
      entidade: 'Objetivo', usuarioId: u.ana, pacienteId: p.paciente,
      valorAnterior: jsonCanonico({ descricaoAcessivel: 'Pedir o que quer.' }),
    })
  })

  it('o criterio muda: a trilha guarda so o percentual, e nao o registro inteiro', async () => {
    await editarObjetivo(c.ana, edicao({ descricaoAcessivel: 'Pedir o que quer, apontando ou falando.', percentualMinimo: 90 }))
    const registros = await alteracoes(p.objetivo)
    expect(registros.at(-1)!.valorAnterior).toBe(jsonCanonico({ percentualMinimo: 80 }))
    const plano = await api.pedir('GET', `/pacientes/${p.paciente}/plano`, { cookie: c.ana })
    expect(plano.corpo.objetivos[0].criterio).toEqual({ percentualMinimo: 90, sessoesConsecutivas: 2 })
  })

  it('sem mudanca, nada se escreve e nada entra na trilha', async () => {
    const antes = (await alteracoes(p.objetivo)).length
    expect((await editarObjetivo(c.ana, edicao({ descricaoAcessivel: 'Pedir o que quer, apontando ou falando.', percentualMinimo: 90 }))).status).toBe(200)
    expect((await alteracoes(p.objetivo)).length).toBe(antes)
  })

  it('regra 4: a redacao acessivel continua obrigatoria; criterio fora da faixa tambem e recusado', async () => {
    expect((await editarObjetivo(c.ana, edicao({ descricaoAcessivel: '   ' }))).corpo.campos).toHaveProperty('descricaoAcessivel')
    expect((await editarObjetivo(c.ana, edicao({ percentualMinimo: 0 }))).status).toBe(422)
  })

  it('de fora da equipe, negado e registrado com o paciente; a familia nem chega a rota', async () => {
    expect((await editarObjetivo(c.bruno, edicao({ descricaoTecnica: 'Outra.' }))).status).toBe(403)
    expect((await prisma.registroAuditoria.findMany({ where: { usuarioId: u.bruno, acao: 'ACESSO_NEGADO' } })).at(-1))
      .toMatchObject({ pacienteId: p.paciente })
    expect((await editarObjetivo(c.resp, edicao({ descricaoTecnica: 'Outra.' }))).status).toBe(403)
  })
})

describe('editar as datas do plano', () => {
  it('so a revisao muda: a trilha guarda so a data anterior dela', async () => {
    const r = await editarDatas(c.ana, { dataInicio: '2026-10-01', dataRevisao: '2027-05-01' })
    expect(r.status).toBe(200)
    expect(r.corpo).toMatchObject({ dataInicio: '2026-10-01', dataRevisao: '2027-05-01' })
    expect((await alteracoes(p.plano)).at(-1)).toMatchObject({
      entidade: 'PlanoTerapeutico', pacienteId: p.paciente, valorAnterior: jsonCanonico({ dataRevisao: '2027-04-01' }),
    })
  })

  it('revisao antes do inicio e recusada', async () => {
    expect((await editarDatas(c.ana, { dataInicio: '2026-10-01', dataRevisao: '2026-09-01' })).status).toBe(422)
  })
})

describe('so em rascunho ou devolvido', () => {
  it('em validacao, nada se edita; devolvido, volta a editar; vigente, nunca mais', async () => {
    await api.pedir('POST', `/planos/${p.plano}/envio`, { cookie: c.ana })
    expect((await editarObjetivo(c.ana, edicao({ descricaoTecnica: 'Na fila.' }))).status).toBe(409)
    expect((await editarDatas(c.ana, { dataInicio: '2026-10-02', dataRevisao: '2027-05-01' })).status).toBe(409)

    await api.pedir('POST', `/planos/${p.plano}/devolucao`, { cookie: c.coord, corpo: { observacao: 'Detalhar o critério.' } })
    expect((await editarObjetivo(c.ana, edicao({ descricaoTecnica: 'Corrigida depois da devolução.', percentualMinimo: 90 }))).status).toBe(200)

    await api.pedir('POST', `/planos/${p.plano}/envio`, { cookie: c.ana })
    // Item 7, parte 4: quem escreveu aparece pelo nome e pela especialidade.
    const fila = await api.pedir('GET', '/planos/aguardando-validacao', { cookie: c.coord })
    expect(fila.corpo.itens[0].autor).toEqual({ id: u.ana, nome: 'Ana Souza', especialidade: 'Fonoaudiologia' })
    const lista = await api.pedir('GET', '/pacientes', { cookie: c.ana })
    expect(lista.corpo.itens[0].profissionalResponsavel).toEqual({ id: u.ana, nome: 'Ana Souza', especialidade: 'Fonoaudiologia' })
    expect((await api.pedir('POST', `/planos/${p.plano}/aprovacao`, { cookie: c.coord })).corpo.status).toBe('VIGENTE')
    const vigente = await editarObjetivo(c.ana, edicao({ descricaoTecnica: 'Depois de vigente.' }))
    expect(vigente.status).toBe(409)
    expect((await editarDatas(c.ana, { dataInicio: '2026-10-02', dataRevisao: '2027-05-01' })).status).toBe(409)
    const plano = await api.pedir('GET', `/pacientes/${p.paciente}/plano`, { cookie: c.ana })
    expect(plano.corpo.objetivos[0].descricaoTecnica).toBe('Corrigida depois da devolução.')
  })
})
