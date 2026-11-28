import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { ErroServico, type CodigoErro, type RegistroAtividade, type Resultado } from '@sinctea/compartilhado'
import { gerarUuidV7 } from '@sinctea/compartilhado/dominio/toque'
import { armazemIndexedDb, type ToqueNaFila } from '../../src/fila/armazem'
import { criarFila, travaNaMemoria, type Fila } from '../../src/fila/filaDeToques'
import type { PrismaClient } from '../../servidor/src/gerado/client.js'
import { clienteDe, criarBancoMigrado } from '../../servidor/test/apoio/banco.js'
import { criarUsuario, subirApi, SENHA_DE_TESTE, type Api } from '../../servidor/test/apoio/api.js'

/**
 * Item 25, offline: a meta do pre-projeto e 100% de 20 sessoes sincronizadas,
 * sem perda nem duplicacao. Aqui, a fila do aparelho de verdade (src/fila) e o
 * servidor de verdade, num banco descartavel, com uma rede que cai e volta ao
 * acaso — com semente fixa, para o resultado ser o mesmo a cada execucao.
 *
 * - Duas abas da mesma conta, cada uma com a sua vaga (item 9), dividem o
 *   IndexedDB e a trava, como dividem no navegador; qualquer uma envia os
 *   toques que a outra guardou. No meio, uma aba fecha e outra abre no lugar.
 * - A rede cai antes do pedido (o toque fica e vai de novo) e cai depois de o
 *   servidor gravar (a resposta se perde, e o toque e reenviado: o servidor
 *   tem de devolver o que ja gravou, sem gravar de novo).
 * - Cada sessao so se encerra com a fila vazia, como na tela 7.
 *
 * No fim: cada toque no servidor exatamente uma vez, na ordem em que foi
 * tocado, uma criacao por toque na trilha, e a fila vazia.
 */

const SEMENTE = 20261128
const SESSOES = 20
const PACIENTES = 4

/** Mulberry32: o acaso com semente fixa. */
function sorteador(semente: number) {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}
const acaso = sorteador(SEMENTE)
const entre = (min: number, max: number) => min + Math.floor(acaso() * (max - min + 1))

/** O que a rede fez com cada pedido. */
const rede = { online: true, caidas: 0, respostasPerdidas: 0, aceitos: 0, pedidos: 0 }
/** A rede muda de estado ao acaso: cai com 20% de chance, volta com 40%. */
function proximoPasso(): 'caida' | 'perdeResposta' | 'ok' {
  rede.online = rede.online ? acaso() >= 0.2 : acaso() < 0.4
  if (!rede.online) return 'caida'
  return acaso() < 0.15 ? 'perdeResposta' : 'ok'
}

const CODIGO_POR_STATUS: Record<number, CodigoErro> = {
  401: 'NAO_AUTENTICADO', 403: 'ACESSO_NEGADO', 404: 'NAO_ENCONTRADO', 409: 'CONFLITO', 422: 'VALIDACAO', 429: 'LIMITE_TENTATIVAS', 503: 'INDISPONIVEL',
}
const SEM_CONEXAO = () => new ErroServico('INDISPONIVEL', 'Não foi possível falar com o servidor.')

let prisma: PrismaClient
let api: Api
let apagar: () => Promise<void>
let cookies = ''
const pacientes: Array<{ id: string; objetivos: string[] }> = []

/** O envio da aba, como o cliente da API (src/servicos/api) o faz, mas pela rede de mentira. */
function envioDaAba(aba: number) {
  return async (t: ToqueNaFila): Promise<RegistroAtividade> => {
    rede.pedidos += 1
    const passo = proximoPasso()
    if (passo === 'caida') {
      rede.caidas += 1
      throw SEM_CONEXAO()
    }
    const r = await fetch(`${api.endereco}/api/sessoes/${t.sessaoId}/registros`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookies, 'X-Sinctea-Aba': String(aba) },
      body: JSON.stringify({ objetivoId: t.objetivoId, resultado: t.resultado, id: t.id, ocorridoEm: t.ocorridoEm }),
    })
    const corpo = await r.json()
    if (passo === 'perdeResposta') {
      // O servidor ja gravou; a resposta nao chega, e o aparelho tenta de novo.
      rede.respostasPerdidas += 1
      throw SEM_CONEXAO()
    }
    if (!r.ok) throw new ErroServico(CODIGO_POR_STATUS[r.status] ?? 'INDISPONIVEL', corpo.mensagem ?? 'Erro do servidor.')
    rede.aceitos += 1
    return corpo
  }
}

beforeAll(async () => {
  const banco = await criarBancoMigrado(inject('urlAdministrativa'), 'sinctea_offline')
  apagar = banco.apagar
  prisma = clienteDe(banco.url)
  const ana = await criarUsuario(prisma, { email: 'ana@teste.example', nome: 'Ana Souza', perfis: ['TERAPEUTA'] })
  api = await subirApi(banco.url)

  // Duas abas do mesmo navegador: a segunda entra com o cookie da primeira e ganha a vaga 2.
  const primeira = await api.pedir('POST', '/auth/entrar', { corpo: { email: 'ana@teste.example', senha: SENHA_DE_TESTE } })
  const cookie1 = primeira.cookies.find((c) => c.startsWith('sinctea_sessao_1='))!.split(';')[0]
  const segunda = await api.pedir('POST', '/auth/entrar', { corpo: { email: 'ana@teste.example', senha: SENHA_DE_TESTE }, cookie: cookie1 })
  const cookie2 = segunda.cookies.find((c) => c.startsWith('sinctea_sessao_2='))!.split(';')[0]
  cookies = `${cookie1}; ${cookie2}`
  expect(segunda.corpo.vaga).toBe(2)

  for (let i = 0; i < PACIENTES; i += 1) {
    const corpo = { nome: `Paciente Ficticio ${i + 1}`, dataNascimento: '2019-03-12', nivelSuporte: 2, profissionalResponsavelId: ana }
    const paciente = (await api.pedir('POST', '/pacientes', { cookie: cookie1, corpo })).corpo.id as string
    const plano = (await api.pedir('POST', `/pacientes/${paciente}/plano`, { cookie: cookie1, corpo: { dataInicio: '2026-10-01', dataRevisao: '2027-04-01' } })).corpo.id
    const objetivos: string[] = []
    for (const dominio of ['Comunicação', 'Autocuidado']) {
      objetivos.push((await api.pedir('POST', `/planos/${plano}/objetivos`, {
        cookie: cookie1,
        corpo: { dominio, descricaoTecnica: 'Redação técnica fictícia.', descricaoAcessivel: 'Redação acessível fictícia.', criterio: { percentualMinimo: 80, sessoesConsecutivas: 2 } },
      })).corpo.id)
    }
    pacientes.push({ id: paciente, objetivos })
  }
}, 180_000)

afterAll(async () => {
  await api?.fechar()
  await prisma?.$disconnect()
  await apagar?.()
})

describe('20 sessoes com a rede caindo e voltando (item 25)', () => {
  it('cada toque chega ao servidor uma vez, na ordem, e a fila termina vazia', async () => {
    const usuario = (await prisma.usuario.findFirstOrThrow({ where: { email: 'ana@teste.example' } })).id
    // O IndexedDB e a trava (Web Locks) sao do navegador: as abas os dividem.
    const indexedDb = new IDBFactory()
    const armazem = armazemIndexedDb(indexedDb)
    const trava = travaNaMemoria()
    const abrirAba = (vaga: number) => criarFila({ armazem: armazemIndexedDb(indexedDb), enviar: envioDaAba(vaga), travar: trava })
    const abas: Fila[] = [abrirAba(1), abrirAba(2)]
    const tocados = new Map<string, ToqueNaFila[]>()
    const emCurso: Promise<void>[] = []
    let total = 0

    for (let n = 0; n < SESSOES; n += 1) {
      const paciente = pacientes[n % PACIENTES]
      // Iniciar precisa de conexao e da fila vazia (tela 7).
      const sessao = await api.pedir('POST', '/sessoes', { cookie: cookies, aba: 1, corpo: { pacienteId: paciente.id } })
      expect(sessao.status, JSON.stringify(sessao.corpo)).toBe(201)
      const sessaoId = sessao.corpo.id as string
      tocados.set(sessaoId, [])

      // No meio da execucao, a segunda aba fecha, e uma nova abre no lugar, com a mesma vaga.
      if (n === SESSOES / 2) abas[1] = abrirAba(2)

      const toques = entre(6, 14)
      for (let k = 0; k < toques; k += 1) {
        const aba = abas[entre(0, 1)]
        const toque: ToqueNaFila = {
          id: gerarUuidV7(), usuarioId: usuario, sessaoId,
          objetivoId: paciente.objetivos[entre(0, 1)],
          resultado: (['INDEPENDENTE', 'AJUDA_GESTUAL', 'AJUDA_FISICA', 'SEM_RESPOSTA'] as Resultado[])[entre(0, 3)],
          ocorridoEm: new Date().toISOString(),
        }
        await aba.enfileirar(toque)
        tocados.get(sessaoId)!.push(toque)
        total += 1
        // A tela manda enviar logo depois do toque; a outra aba, de vez em quando
        // (o evento "online", o intervalo de 30 s). As duas podem correr ao mesmo tempo.
        emCurso.push(aba.enviarPendentes(usuario))
        if (acaso() < 0.35) emCurso.push(abas[entre(0, 1)].enviarPendentes(usuario))
        if (acaso() < 0.3) await Promise.all(emCurso.splice(0))
      }

      // Antes de encerrar, a conexao volta e a fila esvazia.
      await Promise.all(emCurso.splice(0))
      for (let tentativa = 0; (await armazem.listar(usuario)).length > 0; tentativa += 1) {
        expect(tentativa, 'a fila nao esvaziou').toBeLessThan(500)
        await abas[tentativa % 2].enviarPendentes(usuario)
      }
      const fim = await api.pedir('POST', `/sessoes/${sessaoId}/encerramento`, { cookie: cookies, aba: 1, corpo: { evolucao: 'Evolução fictícia da sessão.' } })
      expect(fim.status, JSON.stringify(fim.corpo)).toBe(200)
    }

    // A rede caiu de verdade, e respostas se perderam de verdade.
    expect(rede.caidas).toBeGreaterThan(20)
    expect(rede.respostasPerdidas).toBeGreaterThan(10)
    console.log(`Offline (semente ${SEMENTE}): ${SESSOES} sessoes, ${total} toques, ${rede.pedidos} pedidos — ` +
      `${rede.caidas} com a rede caida, ${rede.respostasPerdidas} com a resposta perdida depois de gravar, ${rede.aceitos} aceitos.`)

    // Cada sessao: os toques no servidor, uma vez cada, na ordem em que foram tocados.
    for (const [sessaoId, toques] of tocados) {
      const gravados = await prisma.registroAtividade.findMany({ where: { sessaoId }, orderBy: { ordem: 'asc' } })
      expect(gravados.map((g) => g.id), sessaoId).toEqual(toques.map((t) => t.id))
      expect(gravados.map((g) => g.ordem)).toEqual(toques.map((_, i) => i + 1))
      expect(gravados.map((g) => [g.objetivoId, g.resultado, g.ocorridoEm.toISOString()]))
        .toEqual(toques.map((t) => [t.objetivoId, t.resultado, t.ocorridoEm]))
    }
    const sessoes = await prisma.sessao.findMany({ where: { id: { in: [...tocados.keys()] } } })
    expect(sessoes.filter((s) => s.situacao === 'ENCERRADA')).toHaveLength(SESSOES)

    // Nenhum a mais: o total do banco e o total tocado, e uma criacao por toque na trilha.
    expect(await prisma.registroAtividade.count()).toBe(total)
    expect(await prisma.registroAuditoria.count({ where: { acao: 'CRIACAO', entidade: 'RegistroAtividade' } })).toBe(total)

    // A fila vazia, sem recusa em nenhuma aba.
    expect(await armazem.contarTudo()).toBe(0)
    for (const aba of abas) expect(aba.recusas(usuario)).toEqual([])
  })
})
