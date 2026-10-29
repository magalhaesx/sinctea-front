import { diaCivilEm } from '@sinctea/compartilhado/dominio/datas'
import { textoDoRegistroRepetido } from '@sinctea/compartilhado/dominio/regras'
import type { ExecucaoAtividadeCasa } from '../../servicos'

/**
 * O registro de hoje na tela 16 (item 15b). Com um registro de hoje, no dia
 * de Manaus, o "Como foi hoje?" sai, e no lugar dele a tela diz quem ja
 * registrou. Quem decide continua sendo o indice unico do servidor: isto so
 * poupa a familia de tocar em "Salvar" para ouvir a recusa.
 *
 * Os testes do front rodam no Node, sem navegador: a decisao fica aqui, e a
 * tela so a mostra.
 */

export const AMANHA_DA_PARA_REGISTRAR = 'Amanhã dá para registrar de novo.'

/** O titulo do aviso que toma o lugar do "Como foi hoje?", ou null se ainda da para registrar hoje. */
export function registroDeHoje(
  execucoes: ExecucaoAtividadeCasa[], euId: string | undefined, agora = new Date(),
): string | null {
  // Um registro por dia: o de hoje, se houver, e o mais recente.
  const deHoje = execucoes.find((e) => e.dataRealizacao === diaCivilEm(agora))
  if (!deHoje) return null
  return deHoje.responsavelId === euId ? 'Você já registrou hoje.' : textoDoRegistroRepetido(deHoje.responsavelNome)
}

export type LugarDoRegistro =
  | { tipo: 'encerrada' }
  | { tipo: 'registrado'; titulo: string }
  | { tipo: 'formulario' }

/** O que fica no lugar do "Como foi hoje?": encerrada vem antes do registro de hoje. */
export function lugarDoRegistro(
  ativa: boolean, execucoes: ExecucaoAtividadeCasa[], euId: string | undefined, agora = new Date(),
): LugarDoRegistro {
  if (!ativa) return { tipo: 'encerrada' }
  const titulo = registroDeHoje(execucoes, euId, agora)
  return titulo ? { tipo: 'registrado', titulo } : { tipo: 'formulario' }
}

/** No historico, o nome so quando foi outro responsavel: o "voce" do titulo ja diz o resto. */
export const quemRegistrou = (e: ExecucaoAtividadeCasa, euId: string | undefined): string | null =>
  e.responsavelId === euId ? null : `Registrado por ${e.responsavelNome}`
