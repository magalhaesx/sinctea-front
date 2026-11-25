import type { EnvioDoLink } from '@sinctea/compartilhado'

/**
 * O fim do detalhe da trilha para um link que a clinica gerou (item 23): se o
 * e-mail foi, falhou ou estava desligado. A falha do envio fica registrada, e
 * o link, nunca: so que ele ficou na tela para copiar.
 */
export function envioNaTrilha(envio: EnvioDoLink | null | undefined): string {
  if (!envio) return ''
  if (envio.situacao === 'ENVIADO') return ' Enviado por e-mail.'
  if (envio.situacao === 'FALHOU') return ' O e-mail não foi enviado (falha no serviço de e-mail); o link ficou na tela, para copiar.'
  return ' Sem envio de e-mail (desligado); o link ficou na tela, para copiar.'
}
