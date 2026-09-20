import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Tabela, type Coluna } from './Tabela'

/**
 * A marcacao da tabela e requisito de acessibilidade, nao detalhe de estilo:
 * `caption` nomeia a tabela e `th scope` liga cada celula ao seu cabecalho
 * (docs/02, secao 4 e item 3 do piso da secao 6).
 */

interface Linha { id: string; nome: string; idade: number }

const colunas: Coluna<Linha>[] = [
  { id: 'nome', titulo: 'Paciente', celula: (l) => l.nome },
  { id: 'idade', titulo: 'Idade', numerica: true, celula: (l) => `${l.idade} anos` },
]

const linhas: Linha[] = [
  { id: 'p-1', nome: 'Paciente Fictício Um', idade: 7 },
  { id: 'p-2', nome: 'Paciente Fictício Dois', idade: 9 },
]

const marcacao = () => renderToStaticMarkup(
  <Tabela legenda="Pacientes que você acompanha" colunas={colunas} linhas={linhas} chave={(l) => l.id} />,
)

describe('Tabela', () => {
  it('tem caption com o nome da tabela', () => {
    expect(marcacao()).toMatch(/<caption[^>]*>Pacientes que você acompanha<\/caption>/)
  })

  it('marca os cabecalhos de coluna com scope="col"', () => {
    const html = marcacao()
    expect(html.match(/<th scope="col"/g)).toHaveLength(2)
    expect(html).toContain('Paciente')
    expect(html).toContain('Idade')
  })

  it('a primeira celula de cada linha e cabecalho de linha', () => {
    const html = marcacao()
    expect(html.match(/<th scope="row"/g)).toHaveLength(linhas.length)
  })

  it('rola no recipiente proprio, nao na pagina', () => {
    expect(marcacao()).toContain('overflow-x-auto')
  })
})
