import type { Perfil } from '../servicos'
import { NOME_DO_PERFIL } from '@sinctea/compartilhado/dominio/perfis'

/**
 * Como cada perfil aparece na interface: o nome mora no dominio desde o item
 * 13c, porque o servidor tambem o grava na trilha.
 */
export { NOME_DO_PERFIL }

/**
 * Painel inicial de cada perfil (mapa de rotas: docs/01, secao 2). A
 * coordenacao entra pelos indicadores, que voltaram com o item 19. O painel
 * do terapeuta abre com os avisos da escola, sem a agenda.
 */
export const PAINEL_DO_PERFIL: Record<Perfil, string> = {
  TERAPEUTA: '/app/clinica',
  COORDENADOR: '/app/coordenacao',
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
