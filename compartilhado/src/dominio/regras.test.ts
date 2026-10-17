import { describe, expect, it } from 'vitest'
import type { Consentimento, NovoObjetivo, RegistroAtividade, Resultado, Sessao } from '../tipos.js'
import {
  ehPreliminar, objetivoSemAvanco,
  calcularExpiracaoConvite, consentimentoVencendo, consentimentoVigente, descricaoNivelSuporte,
  escopoPermiteLeitura, frequenciaEmLinguagemCotidiana, frequenciaSemanalEmPalavras, idadeEmAnos,
  objetivoAtingiuCriterio,
  pacienteSemSessaoRecente, percentualIndependente, planoPrecisaRevisao, podeCorrigirOcorrencia,
  podeDesativarUsuario, situacaoConsentimento, situacaoConvite, suficienciaComparacao,
  textoDoCriterio, textoDoPeriodo,
  validarDevolucaoPlano, validarNovoConsentimento, validarNovoObjetivo, verificarAcessoEscola,
  calcularExpiracaoPrimeiroAcesso, emailValido, erroDaSenhaNova, normalizarEmail, situacaoPrimeiroAcesso,
  escolaParecida,
} from './regras.js'
import { diaCivilEm } from './datas.js'

const AGORA = new Date('2026-09-19T12:00:00Z')
const horas = (h: number) => new Date(AGORA.getTime() + h * 3_600_000).toISOString()
const dias = (d: number) => horas(d * 24)
/** O dia civil, em Manaus, `d` dias depois de AGORA: o formato de validadeAte e dataInicio. */
const diaCivil = (d: number) => diaCivilEm(new Date(AGORA.getTime() + d * 86_400_000))

function consentimento(parcial: Partial<Consentimento> = {}): Consentimento {
  return {
    id: 'c1',
    responsavelId: 'r1',
    pacienteId: 'p1',
    escopos: ['CARTAO_ESTRATEGIA'],
    concedidoEm: dias(-10),
    validadeAte: diaCivil(60),
    revogadoEm: null,
    escolaId: 'e1',
    hashTermo: 'sha256:ficticio',
    ...parcial,
  }
}

/** Sessao com `independentes` acertos em `total` tentativas do objetivo o1. */
function sessao(numero: number, independentes: number, total = 10, situacao: Sessao['situacao'] = 'ENCERRADA'): Sessao {
  const registros: RegistroAtividade[] = Array.from({ length: total }, (_, i) => ({
    id: `r${numero}-${i}`,
    objetivoId: 'o1',
    ordem: i + 1,
    resultado: (i < independentes ? 'INDEPENDENTE' : 'AJUDA_GESTUAL') as Resultado,
    ocorridoEm: dias(-30 + numero),
  }))
  return {
    id: `s${numero}`, pacienteId: 'p1', profissionalId: 'u1', numero,
    inicioPrevistoEm: dias(-30 + numero), inicio: dias(-30 + numero), fim: dias(-30 + numero),
    local: 'Sala 2', situacao, statusSync: 'SINCRONIZADO', registros,
  }
}

const criterio = { percentualMinimo: 80, sessoesConsecutivas: 3 }

describe('idadeEmAnos', () => {
  it('conta o aniversario apenas quando ele ja passou', () => {
    expect(idadeEmAnos('2019-09-19', AGORA)).toBe(7)
    expect(idadeEmAnos('2019-09-20', AGORA)).toBe(6)
    expect(idadeEmAnos('2019-12-01', AGORA)).toBe(6)
  })
})

describe('descricaoNivelSuporte', () => {
  it('sempre traz o numero junto da descricao por extenso', () => {
    expect(descricaoNivelSuporte(1)).toMatch(/^Nível 1 — exige apoio$/)
    expect(descricaoNivelSuporte(2)).toContain('apoio substancial')
    expect(descricaoNivelSuporte(3)).toContain('muito substancial')
  })
})

describe('percentualIndependente', () => {
  it('calcula apenas sobre as tentativas do objetivo', () => {
    const registros: RegistroAtividade[] = [
      { id: '1', objetivoId: 'o1', ordem: 1, resultado: 'INDEPENDENTE', ocorridoEm: dias(0) },
      { id: '2', objetivoId: 'o1', ordem: 2, resultado: 'AJUDA_FISICA', ocorridoEm: dias(0) },
      { id: '3', objetivoId: 'o2', ordem: 3, resultado: 'INDEPENDENTE', ocorridoEm: dias(0) },
    ]
    expect(percentualIndependente(registros, 'o1')).toBe(50)
    expect(percentualIndependente(registros, 'o3')).toBeNull()
  })
})

describe('objetivoAtingiuCriterio', () => {
  it('atinge quando as N sessoes mais recentes ficam no minimo', () => {
    expect(objetivoAtingiuCriterio([sessao(1, 5), sessao(2, 8), sessao(3, 9), sessao(4, 8)], 'o1', criterio)).toBe(true)
  })

  it('nao atinge se uma das N mais recentes ficou abaixo', () => {
    expect(objetivoAtingiuCriterio([sessao(1, 9), sessao(2, 9), sessao(3, 9), sessao(4, 7)], 'o1', criterio)).toBe(false)
  })

  it('nao atinge com menos sessoes do que o criterio pede', () => {
    expect(objetivoAtingiuCriterio([sessao(1, 10), sessao(2, 10)], 'o1', criterio)).toBe(false)
  })

  it('ignora sessoes nao encerradas e sessoes sem tentativa do objetivo', () => {
    const semTentativa = sessao(4, 0, 0)
    const emAndamento = sessao(5, 1, 10, 'EM_ANDAMENTO')
    expect(objetivoAtingiuCriterio([sessao(1, 8), sessao(2, 8), sessao(3, 8), semTentativa, emAndamento], 'o1', criterio)).toBe(true)
  })

  it('ordena pelo numero da sessao, nao pela ordem recebida', () => {
    expect(objetivoAtingiuCriterio([sessao(4, 9), sessao(1, 2), sessao(3, 9), sessao(2, 9)], 'o1', criterio)).toBe(true)
  })
})

describe('objetivoSemAvanco', () => {
  // Oito sessoes sem bater o recorde anterior.
  const paradas = [60, 50, 40, 40, 30, 40, 30, 40, 40, 50]

  it('acusa quando as ultimas oito nao superam o melhor anterior', () => {
    expect(objetivoSemAvanco('EM_AQUISICAO', paradas)).toBe(true)
  })

  it('uma sessao ruim isolada nao conta como parado', () => {
    // O recorde e recente, mesmo com uma queda no meio.
    expect(objetivoSemAvanco('EM_AQUISICAO', [20, 30, 40, 50, 10, 60, 55, 58, 60, 62])).toBe(false)
  })

  it('precisa de mais de oito sessoes para dizer qualquer coisa', () => {
    expect(objetivoSemAvanco('EM_AQUISICAO', [50, 40, 40, 40, 40, 40, 40, 40])).toBe(false)
  })

  it('so vale para objetivo em aquisicao', () => {
    expect(objetivoSemAvanco('DOMINADO', paradas)).toBe(false)
    expect(objetivoSemAvanco('NAO_INICIADO', paradas)).toBe(false)
  })

  it('empatar o recorde nao e avancar', () => {
    expect(objetivoSemAvanco('EM_AQUISICAO', [70, 60, 60, 70, 65, 60, 70, 60, 70])).toBe(true)
  })
})

describe('ehPreliminar', () => {
  it('e preliminar enquanto nao ha leitura clinica', () => {
    expect(ehPreliminar({ leituraClinicaEm: null })).toBe(true)
    expect(ehPreliminar({ leituraClinicaEm: AGORA.toISOString() })).toBe(false)
  })
})

describe('validarNovoObjetivo', () => {
  const valido: NovoObjetivo = {
    dominio: 'Comunicação',
    descricaoTecnica: 'Emitir mando',
    descricaoAcessivel: 'Pedir o que quer',
    criterio,
  }

  it('aceita objetivo completo', () => {
    expect(validarNovoObjetivo(valido)).toEqual({})
  })

  it('recusa descricao acessivel vazia explicando por que o campo existe', () => {
    const erros = validarNovoObjetivo({ ...valido, descricaoAcessivel: '   ' })
    expect(erros.descricaoAcessivel).toMatch(/família e a escola/)
  })

  it('recusa criterio fora da faixa', () => {
    const erros = validarNovoObjetivo({ ...valido, criterio: { percentualMinimo: 120, sessoesConsecutivas: 0 } })
    expect(Object.keys(erros).sort()).toEqual(['percentualMinimo', 'sessoesConsecutivas'])
  })
})

describe('frequenciaEmLinguagemCotidiana', () => {
  it.each([
    [65, '6 ou 7 de cada 10 vezes'],
    [80, '8 de cada 10 vezes'],
    [42, '4 ou 5 de cada 10 vezes'],
    [5, 'menos de 1 de cada 10 vezes'],
    [100, 'todas as vezes'],
  ])('%i%% vira "%s"', (p, texto) => {
    expect(frequenciaEmLinguagemCotidiana(p)).toBe(texto)
  })

  it('nunca devolve o simbolo de percentual', () => {
    for (let p = 0; p <= 100; p++) expect(frequenciaEmLinguagemCotidiana(p)).not.toContain('%')
  })
})

describe('frequenciaSemanalEmPalavras', () => {
  it('escreve por extenso, como a familia le', () => {
    expect(frequenciaSemanalEmPalavras(1)).toBe('uma vez por semana')
    expect(frequenciaSemanalEmPalavras(3)).toBe('três vezes por semana')
    expect(frequenciaSemanalEmPalavras(6)).toBe('seis vezes por semana')
  })

  it('sete vezes e todo dia, e dizer sete soa como meta a bater', () => {
    expect(frequenciaSemanalEmPalavras(7)).toBe('todos os dias')
  })

  it('fora da faixa, volta para dentro dela', () => {
    expect(frequenciaSemanalEmPalavras(0)).toBe('uma vez por semana')
    expect(frequenciaSemanalEmPalavras(12)).toBe('todos os dias')
  })
})

describe('textoDoCriterio e textoDoPeriodo', () => {
  const criterio = { percentualMinimo: 80, sessoesConsecutivas: 3 }

  it('a equipe le percentual', () => {
    expect(textoDoCriterio(criterio, 'PROFISSIONAIS')).toBe('80% em 3 sessões consecutivas')
    expect(textoDoPeriodo([30, 50, 90, 70], 'PROFISSIONAIS'))
      .toBe('primeiro 30% · último 70% · melhor 90%')
  })

  it('a familia le a mesma exigencia em vezes, sem nenhum percentual', () => {
    expect(textoDoCriterio(criterio, 'FAMILIA')).toBe('conseguir 8 de cada 10 vezes, em 3 sessões seguidas')
    expect(textoDoPeriodo([30, 50, 90], 'FAMILIA'))
      .toBe('de 3 de cada 10 vezes para 9 de cada 10 vezes')
    expect(textoDoCriterio(criterio, 'FAMILIA')).not.toContain('%')
    expect(textoDoPeriodo([30, 90], 'FAMILIA')).not.toContain('%')
  })

  it('uma sessao so nao vira "de X para X"', () => {
    expect(textoDoPeriodo([60], 'FAMILIA')).toBe('6 de cada 10 vezes')
  })

  it('sem registro no periodo nao ha o que dizer', () => {
    expect(textoDoPeriodo([], 'FAMILIA')).toBeNull()
    expect(textoDoPeriodo([], 'PROFISSIONAIS')).toBeNull()
  })

  it('uma sessao consecutiva nao vira "1 sessões seguidas"', () => {
    const uma = { percentualMinimo: 100, sessoesConsecutivas: 1 }
    expect(textoDoCriterio(uma, 'PROFISSIONAIS')).toBe('100% em 1 sessão consecutiva')
    expect(textoDoCriterio(uma, 'FAMILIA')).toBe('conseguir todas as vezes, em 1 sessão')
  })
})

describe('consentimento', () => {
  it('vigente entre a concessao e a validade', () => {
    expect(situacaoConsentimento(consentimento(), AGORA)).toBe('VIGENTE')
    expect(consentimentoVigente(consentimento(), AGORA)).toBe(true)
  })

  it('revogacao tem efeito imediato, sem carencia', () => {
    const c = consentimento({ revogadoEm: AGORA.toISOString() })
    expect(situacaoConsentimento(c, AGORA)).toBe('REVOGADO')
    expect(consentimentoVigente(c, AGORA)).toBe(false)
  })

  it('revogacao prevalece sobre a validade', () => {
    expect(situacaoConsentimento(consentimento({ revogadoEm: dias(-1), validadeAte: diaCivil(-2) }), AGORA)).toBe('REVOGADO')
  })

  it('a validade vale o dia inteiro, e expira a 00:00 do dia seguinte em Manaus', () => {
    // Antes: "expira no instante da validade", com validadeAte instante. Agora e
    // dia civil — AGORA (08h em Manaus) cai dentro do dia da validade.
    const hoje = diaCivil(0)
    expect(situacaoConsentimento(consentimento({ validadeAte: hoje }), AGORA)).toBe('VIGENTE')
    expect(situacaoConsentimento(consentimento({ validadeAte: diaCivil(-1) }), AGORA)).toBe('EXPIRADO')
  })

  it('ainda nao vale antes da concessao', () => {
    expect(situacaoConsentimento(consentimento({ concedidoEm: dias(1) }), AGORA)).toBe('AGUARDANDO_INICIO')
  })

  it('escopo permite apenas o que foi concedido', () => {
    expect(escopoPermiteLeitura(consentimento(), 'CARTAO_ESTRATEGIA')).toBe(true)
    expect(escopoPermiteLeitura(consentimento(), 'REGISTRO_OCORRENCIA')).toBe(false)
  })

  it('vencendo apenas quando vigente e a menos de 30 dias do fim', () => {
    expect(consentimentoVencendo(consentimento({ validadeAte: diaCivil(29) }), AGORA)).toBe(true)
    expect(consentimentoVencendo(consentimento({ validadeAte: diaCivil(31) }), AGORA)).toBe(false)
    expect(consentimentoVencendo(consentimento({ validadeAte: diaCivil(10), revogadoEm: dias(-1) }), AGORA)).toBe(false)
  })
})

describe('verificarAcessoEscola (UC21)', () => {
  it('permite com consentimento vigente e escopo concedido', () => {
    expect(verificarAcessoEscola(consentimento(), 'CARTAO_ESTRATEGIA', AGORA)).toEqual({ permitido: true })
  })

  it.each([
    [null, 'CARTAO_ESTRATEGIA', 'SEM_CONSENTIMENTO'],
    [consentimento({ revogadoEm: dias(-1) }), 'CARTAO_ESTRATEGIA', 'REVOGADO'],
    [consentimento({ validadeAte: diaCivil(-1) }), 'CARTAO_ESTRATEGIA', 'EXPIRADO'],
    [consentimento(), 'REGISTRO_OCORRENCIA', 'FORA_DO_ESCOPO'],
  ] as const)('nega e informa o motivo (%#)', (c, escopo, motivo) => {
    expect(verificarAcessoEscola(c, escopo, AGORA)).toEqual({ permitido: false, motivo })
  })
})

describe('validarNovoConsentimento', () => {
  it('exige escopo, escola e validade futura', () => {
    const erros = validarNovoConsentimento({ pacienteId: 'p1', escolaId: '', escopos: [], validadeAte: diaCivil(-1) }, AGORA)
    expect(Object.keys(erros).sort()).toEqual(['escolaId', 'escopos', 'validadeAte'])
  })

  it('aceita pedido completo', () => {
    expect(validarNovoConsentimento({ pacienteId: 'p1', escolaId: 'e1', escopos: ['CARTAO_ESTRATEGIA'], validadeAte: diaCivil(90) }, AGORA)).toEqual({})
  })
})

describe('convite', () => {
  it('expira 72 horas depois de criado', () => {
    expect(calcularExpiracaoConvite(AGORA).toISOString()).toBe(horas(72))
  })

  const convite = (parcial: { expiraEm?: string; usadoEm?: string | null } = {}) => ({
    expiraEm: horas(10),
    usadoEm: null,
    ...parcial,
  })

  it('distingue os quatro estados do token', () => {
    expect(situacaoConvite(convite(), consentimento(), AGORA)).toBe('VALIDO')
    expect(situacaoConvite(convite({ usadoEm: horas(-1) }), consentimento(), AGORA)).toBe('USADO')
    expect(situacaoConvite(convite({ expiraEm: horas(-1) }), consentimento(), AGORA)).toBe('EXPIRADO')
    expect(situacaoConvite(convite(), consentimento({ revogadoEm: horas(-1) }), AGORA)).toBe('CONSENTIMENTO_REVOGADO')
  })

  it('convite ja usado continua usado mesmo apos revogacao', () => {
    expect(situacaoConvite(convite({ usadoEm: horas(-5) }), consentimento({ revogadoEm: horas(-1) }), AGORA)).toBe('USADO')
  })
})

describe('podeCorrigirOcorrencia', () => {
  it('permite ate 30 minutos apos o registro', () => {
    const minutosAtras = (m: number) => new Date(AGORA.getTime() - m * 60_000).toISOString()
    expect(podeCorrigirOcorrencia(minutosAtras(0), AGORA)).toBe(true)
    expect(podeCorrigirOcorrencia(minutosAtras(30), AGORA)).toBe(true)
    expect(podeCorrigirOcorrencia(minutosAtras(31), AGORA)).toBe(false)
  })

  it('recusa registro com data no futuro', () => {
    expect(podeCorrigirOcorrencia(horas(1), AGORA)).toBe(false)
  })
})

describe('suficienciaComparacao', () => {
  const semanal = (n: number) => Array.from({ length: n }, (_, i) => dias(-7 * i))

  it('suficiente com cinco registros em tres semanas em cada contexto', () => {
    const datas = [...semanal(3), dias(-1), dias(-8)]
    expect(suficienciaComparacao({ CLINICA: datas, CASA: datas, ESCOLA: datas })).toEqual({ suficiente: true, faltas: [] })
  })

  it('diz o que falta em cada contexto', () => {
    const ok = semanal(5)
    const mesmaSemana = [dias(0), dias(0), dias(0), dias(0), dias(0)]
    const resultado = suficienciaComparacao({ CLINICA: ok, CASA: mesmaSemana, ESCOLA: semanal(2) })
    expect(resultado.suficiente).toBe(false)
    expect(resultado.faltas).toEqual([
      { contexto: 'CASA', registrosFaltando: 0, semanasFaltando: 2 },
      { contexto: 'ESCOLA', registrosFaltando: 3, semanasFaltando: 1 },
    ])
  })
})

describe('coordenacao', () => {
  it('devolucao de plano exige observacao escrita', () => {
    expect(validarDevolucaoPlano('  ')).toMatch(/justificativa/)
    expect(validarDevolucaoPlano('Rever critério do objetivo 2')).toBeNull()
  })

  it('plano precisa de revisao depois de 90 dias', () => {
    expect(planoPrecisaRevisao({ dataInicio: diaCivil(-200), ultimaRevisaoEm: dias(-91) }, AGORA)).toBe(true)
    expect(planoPrecisaRevisao({ dataInicio: diaCivil(-200), ultimaRevisaoEm: dias(-89) }, AGORA)).toBe(false)
    expect(planoPrecisaRevisao({ dataInicio: diaCivil(-100), ultimaRevisaoEm: null }, AGORA)).toBe(true)
  })

  it('paciente sem sessao ha mais de 15 dias, ou nunca atendido, pede atencao', () => {
    expect(pacienteSemSessaoRecente(dias(-16), AGORA)).toBe(true)
    expect(pacienteSemSessaoRecente(dias(-14), AGORA)).toBe(false)
    expect(pacienteSemSessaoRecente(null, AGORA)).toBe(true)
  })

  it('administrador nao desativa a si mesmo', () => {
    expect(podeDesativarUsuario('u1', 'u1')).toBe(false)
    expect(podeDesativarUsuario('u1', 'u2')).toBe(true)
  })
})

describe('conta e primeiro acesso (docs/07, secao 0)', () => {
  it('o e-mail fica sem espacos nas pontas e em minusculas', () => {
    expect(normalizarEmail('  Ana.Correia@Clinica.EXAMPLE ')).toBe('ana.correia@clinica.example')
    expect(emailValido('ana@clinica.example')).toBe(true)
    expect(emailValido('ana@clinica')).toBe(false)
    expect(emailValido('ana clinica@x.example')).toBe(false)
  })

  it('a senha nova tem de 8 a 128 caracteres', () => {
    expect(erroDaSenhaNova('1234567')).toMatch(/ao menos 8/)
    expect(erroDaSenhaNova('12345678')).toBeNull()
    expect(erroDaSenhaNova('x'.repeat(128))).toBeNull()
    expect(erroDaSenhaNova('x'.repeat(129))).toMatch(/no máximo 128/)
  })

  it('o link vale 72 horas, uma vez', () => {
    const criado = new Date(horas(0))
    const expiraEm = calcularExpiracaoPrimeiroAcesso(criado).toISOString()
    expect(expiraEm).toBe(horas(72))
    expect(situacaoPrimeiroAcesso(null, AGORA)).toBe('INEXISTENTE')
    expect(situacaoPrimeiroAcesso({ expiraEm, usadoEm: null }, new Date(horas(71.99)))).toBe('VALIDO')
    expect(situacaoPrimeiroAcesso({ expiraEm, usadoEm: null }, new Date(horas(72)))).toBe('EXPIRADO')
    expect(situacaoPrimeiroAcesso({ expiraEm, usadoEm: horas(1) }, new Date(horas(2)))).toBe('USADO')
  })
})

describe('escolaParecida (lacuna 4)', () => {
  const vitoria = { nome: 'Escola Municipal Vitória-Régia', municipio: 'Manaus' }

  it('o mesmo nome escrito de outro jeito, no mesmo municipio, parece a mesma escola', () => {
    expect(escolaParecida('EM Vitoria Regia', 'manaus', vitoria)).toBe(true)
    expect(escolaParecida('Vitória-Régia', ' Manaus ', vitoria)).toBe(true)
    expect(escolaParecida('escola municipal vitoria-regia', 'MANAUS', vitoria)).toBe(true)
  })

  it('so as palavras comuns de escola nao bastam', () => {
    expect(escolaParecida('Escola Municipal Rio Negro', 'Manaus', vitoria)).toBe(false)
    expect(escolaParecida('Escola Estadual de Ensino Fundamental', 'Manaus', vitoria)).toBe(false)
  })

  it('outro municipio nunca e a mesma escola', () => {
    expect(escolaParecida('Escola Municipal Vitória-Régia', 'Parintins', vitoria)).toBe(false)
  })

  it('nome vazio nao parece nada', () => {
    expect(escolaParecida('   ', 'Manaus', vitoria)).toBe(false)
  })
})
