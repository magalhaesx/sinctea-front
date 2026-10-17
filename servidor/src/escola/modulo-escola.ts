import { Module } from '@nestjs/common'
import { ModuloAuditoria } from '../auditoria/modulo-auditoria.js'
import { ModuloAutenticacao } from '../autenticacao/modulo-autenticacao.js'
import { ServicoFamilia } from '../familia/servico-familia.js'
import {
  ControladorAreaEscola, ControladorConsentimentos, ControladorConvites, ControladorEscolas, ControladorFamilia,
} from './controladores.js'
import { ServicoAreaEscola } from './servico-area-escola.js'
import { ServicoConvites } from './servico-convites.js'
import { ServicoEscolas } from './servico-escolas.js'

/** Familia, escolas, consentimento, convite e area da escola (item 4). */
@Module({
  imports: [ModuloAutenticacao, ModuloAuditoria],
  controllers: [ControladorFamilia, ControladorConsentimentos, ControladorEscolas, ControladorConvites, ControladorAreaEscola],
  providers: [ServicoFamilia, ServicoEscolas, ServicoConvites, ServicoAreaEscola],
})
export class ModuloEscola {}
