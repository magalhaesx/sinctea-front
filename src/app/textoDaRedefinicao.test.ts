import { describe, expect, it } from 'vitest'
import { textoDoAvisoDeRedefinicao } from './textoDaRedefinicao'

describe('o aviso da nova senha (item 8)', () => {
  it('diz quando, em Manaus, e a pedido de quem da coordenacao', () => {
    // 02:30 em UTC sao 22:30 do dia anterior em Manaus.
    expect(textoDoAvisoDeRedefinicao({ redefinidaEm: '2026-10-19T02:30:00.000Z', aPedidoDe: 'Carla Coordenadora' })).toBe(
      'Sua senha foi redefinida pela clínica em 18/10/2026 às 22:30, a pedido de Carla Coordenadora. ' +
      'Se não foi você quem pediu, procure a clínica.',
    )
  })
})
