import {
  ErroServico, type FiltroPaginacao, type Pagina, type Perfil, type RegistroAuditoria,
  type SessaoUsuario, type UsuarioQualquer,
} from '../tipos'
import { criarDadosDemonstracao, type BancoDemonstracao } from './dados'

/**
 * Infraestrutura da implementacao simulada. Faz o papel do servidor: guarda o
 * estado, a sessao autenticada e a trilha de auditoria, e aplica o controle de
 * acesso. Nada daqui e importado fora de servicos/.
 */

// ---------------------------------------------------------------- Rede simulada

const LATENCIA_MIN_MS = 200
const LATENCIA_MAX_MS = 600

function taxaDeFalha(): number {
  const valor = Number(import.meta.env.VITE_MOCK_FALHA ?? 0)
  return Number.isFinite(valor) ? Math.min(1, Math.max(0, valor)) : 0
}

const esperar = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms))

/**
 * Toda chamada do mock passa por aqui:
 * 1. espera 200 a 600 ms, para que as telas nascam com estado de carregamento;
 * 2. falha com a probabilidade de VITE_MOCK_FALHA, antes de alterar qualquer
 *    dado, para que os estados de erro sejam exercitados;
 * 3. executa a operacao so depois da espera — uma revogacao feita durante a
 *    espera ja vale para esta leitura;
 * 4. devolve uma copia, como faria a rede: a tela nunca segura referencia ao
 *    estado do "servidor".
 */
/**
 * A operacao pode ser assincrona: o relatorio calcula um SHA-256 de verdade,
 * e crypto.subtle so responde por Promise.
 */
export async function responder<T>(operacao: () => T | Promise<T>): Promise<T> {
  await esperar(LATENCIA_MIN_MS + Math.random() * (LATENCIA_MAX_MS - LATENCIA_MIN_MS))
  if (Math.random() < taxaDeFalha()) {
    throw new ErroServico('INDISPONIVEL', 'Falha simulada de comunicação (VITE_MOCK_FALHA).')
  }
  return structuredClone(await operacao())
}

export function paginar<T>(itens: T[], filtro: FiltroPaginacao = {}): Pagina<T> {
  const porPagina = Math.min(100, Math.max(1, Math.floor(filtro.porPagina ?? 10)))
  const pagina = Math.max(1, Math.floor(filtro.pagina ?? 1))
  const inicio = (pagina - 1) * porPagina
  return { itens: itens.slice(inicio, inicio + porPagina), total: itens.length, pagina, porPagina }
}

// ---------------------------------------------------------------- Estado

export const banco: BancoDemonstracao = criarDadosDemonstracao(new Date())

/** Relogio do "servidor". Isolado para que os testes possam controla-lo. */
export const relogio = { agora: () => new Date() }

let sequencia = 0
export function gerarId(prefixo: string): string {
  sequencia += 1
  return `${prefixo}-${Date.now().toString(36)}${sequencia.toString(36)}`
}

export function todosUsuarios(): UsuarioQualquer[] {
  return [...banco.profissionais, ...banco.responsaveis, ...banco.professores]
}

export function usuarioPorId(id: string): UsuarioQualquer | undefined {
  return todosUsuarios().find((u) => u.id === id)
}

// ---------------------------------------------------------------- Sessao autenticada

/**
 * Simula o cookie de sessao do servidor. Guardado em sessionStorage para
 * sobreviver ao recarregamento da pagina; sem sessionStorage, fica em memoria.
 */
const CHAVE_SESSAO = 'sinctea.mock.sessao'
let sessaoEmMemoria: { usuarioId: string; perfilAtivo: Perfil } | null = null

function lerSessaoGuardada(): { usuarioId: string; perfilAtivo: Perfil } | null {
  try {
    const texto = globalThis.sessionStorage?.getItem(CHAVE_SESSAO)
    if (texto) return JSON.parse(texto)
  } catch { /* armazenamento indisponivel: segue com a memoria */ }
  return sessaoEmMemoria
}

export function gravarSessao(valor: { usuarioId: string; perfilAtivo: Perfil } | null): void {
  sessaoEmMemoria = valor
  try {
    if (valor) globalThis.sessionStorage?.setItem(CHAVE_SESSAO, JSON.stringify(valor))
    else globalThis.sessionStorage?.removeItem(CHAVE_SESSAO)
  } catch { /* idem */ }
}

export interface SessaoServidor {
  usuario: UsuarioQualquer
  perfilAtivo: Perfil
}

export function sessaoServidor(): SessaoServidor | null {
  const guardada = lerSessaoGuardada()
  if (!guardada) return null
  const usuario = usuarioPorId(guardada.usuarioId)
  // Usuario desativado ou perfil retirado encerra a sessao na proxima chamada.
  if (!usuario || !usuario.ativo || !usuario.perfis.includes(guardada.perfilAtivo)) {
    gravarSessao(null)
    return null
  }
  return { usuario, perfilAtivo: guardada.perfilAtivo }
}

/** Projecao publica: sem o discriminador interno nem campos da subclasse. */
export function paraSessaoUsuario(s: SessaoServidor): SessaoUsuario {
  const { id, nome, email, perfis, ativo, ultimoAcessoEm } = s.usuario
  return { usuario: { id, nome, email, perfis, ativo, ultimoAcessoEm }, perfilAtivo: s.perfilAtivo }
}

// ---------------------------------------------------------------- Auditoria

export function origemDoPerfil(perfil: Perfil | null): RegistroAuditoria['origem'] {
  if (perfil === 'RESPONSAVEL') return 'FAMILIA'
  if (perfil === 'PROFESSOR') return 'ESCOLA'
  if (perfil === null) return 'SISTEMA'
  return 'CLINICA'
}

interface EventoAuditoria {
  acao: RegistroAuditoria['acao']
  entidade: string
  idEntidade?: string | null
  pacienteId?: string | null
  detalhe: string
}

/** Registro imutavel: congelado e apenas acrescentado, nunca alterado ou removido. */
export function auditar(sessao: SessaoServidor | null, evento: EventoAuditoria): void {
  const perfil = sessao?.perfilAtivo ?? null
  const registro: RegistroAuditoria = Object.freeze({
    id: gerarId('aud'),
    ocorridoEm: relogio.agora().toISOString(),
    usuarioId: sessao?.usuario.id ?? null,
    usuarioNome: sessao?.usuario.nome ?? null,
    perfil,
    acao: evento.acao,
    entidade: evento.entidade,
    idEntidade: evento.idEntidade ?? null,
    pacienteId: evento.pacienteId ?? null,
    origem: origemDoPerfil(perfil),
    // So o servidor conhece o IP de origem; no mock nao existe requisicao.
    ipOrigem: null,
    detalhe: evento.detalhe,
  })
  banco.auditoria.push(registro)
}

// ---------------------------------------------------------------- Controle de acesso

/** Nega, registra a tentativa negada (regra 6) e interrompe a operacao. */
export function negar(sessao: SessaoServidor | null, evento: Omit<EventoAuditoria, 'acao'>): never {
  auditar(sessao, { ...evento, acao: 'ACESSO_NEGADO' })
  throw new ErroServico('ACESSO_NEGADO', 'Você não tem permissão para acessar esta informação.')
}

export function exigirSessao(): SessaoServidor {
  const sessao = sessaoServidor()
  if (!sessao) throw new ErroServico('NAO_AUTENTICADO', 'Sua sessão terminou. Entre novamente.')
  return sessao
}

export function exigirPerfil(perfis: Perfil[], entidade: string, pacienteId: string | null = null): SessaoServidor {
  const sessao = exigirSessao()
  if (!perfis.includes(sessao.perfilAtivo)) {
    negar(sessao, { entidade, pacienteId, detalhe: `Perfil ${sessao.perfilAtivo} sem permissão.` })
  }
  return sessao
}

export function naoEncontrado(oQue: string): never {
  throw new ErroServico('NAO_ENCONTRADO', `${oQue} não encontrado.`)
}

export function exigirValido(erros: Record<string, string>): void {
  if (Object.keys(erros).length > 0) {
    throw new ErroServico('VALIDACAO', Object.values(erros)[0], erros)
  }
}
