import type { Perfil } from '../servicos'

/** Como cada perfil aparece na interface, e para onde ele entra ao autenticar. */
export const NOME_DO_PERFIL: Record<Perfil, string> = {
  TERAPEUTA: 'Terapeuta',
  COORDENADOR: 'Coordenador clínico',
  ADMINISTRADOR: 'Administrador',
  RESPONSAVEL: 'Responsável',
  PROFESSOR: 'Professor / AEE',
}

/** Painel inicial de cada perfil (mapa de rotas: docs/01, secao 2). */
export const PAINEL_DO_PERFIL: Record<Perfil, string> = {
  TERAPEUTA: '/app/clinica',
  COORDENADOR: '/app/coordenacao',
  ADMINISTRADOR: '/app/conta',
  RESPONSAVEL: '/app/familia',
  PROFESSOR: '/app/escola',
}

/**
 * Identificadores usados enquanto a lista de pacientes (tela 4) e a lista de
 * atividades (tela 9) nao existem. As etapas 4 e 5 substituem estes atalhos
 * por navegacao real; nenhum outro lugar do codigo fixa identificador.
 */
export const DEMONSTRACAO = { paciente: 'p-001', atividade: 'a-003' } as const

/** Area visual de cada perfil (docs/02, secao 1). */
export const AREA_DO_PERFIL: Record<Perfil, 'cli' | 'fam' | 'esc'> = {
  TERAPEUTA: 'cli',
  COORDENADOR: 'cli',
  ADMINISTRADOR: 'cli',
  RESPONSAVEL: 'fam',
  PROFESSOR: 'esc',
}
