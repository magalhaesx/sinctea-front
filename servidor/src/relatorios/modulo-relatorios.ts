import { Module } from '@nestjs/common'
import { ModuloAutenticacao } from '../autenticacao/modulo-autenticacao.js'
import { ControladorRelatorios } from './controlador-relatorios.js'
import { ServicoRelatorios } from './servico-relatorios.js'

/** Relatorio de evolucao: previa, emissao, lista e o emitido (item 18). */
@Module({
  imports: [ModuloAutenticacao],
  controllers: [ControladorRelatorios],
  providers: [ServicoRelatorios],
})
export class ModuloRelatorios {}
