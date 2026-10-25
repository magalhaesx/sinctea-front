import { createHash } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { diaCivilEm } from '@sinctea/compartilhado/dominio/datas'
import type { PrismaClient } from '../src/gerado/client.js'
import { clienteDe, criarBancoMigrado } from './apoio/banco.js'
import { cookieDaSessao, criarUsuario, subirApi, type Api } from './apoio/api.js'

/**
 * Item 4 do caminho principal (docs/07, secao 0): familia, escolas,
 * consentimento, convite e area da escola, pela API, num banco que comeca
 * vazio. Portado de src/servicos/mock/regrasInviolaveis.test.ts:
 * regra 1 (so o responsavel legal concede; qualquer vinculado encerra; convite
 * de uso unico e 72 horas), regra 2 (consentimento vigente e escopo a cada
 * leitura), regra 3 (so o cartao projetado), regra 5 (a revogacao corta a
 * leitura seguinte) e regra 6 (leitura, concessao, revogacao e negativa na trilha).
 */

let prisma: PrismaClient
let api: Api
let apagar: () => Promise<void>
const u: Record<string, string> = {}
const c: Record<string, string> = {}
const p: Record<string, string> = {}
const sha256 = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex')
const TECNICA = 'Emitir mando por item preferido em 8 de 10 tentativas, com ajuda gestual.'
const ACESSIVEL = 'Pedir o que quer, apontando ou falando.'
const em90dias = () => diaCivilEm(new Date(Date.now() + 90 * 86_400_000))

const ultimaDe = async (where: Record<string, unknown>) =>
  (await prisma.registroAuditoria.findMany({ where, orderBy: { ocorridoEm: 'asc' } })).at(-1)

/** Cadastra o responsavel pela ficha e define a senha pelo link, como no site. */
async function responsavel(pacienteId: string, nome: string, email: string, legal: boolean, senha: string): Promise<string> {
  const r = await api.pedir('POST', `/pacientes/${pacienteId}/responsaveis`, {
    cookie: c.ana, corpo: { nome, email, telefone: '(92) 90000-0000', parentesco: legal ? 'Mãe' : 'Pai', responsavelLegal: legal },
  })
  expect(r.status, JSON.stringify(r.corpo)).toBe(201)
  if (r.corpo.primeiroAcesso) {
    expect((await api.pedir('POST', `/auth/primeiro-acesso/${r.corpo.primeiroAcesso.token}`, { corpo: { senha } })).status).toBe(200)
  }
  return r.corpo.responsavel.responsavelId
}

async function paciente(nome: string): Promise<string> {
  const r = await api.pedir('POST', '/pacientes', { cookie: c.ana, corpo: { nome, dataNascimento: '2019-03-12', nivelSuporte: 2, profissionalResponsavelId: u.ana } })
  return r.corpo.id
}

/** Plano aprovado pela coordenacao, com um objetivo e um cartao. */
async function planoVigente(pacienteId: string): Promise<void> {
  const plano = await api.pedir('POST', `/pacientes/${pacienteId}/plano`, { cookie: c.ana, corpo: { dataInicio: '2026-10-01', dataRevisao: '2027-04-01' } })
  const objetivo = await api.pedir('POST', `/planos/${plano.corpo.id}/objetivos`, {
    cookie: c.ana,
    corpo: { dominio: 'Comunicação', descricaoTecnica: TECNICA, descricaoAcessivel: ACESSIVEL, criterio: { percentualMinimo: 80, sessoesConsecutivas: 2 } },
  })
  await api.pedir('POST', `/objetivos/${objetivo.corpo.id}/cartoes`, {
    cookie: c.ana, corpo: { tituloSimples: 'Pedir ajuda', oQueFazer: ['Mostrar a figura'], oQueEvitar: ['Falar alto'], sinalAlerta: 'Tapa os ouvidos.' },
  })
  await api.pedir('POST', `/planos/${plano.corpo.id}/envio`, { cookie: c.ana })
  expect((await api.pedir('POST', `/planos/${plano.corpo.id}/aprovacao`, { cookie: c.coord })).corpo.status).toBe('VIGENTE')
}

beforeAll(async () => {
  const banco = await criarBancoMigrado(inject('urlAdministrativa'), 'sinctea_escola')
  apagar = banco.apagar
  prisma = clienteDe(banco.url)
  u.ana = await criarUsuario(prisma, { email: 'ana@teste.example', nome: 'Ana Terapeuta', perfis: ['TERAPEUTA'] })
  u.coord = await criarUsuario(prisma, { email: 'coord@teste.example', nome: 'Caio Coordenador', perfis: ['COORDENADOR'] })
  api = await subirApi(banco.url)
  c.ana = await api.entrar('ana@teste.example')
  c.coord = await api.entrar('coord@teste.example')

  p.miguel = await paciente('Miguel Ficticio Santana')
  p.sofia = await paciente('Sofia Ficticia Santana')
  p.davi = await paciente('Davi Ficticio Farias')
  await planoVigente(p.miguel)
  await planoVigente(p.sofia)

  u.mae = await responsavel(p.miguel, 'Patrícia Ficticia', 'mae@teste.example', true, 'senha-da-mae-1')
  u.pai = await responsavel(p.miguel, 'Gustavo Ficticio', 'pai@teste.example', false, 'senha-do-pai-1')
  await responsavel(p.sofia, 'Patrícia Ficticia', 'mae@teste.example', true, 'nao-usada')
  u.outra = await responsavel(p.davi, 'Rosa Ficticia', 'rosa@teste.example', true, 'senha-da-rosa')
  c.mae = await api.entrar('mae@teste.example', 'senha-da-mae-1')
  c.pai = await api.entrar('pai@teste.example', 'senha-do-pai-1')
  c.rosa = await api.entrar('rosa@teste.example', 'senha-da-rosa')
})

afterAll(async () => {
  await api?.fechar()
  await prisma?.$disconnect()
  await apagar?.()
})

describe('area da familia', () => {
  it('cada responsavel ve os proprios filhos, com o parentesco e a autoridade legal da relacao', async () => {
    const daMae = await api.pedir('GET', '/familia/filhos', { cookie: c.mae })
    expect(daMae.corpo.itens.map((f: { nome: string; responsavelLegal: boolean }) => [f.nome, f.responsavelLegal]))
      .toEqual([['Miguel Ficticio Santana', true], ['Sofia Ficticia Santana', true]])
    const doPai = await api.pedir('GET', '/familia/filhos', { cookie: c.pai })
    expect(doPai.corpo.itens).toEqual([expect.objectContaining({ id: p.miguel, parentesco: 'Pai', responsavelLegal: false })])
  })

  it('os objetivos chegam so na redacao acessivel; de outro filho, a negativa e registrada', async () => {
    const r = await api.pedir('GET', `/familia/filhos/${p.miguel}/objetivos`, { cookie: c.mae })
    expect(r.corpo.itens).toEqual([expect.objectContaining({ descricaoAcessivel: ACESSIVEL })])
    expect(JSON.stringify(r.corpo)).not.toContain(TECNICA)
    expect((await api.pedir('GET', `/familia/filhos/${p.miguel}/objetivos`, { cookie: c.rosa })).status).toBe(403)
    expect(await ultimaDe({ acao: 'ACESSO_NEGADO', usuarioId: u.outra })).toMatchObject({ pacienteId: p.miguel })
  })
})

describe('escola cadastrada pela familia (lacuna 4)', () => {
  it('a familia cadastra; a parecida do mesmo municipio aparece antes; a repetida e recusada; a clinica nao cadastra', async () => {
    const r = await api.pedir('POST', '/escolas', { cookie: c.mae, corpo: { nome: ' Escola Municipal  Vitória-Régia ', rede: 'municipal', municipio: 'Manaus' } })
    expect(r.status).toBe(201)
    expect(r.corpo).toMatchObject({ nome: 'Escola Municipal Vitória-Régia', rede: 'Municipal', municipio: 'Manaus' })
    p.escola = r.corpo.id
    expect(await ultimaDe({ acao: 'CRIACAO', entidade: 'Escola' })).toMatchObject({ usuarioId: u.mae, idEntidade: p.escola })

    const parecidas = await api.pedir('GET', '/escolas/parecidas?nome=EM%20Vitoria%20Regia&municipio=manaus', { cookie: c.mae })
    expect(parecidas.corpo.map((e: { id: string }) => e.id)).toEqual([p.escola])
    const deOutraCidade = await api.pedir('GET', '/escolas/parecidas?nome=EM%20Vitoria%20Regia&municipio=Parintins', { cookie: c.mae })
    expect(deOutraCidade.corpo).toEqual([])
    expect((await api.pedir('POST', '/escolas', { cookie: c.mae, corpo: { nome: 'escola municipal vitoria-regia', rede: 'Municipal', municipio: 'MANAUS' } })).status).toBe(409)
    expect((await api.pedir('POST', '/escolas', { cookie: c.ana, corpo: { nome: 'Outra', rede: 'Municipal', municipio: 'Manaus' } })).status).toBe(403)
    expect((await api.pedir('POST', '/escolas', { cookie: c.mae, corpo: { nome: 'Outra', rede: 'nenhuma', municipio: '' } })).status).toBe(422)
  })
})

describe('regra 1: quem autoriza e o responsavel legal; qualquer vinculado encerra', () => {
  const conceder = (cookie: string, pacienteId: string, escopos: string[]) =>
    api.pedir('POST', '/consentimentos', { cookie, corpo: { pacienteId, escolaId: p.escola, escopos, validadeAte: em90dias() } })

  it('responsavel nao legal tenta conceder: recusado, e a tentativa fica na trilha com o paciente', async () => {
    const r = await conceder(c.pai, p.miguel, ['CARTAO_ESTRATEGIA'])
    expect(r.status).toBe(403)
    expect(r.corpo.mensagem).toBe('Somente o responsável legal pode autorizar o acesso da escola.')
    expect(await ultimaDe({ acao: 'ACESSO_NEGADO', usuarioId: u.pai })).toMatchObject({
      pacienteId: p.miguel, entidade: 'Consentimento', detalhe: 'Responsável sem responsabilidade legal pelo paciente.',
    })
    expect((await conceder(c.ana, p.miguel, ['CARTAO_ESTRATEGIA'])).status).toBe(403)
    expect(await prisma.consentimento.count()).toBe(0)
  })

  it('o legal concede: termo com resumo, convite de 72 horas, e o banco so com o resumo do token', async () => {
    const r = await conceder(c.mae, p.miguel, ['CARTAO_ESTRATEGIA', 'CARTAO_ESTRATEGIA'])
    expect(r.status).toBe(201)
    expect(r.corpo.consentimento).toMatchObject({ situacao: 'VIGENTE', escopos: ['CARTAO_ESTRATEGIA'], escola: 'Escola Municipal Vitória-Régia', conviteAceito: false })
    expect(r.corpo.consentimento.hashTermo).toMatch(/^sha256:\d{4}-\d{2}:[0-9a-f]{64}$/)
    p.consMiguel = r.corpo.consentimento.id
    p.tokenMiguel = r.corpo.tokenConvite
    const convite = await prisma.conviteEscolar.findFirstOrThrow({ where: { consentimentoId: p.consMiguel } })
    expect(convite.tokenResumo).toBe(sha256(p.tokenMiguel))
    expect(convite.expiraEm.getTime() - convite.criadoEm.getTime()).toBe(72 * 3_600_000)
    expect(await ultimaDe({ acao: 'CONCESSAO_ACESSO', entidade: 'Consentimento' })).toMatchObject({
      usuarioId: u.mae, pacienteId: p.miguel, detalhe: 'Escola: Escola Municipal Vitória-Régia · escopos: CARTAO_ESTRATEGIA',
    })
  })

  it('reemitir o convite tambem amplia o acesso: o nao legal e recusado; o legal derruba o anterior', async () => {
    expect((await api.pedir('POST', `/consentimentos/${p.consMiguel}/convites`, { cookie: c.pai })).status).toBe(403)
    const r = await api.pedir('POST', `/consentimentos/${p.consMiguel}/convites`, { cookie: c.mae })
    expect(r.status).toBe(201)
    expect((await api.pedir('GET', `/convites/${p.tokenMiguel}`)).corpo.situacao).toBe('EXPIRADO')
    p.tokenMiguel = r.corpo.tokenConvite
    expect((await api.pedir('GET', `/convites/${p.tokenMiguel}`)).corpo.situacao).toBe('VALIDO')
    const novo = await prisma.conviteEscolar.findUniqueOrThrow({ where: { tokenResumo: sha256(p.tokenMiguel) } })
    expect(novo.expiraEm.getTime() - novo.criadoEm.getTime()).toBe(72 * 3_600_000)
  })
})

describe('convite: uso unico, 72 horas, e o professor com mais de um aluno', () => {
  const ACEITE = { nome: 'Carla Professora', email: ' Carla@Escola.EXAMPLE ', senha: 'senha-da-carla', turma: '2º ano A', turno: 'Matutino', atuacao: 'Regente' }

  it('o convite valido mostra so o primeiro nome do aluno, e a consulta fica na trilha', async () => {
    const r = await api.pedir('GET', `/convites/${p.tokenMiguel}`)
    expect(r.corpo).toMatchObject({ situacao: 'VALIDO', aluno: 'Miguel', escola: 'Escola Municipal Vitória-Régia', responsavel: 'Patrícia Ficticia' })
    expect(JSON.stringify(r.corpo)).not.toContain('Santana')
    expect(await ultimaDe({ entidade: 'ConviteEscolar', acao: 'LEITURA_AUTORIZADA' })).toMatchObject({ pacienteId: p.miguel, usuarioId: null })
    expect((await api.pedir('GET', '/convites/token-que-nao-existe')).status).toBe(404)
  })

  it('o aceite cria a conta do professor, o vinculo e a sessao; a concessao fica em nome dele', async () => {
    const r = await api.pedir('POST', `/convites/${p.tokenMiguel}/aceite`, { corpo: ACEITE })
    expect(r.status, JSON.stringify(r.corpo)).toBe(200)
    expect(r.corpo).toMatchObject({ perfilAtivo: 'PROFESSOR', usuario: { email: 'carla@escola.example' } })
    u.carla = r.corpo.usuario.id
    c.carla = cookieDaSessao(r)
    expect(await prisma.vinculoEscolar.count({ where: { professorId: u.carla, pacienteId: p.miguel } })).toBe(1)
    expect(await ultimaDe({ acao: 'CONCESSAO_ACESSO', entidade: 'VinculoEscolar' })).toMatchObject({ usuarioId: u.carla, perfil: 'PROFESSOR', pacienteId: p.miguel })
  })

  it('usado uma vez, o convite nao serve de novo, e a tentativa fica na trilha', async () => {
    const r = await api.pedir('POST', `/convites/${p.tokenMiguel}/aceite`, { corpo: { ...ACEITE, email: 'outra@escola.example' } })
    expect(r.status).toBe(409)
    expect(await ultimaDe({ acao: 'ACESSO_NEGADO', entidade: 'ConviteEscolar' })).toMatchObject({ pacienteId: p.miguel, usuarioId: null, detalhe: 'Convite usado.' })
  })

  it('segundo aluno, mesmo e-mail: a senha tem de ser a da conta, e o vinculo novo entra nela', async () => {
    const r = await api.pedir('POST', '/consentimentos', { cookie: c.mae, corpo: { pacienteId: p.sofia, escolaId: p.escola, escopos: ['CARTAO_ESTRATEGIA', 'REGISTRO_OCORRENCIA'], validadeAte: em90dias() } })
    p.consSofia = r.corpo.consentimento.id
    const token = r.corpo.tokenConvite

    const errada = await api.pedir('POST', `/convites/${token}/aceite`, { corpo: { ...ACEITE, senha: 'senha-errada-qualquer' } })
    expect(errada.status).toBe(401)
    expect((await api.pedir('GET', `/convites/${token}`)).corpo.situacao).toBe('VALIDO')

    const daEquipe = await api.pedir('POST', `/convites/${token}/aceite`, { corpo: { ...ACEITE, email: 'ana@teste.example' } })
    expect(daEquipe.status).toBe(409)

    const certa = await api.pedir('POST', `/convites/${token}/aceite`, { corpo: { ...ACEITE, nome: 'Nome ignorado', turma: '4º ano B' } })
    expect(certa.status).toBe(200)
    expect(certa.corpo.usuario.id).toBe(u.carla)
    expect(await prisma.usuario.count({ where: { email: 'carla@escola.example' } })).toBe(1)
    expect(await prisma.vinculoEscolar.count({ where: { professorId: u.carla } })).toBe(2)
  })

  it('convite vencido: 72 horas depois, EXPIRADO, e nao cria conta', async () => {
    const r = await api.pedir('POST', '/consentimentos', { cookie: c.rosa, corpo: { pacienteId: p.davi, escolaId: p.escola, escopos: ['CARTAO_ESTRATEGIA'], validadeAte: em90dias() } })
    p.consDavi = r.corpo.consentimento.id
    await prisma.conviteEscolar.updateMany({ where: { tokenResumo: sha256(r.corpo.tokenConvite) }, data: { expiraEm: new Date(Date.now() - 1000) } })
    expect((await api.pedir('GET', `/convites/${r.corpo.tokenConvite}`)).corpo.situacao).toBe('EXPIRADO')
    expect((await api.pedir('POST', `/convites/${r.corpo.tokenConvite}/aceite`, { corpo: { ...ACEITE, email: 'nova@escola.example' } })).status).toBe(409)
    expect(await prisma.usuario.count({ where: { email: 'nova@escola.example' } })).toBe(0)
  })

  it('a senha errada no convite conta no mesmo limite da entrada: bloqueada, nem a certa passa', async () => {
    const token = (await api.pedir('POST', `/consentimentos/${p.consDavi}/convites`, { cookie: c.rosa })).corpo.tokenConvite
    for (let i = 0; i < 4; i++) {
      expect((await api.pedir('POST', '/auth/entrar', { corpo: { email: 'carla@escola.example', senha: `errada-${i}-xyz` } })).status).toBe(401)
    }
    expect((await api.pedir('POST', `/convites/${token}/aceite`, { corpo: { ...ACEITE, senha: 'errada-4-xyz' } })).status).toBe(401)
    expect((await api.pedir('POST', `/convites/${token}/aceite`, { corpo: ACEITE })).status).toBe(429)
    expect((await api.pedir('POST', '/auth/entrar', { corpo: { email: 'carla@escola.example', senha: ACEITE.senha } })).status).toBe(429)
    expect(await prisma.vinculoEscolar.count({ where: { professorId: u.carla, pacienteId: p.davi } })).toBe(0)
  })
})

describe('regras 2 e 3: a escola le so o cartao, so com consentimento vigente e escopo', () => {
  it('a lista de alunos traz so o primeiro nome, a turma, a escola e a situacao', async () => {
    const r = await api.pedir('GET', '/escola/alunos', { cookie: c.carla })
    expect(r.corpo.itens.map((a: { nome: string; turma: string }) => [a.nome, a.turma])).toEqual([['Miguel', '2º ano A'], ['Sofia', '4º ano B']])
    for (const proibido of ['Santana', 'nivelSuporte', 'dataNascimento', TECNICA]) expect(JSON.stringify(r.corpo)).not.toContain(proibido)
    expect(await ultimaDe({ usuarioId: u.carla, acao: 'LEITURA_AUTORIZADA', entidade: 'VinculoEscolar' })).toMatchObject({ detalhe: 'Consulta da lista de alunos (2).' })
  })

  it('regra 3: o cartao chega projetado, sem nada clinico; a leitura fica na trilha', async () => {
    const r = await api.pedir('GET', `/escola/alunos/${p.miguel}/cartao`, { cookie: c.carla })
    expect(r.status).toBe(200)
    expect(Object.keys(r.corpo).sort()).toEqual(['atualizadoEm', 'escopos', 'estrategias', 'nome', 'pacienteId', 'turma', 'turno', 'validadeAte'])
    // Item 10: o que a familia autorizou, para a tela nao oferecer o registro sem ele.
    expect(r.corpo.escopos).toEqual(['CARTAO_ESTRATEGIA'])
    expect(r.corpo.estrategias).toEqual([{ titulo: 'Pedir ajuda', paraQue: ACESSIVEL, oQueFazer: ['Mostrar a figura'], oQueEvitar: ['Falar alto'], sinalAlerta: 'Tapa os ouvidos.' }])
    for (const proibido of [TECNICA, 'descricaoTecnica', 'percentual', 'criterio', 'nivelSuporte', 'Santana', 'registros']) {
      expect(JSON.stringify(r.corpo)).not.toContain(proibido)
    }
    expect(await ultimaDe({ usuarioId: u.carla, entidade: 'CartaoEstrategia' })).toMatchObject({ acao: 'LEITURA_AUTORIZADA', pacienteId: p.miguel })
  })

  it('regra 2: fora do escopo e sem vinculo, a negativa diz o motivo e fica na trilha', async () => {
    const fora = await api.pedir('POST', `/escola/alunos/${p.miguel}/ocorrencias`, { cookie: c.carla, corpo: { tipo: 'Tapou os ouvidos', intensidade: 2, contexto: 'Recreio' } })
    expect(fora.status).toBe(403)
    expect(fora.corpo.motivo).toBe('ESCOPO_NAO_AUTORIZADO')
    const semVinculo = await api.pedir('GET', `/escola/alunos/${p.davi}/cartao`, { cookie: c.carla })
    expect(semVinculo.corpo.motivo).toBe('FORA_DO_ALCANCE')
    expect(await ultimaDe({ usuarioId: u.carla, acao: 'ACESSO_NEGADO' })).toMatchObject({ pacienteId: p.davi, detalhe: 'Negado: SEM_CONSENTIMENTO.' })
    expect((await api.pedir('GET', `/escola/alunos/${p.miguel}/cartao`, { cookie: c.mae })).status).toBe(403)
    expect((await api.pedir('GET', `/pacientes/${p.miguel}`, { cookie: c.carla })).status).toBe(403)
  })

  it('a ocorrencia entra como evento preliminar; a correcao guarda a versao anterior; passada a janela, nao se corrige', async () => {
    // Com o escopo de registro, o cartao diz isso, e a tela oferece o registro (item 10).
    expect((await api.pedir('GET', `/escola/alunos/${p.sofia}/cartao`, { cookie: c.carla })).corpo.escopos)
      .toEqual(expect.arrayContaining(['CARTAO_ESTRATEGIA', 'REGISTRO_OCORRENCIA']))
    const r = await api.pedir('POST', `/escola/alunos/${p.sofia}/ocorrencias`, { cookie: c.carla, corpo: { tipo: 'Tapou os ouvidos', intensidade: 2, contexto: 'Recreio' } })
    expect(r.status).toBe(201)
    const preliminar = await prisma.ocorrenciaComportamental.findFirstOrThrow({ where: { ocorrenciaEscolarId: r.corpo.id } })
    expect(preliminar).toMatchObject({ origem: 'ESCOLA', leituraClinicaEm: null, pacienteId: p.sofia })

    const corrigida = await api.pedir('PUT', `/escola/ocorrencias/${r.corpo.id}`, { cookie: c.carla, corpo: { tipo: 'Saiu da sala', intensidade: 3, contexto: 'Recreio' } })
    expect(corrigida.corpo).toMatchObject({ tipo: 'Saiu da sala', intensidade: 3 })
    expect(await ultimaDe({ idEntidade: r.corpo.id, acao: 'ALTERACAO' })).toMatchObject({
      pacienteId: p.sofia, valorAnterior: '{"contexto":"Recreio","intensidade":2,"tipo":"Tapou os ouvidos"}',
    })

    // Outro professor do mesmo aluno, com o escopo, nao corrige o que nao registrou.
    const convite = await api.pedir('POST', `/consentimentos/${p.consSofia}/convites`, { cookie: c.mae })
    const dora = await api.pedir('POST', `/convites/${convite.corpo.tokenConvite}/aceite`, {
      corpo: { nome: 'Dora Professora', email: 'dora@escola.example', senha: 'senha-da-dora', turma: '4º ano B', turno: 'Matutino', atuacao: 'AEE' },
    })
    const daDora = await api.pedir('PUT', `/escola/ocorrencias/${r.corpo.id}`, { cookie: cookieDaSessao(dora), corpo: { tipo: 'Outra', intensidade: 1, contexto: 'Entrada' } })
    expect(daDora.status).toBe(403)
    expect(await ultimaDe({ usuarioId: dora.corpo.usuario.id, acao: 'ACESSO_NEGADO' })).toMatchObject({ pacienteId: p.sofia, detalhe: 'Correção por quem não registrou.' })
    await prisma.ocorrenciaEscolar.update({ where: { id: r.corpo.id }, data: { registradaEm: new Date(Date.now() - 31 * 60_000) } })
    expect((await api.pedir('PUT', `/escola/ocorrencias/${r.corpo.id}`, { cookie: c.carla, corpo: { tipo: 'Outra', intensidade: 1, contexto: 'Entrada' } })).status).toBe(409)
  })
})

describe('regra 5: a revogacao corta a leitura seguinte, na hora; e qualquer responsavel vinculado revoga', () => {
  it('o responsavel nao legal encerra; a leitura seguinte da escola ja e negada, e a lista mostra o encerramento', async () => {
    expect((await api.pedir('GET', `/escola/alunos/${p.miguel}/cartao`, { cookie: c.carla })).status).toBe(200)
    const r = await api.pedir('POST', `/consentimentos/${p.consMiguel}/revogacao`, { cookie: c.pai })
    expect(r.status).toBe(200)
    expect(r.corpo.situacao).toBe('REVOGADO')
    expect(await ultimaDe({ acao: 'REVOGACAO_ACESSO' })).toMatchObject({ usuarioId: u.pai, pacienteId: p.miguel, idEntidade: p.consMiguel })

    const depois = await api.pedir('GET', `/escola/alunos/${p.miguel}/cartao`, { cookie: c.carla })
    expect(depois.status).toBe(403)
    expect(depois.corpo.motivo).toBe('CONSENTIMENTO_REVOGADO')
    expect(await ultimaDe({ usuarioId: u.carla, acao: 'ACESSO_NEGADO' })).toMatchObject({ pacienteId: p.miguel, detalhe: 'Negado: REVOGADO.' })

    const lista = await api.pedir('GET', '/escola/alunos', { cookie: c.carla })
    expect(lista.corpo.itens.find((a: { pacienteId: string }) => a.pacienteId === p.miguel)).toMatchObject({ situacao: 'REVOGADO', escopos: [] })
  })

  it('revogar de novo nao muda nada, e nao entra outra vez na trilha', async () => {
    const antes = await prisma.registroAuditoria.count({ where: { acao: 'REVOGACAO_ACESSO' } })
    expect((await api.pedir('POST', `/consentimentos/${p.consMiguel}/revogacao`, { cookie: c.mae })).status).toBe(200)
    expect(await prisma.registroAuditoria.count({ where: { acao: 'REVOGACAO_ACESSO' } })).toBe(antes)
  })

  it('validade vencida: a leitura e negada com o motivo do prazo', async () => {
    await prisma.consentimento.update({ where: { id: p.consSofia }, data: { validadeAte: new Date('2026-01-01T00:00:00Z'), concedidoEm: new Date('2025-12-01T00:00:00Z') } })
    const r = await api.pedir('GET', `/escola/alunos/${p.sofia}/cartao`, { cookie: c.carla })
    expect(r.corpo.motivo).toBe('CONSENTIMENTO_EXPIRADO')
  })

  it('a clinica e a familia leem as autorizacoes; quem esta fora, nao', async () => {
    const daClinica = await api.pedir('GET', `/pacientes/${p.miguel}/consentimentos`, { cookie: c.ana })
    expect(daClinica.corpo.itens[0]).toMatchObject({ situacao: 'REVOGADO', professor: 'Carla Professora', turma: '2º ano A', conviteAceito: true })
    expect((await api.pedir('GET', `/pacientes/${p.miguel}/consentimentos`, { cookie: c.pai })).status).toBe(200)
    expect((await api.pedir('GET', `/pacientes/${p.miguel}/consentimentos`, { cookie: c.rosa })).status).toBe(403)
    expect((await api.pedir('GET', `/pacientes/${p.miguel}/consentimentos`, { cookie: c.carla })).status).toBe(403)
  })
})
