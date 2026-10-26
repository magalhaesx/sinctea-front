import { describe, expect, it } from 'vitest'
import {
  anterioresQueMudaram, camposAnteriores, perfisQueMudaram, semNomeNaTrilhaAdministrativa, versaoAnteriorEmTexto,
} from './auditoria.js'
import { jsonCanonico } from './hash.js'

describe('versaoAnteriorEmTexto', () => {
  it('os tres campos viram pares legiveis, na ordem do JSON canonico', () => {
    const anterior = jsonCanonico({ tipo: 'Tapou os ouvidos', intensidade: 3, contexto: 'Recreio' })
    expect(versaoAnteriorEmTexto(anterior))
      .toBe('Em que momento: Recreio · Intensidade: 3 · O que aconteceu: Tapou os ouvidos')
  })

  it('sem versao anterior, nada a dizer', () => {
    expect(versaoAnteriorEmTexto(null)).toBe('')
  })

  it('chave desconhecida aparece pelo proprio nome', () => {
    // A trilha vai receber alteracoes de outras entidades: esconder o que
    // ainda nao se sabe nomear seria pior do que mostrar a chave.
    expect(versaoAnteriorEmTexto('{"turno":"Matutino"}')).toBe('turno: Matutino')
  })

  it('texto que nao e JSON nao se perde', () => {
    expect(versaoAnteriorEmTexto('algo antigo')).toBe('Valor anterior: algo antigo')
  })
})

describe('anterioresQueMudaram (item 7)', () => {
  const antes = { descricaoTecnica: 'A', descricaoAcessivel: 'B', percentualMinimo: 80, sessoesConsecutivas: 2 }

  it('so os campos que mudaram, com o valor de antes', () => {
    expect(anterioresQueMudaram(antes, { ...antes, descricaoAcessivel: 'B2', percentualMinimo: 90 }))
      .toEqual({ descricaoAcessivel: 'B', percentualMinimo: 80 })
  })

  it('nada mudou: nulo, e nao ha o que registrar', () => {
    expect(anterioresQueMudaram(antes, { ...antes })).toBeNull()
  })

  it('os campos editados viram nomes de gente na trilha', () => {
    expect(versaoAnteriorEmTexto(jsonCanonico({ descricaoAcessivel: 'B', dataRevisao: '2027-04-01' })))
      .toBe('Revisão do plano: 2027-04-01 · Redação acessível: B')
  })
})

describe('a conta na trilha (item 13b)', () => {
  it('perfis: os de antes, se o conjunto mudou; a ordem nao conta', () => {
    expect(perfisQueMudaram(['COORDENADOR'], ['TERAPEUTA', 'COORDENADOR'])).toEqual({ perfis: ['COORDENADOR'] })
    expect(perfisQueMudaram(['TERAPEUTA', 'COORDENADOR'], ['COORDENADOR', 'TERAPEUTA'])).toBeNull()
  })

  it('lista, sim ou nao e em branco se leem como gente', () => {
    expect(versaoAnteriorEmTexto(jsonCanonico({ ativo: true, perfis: ['COORDENADOR', 'TERAPEUTA'] })))
      .toBe('Conta ativa: Sim · Perfis: COORDENADOR, TERAPEUTA')
    expect(versaoAnteriorEmTexto(jsonCanonico({ registroConselho: null }))).toBe('Registro no conselho: Em branco')
  })

  it('quem le pode dar nome de gente a um valor, e o resto fica como o dominio le', () => {
    const comoLer = (campo: string) => (campo === 'perfis' ? 'Coordenador clínico' : undefined)
    expect(camposAnteriores(jsonCanonico({ ativo: false, perfis: ['COORDENADOR'] }), comoLer))
      .toEqual([['ativo', 'Não'], ['perfis', 'Coordenador clínico']])
  })

  it('so a escola cadastrada por responsavel sai sem quem agiu', () => {
    expect(semNomeNaTrilhaAdministrativa({ entidade: 'Escola', perfil: 'RESPONSAVEL' })).toBe(true)
    expect(semNomeNaTrilhaAdministrativa({ entidade: 'Usuario', perfil: 'RESPONSAVEL' })).toBe(false)
    expect(semNomeNaTrilhaAdministrativa({ entidade: 'Escola', perfil: 'ADMINISTRADOR' })).toBe(false)
  })
})
