import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { uuidV7 } from '../prisma/semente/uuid7.js'
import type { PrismaClient } from '../src/gerado/client.js'
import { clienteDe, criarBancoMigrado } from './apoio/banco.js'

/**
 * Regra 6 e documento clinico emitido: a trilha de auditoria e o relatorio
 * emitido so crescem. O trigger da migracao recusa UPDATE, DELETE e TRUNCATE —
 * pelo cliente do Prisma e por SQL cru, que e o que alguem usaria para
 * contornar o cliente.
 *
 * Banco proprio, migrado e sem semente: o que este teste insere nao pode ser
 * apagado depois, e nao deve mudar as contagens que o teste da semente confere.
 */

const RECUSA = /registro imutavel/

let prisma: PrismaClient
let apagar: () => Promise<void>
let pacienteId: string

beforeAll(async () => {
  const banco = await criarBancoMigrado(inject('urlAdministrativa'), 'sinctea_imutavel')
  apagar = banco.apagar
  prisma = clienteDe(banco.url)

  // O minimo para o relatorio ter a quem se referir.
  const profissional = uuidV7()
  pacienteId = uuidV7()
  await prisma.usuario.create({ data: {
    id: profissional, nome: 'Profissional Ficticia', email: 'profissional@teste.example',
    senhaHash: '$argon2id$ficticio', perfis: ['TERAPEUTA'], ativo: true,
  } })
  await prisma.profissional.create({ data: {
    usuarioId: profissional, especialidade: 'Fonoaudiologia', registroConselho: 'CRFa 0000-FICT',
  } })
  await prisma.paciente.create({ data: {
    id: pacienteId, nome: 'Paciente Ficticio', dataNascimento: new Date('2019-01-01T00:00:00Z'),
    nivelSuporte: 2, profissionalResponsavelId: profissional, ativo: true,
  } })
})

afterAll(async () => {
  await prisma?.$disconnect()
  await apagar?.()
})

interface Tabela {
  nome: 'registro_auditoria' | 'relatorio_evolucao'
  inserir: () => Promise<string>
  atualizar: (id: string) => Promise<unknown>
  atualizarVarias: () => Promise<unknown>
  remover: (id: string) => Promise<unknown>
  removerVarias: () => Promise<unknown>
  contar: () => Promise<number>
  coluna: string
}

const tabelas: Tabela[] = [
  {
    nome: 'registro_auditoria',
    coluna: 'detalhe',
    inserir: async () => (await prisma.registroAuditoria.create({ data: {
      ocorridoEm: new Date(), acao: 'LEITURA_AUTORIZADA', entidade: 'Paciente', origem: 'CLINICA',
      detalhe: 'Leitura de teste.',
    } })).id,
    atualizar: (id) => prisma.registroAuditoria.update({ where: { id }, data: { detalhe: 'Reescrita.' } }),
    atualizarVarias: () => prisma.registroAuditoria.updateMany({ data: { detalhe: 'Reescrita.' } }),
    remover: (id) => prisma.registroAuditoria.delete({ where: { id } }),
    removerVarias: () => prisma.registroAuditoria.deleteMany({}),
    contar: () => prisma.registroAuditoria.count(),
  },
  {
    nome: 'relatorio_evolucao',
    coluna: 'consideracoes',
    inserir: async () => (await prisma.relatorioEvolucao.create({ data: {
      pacienteId, objetivoIds: [uuidV7()], periodoInicio: new Date('2026-09-01T00:00:00Z'),
      periodoFim: new Date('2026-09-30T00:00:00Z'), destinatario: 'PROFISSIONAIS',
      consideracoes: 'Leitura de teste.', autorNome: 'Profissional Ficticia',
      autorRegistro: 'CRFa 0000-FICT', emitidoEm: new Date(), conteudoEmitido: '{}',
      hashConteudo: 'sha256:0',
    } })).id,
    atualizar: (id) => prisma.relatorioEvolucao.update({ where: { id }, data: { consideracoes: 'Reescrita.' } }),
    atualizarVarias: () => prisma.relatorioEvolucao.updateMany({ data: { consideracoes: 'Reescrita.' } }),
    remover: (id) => prisma.relatorioEvolucao.delete({ where: { id } }),
    removerVarias: () => prisma.relatorioEvolucao.deleteMany({}),
    contar: () => prisma.relatorioEvolucao.count(),
  },
]

describe.each(tabelas)('$nome so cresce', (tabela) => {
  let id: string

  it('INSERT passa', async () => {
    const antes = await tabela.contar()
    id = await tabela.inserir()
    expect(await tabela.contar()).toBe(antes + 1)
  })

  it('UPDATE e DELETE pelo cliente do Prisma sao recusados', async () => {
    await expect(tabela.atualizar(id)).rejects.toThrow(RECUSA)
    await expect(tabela.atualizarVarias()).rejects.toThrow(RECUSA)
    await expect(tabela.remover(id)).rejects.toThrow(RECUSA)
    await expect(tabela.removerVarias()).rejects.toThrow(RECUSA)
  })

  it('UPDATE, DELETE e TRUNCATE por SQL cru sao recusados', async () => {
    await expect(prisma.$executeRawUnsafe(
      `UPDATE "${tabela.nome}" SET "${tabela.coluna}" = 'Reescrita.' WHERE "id" = $1::uuid`, id,
    )).rejects.toThrow(RECUSA)
    await expect(prisma.$executeRawUnsafe(`DELETE FROM "${tabela.nome}" WHERE "id" = $1::uuid`, id))
      .rejects.toThrow(RECUSA)
    await expect(prisma.$executeRawUnsafe(`TRUNCATE "${tabela.nome}"`)).rejects.toThrow(RECUSA)
  })

  it('a linha continua la, como foi gravada', async () => {
    const linhas = await prisma.$queryRawUnsafe<Array<Record<string, string>>>(
      `SELECT "${tabela.coluna}" AS valor FROM "${tabela.nome}" WHERE "id" = $1::uuid`, id,
    )
    expect(linhas).toEqual([{ valor: 'Leitura de teste.' }])
  })
})
