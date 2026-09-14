import type {
  AtividadeCasa, CartaoEstrategia, Consentimento, Objetivo, Paciente, Sessao,
} from '../tipos/dominio'

/**
 * Dados ficticios para demonstracao. Nenhuma informacao de pessoa real.
 * Enquanto nao existe API, estes objetos alimentam a interface.
 */

export const paciente: Paciente = {
  id: 'p-001',
  nome: 'Miguel Santana',
  dataNascimento: '2019-03-12',
  nivelSuporte: 2,
}

export const objetivos: Objetivo[] = [
  {
    id: 'o-001',
    dominio: 'Comunicacao funcional',
    descricaoTecnica:
      'Emitir mando por item preferido em 8 de 10 tentativas, com ajuda gestual desvanecida.',
    descricaoAcessivel:
      'Pedir o que quer, apontando ou falando, sem precisar que o adulto ajude.',
    status: 'EM_AQUISICAO',
    percentualAtual: 65,
    criterio: { percentualMinimo: 80, sessoesConsecutivas: 3 },
  },
  {
    id: 'o-002',
    dominio: 'Regulacao sensorial',
    descricaoTecnica:
      'Solicitar pausa regulatoria diante de estimulo auditivo aversivo, com apoio visual.',
    descricaoAcessivel:
      'Avisar quando o barulho esta incomodando e pedir um tempo em um lugar calmo.',
    status: 'EM_AQUISICAO',
    percentualAtual: 42,
    criterio: { percentualMinimo: 80, sessoesConsecutivas: 3 },
  },
  {
    id: 'o-003',
    dominio: 'Transicao entre atividades',
    descricaoTecnica:
      'Encerrar atividade em curso apos aviso antecedente de 5 minutos, sem esquiva.',
    descricaoAcessivel:
      'Guardar o que esta fazendo quando avisam que falta pouco para terminar.',
    status: 'DOMINADO',
    percentualAtual: 92,
    criterio: { percentualMinimo: 80, sessoesConsecutivas: 3 },
  },
]

export const sessoes: Sessao[] = [
  { id: 's1', numero: 1, data: '04/08', percentualIndependente: 30 },
  { id: 's2', numero: 2, data: '07/08', percentualIndependente: 45 },
  { id: 's3', numero: 3, data: '11/08', percentualIndependente: 40 },
  { id: 's4', numero: 4, data: '14/08', percentualIndependente: 55 },
  { id: 's5', numero: 5, data: '18/08', percentualIndependente: 60 },
  { id: 's6', numero: 6, data: '21/08', percentualIndependente: 55 },
  { id: 's7', numero: 7, data: '25/08', percentualIndependente: 70 },
  { id: 's8', numero: 8, data: '28/08', percentualIndependente: 75 },
  { id: 's9', numero: 9, data: '01/09', percentualIndependente: 82 },
  { id: 's10', numero: 10, data: '08/09', percentualIndependente: 85 },
]

export const cartao: CartaoEstrategia = {
  oQueFazer: [
    'Avise 5 minutos antes de mudar de atividade.',
    'Use o quadro de rotina: ele se organiza melhor vendo a sequencia.',
    'Se ele apontar para o cartao do tempo calmo, permita a pausa na hora.',
  ],
  oQueEvitar: [
    'Nao insista no contato visual para confirmar que ele entendeu.',
    'Nao repita o mesmo comando mais de duas vezes seguidas.',
    'Nao retire a pausa como forma de correcao.',
  ],
  sinalAlerta:
    'Tapar os ouvidos e afastar-se do grupo costuma indicar sobrecarga sensorial, nao recusa. Ofereca o canto calmo antes de insistir na tarefa.',
}

export const atividades: AtividadeCasa[] = [
  { id: 'a1', titulo: 'Escolher o lanche apontando', frequenciaSemanal: 3, passos: [], urlVideo: null, feita: true },
  { id: 'a2', titulo: 'Pedir ajuda para abrir a embalagem', frequenciaSemanal: 2, passos: [], urlVideo: null, feita: true },
  {
    id: 'a3',
    titulo: 'Avisar quando o barulho incomoda',
    frequenciaSemanal: 2,
    passos: [
      'Deixe o cartao do tempo calmo em um lugar que ele alcance.',
      'Quando comecar um barulho forte, liquidificador ou aspirador, mostre o cartao.',
      'Se ele apontar ou pedir, leve-o ao canto calmo na hora. Isso ensina que avisar funciona.',
    ],
    urlVideo: null,
    feita: false,
  },
]

export const consentimento: Consentimento = {
  escopos: ['CARTAO_ESTRATEGIA', 'REGISTRO_OCORRENCIA'],
  validadeAte: '2026-12-31',
  ativo: true,
  professor: 'Carla Nunes',
  escola: 'EMEF Jardim das Palmeiras',
  concedidoEm: '02/09/2026',
}
