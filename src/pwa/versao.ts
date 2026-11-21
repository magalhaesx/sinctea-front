import { useSyncExternalStore } from 'react'

/**
 * O service worker do app (item 22; pwa/trabalhador.ts gera o sw.js no
 * build). So na versao publicada: no desenvolvimento, o Vite serve o codigo
 * vivo, e um app guardado atrapalharia.
 *
 * A versao nova nunca entra sozinha. Quando o navegador acha um sw.js
 * diferente, ele o instala e o deixa esperando; a tela mostra "Nova versao
 * disponivel", e so quando a pessoa toca em "Atualizar" o novo assume e a
 * pagina recarrega. A tela decide quando chamar atualizar(): com toque na fila,
 * ela espera a fila esvaziar.
 */

let registro: ServiceWorkerRegistration | null = null
let disponivel = false
let pedidoPelaPessoa = false
const ouvintes = new Set<() => void>()
const avisar = () => { for (const o of ouvintes) o() }

/** De hora em hora, e quando a conexao volta, o navegador confere se ha sw.js novo. */
const CONFERIR_A_CADA_MS = 60 * 60_000

function vigiar(r: ServiceWorkerRegistration): void {
  const marcarSeEsperando = () => {
    // Sem controlador e a primeira instalacao: nao ha versao velha a trocar.
    if (r.waiting && navigator.serviceWorker.controller) {
      disponivel = true
      avisar()
    }
  }
  marcarSeEsperando()
  r.addEventListener('updatefound', () => {
    const novo = r.installing
    novo?.addEventListener('statechange', () => { if (novo.state === 'installed') marcarSeEsperando() })
  })
}

export function registrarTrabalhador(): void {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  // Recarrega so quando foi a pessoa que pediu: a troca de controlador da
  // primeira instalacao nao recarrega nada.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (pedidoPelaPessoa) window.location.reload()
  })
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((r) => {
      registro = r
      vigiar(r)
      const conferir = () => { void r.update().catch(() => undefined) }
      setInterval(conferir, CONFERIR_A_CADA_MS)
      window.addEventListener('online', conferir)
    }).catch(() => undefined)
  })
}

/** A versao nova assume, e a pagina recarrega. So a tela chama, a pedido da pessoa. */
export function atualizar(): void {
  const esperando = registro?.waiting
  if (!esperando) return
  pedidoPelaPessoa = true
  esperando.postMessage('atualizar')
}

export function usarVersaoNova(): boolean {
  return useSyncExternalStore((o) => { ouvintes.add(o); return () => { ouvintes.delete(o) } }, () => disponivel)
}
