import { Module } from '@nestjs/common'
import { ModuloAutenticacao } from '../autenticacao/modulo-autenticacao.js'
import { ControladorIndicadores } from './controlador-indicadores.js'
import { ServicoIndicadores } from './servico-indicadores.js'

/** Indicadores da coordenacao: resumo, alertas, sessoes por profissional e ponte com a escola (item 19). */
@Module({
  imports: [ModuloAutenticacao],
  controllers: [ControladorIndicadores],
  providers: [ServicoIndicadores],
})
export class ModuloIndicadores {}
