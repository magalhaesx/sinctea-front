import { Module } from '@nestjs/common'
import { ModuloAutenticacao } from '../autenticacao/modulo-autenticacao.js'
import { ControladorOcorrencias, ControladorPacientes, ControladorPlanos, ControladorSessoes } from './controladores.js'
import { ServicoOcorrencias } from './servico-ocorrencias.js'
import { ServicoPacientes } from './servico-pacientes.js'
import { ServicoPlanos } from './servico-planos.js'
import { ServicoSessoesClinicas } from './servico-sessoes-clinicas.js'

@Module({
  imports: [ModuloAutenticacao],
  controllers: [ControladorPacientes, ControladorPlanos, ControladorSessoes, ControladorOcorrencias],
  providers: [ServicoPacientes, ServicoPlanos, ServicoSessoesClinicas, ServicoOcorrencias],
})
export class ModuloClinica {}
