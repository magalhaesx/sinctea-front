import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest'
import { diaCivilEm, inicioDoDia } from '@sinctea/compartilhado/dominio/datas'
import { suficienciaComparacao } from '@sinctea/compartilhado/dominio/regras'
import type { PrismaClient } from '../src/gerado/client.js'
import { clienteDe, criarBancoMigrado } from './apoio/banco.js'
import { cookieDaSessao, criarUsuario, subirApi, type Api, type Resposta } from './apoio/api.js'

/**
 * Item 16: a evolucao por objetivo (tela 8), pela API, num banco que comeca
 * vazio. So a equipe do paciente e a coordenacao leem; uma linha na trilha
 * por abertura. A resposta traz so datas e medidas: nada de texto livre. O
 * dominio se confirma so no plano vigente, com o criterio atingido, e de duas
 * confirmacoes ao mesmo tempo so uma grava.
 */

let prisma: PrismaClient
let api: Api
let apagar: () => Promise<void>
const u: Record<string, string> = {}
const c: Record<string, string> = {}
const p: Record<string, string> = {}

const OBJETIVO = {
  dominio: 'Comunicação', descricaoTecnica: 'Mando com figura em 8 de 10 oportunidades.', descricaoAcessivel: 'Pedir o que quer, apontando.',
  criterio: { percentualMinimo: 80, sessoesConsecutivas: 2 },
}
const ATIVIDADE = {
  titulo: 'Escolher o lanche apontando', descricao: '', passos: ['Mostre duas opções.'], dicas: '', frequenciaSemanal: 3, urlVideo: null,
}
const OBSERVACAO = 'Observação da família que não sai daqui.'
const EVOLUCAO = 'Evolução fictícia da sessão, escrita pela profissional.'
const ABC = { antecedente: 'Antecedente da clínica', comportamento: 'Comportamento da clínica', consequencia: 'Consequência da clínica', intensidade: 4 }
const RELATO = { tipo: 'Relato fictício da escola', intensidade: 3, contexto: 'Recreio' }
const em90dias = () => diaCivilEm(new Date(Date.now() + 90 * 86_400_000))

const evolucao = (cookie: string, objetivoId = p.o1) => api.pedir('GET', `/objetivos/${objetivoId}/evolucao`, { cookie })
const confirmar = (cookie: string, objetivoId = p.o1) => api.pedir('POST', `/objetivos/${objetivoId}/dominio`, { cookie })

/** Faz o pedido e confere que ele deixou exatamente uma linha na trilha; devolve a resposta e a linha. */
async function comUmaLinha(pedido: () => Promise<Resposta>) {
  const antes = (await prisma.registroAuditoria.findMany({ select: { id: true } })).map((x) => x.id)
  const r = await pedido()
  const linhas = await prisma.registroAuditoria.findMany({ where: { id: { notIn: antes } } })
  expect(linhas, JSON.stringify(r.corpo)).toHaveLength(1)
  return { r, linha: linhas[0] }
}

/** Uma sessao do Miguel com estas tentativas; encerrada com a evolucao, se pedido. */
async function sessao(cookie: string, tentativas: Array<[string, string]>, encerrar = true) {
  const s = await api.pedir('POST', '/sessoes', { cookie, corpo: { pacienteId: p.miguel } })
  expect(s.status, JSON.stringify(s.corpo)).toBe(201)
  for (const [objetivoId, resultado] of tentativas) {
    const r = await api.pedir('POST', `/sessoes/${s.corpo.id}/registros`, { cookie, corpo: { objetivoId, resultado } })
    expect(r.status, JSON.stringify(r.corpo)).toBe(201)
  }
  if (encerrar) {
    const r = await api.pedir('POST', `/sessoes/${s.corpo.id}/encerramento`, { cookie, corpo: { evolucao: EVOLUCAO } })
    expect(r.status, JSON.stringify(r.corpo)).toBe(200)
  }
  return s.corpo.id as string
}

async function objetivo(planoId: string) {
  const r = await api.pedir('POST', `/planos/${planoId}/objetivos`, { cookie: c.ana, corpo: OBJETIVO })
  expect(r.status, JSON.stringify(r.corpo)).toBe(201)
  return r.corpo.id as string
}

beforeAll(async () => {
  const banco = await criarBancoMigrado(inject('urlAdministrativa'), 'sinctea_evolucao')
  apagar = banco.apagar
  prisma = clienteDe(banco.url)
  u.ana = await criarUsuario(prisma, { email: 'ana@teste.example', nome: 'Ana Souza', perfis: ['TERAPEUTA'] })
  u.bruno = await criarUsuario(prisma, { email: 'bruno@teste.example', nome: 'Bruno Lima', perfis: ['TERAPEUTA'] })
  u.coord = await criarUsuario(prisma, { email: 'coord@teste.example', nome: 'Caio Coordenador', perfis: ['COORDENADOR'] })
  u.admin = await criarUsuario(prisma, { email: 'admin@teste.example', nome: 'Zélia Administradora', perfis: ['ADMINISTRADOR'] })
  api = await subirApi(banco.url)
  for (const nome of ['ana', 'bruno', 'coord', 'admin']) c[nome] = await api.entrar(`${nome}@teste.example`)

  // Miguel, da equipe da Ana, com plano vigente de dois objetivos.
  p.miguel = (await api.pedir('POST', '/pacientes', {
    cookie: c.ana, corpo: { nome: 'Miguel Ficticio Santana', dataNascimento: '2019-03-12', nivelSuporte: 2, profissionalResponsavelId: u.ana },
  })).corpo.id
  const plano = (await api.pedir('POST', `/pacientes/${p.miguel}/plano`, { cookie: c.ana, corpo: { dataInicio: '2026-10-01', dataRevisao: '2027-04-01' } })).corpo.id
  p.o1 = await objetivo(plano)
  p.o2 = await objetivo(plano)
  await api.pedir('POST', `/planos/${plano}/envio`, { cookie: c.ana })
  expect((await api.pedir('POST', `/planos/${plano}/aprovacao`, { cookie: c.coord })).corpo.status).toBe('VIGENTE')

  // Laura, tambem da Ana, com o plano em rascunho.
  p.laura = (await api.pedir('POST', '/pacientes', {
    cookie: c.ana, corpo: { nome: 'Laura Ficticia Reis', dataNascimento: '2020-06-01', nivelSuporte: 1, profissionalResponsavelId: u.ana },
  })).corpo.id
  const planoLaura = (await api.pedir('POST', `/pacientes/${p.laura}/plano`, { cookie: c.ana, corpo: { dataInicio: '2026-10-01', dataRevisao: '2027-04-01' } })).corpo.id
  p.oRascunho = await objetivo(planoLaura)

  // A mae, responsavel legal, com a senha definida.
  const mae = await api.pedir('POST', `/pacientes/${p.miguel}/responsaveis`, {
    cookie: c.ana, corpo: { nome: 'Patrícia Ficticia', email: 'mae@teste.example', telefone: '(92) 90000-0000', parentesco: 'Mãe', responsavelLegal: true },
  })
  await api.pedir('POST', `/auth/primeiro-acesso/${mae.corpo.primeiroAcesso.token}`, { corpo: { senha: 'senha-da-familia-1' } })
  c.mae = await api.entrar('mae@teste.example', 'senha-da-familia-1')

  // A professora, pelo caminho inteiro, com o escopo de registro.
  const escola = await api.pedir('POST', '/escolas', { cookie: c.mae, corpo: { nome: 'Escola Municipal Vitória-Régia', rede: 'Municipal', municipio: 'Manaus' } })
  const consentimento = await api.pedir('POST', '/consentimentos', {
    cookie: c.mae, corpo: { pacienteId: p.miguel, escolaId: escola.corpo.id, escopos: ['CARTAO_ESTRATEGIA', 'REGISTRO_OCORRENCIA'], validadeAte: em90dias() },
  })
  const carla = await api.pedir('POST', `/convites/${consentimento.corpo.tokenConvite}/aceite`, {
    corpo: { nome: 'Carla Professora', email: 'carla@escola.example', senha: 'senha-da-carla', turma: '2º ano A', turno: 'Matutino', atuacao: 'Regente' },
  })
  expect(carla.status, JSON.stringify(carla.corpo)).toBe(200)
  c.carla = cookieDaSessao(carla)

  // Clinica: S1 com o objetivo (50%) e uma ocorrencia da clinica; S2 so com
  // o outro; S3 com o objetivo (100%); S4 com o objetivo, em andamento.
  const s1 = await sessao(c.ana, [[p.o1, 'INDEPENDENTE'], [p.o1, 'AJUDA_FISICA']], false)
  expect((await api.pedir('POST', `/sessoes/${s1}/ocorrencias`, { cookie: c.ana, corpo: ABC })).status).toBe(201)
  expect((await api.pedir('POST', `/sessoes/${s1}/encerramento`, { cookie: c.ana, corpo: { evolucao: EVOLUCAO } })).status).toBe(200)
  p.s1 = s1
  p.s2 = await sessao(c.ana, [[p.o2, 'INDEPENDENTE']])
  p.s3 = await sessao(c.ana, [[p.o1, 'INDEPENDENTE']])
  p.s4 = await sessao(c.ana, [[p.o1, 'INDEPENDENTE']], false)

  // Casa: duas atividades do objetivo (uma encerrada depois) e uma do outro.
  const prescrever = async (objetivoId: string, titulo: string) => {
    const r = await api.pedir('POST', '/atividades', { cookie: c.ana, corpo: { pacienteId: p.miguel, objetivoId, ...ATIVIDADE, titulo } })
    expect(r.status, JSON.stringify(r.corpo)).toBe(201)
    return r.corpo.id as string
  }
  p.a1 = await prescrever(p.o1, 'Escolher o lanche apontando')
  p.a2 = await prescrever(p.o1, 'Pedir ajuda para abrir a embalagem')
  p.a3 = await prescrever(p.o2, 'Avisar quando o barulho incomoda')
  for (const [atividade, desempenho] of [[p.a1, 'SOZINHO'], [p.a2, 'NAO_QUIS'], [p.a3, 'COM_AJUDA']]) {
    const r = await api.pedir('POST', `/atividades/${atividade}/execucoes`, { cookie: c.mae, corpo: { desempenho, observacao: OBSERVACAO } })
    expect(r.status, JSON.stringify(r.corpo)).toBe(201)
  }
  expect((await api.pedir('POST', `/atividades/${p.a2}/encerramento`, { cookie: c.ana })).status).toBe(200)

  // Escola: um relato da professora.
  const relato = await api.pedir('POST', `/escola/alunos/${p.miguel}/ocorrencias`, { cookie: c.carla, corpo: RELATO })
  expect(relato.status, JSON.stringify(relato.corpo)).toBe(201)
})

afterAll(async () => {
  vi.useRealTimers()
  await api?.fechar()
  await prisma?.$disconnect()
  await apagar?.()
})

describe('a equipe e a coordenacao leem a evolucao do objetivo', () => {
  it('as series certas, e uma linha LEITURA_AUTORIZADA na trilha, com o objetivo e o paciente', async () => {
    const { r, linha } = await comUmaLinha(() => evolucao(c.ana))
    expect(r.status, JSON.stringify(r.corpo)).toBe(200)
    // Clinica: so as encerradas com o objetivo, em ordem de numero. S2 (sem o objetivo) e S4 (em andamento) ficam fora.
    expect(r.corpo.clinica.map((s: { sessaoId: string; percentual: number }) => [s.sessaoId, s.percentual])).toEqual([[p.s1, 50], [p.s3, 100]])
    expect(r.corpo.clinica[0].numero).toBeLessThan(r.corpo.clinica[1].numero)
    // Casa: as duas atividades do objetivo, a encerrada inclusive; a do outro objetivo fica fora.
    expect(r.corpo.casa.map((e: { desempenho: string }) => e.desempenho).sort()).toEqual(['NAO_QUIS', 'SOZINHO'])
    expect(r.corpo.casa.every((e: { data: string }) => e.data === diaCivilEm(new Date()))).toBe(true)
    // Escola: so a origem ESCOLA; a ocorrencia da clinica fica fora.
    expect(r.corpo.escola.map((o: { intensidade: number }) => o.intensidade)).toEqual([3])
    expect(r.corpo.atingiuCriterio).toBe(false)
    expect(linha).toMatchObject({
      acao: 'LEITURA_AUTORIZADA', entidade: 'Objetivo', idEntidade: p.o1, pacienteId: p.miguel, usuarioId: u.ana,
      detalhe: 'Evolução do objetivo.',
    })

    const daCoordenacao = await comUmaLinha(() => evolucao(c.coord))
    expect(daCoordenacao.r.status).toBe(200)
    expect(daCoordenacao.r.corpo).toEqual(r.corpo)
    expect(daCoordenacao.linha).toMatchObject({ acao: 'LEITURA_AUTORIZADA', idEntidade: p.o1, pacienteId: p.miguel, usuarioId: u.coord })
  })

  it('nada de texto livre: nem a observacao da familia, nem o relato da escola, nem a ocorrencia ou a evolucao da sessao', async () => {
    const r = await evolucao(c.ana)
    const texto = JSON.stringify(r.corpo)
    for (const livre of [OBSERVACAO, RELATO.tipo, RELATO.contexto, EVOLUCAO, ABC.antecedente, ABC.comportamento, ABC.consequencia, OBJETIVO.descricaoTecnica]) {
      expect(texto, livre).not.toContain(livre)
    }
    expect(Object.keys(r.corpo).sort()).toEqual(['atingiuCriterio', 'casa', 'clinica', 'escola'])
    expect(Object.keys(r.corpo.clinica[0]).sort()).toEqual(['data', 'numero', 'percentual', 'sessaoId'])
    expect(Object.keys(r.corpo.casa[0]).sort()).toEqual(['data', 'desempenho'])
    expect(Object.keys(r.corpo.escola[0]).sort()).toEqual(['data', 'intensidade'])
  })

  it('id que nao existe ou nao e uuid: 404', async () => {
    for (const id of ['nao-e-uuid', '00000000-0000-7000-8000-000000000000']) expect((await evolucao(c.ana, id)).status).toBe(404)
  })
})

describe('quem nao e da equipe nem da coordenacao e negado, e a negativa fica na trilha', () => {
  it('profissional fora da equipe, professor, responsavel e administrador', async () => {
    for (const quem of ['bruno', 'carla', 'mae', 'admin']) {
      const { r, linha } = await comUmaLinha(() => evolucao(c[quem]))
      expect(r.status, quem).toBe(403)
      expect(r.corpo.codigo, quem).toBe('ACESSO_NEGADO')
      expect(linha, quem).toMatchObject({ acao: 'ACESSO_NEGADO' })
      expect(JSON.stringify(r.corpo), quem).not.toContain('percentual')
    }
    // O profissional fora da equipe passa pela marca da rota e e negado pelo alcance: a negativa leva o paciente.
    const { linha } = await comUmaLinha(() => evolucao(c.bruno))
    expect(linha).toMatchObject({ acao: 'ACESSO_NEGADO', pacienteId: p.miguel, usuarioId: u.bruno })
  })
})

describe('confirmar o dominio', () => {
  it('com o criterio nao atingido, e recusado e nada se grava', async () => {
    const r = await confirmar(c.ana)
    expect(r.status).toBe(409)
    expect(r.corpo.mensagem).toBe('O critério ainda não foi atingido: 80% em 2 sessões consecutivas.')
    expect((await prisma.objetivo.findUniqueOrThrow({ where: { id: p.o1 } })).status).not.toBe('DOMINADO')
  })

  it('fora do plano vigente, e recusado com as palavras da tela', async () => {
    const r = await confirmar(c.ana, p.oRascunho)
    expect(r.status).toBe(409)
    expect(r.corpo.mensagem).toBe('O domínio se confirma no plano vigente.')
    expect((await prisma.objetivo.findUniqueOrThrow({ where: { id: p.oRascunho } })).status).not.toBe('DOMINADO')
  })

  it('quatro confirmacoes ao mesmo tempo: uma grava, as outras ouvem que ja esta dominado, e uma linha so na trilha', async () => {
    p.s5 = await sessao(c.ana, [[p.o1, 'INDEPENDENTE']])
    expect((await evolucao(c.ana)).corpo.atingiuCriterio).toBe(true)
    const respostas = await Promise.all([c.ana, c.coord, c.ana, c.coord].map((cookie) => confirmar(cookie)))
    expect(respostas.map((x) => x.status).sort()).toEqual([200, 409, 409, 409])
    for (const x of respostas.filter((y) => y.status === 409)) expect(x.corpo.mensagem).toBe('Este objetivo já está marcado como dominado.')
    expect(respostas.find((x) => x.status === 200)!.corpo).toMatchObject({ id: p.o1, status: 'DOMINADO' })
    expect(await prisma.registroAuditoria.count({ where: { entidade: 'Objetivo', idEntidade: p.o1, acao: 'ALTERACAO', detalhe: 'Domínio confirmado.' } })).toBe(1)
    // E depois, de novo, um a um.
    expect((await confirmar(c.ana)).corpo.mensagem).toBe('Este objetivo já está marcado como dominado.')
  })
})

describe('a semana em Manaus (item 16)', () => {
  it('com o relogio fixo no domingo as 22h: o relato e a sessao ficam na semana daquele domingo', async () => {
    // O proximo domingo, 22h em Manaus (em UTC, ja segunda), e a segunda seguinte, 10h.
    const hoje = diaCivilEm(new Date())
    const [ano, mes, dia] = hoje.split('-').map(Number)
    const diaDaSemana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()
    const domingo = new Date(Date.UTC(ano, mes - 1, dia + (7 - diaDaSemana))).toISOString().slice(0, 10)
    const domingoAs22 = new Date(inicioDoDia(domingo).getTime() + 22 * 3_600_000)
    const segundaAs10 = new Date(domingoAs22.getTime() + 12 * 3_600_000)
    expect(domingoAs22.getUTCDay()).toBe(1)

    // So o Date do processo, que e o mesmo da API. As contas entram de novo sob o relogio fixo:
    // a sessao de login vence 24 horas depois do ultimo uso.
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      for (const instante of [domingoAs22, segundaAs10]) {
        vi.setSystemTime(instante)
        const ana = await api.entrar('ana@teste.example')
        const carla = await api.entrar('carla@escola.example', 'senha-da-carla')
        expect((await api.pedir('POST', `/escola/alunos/${p.miguel}/ocorrencias`, { cookie: carla, corpo: RELATO })).status).toBe(201)
        await sessao(ana, [[p.o2, 'INDEPENDENTE']])
      }
    } finally {
      vi.useRealTimers()
    }

    const r = await evolucao(await api.entrar('ana@teste.example'), p.o2)
    expect(r.status, JSON.stringify(r.corpo)).toBe(200)
    const instantes = [domingoAs22.toISOString(), segundaAs10.toISOString()]
    const escola = r.corpo.escola.map((o: { data: string }) => o.data).filter((d: string) => instantes.includes(d))
    const clinica = r.corpo.clinica.map((s: { data: string }) => s.data).filter((d: string) => instantes.includes(d))
    expect(escola).toEqual(instantes)
    expect(clinica).toEqual(instantes)
    // Duas semanas em Manaus (domingo e segunda); em UTC, seria uma so.
    const faltas = suficienciaComparacao({ CLINICA: clinica, CASA: [], ESCOLA: escola }).faltas
    expect(faltas.find((f) => f.contexto === 'ESCOLA')?.semanasFaltando).toBe(1)
    expect(faltas.find((f) => f.contexto === 'CLINICA')?.semanasFaltando).toBe(1)
  })
})
