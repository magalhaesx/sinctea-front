import type { Paciente } from '../tipos'
import { banco, exigirSessao, naoEncontrado, negar, type SessaoServidor } from './infra'

/**
 * Regras de alcance por perfil, aplicadas pelo "servidor" simulado.
 * O terapeuta alcanca os pacientes cuja equipe integra; o coordenador, todos;
 * o responsavel, apenas os proprios filhos. Professor e administrador nunca
 * alcancam dado clinico.
 */

export function alcancaClinicamente(sessao: SessaoServidor, paciente: Paciente): boolean {
  if (sessao.perfilAtivo === 'COORDENADOR') return true
  if (sessao.perfilAtivo === 'TERAPEUTA') return paciente.equipeIds.includes(sessao.usuario.id)
  return false
}

export function ehResponsavelDe(sessao: SessaoServidor, paciente: Paciente): boolean {
  return sessao.perfilAtivo === 'RESPONSAVEL' &&
    paciente.responsaveis.some((r) => r.responsavelId === sessao.usuario.id)
}

function buscarPaciente(pacienteId: string): Paciente {
  return banco.pacientes.find((p) => p.id === pacienteId) ?? naoEncontrado('Paciente')
}

/** Acesso a dado clinico do paciente. A negacao entra na auditoria. */
export function exigirPacienteClinico(pacienteId: string, entidade: string): { sessao: SessaoServidor; paciente: Paciente } {
  const sessao = exigirSessao()
  const paciente = buscarPaciente(pacienteId)
  if (!alcancaClinicamente(sessao, paciente)) {
    negar(sessao, { entidade, pacienteId, detalhe: 'Paciente fora do alcance do perfil.' })
  }
  return { sessao, paciente }
}

/** Acesso do responsavel aos dados do proprio filho. */
export function exigirPacienteDaFamilia(pacienteId: string, entidade: string): { sessao: SessaoServidor; paciente: Paciente } {
  const sessao = exigirSessao()
  const paciente = buscarPaciente(pacienteId)
  if (!ehResponsavelDe(sessao, paciente)) {
    negar(sessao, { entidade, pacienteId, detalhe: 'Responsável não vinculado ao paciente.' })
  }
  return { sessao, paciente }
}

/** Clinica ou familia do paciente — usado em atividades e consentimentos. */
export function exigirPacienteClinicoOuFamilia(pacienteId: string, entidade: string): { sessao: SessaoServidor; paciente: Paciente } {
  const sessao = exigirSessao()
  const paciente = buscarPaciente(pacienteId)
  if (!alcancaClinicamente(sessao, paciente) && !ehResponsavelDe(sessao, paciente)) {
    negar(sessao, { entidade, pacienteId, detalhe: 'Paciente fora do alcance do perfil.' })
  }
  return { sessao, paciente }
}
