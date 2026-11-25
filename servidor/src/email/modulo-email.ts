import { Module } from '@nestjs/common'
import { ServicoEmail } from './servico-email.js'

/** O envio de e-mail (item 23). Uma instancia so: a caixa de memoria e o modo valem para o servidor inteiro. */
@Module({
  providers: [ServicoEmail],
  exports: [ServicoEmail],
})
export class ModuloEmail {}
