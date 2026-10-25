import type { SituacaoConsentimento } from '../../servicos'

/**
 * A etiqueta de cada autorizacao na tela 17 (item 10). As quatro situacoes do
 * dominio, cada uma com a sua: a que ainda nao comecou nao e "Prazo terminado",
 * e diz o mesmo que a ficha (tela 5).
 */
export const ETIQUETA_DA_AUTORIZACAO: Record<SituacaoConsentimento, { rotulo: string; tom: 'ok' | 'neutro'; simbolo: string }> = {
  VIGENTE: { rotulo: 'Acesso ativo', tom: 'ok', simbolo: '✓' },
  // Sem "por voce": qualquer responsavel vinculado encerra, e o consentimento
  // nao guarda quem foi. A trilha guarda.
  REVOGADO: { rotulo: 'Acesso encerrado', tom: 'neutro', simbolo: '○' },
  EXPIRADO: { rotulo: 'Prazo terminado', tom: 'neutro', simbolo: '○' },
  AGUARDANDO_INICIO: { rotulo: 'Acesso ainda não começou', tom: 'neutro', simbolo: '○' },
}
