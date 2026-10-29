import { Module } from '@nestjs/common'
import { ControladorAuditoria } from './controlador-auditoria.js'
import { ServicoAuditoria } from './servico-auditoria.js'
import { ServicoConsultaAuditoria } from './servico-consulta-auditoria.js'

@Module({
  controllers: [ControladorAuditoria],
  providers: [ServicoAuditoria, ServicoConsultaAuditoria],
  exports: [ServicoAuditoria],
})
export class ModuloAuditoria {}
