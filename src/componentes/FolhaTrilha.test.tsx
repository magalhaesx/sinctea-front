import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { TrilhaAutonomia } from '../servicos'
import { FolhaTrilha } from './FolhaTrilha'

/**
 * A folha da trilha de autonomia (tela 26, item 24), a mesma na clinica e na
 * familia, na tela e no papel. O texto e o que a equipe escreveu; as frases
 * fixas sao as da caixa.
 */

const trilha = (parcial: Partial<TrilhaAutonomia> = {}): TrilhaAutonomia => ({
  pacienteId: 'p-1',
  nome: 'Miguel Ficticio Santana',
  habilidades: [
    { descricaoAcessivel: 'Lavar as mãos sozinho,\nseguindo os desenhos.', desde: '2026-11' },
    { descricaoAcessivel: 'Pedir ajuda com uma palavra.', desde: '2026-03' },
  ],
  estrategias: [{
    tituloSimples: 'Na hora de lavar as mãos', oQueFazer: ['Deixe o cartaz à altura dos olhos.'],
    oQueEvitar: ['Não faça os passos por ele.'], sinalAlerta: 'Tapar os ouvidos com o secador ligado.',
  }],
  geradaEm: '2026-11-27T03:00:00.000Z',
  ...parcial,
})

const folha = (t: TrilhaAutonomia) => renderToStaticMarkup(<FolhaTrilha trilha={t} />)

describe('a folha da trilha de autonomia', () => {
  it('cabecalho: o nome do cadastro, a data em Manaus e o subtitulo fixo', () => {
    const html = folha(trilha())
    expect(html).toContain('class="folha-trilha')
    expect(html).toContain('<header>')
    expect(html).toContain('Miguel Ficticio Santana')
    // 23h do dia 26 em Manaus ja e dia 27 em UTC.
    expect(html).toContain('Emitida em 26/11/2026')
    expect(html).toContain('Escrito pela equipe clínica. Vale para a escola, o trabalho e outros espaços do dia a dia.')
  })

  it('as duas partes, pelo primeiro nome, com o mes do dominio e as estrategias como foram escritas', () => {
    const html = folha(trilha())
    expect(html).toContain('Habilidades que Miguel já domina')
    expect(html).toContain('Como apoiar Miguel')
    expect(html).toContain('desde novembro de 2026')
    expect(html).toContain('desde março de 2026')
    // A quebra de linha que a equipe escreveu chega ao HTML e aparece na tela.
    expect(html).toContain('Lavar as mãos sozinho,\nseguindo os desenhos.')
    expect(html).toMatch(/whitespace-pre-line[^>]*>Lavar as mãos/)
    for (const texto of ['Na hora de lavar as mãos', 'O que fazer', 'Deixe o cartaz à altura dos olhos.', 'O que evitar',
      'Não faça os passos por ele.', 'Sinal de alerta', 'Tapar os ouvidos com o secador ligado.']) {
      expect(html, texto).toContain(texto)
    }
    // A mais recente vem primeiro, como a resposta mandou.
    expect(html.indexOf('novembro')).toBeLessThan(html.indexOf('março'))
  })

  it('vazios: as duas frases da caixa', () => {
    const html = folha(trilha({ habilidades: [], estrategias: [] }))
    expect(html).toContain('Ainda não há habilidades dominadas registradas. Elas aparecem aqui quando a equipe confirma o domínio de um objetivo.')
    expect(html).toContain('A equipe ainda não escreveu estratégias para Miguel.')
    expect(html).not.toContain('O que fazer')
  })

  it('nenhum botao na folha: o Imprimir fica fora dela, e nao vai para o papel', () => {
    expect(folha(trilha())).not.toContain('<button')
  })
})
