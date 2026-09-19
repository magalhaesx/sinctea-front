import type { Servicos } from './contratos'
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

export type * from './contratos'
export * from './tipos'
