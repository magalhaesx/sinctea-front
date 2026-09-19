import { ErroServico, type CodigoErro } from '../tipos'

/**
 * Cliente HTTP da API real (NestJS, prevista para S06).
 *
 * STUB: os caminhos dos endpoints sao provisorios e serao alinhados ao
 * back-end quando ele existir. A autenticacao usa cookie de sessao
 * (credentials: 'include'); o controle de acesso e a auditoria acontecem
 * no servidor, nunca aqui.
 */

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

const CODIGO_POR_STATUS: Record<number, CodigoErro> = {
  400: 'VALIDACAO',
  401: 'NAO_AUTENTICADO',
  403: 'ACESSO_NEGADO',
  404: 'NAO_ENCONTRADO',
  409: 'CONFLITO',
  422: 'VALIDACAO',
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
    const corpoErro = await resposta.json().catch(() => ({})) as { mensagem?: string; campos?: Record<string, string> }
    throw new ErroServico(
      CODIGO_POR_STATUS[resposta.status] ?? 'INDISPONIVEL',
      corpoErro.mensagem ?? 'O servidor não conseguiu concluir a operação.',
      corpoErro.campos ?? {},
    )
  }
  if (resposta.status === 204) return undefined as T
  return resposta.json() as Promise<T>
}
