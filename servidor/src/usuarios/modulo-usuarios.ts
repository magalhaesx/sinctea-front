import { Module } from '@nestjs/common'
import { ModuloAutenticacao } from '../autenticacao/modulo-autenticacao.js'
import { ControladorProfissionais, ControladorUsuarios } from './controlador-usuarios.js'
import { ServicoUsuarios } from './servico-usuarios.js'

@Module({
  imports: [ModuloAutenticacao],
  controllers: [ControladorUsuarios, ControladorProfissionais],
  providers: [ServicoUsuarios],
})
export class ModuloUsuarios {}
