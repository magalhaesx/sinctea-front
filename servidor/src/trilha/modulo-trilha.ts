import { Module } from '@nestjs/common'
import { ModuloAutenticacao } from '../autenticacao/modulo-autenticacao.js'
import { ControladorTrilha } from './controlador-trilha.js'
import { ServicoTrilha } from './servico-trilha.js'

/** A trilha de autonomia: a leitura da clinica e a da familia (item 24). */
@Module({
  imports: [ModuloAutenticacao],
  controllers: [ControladorTrilha],
  providers: [ServicoTrilha],
})
export class ModuloTrilha {}
