import type { DataIso, Resultado } from '../servicos'

/**
 * O toque guardado no aparelho (item 22). So estes seis campos, e nada mais:
 * nenhum texto clinico, nenhum nome. O resultado e o objetivo sao
 * identificadores e um valor de lista; o texto do objetivo fica no servidor.
 */
export interface ToqueNaFila {
  id: string
  usuarioId: string
  sessaoId: string
  objetivoId: string
  resultado: Resultado
  ocorridoEm: DataIso
}

/** Onde a fila mora. Lista sempre por conta, na ordem do id (UUID v7: a ordem dos toques). */
export interface Armazem {
  gravar(toque: ToqueNaFila): Promise<void>
  listar(usuarioId: string): Promise<ToqueNaFila[]>
  apagar(id: string): Promise<void>
  /** Quantos toques o aparelho guarda, de todas as contas: so o numero. */
  contarTudo(): Promise<number>
}

/** So os seis campos: o que vier a mais no objeto nao vai para o disco. */
export const soOsSeisCampos = ({ id, usuarioId, sessaoId, objetivoId, resultado, ocorridoEm }: ToqueNaFila): ToqueNaFila =>
  ({ id, usuarioId, sessaoId, objetivoId, resultado, ocorridoEm })

const BANCO = 'sinctea-fila'
const TOQUES = 'toques'
const POR_CONTA = 'porConta'

const comoPromessa = <T>(pedido: IDBRequest<T>) =>
  new Promise<T>((resolver, rejeitar) => {
    pedido.onsuccess = () => resolver(pedido.result)
    pedido.onerror = () => rejeitar(pedido.error)
  })

/**
 * A fila no IndexedDB do navegador: uma base, um armazem de toques com o id
 * como chave, e um indice [usuarioId, id] — a lista de uma conta ja sai na
 * ordem dos toques. Com ate cinco contas por navegador (item 9), cada aba so
 * le e envia a da propria conta.
 */
export function armazemIndexedDb(fabrica: IDBFactory): Armazem {
  let aberto: Promise<IDBDatabase> | null = null
  const abrir = () => {
    aberto ??= new Promise<IDBDatabase>((resolver, rejeitar) => {
      const pedido = fabrica.open(BANCO, 1)
      pedido.onupgradeneeded = () => {
        const armazem = pedido.result.createObjectStore(TOQUES, { keyPath: 'id' })
        armazem.createIndex(POR_CONTA, ['usuarioId', 'id'])
      }
      pedido.onsuccess = () => resolver(pedido.result)
      pedido.onerror = () => { aberto = null; rejeitar(pedido.error) }
    })
    return aberto
  }
  const transacao = async <T>(modo: IDBTransactionMode, fazer: (armazem: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const banco = await abrir()
    const tx = banco.transaction(TOQUES, modo)
    const resultado = await comoPromessa(fazer(tx.objectStore(TOQUES)))
    await new Promise<void>((resolver, rejeitar) => {
      tx.oncomplete = () => resolver()
      tx.onerror = () => rejeitar(tx.error)
      tx.onabort = () => rejeitar(tx.error)
    })
    return resultado
  }
  return {
    gravar: async (toque) => { await transacao('readwrite', (a) => a.add(soOsSeisCampos(toque))) },
    listar: (usuarioId) => transacao('readonly', (a) =>
      a.index(POR_CONTA).getAll(IDBKeyRange.bound([usuarioId, ''], [usuarioId, '\uffff'])) as IDBRequest<ToqueNaFila[]>),
    apagar: async (id) => { await transacao('readwrite', (a) => a.delete(id)) },
    contarTudo: () => transacao('readonly', (a) => a.count()),
  }
}

/**
 * Sem IndexedDB (janela privada que o bloqueia, ambiente de teste), a fila
 * fica na memoria da aba: funciona igual, mas some ao fechar a aba.
 */
export function armazemEmMemoria(): Armazem {
  const toques = new Map<string, ToqueNaFila>()
  return {
    gravar: async (toque) => {
      if (toques.has(toque.id)) throw new Error('Toque repetido na fila.')
      toques.set(toque.id, soOsSeisCampos(toque))
    },
    listar: async (usuarioId) => [...toques.values()].filter((t) => t.usuarioId === usuarioId).sort((a, b) => (a.id < b.id ? -1 : 1)),
    apagar: async (id) => { toques.delete(id) },
    contarTudo: async () => toques.size,
  }
}
