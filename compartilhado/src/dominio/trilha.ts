import type { DataIso, MesCivil, SituacaoPlano, StatusObjetivo, TrilhaAutonomia } from '../tipos.js'
import { diaCivilEm, emDataCivil } from './datas.js'

/**
 * Trilha de autonomia (item 24; objetivo 5.6 do pre-projeto), a mesma no mock
 * e no servidor. E a versao minima do docs/08: nenhuma autoria nova, so duas
 * projecoes do que a equipe ja escreveu no plano vigente.
 *
 * - Habilidades que ja domina (Curriculo de Habilidades Funcionais): os
 *   objetivos DOMINADO, com a data do dominio, na redacao acessivel, do mais
 *   recente para o mais antigo. Sem o dominio do objetivo, sem a redacao
 *   tecnica e sem o percentual.
 * - Como apoiar (Perfil de Suporte): os cartoes de estrategia dos objetivos
 *   do plano vigente, na ordem em que foram escritos.
 *
 * Regra 4, inteira: o texto sai como foi gravado, byte a byte. Aqui nada se
 * apara, se normaliza, se resume nem se completa. Plano que nao e o vigente
 * nao entra, nem com objetivo dominado.
 */

export interface EntradaTrilha {
  paciente: { id: string; nome: string }
  /** O plano vigente do paciente, ou nulo. Plano em outra situacao e ignorado. */
  plano: {
    status: Exclude<SituacaoPlano, 'SEM_PLANO'>
    objetivos: Array<{
      id: string
      descricaoAcessivel: string
      status: StatusObjetivo
      dominadoEm: DataIso | null
      cartoes: Array<{ id: string; tituloSimples: string; oQueFazer: string[]; oQueEvitar: string[]; sinalAlerta: string }>
    }>
  } | null
  agora: Date
}

/** Ordem de criacao: o id do servidor e UUID v7, que cresce com o tempo; o do mock, sequencial. */
const porId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

export function montarTrilha({ paciente, plano, agora }: EntradaTrilha): TrilhaAutonomia {
  const objetivos = plano?.status === 'VIGENTE' ? [...plano.objetivos].sort(porId) : []
  const dominados = objetivos
    .filter((o): o is typeof o & { dominadoEm: DataIso } => o.status === 'DOMINADO' && o.dominadoEm !== null)
    .sort((a, b) => Date.parse(b.dominadoEm) - Date.parse(a.dominadoEm) || porId(b, a))
  return {
    pacienteId: paciente.id,
    nome: paciente.nome,
    // Projecao explicita, campo a campo: nada alem do que o tipo declara.
    habilidades: dominados.map((o) => ({ descricaoAcessivel: o.descricaoAcessivel, desde: mesCivilEm(o.dominadoEm) })),
    estrategias: objetivos.flatMap((o) => [...o.cartoes].sort(porId).map((c) => ({
      tituloSimples: c.tituloSimples, oQueFazer: [...c.oQueFazer], oQueEvitar: [...c.oQueEvitar], sinalAlerta: c.sinalAlerta,
    }))),
    geradaEm: agora.toISOString(),
  }
}

/**
 * O detalhe da linha LEITURA_AUTORIZADA, no mock e no servidor: quanto a
 * trilha mostrou, e nunca o texto (regra 6, com minimizacao).
 */
export function detalheDaTrilha(t: TrilhaAutonomia): string {
  const n = (quantos: number, um: string, varios: string) => `${quantos} ${quantos === 1 ? um : varios}`
  return `Trilha de autonomia: ${n(t.habilidades.length, 'habilidade dominada', 'habilidades dominadas')} e ` +
    `${n(t.estrategias.length, 'estratégia', 'estratégias')}.`
}

/** O mes civil, em Manaus, em que cai um instante. */
export function mesCivilEm(instante: DataIso): MesCivil {
  return diaCivilEm(new Date(instante)).slice(0, 7)
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
] as const

/** "novembro de 2026", so com operacoes de texto: fuso nenhum entra. */
export function mesPorExtenso(mes: MesCivil): string {
  const m = /^(\d{4})-(\d{2})$/.exec(mes)
  const nome = m ? MESES[Number(m[2]) - 1] : undefined
  if (!m || !nome) throw new Error(`Mes civil invalido: "${mes}". O formato e AAAA-MM.`)
  return `${nome} de ${m[1]}`
}

// ---------------------------------------------------------------- Textos da tela 26

export const TITULO_DA_TRILHA = 'Trilha de autonomia'
export const SUBTITULO_DA_TRILHA = 'Escrito pela equipe clínica. Vale para a escola, o trabalho e outros espaços do dia a dia.'
export const tituloDasHabilidades = (nome: string) => `Habilidades que ${nome} já domina`
export const tituloDoApoio = (nome: string) => `Como apoiar ${nome}`
export const desdeOMes = (mes: MesCivil) => `desde ${mesPorExtenso(mes)}`
export const SEM_HABILIDADES =
  'Ainda não há habilidades dominadas registradas. Elas aparecem aqui quando a equipe confirma o domínio de um objetivo.'
export const semEstrategias = (nome: string) => `A equipe ainda não escreveu estratégias para ${nome}.`
/** O dia, em Manaus, em que a leitura foi montada. */
export const emitidaEm = (geradaEm: DataIso) => `Emitida em ${emDataCivil(diaCivilEm(new Date(geradaEm)))}`
