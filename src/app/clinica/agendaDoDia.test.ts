import { describe, expect, it } from 'vitest'
import { instanteEmManaus } from '@sinctea/compartilhado/dominio/agenda'
import { acaoNaAgenda, cancelavel } from './agendaDoDia'

/** Item 19b: o botao de cada linha da agenda da tela 3, pelo dia de Manaus. */
describe('acaoNaAgenda', () => {
  const HOJE = '2026-11-16'
  const as = (dia: string, hora: string) => instanteEmManaus(dia, hora)!.toISOString()

  it('a agendada: hoje se inicia; a que ja passou nao foi iniciada; a que vem so se cancela', () => {
    expect(acaoNaAgenda({ situacao: 'AGENDADA', inicioPrevistoEm: as(HOJE, '08:00') }, HOJE)).toBe('INICIAR')
    // 23h30 de Manaus ainda e hoje, embora em UTC ja seja amanha.
    expect(acaoNaAgenda({ situacao: 'AGENDADA', inicioPrevistoEm: as(HOJE, '23:30') }, HOJE)).toBe('INICIAR')
    expect(acaoNaAgenda({ situacao: 'AGENDADA', inicioPrevistoEm: as('2026-11-15', '23:30') }, HOJE)).toBe('NAO_INICIADA')
    expect(acaoNaAgenda({ situacao: 'AGENDADA', inicioPrevistoEm: as('2026-11-17', '00:30') }, HOJE)).toBe('CANCELAR_FUTURA')
  })

  it('aberta, encerrada e cancelada, em qualquer dia', () => {
    const ontem = as('2026-11-15', '10:00')
    expect(acaoNaAgenda({ situacao: 'EM_ANDAMENTO', inicioPrevistoEm: ontem }, HOJE)).toBe('ABRIR')
    expect(acaoNaAgenda({ situacao: 'PAUSADA', inicioPrevistoEm: ontem }, HOJE)).toBe('ABRIR')
    expect(acaoNaAgenda({ situacao: 'ENCERRADA', inicioPrevistoEm: ontem }, HOJE)).toBe('VER')
    expect(acaoNaAgenda({ situacao: 'CANCELADA', inicioPrevistoEm: as(HOJE, '10:00') }, HOJE)).toBe('CANCELADA')
  })

  it('so a agendada se cancela', () => {
    expect((['INICIAR', 'CANCELAR_FUTURA', 'NAO_INICIADA', 'ABRIR', 'VER', 'CANCELADA'] as const).filter(cancelavel))
      .toEqual(['INICIAR', 'CANCELAR_FUTURA', 'NAO_INICIADA'])
  })
})
