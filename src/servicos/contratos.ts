import type {
  AceiteConvite, AlunoEscola, AtividadeCasa, AvisoOcorrenciaEscolar, CartaoEscola,
  CartaoEstrategia,
  ConsentimentoConcedido, ConsentimentoDetalhe, ConvitePublico, Desempenho, Escola,
  ExecucaoAtividadeCasa, FiltroAgenda, FiltroAuditoria, FiltroOcorrencia, FiltroPaciente,
  FiltroPaginacao, FiltroSessao, FiltroUsuario, FilhoResumo, ItemAgenda, NovaAtividadeCasa,
  NovaOcorrenciaComportamental, NovaOcorrenciaEscolar, NovoConsentimento, NovoObjetivo,
  NovoPaciente, Objetivo, ObjetivoAcessivel, OcorrenciaComportamental, OcorrenciaEscolar,
  Pagina, PacienteDetalhe, PacienteResumo, Perfil, PlanoParaValidacao, PlanoTerapeutico,
  Profissional, RegistroAtividade, RegistroAuditoria, Resultado, Sessao, SessaoUsuario,
  Usuario,
} from './tipos'

/**
 * Contratos da camada de dados. Os componentes conhecem apenas estas
 * interfaces; a implementacao (simulada ou API) e escolhida em servicos/index.ts.
 *
 * Toda operacao retorna Promise e pode falhar com ErroServico.
 * Toda listagem retorna Pagina<T>.
 * O controle de acesso e responsabilidade de quem implementa (o servidor),
 * nunca da tela que chama.
 */

export interface ServicoAutenticacao {
  /** Credencial invalida sempre produz a mesma mensagem, exista o e-mail ou nao. */
  entrar(email: string, senha: string): Promise<SessaoUsuario>
  /** Os quatro perfis de demonstracao da tela de entrada. */
  entrarDemonstracao(perfil: Exclude<Perfil, 'ADMINISTRADOR'>): Promise<SessaoUsuario>
  trocarPerfil(perfil: Perfil): Promise<SessaoUsuario>
  sessaoAtual(): Promise<SessaoUsuario | null>
  sair(): Promise<void>
}

export interface ServicoPaciente {
  /** Terapeuta ve apenas os pacientes que acompanha; coordenador ve todos. */
  listar(filtro?: FiltroPaciente): Promise<Pagina<PacienteResumo>>
  obter(id: string): Promise<PacienteDetalhe>
  criar(dados: NovoPaciente): Promise<PacienteDetalhe>
}

export interface ServicoProfissional {
  listar(filtro?: FiltroPaginacao & { busca?: string }): Promise<Pagina<Profissional>>
}

export interface ServicoEscola {
  listar(filtro?: FiltroPaginacao): Promise<Pagina<Escola>>
}

export interface ServicoPlano {
  obterPorPaciente(pacienteId: string): Promise<PlanoTerapeutico>
  /** Rejeita objetivo sem descricao acessivel. Nao existe geracao automatica. */
  adicionarObjetivo(planoId: string, dados: NovoObjetivo): Promise<Objetivo>
  enviarParaValidacao(planoId: string): Promise<PlanoTerapeutico>
  listarAguardandoValidacao(filtro?: FiltroPaginacao): Promise<Pagina<PlanoParaValidacao>>
  aprovar(planoId: string): Promise<PlanoTerapeutico>
  /** Devolver exige observacao escrita. */
  devolver(planoId: string, observacao: string): Promise<PlanoTerapeutico>
  /**
   * Cria um cartao de estrategias em branco, ligado ao objetivo. Nao deriva
   * nenhum texto do objetivo: quem escreve o conteudo e o terapeuta (regra 4).
   */
  iniciarCartao(objetivoId: string): Promise<CartaoEstrategia>
}

export interface ServicoSessao {
  listarAgenda(filtro?: FiltroAgenda): Promise<Pagina<ItemAgenda>>
  listarPorPaciente(pacienteId: string, filtro?: FiltroSessao): Promise<Pagina<Sessao>>
  obter(id: string): Promise<Sessao>
  /** Inicia uma sessao agendada ou cria uma nova, conduzida pelo usuario atual. */
  iniciar(pacienteId: string, sessaoAgendadaId?: string): Promise<Sessao>
  registrarAtividade(sessaoId: string, objetivoId: string, resultado: Resultado): Promise<RegistroAtividade>
  desfazerUltimoRegistro(sessaoId: string): Promise<Sessao>
  pausar(sessaoId: string): Promise<Sessao>
  encerrar(sessaoId: string): Promise<Sessao>
}

export interface ServicoOcorrencia {
  listarPorPaciente(pacienteId: string, filtro?: FiltroOcorrencia): Promise<Pagina<OcorrenciaComportamental>>
  registrarNaSessao(sessaoId: string, dados: NovaOcorrenciaComportamental): Promise<OcorrenciaComportamental>
  /** Avisos do painel do terapeuta: ocorrencias recentes vindas da escola. */
  listarAvisosDaEscola(filtro?: FiltroOcorrencia): Promise<Pagina<AvisoOcorrenciaEscolar>>
}

export interface ServicoAtividadeCasa {
  listarPorPaciente(pacienteId: string, filtro?: FiltroPaginacao & { ativa?: boolean }): Promise<Pagina<AtividadeCasa>>
  obter(id: string): Promise<AtividadeCasa>
  prescrever(dados: NovaAtividadeCasa): Promise<AtividadeCasa>
  registrarExecucao(atividadeId: string, desempenho: Desempenho, observacao?: string): Promise<ExecucaoAtividadeCasa>
  listarExecucoes(atividadeId: string, filtro?: FiltroPaginacao): Promise<Pagina<ExecucaoAtividadeCasa>>
}

/** Leituras da area da familia. So projecoes sem conteudo clinico. */
export interface ServicoFamilia {
  listarFilhos(filtro?: FiltroPaginacao): Promise<Pagina<FilhoResumo>>
  listarObjetivos(pacienteId: string, filtro?: FiltroPaginacao): Promise<Pagina<ObjetivoAcessivel>>
}

export interface ServicoConsentimento {
  listarPorPaciente(pacienteId: string, filtro?: FiltroPaginacao): Promise<Pagina<ConsentimentoDetalhe>>
  /** Somente o Responsavel concede. Gera o convite de uso unico para o professor. */
  conceder(dados: NovoConsentimento): Promise<ConsentimentoConcedido>
  /**
   * Novo token para um consentimento vigente. Invalida imediatamente qualquer
   * convite anterior ainda nao usado: nunca existe mais de um token valido por
   * consentimento ao mesmo tempo.
   */
  reemitirConvite(consentimentoId: string): Promise<ConsentimentoConcedido>
  /** Efeito imediato: a proxima leitura da escola ja e negada. */
  revogar(consentimentoId: string): Promise<ConsentimentoDetalhe>
}

export interface ServicoConvite {
  /** Publico: o professor ainda nao tem conta. */
  obter(token: string): Promise<ConvitePublico>
  aceitar(token: string, dados: AceiteConvite): Promise<SessaoUsuario>
}

/**
 * Area da escola. Toda leitura verifica consentimento vigente e escopo antes
 * de retornar qualquer dado (UC21), e registra na auditoria o acesso
 * autorizado ou a tentativa negada.
 */
export interface ServicoAreaEscola {
  listarAlunos(filtro?: FiltroPaginacao): Promise<Pagina<AlunoEscola>>
  obterCartao(pacienteId: string): Promise<CartaoEscola>
  registrarOcorrencia(pacienteId: string, dados: NovaOcorrenciaEscolar): Promise<OcorrenciaEscolar>
  /** Permitido ate 30 minutos apos o registro. A versao original fica na auditoria. */
  corrigirOcorrencia(ocorrenciaId: string, dados: NovaOcorrenciaEscolar): Promise<OcorrenciaEscolar>
}

/** Somente leitura. O registro de auditoria e escrito pelo servidor e e imutavel. */
export interface ServicoAuditoria {
  listar(filtro?: FiltroAuditoria): Promise<Pagina<RegistroAuditoria>>
}

/** Desativar, nunca excluir: o historico clinico precisa manter a autoria. */
export interface ServicoUsuario {
  listar(filtro?: FiltroUsuario): Promise<Pagina<Usuario>>
  alterarPerfis(usuarioId: string, perfis: Perfil[]): Promise<Usuario>
  desativar(usuarioId: string): Promise<Usuario>
  reativar(usuarioId: string): Promise<Usuario>
}

export interface Servicos {
  autenticacao: ServicoAutenticacao
  pacientes: ServicoPaciente
  profissionais: ServicoProfissional
  escolas: ServicoEscola
  planos: ServicoPlano
  sessoes: ServicoSessao
  ocorrencias: ServicoOcorrencia
  atividades: ServicoAtividadeCasa
  familia: ServicoFamilia
  consentimentos: ServicoConsentimento
  convites: ServicoConvite
  areaEscola: ServicoAreaEscola
  auditoria: ServicoAuditoria
  usuarios: ServicoUsuario
}
