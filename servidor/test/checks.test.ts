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
