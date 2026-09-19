import type { Servicos } from '../contratos'
import { autenticacaoMock } from './autenticacao'
import { ocorrenciasMock, planosMock, sessoesMock } from './clinica'
import { areaEscolaMock } from './escola'
import { atividadesMock, consentimentosMock, convitesMock, familiaMock } from './familia'
import { auditoriaMock, usuariosMock } from './gestao'
import { escolasMock, pacientesMock, profissionaisMock } from './pacientes'

/**
 * Implementacao simulada. Importada SOMENTE por servicos/index.ts —
 * nenhum componente conhece esta pasta.
 */
export const servicosMock: Servicos = {
  autenticacao: autenticacaoMock,
  pacientes: pacientesMock,
  profissionais: profissionaisMock,
  escolas: escolasMock,
  planos: planosMock,
  sessoes: sessoesMock,
  ocorrencias: ocorrenciasMock,
  atividades: atividadesMock,
  familia: familiaMock,
  consentimentos: consentimentosMock,
  convites: convitesMock,
  areaEscola: areaEscolaMock,
  auditoria: auditoriaMock,
  usuarios: usuariosMock,
}
