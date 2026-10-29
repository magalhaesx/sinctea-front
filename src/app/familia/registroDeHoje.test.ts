import { describe, expect, it } from 'vitest'
import type { ExecucaoAtividadeCasa } from '../../servicos'
import { lugarDoRegistro, quemRegistrou, registroDeHoje } from './registroDeHoje'

/** O registro de hoje na tela 16 (item 15b): no dia de Manaus, e com quem registrou. */

const execucao = (dataRealizacao: string, responsavelId: string, responsavelNome: string): ExecucaoAtividadeCasa => ({
  id: `ex-${dataRealizacao}`, atividadeId: 'a-1', responsavelId, responsavelNome, dataRealizacao,
  desempenho: 'COM_AJUDA', observacao: null,
})
// 28/10 as 10h em Manaus.
const agora = new Date('2026-10-28T14:00:00Z')

describe('o registro de hoje na tela 16 (item 15b)', () => {
  it('sem registro de hoje, o "Como foi hoje?" fica', () => {
    expect(registroDeHoje([], 'eu', agora)).toBeNull()
    expect(registroDeHoje([execucao('2026-10-27', 'eu', 'Patrícia')], 'eu', agora)).toBeNull()
  })

  it('registrado hoje pela propria pessoa, ou por outro responsavel, com o nome dele', () => {
    const ontem = execucao('2026-10-27', 'eu', 'Patrícia')
    expect(registroDeHoje([execucao('2026-10-28', 'eu', 'Patrícia'), ontem], 'eu', agora)).toBe('Você já registrou hoje.')
    expect(registroDeHoje([execucao('2026-10-28', 'pai', 'Paulo'), ontem], 'eu', agora)).toBe('Hoje já foi registrado por Paulo.')
  })

  it('o dia e o de Manaus: as 22h30 la, quando em UTC ja e o dia seguinte', () => {
    const noite = new Date('2026-10-29T02:30:00Z')
    expect(registroDeHoje([execucao('2026-10-28', 'eu', 'Patrícia')], 'eu', noite)).toBe('Você já registrou hoje.')
    expect(registroDeHoje([execucao('2026-10-29', 'eu', 'Patrícia')], 'eu', noite)).toBeNull()
  })
})

describe('o lugar do "Como foi hoje?" e o historico na tela 16 (item 15b)', () => {
  const hoje = execucao('2026-10-28', 'pai', 'Paulo')

  it('o formulario so aparece na ativa sem registro de hoje; a encerrada vem antes do registro de hoje', () => {
    expect(lugarDoRegistro(true, [], 'eu', agora)).toEqual({ tipo: 'formulario' })
    expect(lugarDoRegistro(true, [hoje], 'eu', agora)).toEqual({ tipo: 'registrado', titulo: 'Hoje já foi registrado por Paulo.' })
    expect(lugarDoRegistro(false, [hoje], 'eu', agora)).toEqual({ tipo: 'encerrada' })
    expect(lugarDoRegistro(false, [], 'eu', agora)).toEqual({ tipo: 'encerrada' })
  })

  it('no historico, o nome so aparece quando foi outro responsavel', () => {
    expect(quemRegistrou(hoje, 'eu')).toBe('Registrado por Paulo')
    expect(quemRegistrou(hoje, 'pai')).toBeNull()
  })
})
