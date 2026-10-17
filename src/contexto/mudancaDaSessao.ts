import type { Perfil, SessaoUsuario } from '../servicos'

/**
 * Duas contas no mesmo navegador (item 7): o cookie de sessao e um so para
 * todas as janelas. Se outra janela entra com outra conta, troca de perfil ou
 * sai, esta continua mostrando a pessoa de antes, e os pedidos dela passam a
 * ser negados. Comparando o que esta janela mostra com a sessao de agora, a
 * tela diz o que aconteceu, em vez de falhar em silencio.
 */
export type MudancaDaSessao =
  | { tipo: 'MESMA' }
  | { tipo: 'OUTRA_CONTA'; nome: string }
  | { tipo: 'OUTRO_PERFIL'; perfil: Perfil }
  | { tipo: 'SEM_SESSAO' }

export interface QuemEstaNaJanela { usuarioId: string; perfilAtivo: Perfil }

export function mudancaDaSessao(naJanela: QuemEstaNaJanela | null, agora: SessaoUsuario | null): MudancaDaSessao {
  if (!agora) return naJanela ? { tipo: 'SEM_SESSAO' } : { tipo: 'MESMA' }
  if (!naJanela || naJanela.usuarioId !== agora.usuario.id) return { tipo: 'OUTRA_CONTA', nome: agora.usuario.nome }
  if (naJanela.perfilAtivo !== agora.perfilAtivo) return { tipo: 'OUTRO_PERFIL', perfil: agora.perfilAtivo }
  return { tipo: 'MESMA' }
}
