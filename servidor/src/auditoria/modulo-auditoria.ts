import { Module } from '@nestjs/common'
import { ServicoAuditoria } from './servico-auditoria.js'

@Module({
  providers: [ServicoAuditoria],
  exports: [ServicoAuditoria],
})
export class ModuloAuditoria {}
