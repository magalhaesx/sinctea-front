import { Module } from '@nestjs/common'
import { ModuloAutenticacao } from '../autenticacao/modulo-autenticacao.js'
import { ControladorProfissionais, ControladorTrilhaAdministrativa, ControladorUsuarios } from './controlador-usuarios.js'
import { ServicoTrilhaAdministrativa } from './servico-trilha.js'
import { ServicoUsuarios } from './servico-usuarios.js'

@Module({
  imports: [ModuloAutenticacao],
  controllers: [ControladorUsuarios, ControladorProfissionais, ControladorTrilhaAdministrativa],
  providers: [ServicoUsuarios, ServicoTrilhaAdministrativa],
})
export class ModuloUsuarios {}
