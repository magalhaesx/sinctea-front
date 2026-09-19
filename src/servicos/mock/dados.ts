import type {
  AtividadeCasa, CartaoEstrategia, Consentimento, Escola, ExecucaoAtividadeCasa, Intensidade,
  Objetivo, OcorrenciaComportamental, OcorrenciaEscolar, Paciente, PlanoTerapeutico,
  ProfessorAEE, Profissional, RegistroAtividade, RegistroAuditoria, Responsavel, Resultado,
  Sessao, VinculoEscolar,
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
  planos: PlanoTerapeutico[]
  sessoes: Sessao[]
  ocorrenciasComportamentais: OcorrenciaComportamental[]
  ocorrenciasEscolares: OcorrenciaEscolar[]
  atividades: AtividadeCasa[]
  execucoes: ExecucaoAtividadeCasa[]
  cartoes: CartaoEstrategia[]
  consentimentos: Consentimento[]
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
  ]

  // ------------------------------------------------------------ Escolas

  const escolas: Escola[] = [
    { id: 'esc-1', nome: 'EMEF Jardim das Palmeiras', municipio: 'Manaus' },
    { id: 'esc-2', nome: 'Escola Municipal Vitória-Régia', municipio: 'Manaus' },
  ]

  const professores: ProfessorAEE[] = [
    { tipo: 'PROFESSOR_AEE', id: 'u-profe-1', nome: 'Carla Nunes', email: 'carla.nunes@escola.example',
      perfis: ['PROFESSOR'], ativo: true, ultimoAcessoEm: em(0, 9), escolaId: 'esc-1' },
    { tipo: 'PROFESSOR_AEE', id: 'u-profe-2', nome: 'Tiago Rezende', email: 'tiago.rezende@escola.example',
      perfis: ['PROFESSOR'], ativo: true, ultimoAcessoEm: em(4, 10), escolaId: 'esc-2' },
  ]

  // ------------------------------------------------------------ Pacientes

  const pacientes: Paciente[] = [
    { id: 'p-001', nome: 'Miguel Santana', dataNascimento: '2019-03-12', nivelSuporte: 2,
      profissionalResponsavelId: 'u-prof-1', equipeIds: ['u-prof-1', 'u-prof-3'], ativo: true,
      responsaveis: [{ responsavelId: 'u-resp-1', parentesco: 'Mãe', responsavelLegal: true }] },
    { id: 'p-002', nome: 'Sofia Santana', dataNascimento: '2021-07-02', nivelSuporte: 1,
      profissionalResponsavelId: 'u-prof-2', equipeIds: ['u-prof-2'], ativo: true,
      responsaveis: [{ responsavelId: 'u-resp-1', parentesco: 'Mãe', responsavelLegal: true }] },
    { id: 'p-003', nome: 'Davi Farias', dataNascimento: '2017-11-23', nivelSuporte: 3,
      profissionalResponsavelId: 'u-prof-1', equipeIds: ['u-prof-1', 'u-prof-2'], ativo: true,
      responsaveis: [{ responsavelId: 'u-resp-2', parentesco: 'Pai', responsavelLegal: true }] },
    { id: 'p-004', nome: 'Heitor Brandão', dataNascimento: '2020-01-30', nivelSuporte: 2,
      profissionalResponsavelId: 'u-prof-3', equipeIds: ['u-prof-3', 'u-prof-1'], ativo: true,
      responsaveis: [{ responsavelId: 'u-resp-3', parentesco: 'Mãe', responsavelLegal: true }] },
    { id: 'p-005', nome: 'Laura Reis', dataNascimento: '2018-05-14', nivelSuporte: 1,
      profissionalResponsavelId: 'u-prof-2', equipeIds: ['u-prof-2', 'u-prof-3'], ativo: true,
      responsaveis: [{ responsavelId: 'u-resp-4', parentesco: 'Avô', responsavelLegal: true }] },
  ]

  // ------------------------------------------------------------ Planos e objetivos

  const criterioPadrao = { percentualMinimo: 80, sessoesConsecutivas: 3 }
  const objetivo = (id: string, planoId: string, dominio: string, descricaoTecnica: string,
    descricaoAcessivel: string, status: Objetivo['status'], percentualAtual: number): Objetivo =>
    ({ id, planoId, dominio, descricaoTecnica, descricaoAcessivel, status, percentualAtual, criterio: { ...criterioPadrao } })

  const planos: PlanoTerapeutico[] = [
    {
      id: 'pl-001', pacienteId: 'p-001', autorId: 'u-prof-1', situacao: 'VIGENTE',
      inicioEm: em(120, 9), revisaoPrevistaEm: em(-60, 9), ultimaRevisaoEm: em(30, 9), observacaoValidacao: null,
      objetivos: [
        objetivo('o-001', 'pl-001', 'Comunicação funcional',
          'Emitir mando por item preferido em 8 de 10 tentativas, com ajuda gestual desvanecida.',
          'Pedir o que quer, apontando ou falando, sem precisar que o adulto ajude.', 'EM_AQUISICAO', 85),
        objetivo('o-002', 'pl-001', 'Regulação sensorial',
          'Solicitar pausa regulatória diante de estímulo auditivo aversivo, com apoio visual.',
          'Avisar quando o barulho está incomodando e pedir um tempo em um lugar calmo.', 'EM_AQUISICAO', 40),
        objetivo('o-003', 'pl-001', 'Transição entre atividades',
          'Encerrar atividade em curso após aviso antecedente de 5 minutos, sem esquiva.',
          'Guardar o que está fazendo quando avisam que falta pouco para terminar.', 'DOMINADO', 90),
      ],
    },
    {
      id: 'pl-002', pacienteId: 'p-002', autorId: 'u-prof-2', situacao: 'AGUARDANDO_VALIDACAO',
      inicioEm: em(5, 9), revisaoPrevistaEm: em(-85, 9), ultimaRevisaoEm: null, observacaoValidacao: null,
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
      id: 'pl-003', pacienteId: 'p-003', autorId: 'u-prof-1', situacao: 'VIGENTE',
      inicioEm: em(200, 9), revisaoPrevistaEm: em(10, 9), ultimaRevisaoEm: em(100, 9), observacaoValidacao: null,
      objetivos: [
        objetivo('o-006', 'pl-003', 'Comunicação alternativa',
          'Selecionar pictograma correspondente ao item desejado em prancha de 4 opções, com ajuda física parcial.',
          'Escolher na prancha a figura do que ele quer.', 'EM_AQUISICAO', 50),
        objetivo('o-007', 'pl-003', 'Autocuidado',
          'Executar sequência de lavagem das mãos em 6 etapas com apoio de agenda visual.',
          'Lavar as mãos seguindo os desenhos do passo a passo.', 'EM_AQUISICAO', 60),
      ],
    },
    {
      id: 'pl-004', pacienteId: 'p-004', autorId: 'u-prof-3', situacao: 'VIGENTE',
      inicioEm: em(60, 9), revisaoPrevistaEm: em(-30, 9), ultimaRevisaoEm: null, observacaoValidacao: null,
      objetivos: [
        objetivo('o-008', 'pl-004', 'Tolerância à espera',
          'Aguardar a vez em atividade de mesa por até 2 minutos com temporizador visual.',
          'Esperar a vez olhando o relógio de areia, sem sair da mesa.', 'EM_AQUISICAO', 70),
      ],
    },
    {
      id: 'pl-005', pacienteId: 'p-005', autorId: 'u-prof-2', situacao: 'DEVOLVIDO',
      inicioEm: em(12, 9), revisaoPrevistaEm: em(-78, 9), ultimaRevisaoEm: null,
      observacaoValidacao: 'O critério do objetivo de interação está sem número de sessões. Rever antes de reenviar.',
      objetivos: [
        objetivo('o-009', 'pl-005', 'Interação com pares',
          'Iniciar interação com par em atividade livre, com mediação do adulto.',
          'Chamar um colega para brincar junto, com ajuda de um adulto.', 'NAO_INICIADO', 0),
      ],
    },
  ]

  // ------------------------------------------------------------ Sessoes

  const erros: Resultado[] = ['AJUDA_GESTUAL', 'AJUDA_FISICA', 'SEM_RESPOSTA']
  /** Dez tentativas do objetivo; `percentual` define quantas foram independentes. */
  const tentativas = (sessaoId: string, objetivoId: string, percentual: number, quando: string): RegistroAtividade[] => {
    const independentes = Math.round(percentual / 10)
    return Array.from({ length: 10 }, (_, i) => ({
      id: `${sessaoId}-${objetivoId}-${i + 1}`,
      objetivoId,
      resultado: i < independentes ? 'INDEPENDENTE' : erros[i % erros.length],
      registradoEm: new Date(Date.parse(quando) + (i + 1) * 90_000).toISOString(),
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
      inicioPrevistoEm: inicio, iniciadaEm: inicio,
      encerradaEm: new Date(Date.parse(inicio) + 50 * 60_000).toISOString(),
      situacao: 'ENCERRADA',
      registros: Object.entries(porObjetivo).flatMap(([obj, p]) => tentativas(id, obj, p, inicio)),
    })
  }

  // Miguel: duas sessoes por semana; o-001 sobe ate atingir o criterio.
  const evolucaoMiguel = [30, 45, 40, 55, 60, 55, 70, 80, 82, 85]
  const regulacaoMiguel = [20, 20, 30, 30, 40, 30, 40, 40, 50, 40]
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

  // Agenda de hoje.
  const agendada = (id: string, pacienteId: string, profissionalId: string, hora: number, minuto = 0) => {
    const numero = sessoes.filter((s) => s.pacienteId === pacienteId).length + 1
    sessoes.push({
      id, pacienteId, profissionalId, numero,
      inicioPrevistoEm: em(0, hora, minuto), iniciadaEm: null, encerradaEm: null,
      situacao: 'AGENDADA', registros: [],
    })
  }
  agendada('s-hoje-1', 'p-001', 'u-prof-1', 8)
  agendada('s-hoje-2', 'p-003', 'u-prof-1', 9, 30)
  agendada('s-hoje-3', 'p-004', 'u-prof-1', 14)
  agendada('s-hoje-4', 'p-002', 'u-prof-2', 10)
  agendada('s-hoje-5', 'p-004', 'u-prof-3', 16)

  // ------------------------------------------------------------ Consentimentos e vinculos

  const consentimento = (id: string, responsavelId: string, pacienteId: string,
    escopos: Consentimento['escopos'], concedidoEm: string, validadeAte: string,
    revogadoEm: string | null = null): Consentimento =>
    ({ id, responsavelId, pacienteId, escopos, concedidoEm, validadeAte, revogadoEm })

  const ambos: Consentimento['escopos'] = ['CARTAO_ESTRATEGIA', 'REGISTRO_OCORRENCIA']
  const consentimentos: Consentimento[] = [
    // Vigente, com os dois escopos: a demonstracao principal da area da escola.
    consentimento('c-001', 'u-resp-1', 'p-001', ambos, em(45, 19), em(-120, 23, 59)),
    // Vigente so para o cartao, vencendo em menos de 30 dias.
    consentimento('c-002', 'u-resp-2', 'p-003', ['CARTAO_ESTRATEGIA'], em(40, 20), em(-20, 23, 59)),
    // Revogado ha 3 dias: a professora continua tentando e e negada.
    consentimento('c-003', 'u-resp-3', 'p-004', ambos, em(50, 18), em(-100, 23, 59), em(3, 21)),
    // Expirado.
    consentimento('c-004', 'u-resp-4', 'p-005', ['CARTAO_ESTRATEGIA'], em(200, 18), em(5, 23, 59)),
    // Os tres a seguir servem aos estados do convite (tela 2).
    consentimento('c-005', 'u-resp-1', 'p-002', ambos, horasAtras(1), em(-90, 23, 59)),
    consentimento('c-006', 'u-resp-1', 'p-002', ['CARTAO_ESTRATEGIA'], em(5, 10), em(-90, 23, 59)),
    consentimento('c-007', 'u-resp-4', 'p-005', ambos, em(1, 10), em(-90, 23, 59), horasAtras(2)),
  ]

  const vinculo = (id: string, c: Consentimento, escolaId: string, professorId: string | null,
    token: string, usadoEm: string | null): VinculoEscolar => ({
    id, consentimentoId: c.id, pacienteId: c.pacienteId, escolaId, professorId,
    tokenConvite: token, conviteCriadoEm: c.concedidoEm,
    conviteExpiraEm: calcularExpiracaoConvite(new Date(c.concedidoEm)).toISOString(),
    conviteUsadoEm: usadoEm,
  })
  const [c1, c2, c3, c4, c5, c6, c7] = consentimentos
  const depoisDe = (iso: string, horas: number) => new Date(Date.parse(iso) + horas * 3_600_000).toISOString()

  const vinculos: VinculoEscolar[] = [
    vinculo('v-001', c1, 'esc-1', 'u-profe-1', 'demo-convite-usado', depoisDe(c1.concedidoEm, 14)),
    vinculo('v-002', c2, 'esc-2', 'u-profe-2', 'demo-convite-davi', depoisDe(c2.concedidoEm, 20)),
    vinculo('v-003', c3, 'esc-1', 'u-profe-1', 'demo-convite-heitor', depoisDe(c3.concedidoEm, 16)),
    vinculo('v-004', c4, 'esc-2', 'u-profe-2', 'demo-convite-laura', depoisDe(c4.concedidoEm, 30)),
    vinculo('v-005', c5, 'esc-1', null, 'demo-convite-valido', null),
    vinculo('v-006', c6, 'esc-2', null, 'demo-convite-expirado', null),
    vinculo('v-007', c7, 'esc-1', null, 'demo-convite-revogado', null),
  ]

  // ------------------------------------------------------------ Cartoes de estrategia

  const cartoes: CartaoEstrategia[] = [
    {
      id: 'ce-001', objetivoId: 'o-002', atualizadoEm: em(12, 11),
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
      oQueFazer: ['Mostre o relógio de areia antes de pedir que ele espere.'],
      oQueEvitar: ['Não aumente o tempo de espera sem avisar.'],
      sinalAlerta: 'Levantar da cadeira repetidas vezes costuma indicar que a espera ficou longa demais.',
    },
  ]

  // ------------------------------------------------------------ Ocorrencias

  const ocorrenciasEscolares: OcorrenciaEscolar[] = []
  const ocorrenciasComportamentais: OcorrenciaComportamental[] = []
  const ocorrenciaEscolar = (id: string, v: VinculoEscolar, registradaEm: string, oQueAconteceu: string,
    intensidade: Intensidade, momento: string, observacao = '') => {
    ocorrenciasEscolares.push({
      id, vinculoId: v.id, pacienteId: v.pacienteId, professorId: v.professorId!, registradaEm,
      corrigidaEm: null, oQueAconteceu, intensidade, momento, observacao,
    })
    // «gera»: a ocorrencia da escola entra na clinica como evento preliminar.
    ocorrenciasComportamentais.push({
      id: `oc-${id}`, pacienteId: v.pacienteId, origem: 'ESCOLA', ocorridaEm: registradaEm,
      antecedente: `Momento: ${momento}`, comportamento: oQueAconteceu,
      consequencia: observacao || 'Não informado pela escola.', intensidade,
      preliminar: true, sessaoId: null, ocorrenciaEscolarId: id,
    })
  }
  const [v1] = vinculos
  ocorrenciaEscolar('oe-001', v1, em(30, 10, 15), 'Tapou os ouvidos', 4, 'Recreio', 'Foi levado ao canto calmo e voltou em 10 minutos.')
  ocorrenciaEscolar('oe-002', v1, em(24, 9, 40), 'Saiu da sala', 3, 'Troca de atividade')
  ocorrenciaEscolar('oe-003', v1, em(17, 10, 5), 'Tapou os ouvidos', 3, 'Atividade em grupo')
  ocorrenciaEscolar('oe-004', v1, em(10, 11, 20), 'Recusou a tarefa', 2, 'Troca de atividade', 'Aceitou depois de ver o quadro de rotina.')
  ocorrenciaEscolar('oe-005', v1, em(3, 10, 0), 'Tapou os ouvidos', 2, 'Recreio')
  ocorrenciaEscolar('oe-006', v1, horasAtras(3), 'Chorou', 3, 'Entrada', 'Acalmou com a chegada da auxiliar.')

  const sessaoMiguel = sessoes.find((s) => s.pacienteId === 'p-001' && s.numero === 7)!
  ocorrenciasComportamentais.push({
    id: 'oc-clin-001', pacienteId: 'p-001', origem: 'CLINICA', ocorridaEm: sessaoMiguel.iniciadaEm!,
    antecedente: 'Liquidificador ligado na sala ao lado.', comportamento: 'Tapou os ouvidos e deitou no chão.',
    consequencia: 'Ofertado abafador e pausa de 3 minutos; retomou a atividade.', intensidade: 3,
    preliminar: false, sessaoId: sessaoMiguel.id, ocorrenciaEscolarId: null,
  })

  // ------------------------------------------------------------ Atividades em casa

  const atividades: AtividadeCasa[] = [
    { id: 'a-001', pacienteId: 'p-001', objetivoId: 'o-001', titulo: 'Escolher o lanche apontando',
      descricao: 'Na hora do lanche, mostre duas opções e espere ele apontar ou pedir.',
      passos: ['Mostre duas opções de lanche, uma em cada mão.', 'Espere alguns segundos sem falar.', 'Entregue o que ele apontar ou pedir.'],
      frequenciaSemanal: 3, urlVideo: null, ativa: true, prescritaEm: em(35, 11) },
    { id: 'a-002', pacienteId: 'p-001', objetivoId: 'o-001', titulo: 'Pedir ajuda para abrir a embalagem',
      descricao: 'Entregue o pacote fechado e espere ele pedir ajuda.',
      passos: ['Entregue a embalagem fechada.', 'Espere ele olhar para você ou pedir.', 'Abra junto com ele.'],
      frequenciaSemanal: 2, urlVideo: null, ativa: true, prescritaEm: em(35, 11) },
    { id: 'a-003', pacienteId: 'p-001', objetivoId: 'o-002', titulo: 'Avisar quando o barulho incomoda',
      descricao: 'Ensina que avisar funciona: quando ele pede, a pausa acontece.',
      passos: [
        'Deixe o cartão do tempo calmo em um lugar que ele alcance.',
        'Quando começar um barulho forte, liquidificador ou aspirador, mostre o cartão.',
        'Se ele apontar ou pedir, leve-o ao canto calmo na hora. Isso ensina que avisar funciona.',
      ],
      frequenciaSemanal: 2, urlVideo: null, ativa: true, prescritaEm: em(28, 11) },
    { id: 'a-004', pacienteId: 'p-003', objetivoId: 'o-007', titulo: 'Lavar as mãos com o passo a passo',
      descricao: 'Cole os desenhos perto da pia e acompanhe a sequência junto com ele.',
      passos: ['Cole os seis desenhos na parede da pia.', 'Aponte cada desenho antes de fazer.', 'Comemore quando terminar.'],
      frequenciaSemanal: 5, urlVideo: null, ativa: true, prescritaEm: em(30, 11) },
  ]

  const execucoes: ExecucaoAtividadeCasa[] = []
  const desempenhos: ExecucaoAtividadeCasa['desempenho'][] = ['COM_AJUDA', 'COM_AJUDA', 'NAO_QUIS', 'COM_AJUDA', 'SOZINHO', 'SOZINHO', 'SOZINHO']
  ;[31, 27, 24, 20, 13, 9, 4].forEach((d, i) =>
    execucoes.push({ id: `ex-${i + 1}`, atividadeId: 'a-001', responsavelId: 'u-resp-1',
      realizadaEm: em(d, 12), desempenho: desempenhos[i], observacao: null }))
  ;[22, 15, 8].forEach((d, i) =>
    execucoes.push({ id: `ex-${i + 8}`, atividadeId: 'a-003', responsavelId: 'u-resp-1',
      realizadaEm: em(d, 18), desempenho: i === 2 ? 'SOZINHO' : 'COM_AJUDA', observacao: null }))
  ;[20, 12, 5].forEach((d, i) =>
    execucoes.push({ id: `ex-${i + 11}`, atividadeId: 'a-004', responsavelId: 'u-resp-2',
      realizadaEm: em(d, 19), desempenho: 'COM_AJUDA', observacao: null }))

  // ------------------------------------------------------------ Auditoria inicial

  const semId: Omit<RegistroAuditoria, 'id'>[] = []
  const auditar = (r: Omit<RegistroAuditoria, 'id'>) => semId.push(r)

  for (const c of consentimentos) {
    const resp = responsaveis.find((r) => r.id === c.responsavelId)!
    auditar({ ocorridoEm: c.concedidoEm, usuarioId: resp.id, usuarioNome: resp.nome, perfil: 'RESPONSAVEL',
      acao: 'CONCESSAO_ACESSO', entidade: 'Consentimento', entidadeId: c.id, pacienteId: c.pacienteId,
      origem: 'FAMILIA', detalhe: `Escopos: ${c.escopos.join(', ')}` })
    if (c.revogadoEm) {
      auditar({ ocorridoEm: c.revogadoEm, usuarioId: resp.id, usuarioNome: resp.nome, perfil: 'RESPONSAVEL',
        acao: 'REVOGACAO_ACESSO', entidade: 'Consentimento', entidadeId: c.id, pacienteId: c.pacienteId,
        origem: 'FAMILIA', detalhe: 'Revogado pelo responsável.' })
    }
  }
  auditar({ ocorridoEm: em(2, 9, 10), usuarioId: 'u-profe-1', usuarioNome: 'Carla Nunes', perfil: 'PROFESSOR',
    acao: 'ACESSO_NEGADO', entidade: 'CartaoEstrategia', entidadeId: null, pacienteId: 'p-004',
    origem: 'ESCOLA', detalhe: 'Consentimento revogado.' })
  // Numeracao em ordem cronologica, como o servidor faria.
  const auditoria: RegistroAuditoria[] = semId
    .sort((a, b) => a.ocorridoEm.localeCompare(b.ocorridoEm))
    .map((r, i) => Object.freeze({ id: `aud-${String(i + 1).padStart(4, '0')}`, ...r }))

  return {
    profissionais, responsaveis, professores, escolas, pacientes, planos, sessoes,
    ocorrenciasComportamentais, ocorrenciasEscolares, atividades, execucoes, cartoes,
    consentimentos, vinculos, auditoria,
  }
}
