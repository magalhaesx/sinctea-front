import { describe, expect, it } from 'vitest'
import { aoArtigo, semPontuacaoFinal } from './texto'

describe('semPontuacaoFinal', () => {
  it('rotulo terminado em ponto nao vira "frase.: valor"', () => {
    const rotulo = 'Pedir o que quer, apontando ou falando, sem precisar de ajuda.'
    expect(`${semPontuacaoFinal(rotulo)}: 8 de cada 10 vezes`).not.toContain('.:')
    expect(semPontuacaoFinal(rotulo)).toBe('Pedir o que quer, apontando ou falando, sem precisar de ajuda')
  })

  it('tira tambem virgula, dois-pontos e espaco em branco do fim', () => {
    expect(semPontuacaoFinal('Frequência:')).toBe('Frequência')
    expect(semPontuacaoFinal('Hoje,  ')).toBe('Hoje')
  })

  it('rotulo sem pontuacao fica como esta', () => {
    expect(semPontuacaoFinal('Frequência')).toBe('Frequência')
  })
})

describe('aoArtigo', () => {
  it('contrai os quatro artigos', () => {
    expect(aoArtigo('o cartão de estratégias')).toBe('ao cartão de estratégias')
    expect(aoArtigo('a ficha deste paciente')).toBe('à ficha deste paciente')
    expect(aoArtigo('os registros desta atividade')).toBe('aos registros desta atividade')
    expect(aoArtigo('as sessões por profissional')).toBe('às sessões por profissional')
  })

  it('expressao sem artigo fica com a preposicao solta', () => {
    // "Voce nao tem acesso a esta ficha" — sem artigo, nao ha o que contrair.
    expect(aoArtigo('esta ficha')).toBe('a esta ficha')
    expect(aoArtigo('este relatório')).toBe('a este relatório')
  })

  it('nao confunde palavra que comeca com o artigo', () => {
    expect(aoArtigo('ocorrências da escola')).toBe('a ocorrências da escola')
  })
})
