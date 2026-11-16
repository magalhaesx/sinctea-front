import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest'
import { instanteEmManaus } from '@sinctea/compartilhado/dominio/agenda'
import { diaCivilEm, emDataCivil, somarDias } from '@sinctea/compartilhado/dominio/datas'
import type { PrismaClient } from '../src/gerado/client.js'
import { clienteDe, criarBancoMigrado } from './apoio/banco.js'
import { criarUsuario, subirApi, type Api } from './apoio/api.js'

/**
 * Item 19b: o agendamento, pela API, num banco que comeca vazio. Quem agenda
 * e quem vai conduzir; o banco recusa o mesmo horario e o mesmo dia de Manaus
 * com dois indices unicos parciais, inclusive em corrida; so o dono cancela,
 * e so a agendada; o agendamento so se inicia no dia dele; o numero nasce no
 * inicio, na ordem em que as sessoes comecaram, e o cancelado nao gasta
 * numero. Agendar e cancelar nao contam em indicador, evolucao, relatorio nem
 * no "paciente sem sessao". Tudo entra na trilha (regra 6).
 */

let prisma: PrismaClient
let api: Api
let apagar: () => Promise<void>
const u: Record<string, string> = {}
const c: Record<string, string> = {}
const p: Record<string, string> = {}

const hoje = () => diaCivilEm(new Date())
/** O instante de "HH:MM" em Manaus, `n` dias a frente de hoje. */
const em = (n: number, hora: string, base = hoje()) => instanteEmManaus(somarDias(base, n), hora)!.toISOString()

const agendar = (cookie: string, pacienteId: string, inicioPrevistoEm: string, local = 'Sala 2') =>
  api.pedir('POST', `/pacientes/${pacienteId}/agendamentos`, { cookie, corpo: { inicioPrevistoEm, local } })
const cancelar = (cookie: string, sessaoId: string) => api.pedir('POST', `/sessoes/${sessaoId}/cancelamento`, { cookie })
const iniciar = (cookie: string, pacienteId: string, sessaoAgendadaId?: string) =>
  api.pedir('POST', '/sessoes', { cookie, corpo: { pacienteId, sessaoAgendadaId } })
const agenda = (cookie: string, dia: string) => api.pedir('GET', `/agenda?dia=${dia}&porPagina=100`, { cookie })

const ultimaDe = async (where: Record<string, unknown>) =>
  (await prisma.registroAuditoria.findMany({ where, orderBy: [{ ocorridoEm: 'asc' }, { id: 'asc' }] })).at(-1)
const linhas = (where: Record<string, unknown>) => prisma.registroAuditoria.count({ where })

/** Paciente com plano vigente e um objetivo: o caminho da sessao, da evolucao e do relatorio. */
async function pacienteComPlano(nome: string): Promise<{ id: string; objetivo: string }> {
  const id = (await api.pedir('POST', '/pacientes', {
    cookie: c.ana, corpo: { nome, dataNascimento: '2019-03-12', nivelSuporte: 2, profissionalResponsavelId: u.ana },
  })).corpo.id
  const plano = await api.pedir('POST', `/pacientes/${id}/plano`, { cookie: c.ana, corpo: { dataInicio: '2026-10-01', dataRevisao: '2027-04-01' } })
  const objetivo = (await api.pedir('POST', `/planos/${plano.corpo.id}/objetivos`, {
    cookie: c.ana,
    corpo: { dominio: 'Comunicação', descricaoTecnica: 'Mando com figura.', descricaoAcessivel: 'Pedir o que quer.', criterio: { percentualMinimo: 80, sessoesConsecutivas: 2 } },
  })).corpo.id
  await api.pedir('POST', `/planos/${plano.corpo.id}/envio`, { cookie: c.ana })
  await api.pedir('POST', `/planos/${plano.corpo.id}/aprovacao`, { cookie: c.coord })
  return { id, objetivo }
}

beforeAll(async () => {
  const banco = await criarBancoMigrado(inject('urlAdministrativa'), 'sinctea_agenda')
  apagar = banco.apagar
  prisma = clienteDe(banco.url)
  u.ana = await criarUsuario(prisma, { email: 'ana@teste.example', nome: 'Ana Souza', perfis: ['TERAPEUTA'] })
  u.bruno = await criarUsuario(prisma, { email: 'bruno@teste.example', nome: 'Bruno Lima', perfis: ['TERAPEUTA'] })
  u.dani = await criarUsuario(prisma, { email: 'dani@teste.example', nome: 'Dani Fora', perfis: ['TERAPEUTA'] })
  u.coord = await criarUsuario(prisma, { email: 'coord@teste.example', nome: 'Caio Coordenador', perfis: ['COORDENADOR'] })
  u.admin = await criarUsuario(prisma, { email: 'admin@teste.example', nome: 'Alice Admin', perfis: ['ADMINISTRADOR'] })
  u.mae = await criarUsuario(prisma, { email: 'mae@teste.example', nome: 'Patrícia Mãe', perfis: ['RESPONSAVEL'], tipo: 'RESPONSAVEL' })
  api = await subirApi(banco.url)
  for (const nome of ['ana', 'bruno', 'dani', 'coord', 'admin', 'mae']) c[nome] = await api.entrar(`${nome}@teste.example`)

  const miguel = await pacienteComPlano('Miguel Ficticio')
  p.miguel = miguel.id
  p.objetivoMiguel = miguel.objetivo
  // Bruno tambem e da equipe do Miguel; Dani, de nenhuma.
  await prisma.equipePaciente.create({ data: { pacienteId: p.miguel, profissionalId: u.bruno } })
  p.luna = (await pacienteComPlano('Luna Ficticia')).id
  const nina = await pacienteComPlano('Nina Ficticia')
  p.nina = nina.id
  p.objetivoNina = nina.objetivo
}, 120_000)

afterAll(async () => {
  await api?.fechar()
  await prisma?.$disconnect()
  await apagar?.()
})

// Primeiro, com o banco ainda sem nenhuma sessao comecada.
describe('regressao: agendar e cancelar nao contam como sessao', () => {
  it('nem nos indicadores, nem na evolucao, nem no relatorio, nem no "paciente sem sessao", nem na ficha', async () => {
    const futura = await agendar(c.ana, p.nina, em(2, '09:00'))
    expect(futura.status, JSON.stringify(futura.corpo)).toBe(201)
    const cancelada = await agendar(c.ana, p.nina, em(3, '09:00'))
    expect((await cancelar(c.ana, cancelada.corpo.id)).status).toBe(200)

    const resumo = (await api.pedir('GET', '/indicadores/resumo', { cookie: c.coord })).corpo
    expect(resumo.temDados).toBe(false)
    expect(resumo.sessoesUltimos7Dias.valor).toBe(0)
    const porProfissional = (await api.pedir('GET', '/indicadores/sessoes-por-profissional', { cookie: c.coord })).corpo
    expect(porProfissional.itens.every((i: { sessoes: number }) => i.sessoes === 0)).toBe(true)
    const semSessao = (await api.pedir('GET', '/indicadores/alertas/PACIENTE_SEM_SESSAO?porPagina=100', { cookie: c.coord })).corpo
    expect(semSessao.itens.find((a: { paciente: { id: string } }) => a.paciente.id === p.nina)).toMatchObject({ quantidade: null })

    const evolucao = await api.pedir('GET', `/objetivos/${p.objetivoNina}/evolucao`, { cookie: c.ana })
    expect(evolucao.status).toBe(200)
    expect(evolucao.corpo.clinica).toEqual([])

    const previa = await api.pedir('POST', `/pacientes/${p.nina}/relatorios/previa`, {
      cookie: c.ana,
      corpo: { periodoInicio: somarDias(hoje(), -30), periodoFim: hoje(), objetivoIds: [p.objetivoNina], destinatario: 'PROFISSIONAIS', consideracoes: 'Leitura do período.' },
    })
    expect(previa.status, JSON.stringify(previa.corpo)).toBe(200)
    expect(previa.corpo.sessoesNoPeriodo).toBe(0)

    const ficha = (await api.pedir('GET', `/pacientes/${p.nina}`, { cookie: c.ana })).corpo
    expect(ficha).toMatchObject({ totalSessoes: 0, ultimaSessaoEm: null })
    // O historico de sessoes da ficha so traz as encerradas.
    expect((await api.pedir('GET', `/pacientes/${p.nina}/sessoes?situacao=ENCERRADA`, { cookie: c.ana })).corpo.total).toBe(0)
  })
})

describe('agendar', () => {
  it('quem nao alcanca o paciente e negado, e a negativa entra na trilha', async () => {
    for (const quem of ['mae', 'admin', 'dani']) {
      const antes = await linhas({ acao: 'ACESSO_NEGADO', usuarioId: u[quem] })
      const r = await agendar(c[quem], p.miguel, em(5, '10:00'))
      expect(r.status, quem).toBe(403)
      expect(await linhas({ acao: 'ACESSO_NEGADO', usuarioId: u[quem] }), quem).toBe(antes + 1)
    }
    // O profissional fora da equipe: a negativa leva o paciente.
    expect(await ultimaDe({ acao: 'ACESSO_NEGADO', usuarioId: u.dani })).toMatchObject({ pacienteId: p.miguel })
    expect(await prisma.sessao.count({ where: { pacienteId: p.miguel } })).toBe(0)
  })

  it('agenda para si: AGENDADA, sem numero nem inicio, com o local; a trilha guarda a criacao com o paciente', async () => {
    const r = await agendar(c.ana, p.miguel, em(5, '10:00'), '  Sala 2  ')
    expect(r.status, JSON.stringify(r.corpo)).toBe(201)
    expect(r.corpo).toMatchObject({
      situacao: 'AGENDADA', numero: null, inicio: null, fim: null, local: 'Sala 2', profissionalId: u.ana, pacienteId: p.miguel,
      inicioPrevistoEm: em(5, '10:00'),
    })
    expect(await ultimaDe({ acao: 'CRIACAO', entidade: 'Sessao', usuarioId: u.ana })).toMatchObject({
      idEntidade: r.corpo.id, pacienteId: p.miguel,
      detalhe: `Sessão agendada para ${emDataCivil(somarDias(hoje(), 5))} às 10:00.`,
    })
  })

  it('nada no passado, nada depois de 90 dias, local obrigatorio: recusa por campo, e nada se grava', async () => {
    const antes = await prisma.sessao.count()
    const passado = await agendar(c.ana, p.luna, new Date(Date.now() - 60_000).toISOString())
    expect(passado.status).toBe(422)
    expect(passado.corpo.campos).toEqual({ inicioPrevistoEm: 'O agendamento não pode ficar no passado.' })
    const longe = await agendar(c.ana, p.luna, em(91, '00:00'))
    expect(longe.status).toBe(422)
    expect(longe.corpo.campos.inicioPrevistoEm).toBe(`Agende com até 90 dias de antecedência: até ${emDataCivil(somarDias(hoje(), 90))}.`)
    const semLocal = await agendar(c.ana, p.luna, em(6, '10:00'), '   ')
    expect(semLocal.status).toBe(422)
    expect(semLocal.corpo.campos).toEqual({ local: 'Informe o local da sessão.' })
    const localLongo = await agendar(c.ana, p.luna, em(6, '10:00'), 'x'.repeat(101))
    expect(localLongo.corpo.campos).toEqual({ local: 'O local pode ter no máximo 100 caracteres.' })
    const semHorario = await api.pedir('POST', `/pacientes/${p.luna}/agendamentos`, { cookie: c.ana, corpo: { local: 'Sala' } })
    expect(semHorario.corpo.campos).toEqual({ inicioPrevistoEm: 'Informe a data e a hora da sessão.' })
    // Sem o fuso escrito, o texto seria lido na hora da maquina do servidor: recusado.
    const semFuso = await agendar(c.ana, p.luna, em(6, '10:00').replace('.000Z', ''))
    expect(semFuso.corpo.campos).toEqual({ inicioPrevistoEm: 'Informe a data e a hora da sessão.' })
    expect(await prisma.sessao.count()).toBe(antes)
    // O ultimo dia inteiro vale.
    expect((await agendar(c.ana, p.luna, em(90, '23:30'))).status).toBe(201)
  })

  it('o mesmo horario, ou o mesmo paciente no mesmo dia: CONFLITO, com a mensagem no campo; outro profissional pode', async () => {
    // Os segundos nao abrem outro horario: o agendamento vai ao minuto.
    const horario = await agendar(c.ana, p.luna, em(5, '10:00').replace(':00.000Z', ':30.000Z'))
    expect(horario.status).toBe(409)
    expect(horario.corpo.mensagem).toBe(`Você já tem uma sessão agendada para ${emDataCivil(somarDias(hoje(), 5))} às 10:00.`)
    expect(horario.corpo.campos.inicioPrevistoEm).toBe(horario.corpo.mensagem)

    const dia = await agendar(c.ana, p.miguel, em(5, '15:00'))
    expect(dia.status).toBe(409)
    expect(dia.corpo.mensagem).toBe(
      `Você já tem uma sessão agendada com este paciente em ${emDataCivil(somarDias(hoje(), 5))}. Para mudar o horário, cancele aquela e agende de novo.`)

    // Bruno, da mesma equipe, no mesmo horario e no mesmo dia: a agenda e dele.
    expect((await agendar(c.bruno, p.miguel, em(5, '10:00'))).status).toBe(201)
  })

  it('em corrida, o banco decide: um grava, o outro ouve o motivo', async () => {
    const mesmoHorario = await Promise.all([agendar(c.ana, p.miguel, em(7, '11:00')), agendar(c.ana, p.luna, em(7, '11:00'))])
    expect(mesmoHorario.map((r) => r.status).sort()).toEqual([201, 409])
    expect(mesmoHorario.find((r) => r.status === 409)!.corpo.mensagem).toMatch(/^Você já tem uma sessão agendada para /)

    const mesmoDia = await Promise.all([agendar(c.ana, p.nina, em(8, '08:00')), agendar(c.ana, p.nina, em(8, '17:00'))])
    expect(mesmoDia.map((r) => r.status).sort()).toEqual([201, 409])
    expect(mesmoDia.find((r) => r.status === 409)!.corpo.mensagem).toMatch(/cancele aquela e agende de novo\.$/)
    expect(await prisma.sessao.count({ where: { pacienteId: p.nina, situacao: 'AGENDADA', profissionalId: u.ana } })).toBe(2)
  })

  it('na borda das 23h30 de Manaus: o dia e o de Manaus, e nao o de UTC', async () => {
    // 23h30 do dia 10 e 00h30 do dia 11 sao o mesmo dia em UTC, e dois em Manaus.
    const borda = await agendar(c.ana, p.luna, em(10, '23:30'))
    expect(borda.status, JSON.stringify(borda.corpo)).toBe(201)
    expect((await agendar(c.ana, p.luna, em(11, '00:30'))).status).toBe(201)
    // 08h e 23h30 do dia 10 sao dois dias em UTC, e um so em Manaus.
    const mesmoDia = await agendar(c.ana, p.luna, em(10, '08:00'))
    expect(mesmoDia.status).toBe(409)
    expect(mesmoDia.corpo.mensagem).toMatch(/cancele aquela/)
  })
})

describe('cancelar', () => {
  it('so quem vai conduzir: o outro da equipe e a coordenacao sao negados, com o paciente na trilha', async () => {
    const s = (await agendar(c.ana, p.miguel, em(12, '09:00'))).corpo.id
    for (const quem of ['bruno', 'coord']) {
      const r = await cancelar(c[quem], s)
      expect(r.status, quem).toBe(403)
      expect(r.corpo.mensagem).toBe('Só o profissional que vai conduzir a sessão pode cancelar o agendamento.')
      expect(await ultimaDe({ acao: 'ACESSO_NEGADO', usuarioId: u[quem] })).toMatchObject({ pacienteId: p.miguel })
    }
    expect((await prisma.sessao.findUniqueOrThrow({ where: { id: s } })).situacao).toBe('AGENDADA')
  })

  it('cancela a agendada; a trilha guarda a alteracao com o paciente e a situacao anterior', async () => {
    const s = (await agendar(c.ana, p.miguel, em(13, '09:00'))).corpo.id
    const r = await cancelar(c.ana, s)
    expect(r.status).toBe(200)
    expect(r.corpo).toMatchObject({ id: s, situacao: 'CANCELADA', numero: null, inicio: null })
    expect(await ultimaDe({ acao: 'ALTERACAO', entidade: 'Sessao', usuarioId: u.ana })).toMatchObject({
      idEntidade: s, pacienteId: p.miguel, detalhe: 'Agendamento cancelado.', valorAnterior: '{"situacao":"AGENDADA"}',
    })
    // Cancelado, o horario e o dia ficam livres de novo: remarcar e agendar outra vez.
    expect((await agendar(c.ana, p.miguel, em(13, '09:00'))).status).toBe(201)
  })

  it('so a agendada: a cancelada e a iniciada nao se cancelam', async () => {
    const s = (await agendar(c.ana, p.luna, em(14, '09:00'))).corpo.id
    expect((await cancelar(c.ana, s)).status).toBe(200)
    const deNovo = await cancelar(c.ana, s)
    expect(deNovo.status).toBe(409)
    expect(deNovo.corpo.mensagem).toBe('Só se cancela uma sessão agendada. Esta já foi iniciada ou cancelada.')
    const iniciada = (await iniciar(c.ana, p.luna)).corpo
    expect(iniciada.situacao).toBe('EM_ANDAMENTO')
    expect((await cancelar(c.ana, iniciada.id)).status).toBe(409)
    await prisma.sessao.update({ where: { id: iniciada.id }, data: { situacao: 'ENCERRADA', fim: new Date(), evolucao: 'Registro de teste.' } })
  })
})

describe('a agenda', () => {
  it('so as sessoes do proprio profissional, no dia de Manaus, pelo horario; a das 23h30 fica no dia dela', async () => {
    const dia10 = somarDias(hoje(), 10)
    const r = await agenda(c.ana, dia10)
    expect(r.status).toBe(200)
    expect(r.corpo.itens.map((i: { inicioPrevistoEm: string }) => i.inicioPrevistoEm)).toEqual([em(10, '23:30')])
    expect(r.corpo.itens[0]).toMatchObject({
      situacao: 'AGENDADA', local: 'Sala 2', paciente: { id: p.luna, nome: 'Luna Ficticia' }, profissional: { id: u.ana, nome: 'Ana Souza' },
    })
    const dia11 = (await agenda(c.ana, somarDias(hoje(), 11))).corpo
    expect(dia11.itens.map((i: { inicioPrevistoEm: string }) => i.inicioPrevistoEm)).toEqual([em(11, '00:30')])

    // No dia 5, a Ana tem o Miguel as 10h; o do Bruno, no mesmo horario, e so do Bruno.
    const dia5 = (await agenda(c.ana, somarDias(hoje(), 5))).corpo
    expect(dia5.itens.map((i: { profissional: { id: string } }) => i.profissional.id)).toEqual([u.ana])
    const doBruno = (await agenda(c.bruno, somarDias(hoje(), 5))).corpo
    expect(doBruno.itens.map((i: { profissional: { id: string } }) => i.profissional.id)).toEqual([u.bruno])
    // Mesmo a coordenacao ve so as dela.
    expect((await agenda(c.coord, somarDias(hoje(), 5))).corpo.total).toBe(0)

    // Varias no mesmo dia: em ordem de horario, com a cancelada no lugar dela.
    expect((await agendar(c.ana, p.miguel, em(14, '10:00'))).status).toBe(201)
    expect((await agendar(c.ana, p.nina, em(14, '08:00'))).status).toBe(201)
    const dia14 = (await agenda(c.ana, somarDias(hoje(), 14))).corpo
    expect(dia14.itens.map((i: { inicioPrevistoEm: string; situacao: string }) => [i.inicioPrevistoEm, i.situacao])).toEqual([
      [em(14, '08:00'), 'AGENDADA'], [em(14, '09:00'), 'CANCELADA'], [em(14, '10:00'), 'AGENDADA'],
    ])
  })

  it('uma linha de leitura com o dia e o total, sem paciente', async () => {
    const dia = somarDias(hoje(), 7)
    const r = await agenda(c.ana, dia)
    expect(await ultimaDe({ acao: 'LEITURA_AUTORIZADA', entidade: 'Sessao', usuarioId: u.ana })).toMatchObject({
      detalhe: `Agenda de ${emDataCivil(dia)}: ${r.corpo.total}.`, pacienteId: null, idEntidade: null,
    })
    expect(r.corpo.total).toBe(1)
  })

  it('sem dia, a de hoje; dia que nao existe, recusa; quem nao e da clinica, negado e registrado', async () => {
    const semDia = await api.pedir('GET', '/agenda', { cookie: c.ana })
    expect(semDia.status).toBe(200)
    expect(await ultimaDe({ acao: 'LEITURA_AUTORIZADA', usuarioId: u.ana })).toMatchObject({ detalhe: `Agenda de ${emDataCivil(hoje())}: ${semDia.corpo.total}.` })
    expect((await agenda(c.ana, '2026-02-30')).status).toBe(422)
    for (const quem of ['mae', 'admin']) {
      const antes = await linhas({ acao: 'ACESSO_NEGADO', usuarioId: u[quem] })
      expect((await agenda(c[quem], hoje())).status).toBe(403)
      expect(await linhas({ acao: 'ACESSO_NEGADO', usuarioId: u[quem] })).toBe(antes + 1)
    }
  })

  it('as proximas do paciente: de hoje em diante, so as agendadas, de qualquer profissional, com a leitura na trilha', async () => {
    const r = await api.pedir('GET', `/pacientes/${p.miguel}/proximas-sessoes?porPagina=100`, { cookie: c.bruno })
    expect(r.status).toBe(200)
    const itens = r.corpo.itens as Array<{ situacao: string; inicioPrevistoEm: string; profissional: { id: string } }>
    expect(itens.every((i) => i.situacao === 'AGENDADA')).toBe(true)
    expect(new Set(itens.map((i) => i.profissional.id))).toEqual(new Set([u.ana, u.bruno]))
    expect(itens.map((i) => i.inicioPrevistoEm)).toEqual([...itens.map((i) => i.inicioPrevistoEm)].sort())
    expect(await ultimaDe({ acao: 'LEITURA_AUTORIZADA', usuarioId: u.bruno })).toMatchObject({
      pacienteId: p.miguel, detalhe: `Próximas sessões: ${r.corpo.total}.`,
    })
    expect((await api.pedir('GET', `/pacientes/${p.miguel}/proximas-sessoes`, { cookie: c.dani })).status).toBe(403)
  })
})

describe('iniciar', () => {
  /** Com o relogio do processo num dia fixo, 06h de Manaus: as contas entram de novo sob ele. */
  async function noDia(dia: string, hora: string, fazer: (cookies: Record<string, string>) => Promise<void>) {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(instanteEmManaus(dia, hora)!)
      const cookies: Record<string, string> = {}
      for (const nome of ['ana', 'bruno']) cookies[nome] = await api.entrar(`${nome}@teste.example`)
      await fazer(cookies)
    } finally {
      vi.useRealTimers()
    }
  }
  const maiorNumero = async (pacienteId: string) =>
    (await prisma.sessao.aggregate({ where: { pacienteId }, _max: { numero: true } }))._max.numero ?? 0

  it('sem o id, inicia o agendamento de hoje de quem pede, em vez de criar outro; a trilha e de alteracao', async () => {
    const dia = somarDias(hoje(), 20)
    await noDia(dia, '06:00', async (k) => {
      const agendada = (await agendar(k.ana, p.miguel, instanteEmManaus(dia, '14:00')!.toISOString())).corpo
      const antes = await prisma.sessao.count({ where: { pacienteId: p.miguel } })
      const numero = await maiorNumero(p.miguel)
      const r = await iniciar(k.ana, p.miguel)
      expect(r.status, JSON.stringify(r.corpo)).toBe(201)
      expect(r.corpo).toMatchObject({ id: agendada.id, situacao: 'EM_ANDAMENTO', numero: numero + 1, local: 'Sala 2' })
      expect(r.corpo.inicio).toBe(instanteEmManaus(dia, '06:00')!.toISOString())
      expect(await prisma.sessao.count({ where: { pacienteId: p.miguel } })).toBe(antes)
      expect(await ultimaDe({ usuarioId: u.ana, entidade: 'Sessao', idEntidade: agendada.id })).toMatchObject({
        acao: 'ALTERACAO', pacienteId: p.miguel, valorAnterior: '{"situacao":"AGENDADA"}',
        detalhe: `Sessão agendada iniciada, com o número ${numero + 1}.`,
      })
      // O agendamento do Bruno, no mesmo dia, continua dele.
      const doBruno = (await agendar(k.bruno, p.miguel, instanteEmManaus(dia, '16:00')!.toISOString())).corpo
      expect((await prisma.sessao.findUniqueOrThrow({ where: { id: doBruno.id } })).situacao).toBe('AGENDADA')
      await prisma.sessao.update({ where: { id: agendada.id }, data: { situacao: 'ENCERRADA', fim: new Date(), evolucao: 'Registro de teste.' } })
    })
  })

  it('de outro dia, recusa; cancelado, recusa; o pausado se retoma', async () => {
    const dia = somarDias(hoje(), 21)
    await noDia(dia, '06:00', async (k) => {
      const amanha = (await agendar(k.ana, p.luna, instanteEmManaus(somarDias(dia, 1), '09:00')!.toISOString())).corpo
      const outroDia = await iniciar(k.ana, p.luna, amanha.id)
      expect(outroDia.status).toBe(409)
      expect(outroDia.corpo.mensagem).toBe(`Este agendamento é para ${emDataCivil(somarDias(dia, 1))}.`)

      const cancelado = (await agendar(k.ana, p.luna, instanteEmManaus(dia, '09:00')!.toISOString())).corpo
      await cancelar(k.ana, cancelado.id)
      const r = await iniciar(k.ana, p.luna, cancelado.id)
      expect(r.status).toBe(409)
      expect(r.corpo.mensagem).toBe('Este agendamento foi cancelado.')
      expect((await prisma.sessao.findUniqueOrThrow({ where: { id: cancelado.id } })).situacao).toBe('CANCELADA')

      // O agendamento de outro profissional nao se inicia por quem pede.
      const doBruno = (await agendar(k.bruno, p.miguel, instanteEmManaus(dia, '10:00')!.toISOString())).corpo
      expect((await iniciar(k.ana, p.miguel, doBruno.id)).status).toBe(403)

      // A pausada volta a andar com o mesmo numero; a trilha diz que foi retomada.
      const nova = (await iniciar(k.ana, p.luna)).corpo
      await api.pedir('POST', `/sessoes/${nova.id}/pausa`, { cookie: k.ana })
      const retomada = await iniciar(k.ana, p.luna, nova.id)
      expect(retomada.corpo).toMatchObject({ id: nova.id, situacao: 'EM_ANDAMENTO', numero: nova.numero })
      expect(await ultimaDe({ usuarioId: u.ana, idEntidade: nova.id })).toMatchObject({
        acao: 'ALTERACAO', valorAnterior: '{"situacao":"PAUSADA"}', detalhe: 'Sessão retomada.',
      })
      await prisma.sessao.update({ where: { id: nova.id }, data: { situacao: 'ENCERRADA', fim: new Date(), evolucao: 'Registro de teste.' } })
    })
  })

  it('o cancelado nao gasta numero: a sessao seguinte leva o numero seguinte ao da ultima que comecou', async () => {
    const dia = somarDias(hoje(), 22)
    await noDia(dia, '06:00', async (k) => {
      const numero = await maiorNumero(p.nina)
      const cancelado = (await agendar(k.ana, p.nina, instanteEmManaus(dia, '08:00')!.toISOString())).corpo
      await cancelar(k.ana, cancelado.id)
      await agendar(k.ana, p.nina, instanteEmManaus(dia, '09:00')!.toISOString())
      const r = await iniciar(k.ana, p.nina)
      expect(r.corpo.numero).toBe(numero + 1)
      expect((await prisma.sessao.findUniqueOrThrow({ where: { id: cancelado.id } })).numero).toBeNull()
    })
  })

  it('dois inicios ao mesmo tempo nao repetem numero; o mesmo agendamento tocado duas vezes comeca uma vez so', async () => {
    const dia = somarDias(hoje(), 23)
    await noDia(dia, '06:00', async (k) => {
      const numero = await maiorNumero(p.miguel)
      const [a, b] = await Promise.all([iniciar(k.ana, p.miguel), iniciar(k.bruno, p.miguel)])
      expect([a.status, b.status]).toEqual([201, 201])
      expect([a.corpo.numero, b.corpo.numero].sort()).toEqual([numero + 1, numero + 2])

      const agendada = (await agendar(k.ana, p.luna, instanteEmManaus(dia, '15:00')!.toISOString())).corpo
      const numeroLuna = await maiorNumero(p.luna)
      const toques = await Promise.all([iniciar(k.ana, p.luna, agendada.id), iniciar(k.ana, p.luna, agendada.id)])
      expect(toques.map((t) => t.corpo.id)).toEqual([agendada.id, agendada.id])
      expect(toques.map((t) => t.corpo.numero)).toEqual([numeroLuna + 1, numeroLuna + 1])
      // Uma alteracao e uma leitura: o segundo toque so leu a sessao que o primeiro comecou.
      const trilha = await prisma.registroAuditoria.findMany({ where: { idEntidade: agendada.id, usuarioId: u.ana }, orderBy: { ocorridoEm: 'asc' } })
      expect(trilha.map((t) => t.acao).sort()).toEqual(['ALTERACAO', 'CRIACAO', 'LEITURA_AUTORIZADA'])
    })
  })

  it('o banco garante: numero repetido, agendada com numero ou iniciada sem numero, recusados', async () => {
    const s = await prisma.sessao.findFirstOrThrow({ where: { pacienteId: p.miguel, numero: { not: null } }, orderBy: { numero: 'desc' } })
    await expect(prisma.sessao.create({ data: {
      pacienteId: p.miguel, profissionalId: u.ana, numero: s.numero, inicioPrevistoEm: new Date(), inicio: new Date(),
      local: 'Sala', situacao: 'EM_ANDAMENTO', statusSync: 'SINCRONIZADO',
    } })).rejects.toThrow(/sessao_pacienteId_numero_key|Unique constraint/)
    await expect(prisma.sessao.create({ data: {
      pacienteId: p.miguel, profissionalId: u.ana, numero: 999, inicioPrevistoEm: new Date(Date.now() + 86_400_000 * 40),
      local: 'Sala', situacao: 'AGENDADA', statusSync: 'SINCRONIZADO',
    } })).rejects.toThrow(/sessao_numero_so_iniciada/)
    await expect(prisma.sessao.create({ data: {
      pacienteId: p.miguel, profissionalId: u.ana, numero: null, inicioPrevistoEm: new Date(), inicio: new Date(),
      local: 'Sala', situacao: 'EM_ANDAMENTO', statusSync: 'SINCRONIZADO',
    } })).rejects.toThrow(/sessao_numero_so_iniciada/)
    await expect(prisma.sessao.create({ data: {
      pacienteId: p.miguel, profissionalId: u.ana, numero: null, inicioPrevistoEm: new Date(Date.now() + 86_400_000 * 41),
      local: ' ', situacao: 'AGENDADA', statusSync: 'SINCRONIZADO',
    } })).rejects.toThrow(/sessao_local_limite/)
  })
})
