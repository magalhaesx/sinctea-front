import { afterEach, describe, expect, it } from 'vitest'
import type { AlertaAtencao, Consentimento } from '../tipos.js'
import {
  alertaConsentimentoVencendo, alertaObjetivoSemAvanco, alertaPacienteSemSessao, alertaPlanoSemRevisao,
  diaNaJanela, diasInteiros, horasAteLeitura, janelaFutura, janelaPassada, mediana, naJanela, ordenarAlertas,
  rotuloDeHoje, rotuloFuturo, rotuloPassado, sessoesDesdeORecorde, somarDias,
} from './indicadores.js'

/**
 * Item 19: a janela dos indicadores conta dias civis de Manaus, hoje
 * incluido, qualquer que seja o fuso da maquina — o Render roda em UTC, e o
 * mock rodava na hora local do navegador.
 */
const FUSOS = ['UTC', 'Asia/Tokyo', 'America/Manaus']
const fusoOriginal = process.env.TZ
afterEach(() => {
  if (fusoOriginal === undefined) delete process.env.TZ
  else process.env.TZ = fusoOriginal
})

// 21/09/2026, 22h de Manaus = 22/09, 02h em UTC: o dia ja virou em UTC, nao em Manaus.
const AGORA = new Date('2026-09-22T02:00:00.000Z')
const paciente = { id: 'p1', nome: 'Miguel' }

describe.each(FUSOS)('a janela, com a maquina em %s', (fuso) => {
  it('os ultimos 7 dias contam hoje e vao de 00:00 do primeiro dia a 00:00 do dia seguinte ao ultimo, em Manaus', () => {
    process.env.TZ = fuso
    const j = janelaPassada(AGORA, 7)
    expect([j.primeiroDia, j.ultimoDia]).toEqual(['2026-09-15', '2026-09-21'])
    expect(j.desde.toISOString()).toBe('2026-09-15T04:00:00.000Z')
    expect(j.ate.toISOString()).toBe('2026-09-22T04:00:00.000Z')
    // 23h30 de Manaus do dia anterior ao primeiro fica fora; 00:00 do primeiro entra.
    expect(naJanela('2026-09-15T03:30:00.000Z', j)).toBe(false)
    expect(naJanela('2026-09-15T04:00:00.000Z', j)).toBe(true)
    expect(naJanela(AGORA, j)).toBe(true)
  })

  it('os proximos 30 dias vao de hoje a hoje mais 30, em dias de Manaus', () => {
    process.env.TZ = fuso
    const j = janelaFutura(AGORA, 30)
    expect([j.primeiroDia, j.ultimoDia]).toEqual(['2026-09-21', '2026-10-21'])
    expect(diaNaJanela('2026-09-21', j)).toBe(true)
    expect(diaNaJanela('2026-10-21', j)).toBe(true)
    expect(diaNaJanela('2026-09-20', j)).toBe(false)
    expect(diaNaJanela('2026-10-22', j)).toBe(false)
  })

  it('os rotulos trazem as duas pontas, em datas de Manaus', () => {
    process.env.TZ = fuso
    expect(rotuloPassado(AGORA, 7)).toBe('nos últimos 7 dias (15 a 21/09)')
    expect(rotuloPassado(AGORA, 30)).toBe('nos últimos 30 dias (23/08 a 21/09)')
    expect(rotuloFuturo(AGORA, 30)).toBe('nos próximos 30 dias (21/09 a 21/10)')
    expect(rotuloDeHoje(AGORA)).toBe('em 21/09')
  })
})

describe('contas', () => {
  it('somarDias atravessa mes e ano pelo calendario', () => {
    expect(somarDias('2026-12-26', 6)).toBe('2027-01-01')
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('dias inteiros para baixo; horas ate a leitura contadas do registro', () => {
    expect(diasInteiros('2026-09-01T12:00:00Z', '2026-09-02T11:59:59Z')).toBe(0)
    expect(diasInteiros('2026-09-01T12:00:00Z', '2026-09-03T12:00:00Z')).toBe(2)
    expect(horasAteLeitura('2026-09-01T10:00:00Z', '2026-09-02T12:00:00Z')).toBe(26)
  })

  it('mediana nula com menos de tres valores; com tres ou mais, o do meio', () => {
    expect(mediana([])).toBeNull()
    expect(mediana([2, 26])).toBeNull()
    expect(mediana([72, 2, 26])).toBe(26)
    expect(mediana([2, 26, 72, 100])).toBe(49)
  })

  it('sessoes desde o recorde: o ultimo recorde conta, e serie vazia e zero', () => {
    expect(sessoesDesdeORecorde([])).toBe(0)
    expect(sessoesDesdeORecorde([50, 80, 60, 70])).toBe(2)
    expect(sessoesDesdeORecorde([80, 50, 80, 60])).toBe(1)
    expect(sessoesDesdeORecorde([20, 40, 60])).toBe(0)
  })
})

describe('alertas', () => {
  const plano = { id: 'pl1', dataInicio: '2026-01-01', ultimaRevisaoEm: null }

  it('plano sem revisao so no plano vigente', () => {
    expect(alertaPlanoSemRevisao({ ...plano, status: 'VIGENTE' }, paciente, AGORA))
      .toMatchObject({ motivo: 'PLANO_SEM_REVISAO', referenciaId: 'pl1', unidade: 'dias' })
    for (const status of ['RASCUNHO', 'AGUARDANDO_VALIDACAO', 'DEVOLVIDO'] as const) {
      expect(alertaPlanoSemRevisao({ ...plano, status }, paciente, AGORA), status).toBeNull()
    }
    // Revisado ha pouco: sem alerta.
    expect(alertaPlanoSemRevisao({ ...plano, status: 'VIGENTE', ultimaRevisaoEm: '2026-09-01T12:00:00Z' }, paciente, AGORA)).toBeNull()
  })

  it('paciente que nunca teve sessao vem sem quantidade', () => {
    expect(alertaPacienteSemSessao(paciente, null, AGORA)).toMatchObject({ quantidade: null, referenciaId: 'p1' })
    expect(alertaPacienteSemSessao(paciente, '2026-09-20T12:00:00Z', AGORA)).toBeNull()
    expect(alertaPacienteSemSessao(paciente, '2026-08-01T12:00:00Z', AGORA)?.quantidade).toBe(51)
  })

  it('consentimento vencendo: vigente, nao revogado, ate 30 dias; vence hoje e zero', () => {
    const c = (validadeAte: string, revogadoEm: string | null = null): Consentimento => ({
      id: 'c1', responsavelId: 'r1', pacienteId: 'p1', escolaId: 'e1', escopos: ['CARTAO_ESTRATEGIA'],
      concedidoEm: '2026-01-01T12:00:00.000Z', validadeAte, revogadoEm, hashTermo: 'sha256:ficticio',
    })
    expect(alertaConsentimentoVencendo(c('2026-09-21'), paciente, AGORA)?.quantidade).toBe(0)
    expect(alertaConsentimentoVencendo(c('2026-10-01'), paciente, AGORA)?.quantidade).toBe(10)
    expect(alertaConsentimentoVencendo(c('2026-12-01'), paciente, AGORA)).toBeNull()
    expect(alertaConsentimentoVencendo(c('2026-10-01', '2026-09-01T12:00:00Z'), paciente, AGORA)).toBeNull()
    expect(alertaConsentimentoVencendo(c('2026-09-20'), paciente, AGORA)).toBeNull()
  })

  it('objetivo parado so no plano vigente, em sessoes desde o recorde', () => {
    const serie = [90, 50, 50, 50, 50, 50, 50, 50, 50]
    expect(alertaObjetivoSemAvanco({ id: 'o1', status: 'EM_AQUISICAO' }, 'VIGENTE', paciente, serie))
      .toMatchObject({ referenciaId: 'o1', quantidade: 8, unidade: 'sessoes' })
    expect(alertaObjetivoSemAvanco({ id: 'o1', status: 'EM_AQUISICAO' }, 'RASCUNHO', paciente, serie)).toBeNull()
    expect(alertaObjetivoSemAvanco({ id: 'o1', status: 'DOMINADO' }, 'VIGENTE', paciente, serie)).toBeNull()
  })

  it('ordem: quem nunca teve sessao no topo; no consentimento, o que vence antes; empate pelo nome', () => {
    const a = (nome: string, quantidade: number | null, motivo: AlertaAtencao['motivo'] = 'PACIENTE_SEM_SESSAO'): AlertaAtencao =>
      ({ motivo, paciente: { id: nome, nome }, referenciaId: nome, quantidade, unidade: 'dias' })
    expect(ordenarAlertas([a('Bia', 20), a('Ana', null), a('Caio', 40), a('Davi', 20)], 'PACIENTE_SEM_SESSAO')
      .map((x) => x.paciente.nome)).toEqual(['Ana', 'Caio', 'Bia', 'Davi'])
    const c = (nome: string, q: number) => a(nome, q, 'CONSENTIMENTO_VENCENDO')
    expect(ordenarAlertas([c('Bia', 10), c('Ana', 0), c('Caio', 25)], 'CONSENTIMENTO_VENCENDO')
      .map((x) => x.paciente.nome)).toEqual(['Ana', 'Bia', 'Caio'])
    // Nao muda o vetor recebido.
    const original = [a('Bia', 1), a('Ana', 2)]
    ordenarAlertas(original, 'PACIENTE_SEM_SESSAO')
    expect(original.map((x) => x.paciente.nome)).toEqual(['Bia', 'Ana'])
  })
})
