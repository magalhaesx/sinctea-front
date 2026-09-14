/**
 * Tipos do dominio, espelhando o diagrama de classes do SINCTEA.
 * Ver docs/uml/SINCTEA_Diagrama_Classes.png no repositorio do TCC.
 */

export type NivelSuporte = 1 | 2 | 3
export type StatusObjetivo = 'NAO_INICIADO' | 'EM_AQUISICAO' | 'DOMINADO'
export type Resultado = 'INDEPENDENTE' | 'AJUDA_GESTUAL' | 'AJUDA_FISICA' | 'SEM_RESPOSTA'
export type Desempenho = 'SOZINHO' | 'COM_AJUDA' | 'NAO_QUIS'
export type EscopoAcesso = 'CARTAO_ESTRATEGIA' | 'REGISTRO_OCORRENCIA'
export type Origem = 'CLINICA' | 'CASA' | 'ESCOLA'

export interface Paciente {
  id: string
  nome: string
  dataNascimento: string
  nivelSuporte: NivelSuporte
}

export interface CriterioDominio {
  percentualMinimo: number
  sessoesConsecutivas: number
}

/** Regra de negocio: toda redacao acessivel e escrita pelo terapeuta,
 *  nunca gerada automaticamente a partir da tecnica. */
export interface Objetivo {
  id: string
  dominio: string
  descricaoTecnica: string
  descricaoAcessivel: string
  status: StatusObjetivo
  percentualAtual: number
  criterio: CriterioDominio
}

export interface Sessao {
  id: string
  numero: number
  data: string
  percentualIndependente: number
}

export interface CartaoEstrategia {
  oQueFazer: string[]
  oQueEvitar: string[]
  sinalAlerta: string
}

export interface AtividadeCasa {
  id: string
  titulo: string
  frequenciaSemanal: number
  passos: string[]
  urlVideo: string | null
  feita: boolean
}

export interface Consentimento {
  escopos: EscopoAcesso[]
  validadeAte: string
  ativo: boolean
  professor: string
  escola: string
  concedidoEm: string
}
