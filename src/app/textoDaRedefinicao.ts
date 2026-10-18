import { FUSO_DA_INSTANCIA, diaCivilEm, emDataCivil } from '@sinctea/compartilhado/dominio/datas'
import type { AvisoDeRedefinicao } from '../servicos'

/**
 * O aviso do proximo acesso depois da nova senha que a coordenacao gerou
 * (item 8). A data e a hora sao as de Manaus, a da instancia, qualquer que
 * seja o fuso de quem le.
 */
export function textoDoAvisoDeRedefinicao({ redefinidaEm, aPedidoDe }: AvisoDeRedefinicao): string {
  const instante = new Date(redefinidaEm)
  const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO_DA_INSTANCIA }).format(instante)
  const quando = `${emDataCivil(diaCivilEm(instante))} às ${hora}`
  return `Sua senha foi redefinida pela clínica em ${quando}, a pedido de ${aPedidoDe}. Se não foi você quem pediu, procure a clínica.`
}
