import { useEffect, useSyncExternalStore } from 'react'
import { servicos } from '../servicos'
import { armazemEmMemoria, armazemIndexedDb, type Armazem } from './armazem'
import { criarFila, travaNaMemoria, type Recusa, type Trava } from './filaDeToques'
import type { ToqueNaFila } from './armazem'

export type { Recusa, ToqueNaFila }

/**
 * A fila deste navegador (item 22), uma so para o app: a tela 7 enfileira, o
 * sincronizador envia, as telas 3 e 7 e o "Sair" leem quantos faltam.
 */

/** IndexedDB, se o navegador deixar abrir; se nao, a memoria da aba. */
function armazemDoNavegador(): Armazem {
  if (typeof indexedDB === 'undefined') return armazemEmMemoria()
  const disco = armazemIndexedDb(indexedDB)
  const memoria = armazemEmMemoria()
  let usar: Promise<Armazem> | null = null
  const escolher = () => {
    usar ??= disco.listar('').then(() => disco, () => memoria)
    return usar
  }
  return {
    gravar: async (t) => (await escolher()).gravar(t),
    listar: async (u) => (await escolher()).listar(u),
    apagar: async (id) => (await escolher()).apagar(id),
    contarTudo: async () => (await escolher()).contarTudo(),
  }
}

/** Web Locks entre as abas; sem eles, a trava da propria aba. */
function travaDoNavegador(): Trava {
  const naMemoria = travaNaMemoria()
  return (nome, fazer) => (typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request(nome, fazer)
    : naMemoria(nome, fazer))
}

export const fila = criarFila({
  armazem: armazemDoNavegador(),
  enviar: (t) => servicos.sessoes.registrarAtividade(t.sessaoId, t.objetivoId, t.resultado, { id: t.id, ocorridoEm: t.ocorridoEm }),
  travar: travaDoNavegador(),
})

const NADA: ToqueNaFila[] = []
const NENHUMA: Recusa[] = []

/** Os toques da conta que ainda nao subiram, na ordem. */
export function usarPendentes(usuarioId: string | undefined): ToqueNaFila[] {
  return useSyncExternalStore(fila.assinar, () => (usuarioId ? fila.pendentes(usuarioId) : NADA))
}

/** Os toques que o servidor recusou, agrupados pelo motivo. */
export function usarRecusas(usuarioId: string | undefined): Recusa[] {
  return useSyncExternalStore(fila.assinar, () => (usuarioId ? fila.recusas(usuarioId) : NENHUMA))
}

/** Tentativa periodica de envio, enquanto ha toque na fila. */
const INTERVALO_MS = 30_000

/**
 * Envia a fila da conta ao abrir o app, ao voltar a conexao, ao voltar a aba
 * e de tempos em tempos. Montado uma vez, dentro da sessao.
 */
export function usarSincronizacao(usuarioId: string | undefined): void {
  useEffect(() => {
    if (!usuarioId) return undefined
    const enviar = () => { void fila.enviarPendentes(usuarioId) }
    void fila.carregar(usuarioId).then(enviar)
    const aoVoltar = () => { if (document.visibilityState === 'visible') enviar() }
    const periodico = setInterval(() => { if (fila.pendentes(usuarioId).length > 0) enviar() }, INTERVALO_MS)
    window.addEventListener('online', enviar)
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      clearInterval(periodico)
      window.removeEventListener('online', enviar)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [usuarioId])
}
