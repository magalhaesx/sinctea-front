import { ErroServico } from '@sinctea/compartilhado'
import { Negacao, SEM_PERMISSAO } from '../acesso/negacao.js'
import type { ServicoBanco } from '../banco/servico-banco.js'
import type { SessaoServidor } from '../http/tipos-http.js'
import { exigirUuid } from '../http/validacao.js'

/**
 * Alcance clinico (docs/07, D7), portado de src/servicos/mock/acesso.ts: o
 * terapeuta alcanca os pacientes cuja equipe integra; o coordenador, todos.
 * Responsavel, professor e administrador nunca alcancam dado clinico (regra 3).
 */

export function alcancaClinicamente(sessao: SessaoServidor, equipeIds: string[]): boolean {
  if (sessao.perfilAtivo === 'COORDENADOR') return true
  if (sessao.perfilAtivo === 'TERAPEUTA') return equipeIds.includes(sessao.usuario.id)
  return false
}

/** O paciente, se existe e se quem pede o alcanca. A negativa leva o paciente para a trilha. */
export async function exigirPacienteClinico(banco: ServicoBanco, sessao: SessaoServidor, pacienteId: string) {
  const id = exigirUuid(pacienteId, 'Paciente')
  const paciente = await banco.paciente.findUnique({ where: { id }, include: { equipe: true } })
  if (!paciente) throw new ErroServico('NAO_ENCONTRADO', 'Paciente não encontrado.')
  if (!alcancaClinicamente(sessao, paciente.equipe.map((e) => e.profissionalId))) {
    throw new Negacao(SEM_PERMISSAO, { pacienteId: id, detalhe: 'Paciente fora do alcance do perfil.' })
  }
  return paciente
}
