import { describe, expect, it } from 'vitest'
import { ErroServico } from '../servicos'
import { descreverErro } from './EstadoErro'
import { paginasVisiveis } from './Paginacao'

describe('paginasVisiveis', () => {
  it('mostra todas quando cabem em sete posicoes', () => {
    expect(paginasVisiveis(1, 1)).toEqual([1])
    expect(paginasVisiveis(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('no inicio, mostra as cinco primeiras e a ultima', () => {
    expect(paginasVisiveis(2, 20)).toEqual([1, 2, 3, 4, 5, 'reticencias', 20])
  })

  it('no fim, mostra a primeira e as cinco ultimas', () => {
    expect(paginasVisiveis(19, 20)).toEqual([1, 'reticencias', 16, 17, 18, 19, 20])
  })

  it('no meio, mostra a atual com as vizinhas', () => {
    expect(paginasVisiveis(10, 20)).toEqual([1, 'reticencias', 9, 10, 11, 'reticencias', 20])
  })

  it('nunca passa de sete posicoes e sempre inclui a atual', () => {
    for (let total = 1; total <= 30; total++) {
      for (let atual = 1; atual <= total; atual++) {
        const itens = paginasVisiveis(atual, total)
        expect(itens.length).toBeLessThanOrEqual(7)
        expect(itens).toContain(atual)
      }
    }
  })
})

describe('descreverErro', () => {
  it('falha de rede vira frase sobre o que nao carregou, sem codigo tecnico', () => {
    const { titulo, texto } = descreverErro(new ErroServico('INDISPONIVEL', 'Falha simulada (VITE_MOCK_FALHA).'), 'a lista de pacientes')
    expect(titulo).toBe('Não foi possível carregar a lista de pacientes')
    expect(texto).not.toMatch(/VITE_|INDISPONIVEL|simulada/)
    expect(texto).toMatch(/Tente de novo/)
  })

  it('acesso negado usa a explicacao do servico', () => {
    const erro = new ErroServico('ACESSO_NEGADO', 'A família encerrou o acesso a estas informações.')
    expect(descreverErro(erro, 'o cartão de estratégias').texto).toBe('A família encerrou o acesso a estas informações.')
  })

  it('erro desconhecido nao vaza a mensagem original', () => {
    const { texto } = descreverErro(new TypeError("Cannot read properties of undefined (reading 'x')"), 'o plano')
    expect(texto).not.toMatch(/Cannot|undefined/)
  })
})
