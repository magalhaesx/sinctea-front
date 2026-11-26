import type { Paciente, TrilhaAutonomia } from '@sinctea/compartilhado'
import { montarTrilha } from '@sinctea/compartilhado/dominio/trilha'
export { detalheDaTrilha } from '@sinctea/compartilhado/dominio/trilha'
import { banco, relogio } from './infra'

/**
 * A trilha de autonomia (item 24) no mock, montada por montarTrilha, a mesma
 * do servidor: so o plano vigente, e o texto como foi escrito. Quem pede ja
 * passou pelo alcance da clinica ou da familia.
 */
export function trilhaDoMock(paciente: Paciente): TrilhaAutonomia {
  const plano = banco.planos.find((p) => p.pacienteId === paciente.id && p.status === 'VIGENTE') ?? null
  return montarTrilha({
    paciente: { id: paciente.id, nome: paciente.nome },
    plano: plano && {
      status: plano.status,
      objetivos: plano.objetivos.map((o) => ({
        id: o.id, descricaoAcessivel: o.descricaoAcessivel, status: o.status, dominadoEm: o.dominadoEm,
        cartoes: banco.cartoes.filter((c) => c.objetivoId === o.id),
      })),
    },
    agora: relogio.agora(),
  })
}
