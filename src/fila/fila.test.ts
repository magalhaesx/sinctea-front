import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { ErroServico, type RegistroAtividade, type Resultado } from '@sinctea/compartilhado'
import { gerarUuidV7 } from '@sinctea/compartilhado/dominio/toque'
import { armazemIndexedDb, type ToqueNaFila } from './armazem'
import { criarFila, travaNaMemoria, type Envio } from './filaDeToques'

/**
 * Item 22: a fila dos toques no IndexedDB do aparelho (aqui, o fake-indexeddb,
 * a mesma API no Node). Em ordem, um por vez; a falha de rede deixa o toque na
 * fila, a recusa definitiva tira e mostra; cada conta so envia a sua; desfazer
 * tira da fila o que ainda nao subiu; e no disco, so os seis campos.
 */

const ANA = 'u-ana'
const BRUNO = 'u-bruno'
let relogio = Date.parse('2030-05-01T13:00:00.000Z')

function toque(usuarioId = ANA, sessaoId = 's1', resultado: Resultado = 'INDEPENDENTE'): ToqueNaFila {
  relogio += 1000
  return { id: gerarUuidV7(relogio), usuarioId, sessaoId, objetivoId: 'o1', resultado, ocorridoEm: new Date(relogio).toISOString() }
}

const registroDe = (t: ToqueNaFila, ordem = 1): RegistroAtividade =>
  ({ id: t.id, objetivoId: t.objetivoId, ordem, resultado: t.resultado, ocorridoEm: t.ocorridoEm })

/** Um "servidor" que guarda o que recebeu e quantos pedidos estiveram no ar ao mesmo tempo. */
function servidorDeTeste(falhar: (t: ToqueNaFila, tentativa: number) => Error | null = () => null) {
  const recebidos: string[] = []
  const tentativas = new Map<string, number>()
  let noAr = 0
  let maximoNoAr = 0
  const enviar: Envio = async (t) => {
    noAr += 1
    maximoNoAr = Math.max(maximoNoAr, noAr)
    await new Promise((r) => setTimeout(r, 2))
    noAr -= 1
    const n = (tentativas.get(t.id) ?? 0) + 1
    tentativas.set(t.id, n)
    const erro = falhar(t, n)
    if (erro) throw erro
    recebidos.push(t.id)
    return registroDe(t, recebidos.length)
  }
  return { enviar, recebidos, tentativas, maximoNoAr: () => maximoNoAr }
}

function novaFila(enviar: Envio, fabrica = new IDBFactory()) {
  return { fila: criarFila({ armazem: armazemIndexedDb(fabrica), enviar, travar: travaNaMemoria() }), fabrica }
}

describe('a fila de toques no aparelho (item 22)', () => {
  it('envia em ordem, um por vez, e so tira da fila o que o servidor confirmou', async () => {
    const s = servidorDeTeste()
    const { fila } = novaFila(s.enviar)
    const toques = [toque(), toque(), toque(), toque(), toque()]
    for (const t of toques) await fila.enfileirar(t)
    expect(fila.pendentes(ANA).map((t) => t.id)).toEqual(toques.map((t) => t.id))
    const confirmados: string[] = []
    fila.aoConfirmar((t) => confirmados.push(t.id))

    await Promise.all([fila.enviarPendentes(ANA), fila.enviarPendentes(ANA)])
    expect(s.recebidos).toEqual(toques.map((t) => t.id))
    expect(confirmados).toEqual(toques.map((t) => t.id))
    expect(s.maximoNoAr()).toBe(1)
    expect(fila.pendentes(ANA)).toEqual([])
  })

  it('a falha de rede deixa o toque na fila, e o envio seguinte o manda de novo, ainda em ordem', async () => {
    let semRede = true
    const s = servidorDeTeste(() => (semRede ? new ErroServico('INDISPONIVEL', 'Não foi possível falar com o servidor.') : null))
    const { fila } = novaFila(s.enviar)
    const toques = [toque(), toque(), toque()]
    for (const t of toques) await fila.enfileirar(t)

    await fila.enviarPendentes(ANA)
    expect(s.recebidos).toEqual([])
    expect(fila.pendentes(ANA).map((t) => t.id)).toEqual(toques.map((t) => t.id))

    semRede = false
    await fila.enviarPendentes(ANA)
    expect(s.recebidos).toEqual(toques.map((t) => t.id))
    expect(s.tentativas.get(toques[0].id)).toBe(2)
    expect(fila.pendentes(ANA)).toEqual([])
    expect(fila.recusas(ANA)).toEqual([])
  })

  it('a recusa definitiva tira o toque da fila e fica para a tela, agrupada pelo motivo; o envio segue', async () => {
    const MOTIVO = 'A sessão não está em andamento.'
    const s = servidorDeTeste((t) => (t.resultado === 'SEM_RESPOSTA' ? new ErroServico('CONFLITO', MOTIVO) : null))
    const { fila } = novaFila(s.enviar)
    const toques = [toque(), toque(ANA, 's1', 'SEM_RESPOSTA'), toque(), toque(ANA, 's1', 'SEM_RESPOSTA')]
    for (const t of toques) await fila.enfileirar(t)
    await fila.enviarPendentes(ANA)
    expect(s.recebidos).toEqual([toques[0].id, toques[2].id])
    expect(fila.pendentes(ANA)).toEqual([])
    expect(fila.recusas(ANA)).toEqual([{ motivo: MOTIVO, quantidade: 2 }])
    fila.dispensarRecusas(ANA)
    expect(fila.recusas(ANA)).toEqual([])

    // O que nao e recusa do toque fica: sessao de login vencida.
    const s2 = servidorDeTeste(() => new ErroServico('NAO_AUTENTICADO', 'Sua sessão terminou.'))
    const f2 = novaFila(s2.enviar).fila
    await f2.enfileirar(toque())
    await f2.enviarPendentes(ANA)
    expect(f2.pendentes(ANA)).toHaveLength(1)
    expect(f2.recusas(ANA)).toEqual([])
  })

  it('cada conta so envia a propria fila', async () => {
    const s = servidorDeTeste()
    const { fila } = novaFila(s.enviar)
    const daAna = [toque(ANA), toque(ANA)]
    const doBruno = [toque(BRUNO, 's9'), toque(BRUNO, 's9')]
    for (const t of [daAna[0], doBruno[0], daAna[1], doBruno[1]]) await fila.enfileirar(t)
    await fila.carregar(BRUNO)
    await fila.enviarPendentes(ANA)
    expect(s.recebidos).toEqual(daAna.map((t) => t.id))
    expect(fila.pendentes(ANA)).toEqual([])
    expect(fila.pendentes(BRUNO).map((t) => t.id)).toEqual(doBruno.map((t) => t.id))
  })

  it('desfazer tira da fila o ultimo toque da sessao, sem ir ao servidor', async () => {
    const s = servidorDeTeste()
    const { fila } = novaFila(s.enviar)
    const [a, b, outraSessao] = [toque(ANA, 's1'), toque(ANA, 's1'), toque(ANA, 's2')]
    for (const t of [a, b, outraSessao]) await fila.enfileirar(t)
    expect(await fila.desfazerUltimo(ANA, 's1')).toEqual(b)
    expect(fila.pendentes(ANA).map((t) => t.id)).toEqual([a.id, outraSessao.id])
    await fila.enviarPendentes(ANA)
    expect(s.recebidos).toEqual([a.id, outraSessao.id])
    // Fila vazia: nada a desfazer aqui; o que ja subiu, desfaz-se no servidor.
    expect(await fila.desfazerUltimo(ANA, 's1')).toBeNull()
  })

  it('desfazer espera o toque que esta a caminho: nunca tira da fila o que o servidor pode estar gravando', async () => {
    let liberar!: () => void
    const segura = new Promise<void>((r) => { liberar = r })
    const recebidos: string[] = []
    const enviar: Envio = async (t) => { await segura; recebidos.push(t.id); return registroDe(t) }
    const { fila } = novaFila(enviar)
    const t = toque()
    await fila.enfileirar(t)
    const envio = fila.enviarPendentes(ANA)
    await new Promise((r) => setTimeout(r, 5))
    const desfeito = fila.desfazerUltimo(ANA, 's1')
    liberar()
    await envio
    // O toque subiu: desfazer o encontra fora da fila, e a tela desfaz no servidor.
    expect(await desfeito).toBeNull()
    expect(recebidos).toEqual([t.id])
  })

  it('a fila sobrevive a fechar o app: outra fila no mesmo navegador le o que ficou', async () => {
    const fabrica = new IDBFactory()
    const primeira = novaFila(servidorDeTeste(() => new ErroServico('INDISPONIVEL', 'Sem rede.')).enviar, fabrica).fila
    const toques = [toque(), toque()]
    for (const t of toques) await primeira.enfileirar(t)
    await primeira.enviarPendentes(ANA)

    const s = servidorDeTeste()
    const reaberta = novaFila(s.enviar, fabrica).fila
    await reaberta.carregar(ANA)
    expect(reaberta.pendentes(ANA).map((t) => t.id)).toEqual(toques.map((t) => t.id))
    await reaberta.enviarPendentes(ANA)
    expect(s.recebidos).toEqual(toques.map((t) => t.id))
  })

  it('no IndexedDB, so os seis campos: nada a mais que venha no objeto', async () => {
    const { fila, fabrica } = novaFila(servidorDeTeste().enviar)
    const comSobra = { ...toque(), nomeDoPaciente: 'Miguel', evolucao: 'texto clínico', dominio: 'Comunicação' } as unknown as ToqueNaFila
    await fila.enfileirar(comSobra)
    const banco = await new Promise<IDBDatabase>((resolver, rejeitar) => {
      const pedido = fabrica.open('sinctea-fila')
      pedido.onsuccess = () => resolver(pedido.result)
      pedido.onerror = () => rejeitar(pedido.error)
    })
    const gravados = await new Promise<unknown[]>((resolver) => {
      const pedido = banco.transaction('toques').objectStore('toques').getAll()
      pedido.onsuccess = () => resolver(pedido.result)
    })
    banco.close()
    expect(gravados).toHaveLength(1)
    expect(Object.keys(gravados[0] as object).sort()).toEqual(['id', 'objetivoId', 'ocorridoEm', 'resultado', 'sessaoId', 'usuarioId'])
  })
})
