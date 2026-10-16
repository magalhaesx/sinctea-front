import { Module } from '@nestjs/common'
import { ModuloAutenticacao } from '../autenticacao/modulo-autenticacao.js'
import { ControladorPacientes, ControladorPlanos, ControladorSessoes } from './controladores.js'
import { ServicoPacientes } from './servico-pacientes.js'
import { ServicoPlanos } from './servico-planos.js'
import { ServicoSessoesClinicas } from './servico-sessoes-clinicas.js'

@Module({
  imports: [ModuloAutenticacao],
  controllers: [ControladorPacientes, ControladorPlanos, ControladorSessoes],
  providers: [ServicoPacientes, ServicoPlanos, ServicoSessoesClinicas],
})
export class ModuloClinica {}
