import type { EnvioDoLink } from '../tipos.js'

/**
 * "Esqueci minha senha" e os links por e-mail (item 23), os mesmos no front,
 * no mock e no servidor.
 *
 * A pessoa pede um link de recuperacao pelo e-mail, sem passar pela clinica.
 * A resposta e sempre a mesma — exista a conta ou nao, esteja ativa ou nao,
 * tenha passado do limite ou nao —, e o envio acontece depois dela: nem o
 * texto, nem o status, nem o tempo dizem se o e-mail tem conta.
 */

/** O link de recuperacao vale 1 hora, uma vez so. */
export const VALIDADE_DA_RECUPERACAO_MS = 60 * 60_000

/** Os limites, todos com a mesma resposta: por conta, por origem e o teto diario da clinica. */
export const RECUPERACOES_POR_CONTA_POR_HORA = 3
export const RECUPERACOES_POR_ORIGEM_POR_HORA = 10
/** Abaixo da cota gratis do servico de e-mail (100 por dia). */
export const RECUPERACOES_POR_DIA = 50

export const RESPOSTA_DA_RECUPERACAO =
  'Se houver uma conta com esse e-mail, enviamos um link para definir uma nova senha. Ele vale por 1 hora.'

export const LINK_DE_RECUPERACAO_QUE_NAO_VALE = 'Este link não vale mais. Peça outro em Esqueci minha senha.'

export function calcularExpiracaoRecuperacao(criadoEm: Date): Date {
  return new Date(criadoEm.getTime() + VALIDADE_DA_RECUPERACAO_MS)
}

/** O que a tela diz do envio de um link (telas 5 e 14); nulo com o envio desligado, como antes do item 23. */
export function textoDoEnvio(envio: EnvioDoLink): string | null {
  if (envio.situacao === 'ENVIADO') return `Enviamos o link para ${envio.para}.`
  if (envio.situacao === 'FALHOU') return 'Não conseguimos enviar o e-mail agora. Copie o link e entregue à pessoa.'
  return null
}

export const SE_A_PESSOA_NAO_RECEBER = 'Se a pessoa não receber, copie e entregue.'
