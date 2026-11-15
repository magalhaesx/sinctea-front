import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { diaCivilEm, inicioDoDia } from '@sinctea/compartilhado/dominio/datas'
import { janelaPassada, somarDias } from '@sinctea/compartilhado/dominio/indicadores'
import type { PrismaClient } from '../src/gerado/client.js'
import { clienteDe, criarBancoMigrado } from './apoio/banco.js'
import { cookieDaSessao, criarUsuario, subirApi, type Api, type Resposta } from './apoio/api.js'

/**
 * Item 19: os indicadores da coordenacao, pela API, num banco que comeca
 * vazio. So a coordenacao alcanca; a janela conta dias de Manaus; so o plano
 * vigente gera alerta e revisao; paciente inativo fica fora; a escola conta
 * com vinculo ATIVO; a ponte corre do registro da escola; nenhum texto
 * clinico sai na resposta; e so os alertas deixam linha na trilha, sem
 * paciente.
 */

let prisma: PrismaClient
let api: Api
let apagar: () => Promise<void>
const u: Record<string, string> = {}
const c: Record<string, string> = {}
const p: Record<string, string> = {}

const HORA = 3_600_000
const DIA = 24 * HORA
const hoje = () => diaCivilEm(new Date())
const daqui = (n: number) => somarDias(hoje(), n)
const atras = (n: number) => new Date(Date.now() - n * DIA)
const OBJETIVO = {
  dominio: 'Comunicação', descricaoTecnica: 'Mando com figura em 8 de 10 oportunidades.', descricaoAcessivel: 'Pedir o que quer, apontando.',
  criterio: { percentualMinimo: 80, sessoesConsecutivas: 2 },
}
const MOTIVOS = ['PLANO_SEM_REVISAO', 'PACIENTE_SEM_SESSAO', 'CONSENTIMENTO_VENCENDO', 'OBJETIVO_SEM_AVANCO'] as const
const ROTAS = ['/indicadores/resumo', '/indicadores/alertas/PLANO_SEM_REVISAO', '/indicadores/sessoes-por-profissional', '/indicadores/ponte-escola']

const pedir = (caminho: string, cookie = c.coord) => api.pedir('GET', caminho, { cookie })
const alertas = async (motivo: string) => (await pedir(`/indicadores/alertas/${motivo}?porPagina=100`)).corpo
const resumo = async () => (await pedir('/indicadores/resumo')).corpo
const ponte = async () => (await pedir('/indicadores/ponte-escola')).corpo

async function linhasNovas(pedido: () => Promise<Resposta>) {
  const antes = (await prisma.registroAuditoria.findMany({ select: { id: true } })).map((x) => x.id)
  const r = await pedido()
  return { r, linhas: await prisma.registroAuditoria.findMany({ where: { id: { notIn: antes } } }) }
}

async function paciente(nome: string): Promise<string> {
  return (await api.pedir('POST', '/pacientes', {
    cookie: c.ana, corpo: { nome, dataNascimento: '2019-03-12', nivelSuporte: 2, profissionalResponsavelId: u.ana },
  })).corpo.id
}

/** Plano com objetivos, pela API; vigente quando a coordenacao aprova. Volta o plano e os objetivos. */
async function plano(pacienteId: string, objetivos: number, vigente: boolean) {
  const id = (await api.pedir('POST', `/pacientes/${pacienteId}/plano`, { cookie: c.ana, corpo: { dataInicio: hoje(), dataRevisao: daqui(10) } })).corpo.id
  const ids: string[] = []
  for (let i = 0; i < objetivos; i++) ids.push((await api.pedir('POST', `/planos/${id}/objetivos`, { cookie: c.ana, corpo: OBJETIVO })).corpo.id)
  if (vigente) {
    await api.pedir('POST', `/planos/${id}/envio`, { cookie: c.ana })
    expect((await api.pedir('POST', `/planos/${id}/aprovacao`, { cookie: c.coord })).corpo.status).toBe('VIGENTE')
  }
  return { id, objetivos: ids }
}

let numero = 0
/** Sessao gravada direto, com as tentativas de um objetivo; encerrada por padrao. */
async function sessao(pacienteId: string, inicio: Date, opcoes: { objetivoId?: string; resultados?: Array<'INDEPENDENTE' | 'AJUDA_FISICA'>; situacao?: 'ENCERRADA' | 'EM_ANDAMENTO' } = {}) {
  numero += 1
  const encerrada = (opcoes.situacao ?? 'ENCERRADA') === 'ENCERRADA'
  return (await prisma.sessao.create({ data: {
    pacienteId, profissionalId: u.ana, numero, inicioPrevistoEm: inicio, inicio, fim: encerrada ? new Date(inicio.getTime() + HORA) : null,
    local: 'Clínica', situacao: opcoes.situacao ?? 'ENCERRADA', statusSync: 'SINCRONIZADO', evolucao: encerrada ? 'Evolução fictícia.' : null,
    registros: { create: (opcoes.resultados ?? []).map((resultado, i) => ({ objetivoId: opcoes.objetivoId!, ordem: i + 1, resultado, ocorridoEm: inicio })) },
  } })).id
}

/** Nove sessoes de 60 a 52 dias atras: um recorde de 100% e oito de 50%. Oito sessoes sem novo recorde. */
async function serieParada(pacienteId: string, objetivoId: string) {
  await sessao(pacienteId, atras(60), { objetivoId, resultados: ['INDEPENDENTE'] })
  for (let d = 59; d >= 52; d--) await sessao(pacienteId, atras(d), { objetivoId, resultados: ['AJUDA_FISICA', 'INDEPENDENTE'] })
}

async function relatar(): Promise<{ escolar: string; gerada: string }> {
  const r = await api.pedir('POST', `/escola/alunos/${p.ana}/ocorrencias`, { cookie: c.carla, corpo: { tipo: 'Tapou os ouvidos', intensidade: 3, contexto: 'Recreio' } })
  expect(r.status, JSON.stringify(r.corpo)).toBe(201)
  const gerada = await prisma.ocorrenciaComportamental.findFirstOrThrow({ where: { ocorrenciaEscolarId: r.corpo.id } })
  return { escolar: r.corpo.id, gerada: gerada.id }
}

/** Registrada ha `dias` dias (e acontecida dez dias antes disso); lida `horas` depois do registro, ou nao lida. */
async function registradaHa(o: { escolar: string; gerada: string }, dias: number, horas: number | null) {
  const registradaEm = atras(dias)
  await prisma.ocorrenciaEscolar.update({ where: { id: o.escolar }, data: { registradaEm, ocorridoEm: new Date(registradaEm.getTime() - 10 * DIA) } })
  await prisma.ocorrenciaComportamental.update({
    where: { id: o.gerada }, data: { leituraClinicaEm: horas === null ? null : new Date(registradaEm.getTime() + horas * HORA) },
  })
}

beforeAll(async () => {
  const banco = await criarBancoMigrado(inject('urlAdministrativa'), 'sinctea_indicadores')
  apagar = banco.apagar
  prisma = clienteDe(banco.url)
  u.ana = await criarUsuario(prisma, { email: 'ana@teste.example', nome: 'Ana Souza', perfis: ['TERAPEUTA'] })
  u.coord = await criarUsuario(prisma, { email: 'coord@teste.example', nome: 'Caio Coordenador', perfis: ['COORDENADOR'] })
  u.admin = await criarUsuario(prisma, { email: 'admin@teste.example', nome: 'Zélia Administradora', perfis: ['ADMINISTRADOR'] })
  u.saiu = await criarUsuario(prisma, { email: 'saiu@teste.example', nome: 'Sávio Que Saiu', perfis: ['TERAPEUTA'], ativo: false })
  api = await subirApi(banco.url)
  for (const nome of ['ana', 'coord', 'admin']) c[nome] = await api.entrar(`${nome}@teste.example`)

  // Antes de tudo, o banco vazio: e o estado da producao.
  p.vazio = JSON.stringify(await resumo())

  // Ana Clara: plano vigente sem revisao ha 200 dias, revisao em 10 dias, um
  // objetivo parado, outro dominado ha 3 dias e as sessoes da borda da janela.
  p.ana = await paciente('Ana Clara Ficticia')
  const planoAna = await plano(p.ana, 2, true)
  p.planoAna = planoAna.id
  ;[p.o1, p.o1b] = planoAna.objetivos
  await prisma.planoTerapeutico.update({ where: { id: p.planoAna }, data: { dataInicio: inicioDoDia(somarDias(hoje(), -200)), ultimaRevisaoEm: null } })
  await prisma.objetivo.update({ where: { id: p.o1b }, data: { status: 'DOMINADO', dominadoEm: atras(3) } })
  // Pela API o objetivo nasce NAO_INICIADO; quem o passa a EM_AQUISICAO e o encerramento da sessao.
  await prisma.objetivo.update({ where: { id: p.o1 }, data: { status: 'EM_AQUISICAO' } })
  await serieParada(p.ana, p.o1)
  // A borda calculada a parte, sem a janela do dominio: hoje e os seis dias antes, em Manaus.
  const desde = inicioDoDia(diaCivilEm(new Date(Date.now() - 6 * DIA)))
  await sessao(p.ana, desde)                                                    // 00:00 do primeiro dia: dentro
  await sessao(p.ana, new Date(desde.getTime() - 30 * 60_000))                  // 23h30 do dia anterior: fora
  await sessao(p.ana, new Date(Date.now() - HORA), { situacao: 'EM_ANDAMENTO' }) // em andamento: nao conta

  // Bruno: nunca teve sessao. Caio: a ultima encerrada, ha 40 dias; a de agora,
  // em andamento, nao conta como a ultima.
  p.bruno = await paciente('Bruno Ficticio')
  p.caio = await paciente('Caio Ficticio')
  await sessao(p.caio, atras(40))
  await sessao(p.caio, new Date(Date.now() - HORA), { situacao: 'EM_ANDAMENTO' })

  // Davi: plano em rascunho, com tudo que geraria alerta e revisao se valesse.
  p.davi = await paciente('Davi Ficticio')
  const planoDavi = await plano(p.davi, 1, false)
  p.planoDavi = planoDavi.id
  p.o4 = planoDavi.objetivos[0]
  await prisma.planoTerapeutico.update({ where: { id: p.planoDavi }, data: { dataInicio: inicioDoDia(somarDias(hoje(), -200)), dataRevisao: inicioDoDia(daqui(5)) } })
  await prisma.objetivo.update({ where: { id: p.o4 }, data: { status: 'EM_AQUISICAO' } })
  await serieParada(p.davi, p.o4)

  // Eva: inativa, com plano vigente velho, revisao em 5 dias, objetivo
  // dominado ha 3 dias e consentimento vencendo — nada dela conta.
  p.eva = await paciente('Eva Ficticia')
  const planoEva = await plano(p.eva, 1, true)
  await prisma.planoTerapeutico.update({
    where: { id: planoEva.id },
    data: { dataInicio: inicioDoDia(somarDias(hoje(), -200)), dataRevisao: inicioDoDia(daqui(5)), ultimaRevisaoEm: null },
  })
  await prisma.objetivo.update({ where: { id: planoEva.objetivos[0] }, data: { status: 'DOMINADO', dominadoEm: atras(3) } })

  // A familia da Ana Clara, a escola e a professora do convite: o vinculo ATIVO.
  const mae = await api.pedir('POST', `/pacientes/${p.ana}/responsaveis`, {
    cookie: c.ana, corpo: { nome: 'Patrícia Ficticia', email: 'mae@teste.example', telefone: '(92) 90000-0000', parentesco: 'Mãe', responsavelLegal: true },
  })
  await api.pedir('POST', `/auth/primeiro-acesso/${mae.corpo.primeiroAcesso.token}`, { corpo: { senha: 'senha-da-mae-1' } })
  c.mae = await api.entrar('mae@teste.example', 'senha-da-mae-1')
  u.mae = mae.corpo.responsavel.responsavelId
  const escola = await api.pedir('POST', '/escolas', { cookie: c.mae, corpo: { nome: 'Escola Municipal Vitória-Régia', rede: 'Municipal', municipio: 'Manaus' } })
  const outra = await api.pedir('POST', '/escolas', { cookie: c.mae, corpo: { nome: 'Escola Estadual Rio Negro', rede: 'Estadual', municipio: 'Manaus' } })
  const consentimento = await api.pedir('POST', '/consentimentos', {
    cookie: c.mae, corpo: { pacienteId: p.ana, escolaId: escola.corpo.id, escopos: ['CARTAO_ESTRATEGIA', 'REGISTRO_OCORRENCIA'], validadeAte: daqui(20) },
  })
  expect(consentimento.status, JSON.stringify(consentimento.corpo)).toBe(201)
  p.consentimentoAna = consentimento.corpo.consentimento.id
  const carla = await api.pedir('POST', `/convites/${consentimento.corpo.tokenConvite}/aceite`, {
    corpo: { nome: 'Carla Professora', email: 'carla@escola.example', senha: 'senha-da-carla', turma: '2º ano A', turno: 'Matutino', atuacao: 'Regente' },
  })
  expect(carla.status, JSON.stringify(carla.corpo)).toBe(200)
  c.carla = cookieDaSessao(carla)

  // Consentimentos gravados direto: o do Caio vence em 5 dias, sem vinculo; o
  // da Eva vence em 3, mas ela esta inativa; o do Bruno foi revogado.
  const termo = (pacienteId: string, escolaId: string, validadeAte: string, revogadoEm: Date | null = null) => prisma.consentimento.create({ data: {
    responsavelId: u.mae, pacienteId, escolaId, escopos: ['CARTAO_ESTRATEGIA'], concedidoEm: atras(10),
    validadeAte: inicioDoDia(validadeAte), revogadoEm, hashTermo: 'sha256:1:ficticio',
  } })
  p.consentimentoCaio = (await termo(p.caio, outra.corpo.id, daqui(5))).id
  await termo(p.eva, escola.corpo.id, daqui(3))
  await termo(p.bruno, outra.corpo.id, daqui(2), new Date(Date.now() - HORA))

  // A escola relata quatro vezes. Duas lidas (2 h e 26 h depois do registro),
  // uma esperando e uma esperando ha 40 dias, fora da janela. A de 25 dias
  // aconteceu ha 35: esta na janela pelo registro, e nao estaria pelo fato.
  const [o1, o2, o3, o4] = [await relatar(), await relatar(), await relatar(), await relatar()]
  await registradaHa(o1, 5, 2)
  await registradaHa(o2, 25, 26)
  await registradaHa(o3, 3, null)
  await registradaHa(o4, 40, null)
  p.terceira = JSON.stringify(o3)

  await prisma.paciente.update({ where: { id: p.eva }, data: { ativo: false } })
}, 120_000)

afterAll(async () => {
  await api?.fechar()
  await prisma?.$disconnect()
  await apagar?.()
})

describe('quem alcanca', () => {
  it('so a coordenacao; os demais recebem 403 nas quatro rotas, e a negativa fica na trilha', async () => {
    const rotas = [...ROTAS.slice(0, 1), ...MOTIVOS.map((m) => `/indicadores/alertas/${m}`), ...ROTAS.slice(2)]
    for (const quem of ['ana', 'mae', 'carla', 'admin']) {
      for (const rota of rotas) {
        const { r, linhas } = await linhasNovas(() => pedir(rota, c[quem]))
        expect(r.status, `${quem} ${rota}`).toBe(403)
        expect(linhas, `${quem} ${rota}`).toHaveLength(1)
        expect(linhas[0], `${quem} ${rota}`).toMatchObject({ acao: 'ACESSO_NEGADO', entidade: 'Indicadores', pacienteId: null })
      }
    }
    for (const rota of rotas) expect((await pedir(rota)).status, rota).toBe(200)
  })

  it('motivo desconhecido e recusado', async () => {
    expect((await pedir('/indicadores/alertas/QUALQUER')).status).toBe(422)
  })
})

describe('os numeros', () => {
  it('no banco vazio, temDados e falso e tudo e zero', () => {
    const vazio = JSON.parse(p.vazio)
    expect(vazio.temDados).toBe(false)
    expect([vazio.pacientesEmAcompanhamento, vazio.sessoesUltimos7Dias, vazio.objetivosDominadosUltimos30Dias, vazio.planosComRevisaoProximos30Dias]
      .map((i: { valor: number }) => i.valor)).toEqual([0, 0, 0, 0])
  })

  it('pacientes ativos; sessoes encerradas na janela de Manaus; dominados de ativos; revisoes so do plano vigente de ativo', async () => {
    const r = await resumo()
    expect(r.temDados).toBe(true)
    // Ana Clara, Bruno, Caio e Davi; a Eva esta inativa.
    expect(r.pacientesEmAcompanhamento.valor).toBe(4)
    // So a das 00:00 do primeiro dia: a das 23h30 do dia anterior e a em andamento ficam fora.
    expect(r.sessoesUltimos7Dias.valor).toBe(1)
    // O da Ana Clara; o da Eva, inativa, nao.
    expect(r.objetivosDominadosUltimos30Dias.valor).toBe(1)
    // O vigente da Ana Clara; o rascunho do Davi e o da Eva, inativa, nao.
    expect(r.planosComRevisaoProximos30Dias.valor).toBe(1)
    const semana = janelaPassada(new Date(), 7)
    expect(r.sessoesUltimos7Dias.periodo).toContain(`${semana.ultimoDia.slice(8, 10)}/${semana.ultimoDia.slice(5, 7)})`)
    expect(r.planosComRevisaoProximos30Dias.periodo).toMatch(/^nos próximos 30 dias \(/)
    expect(r.pacientesEmAcompanhamento.periodo).toBe(`em ${hoje().slice(8, 10)}/${hoje().slice(5, 7)}`)
  })

  it('sessoes por profissional em 30 dias: so quem atende; quem saiu sem sessao nao aparece', async () => {
    const r = (await pedir('/indicadores/sessoes-por-profissional')).corpo
    // As duas da borda da semana estao nos 30 dias; a do Caio, de 40, nao.
    expect(r.itens).toEqual([{ profissional: { id: u.ana, nome: 'Ana Souza' }, sessoes: 2 }])
    // A coordenacao e a administracao tem dados profissionais, mas nao atendem;
    // quem saiu nao conduziu sessao na janela.
    for (const fora of [u.coord, u.admin, u.saiu]) {
      expect(r.itens.map((i: { profissional: { id: string } }) => i.profissional.id)).not.toContain(fora)
    }
    const sessoes = r.itens.map((i: { sessoes: number }) => i.sessoes)
    expect(sessoes).toEqual([...sessoes].sort((a, b) => b - a))
  })
})

describe('os alertas', () => {
  it('plano sem revisao e objetivo parado so no plano vigente, e paciente inativo fica fora', async () => {
    const planos = await alertas('PLANO_SEM_REVISAO')
    expect(planos.itens).toEqual([{ motivo: 'PLANO_SEM_REVISAO', paciente: { id: p.ana, nome: 'Ana Clara Ficticia' }, referenciaId: p.planoAna, quantidade: 200, unidade: 'dias' }])
    const parados = await alertas('OBJETIVO_SEM_AVANCO')
    expect(parados.itens).toEqual([{ motivo: 'OBJETIVO_SEM_AVANCO', paciente: { id: p.ana, nome: 'Ana Clara Ficticia' }, referenciaId: p.o1, quantidade: 8, unidade: 'sessoes' }])
  })

  it('paciente sem sessao: quem nunca teve vem no topo, pela ultima ENCERRADA, sem o inativo', async () => {
    const itens = (await alertas('PACIENTE_SEM_SESSAO')).itens
    expect(itens.map((a: { paciente: { id: string } }) => a.paciente.id)).toEqual([p.bruno, p.davi, p.caio])
    expect(itens.map((a: { quantidade: number | null }) => a.quantidade)).toEqual([null, 52, 40])
  })

  it('consentimento: so o vigente e nao revogado de paciente ativo, o que vence antes primeiro', async () => {
    const itens = (await alertas('CONSENTIMENTO_VENCENDO')).itens
    expect(itens.map((a: { referenciaId: string; quantidade: number }) => [a.referenciaId, a.quantidade]))
      .toEqual([[p.consentimentoCaio, 5], [p.consentimentoAna, 20]])
  })

  it('a pagina corta no servidor e conta o total', async () => {
    const r = (await pedir('/indicadores/alertas/PACIENTE_SEM_SESSAO?porPagina=1&pagina=2')).corpo
    expect(r).toMatchObject({ total: 3, pagina: 2, porPagina: 1 })
    expect(r.itens.map((a: { paciente: { id: string } }) => a.paciente.id)).toEqual([p.davi])
  })
})

describe('a ponte com a escola', () => {
  it('a escola conta com vinculo ATIVO e consentimento vigente; o vinculo ENCERRADO e a revogacao tiram a escola', async () => {
    // A da Ana Clara, com a professora; a do Caio tem consentimento, mas nenhum vinculo.
    expect((await ponte()).escolasComVinculoAtivo.valor).toBe(1)
    await prisma.vinculoEscolar.updateMany({ data: { status: 'ENCERRADO' } })
    try {
      expect((await ponte()).escolasComVinculoAtivo.valor).toBe(0)
    } finally {
      await prisma.vinculoEscolar.updateMany({ data: { status: 'ATIVO' } })
    }
    // A familia encerra o acesso: o vinculo continua ATIVO, mas a ponte acabou.
    await prisma.consentimento.update({ where: { id: p.consentimentoAna }, data: { revogadoEm: new Date(Date.now() - HORA) } })
    try {
      expect((await ponte()).escolasComVinculoAtivo.valor).toBe(0)
    } finally {
      await prisma.consentimento.update({ where: { id: p.consentimentoAna }, data: { revogadoEm: null } })
    }
  })

  it('a janela e o tempo correm do registro; mediana nula com 2 leituras e calculada com 3; aguardando sem recorte', async () => {
    const antes = await ponte()
    // As de 5, 25 e 3 dias; a de 40 fica fora.
    expect(antes.ocorrenciasUltimos30Dias.valor).toBe(3)
    expect(antes.tempoAteLeituraClinica).toMatchObject({ medianaHoras: null, leituras: 2 })
    expect(antes.aguardandoLeitura).toEqual({ quantidade: 2, maisAntigaHaDias: 40 })

    // A terceira e lida 72 h depois do registro: 2, 26 e 72 dao 26 — e nao os
    // 240 h a mais que daria contar de quando aconteceu.
    await registradaHa(JSON.parse(p.terceira), 3, 72)
    const depois = await ponte()
    expect(depois.tempoAteLeituraClinica).toMatchObject({ medianaHoras: 26, leituras: 3 })
    expect(depois.aguardandoLeitura).toEqual({ quantidade: 1, maisAntigaHaDias: 40 })
  })
})

describe('conta e aponta, nao descreve', () => {
  const PERMITIDAS = new Set([
    'temDados', 'pacientesEmAcompanhamento', 'sessoesUltimos7Dias', 'objetivosDominadosUltimos30Dias', 'planosComRevisaoProximos30Dias',
    'valor', 'periodo', 'itens', 'total', 'pagina', 'porPagina', 'motivo', 'paciente', 'id', 'nome', 'referenciaId', 'quantidade',
    'unidade', 'profissional', 'sessoes', 'escolasComVinculoAtivo', 'ocorrenciasUltimos30Dias', 'tempoAteLeituraClinica',
    'medianaHoras', 'leituras', 'aguardandoLeitura', 'maisAntigaHaDias',
  ])
  const chaves = (v: unknown): string[] => Array.isArray(v) ? v.flatMap(chaves)
    : v !== null && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => [k, ...chaves(x)]) : []

  it('nenhuma chave de texto clinico na resposta, e nenhum texto do banco', async () => {
    const respostas = [await resumo(), ...await Promise.all(MOTIVOS.map(alertas)), (await pedir('/indicadores/sessoes-por-profissional')).corpo, await ponte()]
    for (const r of respostas) {
      for (const chave of chaves(r)) expect(PERMITIDAS.has(chave), chave).toBe(true)
      const texto = JSON.stringify(r)
      for (const clinico of [OBJETIVO.descricaoTecnica, OBJETIVO.descricaoAcessivel, OBJETIVO.dominio, 'Evolução fictícia.', 'Tapou os ouvidos', 'Recreio']) {
        expect(texto, clinico).not.toContain(clinico)
      }
    }
  })
})

describe('a trilha', () => {
  it('os alertas deixam uma linha por chamada, sem paciente; os outros tres nao gravam leitura', async () => {
    for (const motivo of MOTIVOS) {
      const { linhas } = await linhasNovas(() => pedir(`/indicadores/alertas/${motivo}`))
      expect(linhas).toHaveLength(1)
      // O motivo vai no detalhe: a coluna idEntidade e uuid.
      expect(linhas[0]).toMatchObject({
        acao: 'LEITURA_AUTORIZADA', entidade: 'Indicadores', idEntidade: null, usuarioId: u.coord, pacienteId: null,
        detalhe: `Alertas do painel da coordenação: ${motivo}.`,
      })
    }
    for (const rota of ['/indicadores/resumo', '/indicadores/sessoes-por-profissional', '/indicadores/ponte-escola']) {
      const { r, linhas } = await linhasNovas(() => pedir(rota))
      expect(r.status, rota).toBe(200)
      expect(linhas, rota).toHaveLength(0)
    }
  })

  it('a coordenacao abre cada destino pela API, e a abertura fica na trilha com o paciente', async () => {
    // plano -> tela 6; paciente e consentimento -> ficha (tela 5); objetivo -> tela 8.
    for (const [rota, pacienteId] of [
      [`/pacientes/${p.ana}/plano`, p.ana], [`/pacientes/${p.bruno}`, p.bruno],
      [`/pacientes/${p.caio}`, p.caio], [`/objetivos/${p.o1}/evolucao`, p.ana],
    ]) {
      const { r, linhas } = await linhasNovas(() => pedir(rota))
      expect(r.status, rota).toBe(200)
      expect(linhas.length, rota).toBeGreaterThan(0)
      expect(linhas.every((l) => l.pacienteId === pacienteId && l.usuarioId === u.coord), rota).toBe(true)
    }
  })
})
