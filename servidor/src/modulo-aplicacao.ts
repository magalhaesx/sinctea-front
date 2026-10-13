import { Module } from '@nestjs/common'
import { ControladorSaude } from './saude/saude.controlador.js'

@Module({
  controllers: [ControladorSaude],
})
export class ModuloAplicacao {}
