import type { Perfil } from '../tipos.js'

/**
 * Como cada perfil aparece na tela. Item 7: nenhuma tela diz "terapeuta"; o
 * enum continua TERAPEUTA no codigo e no banco, e muda so o que a pessoa le.
 * Mora no dominio desde o item 13c: o servidor grava a troca de perfis na
 * trilha com estes nomes, e a tela mostra o detalhe como foi gravado.
 */
export const NOME_DO_PERFIL: Record<Perfil, string> = {
  TERAPEUTA: 'Profissional da clínica',
  COORDENADOR: 'Coordenador clínico',
  ADMINISTRADOR: 'Administrador',
  RESPONSAVEL: 'Responsável',
  PROFESSOR: 'Professor / AEE',
}

/** O detalhe da troca de perfis na trilha: "Perfis: Coordenador clínico, Administrador". */
export function detalheDosPerfis(perfis: readonly Perfil[]): string {
  return `Perfis: ${perfis.map((p) => NOME_DO_PERFIL[p]).join(', ')}`
}
