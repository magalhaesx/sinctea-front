import { afterAll, describe, expect, inject, it } from 'vitest'
import { resumoSha256 } from '@sinctea/compartilhado/dominio/hash'
import { conferirResumoDoTermo, versaoDoResumo } from '@sinctea/compartilhado/dominio/termo'
import { criarDadosDemonstracao } from '../prisma/semente/dados.js'
import { PEDIDOS_DE_RELATORIO, semear } from '../prisma/semente.js'
import { clienteDe } from './apoio/banco.js'

/**
 * O banco semeado pelo globalSetup, so lido aqui. As contagens esperadas vem
 * dos dados (semente/dados.ts), e nao do codigo que grava: e isso que pega
 * uma colecao esquecida na gravacao.
 */

const prisma = clienteDe(inject('urlSemeado'))
afterAll(() => prisma.$disconnect())

const soma = (numeros: number[]) => numeros.reduce((a, b) => a + b, 0)

describe('semente', () => {
  it('cada tabela tem exatamente o que a semente tem, e nenhuma esta vazia', async () => {
    const d = criarDadosDemonstracao(new Date())
    const esperado = {
      usuario: d.profissionais.length + d.responsaveis.length + d.professores.length,
      profissional: d.profissionais.length,
      responsavel: d.responsaveis.length,
      professorAEE: d.professores.length,
      escola: d.escolas.length,
      paciente: d.pacientes.length,
      equipePaciente: soma(d.pacientes.map((p) => p.equipeIds.length)),
      vinculoFamiliar: d.vinculosFamiliares.length,
      planoTerapeutico: d.planos.length,
      objetivo: soma(d.planos.map((p) => p.objetivos.length)),
      sessao: d.sessoes.length,
      registroAtividade: soma(d.sessoes.map((s) => s.registros.length)),
      cartaoEstrategia: d.cartoes.length,
      atividadeCasa: d.atividades.length,
      execucaoAtividadeCasa: d.execucoes.length,
      consentimento: d.consentimentos.length,
      conviteEscolar: d.convites.length,
      vinculoEscolar: d.vinculos.length,
      ocorrenciaEscolar: d.ocorrenciasEscolares.length,
      ocorrenciaComportamental: d.ocorrenciasComportamentais.length,
      // Os relatorios nao vem do mock: sao os pedidos da semente.
      relatorioEvolucao: PEDIDOS_DE_RELATORIO.length,
      // A trilha do mock, mais a emissao de cada relatorio.
      registroAuditoria: d.auditoria.length + PEDIDOS_DE_RELATORIO.length,
    }
    const contado = {
      usuario: await prisma.usuario.count(),
      profissional: await prisma.profissional.count(),
      responsavel: await prisma.responsavel.count(),
      professorAEE: await prisma.professorAEE.count(),
      escola: await prisma.escola.count(),
      paciente: await prisma.paciente.count(),
      equipePaciente: await prisma.equipePaciente.count(),
      vinculoFamiliar: await prisma.vinculoFamiliar.count(),
      planoTerapeutico: await prisma.planoTerapeutico.count(),
      objetivo: await prisma.objetivo.count(),
      sessao: await prisma.sessao.count(),
      registroAtividade: await prisma.registroAtividade.count(),
      cartaoEstrategia: await prisma.cartaoEstrategia.count(),
      atividadeCasa: await prisma.atividadeCasa.count(),
      execucaoAtividadeCasa: await prisma.execucaoAtividadeCasa.count(),
      consentimento: await prisma.consentimento.count(),
      conviteEscolar: await prisma.conviteEscolar.count(),
      vinculoEscolar: await prisma.vinculoEscolar.count(),
      ocorrenciaEscolar: await prisma.ocorrenciaEscolar.count(),
      ocorrenciaComportamental: await prisma.ocorrenciaComportamental.count(),
      relatorioEvolucao: await prisma.relatorioEvolucao.count(),
      registroAuditoria: await prisma.registroAuditoria.count(),
    }
    expect(contado).toEqual(esperado)
    for (const [tabela, total] of Object.entries(esperado)) expect(total, tabela).toBeGreaterThan(0)
  })

  it('toda senha esta em argon2id, e a do mock nao foi para o banco', async () => {
    const usuarios = await prisma.usuario.findMany({ select: { senhaHash: true } })
    expect(usuarios.length).toBeGreaterThan(0)
    for (const { senhaHash } of usuarios) {
      expect(senhaHash.startsWith('$argon2id$')).toBe(true)
      expect(senhaHash).not.toContain('demonstracao')
    }
  })

  it('o hash de todo relatorio e o do proprio conteudo gravado', async () => {
    const relatorios = await prisma.relatorioEvolucao.findMany()
    // Sem isto, um laco sobre zero relatorios passaria sem conferir nada.
    expect(relatorios).toHaveLength(PEDIDOS_DE_RELATORIO.length)
    for (const r of relatorios) {
      expect(await resumoSha256(JSON.parse(r.conteudoEmitido))).toBe(r.hashConteudo)
    }
    expect(new Set(relatorios.map((r) => r.destinatario))).toEqual(new Set(['PROFISSIONAIS', 'FAMILIA']))
  })

  it('o resumo de todo termo confere com o que esta gravado no consentimento', async () => {
    const consentimentos = await prisma.consentimento.findMany()
    expect(consentimentos.length).toBeGreaterThan(0)
    for (const c of consentimentos) {
      const versao = versaoDoResumo(c.hashTermo)
      expect(versao).toBeTruthy()
      expect(await conferirResumoDoTermo(c.hashTermo, {
        versaoTermo: versao!, responsavelId: c.responsavelId, pacienteId: c.pacienteId,
        escolaId: c.escolaId, escopos: c.escopos, concedidoEm: c.concedidoEm.toISOString(),
        // Coluna date: o resumo cobre o dia, como ele fica gravado.
        validadeAte: c.validadeAte.toISOString().slice(0, 10),
      })).toBe(true)
    }
  })

  it('nenhum e-mail fica fora de .example', async () => {
    const emails = (await prisma.usuario.findMany({ select: { email: true } })).map((u) => u.email)
    expect(emails.length).toBeGreaterThan(0)
    expect(emails.filter((e) => !e.endsWith('.example'))).toEqual([])
  })

  it('os tokens de convite nao sao os fixos do mock', async () => {
    const tokens = (await prisma.conviteEscolar.findMany({ select: { token: true } })).map((c) => c.token)
    expect(tokens.length).toBeGreaterThan(0)
    for (const token of tokens) expect(token).toMatch(/^[0-9a-f]{32}$/)
  })

  it('recusa-se a rodar sem senha, e num banco que ja tem usuario', async () => {
    const antes = await prisma.usuario.count()
    await expect(semear(prisma, { senha: '' })).rejects.toThrow(/SENHA_SEMENTE/)
    await expect(semear(prisma, { senha: 'qualquer' })).rejects.toThrow(/ja tem/)
    expect(await prisma.usuario.count()).toBe(antes)
  })
})
