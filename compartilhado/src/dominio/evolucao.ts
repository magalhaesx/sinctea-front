import type {
  AtividadeCasa, CriterioDominio, EvolucaoObjetivo, ExecucaoAtividadeCasa, OcorrenciaComportamental, Sessao,
} from '../tipos.js'
import { objetivoAtingiuCriterio, percentualIndependente } from './regras.js'

/**
 * A evolucao de um objetivo nos tres contextos (tela 8, item 16), a mesma no
 * mock e no servidor. Recebe o que o paciente tem e escolhe o que e deste
 * objetivo; devolve so datas e medidas, nunca texto livre.
 *
 * - Clinica: uma entrada por sessao ENCERRADA em que o objetivo foi
 *   trabalhado, em ordem de numero. Sessao em andamento ainda pode mudar;
 *   sessao sem tentativa do objetivo nao diz nada sobre ele.
 * - Casa: as execucoes das atividades deste objetivo, ativas e encerradas: o
 *   que a familia fez continua valendo depois que a atividade sai da lista.
 * - Escola: as ocorrencias de origem ESCOLA do paciente. A escola nao registra
 *   por objetivo, e a ocorrencia da clinica ja esta na sessao.
 */
export interface EntradaEvolucao {
  objetivo: { id: string; criterio: CriterioDominio }
  sessoes: Array<Pick<Sessao, 'id' | 'numero' | 'situacao' | 'inicio' | 'inicioPrevistoEm' | 'registros'>>
  atividades: Array<Pick<AtividadeCasa, 'id' | 'objetivoId'>>
  execucoes: Array<Pick<ExecucaoAtividadeCasa, 'atividadeId' | 'dataRealizacao' | 'desempenho'>>
  ocorrencias: Array<Pick<OcorrenciaComportamental, 'origem' | 'ocorridaEm' | 'intensidade'>>
}

export function montarEvolucao({ objetivo, sessoes, atividades, execucoes, ocorrencias }: EntradaEvolucao): EvolucaoObjetivo {
  const clinica = sessoes
    .filter((s) => s.situacao === 'ENCERRADA')
    .sort((a, b) => a.numero - b.numero)
    .flatMap((s) => {
      const percentual = percentualIndependente(s.registros, objetivo.id)
      return percentual === null
        ? []
        : [{ sessaoId: s.id, numero: s.numero, data: s.inicio ?? s.inicioPrevistoEm, percentual }]
    })

  const doObjetivo = new Set(atividades.filter((a) => a.objetivoId === objetivo.id).map((a) => a.id))
  const casa = execucoes
    .filter((e) => doObjetivo.has(e.atividadeId))
    .map((e) => ({ data: e.dataRealizacao, desempenho: e.desempenho }))
    .sort((a, b) => a.data.localeCompare(b.data))

  const escola = ocorrencias
    .filter((o) => o.origem === 'ESCOLA')
    .map((o) => ({ data: o.ocorridaEm, intensidade: o.intensidade }))
    .sort((a, b) => Date.parse(a.data) - Date.parse(b.data))

  return { clinica, casa, escola, atingiuCriterio: objetivoAtingiuCriterio(sessoes, objetivo.id, objetivo.criterio) }
}
