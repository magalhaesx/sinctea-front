import type { Servicos } from '@sinctea/compartilhado'
import { servicosApi } from './api'
import { servicosMock } from './mock'
import { ehUuid } from '@sinctea/compartilhado/dominio/auditoria'

/**
 * Ponto unico de acesso a dados. Componentes importam daqui — nunca de
 * servicos/mock nem de servicos/api.
 *
 * A versao publicada (vite build) usa so a API, e o mock nem entra no pacote:
 * o plugin semMockNoPacote, do vite.config.ts, troca o './mock' daqui por um
 * modulo vazio (docs/07, secao 0). No desenvolvimento, VITE_API_URL escolhe a
 * API (npm run dev -- --mode api); sem ela, e nos testes, a implementacao
 * simulada, ate a Etapa 12.
 */
export const usandoApi: boolean = import.meta.env.PROD || Boolean(import.meta.env.VITE_API_URL)

export const servicos: Servicos = usandoApi ? servicosApi : servicosMock

/**
 * O que e um identificador para a camada ativa, para a tela conferir um filtro
 * antes de pedir (item 17): a API so conhece UUID; o mock, ate a Etapa 12,
 * usa ids legiveis ("p-001").
 */
export const ehIdentificador = (valor: string): boolean => (usandoApi ? ehUuid(valor) : valor.trim() !== '')

// A negativa da API avisa o contexto da sessao (item 7). Com o mock, nunca chama.
export { aoNegarAcesso } from './api/cliente'

// Tipos e contratos moram em compartilhado/, junto com o dominio: o servidor
// importa os mesmos. Componentes continuam importando daqui.
export * from '@sinctea/compartilhado'
