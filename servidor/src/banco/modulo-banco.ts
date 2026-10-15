import { Global, Module } from '@nestjs/common'
import { ServicoBanco } from './servico-banco.js'

/** Global: todo modulo das Etapas 10 e 11 vai precisar do banco. */
@Global()
@Module({
  providers: [ServicoBanco],
  exports: [ServicoBanco],
})
export class ModuloBanco {}
