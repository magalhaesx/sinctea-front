import type { Servicos } from '@sinctea/compartilhado'
import { servicosApi } from './api'
import { servicosMock } from './mock'

/**
 * Ponto unico de acesso a dados. Componentes importam daqui — nunca de
 * servicos/mock nem de servicos/api.
 *
 * Com VITE_API_URL definida, usa a API real; sem ela, a implementacao simulada.
 */
const usarApi = Boolean(import.meta.env.VITE_API_URL)

export const servicos: Servicos = usarApi ? servicosApi : servicosMock

// Tipos e contratos moram em compartilhado/, junto com o dominio: o servidor
// importa os mesmos. Componentes continuam importando daqui.
export * from '@sinctea/compartilhado'
