import { describe, expect, it } from 'vitest'
import type { RegistroDaTrilha } from '../tipos.js'
import {
  anterioresQueMudaram, camposAnteriores, csvDaAuditoria, descreverFiltroAuditoria, nomeDoArquivoDaAuditoria,
  perfisQueMudaram, semNomeNaTrilhaAdministrativa, validarFiltroAuditoria, versaoAnteriorEmTexto,
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

describe('o filtro da tela 13 (item 17)', () => {
  const ID = '01a18447-66de-72ae-b061-d1da72350bb7'

  it('o filtro certo passa, e o vazio tambem', () => {
    expect(validarFiltroAuditoria({})).toEqual({})
    expect(validarFiltroAuditoria({
      desde: '2026-10-01', ate: '2026-10-01', usuarioId: ID, pacienteId: ID, acao: 'ACESSO_NEGADO', entidade: 'ExecucaoAtividadeCasa',
    })).toEqual({})
  })

  it('cada campo errado e recusado no proprio campo', () => {
    const erro = (filtro: Parameters<typeof validarFiltroAuditoria>[0]) => Object.keys(validarFiltroAuditoria(filtro))
    expect(erro({ desde: '2026-10-01T00:00:00.000Z' })).toEqual(['desde'])
    expect(erro({ ate: '2026-02-30' })).toEqual(['ate'])
    expect(erro({ desde: '2026-10-02', ate: '2026-10-01' })).toEqual(['ate'])
    expect(erro({ usuarioId: 'u-prof-1' })).toEqual(['usuarioId'])
    expect(erro({ pacienteId: `${ID}' or 1=1` })).toEqual(['pacienteId'])
    expect(erro({ acao: 'APAGAR' as never })).toEqual(['acao'])
    expect(erro({ entidade: 'senhaHash' })).toEqual(['entidade'])
  })

  it('quem chama diz o que e identificador: o mock passa os ids legiveis', () => {
    expect(validarFiltroAuditoria({ usuarioId: 'u-prof-1', pacienteId: 'p-001' }, (v) => v !== '')).toEqual({})
  })

  it('a descricao do filtro, para o detalhe da trilha', () => {
    expect(descreverFiltroAuditoria({})).toBe('sem filtro')
    expect(descreverFiltroAuditoria({ desde: '2026-10-01', acao: 'CRIACAO', entidade: 'Sessao' }))
      .toBe('desde 2026-10-01, ação CRIACAO, entidade Sessao')
  })

  it('o arquivo leva o dia de Manaus: as 23h30 la, quando em UTC ja e o dia seguinte', () => {
    expect(nomeDoArquivoDaAuditoria(new Date('2026-10-30T03:30:00.000Z'))).toBe('auditoria-2026-10-29.csv')
  })

  it('o CSV nao tem a coluna do IP, e a celula que comeca com "=" sai protegida', () => {
    const registro = {
      id: 'r-1', ocorridoEm: '2026-10-29T13:00:00.000Z', usuarioId: ID, usuarioNome: '=HYPERLINK("x")', perfil: 'COORDENADOR',
      acao: 'LEITURA_AUTORIZADA', entidade: 'Paciente', idEntidade: null, pacienteId: ID, origem: 'CLINICA',
      detalhe: '+cmd', valorAnterior: null, ipOrigem: '203.0.113.9',
    } as RegistroDaTrilha & { ipOrigem: string }
    const csv = csvDaAuditoria([registro])
    expect(csv.split(String.fromCharCode(13, 10))[0]).not.toMatch(/IP/i)
    expect(csv).not.toContain('203.0.113.9')
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    expect(csv).toContain(`"'+cmd"`)
  })
})
