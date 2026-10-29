import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CartaoAtividadeFamilia, type AtividadeParaFamilia } from './CartaoAtividadeFamilia'

/**
 * O cartao da atividade, o mesmo nas telas 9 e 16 (item 15): o video vira o
 * link "Ver o video", em nova aba, e so com endereco https://.
 */

const cartao = (urlVideo: string | null, paraQue = '') => {
  const atividade: AtividadeParaFamilia = {
    titulo: 'Lavar as mãos', descricao: 'Antes do almoço.', passos: ['Molhe as mãos.'], dicas: '', frequenciaSemanal: 5,
    urlVideo, paraQue,
  }
  return renderToStaticMarkup(<CartaoAtividadeFamilia atividade={atividade} />)
}

describe('o video da atividade de casa (item 15)', () => {
  it('com https://, o link abre em nova aba, sem dar acesso a tela de origem, e diz isso ao leitor de tela', () => {
    const html = cartao('https://videos.exemplo.org/maos')
    const link = html.match(/<a [^>]*>/)![0]
    expect(link).toContain('href="https://videos.exemplo.org/maos"')
    expect(link).toContain('target="_blank"')
    expect(link).toContain('rel="noopener noreferrer"')
    expect(html).toContain('Ver o vídeo<span class="sr-only"> (abre em nova aba)</span>')
  })

  it('sem video, ou com endereco que nao e https://, nao ha link nenhum', () => {
    for (const url of [null, '', 'javascript:alert(1)', 'http://videos.exemplo.org/maos', 'data:text/html,oi']) {
      const html = cartao(url)
      expect(html, String(url)).not.toContain('<a ')
      expect(html, String(url)).not.toContain('Ver o vídeo')
    }
  })
})

describe('para que serve (item 15b)', () => {
  it('logo abaixo do titulo, antes da frequencia e da descricao', () => {
    const html = cartao(null, 'Cuidar de si com menos ajuda.')
    const posicao = (trecho: string) => html.indexOf(trecho)
    expect(html).toContain('<h4 class="text-base font-bold">Para que serve</h4><p class="texto-corrido mt-1 text-[15px]">Cuidar de si com menos ajuda.</p>')
    expect(posicao('Lavar as mãos')).toBeLessThan(posicao('Para que serve'))
    expect(posicao('Para que serve')).toBeLessThan(posicao('cinco vezes por semana'))
    expect(posicao('Para que serve')).toBeLessThan(posicao('Antes do almoço.'))
  })

  it('sem redacao acessivel, como na previa antes de escolher o objetivo, o bloco nao aparece', () => {
    expect(cartao(null, '  ')).not.toContain('Para que serve')
  })
})

describe('o texto corrido da atividade (item 20)', () => {
  it('para que serve, descricao, passos e dicas sao justificados; o titulo e os rotulos nao', () => {
    const atividade: AtividadeParaFamilia = {
      titulo: 'Lavar as mãos', descricao: 'Antes do almoço.', passos: ['Molhe as mãos.', 'Use sabão.'],
      dicas: 'Cante uma música curta.', frequenciaSemanal: 5, urlVideo: null, paraQue: 'Cuidar de si.',
    }
    const html = renderToStaticMarkup(<CartaoAtividadeFamilia atividade={atividade} />)
    for (const texto of ['Cuidar de si.', 'Antes do almoço.', 'Molhe as mãos.', 'Use sabão.', 'Cante uma música curta.']) {
      expect(html, texto).toMatch(new RegExp(`class="texto-corrido[^"]*">${texto}<`))
    }
    expect(html).not.toMatch(/<h[1-6][^>]*texto-corrido/)
    expect(html.match(/texto-corrido/g)).toHaveLength(5)
  })
})
