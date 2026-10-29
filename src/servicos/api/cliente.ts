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
 * Uma conta por aba (item 9). O servidor guarda a sessao em cinco vagas, cada
 * uma o seu cookie httpOnly; a aba guarda so o numero da vaga dela, em
 * sessionStorage, e o manda em toda chamada. O numero nao abre nada sozinho: o
 * token continua no cookie, que o JavaScript nao le. Nunca guarde o token aqui,
 * nem em localStorage.
 *
 * sessionStorage e da aba: recarregar mantem a vaga, e a aba duplicada leva a
 * mesma. Bloqueado (janela privada, dados do site negados), a aba fica sem
 * vaga, e a tela de entrada resolve.
 */
const CHAVE_DA_VAGA = 'sinctea_aba'
export const CABECALHO_DA_ABA = 'X-Sinctea-Aba'

export function vagaDaAba(): number | null {
  try {
    const valor = Number(sessionStorage.getItem(CHAVE_DA_VAGA))
    return Number.isInteger(valor) && valor >= 1 && valor <= 5 ? valor : null
  } catch {
    return null
  }
}

export function guardarVaga(vaga: number | null): void {
  try {
    if (vaga === null) sessionStorage.removeItem(CHAVE_DA_VAGA)
    else sessionStorage.setItem(CHAVE_DA_VAGA, String(vaga))
  } catch { /* sem sessionStorage, a aba fica sem vaga */ }
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
  const vaga = vagaDaAba()
  const cabecalhos: Record<string, string> = {
    ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
    ...(vaga === null ? {} : { [CABECALHO_DA_ABA]: String(vaga) }),
  }
  let resposta: Response
  try {
    resposta = await fetch(`${BASE}${caminho}`, {
      method: metodo,
      credentials: 'include',
      // Sem cache HTTP: uma revogacao precisa valer na proxima leitura (regra 5).
      cache: 'no-store',
      headers: Object.keys(cabecalhos).length === 0 ? undefined : cabecalhos,
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
  // A exportacao da trilha (item 17) vem em CSV, e nao em JSON. O BOM fica:
  // e ele que faz o Excel em portugues ler os acentos, e text() o descartaria.
  if (resposta.headers.get('Content-Type')?.startsWith('text/csv')) {
    return new TextDecoder('utf-8', { ignoreBOM: true }).decode(await resposta.arrayBuffer()) as T
  }
  const texto = resposta.status === 204 ? '' : await resposta.text()
  return (texto ? JSON.parse(texto) : undefined) as T
}
