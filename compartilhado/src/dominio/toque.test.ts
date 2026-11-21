import { describe, expect, it } from 'vitest'
import {
  TOLERANCIA_DO_RELOGIO_MS, TOQUE_ANTES_DO_INICIO, TOQUE_NO_FUTURO, TOQUE_SEM_INSTANTE, TOQUE_SEM_UUID,
  ehUuid, erroDaIdentificacaoDoToque, gerarUuidV7, lerInstanteComFuso, mesmoToque,
} from './toque.js'

/** Item 22: o toque que o aparelho identifica antes de enviar. */
describe('gerarUuidV7', () => {
  it('versao 7 e variante RFC, com o instante nos 48 primeiros bits', () => {
    const id = gerarUuidV7(Date.parse('2030-01-01T00:00:00.000Z'))
    expect(ehUuid(id)).toBe(true)
    expect(id[14]).toBe('7')
    expect(['8', '9', 'a', 'b']).toContain(id[19])
    expect(parseInt(id.replace(/-/g, '').slice(0, 12), 16)).toBe(Date.parse('2030-01-01T00:00:00.000Z'))
  })

  it('cresce na ordem em que foi gerado, ate no mesmo milissegundo e com o relogio voltando', () => {
    const t = Date.parse('2030-01-02T00:00:00.000Z')
    const ids = [gerarUuidV7(t), gerarUuidV7(t), gerarUuidV7(t), gerarUuidV7(t - 5000), gerarUuidV7(t + 1)]
    expect([...ids].sort()).toEqual(ids)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('o contador que transborda passa para o milissegundo seguinte, sem repetir', () => {
    const t = Date.parse('2030-01-03T00:00:00.000Z')
    const ids = Array.from({ length: 5000 }, () => gerarUuidV7(t))
    expect([...ids].sort()).toEqual(ids)
    expect(new Set(ids).size).toBe(5000)
  })
})

describe('erroDaIdentificacaoDoToque', () => {
  const inicio = new Date('2030-01-01T10:00:00.000Z')
  const agora = new Date('2030-01-01T11:00:00.000Z')
  const em = (ms: number) => new Date(ms).toISOString()

  it('sem id nem instante, nada a conferir: e o caminho de antes do item 22', () => {
    expect(erroDaIdentificacaoDoToque({}, inicio, agora)).toEqual({})
  })

  it('o id precisa ser UUID, e o instante, trazer o fuso', () => {
    expect(erroDaIdentificacaoDoToque({ id: 'toque-1' }, inicio, agora)).toEqual({ id: TOQUE_SEM_UUID })
    expect(erroDaIdentificacaoDoToque({ ocorridoEm: '2030-01-01T10:30:00' }, inicio, agora)).toEqual({ ocorridoEm: TOQUE_SEM_INSTANTE })
    expect(lerInstanteComFuso('2030-01-01T10:30:00-04:00')?.toISOString()).toBe('2030-01-01T14:30:00.000Z')
  })

  it('nem no futuro nem antes do inicio, com 5 minutos de tolerancia de relogio', () => {
    expect(TOLERANCIA_DO_RELOGIO_MS).toBe(5 * 60_000)
    const t = TOLERANCIA_DO_RELOGIO_MS
    expect(erroDaIdentificacaoDoToque({ ocorridoEm: em(agora.getTime() + t) }, inicio, agora)).toEqual({})
    expect(erroDaIdentificacaoDoToque({ ocorridoEm: em(agora.getTime() + t + 1000) }, inicio, agora)).toEqual({ ocorridoEm: TOQUE_NO_FUTURO })
    expect(erroDaIdentificacaoDoToque({ ocorridoEm: em(inicio.getTime() - t) }, inicio, agora)).toEqual({})
    expect(erroDaIdentificacaoDoToque({ ocorridoEm: em(inicio.getTime() - t - 1000) }, inicio, agora)).toEqual({ ocorridoEm: TOQUE_ANTES_DO_INICIO })
  })
})

describe('mesmoToque', () => {
  const gravado = { sessaoId: 's1', objetivoId: 'o1', resultado: 'INDEPENDENTE', ocorridoEm: '2030-01-01T10:30:00.000Z' }

  it('mesma sessao, objetivo, resultado e instante; o instante pode vir em outro fuso', () => {
    expect(mesmoToque(gravado, { sessaoId: 's1', objetivoId: 'o1', resultado: 'INDEPENDENTE', ocorridoEm: '2030-01-01T06:30:00-04:00' })).toBe(true)
    expect(mesmoToque(gravado, { sessaoId: 's1', objetivoId: 'o1', resultado: 'INDEPENDENTE' })).toBe(true)
  })

  it('qualquer diferenca e outro conteudo', () => {
    expect(mesmoToque(gravado, { sessaoId: 's2', objetivoId: 'o1', resultado: 'INDEPENDENTE' })).toBe(false)
    expect(mesmoToque(gravado, { sessaoId: 's1', objetivoId: 'o2', resultado: 'INDEPENDENTE' })).toBe(false)
    expect(mesmoToque(gravado, { sessaoId: 's1', objetivoId: 'o1', resultado: 'SEM_RESPOSTA' })).toBe(false)
    expect(mesmoToque(gravado, { sessaoId: 's1', objetivoId: 'o1', resultado: 'INDEPENDENTE', ocorridoEm: '2030-01-01T10:30:01.000Z' })).toBe(false)
  })
})
