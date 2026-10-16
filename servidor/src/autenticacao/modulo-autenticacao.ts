import { Module } from '@nestjs/common'
import { ModuloAuditoria } from '../auditoria/modulo-auditoria.js'
import { ControladorAutenticacao } from './controlador-autenticacao.js'
import { LimiteDeTentativas } from './limite-tentativas.js'
import { ServicoAutenticacao } from './servico-autenticacao.js'
import { ServicoSessoes } from './servico-sessoes.js'

@Module({
  imports: [ModuloAuditoria],
  controllers: [ControladorAutenticacao],
  providers: [ServicoAutenticacao, ServicoSessoes, LimiteDeTentativas],
  exports: [ServicoAutenticacao, ServicoSessoes],
})
export class ModuloAutenticacao {}
