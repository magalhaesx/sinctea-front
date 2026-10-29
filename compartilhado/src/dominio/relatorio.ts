import {
  ErroServico, type ConteudoRelatorio, type DataCivil, type Destinatario, type Objetivo, type ObjetivoNoRelatorio,
  type PedidoRelatorio, type Sessao, type SituacaoPlano,
} from '../tipos.js'
import { diaCivilEm, partesDaDataCivil } from './datas.js'
import { percentualIndependente, textoDoCriterio, textoDoPeriodo } from './regras.js'

/**
 * O relatorio de evolucao (UC09, tela 10; item 18): a validacao do pedido e a
 * montagem do conteudo, as mesmas no mock, no servidor e na semente. Antes,
 * cada um tinha a sua copia.
 *
 * O conteudo so traz os objetivos do plano VIGENTE: o rascunho e o plano em
 * validacao ainda podem mudar, e o documento emitido nao muda nunca. As
 * consideracoes sao a leitura de quem assina: obrigatorias ao emitir, e nunca
 * geradas (regra 4).
 */

export const CONSIDERACOES_MAXIMO = 4_000

export const SEM_PLANO_VIGENTE = 'Para emitir, o paciente precisa de um plano vigente.'
export const SEM_REGISTRO_NO_CONSELHO =
  'Complete o seu registro no conselho em Perfil e preferências antes de emitir um relatório.'
export const OBJETIVO_FORA_DO_PLANO = 'Um dos objetivos escolhidos não é do plano vigente deste paciente.'
export const CONSIDERACOES_OBRIGATORIAS =
  'O relatório é a sua leitura clínica, não só os números. Escreva as suas considerações — elas não são geradas pelo sistema.'

const DESTINATARIOS: readonly Destinatario[] = ['PROFISSIONAIS', 'FAMILIA']

/**
 * O pedido, igual na tela, no mock e no servidor. O periodo e de dias civis
 * de Manaus: o fim nao vem antes do inicio nem passa de hoje. A previa aceita
 * consideracoes ainda vazias; a emissao, nao.
 */
export function validarPedidoRelatorio(
  pedido: PedidoRelatorio, hoje: DataCivil, opcoes: { emitir: boolean },
): Record<string, string> {
  const erros: Record<string, string> = {}
  const inicio = typeof pedido.periodoInicio === 'string' ? pedido.periodoInicio : ''
  const fim = typeof pedido.periodoFim === 'string' ? pedido.periodoFim : ''
  if (!partesDaDataCivil(inicio) || !partesDaDataCivil(fim)) erros.periodo = 'Escolha o período do relatório.'
  else if (fim < inicio) erros.periodo = 'O fim do período não pode ser anterior ao início.'
  else if (fim > hoje) erros.periodo = 'O período não pode passar de hoje.'
  if (!Array.isArray(pedido.objetivoIds) || pedido.objetivoIds.length === 0) {
    erros.objetivoIds = 'Escolha ao menos um objetivo para o relatório.'
  } else if (pedido.objetivoIds.some((id) => typeof id !== 'string' || id === '')) {
    erros.objetivoIds = OBJETIVO_FORA_DO_PLANO
  }
  if (!DESTINATARIOS.includes(pedido.destinatario)) erros.destinatario = 'Escolha para quem é o relatório.'
  const consideracoes = typeof pedido.consideracoes === 'string' ? pedido.consideracoes.trim() : ''
  if (opcoes.emitir && !consideracoes) erros.consideracoes = CONSIDERACOES_OBRIGATORIAS
  else if (consideracoes.length > CONSIDERACOES_MAXIMO) {
    erros.consideracoes = `As considerações podem ter no máximo ${CONSIDERACOES_MAXIMO.toLocaleString('pt-BR')} caracteres.`
  }
  return erros
}

export interface EntradaRelatorio {
  paciente: { id: string; nome: string; dataNascimento: DataCivil }
  /** O plano do paciente, se houver; so o VIGENTE entra no documento. */
  plano: { status: SituacaoPlano; objetivos: Objetivo[] } | null
  /** As sessoes do paciente; a montagem escolhe as encerradas do periodo. */
  sessoes: Array<Pick<Sessao, 'numero' | 'situacao' | 'inicio' | 'registros'>>
  pedido: PedidoRelatorio
}

/**
 * O documento como ele sai. A sessao conta no dia de Manaus em que comecou: a
 * das 21h do ultimo dia ja e o dia seguinte em UTC, e cairia fora.
 *
 * Os numeros e a redacao mudam de lingua com o destinatario: a equipe le a
 * redacao tecnica e percentual; a familia, a acessivel e numeros em palavras.
 */
export function montarConteudoRelatorio({ paciente, plano, sessoes, pedido }: EntradaRelatorio): ConteudoRelatorio {
  if (!plano || plano.status !== 'VIGENTE') throw new ErroServico('CONFLITO', SEM_PLANO_VIGENTE)
  const doPeriodo = sessoes
    .filter((s) => s.situacao === 'ENCERRADA' && s.inicio)
    .filter((s) => {
      const dia = diaCivilEm(new Date(s.inicio!))
      return dia >= pedido.periodoInicio && dia <= pedido.periodoFim
    })
    .sort((a, b) => a.numero - b.numero)

  const objetivos: ObjetivoNoRelatorio[] = pedido.objetivoIds.map((objetivoId) => {
    const objetivo = plano.objetivos.find((o) => o.id === objetivoId)
    if (!objetivo) throw new ErroServico('VALIDACAO', OBJETIVO_FORA_DO_PLANO, { objetivoIds: OBJETIVO_FORA_DO_PLANO })
    const percentuais = doPeriodo
      .map((s) => percentualIndependente(s.registros, objetivoId))
      .filter((p): p is number => p !== null)
    return {
      objetivoId,
      dominio: objetivo.dominio,
      // Regra 4: a equipe le a tecnica, a familia le a acessivel.
      redacao: pedido.destinatario === 'FAMILIA' ? objetivo.descricaoAcessivel : objetivo.descricaoTecnica,
      criterioTexto: textoDoCriterio(objetivo.criterio, pedido.destinatario),
      sessoesNoPeriodo: percentuais.length,
      periodoTexto: textoDoPeriodo(percentuais, pedido.destinatario),
      status: objetivo.status,
      dominadoEm: objetivo.dominadoEm,
    }
  })

  return {
    paciente: { id: paciente.id, nome: paciente.nome, dataNascimento: paciente.dataNascimento },
    periodoInicio: pedido.periodoInicio,
    periodoFim: pedido.periodoFim,
    destinatario: pedido.destinatario,
    consideracoes: pedido.consideracoes.trim(),
    objetivos,
    sessoesNoPeriodo: doPeriodo.length,
  }
}
