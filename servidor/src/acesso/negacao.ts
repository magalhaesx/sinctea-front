import { ErroServico, type MotivoNegativa } from '@sinctea/compartilhado'

/**
 * ACESSO_NEGADO com o que a trilha precisa saber: de que paciente era o dado
 * e por que a pessoa nao alcanca. O filtro de erros registra a negativa com
 * isto — mesmo quando a rota chega pelo plano, pelo objetivo ou pela sessao, e
 * o paciente nao esta no endereco.
 */
export class Negacao extends ErroServico {
  constructor(
    mensagem: string,
    readonly alvo: { pacienteId?: string | null; detalhe?: string } = {},
    motivo?: MotivoNegativa,
  ) {
    super('ACESSO_NEGADO', mensagem, {}, motivo)
  }
}

export const SEM_PERMISSAO = 'Você não tem permissão para acessar esta informação.'
