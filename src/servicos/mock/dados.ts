import type {
  AtividadeCasa, CartaoEstrategia, Consentimento, Escola, ExecucaoAtividadeCasa, Intensidade,
  Objetivo, OcorrenciaComportamental, OcorrenciaEscolar, Paciente, PlanoTerapeutico,
  ProfessorAEE, Profissional, RegistroAtividade, RegistroAuditoria, Responsavel, Resultado,
  Sessao, VinculoEscolar, VinculoFamiliar, ConviteEscolar,
} from '../tipos'
import { calcularExpiracaoConvite } from '../../dominio/regras'

/**
 * DADOS DE DEMONSTRACAO — TODOS FICTICIOS.
 *
 * Nenhum nome, data, registro profissional, telefone ou e-mail pertence a
 * pessoa real. Os e-mails usam o dominio reservado `.example` (RFC 2606) e os
 * registros de conselho levam o sufixo FICT. Nao substitua por dados reais,
 * nem em desenvolvimento.
 *
 * Cinco pacientes, tres profissionais e duas escolas (docs/01, secao 6): o
 * suficiente para exercitar paginacao, busca, filtro e estado vazio.
 *
 * As datas sao relativas ao momento em que a aplicacao abre, para que os
 * alertas (plano sem revisao, paciente sem sessao, consentimento vencendo)
 * continuem coerentes em qualquer dia de apresentacao.
 */

export const SENHA_DEMONSTRACAO = 'demonstracao'

export interface BancoDemonstracao {
  profissionais: Profissional[]
  responsaveis: Responsavel[]
  professores: ProfessorAEE[]
  escolas: Escola[]
  pacientes: Paciente[]
  vinculosFamiliares: VinculoFamiliar[]
  planos: PlanoTerapeutico[]
  sessoes: Sessao[]
  ocorrenciasComportamentais: OcorrenciaComportamental[]
  ocorrenciasEscolares: OcorrenciaEscolar[]
  atividades: AtividadeCasa[]
  execucoes: ExecucaoAtividadeCasa[]
  cartoes: CartaoEstrategia[]
  consentimentos: Consentimento[]
  convites: ConviteEscolar[]
  vinculos: VinculoEscolar[]
  auditoria: RegistroAuditoria[]
}

/** Usuario usado por cada botao de demonstracao da tela de entrada. */
export const USUARIOS_DEMONSTRACAO = {
  TERAPEUTA: 'u-prof-1',
  COORDENADOR: 'u-prof-3',
  RESPONSAVEL: 'u-resp-1',
  PROFESSOR: 'u-profe-1',
} as const

export function criarDadosDemonstracao(agora: Date): BancoDemonstracao {
  const DIA = 86_400_000
  /** Data `dias` atras (negativo: no futuro), na hora indicada, horario local. */
  const em = (dias: number, hora = 14, minuto = 0) => {
    const d = new Date(agora.getTime() - dias * DIA)
    d.setHours(hora, minuto, 0, 0)
    return d.toISOString()
  }
  const horasAtras = (h: number) => new Date(agora.getTime() - h * 3_600_000).toISOString()

  // ------------------------------------------------------------ Profissionais

  const profissionais: Profissional[] = [
    {
      tipo: 'PROFISSIONAL', id: 'u-prof-1', nome: 'Ana Beatriz Correia',
      email: 'ana.correia@clinica.example', perfis: ['TERAPEUTA'], ativo: true,
      ultimoAcessoEm: em(1, 18), especialidade: 'Fonoaudiologia', registroConselho: 'CRFa 1001-FICT',
    },
    {
      tipo: 'PROFISSIONAL', id: 'u-prof-2', nome: 'Rafael Albuquerque Teles',
      email: 'rafael.teles@clinica.example', perfis: ['TERAPEUTA'], ativo: true,
      ultimoAcessoEm: em(2, 17), especialidade: 'Terapia ocupacional', registroConselho: 'CREFITO 2002-FICT',
    },
    {
      tipo: 'PROFISSIONAL', id: 'u-prof-3', nome: 'Juliana Prado Maciel',
      email: 'juliana.maciel@clinica.example', perfis: ['COORDENADOR', 'TERAPEUTA', 'ADMINISTRADOR'],
      ativo: true, ultimoAcessoEm: em(0, 8), especialidade: 'Psicologia (análise do comportamento)',
      registroConselho: 'CRP 3003-FICT',
    },
  ]

  // ------------------------------------------------------------ Familias

  const responsaveis: Responsavel[] = [
    { tipo: 'RESPONSAVEL', id: 'u-resp-1', nome: 'Patrícia Santana', email: 'patricia.santana@familia.example',
      perfis: ['RESPONSAVEL'], ativo: true, ultimoAcessoEm: em(0, 7), telefone: '(92) 90000-0001' },
    { tipo: 'RESPONSAVEL', id: 'u-resp-2', nome: 'Roberto Farias', email: 'roberto.farias@familia.example',
      perfis: ['RESPONSAVEL'], ativo: true, ultimoAcessoEm: em(3, 21), telefone: '(92) 90000-0002' },
    { tipo: 'RESPONSAVEL', id: 'u-resp-3', nome: 'Luciana Brandão', email: 'luciana.brandao@familia.example',
      perfis: ['RESPONSAVEL'], ativo: true, ultimoAcessoEm: em(5, 20), telefone: '(92) 90000-0003' },
    { tipo: 'RESPONSAVEL', id: 'u-resp-4', nome: 'Marcos Oliveira Reis', email: 'marcos.reis@familia.example',
      perfis: ['RESPONSAVEL'], ativo: true, ultimoAcessoEm: null, telefone: '(92) 90000-0004' },
    { tipo: 'RESPONSAVEL', id: 'u-resp-5', nome: 'Vanessa Moreno', email: 'vanessa.moreno@familia.example',
      perfis: ['RESPONSAVEL'], ativo: true, ultimoAcessoEm: em(6, 19), telefone: '(92) 90000-0005' },
    { tipo: 'RESPONSAVEL', id: 'u-resp-6', nome: 'Paulo Vasconcelos', email: 'paulo.vasconcelos@familia.example',
      perfis: ['RESPONSAVEL'], ativo: true, ultimoAcessoEm: em(2, 22), telefone: '(92) 90000-0006' },
    { tipo: 'RESPONSAVEL', id: 'u-resp-7', nome: 'Sandra Quirino', email: 'sandra.quirino@familia.example',
      perfis: ['RESPONSAVEL'], ativo: true, ultimoAcessoEm: null, telefone: '(92) 90000-0007' },
    { tipo: 'RESPONSAVEL', id: 'u-resp-8', nome: 'Elaine Bastos', email: 'elaine.bastos@familia.example',
      perfis: ['RESPONSAVEL'], ativo: true, ultimoAcessoEm: em(9, 20), telefone: '(92) 90000-0008' },
    { tipo: 'RESPONSAVEL', id: 'u-resp-9', nome: 'Tarcísio Palmeira', email: 'tarcisio.palmeira@familia.example',
      perfis: ['RESPONSAVEL'], ativo: true, ultimoAcessoEm: null, telefone: '(92) 90000-0009' },
    { tipo: 'RESPONSAVEL', id: 'u-resp-10', nome: 'Norma Nogueira', email: 'norma.nogueira@familia.example',
      perfis: ['RESPONSAVEL'], ativo: true, ultimoAcessoEm: em(15, 18), telefone: '(92) 90000-0010' },
    { tipo: 'RESPONSAVEL', id: 'u-resp-11', nome: 'Célia Aragão', email: 'celia.aragao@familia.example',
      perfis: ['RESPONSAVEL'], ativo: true, ultimoAcessoEm: em(1, 21), telefone: '(92) 90000-0011' },
    { tipo: 'RESPONSAVEL', id: 'u-resp-12', nome: 'Marta Peixoto', email: 'marta.peixoto@familia.example',
      perfis: ['RESPONSAVEL'], ativo: true, ultimoAcessoEm: null, telefone: '(92) 90000-0012' },
    { tipo: 'RESPONSAVEL', id: 'u-resp-13', nome: 'Rosa Ferrer', email: 'rosa.ferrer@familia.example',
      perfis: ['RESPONSAVEL'], ativo: true, ultimoAcessoEm: em(4, 20), telefone: '(92) 90000-0013' },
    { tipo: 'RESPONSAVEL', id: 'u-resp-14', nome: 'Gustavo Ferrer', email: 'gustavo.ferrer@familia.example',
      perfis: ['RESPONSAVEL'], ativo: true, ultimoAcessoEm: null, telefone: '(92) 90000-0014' },
  ]

  // ------------------------------------------------------------ Escolas

  const escolas: Escola[] = [
    { id: 'esc-1', nome: 'EMEF Jardim das Palmeiras', rede: 'Municipal', municipio: 'Manaus' },
    { id: 'esc-2', nome: 'Escola Municipal Vitória-Régia', rede: 'Municipal', municipio: 'Manaus' },
  ]

  const professores: ProfessorAEE[] = [
    { tipo: 'PROFESSOR_AEE', id: 'u-profe-1', nome: 'Carla Nunes', email: 'carla.nunes@escola.example',
      perfis: ['PROFESSOR'], ativo: true, ultimoAcessoEm: em(0, 9) },
    { tipo: 'PROFESSOR_AEE', id: 'u-profe-2', nome: 'Tiago Rezende', email: 'tiago.rezende@escola.example',
      perfis: ['PROFESSOR'], ativo: true, ultimoAcessoEm: em(4, 10) },
  ]

  // ------------------------------------------------------------ Pacientes

  const pacientes: Paciente[] = [
    { id: 'p-001', nome: 'Miguel Santana', dataNascimento: '2019-03-12', nivelSuporte: 2,
      profissionalResponsavelId: 'u-prof-1', equipeIds: ['u-prof-1', 'u-prof-3'], ativo: true, },
    { id: 'p-002', nome: 'Sofia Santana', dataNascimento: '2021-07-02', nivelSuporte: 1,
      profissionalResponsavelId: 'u-prof-2', equipeIds: ['u-prof-2'], ativo: true, },
    { id: 'p-003', nome: 'Davi Farias', dataNascimento: '2017-11-23', nivelSuporte: 3,
      profissionalResponsavelId: 'u-prof-1', equipeIds: ['u-prof-1', 'u-prof-2'], ativo: true, },
    { id: 'p-004', nome: 'Heitor Brandão', dataNascimento: '2020-01-30', nivelSuporte: 2,
      profissionalResponsavelId: 'u-prof-3', equipeIds: ['u-prof-3', 'u-prof-1'], ativo: true, },
    { id: 'p-005', nome: 'Laura Reis', dataNascimento: '2018-05-14', nivelSuporte: 1,
      profissionalResponsavelId: 'u-prof-2', equipeIds: ['u-prof-2', 'u-prof-3'], ativo: true, },
    { id: 'p-006', nome: 'Alice Moreno', dataNascimento: '2019-08-21', nivelSuporte: 1,
      profissionalResponsavelId: 'u-prof-1', equipeIds: ['u-prof-1', 'u-prof-2'], ativo: true },
    { id: 'p-007', nome: 'Théo Vasconcelos', dataNascimento: '2020-05-09', nivelSuporte: 2,
      profissionalResponsavelId: 'u-prof-2', equipeIds: ['u-prof-2'], ativo: true },
    { id: 'p-008', nome: 'Ravi Quirino', dataNascimento: '2016-02-17', nivelSuporte: 3,
      profissionalResponsavelId: 'u-prof-3', equipeIds: ['u-prof-3', 'u-prof-2'], ativo: true },
    { id: 'p-009', nome: 'Manuela Bastos', dataNascimento: '2018-10-03', nivelSuporte: 2,
      profissionalResponsavelId: 'u-prof-3', equipeIds: ['u-prof-3'], ativo: true },
    { id: 'p-010', nome: 'Enzo Palmeira', dataNascimento: '2021-01-26', nivelSuporte: 1,
      profissionalResponsavelId: 'u-prof-1', equipeIds: ['u-prof-1'], ativo: true },
    { id: 'p-011', nome: 'Cecília Nogueira', dataNascimento: '2017-06-30', nivelSuporte: 3,
      profissionalResponsavelId: 'u-prof-2', equipeIds: ['u-prof-2', 'u-prof-1'], ativo: true },
    { id: 'p-012', nome: 'Bento Aragão', dataNascimento: '2019-12-11', nivelSuporte: 2,
      profissionalResponsavelId: 'u-prof-3', equipeIds: ['u-prof-3', 'u-prof-1'], ativo: true },
    { id: 'p-013', nome: 'Isadora Peixoto', dataNascimento: '2020-09-15', nivelSuporte: 1,
      profissionalResponsavelId: 'u-prof-1', equipeIds: ['u-prof-1', 'u-prof-3'], ativo: true },
    { id: 'p-014', nome: 'Noah Ferrer', dataNascimento: '2018-03-05', nivelSuporte: 3,
      profissionalResponsavelId: 'u-prof-2', equipeIds: ['u-prof-2', 'u-prof-3'], ativo: true },
  ]

  /** Parentesco e responsabilidade legal sao da relacao, nao da pessoa. */
  const vinculosFamiliares: VinculoFamiliar[] = [
    { id: 'vf-001', responsavelId: 'u-resp-1', pacienteId: 'p-001', parentesco: 'Mãe', responsavelLegal: true },
    { id: 'vf-002', responsavelId: 'u-resp-1', pacienteId: 'p-002', parentesco: 'Mãe', responsavelLegal: true },
    { id: 'vf-003', responsavelId: 'u-resp-2', pacienteId: 'p-003', parentesco: 'Pai', responsavelLegal: true },
    { id: 'vf-004', responsavelId: 'u-resp-3', pacienteId: 'p-004', parentesco: 'Mãe', responsavelLegal: true },
    { id: 'vf-005', responsavelId: 'u-resp-4', pacienteId: 'p-005', parentesco: 'Avô', responsavelLegal: true },
    { id: 'vf-006', responsavelId: 'u-resp-5', pacienteId: 'p-006', parentesco: 'Mãe', responsavelLegal: true },
    { id: 'vf-007', responsavelId: 'u-resp-6', pacienteId: 'p-007', parentesco: 'Pai', responsavelLegal: true },
    { id: 'vf-008', responsavelId: 'u-resp-7', pacienteId: 'p-008', parentesco: 'Mãe', responsavelLegal: true },
    { id: 'vf-009', responsavelId: 'u-resp-8', pacienteId: 'p-009', parentesco: 'Mãe', responsavelLegal: true },
    { id: 'vf-010', responsavelId: 'u-resp-9', pacienteId: 'p-010', parentesco: 'Pai', responsavelLegal: true },
    { id: 'vf-011', responsavelId: 'u-resp-10', pacienteId: 'p-011', parentesco: 'Avó', responsavelLegal: true },
    { id: 'vf-012', responsavelId: 'u-resp-11', pacienteId: 'p-012', parentesco: 'Mãe', responsavelLegal: true },
    { id: 'vf-013', responsavelId: 'u-resp-12', pacienteId: 'p-013', parentesco: 'Mãe', responsavelLegal: true },
    // Noah tem os dois responsaveis: so um responde legalmente.
    { id: 'vf-014', responsavelId: 'u-resp-13', pacienteId: 'p-014', parentesco: 'Mãe', responsavelLegal: true },
    { id: 'vf-015', responsavelId: 'u-resp-14', pacienteId: 'p-014', parentesco: 'Pai', responsavelLegal: false },
  ]

  // ------------------------------------------------------------ Planos e objetivos

  const criterioPadrao = { percentualMinimo: 80, sessoesConsecutivas: 3 }
  /** dominadoEm e obrigatorio quando o status e DOMINADO, e proibido fora dele. */
  const objetivo = (id: string, planoId: string, dominio: string, descricaoTecnica: string,
    descricaoAcessivel: string, status: Objetivo['status'], percentualAtual: number,
    dominadoEm: string | null = null): Objetivo => {
    if ((status === 'DOMINADO') !== (dominadoEm !== null)) {
      throw new Error(`Objetivo ${id}: status DOMINADO e dominadoEm andam juntos.`)
    }
    return { id, planoId, dominio, descricaoTecnica, descricaoAcessivel, status, dominadoEm,
      percentualAtual, criterio: { ...criterioPadrao } }
  }

  const planos: PlanoTerapeutico[] = [
    {
      id: 'pl-001', pacienteId: 'p-001', autorId: 'u-prof-1', status: 'VIGENTE',
      dataInicio: em(120, 9), dataRevisao: em(-60, 9), ultimaRevisaoEm: em(30, 9), observacaoValidacao: null,
      objetivos: [
        objetivo('o-001', 'pl-001', 'Comunicação funcional',
          'Emitir mando por item preferido em 8 de 10 tentativas, com ajuda gestual desvanecida.',
          'Pedir o que quer, apontando ou falando, sem precisar que o adulto ajude.', 'EM_AQUISICAO', 85),
        objetivo('o-002', 'pl-001', 'Regulação sensorial',
          'Solicitar pausa regulatória diante de estímulo auditivo aversivo, com apoio visual.',
          'Avisar quando o barulho está incomodando e pedir um tempo em um lugar calmo.', 'EM_AQUISICAO', 40),
        objetivo('o-003', 'pl-001', 'Transição entre atividades',
          'Encerrar atividade em curso após aviso antecedente de 5 minutos, sem esquiva.',
          'Guardar o que está fazendo quando avisam que falta pouco para terminar.', 'DOMINADO', 90,
          // Dentro dos ultimos 30 dias: conta em "objetivos dominados no mes".
          em(12, 16)),
      ],
    },
    {
      id: 'pl-002', pacienteId: 'p-002', autorId: 'u-prof-2', status: 'AGUARDANDO_VALIDACAO',
      dataInicio: em(5, 9), dataRevisao: em(-85, 9), ultimaRevisaoEm: null, observacaoValidacao: null,
      objetivos: [
        objetivo('o-004', 'pl-002', 'Atenção compartilhada',
          'Responder ao chamado pelo nome com orientação do olhar em 4 de 5 oportunidades.',
          'Olhar para quem chama quando ouve o próprio nome.', 'NAO_INICIADO', 0),
        objetivo('o-005', 'pl-002', 'Brincar funcional',
          'Manter brincadeira funcional com objeto por 3 minutos, com mediação verbal mínima.',
          'Brincar com um brinquedo do jeito que ele funciona, por alguns minutos.', 'NAO_INICIADO', 0),
      ],
    },
    {
      id: 'pl-003', pacienteId: 'p-003', autorId: 'u-prof-1', status: 'VIGENTE',
      dataInicio: em(200, 9), dataRevisao: em(10, 9), ultimaRevisaoEm: em(100, 9), observacaoValidacao: null,
      objetivos: [
        objetivo('o-006', 'pl-003', 'Comunicação alternativa',
          'Selecionar pictograma correspondente ao item desejado em prancha de 4 opções, com ajuda física parcial.',
          'Escolher na prancha a figura do que ele quer.', 'EM_AQUISICAO', 50),
        objetivo('o-007', 'pl-003', 'Autocuidado',
          'Executar sequência de lavagem das mãos em 6 etapas com apoio de agenda visual.',
          'Lavar as mãos seguindo os desenhos do passo a passo.', 'DOMINADO', 90,
          // Fora da janela: existe no historico, mas nao no numero do mes.
          em(65, 16)),
      ],
    },
    {
      id: 'pl-004', pacienteId: 'p-004', autorId: 'u-prof-3', status: 'VIGENTE',
      dataInicio: em(60, 9), dataRevisao: em(-30, 9), ultimaRevisaoEm: null, observacaoValidacao: null,
      objetivos: [
        objetivo('o-008', 'pl-004', 'Tolerância à espera',
          'Aguardar a vez em atividade de mesa por até 2 minutos com temporizador visual.',
          'Esperar a vez olhando o relógio de areia, sem sair da mesa.', 'EM_AQUISICAO', 70),
      ],
    },
    {
      id: 'pl-005', pacienteId: 'p-005', autorId: 'u-prof-2', status: 'DEVOLVIDO',
      dataInicio: em(12, 9), dataRevisao: em(-78, 9), ultimaRevisaoEm: null,
      observacaoValidacao: 'O critério do objetivo de interação está sem número de sessões. Rever antes de reenviar.',
      objetivos: [
        objetivo('o-009', 'pl-005', 'Interação com pares',
          'Iniciar interação com par em atividade livre, com mediação do adulto.',
          'Chamar um colega para brincar junto, com ajuda de um adulto.', 'NAO_INICIADO', 0),
      ],
    },
  ]

  /**
   * Planos dos demais pacientes, com um objetivo cada. Variam de proposito:
   * dois pacientes ficam SEM plano (p-010 e p-011) e varios sem nenhuma sessao,
   * para que lista, filtro e estado vazio tenham o que exercitar.
   */
  const planoEnxuto = (
    numero: string, autorId: string, status: PlanoTerapeutico['status'],
    diasInicio: number, dominio: string, tecnica: string, acessivel: string,
    statusObjetivo: Objetivo['status'], percentual: number,
    observacaoValidacao: string | null = null,
    ultimaRevisaoEm: string | null = null,
  ): PlanoTerapeutico => {
    const id = `pl-${numero}`
    return {
      id, pacienteId: `p-${numero}`, autorId, status,
      dataInicio: em(diasInicio, 9), dataRevisao: em(diasInicio - 180, 9),
      ultimaRevisaoEm, observacaoValidacao,
      objetivos: [objetivo(`o-0${10 + Number(numero) - 6}`, id, dominio, tecnica, acessivel, statusObjetivo, percentual)],
    }
  }

  planos.push(
    planoEnxuto('006', 'u-prof-1', 'VIGENTE', 90,
      'Comunicação funcional',
      'Combinar duas palavras para pedir item preferido em 7 de 10 oportunidades.',
      'Juntar duas palavras para pedir o que quer.', 'EM_AQUISICAO', 55, null, em(20, 9)),
    planoEnxuto('007', 'u-prof-2', 'VIGENTE', 7,
      'Regulação sensorial',
      'Tolerar textura nova à mesa por 2 minutos, com dessensibilização gradual.',
      'Ficar à mesa com um alimento novo por perto, sem precisar comer.', 'NAO_INICIADO', 0),
    planoEnxuto('008', 'u-prof-3', 'RASCUNHO', 2,
      'Autocuidado',
      'Vestir a blusa em 4 etapas com encadeamento anterógrado.',
      'Vestir a blusa sozinho, com o passo a passo.', 'NAO_INICIADO', 0),
    planoEnxuto('009', 'u-prof-3', 'AGUARDANDO_VALIDACAO', 10,
      'Interação com pares',
      'Revezar turno em jogo de mesa por 4 rodadas, com mediação verbal.',
      'Esperar a vez no jogo, até o fim da partida.', 'EM_AQUISICAO', 45),
    // Plano sem revisão há mais de 90 dias: alimenta o alerta da coordenação.
    planoEnxuto('012', 'u-prof-3', 'VIGENTE', 240,
      'Transição entre ambientes',
      'Entrar na sala de atendimento sem esquiva após aviso antecedente.',
      'Entrar na sala quando avisam que chegou a hora.', 'EM_AQUISICAO', 70, null, em(150, 9)),
    planoEnxuto('013', 'u-prof-1', 'DEVOLVIDO', 9,
      'Comunicação alternativa',
      'Selecionar pictograma de necessidade básica em prancha de 6 opções.',
      'Mostrar na prancha o que está precisando.', 'NAO_INICIADO', 0,
      'Faltou o critério de domínio do objetivo. Complete e reenvie.'),
    planoEnxuto('014', 'u-prof-2', 'VIGENTE', 150,
      'Tolerância à espera',
      'Aguardar atendimento na recepção por 5 minutos com apoio visual.',
      'Esperar na recepção olhando o quadro de rotina.', 'EM_AQUISICAO', 60, null, em(40, 9)),
  )

  // ------------------------------------------------------------ Sessoes

  const erros: Resultado[] = ['AJUDA_GESTUAL', 'AJUDA_FISICA', 'SEM_RESPOSTA']
  /** Dez tentativas do objetivo; `percentual` define quantas foram independentes. */
  const tentativas = (sessaoId: string, objetivoId: string, percentual: number, quando: string): RegistroAtividade[] => {
    const independentes = Math.round(percentual / 10)
    return Array.from({ length: 10 }, (_, i) => ({
      id: `${sessaoId}-${objetivoId}-${i + 1}`,
      objetivoId,
      ordem: i + 1,
      resultado: i < independentes ? 'INDEPENDENTE' : erros[i % erros.length],
      ocorridoEm: new Date(Date.parse(quando) + (i + 1) * 90_000).toISOString(),
    }))
  }

  const sessoes: Sessao[] = []
  const encerrada = (pacienteId: string, profissionalId: string, diasAtras: number,
    porObjetivo: Record<string, number>, hora = 9) => {
    const numero = sessoes.filter((s) => s.pacienteId === pacienteId).length + 1
    const id = `s-${pacienteId.slice(2)}-${String(numero).padStart(2, '0')}`
    const inicio = em(diasAtras, hora)
    sessoes.push({
      id, pacienteId, profissionalId, numero,
      inicioPrevistoEm: inicio, inicio,
      fim: new Date(Date.parse(inicio) + 50 * 60_000).toISOString(),
      local: 'Clínica · sala 2',
      situacao: 'ENCERRADA',
      statusSync: 'SINCRONIZADO',
      registros: Object.entries(porObjetivo).flatMap(([obj, p]) => tentativas(id, obj, p, inicio)),
    })
  }

  // Miguel: duas sessoes por semana; o-001 sobe ate atingir o criterio.
  const evolucaoMiguel = [30, 45, 40, 55, 60, 55, 70, 80, 82, 85]
  /* Objetivo sem avanco: o recorde (60%) ficou nas duas primeiras sessoes e
     nao foi batido nas oito seguintes. Alimenta o alerta da tela 11. */
  const regulacaoMiguel = [60, 50, 40, 40, 30, 40, 30, 40, 40, 50]
  evolucaoMiguel.forEach((p, i) => {
    const diasAtras = 33 - Math.floor(i * 3.5)
    encerrada('p-001', i % 4 === 3 ? 'u-prof-3' : 'u-prof-1', diasAtras,
      { 'o-001': p, 'o-002': regulacaoMiguel[i], ...(i < 4 ? { 'o-003': 80 + i * 3 } : {}) })
  })

  // Davi: semanal.
  ;[30, 40, 40, 50, 50].forEach((p, i) => encerrada('p-003', 'u-prof-1', 32 - i * 7, { 'o-006': p, 'o-007': p + 10 }, 10))
  // Heitor: semanal com a coordenadora.
  ;[50, 60, 60, 70].forEach((p, i) => encerrada('p-004', 'u-prof-3', 25 - i * 7, { 'o-008': p }, 15))
  // Laura: ultima sessao ha 20 dias — aparece no alerta "sem sessao ha mais de 15 dias".
  ;[20, 30].forEach((p, i) => encerrada('p-005', 'u-prof-2', 27 - i * 7, { 'o-009': p }, 16))
  // Sofia: plano ainda em validacao, nenhuma sessao encerrada.

  // Quatro dos novos pacientes ja tem historico; os demais ficam sem sessao.
  ;[40, 50, 60].forEach((v, i) => encerrada('p-006', 'u-prof-1', 20 - i * 7, { 'o-010': v }, 11))
  ;[30, 45].forEach((v, i) => encerrada('p-009', 'u-prof-3', 12 - i * 7, { 'o-013': v }, 14))
  ;[55, 60, 65, 70].forEach((v, i) => encerrada('p-012', 'u-prof-3', 28 - i * 7, { 'o-016': v }, 8))
  ;[40, 50].forEach((v, i) => encerrada('p-014', 'u-prof-2', 9 - i * 7, { 'o-018': v }, 17))

  /* Tres registros da Ana feitos sem conexao: alimentam o bloco de
     sincronizacao do painel. Zero registros pendentes esconde o bloco. */
  for (const s of sessoes.filter((x) => x.profissionalId === 'u-prof-1').slice(-3)) {
    s.statusSync = 'PENDENTE'
  }

  // Agenda de hoje.
  const agendada = (id: string, pacienteId: string, profissionalId: string, hora: number, minuto = 0) => {
    const numero = sessoes.filter((s) => s.pacienteId === pacienteId).length + 1
    sessoes.push({
      id, pacienteId, profissionalId, numero,
      inicioPrevistoEm: em(0, hora, minuto), inicio: null, fim: null,
      local: 'Clínica · sala 2', situacao: 'AGENDADA', statusSync: 'SINCRONIZADO', registros: [],
    })
  }
  agendada('s-hoje-1', 'p-001', 'u-prof-1', 8)
  agendada('s-hoje-2', 'p-003', 'u-prof-1', 9, 30)
  agendada('s-hoje-3', 'p-004', 'u-prof-1', 14)
  agendada('s-hoje-4', 'p-002', 'u-prof-2', 10)
  agendada('s-hoje-5', 'p-004', 'u-prof-3', 16)

  // ------------------------------------------------------------ Consentimentos e vinculos

  const consentimento = (id: string, responsavelId: string, pacienteId: string, escolaId: string,
    escopos: Consentimento['escopos'], concedidoEm: string, validadeAte: string,
    revogadoEm: string | null = null): Consentimento =>
    // Hash ficticio: no servidor sera a impressao digital do termo aceito.
    ({ id, responsavelId, pacienteId, escolaId, escopos, concedidoEm, validadeAte, revogadoEm,
      hashTermo: `sha256:ficticio-${id}` })

  const ambos: Consentimento['escopos'] = ['CARTAO_ESTRATEGIA', 'REGISTRO_OCORRENCIA']
  const consentimentos: Consentimento[] = [
    // Vigente, com os dois escopos: a demonstracao principal da area da escola.
    consentimento('c-001', 'u-resp-1', 'p-001', 'esc-1', ambos, em(45, 19), em(-120, 23, 59)),
    // Vigente so para o cartao, vencendo em menos de 30 dias.
    consentimento('c-002', 'u-resp-2', 'p-003', 'esc-2', ['CARTAO_ESTRATEGIA'], em(40, 20), em(-20, 23, 59)),
    // Revogado ha 3 dias: a professora continua tentando e e negada.
    consentimento('c-003', 'u-resp-3', 'p-004', 'esc-1', ambos, em(50, 18), em(-100, 23, 59), em(3, 21)),
    // Expirado.
    consentimento('c-004', 'u-resp-4', 'p-005', 'esc-2', ['CARTAO_ESTRATEGIA'], em(200, 18), em(5, 23, 59)),
    // Os tres a seguir servem aos estados do convite (tela 2).
    consentimento('c-005', 'u-resp-1', 'p-002', 'esc-1', ambos, horasAtras(1), em(-90, 23, 59)),
    consentimento('c-006', 'u-resp-1', 'p-002', 'esc-2', ['CARTAO_ESTRATEGIA'], em(5, 10), em(-90, 23, 59)),
    consentimento('c-007', 'u-resp-4', 'p-005', 'esc-1', ambos, em(1, 10), em(-90, 23, 59), horasAtras(2)),
  ]

  const [c1, c2, c3, c4, c5, c6, c7] = consentimentos
  const depoisDe = (iso: string, horas: number) => new Date(Date.parse(iso) + horas * 3_600_000).toISOString()

  /** Uso unico, 72 horas. O vinculo so nasce quando ele e aceito. */
  const convite = (id: string, c: Consentimento, token: string, usadoEm: string | null): ConviteEscolar => ({
    id, consentimentoId: c.id, token, criadoEm: c.concedidoEm,
    expiraEm: calcularExpiracaoConvite(new Date(c.concedidoEm)).toISOString(),
    usadoEm,
  })

  const convites: ConviteEscolar[] = [
    convite('cv-001', c1, 'demo-convite-usado', depoisDe(c1.concedidoEm, 14)),
    convite('cv-002', c2, 'demo-convite-davi', depoisDe(c2.concedidoEm, 20)),
    convite('cv-003', c3, 'demo-convite-heitor', depoisDe(c3.concedidoEm, 16)),
    convite('cv-004', c4, 'demo-convite-laura', depoisDe(c4.concedidoEm, 30)),
    // Os tres a seguir nunca foram aceitos: sem vinculo, portanto.
    convite('cv-005', c5, 'demo-convite-valido', null),
    convite('cv-006', c6, 'demo-convite-expirado', null),
    convite('cv-007', c7, 'demo-convite-revogado', null),
  ]

  const vinculo = (id: string, cv: ConviteEscolar, c: Consentimento, professorId: string,
    turma: string, turno: string, atuacao: string): VinculoEscolar => ({
    id, consentimentoId: c.id, conviteId: cv.id, pacienteId: c.pacienteId, professorId,
    turma, turno, atuacao, status: c.revogadoEm === null ? 'ATIVO' : 'ENCERRADO',
  })

  const vinculos: VinculoEscolar[] = [
    vinculo('v-001', convites[0], c1, 'u-profe-1', '2º ano B', 'Matutino', 'Professora regente'),
    vinculo('v-002', convites[1], c2, 'u-profe-2', '4º ano A', 'Vespertino', 'Atendimento educacional especializado'),
    // A mesma professora, outra atuacao com outro aluno.
    vinculo('v-003', convites[2], c3, 'u-profe-1', '1º ano C', 'Matutino', 'Atendimento educacional especializado'),
    vinculo('v-004', convites[3], c4, 'u-profe-2', '3º ano B', 'Vespertino', 'Professor regente'),
  ]

  // ------------------------------------------------------------ Cartoes de estrategia

  const cartoes: CartaoEstrategia[] = [
    {
      id: 'ce-001', objetivoId: 'o-002', atualizadoEm: em(12, 11),
      tituloSimples: 'Quando o barulho incomoda',
      oQueFazer: [
        'Avise 5 minutos antes de mudar de atividade.',
        'Use o quadro de rotina: ele se organiza melhor vendo a sequência.',
        'Se ele apontar para o cartão do tempo calmo, permita a pausa na hora.',
      ],
      oQueEvitar: [
        'Não insista no contato visual para confirmar que ele entendeu.',
        'Não repita o mesmo comando mais de duas vezes seguidas.',
        'Não retire a pausa como forma de correção.',
      ],
      sinalAlerta:
        'Tapar os ouvidos e afastar-se do grupo costuma indicar sobrecarga sensorial, não recusa. ' +
        'Ofereça o canto calmo antes de insistir na tarefa.',
    },
    {
      id: 'ce-002', objetivoId: 'o-006', atualizadoEm: em(20, 11),
      tituloSimples: 'Escolher pela prancha de figuras',
      oQueFazer: [
        'Deixe a prancha de figuras sempre ao alcance dele na mesa.',
        'Espere alguns segundos depois de perguntar: ele precisa de tempo para escolher.',
      ],
      oQueEvitar: [
        'Não escolha a figura por ele, mesmo que pareça demorar.',
        'Não retire a prancha nos momentos de brincadeira.',
      ],
      sinalAlerta: 'Balançar o corpo com mais força pode indicar que ele está cansado. Uma pausa curta costuma ajudar.',
    },
    {
      id: 'ce-003', objetivoId: 'o-008', atualizadoEm: em(15, 11),
      tituloSimples: 'Esperar a vez na mesa',
      oQueFazer: ['Mostre o relógio de areia antes de pedir que ele espere.'],
      oQueEvitar: ['Não aumente o tempo de espera sem avisar.'],
      sinalAlerta: 'Levantar da cadeira repetidas vezes costuma indicar que a espera ficou longa demais.',
    },
  ]

  // ------------------------------------------------------------ Ocorrencias

  const ocorrenciasEscolares: OcorrenciaEscolar[] = []
  const ocorrenciasComportamentais: OcorrenciaComportamental[] = []
  const ocorrenciaEscolar = (id: string, v: VinculoEscolar, registradaEm: string, tipo: string,
    intensidade: Intensidade, contexto: string, horasAteLeitura: number | null = null) => {
    ocorrenciasEscolares.push({
      id, vinculoId: v.id, pacienteId: v.pacienteId, professorId: v.professorId,
      // Na demonstracao o professor registra logo depois do que observou.
      ocorridoEm: registradaEm, registradaEm,
      corrigidaEm: null, tipo, intensidade, contexto,
    })
    // «gera»: a ocorrencia da escola entra na clinica como evento preliminar.
    ocorrenciasComportamentais.push({
      id: `oc-${id}`, pacienteId: v.pacienteId, origem: 'ESCOLA', ocorridaEm: registradaEm,
      antecedente: `Contexto: ${contexto}`, comportamento: tipo,
      consequencia: 'Não informado pela escola.', intensidade,
      // Nulo enquanto o profissional nao fez a leitura clinica do evento.
      leituraClinicaEm: horasAteLeitura === null
        ? null
        : new Date(Date.parse(registradaEm) + horasAteLeitura * 3_600_000).toISOString(),
      sessaoId: null, ocorrenciaEscolarId: id,
    })
  }
  const [v1] = vinculos
  // Tres com leitura clinica feita, em prazos diferentes; tres ainda
  // preliminares. As tres lidas cabem na janela de 30 dias do painel, senao a
  // mediana do tempo ate a leitura nao teria as tres medidas que precisa.
  ocorrenciaEscolar('oe-001', v1, em(28, 10, 15), 'Tapou os ouvidos', 4, 'Recreio', 2)
  ocorrenciaEscolar('oe-002', v1, em(24, 9, 40), 'Saiu da sala', 3, 'Troca de atividade', 26)
  ocorrenciaEscolar('oe-003', v1, em(17, 10, 5), 'Tapou os ouvidos', 3, 'Atividade em grupo', 72)
  ocorrenciaEscolar('oe-004', v1, em(10, 11, 20), 'Recusou a tarefa', 2, 'Troca de atividade')
  ocorrenciaEscolar('oe-005', v1, em(3, 10, 0), 'Tapou os ouvidos', 2, 'Recreio')
  ocorrenciaEscolar('oe-006', v1, horasAtras(3), 'Chorou', 3, 'Entrada')

  const sessaoMiguel = sessoes.find((s) => s.pacienteId === 'p-001' && s.numero === 7)!
  ocorrenciasComportamentais.push({
    id: 'oc-clin-001', pacienteId: 'p-001', origem: 'CLINICA', ocorridaEm: sessaoMiguel.inicio!,
    antecedente: 'Liquidificador ligado na sala ao lado.', comportamento: 'Tapou os ouvidos e deitou no chão.',
    consequencia: 'Ofertado abafador e pausa de 3 minutos; retomou a atividade.', intensidade: 3,
    // Registrada em sessao pelo profissional: a leitura clinica e a propria.
    leituraClinicaEm: sessaoMiguel.inicio!, sessaoId: sessaoMiguel.id, ocorrenciaEscolarId: null,
  })

  // ------------------------------------------------------------ Atividades em casa

  const atividades: AtividadeCasa[] = [
    { id: 'a-001', pacienteId: 'p-001', objetivoId: 'o-001', titulo: 'Escolher o lanche apontando',
      descricao: 'Na hora do lanche, mostre duas opções e espere ele apontar ou pedir.',
      passos: ['Mostre duas opções de lanche, uma em cada mão.', 'Espere alguns segundos sem falar.', 'Entregue o que ele apontar ou pedir.'],
      dicas: 'Se ele não escolher, aproxime as duas opções do rosto dele e espere mais um pouco.',
      frequenciaSemanal: 3, urlVideo: null, ativa: true, prescritaEm: em(35, 11) },
    { id: 'a-002', pacienteId: 'p-001', objetivoId: 'o-001', titulo: 'Pedir ajuda para abrir a embalagem',
      descricao: 'Entregue o pacote fechado e espere ele pedir ajuda.',
      passos: ['Entregue a embalagem fechada.', 'Espere ele olhar para você ou pedir.', 'Abra junto com ele.'],
      dicas: 'Vale qualquer forma de pedir: olhar, apontar, som ou palavra.',
      frequenciaSemanal: 2, urlVideo: null, ativa: true, prescritaEm: em(35, 11) },
    { id: 'a-003', pacienteId: 'p-001', objetivoId: 'o-002', titulo: 'Avisar quando o barulho incomoda',
      descricao: 'Ensina que avisar funciona: quando ele pede, a pausa acontece.',
      passos: [
        'Deixe o cartão do tempo calmo em um lugar que ele alcance.',
        'Quando começar um barulho forte, liquidificador ou aspirador, mostre o cartão.',
        'Se ele apontar ou pedir, leve-o ao canto calmo na hora. Isso ensina que avisar funciona.',
      ],
      dicas: 'Nos primeiros dias, mostre o cartão antes de o barulho começar.',
      frequenciaSemanal: 2, urlVideo: null, ativa: true, prescritaEm: em(28, 11) },
    { id: 'a-004', pacienteId: 'p-003', objetivoId: 'o-007', titulo: 'Lavar as mãos com o passo a passo',
      descricao: 'Cole os desenhos perto da pia e acompanhe a sequência junto com ele.',
      passos: ['Cole os seis desenhos na parede da pia.', 'Aponte cada desenho antes de fazer.', 'Comemore quando terminar.'],
      dicas: 'Se ele pular uma etapa, aponte o desenho em vez de falar o passo.',
      frequenciaSemanal: 5, urlVideo: null, ativa: true, prescritaEm: em(30, 11) },
  ]

  const execucoes: ExecucaoAtividadeCasa[] = []
  const desempenhos: ExecucaoAtividadeCasa['desempenho'][] = ['COM_AJUDA', 'COM_AJUDA', 'NAO_QUIS', 'COM_AJUDA', 'SOZINHO', 'SOZINHO', 'SOZINHO']
  ;[31, 27, 24, 20, 13, 9, 4].forEach((d, i) =>
    execucoes.push({ id: `ex-${i + 1}`, atividadeId: 'a-001', responsavelId: 'u-resp-1',
      dataRealizacao: em(d, 12), desempenho: desempenhos[i], observacao: null }))
  ;[22, 15, 8].forEach((d, i) =>
    execucoes.push({ id: `ex-${i + 8}`, atividadeId: 'a-003', responsavelId: 'u-resp-1',
      dataRealizacao: em(d, 18), desempenho: i === 2 ? 'SOZINHO' : 'COM_AJUDA', observacao: null }))
  ;[20, 12, 5].forEach((d, i) =>
    execucoes.push({ id: `ex-${i + 11}`, atividadeId: 'a-004', responsavelId: 'u-resp-2',
      dataRealizacao: em(d, 19), desempenho: 'COM_AJUDA', observacao: null }))

  // ------------------------------------------------------------ Auditoria inicial

  const semId: Omit<RegistroAuditoria, 'id'>[] = []
  const auditar = (r: Omit<RegistroAuditoria, 'id'>) => semId.push(r)

  for (const c of consentimentos) {
    const resp = responsaveis.find((r) => r.id === c.responsavelId)!
    auditar({ ocorridoEm: c.concedidoEm, usuarioId: resp.id, usuarioNome: resp.nome, perfil: 'RESPONSAVEL',
      acao: 'CONCESSAO_ACESSO', entidade: 'Consentimento', idEntidade: c.id, pacienteId: c.pacienteId,
      origem: 'FAMILIA', ipOrigem: null,
      detalhe: `Escola: ${escolas.find((e) => e.id === c.escolaId)?.nome ?? '—'} · escopos: ${c.escopos.join(', ')}` })
    if (c.revogadoEm) {
      auditar({ ocorridoEm: c.revogadoEm, usuarioId: resp.id, usuarioNome: resp.nome, perfil: 'RESPONSAVEL',
        acao: 'REVOGACAO_ACESSO', entidade: 'Consentimento', idEntidade: c.id, pacienteId: c.pacienteId,
        origem: 'FAMILIA', ipOrigem: null, detalhe: 'Revogado pelo responsável.' })
    }
  }
  auditar({ ocorridoEm: em(2, 9, 10), usuarioId: 'u-profe-1', usuarioNome: 'Carla Nunes', perfil: 'PROFESSOR',
    acao: 'ACESSO_NEGADO', entidade: 'CartaoEstrategia', idEntidade: null, pacienteId: 'p-004',
    origem: 'ESCOLA', ipOrigem: null, detalhe: 'Consentimento revogado.' })
  // Numeracao em ordem cronologica, como o servidor faria.
  const auditoria: RegistroAuditoria[] = semId
    .sort((a, b) => a.ocorridoEm.localeCompare(b.ocorridoEm))
    .map((r, i) => Object.freeze({ id: `aud-${String(i + 1).padStart(4, '0')}`, ...r }))

  return {
    profissionais, responsaveis, professores, escolas, pacientes, vinculosFamiliares,
    planos, sessoes, ocorrenciasComportamentais, ocorrenciasEscolares, atividades,
    execucoes, cartoes, consentimentos, convites, vinculos, auditoria,
  }
}
