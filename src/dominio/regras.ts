import type {
  Consentimento, CriterioDominio, DataIso, EscopoAcesso, NivelSuporte, NovoConsentimento,
  NovoObjetivo, Origem, PlanoTerapeutico, RegistroAtividade, Sessao, SituacaoConsentimento,
  SituacaoConvite, VinculoEscolar,
} from '../servicos/tipos'

/**
 * Regras de negocio puras: sem React, sem rede, sem relogio implicito.
 * Toda funcao que depende do tempo recebe `agora` como parametro, para que o
 * teste controle o relogio e o servidor possa reaproveitar a mesma regra.
 *
 * E aqui que vivem as regras inviolaveis do CLAUDE.md — separadas da interface.
 */

// ---------------------------------------------------------------- Constantes

/** Convite do professor: uso unico, expira em 72 horas (regra 1). */
export const VALIDADE_CONVITE_HORAS = 72
/** Janela para o professor corrigir a ocorrencia registrada (tela 19). */
export const JANELA_CORRECAO_OCORRENCIA_MINUTOS = 30
/** Suficiencia para comparar contextos na evolucao (tela 8). */
export const SUFICIENCIA_MINIMA = { registros: 5, semanas: 3 } as const
/** Limiares do bloco "o que precisa de atencao" (tela 11). */
export const LIMIARES_ATENCAO = {
  diasSemRevisaoPlano: 90,
  diasSemSessao: 15,
  diasConsentimentoVencendo: 30,
} as const

const MS_MINUTO = 60_000
const MS_HORA = 60 * MS_MINUTO
const MS_DIA = 24 * MS_HORA

const ms = (d: DataIso | Date) => (d instanceof Date ? d.getTime() : Date.parse(d))

// ---------------------------------------------------------------- Paciente

export function idadeEmAnos(dataNascimento: DataIso, agora: Date): number {
  const nasc = new Date(dataNascimento)
  let idade = agora.getUTCFullYear() - nasc.getUTCFullYear()
  const aindaNaoFezAniversario =
    agora.getUTCMonth() < nasc.getUTCMonth() ||
    (agora.getUTCMonth() === nasc.getUTCMonth() && agora.getUTCDate() < nasc.getUTCDate())
  if (aindaNaoFezAniversario) idade -= 1
  return Math.max(0, idade)
}

/**
 * Nivel de suporte conforme DSM-5-TR, sempre por extenso ao lado do numero:
 * ninguem deve precisar decorar o que significa "2" (tela 5).
 */
export function descricaoNivelSuporte(nivel: NivelSuporte): string {
  const descricoes: Record<NivelSuporte, string> = {
    1: 'Nível 1 — exige apoio',
    2: 'Nível 2 — exige apoio substancial',
    3: 'Nível 3 — exige apoio muito substancial',
  }
  return descricoes[nivel]
}

// ---------------------------------------------------------------- Objetivo e criterio

/** Percentual de respostas independentes de um objetivo em uma sessao. Null se nao houve tentativa. */
export function percentualIndependente(registros: RegistroAtividade[], objetivoId: string): number | null {
  const doObjetivo = registros.filter((r) => r.objetivoId === objetivoId)
  if (doObjetivo.length === 0) return null
  const independentes = doObjetivo.filter((r) => r.resultado === 'INDEPENDENTE').length
  return Math.round((independentes / doObjetivo.length) * 100)
}

/**
 * O objetivo atinge o criterio quando as N sessoes mais recentes em que foi
 * trabalhado ficaram todas no percentual minimo ou acima.
 *
 * Consideram-se apenas sessoes encerradas e com ao menos uma tentativa do
 * objetivo: sessao em que o objetivo nao foi trabalhado nao quebra nem
 * completa a sequencia.
 */
export function objetivoAtingiuCriterio(
  sessoes: Sessao[],
  objetivoId: string,
  criterio: CriterioDominio,
): boolean {
  if (criterio.sessoesConsecutivas < 1) return false
  const percentuais = sessoes
    .filter((s) => s.situacao === 'ENCERRADA')
    .sort((a, b) => a.numero - b.numero)
    .map((s) => percentualIndependente(s.registros, objetivoId))
    .filter((p): p is number => p !== null)

  if (percentuais.length < criterio.sessoesConsecutivas) return false
  return percentuais
    .slice(-criterio.sessoesConsecutivas)
    .every((p) => p >= criterio.percentualMinimo)
}

/**
 * Validacao do formulario de objetivo (tela 6). A descricao acessivel e
 * obrigatoria e escrita pelo terapeuta — a mensagem explica por que o campo
 * existe, em vez de dizer apenas "campo obrigatorio".
 */
export function validarNovoObjetivo(dados: NovoObjetivo): Record<string, string> {
  const erros: Record<string, string> = {}
  if (!dados.dominio.trim()) erros.dominio = 'Informe o domínio do objetivo.'
  if (!dados.descricaoTecnica.trim()) erros.descricaoTecnica = 'Informe a descrição técnica, usada pela equipe.'
  if (!dados.descricaoAcessivel.trim()) {
    erros.descricaoAcessivel =
      'Escreva a descrição acessível. É ela que a família e a escola leem: sem ela, ' +
      'o objetivo não chega a quem convive com a criança fora da clínica.'
  }
  const { percentualMinimo, sessoesConsecutivas } = dados.criterio
  if (!Number.isFinite(percentualMinimo) || percentualMinimo < 1 || percentualMinimo > 100) {
    erros.percentualMinimo = 'O percentual mínimo precisa estar entre 1 e 100.'
  }
  if (!Number.isInteger(sessoesConsecutivas) || sessoesConsecutivas < 1) {
    erros.sessoesConsecutivas = 'Informe ao menos uma sessão consecutiva.'
  }
  return erros
}

/**
 * Percentual em linguagem cotidiana para a familia (tela 15):
 * "6 ou 7 de cada 10 vezes" comunica; "65%" nao.
 */
export function frequenciaEmLinguagemCotidiana(percentual: number): string {
  const p = Math.min(100, Math.max(0, percentual))
  if (p === 0) return 'nenhuma vez a cada 10 tentativas, por enquanto'
  if (p === 100) return 'todas as vezes'
  const emDez = p / 10
  const baixo = Math.floor(emDez)
  const alto = Math.ceil(emDez)
  if (baixo === alto) return `${baixo} de cada 10 vezes`
  if (baixo === 0) return 'menos de 1 de cada 10 vezes'
  return `${baixo} ou ${alto} de cada 10 vezes`
}

// ---------------------------------------------------------------- Consentimento (regras 1, 2, 5)

export function situacaoConsentimento(c: Consentimento, agora: Date): SituacaoConsentimento {
  // Revogacao vem primeiro e nao tem carencia (regra 5).
  if (c.revogadoEm !== null && ms(c.revogadoEm) <= agora.getTime()) return 'REVOGADO'
  if (agora.getTime() < ms(c.concedidoEm)) return 'AGUARDANDO_INICIO'
  if (agora.getTime() >= ms(c.validadeAte)) return 'EXPIRADO'
  return 'VIGENTE'
}

export function consentimentoVigente(c: Consentimento, agora: Date): boolean {
  return situacaoConsentimento(c, agora) === 'VIGENTE'
}

export function escopoPermiteLeitura(c: Consentimento, escopo: EscopoAcesso): boolean {
  return c.escopos.includes(escopo)
}

export type MotivoNegacao = 'SEM_CONSENTIMENTO' | 'REVOGADO' | 'EXPIRADO' | 'AGUARDANDO_INICIO' | 'FORA_DO_ESCOPO'

export type ResultadoVerificacao =
  | { permitido: true }
  | { permitido: false; motivo: MotivoNegacao }

/**
 * UC21 / passo 15 do diagrama de sequencia: verificacao executada a cada
 * leitura da escola, antes de qualquer retorno de dado. Sem cache.
 */
export function verificarAcessoEscola(
  c: Consentimento | null | undefined,
  escopo: EscopoAcesso,
  agora: Date,
): ResultadoVerificacao {
  if (!c) return { permitido: false, motivo: 'SEM_CONSENTIMENTO' }
  const situacao = situacaoConsentimento(c, agora)
  if (situacao !== 'VIGENTE') return { permitido: false, motivo: situacao }
  if (!escopoPermiteLeitura(c, escopo)) return { permitido: false, motivo: 'FORA_DO_ESCOPO' }
  return { permitido: true }
}

export function validarNovoConsentimento(dados: NovoConsentimento, agora: Date): Record<string, string> {
  const erros: Record<string, string> = {}
  if (dados.escopos.length === 0) erros.escopos = 'Escolha ao menos o que a escola poderá ver ou registrar.'
  const validade = ms(dados.validadeAte)
  if (Number.isNaN(validade)) erros.validadeAte = 'Informe até quando o acesso vale.'
  else if (validade <= agora.getTime()) erros.validadeAte = 'A validade precisa ser uma data futura.'
  if (!dados.escolaId) erros.escolaId = 'Escolha a escola.'
  return erros
}

export function consentimentoVencendo(c: Consentimento, agora: Date): boolean {
  if (!consentimentoVigente(c, agora)) return false
  const limite = agora.getTime() + LIMIARES_ATENCAO.diasConsentimentoVencendo * MS_DIA
  return ms(c.validadeAte) <= limite
}

// ---------------------------------------------------------------- Convite (regra 1)

export function calcularExpiracaoConvite(criadoEm: Date): Date {
  return new Date(criadoEm.getTime() + VALIDADE_CONVITE_HORAS * MS_HORA)
}

/** Os quatro estados do token (tela 2). */
export function situacaoConvite(
  vinculo: Pick<VinculoEscolar, 'conviteExpiraEm' | 'conviteUsadoEm'>,
  consentimento: Consentimento,
  agora: Date,
): SituacaoConvite {
  if (vinculo.conviteUsadoEm !== null) return 'USADO'
  const situacao = situacaoConsentimento(consentimento, agora)
  if (situacao === 'REVOGADO') return 'CONSENTIMENTO_REVOGADO'
  if (situacao === 'EXPIRADO' || agora.getTime() >= ms(vinculo.conviteExpiraEm)) return 'EXPIRADO'
  return 'VALIDO'
}

// ---------------------------------------------------------------- Ocorrencia escolar

export function podeCorrigirOcorrencia(registradaEm: DataIso, agora: Date): boolean {
  const decorrido = agora.getTime() - ms(registradaEm)
  return decorrido >= 0 && decorrido <= JANELA_CORRECAO_OCORRENCIA_MINUTOS * MS_MINUTO
}

// ---------------------------------------------------------------- Comparacao entre contextos (tela 8)

/** Chave da semana (segunda-feira, UTC) em que a data cai. */
function chaveSemana(data: DataIso): string {
  const d = new Date(ms(data))
  const diasDesdeSegunda = (d.getUTCDay() + 6) % 7
  const segunda = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diasDesdeSegunda))
  return segunda.toISOString().slice(0, 10)
}

export interface FaltaSuficiencia {
  contexto: Origem
  registrosFaltando: number
  semanasFaltando: number
}

/**
 * A comparacao so e exibida com no minimo cinco registros distribuidos em tres
 * semanas distintas em CADA contexto. Abaixo disso a tela diz o que falta.
 *
 * Esta regra so decide se ha dados suficientes. Ela nao compara as medidas:
 * clinica, casa e escola tem escalas de natureza diferente e nunca sao
 * colocadas na mesma escala nem somadas em media.
 */
export function suficienciaComparacao(datasPorContexto: Record<Origem, DataIso[]>): {
  suficiente: boolean
  faltas: FaltaSuficiencia[]
} {
  const contextos: Origem[] = ['CLINICA', 'CASA', 'ESCOLA']
  const faltas = contextos
    .map((contexto) => {
      const datas = datasPorContexto[contexto] ?? []
      const semanas = new Set(datas.map(chaveSemana)).size
      return {
        contexto,
        registrosFaltando: Math.max(0, SUFICIENCIA_MINIMA.registros - datas.length),
        semanasFaltando: Math.max(0, SUFICIENCIA_MINIMA.semanas - semanas),
      }
    })
    .filter((f) => f.registrosFaltando > 0 || f.semanasFaltando > 0)
  return { suficiente: faltas.length === 0, faltas }
}

// ---------------------------------------------------------------- Plano e coordenacao

export function validarDevolucaoPlano(observacao: string): string | null {
  return observacao.trim().length === 0
    ? 'Escreva o que precisa mudar. Devolução sem justificativa não ensina nada a quem recebeu.'
    : null
}

export function planoPrecisaRevisao(
  plano: Pick<PlanoTerapeutico, 'inicioEm' | 'ultimaRevisaoEm'>,
  agora: Date,
): boolean {
  const referencia = ms(plano.ultimaRevisaoEm ?? plano.inicioEm)
  return agora.getTime() - referencia > LIMIARES_ATENCAO.diasSemRevisaoPlano * MS_DIA
}

/** Paciente ativo sem nenhuma sessao tambem precisa de atencao. */
export function pacienteSemSessaoRecente(ultimaSessaoEm: DataIso | null, agora: Date): boolean {
  if (ultimaSessaoEm === null) return true
  return agora.getTime() - ms(ultimaSessaoEm) > LIMIARES_ATENCAO.diasSemSessao * MS_DIA
}

// ---------------------------------------------------------------- Usuarios

/** Desativar, nunca excluir. Um administrador nao desativa a si mesmo (tela 14). */
export function podeDesativarUsuario(atorId: string, alvoId: string): boolean {
  return atorId !== alvoId
}
