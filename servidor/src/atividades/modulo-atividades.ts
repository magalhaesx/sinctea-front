import { Module } from '@nestjs/common'
import { ModuloAutenticacao } from '../autenticacao/modulo-autenticacao.js'
import { ControladorAtividades } from './controlador-atividades.js'
import { ServicoAtividades } from './servico-atividades.js'

/** Atividades de casa: a clinica prescreve, a familia registra (item 15). */
@Module({
  imports: [ModuloAutenticacao],
  controllers: [ControladorAtividades],
  providers: [ServicoAtividades],
})
export class ModuloAtividades {}
