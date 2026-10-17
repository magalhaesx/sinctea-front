import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { uuidV7 } from '../prisma/semente/uuid7.js'
import { resumoDoToken } from '../src/autenticacao/tokens.js'
import type { PrismaClient } from '../src/gerado/client.js'
import { clienteDe, criarBancoMigrado } from './apoio/banco.js'

/**
 * Caminhos coerentes (migracao caminhos_coerentes): quando uma linha chega a
 * outra por dois caminhos, os dois levam ao mesmo lugar. Chave estrangeira
 * composta onde ha coluna para isso; trigger onde o caminho tem mais de um
 * passo, ou onde a coluna e a que define o dono.
 *
 * Cada caso tem o incoerente, recusado pelo nome da restricao ou pela
 * mensagem do trigger, e o coerente, que passa — sem o coerente, uma recusa
 * por outro motivo pareceria a regra funcionando.
 */

let prisma: PrismaClient
let apagar: () => Promise<void>

/** Dois pacientes, A e B, cada um com o seu plano, sessao e consentimento. */
const m = {
  profissional: uuidV7(), responsavel: uuidV7(), professor: uuidV7(), outroProfessor: uuidV7(),
  escola: uuidV7(),
  pacienteA: uuidV7(), pacienteB: uuidV7(),
  planoA: uuidV7(), planoB: uuidV7(), objetivoA: uuidV7(), objetivoB: uuidV7(),
  sessaoA: uuidV7(), sessaoB: uuidV7(),
  consentimentoA: uuidV7(), consentimentoB: uuidV7(),
  conviteA: uuidV7(), conviteB: uuidV7(), vinculoA: uuidV7(), ocorrenciaEscolarA: uuidV7(),
}

const agora = new Date()
const dia = (d: string) => new Date(`${d}T00:00:00.000Z`)
const RECUSA_FK = (nome: string) => new RegExp(nome)

async function usuario(id: string, perfil: 'TERAPEUTA' | 'RESPONSAVEL' | 'PROFESSOR') {
  await prisma.usuario.create({ data: {
    id, nome: `Pessoa ${perfil}`, email: `${id}@teste.example`, senhaHash: '$argon2id$ficticio',
    perfis: [perfil], ativo: true,
  } })
}

async function novoConvite(consentimentoId: string): Promise<string> {
  const id = uuidV7()
  await prisma.conviteEscolar.create({ data: {
    id, consentimentoId, tokenResumo: resumoDoToken(uuidV7()), criadoEm: agora, expiraEm: agora,
  } })
  return id
}

async function novaOcorrenciaEscolar(pacienteId = m.pacienteA, professorId = m.professor): Promise<string> {
  const id = uuidV7()
  await prisma.ocorrenciaEscolar.create({ data: {
    id, vinculoId: m.vinculoA, pacienteId, professorId, ocorridoEm: agora, registradaEm: agora,
    tipo: 'Tapou os ouvidos', intensidade: 2, contexto: 'Recreio',
  } })
  return id
}

function comportamental(pacienteId: string, extra: { sessaoId?: string; ocorrenciaEscolarId?: string }) {
  return prisma.ocorrenciaComportamental.create({ data: {
    pacienteId, origem: extra.ocorrenciaEscolarId ? 'ESCOLA' : 'CLINICA', ocorridaEm: agora,
    antecedente: 'Antecedente.', comportamento: 'Comportamento.', consequencia: 'Consequencia.',
    intensidade: 2, ...extra,
  } })
}

beforeAll(async () => {
  const banco = await criarBancoMigrado(inject('urlAdministrativa'), 'sinctea_caminhos')
  apagar = banco.apagar
  prisma = clienteDe(banco.url)

  await usuario(m.profissional, 'TERAPEUTA')
  await usuario(m.responsavel, 'RESPONSAVEL')
  await usuario(m.professor, 'PROFESSOR')
  await usuario(m.outroProfessor, 'PROFESSOR')
  await prisma.profissional.create({ data: { usuarioId: m.profissional, especialidade: 'TO', registroConselho: 'X-FICT' } })
  await prisma.responsavel.create({ data: { usuarioId: m.responsavel, telefone: '(92) 90000-0000' } })
  await prisma.professorAEE.createMany({ data: [{ usuarioId: m.professor }, { usuarioId: m.outroProfessor }] })
  await prisma.escola.create({ data: { id: m.escola, nome: 'Escola Ficticia', rede: 'Municipal', municipio: 'Manaus' } })

  for (const [paciente, plano, objetivo, sessao, consentimento, convite] of [
    [m.pacienteA, m.planoA, m.objetivoA, m.sessaoA, m.consentimentoA, m.conviteA],
    [m.pacienteB, m.planoB, m.objetivoB, m.sessaoB, m.consentimentoB, m.conviteB],
  ]) {
    await prisma.paciente.create({ data: {
      id: paciente, nome: 'Paciente Ficticio', dataNascimento: dia('2019-01-01'), nivelSuporte: 2,
      profissionalResponsavelId: m.profissional, ativo: true,
    } })
    await prisma.planoTerapeutico.create({ data: {
      id: plano, pacienteId: paciente, autorId: m.profissional, status: 'VIGENTE',
      dataInicio: dia('2026-01-01'), dataRevisao: dia('2026-07-01'),
    } })
    await prisma.objetivo.create({ data: {
      id: objetivo, planoId: plano, dominio: 'Comunicacao', descricaoTecnica: 'Tecnica.',
      descricaoAcessivel: 'Acessivel.', status: 'EM_AQUISICAO', percentualAtual: 50,
      percentualMinimo: 80, sessoesConsecutivas: 3,
    } })
    await prisma.sessao.create({ data: {
      id: sessao, pacienteId: paciente, profissionalId: m.profissional, numero: 1,
      inicioPrevistoEm: agora, local: 'Sala 1', situacao: 'AGENDADA', statusSync: 'SINCRONIZADO',
    } })
    await prisma.consentimento.create({ data: {
      id: consentimento, responsavelId: m.responsavel, pacienteId: paciente, escolaId: m.escola,
      escopos: ['CARTAO_ESTRATEGIA', 'REGISTRO_OCORRENCIA'], concedidoEm: agora,
      validadeAte: dia('2099-01-01'), hashTermo: 'sha256:2026-10:0',
    } })
    await prisma.conviteEscolar.create({ data: {
      id: convite, consentimentoId: consentimento, tokenResumo: resumoDoToken(uuidV7()), criadoEm: agora, expiraEm: agora,
    } })
  }
  await prisma.vinculoEscolar.create({ data: {
    id: m.vinculoA, consentimentoId: m.consentimentoA, conviteId: m.conviteA, pacienteId: m.pacienteA,
    professorId: m.professor, turma: '2 A', turno: 'Matutino', atuacao: 'Regente', status: 'ATIVO',
  } })
  await novaOcorrenciaEscolar()
})

afterAll(async () => {
  await prisma?.$disconnect()
  await apagar?.()
})

describe('chaves estrangeiras compostas', () => {
  const vinculo = (consentimentoId: string, conviteId: string, pacienteId: string) =>
    prisma.vinculoEscolar.create({ data: {
      consentimentoId, conviteId, pacienteId, professorId: m.professor,
      turma: '2 A', turno: 'Matutino', atuacao: 'Regente', status: 'ATIVO',
    } })

  it('vinculo_escolar: o consentimento e do mesmo paciente', async () => {
    await expect(vinculo(m.consentimentoA, await novoConvite(m.consentimentoA), m.pacienteB))
      .rejects.toThrow(RECUSA_FK('vinculo_escolar_consentimentoId_pacienteId_fkey'))
    await expect(vinculo(m.consentimentoA, await novoConvite(m.consentimentoA), m.pacienteA)).resolves.toBeTruthy()
  })

  it('vinculo_escolar: o convite e do mesmo consentimento', async () => {
    await expect(vinculo(m.consentimentoA, await novoConvite(m.consentimentoB), m.pacienteA))
      .rejects.toThrow(RECUSA_FK('vinculo_escolar_conviteId_consentimentoId_fkey'))
    await expect(vinculo(m.consentimentoB, await novoConvite(m.consentimentoB), m.pacienteB)).resolves.toBeTruthy()
  })

  it('ocorrencia_escolar: o vinculo e do mesmo paciente e do mesmo professor', async () => {
    const nome = RECUSA_FK('ocorrencia_escolar_vinculoId_pacienteId_professorId_fkey')
    await expect(novaOcorrenciaEscolar(m.pacienteB, m.professor)).rejects.toThrow(nome)
    await expect(novaOcorrenciaEscolar(m.pacienteA, m.outroProfessor)).rejects.toThrow(nome)
    await expect(novaOcorrenciaEscolar(m.pacienteA, m.professor)).resolves.toBeTruthy()
  })

  it('ocorrencia_comportamental: a ocorrencia da escola que a gerou e do mesmo paciente', async () => {
    await expect(comportamental(m.pacienteB, { ocorrenciaEscolarId: await novaOcorrenciaEscolar() }))
      .rejects.toThrow(RECUSA_FK('ocorrencia_comportamental_ocorrenciaEscolarId_pacienteId_fkey'))
    await expect(comportamental(m.pacienteA, { ocorrenciaEscolarId: await novaOcorrenciaEscolar() }))
      .resolves.toBeTruthy()
  })

  it('ocorrencia_comportamental: a sessao e do mesmo paciente', async () => {
    await expect(comportamental(m.pacienteB, { sessaoId: m.sessaoA }))
      .rejects.toThrow(RECUSA_FK('ocorrencia_comportamental_sessaoId_pacienteId_fkey'))
    await expect(comportamental(m.pacienteA, { sessaoId: m.sessaoA })).resolves.toBeTruthy()
  })
})

describe('triggers de caminho', () => {
  const OUTRO_PACIENTE = /e de outro paciente/

  const atividade = (pacienteId: string, objetivoId: string) => prisma.atividadeCasa.create({ data: {
    pacienteId, objetivoId, titulo: 'Atividade', descricao: '', passos: ['Um passo.'], dicas: '',
    frequenciaSemanal: 2, ativa: true, prescritaEm: agora,
  } })

  it('atividade_casa: o objetivo e do plano do mesmo paciente, ao criar e ao alterar', async () => {
    await expect(atividade(m.pacienteA, m.objetivoB)).rejects.toThrow(OUTRO_PACIENTE)
    const criada = await atividade(m.pacienteA, m.objetivoA)
    await expect(prisma.atividadeCasa.update({ where: { id: criada.id }, data: { objetivoId: m.objetivoB } }))
      .rejects.toThrow(OUTRO_PACIENTE)
  })

  const registro = (sessaoId: string, objetivoId: string) => prisma.registroAtividade.create({ data: {
    sessaoId, objetivoId, ordem: 1, resultado: 'INDEPENDENTE', ocorridoEm: agora,
  } })

  it('registro_atividade: o objetivo e do paciente da sessao', async () => {
    await expect(registro(m.sessaoA, m.objetivoB)).rejects.toThrow(OUTRO_PACIENTE)
    await expect(registro(m.sessaoA, m.objetivoA)).resolves.toBeTruthy()
  })

  const relatorio = (objetivoIds: string[]) => prisma.relatorioEvolucao.create({ data: {
    pacienteId: m.pacienteA, objetivoIds, periodoInicio: dia('2026-09-01'), periodoFim: dia('2026-09-30'),
    destinatario: 'PROFISSIONAIS', consideracoes: 'Leitura.', autorNome: 'Profissional',
    autorRegistro: 'X-FICT', emitidoEm: agora, conteudoEmitido: '{}', hashConteudo: 'sha256:0',
  } })

  it('relatorio_evolucao: so objetivos que existem e sao do paciente', async () => {
    const RECUSA = /relatorio cobre objetivo inexistente ou de outro paciente/
    await expect(relatorio([m.objetivoA, m.objetivoB])).rejects.toThrow(RECUSA)
    await expect(relatorio([uuidV7()])).rejects.toThrow(RECUSA)
    await expect(relatorio([m.objetivoA])).resolves.toBeTruthy()
  })
})

describe('o dono nao muda, e prontuario nao se apaga', () => {
  const DONO_FIXO = /nao muda depois de criado/

  it('trocar o paciente do plano, o plano do objetivo ou o paciente da sessao e recusado', async () => {
    await expect(prisma.planoTerapeutico.update({ where: { id: m.planoA }, data: { pacienteId: m.pacienteB } }))
      .rejects.toThrow(DONO_FIXO)
    await expect(prisma.objetivo.update({ where: { id: m.objetivoA }, data: { planoId: m.planoB } }))
      .rejects.toThrow(DONO_FIXO)
    await expect(prisma.sessao.update({ where: { id: m.sessaoA }, data: { pacienteId: m.pacienteB } }))
      .rejects.toThrow(DONO_FIXO)
  })

  it('alterar outra coluna dos tres continua permitido', async () => {
    await expect(prisma.planoTerapeutico.update({ where: { id: m.planoA }, data: { status: 'DEVOLVIDO' } }))
      .resolves.toBeTruthy()
    await expect(prisma.sessao.update({ where: { id: m.sessaoA }, data: { local: 'Sala 2' } })).resolves.toBeTruthy()
  })

  it('apagar um plano que tem objetivos e recusado', async () => {
    await expect(prisma.planoTerapeutico.delete({ where: { id: m.planoB } }))
      .rejects.toThrow(/objetivo_planoId_fkey/)
    expect(await prisma.objetivo.count({ where: { planoId: m.planoB } })).toBe(1)
  })
})

/**
 * Sem cascata na atualizacao (migracao chaves_compostas_sem_cascata). Com
 * ON UPDATE CASCADE, trocar o paciente do consentimento levaria junto, em
 * silencio, o vinculo e as ocorrencias para outro paciente. A recusa e
 * conferida pelo nome da chave de quem aponta: com Cascade, ou a troca
 * passaria, ou quem recusaria seria outra chave, mais adiante na cadeia.
 */
describe('sem cascata na atualizacao', () => {
  it('trocar o paciente de um consentimento com vinculo e recusado', async () => {
    await expect(prisma.consentimento.update({ where: { id: m.consentimentoA }, data: { pacienteId: m.pacienteB } }))
      .rejects.toThrow(RECUSA_FK('vinculo_escolar_consentimentoId_pacienteId_fkey'))
    const vinculo = await prisma.vinculoEscolar.findUniqueOrThrow({ where: { id: m.vinculoA } })
    expect(vinculo.pacienteId).toBe(m.pacienteA)
    expect(await prisma.ocorrenciaEscolar.count({ where: { vinculoId: m.vinculoA, pacienteId: m.pacienteB } })).toBe(0)
  })

  it('trocar o paciente ou o professor de um vinculo com ocorrencia e recusado', async () => {
    const nome = RECUSA_FK('ocorrencia_escolar_vinculoId_pacienteId_professorId_fkey')
    await expect(prisma.vinculoEscolar.update({ where: { id: m.vinculoA }, data: { pacienteId: m.pacienteB } }))
      .rejects.toThrow(nome)
    await expect(prisma.vinculoEscolar.update({ where: { id: m.vinculoA }, data: { professorId: m.outroProfessor } }))
      .rejects.toThrow(nome)
  })

  it('trocar o consentimento de um convite ja aceito e recusado', async () => {
    await expect(prisma.conviteEscolar.update({ where: { id: m.conviteA }, data: { consentimentoId: m.consentimentoB } }))
      .rejects.toThrow(RECUSA_FK('vinculo_escolar_conviteId_consentimentoId_fkey'))
  })

  it('trocar o paciente de uma ocorrencia da escola que ja gerou evento comportamental e recusado', async () => {
    const ocorrenciaEscolarId = await novaOcorrenciaEscolar()
    await comportamental(m.pacienteA, { ocorrenciaEscolarId })
    await expect(prisma.ocorrenciaEscolar.update({ where: { id: ocorrenciaEscolarId }, data: { pacienteId: m.pacienteB } }))
      .rejects.toThrow(RECUSA_FK('ocorrencia_comportamental_ocorrenciaEscolarId_pacienteId_fkey'))
  })

  it('alterar outra coluna do consentimento e do vinculo continua permitido', async () => {
    await expect(prisma.consentimento.update({ where: { id: m.consentimentoA }, data: { hashTermo: 'sha256:2026-10:1' } }))
      .resolves.toBeTruthy()
    await expect(prisma.vinculoEscolar.update({ where: { id: m.vinculoA }, data: { turma: '2 B' } })).resolves.toBeTruthy()
  })
})
