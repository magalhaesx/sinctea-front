import type {
  AceiteConvite, AlertaAtencao, AlunoEscola, AtividadeCasa, AvisoOcorrenciaEscolar, CartaoEscola,
  CartaoEstrategia,
  ConsentimentoConcedido, ConsentimentoDetalhe, ContaCriada, ConvitePublico, Desempenho, Escola,
  ExecucaoAtividadeCasa, FiltroAgenda, FiltroAuditoria, FiltroOcorrencia, FiltroPaciente,
  FiltroPaginacao, FiltroSessao, FiltroUsuario, FilhoResumo, ItemAgenda, LinkPrimeiroAcesso, NovaAtividadeCasa,
  NovaOcorrenciaComportamental, NovaOcorrenciaEscolar, NovoConsentimento, NovoObjetivo,
  NovoPaciente, NovoPlano, NovoResponsavel, ResponsavelCadastrado, DadosCartao, NovaEscola, Objetivo, ObjetivoAcessivel, OcorrenciaComportamental, OcorrenciaEscolar,
  ConteudoRelatorio, DadosProfissionais, MotivoAtencao, Pagina, PacienteDetalhe, PacienteResumo, PedidoRelatorio,
  Perfil, PlanoParaValidacao, PlanoTerapeutico, PonteEscola, PrimeiroAcessoPublico, Profissional, RegistroAtividade,
  RegistroAuditoria, RelatorioEvolucao, ResumoClinica, Resultado, Sessao, SessaoUsuario,
  SessoesPorProfissional, Usuario,
} from './tipos.js'

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
  /** Primeiro acesso por link: o que a tela mostra antes de pedir a senha. */
  obterPrimeiroAcesso(token: string): Promise<PrimeiroAcessoPublico>
  /** Define a senha da conta, gasta o link e ja abre a sessao. */
  concluirPrimeiroAcesso(token: string, senha: string): Promise<SessaoUsuario>
}

export interface ServicoPaciente {
  /** Terapeuta ve apenas os pacientes que acompanha; coordenador ve todos. */
  listar(filtro?: FiltroPaciente): Promise<Pagina<PacienteResumo>>
  obter(id: string): Promise<PacienteDetalhe>
  criar(dados: NovoPaciente): Promise<PacienteDetalhe>
  /**
   * Cadastra o responsavel na ficha: cria a conta, ou reaproveita a que ja tem
   * aquele e-mail, e o VinculoFamiliar. Conta nova volta com o link de
   * primeiro acesso (docs/07, secao 0, lacuna 2).
   */
  cadastrarResponsavel(pacienteId: string, dados: NovoResponsavel): Promise<ResponsavelCadastrado>
  /**
   * Link novo para o responsavel que ainda nao definiu senha. Conta que ja
   * entra nao recebe: a clinica nao troca a senha de quem autoriza a escola.
   */
  novoLinkDoResponsavel(pacienteId: string, responsavelId: string): Promise<LinkPrimeiroAcesso>
}

export interface ServicoProfissional {
  listar(filtro?: FiltroPaginacao & { busca?: string }): Promise<Pagina<Profissional>>
}

export interface ServicoEscola {
  listar(filtro?: FiltroPaginacao): Promise<Pagina<Escola>>
  /**
   * As escolas do mesmo municipio com nome parecido: aparecem antes de
   * cadastrar, para a familia escolher a que ja existe em vez de duplicar.
   */
  parecidas(nome: string, municipio: string): Promise<Escola[]>
  /** Lacuna 4: quem cadastra e o proprio responsavel. Auditado. */
  cadastrar(dados: NovaEscola): Promise<Escola>
}

export interface ServicoPlano {
  obterPorPaciente(pacienteId: string): Promise<PlanoTerapeutico>
  /** Paciente sem plano: o plano nasce em RASCUNHO (lacuna 3). */
  criar(pacienteId: string, dados: NovoPlano): Promise<PlanoTerapeutico>
  /** Rejeita objetivo sem descricao acessivel. Nao existe geracao automatica. */
  adicionarObjetivo(planoId: string, dados: NovoObjetivo): Promise<Objetivo>
  enviarParaValidacao(planoId: string): Promise<PlanoTerapeutico>
  listarAguardandoValidacao(filtro?: FiltroPaginacao): Promise<Pagina<PlanoParaValidacao>>
  aprovar(planoId: string): Promise<PlanoTerapeutico>
  /** Devolver exige observacao escrita. */
  devolver(planoId: string, observacao: string): Promise<PlanoTerapeutico>
  /**
   * Promove o objetivo a dominado. So com o criterio atingido; auditado.
   * E o unico caminho para status === 'DOMINADO'.
   */
  confirmarDominio(objetivoId: string): Promise<Objetivo>
  /** Os cartoes de estrategias de um objetivo, o que a escola le. */
  listarCartoes(objetivoId: string): Promise<CartaoEstrategia[]>
  /**
   * Cria o cartao ja com conteudo (lacuna 5): titulo, ao menos um "o que
   * fazer", ao menos um "o que evitar" e o sinal de alerta. Nada e derivado do
   * objetivo: quem escreve e o terapeuta (regra 4). Nao existe cartao em branco.
   */
  criarCartao(objetivoId: string, dados: DadosCartao): Promise<CartaoEstrategia>
  editarCartao(cartaoId: string, dados: DadosCartao): Promise<CartaoEstrategia>
}

export interface ServicoSessao {
  listarAgenda(filtro?: FiltroAgenda): Promise<Pagina<ItemAgenda>>
  listarPorPaciente(pacienteId: string, filtro?: FiltroSessao): Promise<Pagina<Sessao>>
  /**
   * Registros feitos sem conexao que ainda nao subiram, do profissional
   * autenticado. O painel mostra a contagem; nada se perde enquanto isso.
   */
  listarPendentesDeSincronizacao(filtro?: FiltroPaginacao): Promise<Pagina<Sessao>>
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
  /**
   * Avisos do painel do terapeuta: relatos recentes da escola que ainda
   * esperam a leitura clinica. Registrada a leitura, o aviso sai da lista.
   */
  listarAvisosDaEscola(filtro?: FiltroOcorrencia): Promise<Pagina<AvisoOcorrenciaEscolar>>
  /** Registra que o profissional fez a leitura clinica do evento preliminar. */
  registrarLeituraClinica(ocorrenciaId: string): Promise<OcorrenciaComportamental>
}

export interface ServicoAtividadeCasa {
  listarPorPaciente(pacienteId: string, filtro?: FiltroPaginacao & { ativa?: boolean }): Promise<Pagina<AtividadeCasa>>
  obter(id: string): Promise<AtividadeCasa>
  prescrever(dados: NovaAtividadeCasa): Promise<AtividadeCasa>
  /** Encerra a prescricao. A familia deixa de ve-la; o historico permanece. */
  encerrar(atividadeId: string): Promise<AtividadeCasa>
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
  /** CSV de todos os registros do filtro. A exportacao e auditada. */
  exportar(filtro?: FiltroAuditoria): Promise<string>
}

/**
 * Relatorio de evolucao (tela 10). Documento clinico: so terapeuta da equipe e
 * coordenacao alcancam, a escola nunca. Emitir grava o conteudo como saiu —
 * nao ha regeneracao a partir dos dados de hoje.
 */
export interface ServicoRelatorio {
  /** Monta o documento sem gravar nada. Aceita consideracoes ainda vazias. */
  previsualizar(pacienteId: string, pedido: PedidoRelatorio): Promise<ConteudoRelatorio>
  /** Grava o conteudo e o seu hash. Auditado como CRIACAO. */
  emitir(pacienteId: string, pedido: PedidoRelatorio): Promise<RelatorioEvolucao>
  listarPorPaciente(pacienteId: string, filtro?: FiltroPaginacao): Promise<Pagina<RelatorioEvolucao>>
  /** Abrir um emitido e leitura de dado do paciente: auditado (regra 6). */
  obter(relatorioId: string): Promise<RelatorioEvolucao>
}

/**
 * Indicadores da coordenacao (tela 11). Contam e apontam, nao descrevem: o
 * painel nao busca pacientes, planos e sessoes para somar no navegador — o
 * conteudo clinico inteiro atravessaria a rede so para virar um numero.
 *
 * So COORDENADOR alcanca. Os demais perfis recebem ACESSO_NEGADO, auditado.
 */
export interface ServicoIndicadores {
  resumo(): Promise<ResumoClinica>
  /** Cada grupo ja vem do mais urgente para o menos. */
  listarAlertas(motivo: MotivoAtencao, filtro?: FiltroPaginacao): Promise<Pagina<AlertaAtencao>>
  sessoesPorProfissional(): Promise<SessoesPorProfissional>
  ponteEscola(): Promise<PonteEscola>
}

/** Desativar, nunca excluir: o historico clinico precisa manter a autoria. */
export interface ServicoUsuario {
  listar(filtro?: FiltroUsuario): Promise<Pagina<Usuario>>
  /**
   * So cadastra equipe da clinica: terapeuta, coordenacao, administracao.
   * Devolve o link de primeiro acesso: a pessoa define a propria senha, e quem
   * cadastra nunca a conhece (docs/07, secao 0, lacuna 1).
   */
  convidar(dados: {
    nome: string
    email: string
    perfis: Perfil[]
    /** Opcionais: quem completa depois e a propria pessoa, na tela 21. */
    especialidade?: string
    registroConselho?: string
  }): Promise<ContaCriada>
  /**
   * Link novo para uma conta da equipe: o anterior deixa de valer, e a senha
   * atual vale ate o novo ser usado. Serve ao link vencido e a senha esquecida.
   */
  novoLinkDeAcesso(usuarioId: string): Promise<LinkPrimeiroAcesso>
  /** Dados profissionais de quem esta na sessao. Nulo para quem nao e profissional. */
  meusDadosProfissionais(): Promise<DadosProfissionais | null>
  /**
   * So o proprio dono altera: quem responde pelo registro no conselho e quem o
   * possui, nao o administrador. Auditado como ALTERACAO.
   */
  atualizarMeusDadosProfissionais(dados: DadosProfissionais): Promise<DadosProfissionais>
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
  indicadores: ServicoIndicadores
  relatorios: ServicoRelatorio
}
