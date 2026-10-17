import type { Perfil } from '../servicos'
import { SO_CAMINHO_PRINCIPAL } from './caminhoPrincipal'

/** Como cada perfil aparece na interface, e para onde ele entra ao autenticar. */
export const NOME_DO_PERFIL: Record<Perfil, string> = {
  TERAPEUTA: 'Terapeuta',
  COORDENADOR: 'Coordenador clínico',
  ADMINISTRADOR: 'Administrador',
  RESPONSAVEL: 'Responsável',
  PROFESSOR: 'Professor / AEE',
}

/**
 * Painel inicial de cada perfil (mapa de rotas: docs/01, secao 2). So no
 * caminho principal, a agenda do terapeuta e os indicadores da coordenacao
 * ainda nao existem: a entrada e a lista de pacientes e a fila de planos.
 */
export const PAINEL_DO_PERFIL: Record<Perfil, string> = {
  TERAPEUTA: SO_CAMINHO_PRINCIPAL ? '/app/clinica/pacientes' : '/app/clinica',
  COORDENADOR: SO_CAMINHO_PRINCIPAL ? '/app/coordenacao/planos' : '/app/coordenacao',
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
