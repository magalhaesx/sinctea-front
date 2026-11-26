import { Controller, Get, Param, Req } from '@nestjs/common'
import type { TrilhaAutonomia } from '@sinctea/compartilhado'
import { detalheDaTrilha } from '@sinctea/compartilhado/dominio/trilha'
import { Auditar, Perfis } from '../acesso/metadados.js'
import type { RequisicaoHttp } from '../http/tipos-http.js'
import { ServicoTrilha } from './servico-trilha.js'

const sessaoDe = (req: RequisicaoHttp) => req.sinctea!.sessao!
const LEITURA = {
  entidade: 'TrilhaAutonomia', acao: 'LEITURA_AUTORIZADA', pacienteId: { parametro: 'id' },
  // Quanto a trilha mostrou, e nunca o texto.
  detalhe: (_q: unknown, r: unknown) => detalheDaTrilha(r as TrilhaAutonomia),
} as const

/**
 * A trilha de autonomia (item 24), pelas duas portas, com a mesma resposta: a
 * da clinica, para a equipe do paciente e a coordenacao, e a da familia, para
 * qualquer responsavel vinculado. A escola, a administracao e quem nao tem
 * vinculo sao recusados — pela marca da rota ou pelo alcance —, e a negativa
 * entra na trilha de auditoria com o paciente. Cada leitura deixa uma linha
 * LEITURA_AUTORIZADA, tambem com o paciente.
 */
@Controller()
export class ControladorTrilha {
  constructor(private readonly trilha: ServicoTrilha) {}

  @Get('pacientes/:id/trilha')
  @Perfis('TERAPEUTA', 'COORDENADOR')
  @Auditar(LEITURA)
  daClinica(@Req() req: RequisicaoHttp, @Param('id') id: string) {
    return this.trilha.daClinica(sessaoDe(req), id)
  }

  @Get('familia/filhos/:id/trilha')
  @Perfis('RESPONSAVEL')
  @Auditar(LEITURA)
  daFamilia(@Req() req: RequisicaoHttp, @Param('id') id: string) {
    return this.trilha.daFamilia(sessaoDe(req), id)
  }
}
