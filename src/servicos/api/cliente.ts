import { ErroServico, type CodigoErro, type MotivoNegativa } from '@sinctea/compartilhado'

/**
 * Cliente HTTP da API real (servidor/, NestJS). A autenticacao usa cookie de
 * sessao (credentials: 'include'); o controle de acesso e a auditoria
 * acontecem no servidor, nunca aqui.
 *
 * Front e API moram no mesmo endereco (docs/07, D3): sem VITE_API_URL, como
 * na versao publicada, a API e o /api do proprio endereco.
 */

const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

const CODIGO_POR_STATUS: Record<number, CodigoErro> = {
  400: 'VALIDACAO',
  401: 'NAO_AUTENTICADO',
  403: 'ACESSO_NEGADO',
  404: 'NAO_ENCONTRADO',
  409: 'CONFLITO',
  422: 'VALIDACAO',
  429: 'LIMITE_TENTATIVAS',
}

type Parametros = Record<string, string | number | boolean | undefined | null>

export function comParametros(caminho: string, parametros: object = {}): string {
  const busca = new URLSearchParams()
  for (const [chave, valor] of Object.entries(parametros as Parametros)) {
    if (valor !== undefined && valor !== null && valor !== '') busca.set(chave, String(valor))
  }
  const texto = busca.toString()
  return texto ? `${caminho}?${texto}` : caminho
}

/**
 * Quem quer saber de toda negativa (401 ou 403) fora da autenticacao: o
 * contexto da sessao, que rele a sessao atual para descobrir se outra janela
 * trocou a conta (item 7). Um so ouvinte; nulo, ninguem.
 */
let ouvinteDeNegativa: (() => void) | null = null
export function aoNegarAcesso(ouvinte: (() => void) | null): void {
  ouvinteDeNegativa = ouvinte
}

export async function requisitar<T>(metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', caminho: string, corpo?: unknown): Promise<T> {
  let resposta: Response
  try {
    resposta = await fetch(`${BASE}${caminho}`, {
      method: metodo,
      credentials: 'include',
      // Sem cache HTTP: uma revogacao precisa valer na proxima leitura (regra 5).
      cache: 'no-store',
      headers: corpo === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    })
  } catch {
    throw new ErroServico('INDISPONIVEL', 'Não foi possível falar com o servidor.')
  }

  if (!resposta.ok) {
    // A negativa de entrar, sair ou trocar de perfil a propria tela explica.
    if ((resposta.status === 401 || resposta.status === 403) && !caminho.startsWith('/auth/')) ouvinteDeNegativa?.()
    const corpoErro = await resposta.json().catch(() => ({})) as {
      mensagem?: string; campos?: Record<string, string>; motivo?: MotivoNegativa
    }
    throw new ErroServico(
      CODIGO_POR_STATUS[resposta.status] ?? 'INDISPONIVEL',
      corpoErro.mensagem ?? 'O servidor não conseguiu concluir a operação.',
      corpoErro.campos ?? {},
      // O mesmo campo que o mock preenche: a tela 18 nao sabe de onde veio.
      corpoErro.motivo,
    )
  }
  // 204, ou corpo vazio: a operacao nao devolve nada (sessao anonima, conta
  // sem dados profissionais). Quem chama decide se isso e nulo.
  const texto = resposta.status === 204 ? '' : await resposta.text()
  return (texto ? JSON.parse(texto) : undefined) as T
}
