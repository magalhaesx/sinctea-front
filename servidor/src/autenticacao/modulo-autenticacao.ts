import { Module } from '@nestjs/common'
import { ModuloAuditoria } from '../auditoria/modulo-auditoria.js'
import { ModuloEmail } from '../email/modulo-email.js'
import { ControladorAutenticacao } from './controlador-autenticacao.js'
import { LimiteDeTentativas } from './limite-tentativas.js'
import { ServicoAutenticacao } from './servico-autenticacao.js'
import { ServicoRecuperacao } from './servico-recuperacao.js'
import { ServicoSessoes } from './servico-sessoes.js'

@Module({
  imports: [ModuloAuditoria, ModuloEmail],
  controllers: [ControladorAutenticacao],
  providers: [ServicoAutenticacao, ServicoSessoes, LimiteDeTentativas, ServicoRecuperacao],
  exports: [ServicoAutenticacao, ServicoSessoes, LimiteDeTentativas],
})
export class ModuloAutenticacao {}
