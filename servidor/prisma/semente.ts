/**
 * Semente do banco: os dados de demonstracao, todos ficticios.
 *
 *   npm run build -w @sinctea/servidor
 *   npm run semente -w @sinctea/servidor
 *
 * Le DATABASE_URL e SENHA_SEMENTE do ambiente (ou de servidor/.env). Recusa-se
 * a rodar sem SENHA_SEMENTE, e recusa-se a rodar num banco que ja tem usuario:
 * e o que protege a producao de uma semente dupla.
 *
 * Os dados vem de semente/dados.ts, portado do mock. Aqui eles ganham ids UUID
 * v7, datas so-dia no calendario de Manaus, resumo do termo calculado sobre o
 * que fica gravado, senha em argon2id e dois relatorios emitidos.
 */
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import argon2 from 'argon2'
import { PrismaPg } from '@prisma/adapter-pg'
import type {
  ConteudoRelatorio, Destinatario, ObjetivoNoRelatorio, RegistroAuditoria,
} from '@sinctea/compartilhado'
import { diaCivilEm } from '@sinctea/compartilhado/dominio/datas'
import { jsonCanonico, resumoSha256 } from '@sinctea/compartilhado/dominio/hash'
import {
  percentualIndependente, situacaoConvite, textoDoCriterio, textoDoPeriodo,
} from '@sinctea/compartilhado/dominio/regras'
import { resumoDoTermo } from '@sinctea/compartilhado/dominio/termo'
import { PrismaClient } from '../src/gerado/client.js'
import { criarDadosDemonstracao, emManaus, type BancoDemonstracao } from './semente/dados.js'
import { uuidV7 } from './semente/uuid7.js'

/**
 * A versao do termo dos consentimentos semeados, literal e nao a corrente:
 * quando existir uma versao nova, os semeados continuam sendo o lugar onde o
 * caminho da versao antiga aparece funcionando. Como no mock.
 */
const VERSAO_DO_TERMO_SEMEADO = '2026-10'

// ---------------------------------------------------------------- Relatorios

interface PedidoDaSemente {
  pacienteId: string
  autorId: string
  objetivoIds: string[]
  destinatario: Destinatario
  consideracoes: string
  /** Periodo e emissao, em dias atras. */
  diasInicio: number
  diasFim: number
  diasEmissao: number
}

/**
 * Os dois relatorios ja emitidos da demonstracao, um para cada destinatario.
 * O mock nao tinha nenhum. As consideracoes sao texto da demonstracao, escrito
 * aqui; o resto do documento e montado pelo mesmo calculo que o mock usa ao
 * emitir (src/servicos/mock/relatorios.ts, copiado abaixo), e o hash e do
 * conteudo, e nao copiado de lugar nenhum.
 */
export const PEDIDOS_DE_RELATORIO: PedidoDaSemente[] = [
  {
    pacienteId: 'p-001', autorId: 'u-prof-1', objetivoIds: ['o-001', 'o-002', 'o-003'],
    destinatario: 'PROFISSIONAIS', diasInicio: 30, diasFim: 1, diasEmissao: 1,
    consideracoes:
      'Evolução consistente no mando por item preferido, já próximo do critério. A regulação ' +
      'sensorial não acompanhou: o melhor resultado segue sendo o das duas primeiras sessões. ' +
      'Proponho revisar a estratégia de antecipação com a família e a escola antes da próxima ' +
      'revisão do plano.',
  },
  {
    pacienteId: 'p-001', autorId: 'u-prof-1', objetivoIds: ['o-001', 'o-002', 'o-003'],
    destinatario: 'FAMILIA', diasInicio: 30, diasFim: 1, diasEmissao: 1,
    consideracoes:
      'Miguel está pedindo o que quer com cada vez menos ajuda. Quando o barulho incomoda, ainda ' +
      'precisa de apoio para avisar: o cartão do tempo calmo, em casa e na escola, continua sendo ' +
      'o caminho. Vamos conversar sobre isso no próximo encontro.',
  },
]

/** Copiado de montarConteudo (mock/relatorios.ts), com o dia contado em Manaus. */
function montarConteudo(
  dados: BancoDemonstracao, pedido: PedidoDaSemente, periodoInicio: string, periodoFim: string,
): ConteudoRelatorio {
  const paciente = dados.pacientes.find((p) => p.id === pedido.pacienteId)!
  const plano = dados.planos.find((p) => p.pacienteId === pedido.pacienteId)!
  const sessoes = dados.sessoes
    .filter((s) => s.pacienteId === pedido.pacienteId && s.situacao === 'ENCERRADA' && s.inicio)
    .filter((s) => diaCivilEm(new Date(s.inicio!)) >= periodoInicio && diaCivilEm(new Date(s.inicio!)) <= periodoFim)
    .sort((a, b) => a.numero - b.numero)

  const objetivos: ObjetivoNoRelatorio[] = pedido.objetivoIds.map((objetivoId) => {
    const objetivo = plano.objetivos.find((o) => o.id === objetivoId)!
    const percentuais = sessoes
      .map((s) => percentualIndependente(s.registros, objetivoId))
      .filter((p): p is number => p !== null)
    return {
      objetivoId,
      dominio: objetivo.dominio,
      // Regra 4: a equipe le a tecnica, a familia le a acessivel.
      redacao: pedido.destinatario === 'FAMILIA' ? objetivo.descricaoAcessivel : objetivo.descricaoTecnica,
      criterioTexto: textoDoCriterio(objetivo.criterio, pedido.destinatario),
      sessoesNoPeriodo: percentuais.length,
      periodoTexto: textoDoPeriodo(percentuais, pedido.destinatario),
      status: objetivo.status,
      dominadoEm: objetivo.dominadoEm,
    }
  })

  return {
    paciente: { id: paciente.id, nome: paciente.nome, dataNascimento: paciente.dataNascimento },
    periodoInicio,
    periodoFim,
    destinatario: pedido.destinatario,
    consideracoes: pedido.consideracoes.trim(),
    objetivos,
    sessoesNoPeriodo: sessoes.length,
  }
}

// ---------------------------------------------------------------- Ids

/** Toda chave de id do mock, de todas as colecoes, inclusive as aninhadas. */
function idsDoMock(dados: BancoDemonstracao): string[] {
  const colecoes = Object.values(dados) as Array<Array<{ id: string }>>
  return [
    ...colecoes.flatMap((c) => c.map((item) => item.id)),
    ...dados.planos.flatMap((p) => p.objetivos.map((o) => o.id)),
    ...dados.sessoes.flatMap((s) => s.registros.map((r) => r.id)),
  ]
}

/**
 * Troca, em toda a estrutura, os ids do mock pelos UUID v7 definitivos. So os
 * campos de referencia mudam: `id`, os que terminam em `Id` ou `Ids`, e
 * `idEntidade`. Um id sem par e erro, e nao passa calado.
 */
function trocarIds<T>(valor: T, ids: Map<string, string>, chave = ''): T {
  if (Array.isArray(valor)) return valor.map((v) => trocarIds(v, ids, chave)) as T
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, trocarIds(v, ids, k)])) as T
  }
  const ehReferencia = chave === 'id' || chave === 'idEntidade' || /Ids?$/.test(chave)
  if (ehReferencia && typeof valor === 'string') {
    const novo = ids.get(valor)
    if (!novo) throw new Error(`Semente: o id "${valor}" (em ${chave}) nao tem correspondente.`)
    return novo as T
  }
  return valor
}

// ---------------------------------------------------------------- Gravacao

const soDia = (dia: string) => new Date(`${dia}T00:00:00.000Z`)
const instante = (iso: string) => new Date(iso)
const talvez = (iso: string | null) => (iso === null ? null : new Date(iso))

export interface ResultadoDaSemente {
  /** Tokens dos convites validos agora, para a demonstracao da tela 2. */
  convitesValidos: string[]
}

export async function semear(
  prisma: PrismaClient, opcoes: { senha: string; agora?: Date },
): Promise<ResultadoDaSemente> {
  if (!opcoes.senha) {
    throw new Error('A semente se recusa a rodar: SENHA_SEMENTE nao foi definida.')
  }
  const usuarios = await prisma.usuario.count()
  if (usuarios > 0) {
    throw new Error(
      `A semente se recusa a rodar: o banco ja tem ${usuarios} usuario(s). ` +
      'Semear de novo duplicaria os dados — em producao, inclusive.',
    )
  }

  const agora = opcoes.agora ?? new Date()
  const doMock = criarDadosDemonstracao(agora)

  // Os relatorios e a sua linha na trilha, ainda com ids do mock.
  const relatoriosDoMock = PEDIDOS_DE_RELATORIO.map((pedido, i) => ({ id: `rel-${i + 1}`, pedido }))
  const ids = new Map<string, string>(
    [...idsDoMock(doMock), ...relatoriosDoMock.map((r) => r.id)].map((id) => [id, uuidV7()]),
  )
  const dados = trocarIds(doMock, ids)
  /** Recebe o pedido ja com os ids definitivos. */
  const autor = (pedido: PedidoDaSemente) =>
    dados.profissionais.find((p) => p.id === pedido.autorId)!

  const relatorios = await Promise.all(relatoriosDoMock.map(async ({ id, pedido: doPedido }) => {
    const pedido = { ...doPedido, pacienteId: ids.get(doPedido.pacienteId)!,
      autorId: ids.get(doPedido.autorId)!, objetivoIds: doPedido.objetivoIds.map((o) => ids.get(o)!) }
    const periodoInicio = diaCivilEm(new Date(emManaus(agora, pedido.diasInicio)))
    const periodoFim = diaCivilEm(new Date(emManaus(agora, pedido.diasFim)))
    const conteudo = montarConteudo(dados, pedido, periodoInicio, periodoFim)
    return {
      id: ids.get(id)!, pedido, periodoInicio, periodoFim,
      emitidoEm: emManaus(agora, pedido.diasEmissao, 17),
      // Texto canonico exato que o hash resume: e o que se grava.
      conteudoEmitido: jsonCanonico(conteudo),
      hashConteudo: await resumoSha256(conteudo),
    }
  }))

  const trilhaDosRelatorios: RegistroAuditoria[] = relatorios.map((r) => {
    const quem = autor(r.pedido)
    return {
      id: uuidV7(), ocorridoEm: r.emitidoEm, usuarioId: quem.id, usuarioNome: quem.nome,
      perfil: 'TERAPEUTA', acao: 'CRIACAO', entidade: 'RelatorioEvolucao', idEntidade: r.id,
      pacienteId: r.pedido.pacienteId, origem: 'CLINICA', ipOrigem: null,
      detalhe: `Relatório emitido para ${r.pedido.destinatario === 'FAMILIA' ? 'a família' : 'a equipe'}.`,
      valorAnterior: null,
    }
  })

  // O resumo cobre o que fica gravado: ids definitivos e a validade so-dia.
  const consentimentos = await Promise.all(dados.consentimentos.map(async (c) => ({
    ...c,
    hashTermo: await resumoDoTermo({
      versaoTermo: VERSAO_DO_TERMO_SEMEADO, responsavelId: c.responsavelId,
      pacienteId: c.pacienteId, escolaId: c.escolaId, escopos: c.escopos,
      validadeAte: c.validadeAte, concedidoEm: c.concedidoEm,
    }),
  })))

  const todosUsuarios = [...dados.profissionais, ...dados.responsaveis, ...dados.professores]
  const senhas = await Promise.all(
    todosUsuarios.map(() => argon2.hash(opcoes.senha, { type: argon2.argon2id })),
  )

  await prisma.$transaction(async (tx) => {
    await tx.usuario.createMany({
      data: todosUsuarios.map((u, i) => ({
        id: u.id, nome: u.nome, email: u.email, senhaHash: senhas[i], perfis: u.perfis,
        ativo: u.ativo, ultimoAcessoEm: talvez(u.ultimoAcessoEm),
      })),
    })
    await tx.profissional.createMany({
      data: dados.profissionais.map((p) => ({
        usuarioId: p.id, especialidade: p.especialidade, registroConselho: p.registroConselho,
      })),
    })
    await tx.responsavel.createMany({
      data: dados.responsaveis.map((r) => ({ usuarioId: r.id, telefone: r.telefone })),
    })
    await tx.professorAEE.createMany({ data: dados.professores.map((p) => ({ usuarioId: p.id })) })
    await tx.escola.createMany({ data: dados.escolas })

    await tx.paciente.createMany({
      data: dados.pacientes.map((p) => ({
        id: p.id, nome: p.nome, dataNascimento: soDia(p.dataNascimento), nivelSuporte: p.nivelSuporte,
        profissionalResponsavelId: p.profissionalResponsavelId, ativo: p.ativo,
      })),
    })
    await tx.equipePaciente.createMany({
      data: dados.pacientes.flatMap((p) => p.equipeIds.map((profissionalId) => ({ pacienteId: p.id, profissionalId }))),
    })
    await tx.vinculoFamiliar.createMany({ data: dados.vinculosFamiliares })

    await tx.planoTerapeutico.createMany({
      data: dados.planos.map((p) => ({
        id: p.id, pacienteId: p.pacienteId, autorId: p.autorId, status: p.status,
        dataInicio: soDia(p.dataInicio), dataRevisao: soDia(p.dataRevisao),
        ultimaRevisaoEm: talvez(p.ultimaRevisaoEm), observacaoValidacao: p.observacaoValidacao,
      })),
    })
    await tx.objetivo.createMany({
      data: dados.planos.flatMap((p) => p.objetivos.map((o) => ({
        id: o.id, planoId: o.planoId, dominio: o.dominio, descricaoTecnica: o.descricaoTecnica,
        descricaoAcessivel: o.descricaoAcessivel, status: o.status, dominadoEm: talvez(o.dominadoEm),
        percentualAtual: o.percentualAtual, percentualMinimo: o.criterio.percentualMinimo,
        sessoesConsecutivas: o.criterio.sessoesConsecutivas,
      }))),
    })

    await tx.sessao.createMany({
      data: dados.sessoes.map((s) => ({
        id: s.id, pacienteId: s.pacienteId, profissionalId: s.profissionalId, numero: s.numero,
        inicioPrevistoEm: instante(s.inicioPrevistoEm), inicio: talvez(s.inicio), fim: talvez(s.fim),
        local: s.local, situacao: s.situacao, statusSync: s.statusSync,
      })),
    })
    await tx.registroAtividade.createMany({
      data: dados.sessoes.flatMap((s) => s.registros.map((r) => ({
        id: r.id, sessaoId: s.id, objetivoId: r.objetivoId, ordem: r.ordem, resultado: r.resultado,
        ocorridoEm: instante(r.ocorridoEm),
      }))),
    })

    await tx.cartaoEstrategia.createMany({
      data: dados.cartoes.map((c) => ({ ...c, atualizadoEm: instante(c.atualizadoEm) })),
    })
    await tx.atividadeCasa.createMany({
      data: dados.atividades.map((a) => ({ ...a, prescritaEm: instante(a.prescritaEm) })),
    })
    await tx.execucaoAtividadeCasa.createMany({
      data: dados.execucoes.map((e) => ({
        ...e, dataRealizacao: soDia(e.dataRealizacao),
      })),
    })

    await tx.consentimento.createMany({
      data: consentimentos.map((c) => ({
        ...c, concedidoEm: instante(c.concedidoEm), validadeAte: soDia(c.validadeAte),
        revogadoEm: talvez(c.revogadoEm),
      })),
    })
    await tx.conviteEscolar.createMany({
      data: dados.convites.map((c) => ({
        ...c, criadoEm: instante(c.criadoEm), expiraEm: instante(c.expiraEm), usadoEm: talvez(c.usadoEm),
      })),
    })
    await tx.vinculoEscolar.createMany({ data: dados.vinculos })

    await tx.ocorrenciaEscolar.createMany({
      data: dados.ocorrenciasEscolares.map((o) => ({
        ...o, ocorridoEm: instante(o.ocorridoEm), registradaEm: instante(o.registradaEm),
        corrigidaEm: talvez(o.corrigidaEm),
      })),
    })
    await tx.ocorrenciaComportamental.createMany({
      data: dados.ocorrenciasComportamentais.map((o) => ({
        ...o, ocorridaEm: instante(o.ocorridaEm), leituraClinicaEm: talvez(o.leituraClinicaEm),
      })),
    })

    await tx.relatorioEvolucao.createMany({
      data: relatorios.map((r) => {
        const quem = autor(r.pedido)
        return {
          id: r.id, pacienteId: r.pedido.pacienteId, objetivoIds: r.pedido.objetivoIds,
          periodoInicio: soDia(r.periodoInicio), periodoFim: soDia(r.periodoFim),
          destinatario: r.pedido.destinatario, consideracoes: r.pedido.consideracoes.trim(),
          // Fotografia da emissao, como o mock faz.
          autorNome: quem.nome, autorRegistro: quem.registroConselho.trim(),
          emitidoEm: instante(r.emitidoEm), conteudoEmitido: r.conteudoEmitido, hashConteudo: r.hashConteudo,
        }
      }),
    })

    await tx.registroAuditoria.createMany({
      data: [...dados.auditoria, ...trilhaDosRelatorios]
        .sort((a, b) => a.ocorridoEm.localeCompare(b.ocorridoEm))
        .map((r) => ({ ...r, ocorridoEm: instante(r.ocorridoEm) })),
    })
  }, { timeout: 120_000 })

  return {
    convitesValidos: dados.convites
      .filter((cv) => situacaoConvite(cv, consentimentos.find((c) => c.id === cv.consentimentoId)!, agora) === 'VALIDO')
      .map((cv) => cv.token),
  }
}

// ---------------------------------------------------------------- Linha de comando

async function principal(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env')
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL nao foi definida.')
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
  try {
    const resultado = await semear(prisma, { senha: process.env.SENHA_SEMENTE ?? '' })
    console.log('Semente gravada.')
    for (const token of resultado.convitesValidos) {
      console.log(`Convite valido, para a demonstracao da tela 2: /app/convite/${token}`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal().catch((erro: unknown) => {
    console.error(erro instanceof Error ? erro.message : erro)
    process.exitCode = 1
  })
}
