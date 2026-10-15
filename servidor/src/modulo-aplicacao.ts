import { Module } from '@nestjs/common'
import { ModuloBanco } from './banco/modulo-banco.js'
import { ControladorSaude } from './saude/saude.controlador.js'

@Module({
  imports: [ModuloBanco],
  controllers: [ControladorSaude],
})
export class ModuloAplicacao {}
