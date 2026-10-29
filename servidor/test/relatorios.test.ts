import { createHash } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { diaCivilEm, inicioDoDia } from '@sinctea/compartilhado/dominio/datas'
import { jsonCanonico, resumoSha256 } from '@sinctea/compartilhado/dominio/hash'
import type { PrismaClient } from '../src/gerado/client.js'
import { clienteDe, criarBancoMigrado } from './apoio/banco.js'
import { cookieDaSessao, criarUsuario, subirApi, type Api, type Resposta } from './apoio/api.js'

/**
 * Item 18: o relatorio de evolucao, pela API, num banco que comeca vazio. So
 * a equipe do paciente e a coordenacao; a emissao exige o registro no
 * conselho e o plano vigente; o emitido e o texto canonico exato, com o seu
 * sha256, e nao muda; toda operacao deixa uma linha na trilha.
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
const DIA = 86_400_000
const hoje = () => diaCivilEm(new Date())
const diasAtras = (n: number) => diaCivilEm(new Date(Date.now() - n * DIA))
const em90dias = () => diaCivilEm(new Date(Date.now() + 90 * DIA))

const pedido = (mudanca: Record<string, unknown> = {}) => ({
  periodoInicio: diasAtras(10), periodoFim: diasAtras(1), objetivoIds: [p.o1], destinatario: 'PROFISSIONAIS',
  consideracoes: 'Leitura do período, escrita pela profissional.', ...mudanca,
})
const previa = (cookie: string, mudanca: Record<string, unknown> = {}, paciente = p.miguel) =>
  api.pedir('POST', `/pacientes/${paciente}/relatorios/previa`, { cookie, corpo: pedido(mudanca) })
const emitir = (cookie: string, mudanca: Record<string, unknown> = {}, paciente = p.miguel) =>
  api.pedir('POST', `/pacientes/${paciente}/relatorios`, { cookie, corpo: pedido(mudanca) })

async function comUmaLinha(pedido: () => Promise<Resposta>) {
  const antes = (await prisma.registroAuditoria.findMany({ select: { id: true } })).map((x) => x.id)
  const r = await pedido()
  const linhas = await prisma.registroAuditoria.findMany({ where: { id: { notIn: antes } } })
  expect(linhas, JSON.stringify(r.corpo)).toHaveLength(1)
  return { r, linha: linhas[0] }
}
const linhasDaTrilha = () => prisma.registroAuditoria.count()

let numero = 100
/** Uma sessao encerrada do Miguel, gravada direto, comecando no instante dado, com estas tentativas do o1. */
async function sessaoEm(inicio: Date, resultados: Array<'INDEPENDENTE' | 'AJUDA_FISICA'>) {
  numero += 1
  const s = await prisma.sessao.create({ data: {
    pacienteId: p.miguel, profissionalId: u.ana, numero, inicioPrevistoEm: inicio, inicio, fim: new Date(inicio.getTime() + 3_600_000),
    local: 'Clínica', situacao: 'ENCERRADA', statusSync: 'SINCRONIZADO', evolucao: 'Evolução fictícia.',
    registros: { create: resultados.map((resultado, i) => ({ objetivoId: p.o1, ordem: i + 1, resultado, ocorridoEm: inicio })) },
  } })
  return s.id
}

beforeAll(async () => {
  const banco = await criarBancoMigrado(inject('urlAdministrativa'), 'sinctea_relatorios')
  apagar = banco.apagar
  prisma = clienteDe(banco.url)
  u.ana = await criarUsuario(prisma, { email: 'ana@teste.example', nome: 'Ana Souza', perfis: ['TERAPEUTA'] })
  u.bruno = await criarUsuario(prisma, { email: 'bruno@teste.example', nome: 'Bruno Lima', perfis: ['TERAPEUTA'] })
  u.sem = await criarUsuario(prisma, { email: 'sem@teste.example', nome: 'Sara Sem Registro', perfis: ['TERAPEUTA'] })
  await prisma.profissional.update({ where: { usuarioId: u.sem }, data: { registroConselho: '' } })
  u.coord = await criarUsuario(prisma, { email: 'coord@teste.example', nome: 'Caio Coordenador', perfis: ['COORDENADOR'] })
  u.admin = await criarUsuario(prisma, { email: 'admin@teste.example', nome: 'Zélia Administradora', perfis: ['ADMINISTRADOR'] })
  api = await subirApi(banco.url)
  for (const nome of ['ana', 'bruno', 'sem', 'coord', 'admin']) c[nome] = await api.entrar(`${nome}@teste.example`)

  // Miguel, da Ana e da Sara, com plano vigente; Laura, da Ana, com o plano em rascunho.
  p.miguel = (await api.pedir('POST', '/pacientes', {
    cookie: c.ana, corpo: { nome: 'Miguel Ficticio Santana', dataNascimento: '2019-03-12', nivelSuporte: 2, profissionalResponsavelId: u.ana },
  })).corpo.id
  await prisma.equipePaciente.create({ data: { pacienteId: p.miguel, profissionalId: u.sem } })
  const plano = (await api.pedir('POST', `/pacientes/${p.miguel}/plano`, { cookie: c.ana, corpo: { dataInicio: '2026-01-01', dataRevisao: '2027-04-01' } })).corpo.id
  p.o1 = (await api.pedir('POST', `/planos/${plano}/objetivos`, { cookie: c.ana, corpo: OBJETIVO })).corpo.id
  await api.pedir('POST', `/planos/${plano}/envio`, { cookie: c.ana })
  expect((await api.pedir('POST', `/planos/${plano}/aprovacao`, { cookie: c.coord })).corpo.status).toBe('VIGENTE')

  p.laura = (await api.pedir('POST', '/pacientes', {
    cookie: c.ana, corpo: { nome: 'Laura Ficticia Reis', dataNascimento: '2020-06-01', nivelSuporte: 1, profissionalResponsavelId: u.ana },
  })).corpo.id
  const planoLaura = (await api.pedir('POST', `/pacientes/${p.laura}/plano`, { cookie: c.ana, corpo: { dataInicio: '2026-01-01', dataRevisao: '2027-04-01' } })).corpo.id
  p.oLaura = (await api.pedir('POST', `/planos/${planoLaura}/objetivos`, { cookie: c.ana, corpo: OBJETIVO })).corpo.id

  // A mae e a professora, para as negativas.
  const mae = await api.pedir('POST', `/pacientes/${p.miguel}/responsaveis`, {
    cookie: c.ana, corpo: { nome: 'Patrícia Ficticia', email: 'mae@teste.example', telefone: '(92) 90000-0000', parentesco: 'Mãe', responsavelLegal: true },
  })
  await api.pedir('POST', `/auth/primeiro-acesso/${mae.corpo.primeiroAcesso.token}`, { corpo: { senha: 'senha-da-familia-1' } })
  c.mae = await api.entrar('mae@teste.example', 'senha-da-familia-1')
  u.mae = mae.corpo.responsavel.responsavelId
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

  // Sessoes: uma de cinco dias atras (50%), uma as 21h de Manaus de ontem (100%) e uma as 00h30 de hoje.
  await sessaoEm(new Date(inicioDoDia(diasAtras(5)).getTime() + 10 * 3_600_000), ['INDEPENDENTE', 'AJUDA_FISICA'])
  p.as21h = await sessaoEm(new Date(inicioDoDia(diasAtras(1)).getTime() + 21 * 3_600_000), ['INDEPENDENTE'])
  await sessaoEm(new Date(inicioDoDia(hoje()).getTime() + 0.5 * 3_600_000), ['AJUDA_FISICA'])
})

afterAll(async () => {
  await api?.fechar()
  await prisma?.$disconnect()
  await apagar?.()
})

describe('quem alcanca', () => {
  it('professor, responsavel e administrador nunca, nas quatro rotas; a negativa fica na trilha', async () => {
    const relatorio = (await emitir(c.ana)).corpo.id
    for (const quem of ['carla', 'mae', 'admin']) {
      for (const [metodo, caminho] of [
        ['POST', `/pacientes/${p.miguel}/relatorios/previa`], ['POST', `/pacientes/${p.miguel}/relatorios`],
        ['GET', `/pacientes/${p.miguel}/relatorios`], ['GET', `/relatorios/${relatorio}`],
      ]) {
        const { r, linha } = await comUmaLinha(() => api.pedir(metodo, caminho, { cookie: c[quem], corpo: metodo === 'POST' ? pedido() : undefined }))
        expect(r.status, `${quem} ${caminho}`).toBe(403)
        expect(linha, `${quem} ${caminho}`).toMatchObject({ acao: 'ACESSO_NEGADO', entidade: 'RelatorioEvolucao', usuarioId: u[quem] })
      }
    }
  })

  it('o profissional fora da equipe e negado, com o paciente na trilha', async () => {
    const relatorio = (await emitir(c.ana)).corpo.id
    for (const pedidoDele of [
      () => previa(c.bruno), () => emitir(c.bruno), () => api.pedir('GET', `/pacientes/${p.miguel}/relatorios`, { cookie: c.bruno }),
      () => api.pedir('GET', `/relatorios/${relatorio}`, { cookie: c.bruno }),
    ]) {
      const { r, linha } = await comUmaLinha(pedidoDele)
      expect(r.status).toBe(403)
      expect(linha).toMatchObject({ acao: 'ACESSO_NEGADO', pacienteId: p.miguel, usuarioId: u.bruno })
    }
  })

  it('a lista de um paciente nao traz o relatorio de outro', async () => {
    expect((await emitir(c.ana)).status).toBe(201)
    const daLaura = await api.pedir('GET', `/pacientes/${p.laura}/relatorios`, { cookie: c.ana })
    expect(daLaura.status).toBe(200)
    expect(daLaura.corpo).toMatchObject({ total: 0, itens: [] })
  })
})

describe('o pedido', () => {
  it('sem registro no conselho, nada se emite', async () => {
    const antes = await prisma.relatorioEvolucao.count()
    const r = await emitir(c.sem)
    expect(r.status).toBe(409)
    expect(r.corpo.mensagem).toBe('Complete o seu registro no conselho em Perfil e preferências antes de emitir um relatório.')
    expect(await prisma.relatorioEvolucao.count()).toBe(antes)
    // A previa nao assina nada: sai mesmo sem o registro.
    expect((await previa(c.sem)).status).toBe(200)
  })

  it('sem plano vigente, nem previa nem emissao', async () => {
    for (const r of [await previa(c.ana, { objetivoIds: [p.oLaura] }, p.laura), await emitir(c.ana, { objetivoIds: [p.oLaura] }, p.laura)]) {
      expect(r.status).toBe(409)
      expect(r.corpo.mensagem).toBe('Para emitir, o paciente precisa de um plano vigente.')
    }
  })

  it('objetivo de outro paciente e recusado no campo', async () => {
    const r = await emitir(c.ana, { objetivoIds: [p.o1, p.oLaura] })
    expect(r.status).toBe(422)
    expect(r.corpo.campos.objetivoIds).toBeTruthy()
  })

  it('periodo invertido e no futuro sao recusados', async () => {
    for (const mudanca of [{ periodoInicio: diasAtras(1), periodoFim: diasAtras(2) }, { periodoFim: diaCivilEm(new Date(Date.now() + DIA)) }]) {
      for (const r of [await previa(c.ana, mudanca), await emitir(c.ana, mudanca)]) {
        expect(r.status, JSON.stringify(mudanca)).toBe(422)
        expect(Object.keys(r.corpo.campos)).toEqual(['periodo'])
      }
    }
    // Hoje vale.
    expect((await previa(c.ana, { periodoFim: hoje() })).status).toBe(200)
  })

  it('consideracoes vazias nao emitem; longas demais nem emitem nem pre-visualizam', async () => {
    expect((await emitir(c.ana, { consideracoes: '   ' })).corpo.campos.consideracoes).toBeTruthy()
    expect((await previa(c.ana, { consideracoes: '   ' })).status).toBe(200)
    for (const r of [await emitir(c.ana, { consideracoes: 'x'.repeat(4001) }), await previa(c.ana, { consideracoes: 'x'.repeat(4001) })]) {
      expect(r.status).toBe(422)
      expect(Object.keys(r.corpo.campos)).toEqual(['consideracoes'])
    }
    expect((await emitir(c.ana, { consideracoes: 'x'.repeat(4000) })).status).toBe(201)
  })
})

describe('o conteudo', () => {
  it('a sessao das 21h de Manaus no ultimo dia do periodo entra; a das 00h30 do dia seguinte, nao', async () => {
    const r = await previa(c.ana)
    expect(r.status, JSON.stringify(r.corpo)).toBe(200)
    expect(r.corpo.sessoesNoPeriodo).toBe(2)
    expect(r.corpo.objetivos[0]).toMatchObject({ sessoesNoPeriodo: 2, periodoTexto: 'primeiro 50% · último 100% · melhor 100%' })
    // So o ultimo dia: a das 21h, sozinha.
    expect((await previa(c.ana, { periodoInicio: diasAtras(1) })).corpo.sessoesNoPeriodo).toBe(1)
  })

  it('para a familia: a redacao acessivel e numeros em palavras, sem percentual nem a redacao tecnica', async () => {
    const r = await previa(c.ana, { destinatario: 'FAMILIA' })
    expect(r.corpo.objetivos[0].redacao).toBe(OBJETIVO.descricaoAcessivel)
    expect(JSON.stringify(r.corpo)).not.toContain(OBJETIVO.descricaoTecnica)
    expect(JSON.stringify(r.corpo.objetivos)).not.toMatch(/\d+ ?%/)
    const equipe = await previa(c.ana)
    expect(equipe.corpo.objetivos[0].redacao).toBe(OBJETIVO.descricaoTecnica)
    expect(equipe.corpo.objetivos[0].criterioTexto).toBe('80% em 2 sessões consecutivas')
  })
})

describe('o emitido', () => {
  it('e o texto canonico exato, com o sha256 desse texto; obter devolve o que a tela 10b confere', async () => {
    const r = await emitir(c.coord, { destinatario: 'FAMILIA' })
    expect(r.status, JSON.stringify(r.corpo)).toBe(201)
    expect(r.corpo).toMatchObject({ autorNome: 'Caio Coordenador', autorRegistro: 'CRFa 0000-FICT', destinatario: 'FAMILIA' })
    const linha = await prisma.relatorioEvolucao.findUniqueOrThrow({ where: { id: r.corpo.id } })
    expect(linha.hashConteudo).toBe(`sha256:${createHash('sha256').update(linha.conteudoEmitido, 'utf8').digest('hex')}`)
    const obtido = await api.pedir('GET', `/relatorios/${r.corpo.id}`, { cookie: c.ana })
    expect(obtido.status).toBe(200)
    expect(jsonCanonico(obtido.corpo.conteudoEmitido)).toBe(linha.conteudoEmitido)
    // A conferencia da tela 10b: o resumo recalculado sobre o que o servidor devolve.
    expect(await resumoSha256(obtido.corpo.conteudoEmitido)).toBe(obtido.corpo.hashConteudo)
  })

  it('uma sessao nova no periodo muda a previa, mas nao o emitido', async () => {
    const emitido = (await emitir(c.ana)).corpo
    const previaAntes = (await previa(c.ana)).corpo
    await sessaoEm(new Date(inicioDoDia(diasAtras(3)).getTime() + 15 * 3_600_000), ['INDEPENDENTE'])
    const previaDepois = (await previa(c.ana)).corpo
    expect(previaDepois.sessoesNoPeriodo).toBe(previaAntes.sessoesNoPeriodo + 1)
    const obtido = (await api.pedir('GET', `/relatorios/${emitido.id}`, { cookie: c.ana })).corpo
    expect(obtido.conteudoEmitido).toEqual(emitido.conteudoEmitido)
    expect(obtido.hashConteudo).toBe(emitido.hashConteudo)
  })

  it('o banco recusa UPDATE e DELETE no emitido, e nao ha rota de editar nem de excluir', async () => {
    const { id } = await prisma.relatorioEvolucao.findFirstOrThrow()
    await expect(prisma.$executeRaw`UPDATE "relatorio_evolucao" SET "consideracoes" = 'Outra.' WHERE "id" = ${id}::uuid`).rejects.toThrow(/imutavel/)
    await expect(prisma.$executeRaw`DELETE FROM "relatorio_evolucao" WHERE "id" = ${id}::uuid`).rejects.toThrow(/imutavel/)
    for (const metodo of ['PUT', 'PATCH', 'DELETE']) {
      expect((await api.pedir(metodo, `/relatorios/${id}`, { cookie: c.ana, corpo: metodo === 'DELETE' ? undefined : { consideracoes: 'Outra.' } })).status, metodo).toBe(404)
    }
  })

  it('id que nao existe ou nao e uuid: 404', async () => {
    for (const id of ['nao-e-uuid', '00000000-0000-7000-8000-000000000000']) {
      expect((await api.pedir('GET', `/relatorios/${id}`, { cookie: c.ana })).status).toBe(404)
    }
  })
})

describe('a trilha', () => {
  it('uma linha por operacao, todas com o paciente', async () => {
    const p1 = await comUmaLinha(() => previa(c.ana))
    expect(p1.linha).toMatchObject({ acao: 'LEITURA_AUTORIZADA', entidade: 'RelatorioEvolucao', pacienteId: p.miguel, detalhe: 'Prévia do relatório de evolução.' })
    const e = await comUmaLinha(() => emitir(c.ana))
    expect(e.linha).toMatchObject({ acao: 'CRIACAO', entidade: 'RelatorioEvolucao', idEntidade: e.r.corpo.id, pacienteId: p.miguel, detalhe: 'Relatório emitido para a equipe.' })
    const l = await comUmaLinha(() => api.pedir('GET', `/pacientes/${p.miguel}/relatorios?porPagina=5`, { cookie: c.ana }))
    expect(l.r.corpo.itens.length).toBeLessThanOrEqual(5)
    expect(l.r.corpo.itens[0].id).toBe(e.r.corpo.id)
    expect(l.linha).toMatchObject({ acao: 'LEITURA_AUTORIZADA', entidade: 'RelatorioEvolucao', pacienteId: p.miguel })
    const o = await comUmaLinha(() => api.pedir('GET', `/relatorios/${e.r.corpo.id}`, { cookie: c.ana }))
    expect(o.linha).toMatchObject({ acao: 'LEITURA_AUTORIZADA', idEntidade: e.r.corpo.id, pacienteId: p.miguel })
  })

  it('a recusa por validacao nao deixa linha', async () => {
    const antes = await linhasDaTrilha()
    await emitir(c.ana, { consideracoes: '' })
    expect(await linhasDaTrilha()).toBe(antes)
  })
})
