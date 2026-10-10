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
  ADMINISTRADOR: '/app/admin/usuarios',
  RESPONSAVEL: '/app/familia',
  PROFESSOR: '/app/escola',
}

/** Area visual de cada perfil (docs/02, secao 1). */
export const AREA_DO_PERFIL: Record<Perfil, 'cli' | 'fam' | 'esc'> = {
  TERAPEUTA: 'cli',
  COORDENADOR: 'cli',
  ADMINISTRADOR: 'cli',
  RESPONSAVEL: 'fam',
  PROFESSOR: 'esc',
}
