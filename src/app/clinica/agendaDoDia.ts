import type { DataCivil, ItemAgenda } from '@sinctea/compartilhado'
import { diaDoAgendamento } from '@sinctea/compartilhado/dominio/agenda'

/**
 * O que cada linha da agenda (tela 3, item 19b) oferece, pela situacao e pelo
 * dia de Manaus em que a sessao esta marcada:
 *
 * - agendada de hoje: "Iniciar" (e "Cancelar");
 * - agendada de outro dia que ainda vem: "Cancelar";
 * - agendada de dia que ja passou: "Nao iniciada", com "Cancelar";
 * - em andamento ou pausada: "Abrir a sessao";
 * - encerrada: "Ver a sessao";
 * - cancelada: a etiqueta, sem botao.
 *
 * O servidor confere tudo de novo: so se inicia no dia, e so quem vai
 * conduzir cancela.
 */
export type AcaoNaAgenda = 'INICIAR' | 'CANCELAR_FUTURA' | 'NAO_INICIADA' | 'ABRIR' | 'VER' | 'CANCELADA'

export function acaoNaAgenda(item: Pick<ItemAgenda, 'situacao' | 'inicioPrevistoEm'>, hoje: DataCivil): AcaoNaAgenda {
  switch (item.situacao) {
    case 'EM_ANDAMENTO':
    case 'PAUSADA':
      return 'ABRIR'
    case 'ENCERRADA':
      return 'VER'
    case 'CANCELADA':
      return 'CANCELADA'
    case 'AGENDADA': {
      const dia = diaDoAgendamento(item.inicioPrevistoEm)
      return dia === hoje ? 'INICIAR' : dia < hoje ? 'NAO_INICIADA' : 'CANCELAR_FUTURA'
    }
  }
}

/** A agendada, de qualquer dia, ainda se cancela. */
export const cancelavel = (acao: AcaoNaAgenda) => acao === 'INICIAR' || acao === 'CANCELAR_FUTURA' || acao === 'NAO_INICIADA'
