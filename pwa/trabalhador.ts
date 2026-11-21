import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import type { Plugin } from 'vite'

/**
 * O service worker do SINCTEA (item 22), escrito a mao e gerado no build.
 *
 * Por que a mao, e nao vite-plugin-pwa: o que ele faz cabe em poucas linhas
 * e fica inteiro a vista — guardar os arquivos do app e responder com eles,
 * e nada mais. Sem dependencia nova, e sem regra de cache em tempo de
 * execucao que um dia possa guardar uma resposta da API.
 *
 * Depois de o Vite escrever o build, este plugin le a pasta de saida, faz a
 * lista dos arquivos do app — HTML, JS, CSS, fontes, icones e o manifesto — e
 * escreve sw.js com ela. A versao e o resumo do conteudo de todos: mudou um
 * byte, o navegador acha um sw.js diferente, e a tela oferece "Atualizar".
 *
 * O sw so responde por um endereco que esta na lista, e so do cache. Nenhum
 * outro pedido passa por ele: a API nunca e guardada, nem lida do cache.
 */

const MODELO = `/* SINCTEA — service worker (item 22). Gerado no build por pwa/trabalhador.ts: nao edite. */
const VERSAO = '__VERSAO__'
const CACHE = 'sinctea-app-' + VERSAO
const ARQUIVOS = __ARQUIVOS__

const ENDERECOS = new Set(ARQUIVOS.map((a) => new URL(a, self.location).href))
const RAIZ = new URL('./', self.location).href

// Instala com os arquivos do app. A versao nova nao assume sozinha: espera a
// tela pedir, quando a pessoa toca em "Atualizar".
self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ARQUIVOS)))
})

// Ativa e apaga as versoes anteriores do app. So os caches do proprio app.
self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    for (const nome of await caches.keys()) {
      if (nome.startsWith('sinctea-app-') && nome !== CACHE) await caches.delete(nome)
    }
    await self.clients.claim()
  })())
})

self.addEventListener('message', (evento) => {
  if (evento.data === 'atualizar') self.skipWaiting()
})

// So os arquivos da lista, so do cache. O resto nem passa por aqui.
self.addEventListener('fetch', (evento) => {
  const pedido = evento.request
  if (pedido.method !== 'GET') return
  const url = new URL(pedido.url)
  url.hash = ''
  if (pedido.mode === 'navigate' && url.origin === self.location.origin && url.pathname === new URL(RAIZ).pathname) url.search = ''
  if (!ENDERECOS.has(url.href)) return
  evento.respondWith(caches.open(CACHE).then((cache) => cache.match(url.href)).then((guardado) => guardado || fetch(pedido)))
})
`

/** Os arquivos de uma pasta, com o caminho relativo a ela, em barras normais. */
function listar(pasta: string, base = pasta): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome)
    return statSync(caminho).isDirectory() ? listar(caminho, base) : [relative(base, caminho).split(sep).join('/')]
  })
}

export function trabalhadorDoApp(): Plugin {
  return {
    name: 'sinctea-service-worker',
    apply: 'build',
    writeBundle(opcoes) {
      const pasta = opcoes.dir
      if (!pasta) return
      const arquivos = listar(pasta).filter((a) => a !== 'sw.js' && !a.endsWith('.map')).sort()
      const resumo = createHash('sha256')
      for (const a of arquivos) resumo.update(a).update(readFileSync(join(pasta, a)))
      const versao = resumo.digest('hex').slice(0, 16)
      // A raiz entra como "./": e o endereco que o navegador pede para abrir o app.
      const lista = ['./', ...arquivos.map((a) => `./${a}`)]
      writeFileSync(join(pasta, 'sw.js'), MODELO.replace('__VERSAO__', versao).replace('__ARQUIVOS__', JSON.stringify(lista, null, 2)))
    },
  }
}
