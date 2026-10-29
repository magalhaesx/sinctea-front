import { Module } from '@nestjs/common'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { GuardaAcesso } from './acesso/guarda-acesso.js'
import { InterceptadorAuditoria } from './auditoria/interceptador-auditoria.js'
import { ModuloAuditoria } from './auditoria/modulo-auditoria.js'
import { ModuloAutenticacao } from './autenticacao/modulo-autenticacao.js'
import { ModuloBanco } from './banco/modulo-banco.js'
import { FiltroErros } from './http/filtro-erros.js'
import { ControladorSaude } from './saude/saude.controlador.js'
import { ModuloUsuarios } from './usuarios/modulo-usuarios.js'
import { ModuloClinica } from './clinica/modulo-clinica.js'
import { ModuloEscola } from './escola/modulo-escola.js'
import { ModuloAtividades } from './atividades/modulo-atividades.js'
import { ModuloRelatorios } from './relatorios/modulo-relatorios.js'

/**
 * A guarda, o interceptador e o filtro valem para toda rota, sem excecao
 * (docs/07, D7): nenhuma rota escolhe ficar fora deles.
 */
@Module({
  imports: [
    ModuloBanco, ModuloAuditoria, ModuloAutenticacao, ModuloUsuarios, ModuloClinica, ModuloEscola, ModuloAtividades,
    ModuloRelatorios,
  ],
  controllers: [ControladorSaude],
  providers: [
    { provide: APP_GUARD, useClass: GuardaAcesso },
    { provide: APP_INTERCEPTOR, useClass: InterceptadorAuditoria },
    { provide: APP_FILTER, useClass: FiltroErros },
  ],
})
export class ModuloAplicacao {}
