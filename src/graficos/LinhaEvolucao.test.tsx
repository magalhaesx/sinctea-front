import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LinhaEvolucao } from './LinhaEvolucao'

/**
 * O rotulo direto do ultimo ponto da tela 8 (item 16): perto do topo, ele vai
 * abaixo do ponto, porque acima sairia do grafico.
 */

const rotuloDoUltimo = (percentual: number) => {
  const html = renderToStaticMarkup(
    <LinhaEvolucao titulo="Tentativas" criterio={80} pontos={[
      { rotulo: 'S1', data: '2026-10-01T13:00:00.000Z', percentual: 50 },
      { rotulo: 'S2', data: '2026-10-08T13:00:00.000Z', percentual },
    ]} />,
  )
  const texto = [...html.matchAll(/<text[^>]*y="([\d.]+)"[^>]*font-size="13"[^>]*>(\d+)%<\/text>/g)]
  return { y: Number(texto[0][1]), valor: Number(texto[0][2]) }
}

describe('o rotulo do ultimo ponto da linha de evolucao (item 16)', () => {
  it('em 100%, fica dentro do grafico, abaixo do ponto', () => {
    const { y, valor } = rotuloDoUltimo(100)
    expect(valor).toBe(100)
    // O ponto de 100% fica em y = 16; o texto, com a linha de base acima de 16, sairia pelo topo.
    expect(y).toBeGreaterThan(16)
  })

  it('longe do topo, continua acima do ponto', () => {
    // 50% fica em y = 100.
    expect(rotuloDoUltimo(50).y).toBeLessThan(100)
  })
})
