/**
 * Tipos da camada de dados, espelhando o diagrama de classes do SINCTEA.
 *
 * Sao os mesmos tipos para a implementacao simulada e para a API: trocar uma
 * pela outra nao muda nenhuma assinatura. Datas trafegam como texto ISO 8601.
 *
 * Os tipos de leitura da familia e da escola sao PROJECOES proprias, e nao o
 * Paciente ou o Objetivo inteiros. A restricao da regra 3 do CLAUDE.md e de
 * estrutura de dados: o que nao esta no tipo nao chega a tela.
 */

// ---------------------------------------------------------------- Comuns

export type DataIso = string

/** Toda listagem e paginada, mesmo com cinco registros (docs/01, secao 4). */
export interface Pagina<T> {
  itens: T[]
  total: number
  /** Comeca em 1. */
  pagina: number
  porPagina: number
}

export interface FiltroPaginacao {
  pagina?: number
  porPagina?: number
}

export type CodigoErro =
  | 'NAO_AUTENTICADO'
  | 'ACESSO_NEGADO'
  | 'NAO_ENCONTRADO'
  | 'VALIDACAO'
  | 'CONFLITO'
  | 'INDISPONIVEL'

/** Erro unico da camada de servicos. A interface decide o texto a partir do codigo. */
export class ErroServico extends Error {
  readonly codigo: CodigoErro
  /** Mensagens por campo, quando o codigo e VALIDACAO. */
  readonly campos: Record<string, string>

  constructor(codigo: CodigoErro, mensagem: string, campos: Record<string, string> = {}) {
    super(mensagem)
    this.name = 'ErroServico'
    this.codigo = codigo
    this.campos = campos
  }
}

// ---------------------------------------------------------------- Usuarios

export type Perfil = 'TERAPEUTA' | 'COORDENADOR' | 'ADMINISTRADOR' | 'RESPONSAVEL' | 'PROFESSOR'

/** Superclasse com autenticacao unica: Profissional, Responsavel e ProfessorAEE herdam dela. */
export interface Usuario {
  id: string
  nome: string
  email: string
  perfis: Perfil[]
  ativo: boolean
  ultimoAcessoEm: DataIso | null
}

export interface Profissional extends Usuario {
  tipo: 'PROFISSIONAL'
  especialidade: string
  registroConselho: string
}

export interface Responsavel extends Usuario {
  tipo: 'RESPONSAVEL'
  telefone: string
}

export interface ProfessorAEE extends Usuario {
  tipo: 'PROFESSOR_AEE'
  /** Como atua: regente, AEE, acompanhante. A escola vem pelo VinculoEscolar. */
  atuacao: string
}

export type UsuarioQualquer = Profissional | Responsavel | ProfessorAEE

/** Sessao autenticada: o usuario e o perfil com que ele esta agindo agora. */
export interface SessaoUsuario {
  usuario: Usuario
  perfilAtivo: Perfil
}

export interface FiltroUsuario extends FiltroPaginacao {
  busca?: string
  perfil?: Perfil
  ativo?: boolean
}

// ---------------------------------------------------------------- Paciente

/** Nivel de suporte conforme DSM-5-TR. A descricao por extenso vem de dominio/regras. */
export type NivelSuporte = 1 | 2 | 3

/**
 * Liga Responsavel e Paciente. O parentesco e a responsabilidade legal sao da
 * relacao, nao da pessoa: a mesma mae pode ser responsavel legal por um filho
 * e nao por outro.
 */
export interface VinculoFamiliar {
  id: string
  responsavelId: string
  pacienteId: string
  parentesco: string
  responsavelLegal: boolean
}

export interface Paciente {
  id: string
  nome: string
  dataNascimento: DataIso
  nivelSuporte: NivelSuporte
  profissionalResponsavelId: string
  /** Equipe multiprofissional, incluindo o responsavel pelo caso. */
  equipeIds: string[]
  ativo: boolean
}

export type SituacaoPlano = 'RASCUNHO' | 'AGUARDANDO_VALIDACAO' | 'DEVOLVIDO' | 'VIGENTE' | 'SEM_PLANO'

export interface PacienteResumo {
  id: string
  nome: string
  idade: number
  nivelSuporte: NivelSuporte
  profissionalResponsavel: { id: string; nome: string }
  situacaoPlano: SituacaoPlano
  ultimaSessaoEm: DataIso | null
}

/** Ficha do paciente (tela 5): o paciente com a rede de apoio e a equipe resolvidas. */
export interface PacienteDetalhe extends Paciente {
  idade: number
  redeApoio: Array<VinculoFamiliar & { nome: string; telefone: string }>
  equipe: Array<{ id: string; nome: string; especialidade: string }>
  vinculosEscolares: Array<{
    vinculoId: string
    escola: string
    turma: string
    turno: string
    professor: string
    situacaoConsentimento: SituacaoConsentimento
  }>
  situacaoPlano: SituacaoPlano
  totalSessoes: number
  ultimaSessaoEm: DataIso | null
}

export interface FiltroPaciente extends FiltroPaginacao {
  busca?: string
  profissionalId?: string
  nivelSuporte?: NivelSuporte
  situacaoPlano?: SituacaoPlano
}

export interface NovoPaciente {
  nome: string
  dataNascimento: DataIso
  nivelSuporte: NivelSuporte
  profissionalResponsavelId: string
}

// ---------------------------------------------------------------- Plano e objetivos

export type StatusObjetivo = 'NAO_INICIADO' | 'EM_AQUISICAO' | 'DOMINADO'

/** Composicao: o criterio nao existe sem o objetivo. */
export interface CriterioDominio {
  percentualMinimo: number
  sessoesConsecutivas: number
}

/**
 * Duas redacoes gravadas separadamente (regra 4 do CLAUDE.md). A acessivel e
 * escrita pelo terapeuta — nunca gerada automaticamente.
 */
export interface Objetivo {
  id: string
  planoId: string
  dominio: string
  descricaoTecnica: string
  descricaoAcessivel: string
  status: StatusObjetivo
  percentualAtual: number
  criterio: CriterioDominio
}

export interface NovoObjetivo {
  dominio: string
  descricaoTecnica: string
  descricaoAcessivel: string
  criterio: CriterioDominio
}

export interface PlanoTerapeutico {
  id: string
  pacienteId: string
  autorId: string
  status: Exclude<SituacaoPlano, 'SEM_PLANO'>
  dataInicio: DataIso
  dataRevisao: DataIso
  ultimaRevisaoEm: DataIso | null
  observacaoValidacao: string | null
  /** Composicao: objetivo nao existe sem plano. */
  objetivos: Objetivo[]
}

export interface PlanoParaValidacao {
  planoId: string
  paciente: { id: string; nome: string }
  autor: { id: string; nome: string }
  enviadoEm: DataIso
  totalObjetivos: number
}

// ---------------------------------------------------------------- Sessao

export type Resultado = 'INDEPENDENTE' | 'AJUDA_GESTUAL' | 'AJUDA_FISICA' | 'SEM_RESPOSTA'
export type SituacaoSessao = 'AGENDADA' | 'EM_ANDAMENTO' | 'PAUSADA' | 'ENCERRADA' | 'CANCELADA'

export interface RegistroAtividade {
  id: string
  objetivoId: string
  /** Numero da tentativa dentro da sessao, a partir de 1. */
  ordem: number
  resultado: Resultado
  ocorridoEm: DataIso
}

/** Estado de sincronizacao do registro feito sem conexao. */
export type StatusSync = 'PENDENTE' | 'SINCRONIZADO'

/** Sessao 0..* — 1 Profissional ("conduzida por"). */
export interface Sessao {
  id: string
  pacienteId: string
  profissionalId: string
  numero: number
  inicioPrevistoEm: DataIso
  inicio: DataIso | null
  fim: DataIso | null
  /** Onde a sessao aconteceu: sala, domicilio, escola. */
  local: string
  situacao: SituacaoSessao
  statusSync: StatusSync
  registros: RegistroAtividade[]
}

export interface ItemAgenda {
  sessaoId: string
  inicioPrevistoEm: DataIso
  situacao: SituacaoSessao
  paciente: { id: string; nome: string }
  profissional: { id: string; nome: string }
}

export interface FiltroAgenda extends FiltroPaginacao {
  /** Dia da agenda (AAAA-MM-DD). Padrao: hoje. */
  dia?: string
}

export interface FiltroSessao extends FiltroPaginacao {
  situacao?: SituacaoSessao
}

// ---------------------------------------------------------------- Ocorrencias

export type Origem = 'CLINICA' | 'CASA' | 'ESCOLA'
export type Intensidade = 1 | 2 | 3 | 4 | 5

/** Registro ABC. Quando vem da escola, entra como evento comportamental preliminar. */
export interface OcorrenciaComportamental {
  id: string
  pacienteId: string
  origem: Origem
  ocorridaEm: DataIso
  antecedente: string
  comportamento: string
  consequencia: string
  intensidade: Intensidade
  /** Verdadeiro enquanto a leitura clinica do profissional nao foi feita. */
  preliminar: boolean
  sessaoId: string | null
  ocorrenciaEscolarId: string | null
}

export interface NovaOcorrenciaComportamental {
  antecedente: string
  comportamento: string
  consequencia: string
  intensidade: Intensidade
}

/** O que o professor observou. Sem vocabulario interpretativo. */
export interface OcorrenciaEscolar {
  id: string
  vinculoId: string
  pacienteId: string
  professorId: string
  /** Quando aconteceu na escola. */
  ocorridoEm: DataIso
  /** Quando o registro foi feito: e dele que corre a janela de correcao. */
  registradaEm: DataIso
  corrigidaEm: DataIso | null
  /** O que foi observado, em vocabulario nao interpretativo. */
  tipo: string
  intensidade: Intensidade
  /** Em que momento da rotina: entrada, recreio, troca de atividade. */
  contexto: string
}

/**
 * Opcoes fechadas, de proposito: o professor relata o que observou, sem campo
 * livre que convide a interpretar. A leitura clinica e do profissional.
 */
export interface NovaOcorrenciaEscolar {
  tipo: string
  intensidade: Intensidade
  contexto: string
}

export interface AvisoOcorrenciaEscolar {
  ocorrenciaId: string
  paciente: { id: string; nome: string }
  escola: string
  registradaEm: DataIso
  tipo: string
  intensidade: Intensidade
}

export interface FiltroOcorrencia extends FiltroPaginacao {
  origem?: Origem
  desde?: DataIso
}

// ---------------------------------------------------------------- Casa

export type Desempenho = 'SOZINHO' | 'COM_AJUDA' | 'NAO_QUIS'

/** Toda atividade se vincula a um objetivo do plano; atividade solta nao existe. */
export interface AtividadeCasa {
  id: string
  pacienteId: string
  objetivoId: string
  titulo: string
  descricao: string
  passos: string[]
  /** O que ajuda quando nao sai de primeira. Linguagem da familia. */
  dicas: string
  frequenciaSemanal: number
  urlVideo: string | null
  ativa: boolean
  prescritaEm: DataIso
}

export interface NovaAtividadeCasa {
  pacienteId: string
  objetivoId: string
  titulo: string
  descricao: string
  passos: string[]
  dicas: string
  frequenciaSemanal: number
  urlVideo: string | null
}

export interface ExecucaoAtividadeCasa {
  id: string
  atividadeId: string
  responsavelId: string
  dataRealizacao: DataIso
  desempenho: Desempenho
  observacao: string | null
}

// ---------------------------------------------------------------- Familia (projecoes)

export interface FilhoResumo {
  id: string
  nome: string
  idade: number
}

/** O que a familia ve de um objetivo: so a redacao acessivel. Nenhum termo clinico. */
export interface ObjetivoAcessivel {
  id: string
  descricaoAcessivel: string
  status: StatusObjetivo
  percentualAtual: number
}

// ---------------------------------------------------------------- Escola e consentimento

export type EscopoAcesso = 'CARTAO_ESTRATEGIA' | 'REGISTRO_OCORRENCIA'
export type SituacaoConsentimento = 'VIGENTE' | 'REVOGADO' | 'EXPIRADO' | 'AGUARDANDO_INICIO'

export interface Escola {
  id: string
  nome: string
  /** Rede de ensino: municipal, estadual, federal ou particular. */
  rede: string
  municipio: string
}

/**
 * Quem concede e sempre o Responsavel (regra 1). O estado vigente e derivado
 * das datas, nunca guardado em um campo proprio que possa ficar desatualizado.
 */
export interface Consentimento {
  id: string
  responsavelId: string
  pacienteId: string
  escopos: EscopoAcesso[]
  concedidoEm: DataIso
  validadeAte: DataIso
  revogadoEm: DataIso | null
  /** Impressao digital do termo aceito, para prova de consentimento (LGPD). */
  hashTermo: string
}

/**
 * Convite de uso unico, entregue pela familia ao professor. Nasce do
 * Consentimento e expira em 72 horas. Nao existe autocadastro de professor.
 */
export interface ConviteEscolar {
  id: string
  consentimentoId: string
  token: string
  criadoEm: DataIso
  expiraEm: DataIso
  usadoEm: DataIso | null
}

export type StatusVinculo = 'ATIVO' | 'ENCERRADO'

/**
 * Nasce do convite aceito: sem consentimento nao ha convite, sem convite
 * aceito nao ha vinculo, sem vinculo nao ha ocorrencia. Por isso o professor
 * e obrigatorio aqui.
 */
export interface VinculoEscolar {
  id: string
  consentimentoId: string
  conviteId: string
  pacienteId: string
  escolaId: string
  professorId: string
  turma: string
  turno: string
  /**
   * Situacao do vinculo escolar (ano letivo). NAO e controle de acesso:
   * quem autoriza a leitura e sempre o Consentimento, consultado a cada vez.
   */
  status: StatusVinculo
}

export interface ConsentimentoDetalhe extends Consentimento {
  situacao: SituacaoConsentimento
  /** Só existe depois que o professor aceita o convite. */
  vinculoId: string | null
  escola: string | null
  professor: string | null
  turma: string | null
  conviteAceito: boolean
}

export interface NovoConsentimento {
  pacienteId: string
  escopos: EscopoAcesso[]
  validadeAte: DataIso
}

export interface ConsentimentoConcedido {
  consentimento: ConsentimentoDetalhe
  /** Entregue pela familia ao professor. Uso unico, expira em 72 horas. */
  tokenConvite: string
  conviteExpiraEm: DataIso
}

export type SituacaoConvite = 'VALIDO' | 'USADO' | 'EXPIRADO' | 'CONSENTIMENTO_REVOGADO'

/** O que o professor ve antes de criar a conta. Sem dado clinico. */
export interface ConvitePublico {
  situacao: SituacaoConvite
  responsavel: string | null
  aluno: string | null
  escola: string | null
  escopos: EscopoAcesso[]
  validadeAte: DataIso | null
  expiraEm: DataIso | null
}

/**
 * O professor se identifica e declara onde e como atua: e no aceite que o
 * VinculoEscolar nasce, com escola, turma e turno.
 */
export interface AceiteConvite {
  nome: string
  email: string
  senha: string
  escolaId: string
  turma: string
  turno: string
  /** Como atua com o aluno: regente, AEE, acompanhante. */
  atuacao: string
}

export interface AlunoEscola {
  pacienteId: string
  /** Apenas o primeiro nome: minimizacao de dados. */
  nome: string
  turma: string
  turno: string
  /** Situacao agora. Só VIGENTE abre o cartao (tela 22). */
  situacao: SituacaoConsentimento
  /** Vazio quando o acesso nao esta vigente. */
  escopos: EscopoAcesso[]
  validadeAte: DataIso
}

/**
 * O que a escola le. Deliberadamente sem evolucao, plano, diagnostico, laudo,
 * nivel de suporte ou historico de sessoes (regra 3 do CLAUDE.md).
 */
export interface CartaoEscola {
  pacienteId: string
  nome: string
  turma: string
  turno: string
  validadeAte: DataIso
  estrategias: Array<{
    titulo: string
    /** Redacao acessivel do objetivo, escrita pelo terapeuta. */
    paraQue: string
    oQueFazer: string[]
    oQueEvitar: string[]
    sinalAlerta: string
  }>
  atualizadoEm: DataIso
}

/** Uso interno da clinica: Objetivo 1─* CartaoEstrategia. */
export interface CartaoEstrategia {
  id: string
  objetivoId: string
  /** Titulo em linguagem simples, para a escola e a familia. */
  tituloSimples: string
  oQueFazer: string[]
  oQueEvitar: string[]
  sinalAlerta: string
  atualizadoEm: DataIso
}

// ---------------------------------------------------------------- Auditoria

export type AcaoAuditoria =
  | 'CONCESSAO_ACESSO'
  | 'REVOGACAO_ACESSO'
  | 'LEITURA_AUTORIZADA'
  | 'ACESSO_NEGADO'
  | 'CRIACAO'
  | 'ALTERACAO'

export type OrigemAuditoria = 'CLINICA' | 'FAMILIA' | 'ESCOLA' | 'SISTEMA'

/** Registro imutavel. Nenhum contrato oferece editar ou excluir. */
export interface RegistroAuditoria {
  readonly id: string
  readonly ocorridoEm: DataIso
  readonly usuarioId: string | null
  /**
   * Fotografia do momento, nao referencia: o registro precisa sobreviver a
   * renomeacao do usuario e a mudanca de perfis. Nunca resolva estes dois
   * campos consultando Usuario na leitura.
   */
  readonly usuarioNome: string | null
  readonly perfil: Perfil | null
  readonly acao: AcaoAuditoria
  readonly entidade: string
  readonly idEntidade: string | null
  readonly pacienteId: string | null
  readonly origem: OrigemAuditoria
  /** Origem da requisicao. So o servidor sabe; no mock fica nulo. */
  readonly ipOrigem: string | null
  readonly detalhe: string
}

export interface FiltroAuditoria extends FiltroPaginacao {
  desde?: DataIso
  ate?: DataIso
  usuarioId?: string
  acao?: AcaoAuditoria
  pacienteId?: string
}
