import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest'
import { diaCivilEm, inicioDoDia } from '@sinctea/compartilhado/dominio/datas'
import type { PrismaClient } from '../src/gerado/client.js'
import { clienteDe, criarBancoMigrado } from './apoio/banco.js'
import { cookieDaSessao, criarUsuario, subirApi, type Api, type Resposta } from './apoio/api.js'

/**
 * Item 15: atividades de casa, pela API, num banco que comeca vazio. A
 * clinica que alcanca o paciente prescreve e encerra; qualquer responsavel
 * vinculado, legal ou nao, ve e registra como foi; professor e administrador
 * nunca alcancam (regra 3). Um registro por atividade por dia, no dia civil
 * de Manaus. Toda operacao deixa uma linha na trilha, e a negativa tambem
 * (regra 6).
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
  titulo: 'Escolher o lanche apontando', descricao: 'Na hora do lanche, mostre duas opções.',
  passos: ['Mostre duas opções, uma em cada mão.', ' ', 'Espere alguns segundos sem falar.'],
  dicas: 'Se não escolher, aproxime as opções.', frequenciaSemanal: 3, urlVideo: 'https://videos.exemplo.org/lanche',
}
const hoje = () => diaCivilEm(new Date())
const em90dias = () => diaCivilEm(new Date(Date.now() + 90 * 86_400_000))

const prescrever = (cookie: string, mudanca: Record<string, unknown> = {}) => api.pedir('POST', '/atividades', {
  cookie, corpo: { pacienteId: p.miguel, objetivoId: p.objetivo, ...ATIVIDADE, ...mudanca },
})
const registrar = (cookie: string, atividadeId: string, corpo: Record<string, unknown> = { desempenho: 'COM_AJUDA' }) =>
  api.pedir('POST', `/atividades/${atividadeId}/execucoes`, { cookie, corpo })
const linhasDaTrilha = () => prisma.registroAuditoria.count()

/** Faz o pedido e confere que ele deixou exatamente uma linha na trilha; devolve a resposta e a linha. */
async function comUmaLinha(pedido: () => Promise<Resposta>) {
  const antes = (await prisma.registroAuditoria.findMany({ select: { id: true } })).map((x) => x.id)
  const r = await pedido()
  const linhas = await prisma.registroAuditoria.findMany({ where: { id: { notIn: antes } } })
  expect(linhas, JSON.stringify(r.corpo)).toHaveLength(1)
  return { r, linha: linhas[0] }
}

/** Um responsavel com a senha ja definida, pelo link de primeiro acesso, como a familia faz. */
async function responsavel(pacienteId: string, nome: string, email: string, responsavelLegal: boolean) {
  const r = await api.pedir('POST', `/pacientes/${pacienteId}/responsaveis`, {
    cookie: c.ana, corpo: { nome, email, telefone: '(92) 90000-0000', parentesco: responsavelLegal ? 'Mãe' : 'Pai', responsavelLegal },
  })
  expect(r.status, JSON.stringify(r.corpo)).toBe(201)
  await api.pedir('POST', `/auth/primeiro-acesso/${r.corpo.primeiroAcesso.token}`, { corpo: { senha: 'senha-da-familia-1' } })
  return { id: r.corpo.responsavel.responsavelId as string, cookie: await api.entrar(email, 'senha-da-familia-1') }
}

beforeAll(async () => {
  const banco = await criarBancoMigrado(inject('urlAdministrativa'), 'sinctea_atividades')
  apagar = banco.apagar
  prisma = clienteDe(banco.url)
  u.ana = await criarUsuario(prisma, { email: 'ana@teste.example', nome: 'Ana Souza', perfis: ['TERAPEUTA'] })
  u.bruno = await criarUsuario(prisma, { email: 'bruno@teste.example', nome: 'Bruno Lima', perfis: ['TERAPEUTA'] })
  u.coord = await criarUsuario(prisma, { email: 'coord@teste.example', nome: 'Caio Coordenador', perfis: ['COORDENADOR'] })
  u.admin = await criarUsuario(prisma, { email: 'admin@teste.example', nome: 'Zélia Administradora', perfis: ['ADMINISTRADOR'] })
  api = await subirApi(banco.url)
  for (const nome of ['ana', 'bruno', 'coord', 'admin']) c[nome] = await api.entrar(`${nome}@teste.example`)

  // Miguel, da equipe da Ana, com plano vigente: escrito pela Ana, aprovado pela coordenacao.
  p.miguel = (await api.pedir('POST', '/pacientes', {
    cookie: c.ana, corpo: { nome: 'Miguel Ficticio Santana', dataNascimento: '2019-03-12', nivelSuporte: 2, profissionalResponsavelId: u.ana },
  })).corpo.id
  p.plano = (await api.pedir('POST', `/pacientes/${p.miguel}/plano`, { cookie: c.ana, corpo: { dataInicio: '2026-10-01', dataRevisao: '2027-04-01' } })).corpo.id
  p.objetivo = (await api.pedir('POST', `/planos/${p.plano}/objetivos`, { cookie: c.ana, corpo: OBJETIVO })).corpo.id
  await api.pedir('POST', `/planos/${p.plano}/envio`, { cookie: c.ana })
  expect((await api.pedir('POST', `/planos/${p.plano}/aprovacao`, { cookie: c.coord })).corpo.status).toBe('VIGENTE')

  // Laura, tambem da Ana, com o plano ainda em rascunho.
  p.laura = (await api.pedir('POST', '/pacientes', {
    cookie: c.ana, corpo: { nome: 'Laura Ficticia Reis', dataNascimento: '2020-06-01', nivelSuporte: 1, profissionalResponsavelId: u.ana },
  })).corpo.id
  const planoLaura = (await api.pedir('POST', `/pacientes/${p.laura}/plano`, { cookie: c.ana, corpo: { dataInicio: '2026-10-01', dataRevisao: '2027-04-01' } })).corpo.id
  p.objetivoRascunho = (await api.pedir('POST', `/planos/${planoLaura}/objetivos`, { cookie: c.ana, corpo: OBJETIVO })).corpo.id

  // A mae responde legalmente pelo Miguel; o pai, nao. A Rita e responsavel so da Laura.
  const mae = await responsavel(p.miguel, 'Patrícia Ficticia', 'mae@teste.example', true)
  const pai = await responsavel(p.miguel, 'Paulo Ficticio', 'pai@teste.example', false)
  const rita = await responsavel(p.laura, 'Rita Ficticia', 'rita@teste.example', true)
  Object.assign(u, { mae: mae.id, pai: pai.id, rita: rita.id })
  Object.assign(c, { mae: mae.cookie, pai: pai.cookie, rita: rita.cookie })

  // A professora do Miguel, pelo caminho inteiro: consentimento, convite e aceite.
  const escola = await api.pedir('POST', '/escolas', { cookie: c.mae, corpo: { nome: 'Escola Municipal Vitória-Régia', rede: 'Municipal', municipio: 'Manaus' } })
  const consentimento = await api.pedir('POST', '/consentimentos', {
    cookie: c.mae, corpo: { pacienteId: p.miguel, escolaId: escola.corpo.id, escopos: ['CARTAO_ESTRATEGIA'], validadeAte: em90dias() },
  })
  const carla = await api.pedir('POST', `/convites/${consentimento.corpo.tokenConvite}/aceite`, {
    corpo: { nome: 'Carla Professora', email: 'carla@escola.example', senha: 'senha-da-carla', turma: '2º ano A', turno: 'Matutino', atuacao: 'Regente' },
  })
  expect(carla.status, JSON.stringify(carla.corpo)).toBe(200)
  c.carla = cookieDaSessao(carla)
  u.carla = carla.corpo.usuario.id
})

afterAll(async () => {
  await api?.fechar()
  await prisma?.$disconnect()
  await apagar?.()
})

describe('a clinica prescreve', () => {
  it('com um objetivo do plano vigente; a atividade nasce ativa, e a criacao fica na trilha com o paciente', async () => {
    const { r, linha } = await comUmaLinha(() => prescrever(c.ana))
    expect(r.status, JSON.stringify(r.corpo)).toBe(201)
    expect(r.corpo).toMatchObject({
      pacienteId: p.miguel, objetivoId: p.objetivo, titulo: ATIVIDADE.titulo, ativa: true, urlVideo: ATIVIDADE.urlVideo,
      // Gravada como sera lida: sem o passo vazio.
      passos: ['Mostre duas opções, uma em cada mão.', 'Espere alguns segundos sem falar.'],
    })
    expect(linha).toMatchObject({
      acao: 'CRIACAO', entidade: 'AtividadeCasa', idEntidade: r.corpo.id, pacienteId: p.miguel, usuarioId: u.ana,
      detalhe: `Atividade de casa prescrita: ${ATIVIDADE.titulo}.`,
    })
    p.atividade = r.corpo.id
    // A coordenacao tambem prescreve.
    expect((await prescrever(c.coord, { titulo: 'Pedir ajuda para abrir a embalagem' })).status).toBe(201)
  })

  it('so com objetivo do plano vigente do paciente: rascunho, outro paciente e id inventado sao recusados', async () => {
    const antes = await prisma.atividadeCasa.count()
    // O objetivo da Laura esta em rascunho: nem para ela, nem para o Miguel.
    const doRascunho = await prescrever(c.ana, { pacienteId: p.laura, objetivoId: p.objetivoRascunho })
    expect(doRascunho.status).toBe(422)
    expect(doRascunho.corpo.campos.objetivoId).toBe('Escolha um objetivo do plano vigente deste paciente.')
    expect((await prescrever(c.ana, { objetivoId: p.objetivoRascunho })).corpo.campos.objetivoId).toBeTruthy()
    // O objetivo vigente do Miguel nao serve a Laura: a recusa e de validacao, antes do trigger do banco.
    expect((await prescrever(c.ana, { pacienteId: p.laura })).corpo.campos?.objetivoId).toBeTruthy()
    expect((await prescrever(c.ana, { objetivoId: 'nao-e-uuid' })).status).toBe(422)
    expect((await prescrever(c.ana, { objetivoId: undefined })).status).toBe(422)
    expect(await prisma.atividadeCasa.count()).toBe(antes)
  })

  it('a validacao do compartilhado: "javascript:" no video, passo demais e frequencia fora da faixa sao recusados', async () => {
    const antes = await prisma.atividadeCasa.count()
    const xss = await prescrever(c.ana, { urlVideo: 'javascript:alert(document.cookie)' })
    expect(xss.status).toBe(422)
    expect(Object.keys(xss.corpo.campos)).toEqual(['urlVideo'])
    expect((await prescrever(c.ana, { urlVideo: 'http://videos.exemplo.org/a' })).corpo.campos.urlVideo).toBeTruthy()
    expect((await prescrever(c.ana, { passos: Array.from({ length: 11 }, (_, i) => `Passo ${i + 1}.`) })).corpo.campos.passos).toBeTruthy()
    expect((await prescrever(c.ana, { titulo: 'x'.repeat(121) })).corpo.campos.titulo).toBeTruthy()
    expect((await prescrever(c.ana, { frequenciaSemanal: 8 })).corpo.campos.frequenciaSemanal).toBeTruthy()
    expect((await prescrever(c.ana, { frequenciaSemanal: '3' })).corpo.campos.frequenciaSemanal).toBeTruthy()
    expect(await prisma.atividadeCasa.count()).toBe(antes)
  })
})

describe('regra 3: quem nao alcanca o paciente e negado, e a negativa fica na trilha', () => {
  it('profissional fora da equipe: nem prescreve, nem le, nem encerra', async () => {
    const pedidos = [
      () => prescrever(c.bruno),
      () => api.pedir('GET', `/pacientes/${p.miguel}/atividades`, { cookie: c.bruno }),
      () => api.pedir('GET', `/atividades/${p.atividade}`, { cookie: c.bruno }),
      () => api.pedir('GET', `/atividades/${p.atividade}/execucoes`, { cookie: c.bruno }),
      () => api.pedir('POST', `/atividades/${p.atividade}/encerramento`, { cookie: c.bruno }),
    ]
    for (const pedido of pedidos) {
      const { r, linha } = await comUmaLinha(pedido)
      expect(r.status).toBe(403)
      expect(linha).toMatchObject({ acao: 'ACESSO_NEGADO', usuarioId: u.bruno, pacienteId: p.miguel })
    }
    expect((await prisma.atividadeCasa.findUniqueOrThrow({ where: { id: p.atividade } })).ativa).toBe(true)
  })

  it('responsavel de outro paciente: nem ve, nem registra', async () => {
    const pedidos = [
      () => api.pedir('GET', `/pacientes/${p.miguel}/atividades`, { cookie: c.rita }),
      () => api.pedir('GET', `/atividades/${p.atividade}`, { cookie: c.rita }),
      () => api.pedir('GET', `/atividades/${p.atividade}/execucoes`, { cookie: c.rita }),
      () => registrar(c.rita, p.atividade),
    ]
    for (const pedido of pedidos) {
      const { r, linha } = await comUmaLinha(pedido)
      expect(r.status).toBe(403)
      expect(linha).toMatchObject({ acao: 'ACESSO_NEGADO', usuarioId: u.rita, pacienteId: p.miguel })
    }
    expect(await prisma.execucaoAtividadeCasa.count()).toBe(0)
  })

  it('a familia nao prescreve nem encerra', async () => {
    for (const pedido of [() => prescrever(c.mae), () => api.pedir('POST', `/atividades/${p.atividade}/encerramento`, { cookie: c.mae })]) {
      const { r, linha } = await comUmaLinha(pedido)
      expect(r.status).toBe(403)
      expect(linha).toMatchObject({ acao: 'ACESSO_NEGADO', usuarioId: u.mae })
    }
  })

  it('professor, mesmo o do proprio aluno, e administrador: nenhuma rota responde', async () => {
    for (const quem of ['carla', 'admin']) {
      const pedidos = [
        () => api.pedir('GET', `/pacientes/${p.miguel}/atividades`, { cookie: c[quem] }),
        () => api.pedir('GET', `/atividades/${p.atividade}`, { cookie: c[quem] }),
        () => api.pedir('GET', `/atividades/${p.atividade}/execucoes`, { cookie: c[quem] }),
        () => prescrever(c[quem]),
        () => api.pedir('POST', `/atividades/${p.atividade}/encerramento`, { cookie: c[quem] }),
        () => registrar(c[quem], p.atividade),
      ]
      for (const pedido of pedidos) {
        const { r, linha } = await comUmaLinha(pedido)
        expect(r.status, quem).toBe(403)
        expect(linha, quem).toMatchObject({ acao: 'ACESSO_NEGADO', usuarioId: u[quem] })
      }
    }
    // Sem sessao, nao ha quem registrar: 401, como no resto da API.
    expect((await api.pedir('GET', `/atividades/${p.atividade}`)).status).toBe(401)
  })
})

describe('a familia ve e registra como foi', () => {
  it('qualquer responsavel vinculado le a lista e a atividade, sem nada clinico, e cada leitura fica na trilha', async () => {
    for (const quem of ['mae', 'pai']) {
      const lista = await comUmaLinha(() => api.pedir('GET', `/pacientes/${p.miguel}/atividades`, { cookie: c[quem] }))
      expect(lista.r.corpo.total, quem).toBe(2)
      expect(lista.linha).toMatchObject({ acao: 'LEITURA_AUTORIZADA', entidade: 'AtividadeCasa', pacienteId: p.miguel, usuarioId: u[quem] })
      const uma = await comUmaLinha(() => api.pedir('GET', `/atividades/${p.atividade}`, { cookie: c[quem] }))
      expect(uma.r.corpo.urlVideo).toBe(ATIVIDADE.urlVideo)
      expect(uma.linha).toMatchObject({ acao: 'LEITURA_AUTORIZADA', idEntidade: p.atividade, pacienteId: p.miguel })
      // O objetivo vai so pelo id: nem a redacao tecnica, nem o dominio.
      for (const resposta of [lista.r.corpo, uma.r.corpo]) {
        expect(JSON.stringify(resposta)).not.toContain(OBJETIVO.descricaoTecnica)
        expect(JSON.stringify(resposta)).not.toContain(OBJETIVO.dominio)
      }
    }
  })

  it('o responsavel que nao e legal registra; o dia e o de Manaus, e a observacao nao entra na trilha', async () => {
    const { r, linha } = await comUmaLinha(() => registrar(c.pai, p.atividade, { desempenho: 'NAO_QUIS', observacao: '  Estava agitado hoje.  ' }))
    expect(r.status, JSON.stringify(r.corpo)).toBe(201)
    expect(r.corpo).toMatchObject({ atividadeId: p.atividade, responsavelId: u.pai, dataRealizacao: hoje(), desempenho: 'NAO_QUIS', observacao: 'Estava agitado hoje.' })
    expect(linha).toMatchObject({
      acao: 'CRIACAO', entidade: 'ExecucaoAtividadeCasa', idEntidade: r.corpo.id, pacienteId: p.miguel, usuarioId: u.pai,
      detalhe: 'Execução registrada pela família.',
    })
    expect(linha.detalhe).not.toContain('agitado')

    const execucoes = await comUmaLinha(() => api.pedir('GET', `/atividades/${p.atividade}/execucoes`, { cookie: c.ana }))
    expect(execucoes.r.corpo.itens).toEqual([r.corpo])
    expect(execucoes.linha).toMatchObject({ acao: 'LEITURA_AUTORIZADA', entidade: 'ExecucaoAtividadeCasa', pacienteId: p.miguel, usuarioId: u.ana })
  })

  it('o segundo registro do dia e recusado e diz quem ja registrou; nada se grava nem se registra', async () => {
    const antes = await linhasDaTrilha()
    const r = await registrar(c.mae, p.atividade, { desempenho: 'SOZINHO' })
    expect(r.status).toBe(409)
    expect(r.corpo.mensagem).toBe('Hoje já foi registrado por Paulo Ficticio.')
    expect(await prisma.execucaoAtividadeCasa.count({ where: { atividadeId: p.atividade } })).toBe(1)
    expect(await linhasDaTrilha()).toBe(antes)
  })

  it('quatro pedidos ao mesmo tempo, da mae e do pai: um registro so, e uma linha so na trilha', async () => {
    const nova = (await prescrever(c.ana, { titulo: 'Avisar quando o barulho incomoda' })).corpo.id
    const respostas = await Promise.all([c.mae, c.pai, c.mae, c.pai].map((cookie) => registrar(cookie, nova)))
    expect(respostas.map((x) => x.status).sort()).toEqual([201, 409, 409, 409])
    expect(await prisma.execucaoAtividadeCasa.count({ where: { atividadeId: nova } })).toBe(1)
    expect(await prisma.registroAuditoria.count({ where: { entidade: 'ExecucaoAtividadeCasa', acao: 'CRIACAO', pacienteId: p.miguel } })).toBe(2)
    const quem = respostas.find((x) => x.status === 201)!.corpo.responsavelId === u.mae ? 'Patrícia Ficticia' : 'Paulo Ficticio'
    for (const recusada of respostas.filter((x) => x.status === 409)) {
      expect(recusada.corpo.mensagem).toBe(`Hoje já foi registrado por ${quem}.`)
    }
  })

  it('as 22h30 em Manaus, quando em UTC ja e o dia seguinte, o registro fica no dia de Manaus', async () => {
    const nova = (await prescrever(c.ana, { titulo: 'Guardar os brinquedos com a música' })).corpo.id
    const diaDeManaus = hoje()
    // So o Date do processo, que e o mesmo da API: os temporizadores e a rede seguem de verdade.
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(new Date(inicioDoDia(diaDeManaus).getTime() + 22.5 * 3_600_000))
      expect(new Date().toISOString().slice(0, 10)).not.toBe(diaDeManaus)
      const r = await registrar(c.mae, nova)
      expect(r.status, JSON.stringify(r.corpo)).toBe(201)
      expect(r.corpo.dataRealizacao).toBe(diaDeManaus)
    } finally {
      vi.useRealTimers()
    }
  })

  it('o encerramento que chega junto: o registro espera a atividade travada e a ve encerrada', async () => {
    const nova = (await prescrever(c.ana, { titulo: 'Esperar a vez no jogo' })).corpo.id
    let registro: Promise<Resposta> | undefined
    // Um encerramento em curso, segurando a linha da atividade ate gravar.
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "atividade_casa" WHERE "id" = ${nova}::uuid FOR UPDATE`
      registro = registrar(c.mae, nova)
      await new Promise((pronto) => setTimeout(pronto, 500))
      await tx.atividadeCasa.update({ where: { id: nova }, data: { ativa: false } })
    })
    const r = await registro!
    expect(r.status, JSON.stringify(r.corpo)).toBe(409)
    expect(r.corpo.mensagem).toBe('Esta atividade foi encerrada pela equipe.')
    expect(await prisma.execucaoAtividadeCasa.count({ where: { atividadeId: nova } })).toBe(0)
  })

  it('desempenho fora dos tres e observacao longa sao recusados', async () => {
    const nova = (await prescrever(c.ana, { titulo: 'Lavar as mãos com o passo a passo' })).corpo.id
    expect((await registrar(c.mae, nova, { desempenho: 'INDEPENDENTE' })).corpo.campos.desempenho).toBe('Escolha como foi hoje.')
    expect((await registrar(c.mae, nova, { desempenho: 'SOZINHO', observacao: 'x'.repeat(501) })).corpo.campos.observacao).toBeTruthy()
    expect(await prisma.execucaoAtividadeCasa.count({ where: { atividadeId: nova } })).toBe(0)
  })
})

describe('a clinica encerra', () => {
  it('a atividade sai da lista da familia, seja qual for o filtro, e o historico fica', async () => {
    const { r, linha } = await comUmaLinha(() => api.pedir('POST', `/atividades/${p.atividade}/encerramento`, { cookie: c.ana }))
    expect(r.status).toBe(200)
    expect(r.corpo.ativa).toBe(false)
    expect(linha).toMatchObject({ acao: 'ALTERACAO', entidade: 'AtividadeCasa', idEntidade: p.atividade, pacienteId: p.miguel, detalhe: 'Prescrição encerrada.' })
    expect((await api.pedir('POST', `/atividades/${p.atividade}/encerramento`, { cookie: c.coord })).status).toBe(409)

    for (const consulta of ['', '?ativa=false', '?ativa=true']) {
      const daFamilia = await api.pedir('GET', `/pacientes/${p.miguel}/atividades${consulta}`, { cookie: c.mae })
      expect(daFamilia.corpo.itens.map((a: { id: string }) => a.id), consulta).not.toContain(p.atividade)
      expect(daFamilia.corpo.itens.every((a: { ativa: boolean }) => a.ativa), consulta).toBe(true)
    }
    // A clinica ve as encerradas, se pedir.
    const daClinica = await api.pedir('GET', `/pacientes/${p.miguel}/atividades?ativa=false`, { cookie: c.ana })
    expect(daClinica.corpo.itens.map((a: { id: string }) => a.id)).toContain(p.atividade)
    expect(daClinica.corpo.itens.every((a: { ativa: boolean }) => !a.ativa)).toBe(true)

    // Pelo endereco, a familia ainda abre a atividade e o que registrou.
    expect((await api.pedir('GET', `/atividades/${p.atividade}`, { cookie: c.mae })).corpo.ativa).toBe(false)
    expect((await api.pedir('GET', `/atividades/${p.atividade}/execucoes`, { cookie: c.mae })).corpo.total).toBe(1)
  })

  it('registro em atividade encerrada e recusado, com as palavras da tela 16', async () => {
    const antes = await linhasDaTrilha()
    const r = await registrar(c.mae, p.atividade)
    expect(r.status).toBe(409)
    expect(r.corpo.mensagem).toBe('Esta atividade foi encerrada pela equipe.')
    expect(await prisma.execucaoAtividadeCasa.count({ where: { atividadeId: p.atividade } })).toBe(1)
    expect(await linhasDaTrilha()).toBe(antes)
  })

  it('id que nao existe ou nao e uuid: 404, sem revelar nada', async () => {
    for (const id of ['nao-e-uuid', '00000000-0000-7000-8000-000000000000']) {
      expect((await api.pedir('GET', `/atividades/${id}`, { cookie: c.ana })).status).toBe(404)
      expect((await registrar(c.mae, id)).status).toBe(404)
    }
  })
})

describe('no banco', () => {
  it('o indice unico recusa o segundo registro do mesmo dia, venha de onde vier', async () => {
    const atividade = await prisma.atividadeCasa.findFirstOrThrow({ where: { ativa: true, pacienteId: p.miguel } })
    const linha = { atividadeId: atividade.id, responsavelId: u.mae, dataRealizacao: new Date('2026-10-01T00:00:00Z'), desempenho: 'SOZINHO' as const }
    await prisma.execucaoAtividadeCasa.create({ data: linha })
    await expect(prisma.execucaoAtividadeCasa.create({ data: { ...linha, responsavelId: u.pai } })).rejects.toMatchObject({ code: 'P2002' })
    // Outro dia, outro registro.
    await prisma.execucaoAtividadeCasa.create({ data: { ...linha, dataRealizacao: new Date('2026-10-02T00:00:00Z') } })
  })

  it('a atividade e o objetivo sao do mesmo paciente: o trigger da migracao caminhos_coerentes recusa o atalho', async () => {
    await expect(prisma.atividadeCasa.create({ data: {
      pacienteId: p.miguel, objetivoId: p.objetivoRascunho, titulo: 'Atalho', descricao: '', passos: ['Um.'], dicas: '',
      frequenciaSemanal: 1, ativa: true, prescritaEm: new Date(),
    } })).rejects.toThrow(/objetivo .* e de outro paciente/)
  })
})

describe('item 15b: para que serve e quem registrou', () => {
  it('a atividade traz o para que serve, a redacao acessivel do objetivo, em toda rota; a tecnica nunca vai a familia', async () => {
    const prescrita = await prescrever(c.ana, { titulo: 'Pedir com o cartão' })
    expect(prescrita.corpo.paraQue).toBe(OBJETIVO.descricaoAcessivel)
    const id = prescrita.corpo.id
    const daClinica = await api.pedir('GET', `/pacientes/${p.miguel}/atividades`, { cookie: c.ana })
    expect(daClinica.corpo.itens.map((a: { paraQue: string }) => a.paraQue)).toContain(OBJETIVO.descricaoAcessivel)

    // Tudo o que a familia recebe: a lista, a atividade, o registro, o historico e a encerrada.
    const daFamilia: unknown[] = []
    for (const quem of ['mae', 'pai']) {
      const lista = await api.pedir('GET', `/pacientes/${p.miguel}/atividades`, { cookie: c[quem] })
      expect(lista.corpo.itens.length, quem).toBeGreaterThan(0)
      for (const a of lista.corpo.itens) expect(a.paraQue, quem).toBe(OBJETIVO.descricaoAcessivel)
      const uma = await api.pedir('GET', `/atividades/${id}`, { cookie: c[quem] })
      expect(uma.corpo.paraQue, quem).toBe(OBJETIVO.descricaoAcessivel)
      daFamilia.push(lista.corpo, uma.corpo)
    }
    const registro = await registrar(c.mae, id)
    expect(registro.status, JSON.stringify(registro.corpo)).toBe(201)
    daFamilia.push(registro.corpo, (await api.pedir('GET', `/atividades/${id}/execucoes`, { cookie: c.pai })).corpo)
    const encerrada = await api.pedir('POST', `/atividades/${id}/encerramento`, { cookie: c.ana })
    expect(encerrada.corpo.paraQue).toBe(OBJETIVO.descricaoAcessivel)
    daFamilia.push((await api.pedir('GET', `/atividades/${id}`, { cookie: c.mae })).corpo)

    for (const resposta of daFamilia) {
      expect(JSON.stringify(resposta)).not.toContain(OBJETIVO.descricaoTecnica)
      expect(JSON.stringify(resposta)).not.toContain(OBJETIVO.dominio)
    }
  })

  it('cada execucao diz quem registrou, com o nome lido do usuario na hora, para a clinica e para a familia', async () => {
    const id = (await prescrever(c.ana, { titulo: 'Guardar os brinquedos' })).corpo.id
    const r = await registrar(c.pai, id)
    expect(r.corpo).toMatchObject({ responsavelId: u.pai, responsavelNome: 'Paulo Ficticio' })
    for (const quem of ['ana', 'coord', 'mae', 'pai']) {
      const historico = await api.pedir('GET', `/atividades/${id}/execucoes`, { cookie: c[quem] })
      expect(historico.corpo.itens.map((e: { responsavelNome: string }) => e.responsavelNome), quem).toEqual(['Paulo Ficticio'])
    }

    // O nome corrigido na rede de apoio vale ja na leitura seguinte: a execucao nao guarda copia.
    const editado = await api.pedir('PUT', `/pacientes/${p.miguel}/responsaveis/${u.pai}`, {
      cookie: c.ana, corpo: { nome: 'Paulo Ficticio Nogueira', telefone: '(92) 90000-0000', parentesco: 'Pai' },
    })
    expect(editado.status, JSON.stringify(editado.corpo)).toBe(200)
    const depois = await api.pedir('GET', `/atividades/${id}/execucoes`, { cookie: c.mae })
    expect(depois.corpo.itens[0].responsavelNome).toBe('Paulo Ficticio Nogueira')
    expect((await registrar(c.mae, id)).corpo.mensagem).toBe('Hoje já foi registrado por Paulo Ficticio Nogueira.')
  })
})
