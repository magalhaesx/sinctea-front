/**
 * Dados ficticios que restam para as DUAS telas da familia ainda nao ligadas
 * aos servicos: o painel (tela 15) e a atividade em casa (tela 16). A etapa 8
 * do roteiro liga as duas a camada de dados e apaga este arquivo.
 *
 * Os tipos sao declarados AQUI, e de proposito: sao a forma que estas telas
 * consomem hoje, nao o modelo do sistema. O modelo vive em servicos/tipos.ts,
 * espelhando o diagrama de classes.
 *
 * Nenhuma informacao de pessoa real, aqui ou em qualquer outro lugar.
 */

interface AtividadeDaTela {
  id: string
  titulo: string
  frequenciaSemanal: number
  passos: string[]
  urlVideo: string | null
  feita: boolean
}

interface ConsentimentoDaTela {
  escopos: ('CARTAO_ESTRATEGIA' | 'REGISTRO_OCORRENCIA')[]
  validadeAte: string
  ativo: boolean
  professor: string
  escola: string
  concedidoEm: string
}

export const atividades: AtividadeDaTela[] = [
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

export const consentimento: ConsentimentoDaTela = {
  escopos: ['CARTAO_ESTRATEGIA', 'REGISTRO_OCORRENCIA'],
  validadeAte: '2026-12-31',
  ativo: true,
  professor: 'Carla Nunes',
  escola: 'EMEF Jardim das Palmeiras',
  concedidoEm: '02/09/2026',
}
