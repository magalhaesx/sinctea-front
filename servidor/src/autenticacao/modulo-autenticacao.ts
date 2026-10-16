import { Module } from '@nestjs/common'
import { ModuloAuditoria } from '../auditoria/modulo-auditoria.js'
import { ControladorAutenticacao } from './controlador-autenticacao.js'
import { ServicoAutenticacao } from './servico-autenticacao.js'
import { ServicoSessoes } from './servico-sessoes.js'

@Module({
  imports: [ModuloAuditoria],
  controllers: [ControladorAutenticacao],
  providers: [ServicoAutenticacao, ServicoSessoes],
  exports: [ServicoAutenticacao, ServicoSessoes],
})
export class ModuloAutenticacao {}
