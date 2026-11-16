import { afterEach, describe, expect, it } from 'vitest'
import {
  AGENDAMENTO_CANCELADO, LOCAL_MAXIMO, LOCAL_PADRAO, SESSAO_JA_ENCERRADA, agendamentoPreenchido, conflitoDeHorario,
  conflitoDoDia, diaDoAgendamento, horaEmManaus, instanteEmManaus, quandoEmManaus, recusaDoInicio, ultimoDiaAgendavel,
  validarAgendamento,
} from './agenda.js'
import { encerradasEmOrdem } from './regras.js'

/**
 * Item 19b: datas e horas do agendamento sao de Manaus, qualquer que seja o
 * fuso da maquina — o Render roda em UTC, e o navegador pode estar em outro.
 */
const FUSOS = ['UTC', 'Asia/Tokyo', 'America/Manaus']
const fusoOriginal = process.env.TZ
afterEach(() => {
  if (fusoOriginal === undefined) delete process.env.TZ
  else process.env.TZ = fusoOriginal
})

// 15/11/2026, 22h de Manaus = 16/11, 02h em UTC: o dia ja virou em UTC, nao em Manaus.
const AGORA = new Date('2026-11-16T02:00:00.000Z')

describe.each(FUSOS)('as horas de Manaus, com a maquina em %s', (fuso) => {
  it('data e hora do campo viram o instante de Manaus, e voltam', () => {
    process.env.TZ = fuso
    const i = instanteEmManaus('2026-11-16', '23:30')!
    expect(i.toISOString()).toBe('2026-11-17T03:30:00.000Z')
    expect(horaEmManaus(i)).toBe('23:30')
    // 23h30 de Manaus e do dia 16, embora em UTC ja seja 17.
    expect(diaDoAgendamento(i)).toBe('2026-11-16')
    expect(quandoEmManaus(i)).toBe('16/11/2026 às 23:30')
    expect(instanteEmManaus('2026-11-16', '00:00')!.toISOString()).toBe('2026-11-16T04:00:00.000Z')
  })

  it('o limite de 90 dias e o agendamento de hoje contam pelo dia de Manaus', () => {
    process.env.TZ = fuso
    expect(ultimoDiaAgendavel(AGORA)).toBe('2027-02-13')
    // Hoje ainda e 15/11 em Manaus: as 23h de hoje se iniciam hoje.
    const hojeAs23 = { situacao: 'AGENDADA' as const, inicioPrevistoEm: instanteEmManaus('2026-11-15', '23:00')! }
    expect(recusaDoInicio(hojeAs23, AGORA)).toBeNull()
    const amanha = { situacao: 'AGENDADA' as const, inicioPrevistoEm: instanteEmManaus('2026-11-16', '08:00')! }
    expect(recusaDoInicio(amanha, AGORA)).toBe('Este agendamento é para 16/11/2026.')
  })
})

describe('instanteEmManaus', () => {
  it('nulo para dia ou hora que nao existem', () => {
    expect(instanteEmManaus('2026-02-30', '10:00')).toBeNull()
    expect(instanteEmManaus('2026-11-16', '24:00')).toBeNull()
    expect(instanteEmManaus('2026-11-16', '9:00')).toBeNull()
    expect(instanteEmManaus('', '')).toBeNull()
  })
})

describe('validarAgendamento', () => {
  const daqui = (minutos: number) => new Date(AGORA.getTime() + minutos * 60_000).toISOString()

  it('aceita o horario a frente, com o local', () => {
    expect(validarAgendamento({ inicioPrevistoEm: daqui(60), local: LOCAL_PADRAO }, AGORA)).toEqual({})
  })

  it('nada no passado, nem um minuto', () => {
    expect(validarAgendamento({ inicioPrevistoEm: daqui(-1), local: 'Sala 2' }, AGORA))
      .toEqual({ inicioPrevistoEm: 'O agendamento não pode ficar no passado.' })
  })

  it('no maximo 90 dias a frente, em dias de Manaus: o ultimo dia inteiro vale, o seguinte nao', () => {
    expect(validarAgendamento({ inicioPrevistoEm: instanteEmManaus('2027-02-13', '23:30')!.toISOString(), local: 'Sala' }, AGORA)).toEqual({})
    expect(validarAgendamento({ inicioPrevistoEm: instanteEmManaus('2027-02-14', '00:00')!.toISOString(), local: 'Sala' }, AGORA))
      .toEqual({ inicioPrevistoEm: 'Agende com até 90 dias de antecedência: até 13/02/2027.' })
  })

  it('o instante precisa existir e trazer o fuso escrito', () => {
    for (const inicioPrevistoEm of [undefined, '', 'amanha', '2026-11-20T10:00', '2026-11-20', 42]) {
      expect(validarAgendamento({ inicioPrevistoEm, local: 'Sala' }, AGORA), String(inicioPrevistoEm))
        .toEqual({ inicioPrevistoEm: 'Informe a data e a hora da sessão.' })
    }
    expect(validarAgendamento({ inicioPrevistoEm: '2026-11-20T10:00-04:00', local: 'Sala' }, AGORA)).toEqual({})
  })

  it('local obrigatorio, sem espacos nas pontas, ate 100 caracteres', () => {
    expect(validarAgendamento({ inicioPrevistoEm: daqui(60), local: '   ' }, AGORA))
      .toEqual({ local: 'Informe o local da sessão.' })
    expect(validarAgendamento({ inicioPrevistoEm: daqui(60) }, AGORA)).toEqual({ local: 'Informe o local da sessão.' })
    expect(validarAgendamento({ inicioPrevistoEm: daqui(60), local: 'x'.repeat(LOCAL_MAXIMO) }, AGORA)).toEqual({})
    expect(validarAgendamento({ inicioPrevistoEm: daqui(60), local: 'x'.repeat(LOCAL_MAXIMO + 1) }, AGORA))
      .toEqual({ local: 'O local pode ter no máximo 100 caracteres.' })
  })

  it('o preenchido leva o horario ao minuto e o local sem espacos', () => {
    expect(agendamentoPreenchido({ inicioPrevistoEm: '2026-11-20T14:30:20.500Z', local: '  Sala 2 ' }))
      .toEqual({ inicioPrevistoEm: new Date('2026-11-20T14:30:00.000Z'), local: 'Sala 2' })
  })
})

describe('as recusas', () => {
  it('cancelado e encerrado nao se iniciam; a pausada se retoma em qualquer dia', () => {
    const ontem = instanteEmManaus('2026-11-14', '10:00')!
    expect(recusaDoInicio({ situacao: 'CANCELADA', inicioPrevistoEm: ontem }, AGORA)).toBe(AGENDAMENTO_CANCELADO)
    expect(recusaDoInicio({ situacao: 'ENCERRADA', inicioPrevistoEm: ontem }, AGORA)).toBe(SESSAO_JA_ENCERRADA)
    expect(recusaDoInicio({ situacao: 'PAUSADA', inicioPrevistoEm: ontem }, AGORA)).toBeNull()
    expect(recusaDoInicio({ situacao: 'AGENDADA', inicioPrevistoEm: ontem }, AGORA)).toBe('Este agendamento é para 14/11/2026.')
  })

  it('os conflitos dizem o horario e o dia, em Manaus', () => {
    const i = instanteEmManaus('2026-11-16', '23:30')!
    expect(conflitoDeHorario(i)).toBe('Você já tem uma sessão agendada para 16/11/2026 às 23:30.')
    expect(conflitoDoDia(i)).toBe(
      'Você já tem uma sessão agendada com este paciente em 16/11/2026. Para mudar o horário, cancele aquela e agende de novo.')
  })
})

describe('encerradasEmOrdem', () => {
  it('so as encerradas, pelo numero; agendada e cancelada, sem numero, ficam fora', () => {
    const s = (id: string, situacao: 'ENCERRADA' | 'AGENDADA' | 'CANCELADA' | 'EM_ANDAMENTO', numero: number | null) =>
      ({ id, situacao, numero })
    expect(encerradasEmOrdem([s('c', 'ENCERRADA', 3), s('a', 'AGENDADA', null), s('x', 'CANCELADA', null),
      s('b', 'ENCERRADA', 1), s('e', 'EM_ANDAMENTO', 4)]).map((x) => x.id)).toEqual(['b', 'c'])
  })
})
