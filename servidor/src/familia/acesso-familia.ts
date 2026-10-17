import { ErroServico } from '@sinctea/compartilhado'
import { Negacao, SEM_PERMISSAO } from '../acesso/negacao.js'
import type { ServicoBanco } from '../banco/servico-banco.js'
import type { SessaoServidor } from '../http/tipos-http.js'
import { exigirUuid } from '../http/validacao.js'

/**
 * Acesso da familia, portado de src/servicos/mock/acesso.ts: o responsavel
 * alcanca so os filhos com quem tem VinculoFamiliar. Ampliar o acesso de fora
 * da clinica exige o responsavelLegal do vinculo (regra 1).
 */

export async function exigirPacienteDaFamilia(banco: ServicoBanco, sessao: SessaoServidor, pacienteId: string) {
  const id = exigirUuid(pacienteId, 'Paciente')
  const paciente = await banco.paciente.findUnique({ where: { id } })
  if (!paciente) throw new ErroServico('NAO_ENCONTRADO', 'Paciente não encontrado.')
  const vinculo = sessao.perfilAtivo === 'RESPONSAVEL'
    ? await banco.vinculoFamiliar.findFirst({ where: { pacienteId: id, responsavelId: sessao.usuario.id } })
    : null
  if (!vinculo) throw new Negacao(SEM_PERMISSAO, { pacienteId: id, detalhe: 'Responsável não vinculado ao paciente.' })
  return { paciente, vinculo }
}

/**
 * Regra 1. A autoridade e da relacao, e nao do perfil: a mesma pessoa pode
 * responder legalmente por um filho e nao por outro.
 */
export function exigirResponsavelLegal(vinculo: { responsavelLegal: boolean; pacienteId: string }): void {
  if (!vinculo.responsavelLegal) {
    throw new Negacao('Somente o responsável legal pode autorizar o acesso da escola.', {
      pacienteId: vinculo.pacienteId, detalhe: 'Responsável sem responsabilidade legal pelo paciente.',
    })
  }
}
