import { Controller, Get, Param, Query } from '@nestjs/common'
import { Auditar, Perfis, SemDadoDoPaciente } from '../acesso/metadados.js'
import { lerPaginacao } from '../http/paginacao.js'
import { ServicoIndicadores } from './servico-indicadores.js'

/**
 * Os indicadores da coordenacao (item 19): so a coordenacao. Os demais perfis
 * sao recusados pela marca da rota, nas quatro, e a negativa entra na trilha.
 *
 * Das quatro, so a dos alertas nomeia paciente, e por isso so ela deixa uma
 * linha LEITURA_AUTORIZADA, uma por chamada e sem pacienteId: o alerta aponta,
 * nao descreve. A leitura de cada paciente fica no destino — ficha, plano ou
 * evolucao —, com pacienteId, quando a coordenacao abre o registro. As outras
 * tres so contam, e nao gravam leitura. O motivo vai no detalhe: a coluna
 * idEntidade da trilha e uuid.
 */
@Controller('indicadores')
@Perfis('COORDENADOR')
export class ControladorIndicadores {
  constructor(private readonly indicadores: ServicoIndicadores) {}

  @Get('resumo')
  @SemDadoDoPaciente('Indicadores')
  resumo() {
    return this.indicadores.resumo()
  }

  @Get('alertas/:motivo')
  @Auditar({
    entidade: 'Indicadores', acao: 'LEITURA_AUTORIZADA',
    detalhe: (req) => `Alertas do painel da coordenação: ${req.params.motivo}.`,
  })
  alertas(@Param('motivo') motivo: string, @Query() query: Record<string, unknown>) {
    return this.indicadores.listarAlertas(motivo, lerPaginacao(query))
  }

  @Get('sessoes-por-profissional')
  @SemDadoDoPaciente('Indicadores')
  sessoesPorProfissional() {
    return this.indicadores.sessoesPorProfissional()
  }

  @Get('ponte-escola')
  @SemDadoDoPaciente('Indicadores')
  ponteEscola() {
    return this.indicadores.ponteEscola()
  }
}
