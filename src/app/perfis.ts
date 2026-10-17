import type { Perfil } from '../servicos'
import { SO_CAMINHO_PRINCIPAL } from './caminhoPrincipal'

/** Como cada perfil aparece na interface, e para onde ele entra ao autenticar. */
export const NOME_DO_PERFIL: Record<Perfil, string> = {
  // Item 7: nenhuma tela diz "terapeuta". O enum continua TERAPEUTA no codigo
  // e no banco; muda so o que a pessoa le.
  TERAPEUTA: 'Profissional da clínica',
  COORDENADOR: 'Coordenador clínico',
  ADMINISTRADOR: 'Administrador',
  RESPONSAVEL: 'Responsável',
  PROFESSOR: 'Professor / AEE',
}

/**
 * Painel inicial de cada perfil (mapa de rotas: docs/01, secao 2). So no
 * caminho principal, os indicadores da coordenacao ainda nao existem: a
 * entrada dela e a fila de planos. O painel do terapeuta abre com os avisos
 * da escola, sem a agenda.
 */
export const PAINEL_DO_PERFIL: Record<Perfil, string> = {
  TERAPEUTA: '/app/clinica',
  COORDENADOR: SO_CAMINHO_PRINCIPAL ? '/app/coordenacao/planos' : '/app/coordenacao',
  ADMINISTRADOR: '/app/admin/usuarios',
  RESPONSAVEL: '/app/familia',
  PROFESSOR: '/app/escola',
}

/** Uma pessoa da equipe na tela: "Ana Souza · Psicologia" (item 7). Sem especialidade, so o nome. */
export function comEspecialidade(pessoa: { nome: string; especialidade?: string | null }): string {
  return pessoa.especialidade ? `${pessoa.nome} · ${pessoa.especialidade}` : pessoa.nome
}

/** O que aparece debaixo do nome de quem esta na sessao: a especialidade, para quem atende; o perfil, para os demais. */
export function papelNaTela(perfil: Perfil, especialidade: string | null): string {
  return perfil === 'TERAPEUTA' && especialidade ? especialidade : NOME_DO_PERFIL[perfil]
}

/** Area visual de cada perfil (docs/02, secao 1). */
export const AREA_DO_PERFIL: Record<Perfil, 'cli' | 'fam' | 'esc'> = {
  TERAPEUTA: 'cli',
  COORDENADOR: 'cli',
  ADMINISTRADOR: 'cli',
  RESPONSAVEL: 'fam',
  PROFESSOR: 'esc',
}
