import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { uuidV7 } from '../prisma/semente/uuid7.js'
import type { PrismaClient } from '../src/gerado/client.js'
import { clienteDe, criarBancoMigrado } from './apoio/banco.js'

/**
 * Os CHECKs da migracao (docs/01, secao 7): faixas fechadas e atributos [1..*].
 * Cada recusa e conferida pelo nome da restricao — sem isso, uma chave
 * estrangeira faltando passaria por CHECK funcionando. E cada caso tem o seu
 * controle: o valor de dentro da faixa passa.
 */

let prisma: PrismaClient
let apagar: () => Promise<void>
const profissional = uuidV7()
const responsavel = uuidV7()
const escola = uuidV7()
let pacienteId: string

const paciente = (nivelSuporte: number) => ({
  id: uuidV7(), nome: 'Paciente Ficticio', dataNascimento: new Date('2019-01-01T00:00:00Z'),
  nivelSuporte, profissionalResponsavelId: profissional, ativo: true,
})

beforeAll(async () => {
  const banco = await criarBancoMigrado(inject('urlAdministrativa'), 'sinctea_checks')
  apagar = banco.apagar
  prisma = clienteDe(banco.url)

  await prisma.usuario.createMany({ data: [
    { id: profissional, nome: 'Profissional Ficticia', email: 'profissional@teste.example',
      senhaHash: '$argon2id$ficticio', perfis: ['TERAPEUTA'], ativo: true },
    { id: responsavel, nome: 'Responsavel Ficticio', email: 'responsavel@teste.example',
      senhaHash: '$argon2id$ficticio', perfis: ['RESPONSAVEL'], ativo: true },
  ] })
  await prisma.profissional.create({ data: {
    usuarioId: profissional, especialidade: 'Psicologia', registroConselho: 'CRP 0000-FICT',
  } })
  await prisma.responsavel.create({ data: { usuarioId: responsavel, telefone: '(92) 90000-0000' } })
  await prisma.escola.create({ data: { id: escola, nome: 'Escola Ficticia', rede: 'Municipal', municipio: 'Manaus' } })
  pacienteId = (await prisma.paciente.create({ data: paciente(2) })).id
})

afterAll(async () => {
  await prisma?.$disconnect()
  await apagar?.()
})

describe('faixas fechadas', () => {
  it('nivelSuporte 4 e recusado; 3 passa', async () => {
    await expect(prisma.paciente.create({ data: paciente(4) })).rejects.toThrow(/paciente_nivel_suporte_faixa/)
    await expect(prisma.paciente.create({ data: paciente(3) })).resolves.toBeTruthy()
  })

  it('intensidade 6 e recusada; 5 passa', async () => {
    const ocorrencia = (intensidade: number) => prisma.ocorrenciaComportamental.create({ data: {
      pacienteId, origem: 'CLINICA', ocorridaEm: new Date(), antecedente: 'Antecedente.',
      comportamento: 'Comportamento.', consequencia: 'Consequencia.', intensidade,
    } })
    await expect(ocorrencia(6)).rejects.toThrow(/ocorrencia_comportamental_intensidade_faixa/)
    await expect(ocorrencia(5)).resolves.toBeTruthy()
  })
})

describe('atributos [1..*]', () => {
  it('escopos vazio e recusado; com um escopo passa', async () => {
    const consentimento = (escopos: Array<'CARTAO_ESTRATEGIA'>) => prisma.consentimento.create({ data: {
      responsavelId: responsavel, pacienteId, escolaId: escola, escopos, concedidoEm: new Date(),
      validadeAte: new Date('2099-01-01T00:00:00Z'), hashTermo: 'sha256:2026-10:0',
    } })
    await expect(consentimento([])).rejects.toThrow(/consentimento_escopos_nao_vazio/)
    await expect(consentimento(['CARTAO_ESTRATEGIA'])).resolves.toBeTruthy()
  })
})

/**
 * Item 15b: os limites da atividade de casa, por INSERT em SQL, por fora do
 * dominio e do Prisma. Cada caso parte de uma linha valida e muda uma coluna
 * so; a recusa e conferida pelo nome do CHECK.
 */
describe('limites da atividade de casa (item 15b)', () => {
  let objetivoId: string
  let atividadeId: string

  const VALIDA = {
    titulo: 'Escolher o lanche apontando', descricao: '', passos: ['Mostre duas opções.'], dicas: '',
    frequenciaSemanal: 3, urlVideo: null as string | null,
  }
  const atividade = (mudanca: Partial<Record<keyof typeof VALIDA, unknown>> = {}) => {
    const a = { ...VALIDA, ...mudanca }
    return prisma.$executeRawUnsafe(
      `INSERT INTO "atividade_casa" ("id", "pacienteId", "objetivoId", "titulo", "descricao", "passos", "dicas",
         "frequenciaSemanal", "urlVideo", "ativa", "prescritaEm")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::text[], $7, $8, $9, true, now())`,
      uuidV7(), pacienteId, objetivoId, a.titulo, a.descricao, a.passos, a.dicas, a.frequenciaSemanal, a.urlVideo,
    )
  }
  let dia = 0
  const execucao = (observacao: string | null) => prisma.$executeRawUnsafe(
    `INSERT INTO "execucao_atividade_casa" ("id", "atividadeId", "responsavelId", "dataRealizacao", "desempenho", "observacao")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::date, 'SOZINHO', $5)`,
    // Um dia por insert: o indice unico do item 15 nao entra na conta.
    uuidV7(), atividadeId, responsavel, `2026-10-${String(++dia).padStart(2, '0')}`, observacao,
  )
  const x = (n: number) => 'x'.repeat(n)

  beforeAll(async () => {
    const plano = await prisma.planoTerapeutico.create({ data: {
      pacienteId, autorId: profissional, status: 'VIGENTE',
      dataInicio: new Date('2026-10-01T00:00:00Z'), dataRevisao: new Date('2027-04-01T00:00:00Z'),
    } })
    objetivoId = (await prisma.objetivo.create({ data: {
      planoId: plano.id, dominio: 'Comunicação', descricaoTecnica: 'Mando com figura.', descricaoAcessivel: 'Pedir apontando.',
      status: 'EM_AQUISICAO', percentualAtual: 0, percentualMinimo: 80, sessoesConsecutivas: 2,
    } })).id
    await expect(atividade()).resolves.toBe(1)
    atividadeId = (await prisma.atividadeCasa.findFirstOrThrow({ where: { objetivoId } })).id
  })

  it('frequenciaSemanal 0 e 8 sao recusadas; 1 e 7 passam', async () => {
    for (const frequenciaSemanal of [0, 8]) {
      await expect(atividade({ frequenciaSemanal }), String(frequenciaSemanal)).rejects.toThrow(/atividade_casa_frequencia_semanal_faixa/)
    }
    for (const frequenciaSemanal of [1, 7]) await expect(atividade({ frequenciaSemanal })).resolves.toBe(1)
  })

  it('passos: nenhum, nulo ou onze sao recusados; dez passam', async () => {
    for (const passos of [[], null, Array.from({ length: 11 }, () => 'Passo.')]) {
      await expect(atividade({ passos }), JSON.stringify(passos)).rejects.toThrow(/atividade_casa_passos_faixa/)
    }
    await expect(atividade({ passos: Array.from({ length: 10 }, () => 'Passo.') })).resolves.toBe(1)
  })

  it('o video: javascript:, http:, HTTPS em maiusculas e 501 caracteres sao recusados; nulo e https:// de 500 passam', async () => {
    for (const urlVideo of ['javascript:alert(1)', 'http://videos.exemplo.org/a', 'HTTPS://videos.exemplo.org/a', `https://v.exemplo.org/${x(479)}`]) {
      await expect(atividade({ urlVideo }), urlVideo).rejects.toThrow(/atividade_casa_url_video_https/)
    }
    for (const urlVideo of [null, `https://v.exemplo.org/${x(478)}`]) await expect(atividade({ urlVideo })).resolves.toBe(1)
  })

  it('titulo vazio e de 121 sao recusados; descricao e dicas de 1001 tambem; nos limites, passam', async () => {
    for (const titulo of ['', x(121)]) {
      await expect(atividade({ titulo }), `titulo ${titulo.length}`).rejects.toThrow(/atividade_casa_titulo_tamanho/)
    }
    await expect(atividade({ descricao: x(1001) })).rejects.toThrow(/atividade_casa_descricao_tamanho/)
    await expect(atividade({ dicas: x(1001) })).rejects.toThrow(/atividade_casa_dicas_tamanho/)
    // Tamanho e em caracteres, e nao em bytes: 120 letras acentuadas passam.
    await expect(atividade({ titulo: 'ã'.repeat(120), descricao: x(1000), dicas: x(1000) })).resolves.toBe(1)
    await expect(atividade({ titulo: 'x' })).resolves.toBe(1)
  })

  it('observacao da execucao de 501 e recusada; nula e de 500 passam', async () => {
    await expect(execucao(x(501))).rejects.toThrow(/execucao_atividade_casa_observacao_tamanho/)
    await expect(execucao(null)).resolves.toBe(1)
    await expect(execucao(x(500))).resolves.toBe(1)
  })

  it('o indice so de atividadeId saiu; o unico (atividadeId, dataRealizacao) fica', async () => {
    const indices = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes WHERE tablename = 'execucao_atividade_casa' ORDER BY indexname`
    expect(indices.map((i) => i.indexname)).toEqual([
      'execucao_atividade_casa_atividadeId_dataRealizacao_key', 'execucao_atividade_casa_pkey',
    ])
  })
})
