import { describe, expect, it } from 'vitest'
import { ETIQUETA_DA_AUTORIZACAO } from './etiquetaDaAutorizacao'

describe('a etiqueta da autorizacao na tela 17 (item 10)', () => {
  it('a que ainda nao comecou diz isso, como na ficha, e nao "Prazo terminado"', () => {
    expect(ETIQUETA_DA_AUTORIZACAO.AGUARDANDO_INICIO.rotulo).toBe('Acesso ainda não começou')
    expect(ETIQUETA_DA_AUTORIZACAO.EXPIRADO.rotulo).toBe('Prazo terminado')
  })

  it('cada situacao tem a sua etiqueta, e so a vigente fica verde', () => {
    const rotulos = Object.values(ETIQUETA_DA_AUTORIZACAO).map((e) => e.rotulo)
    expect(new Set(rotulos).size).toBe(4)
    expect(Object.entries(ETIQUETA_DA_AUTORIZACAO).filter(([, e]) => e.tom === 'ok').map(([s]) => s)).toEqual(['VIGENTE'])
  })
})
