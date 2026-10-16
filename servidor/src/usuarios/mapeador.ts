import type { Profissional, Usuario } from '@sinctea/compartilhado'
import type { Profissional as LinhaProfissional, Usuario as LinhaUsuario } from '../gerado/client.js'

/**
 * Do banco para os tipos do compartilhado. Nenhuma resposta devolve modelo do
 * Prisma (docs/01, secao 5): o que sai e o recorte publico, e o senhaHash
 * nunca esta nele.
 */

export function paraUsuario(u: LinhaUsuario): Usuario {
  return {
    id: u.id, nome: u.nome, email: u.email, perfis: u.perfis, ativo: u.ativo,
    ultimoAcessoEm: u.ultimoAcessoEm?.toISOString() ?? null,
  }
}

export function paraProfissional(u: LinhaUsuario & { profissional: LinhaProfissional }): Profissional {
  return {
    tipo: 'PROFISSIONAL', ...paraUsuario(u),
    especialidade: u.profissional.especialidade, registroConselho: u.profissional.registroConselho,
  }
}
