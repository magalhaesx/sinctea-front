import { ErroServico, type CodigoErro, type RegistroAtividade } from '../servicos'
import type { Armazem, ToqueNaFila } from './armazem'

/**
 * A fila dos toques da tela 7 (item 22). Todo toque passa por ela, com ou sem
 * conexao: um caminho so. O toque e gravado primeiro no aparelho, depois
 * enviado, e so sai da fila quando o servidor confirma.
 *
 * O envio e estritamente em ordem, um por vez, por conta. Entre abas da mesma
 * conta, a trava do navegador (Web Locks) garante que so uma envia; desfazer
 * usa a mesma trava, e nunca tira da fila um toque que esta a caminho.
 *
 * Falha de rede, servidor fora do ar, sessao de login vencida ou limite de
 * tentativas: o toque fica, e vai de novo depois. Recusa definitiva do
 * servidor — sessao que nao esta em andamento, objetivo de outro plano,
 * horario fora da janela: o toque sai da fila e a recusa fica com a conta,
 * para a tela mostrar. Nunca some calado.
 */

export type Envio = (toque: ToqueNaFila) => Promise<RegistroAtividade>
export type Trava = <T>(nome: string, fazer: () => Promise<T>) => Promise<T>

export interface Recusa {
  motivo: string
  quantidade: number
}

/** O que nao e recusa do toque: tenta de novo depois. */
const DE_NOVO_DEPOIS: CodigoErro[] = ['INDISPONIVEL', 'NAO_AUTENTICADO', 'LIMITE_TENTATIVAS']
export const ehRecusaDefinitiva = (erro: unknown): erro is ErroServico =>
  erro instanceof ErroServico && !DE_NOVO_DEPOIS.includes(erro.codigo)

/** A trava de uma aba so, para quando o navegador nao tem Web Locks (e nos testes). */
export function travaNaMemoria(): Trava {
  const filas = new Map<string, Promise<unknown>>()
  return (nome, fazer) => {
    const anterior = filas.get(nome) ?? Promise.resolve()
    const vez = anterior.then(fazer, fazer)
    filas.set(nome, vez.catch(() => undefined))
    return vez
  }
}

export interface Fila {
  /** Grava o toque no aparelho. Quem chama manda enviar em seguida. */
  enfileirar(toque: ToqueNaFila): Promise<void>
  /** Envia, em ordem, os toques da conta, ate a fila esvaziar ou a rede faltar. */
  enviarPendentes(usuarioId: string): Promise<void>
  /** Tira da fila o ultimo toque da sessao, se ele ainda nao subiu; nulo se ja subiu. */
  desfazerUltimo(usuarioId: string, sessaoId: string): Promise<ToqueNaFila | null>
  /** Le a fila da conta do aparelho para a memoria (ao entrar, ao abrir o app). */
  carregar(usuarioId: string): Promise<void>
  pendentes(usuarioId: string): ToqueNaFila[]
  /** Sem saber de quem e a sessao (aberto sem conexao): quantos toques o aparelho guarda. */
  contarNoAparelho(): Promise<number>
  recusas(usuarioId: string): Recusa[]
  dispensarRecusas(usuarioId: string): void
  assinar(ouvinte: () => void): () => void
  aoConfirmar(ouvinte: (toque: ToqueNaFila, registro: RegistroAtividade) => void): () => void
}

const NENHUM: ToqueNaFila[] = []
const NENHUMA: Recusa[] = []

export function criarFila({ armazem, enviar, travar }: { armazem: Armazem; enviar: Envio; travar: Trava }): Fila {
  const fotos = new Map<string, ToqueNaFila[]>()
  const recusas = new Map<string, Recusa[]>()
  const ouvintes = new Set<() => void>()
  const confirmacoes = new Set<(toque: ToqueNaFila, registro: RegistroAtividade) => void>()
  const enviando = new Map<string, Promise<void>>()
  const nomeDaTrava = (usuarioId: string) => `sinctea-fila-${usuarioId}`

  const avisar = () => { for (const o of ouvintes) o() }
  const reler = async (usuarioId: string) => {
    const lista = await armazem.listar(usuarioId)
    fotos.set(usuarioId, lista.length === 0 ? NENHUM : lista)
    avisar()
  }
  const recusar = (usuarioId: string, motivo: string) => {
    const atuais = recusas.get(usuarioId) ?? []
    const mesma = atuais.find((r) => r.motivo === motivo)
    recusas.set(usuarioId, mesma
      ? atuais.map((r) => (r === mesma ? { motivo, quantidade: r.quantidade + 1 } : r))
      : [...atuais, { motivo, quantidade: 1 }])
  }

  /** Um toque, o primeiro da fila, dentro da trava. */
  const enviarUm = (usuarioId: string) => travar(nomeDaTrava(usuarioId), async (): Promise<'vazia' | 'seguir' | 'parar'> => {
    const [primeiro] = await armazem.listar(usuarioId)
    if (!primeiro) return 'vazia'
    try {
      const registro = await enviar(primeiro)
      await armazem.apagar(primeiro.id)
      for (const c of confirmacoes) c(primeiro, registro)
      return 'seguir'
    } catch (erro) {
      if (!ehRecusaDefinitiva(erro)) return 'parar'
      await armazem.apagar(primeiro.id)
      recusar(usuarioId, erro.message)
      return 'seguir'
    }
  })

  const fila: Fila = {
    async enfileirar(toque) {
      await armazem.gravar(toque)
      await reler(toque.usuarioId)
    },

    enviarPendentes(usuarioId) {
      const emCurso = enviando.get(usuarioId)
      if (emCurso) return emCurso
      const vez = (async () => {
        try {
          for (;;) {
            const passo = await enviarUm(usuarioId)
            await reler(usuarioId)
            if (passo !== 'seguir') return
          }
        } finally {
          enviando.delete(usuarioId)
        }
      })()
      enviando.set(usuarioId, vez)
      return vez
    },

    async desfazerUltimo(usuarioId, sessaoId) {
      const tirado = await travar(nomeDaTrava(usuarioId), async () => {
        const ultimo = (await armazem.listar(usuarioId)).filter((t) => t.sessaoId === sessaoId).at(-1)
        if (ultimo) await armazem.apagar(ultimo.id)
        return ultimo ?? null
      })
      await reler(usuarioId)
      return tirado
    },

    carregar: (usuarioId) => reler(usuarioId),
    pendentes: (usuarioId) => fotos.get(usuarioId) ?? NENHUM,
    contarNoAparelho: () => armazem.contarTudo(),
    recusas: (usuarioId) => recusas.get(usuarioId) ?? NENHUMA,
    dispensarRecusas(usuarioId) {
      recusas.delete(usuarioId)
      avisar()
    },
    assinar(ouvinte) {
      ouvintes.add(ouvinte)
      return () => { ouvintes.delete(ouvinte) }
    },
    aoConfirmar(ouvinte) {
      confirmacoes.add(ouvinte)
      return () => { confirmacoes.delete(ouvinte) }
    },
  }
  return fila
}
