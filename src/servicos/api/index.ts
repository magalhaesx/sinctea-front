import type { Servicos } from '../contratos'
import { comParametros as q, requisitar as r } from './cliente'

/**
 * Implementacao contra a API real — STUB.
 *
 * Mesmos contratos do mock; os caminhos sao provisorios ate o back-end
 * (S06) publicar os seus. Nenhuma regra de acesso e aplicada aqui: quem
 * decide e o servidor.
 */

const id = encodeURIComponent

export const servicosApi: Servicos = {
  autenticacao: {
    entrar: (email, senha) => r('POST', '/auth/entrar', { email, senha }),
    entrarDemonstracao: (perfil) => r('POST', '/auth/demonstracao', { perfil }),
    trocarPerfil: (perfil) => r('POST', '/auth/perfil', { perfil }),
    sessaoAtual: () => r('GET', '/auth/sessao'),
    sair: () => r('POST', '/auth/sair'),
  },

  pacientes: {
    listar: (filtro) => r('GET', q('/pacientes', filtro)),
    obter: (pacienteId) => r('GET', `/pacientes/${id(pacienteId)}`),
    criar: (dados) => r('POST', '/pacientes', dados),
  },

  profissionais: {
    listar: (filtro) => r('GET', q('/profissionais', filtro)),
  },

  escolas: {
    listar: (filtro) => r('GET', q('/escolas', filtro)),
  },

  planos: {
    obterPorPaciente: (pacienteId) => r('GET', `/pacientes/${id(pacienteId)}/plano`),
    adicionarObjetivo: (planoId, dados) => r('POST', `/planos/${id(planoId)}/objetivos`, dados),
    enviarParaValidacao: (planoId) => r('POST', `/planos/${id(planoId)}/envio`),
    listarAguardandoValidacao: (filtro) => r('GET', q('/planos/aguardando-validacao', filtro)),
    aprovar: (planoId) => r('POST', `/planos/${id(planoId)}/aprovacao`),
    devolver: (planoId, observacao) => r('POST', `/planos/${id(planoId)}/devolucao`, { observacao }),
    confirmarDominio: (objetivoId) => r('POST', `/objetivos/${id(objetivoId)}/dominio`),
    iniciarCartao: (objetivoId) => r('POST', `/objetivos/${id(objetivoId)}/cartao`),
  },

  sessoes: {
    listarAgenda: (filtro) => r('GET', q('/agenda', filtro)),
    listarPorPaciente: (pacienteId, filtro) => r('GET', q(`/pacientes/${id(pacienteId)}/sessoes`, filtro)),
    listarPendentesDeSincronizacao: (filtro) => r('GET', q('/sessoes/pendentes', filtro)),
    obter: (sessaoId) => r('GET', `/sessoes/${id(sessaoId)}`),
    iniciar: (pacienteId, sessaoAgendadaId) => r('POST', '/sessoes', { pacienteId, sessaoAgendadaId }),
    registrarAtividade: (sessaoId, objetivoId, resultado) =>
      r('POST', `/sessoes/${id(sessaoId)}/registros`, { objetivoId, resultado }),
    desfazerUltimoRegistro: (sessaoId) => r('DELETE', `/sessoes/${id(sessaoId)}/registros/ultimo`),
    pausar: (sessaoId) => r('POST', `/sessoes/${id(sessaoId)}/pausa`),
    encerrar: (sessaoId) => r('POST', `/sessoes/${id(sessaoId)}/encerramento`),
  },

  ocorrencias: {
    listarPorPaciente: (pacienteId, filtro) => r('GET', q(`/pacientes/${id(pacienteId)}/ocorrencias`, filtro)),
    registrarNaSessao: (sessaoId, dados) => r('POST', `/sessoes/${id(sessaoId)}/ocorrencias`, dados),
    listarAvisosDaEscola: (filtro) => r('GET', q('/ocorrencias/avisos-escola', filtro)),
    registrarLeituraClinica: (ocorrenciaId) => r('POST', `/ocorrencias/${id(ocorrenciaId)}/leitura-clinica`),
  },

  atividades: {
    listarPorPaciente: (pacienteId, filtro) => r('GET', q(`/pacientes/${id(pacienteId)}/atividades`, filtro)),
    obter: (atividadeId) => r('GET', `/atividades/${id(atividadeId)}`),
    prescrever: (dados) => r('POST', '/atividades', dados),
    registrarExecucao: (atividadeId, desempenho, observacao) =>
      r('POST', `/atividades/${id(atividadeId)}/execucoes`, { desempenho, observacao }),
    listarExecucoes: (atividadeId, filtro) => r('GET', q(`/atividades/${id(atividadeId)}/execucoes`, filtro)),
  },

  familia: {
    listarFilhos: (filtro) => r('GET', q('/familia/filhos', filtro)),
    listarObjetivos: (pacienteId, filtro) => r('GET', q(`/familia/filhos/${id(pacienteId)}/objetivos`, filtro)),
  },

  consentimentos: {
    listarPorPaciente: (pacienteId, filtro) => r('GET', q(`/pacientes/${id(pacienteId)}/consentimentos`, filtro)),
    conceder: (dados) => r('POST', '/consentimentos', dados),
    reemitirConvite: (consentimentoId) => r('POST', `/consentimentos/${id(consentimentoId)}/convites`),
    revogar: (consentimentoId) => r('POST', `/consentimentos/${id(consentimentoId)}/revogacao`),
  },

  convites: {
    obter: (token) => r('GET', `/convites/${id(token)}`),
    aceitar: (token, dados) => r('POST', `/convites/${id(token)}/aceite`, dados),
  },

  areaEscola: {
    listarAlunos: (filtro) => r('GET', q('/escola/alunos', filtro)),
    obterCartao: (pacienteId) => r('GET', `/escola/alunos/${id(pacienteId)}/cartao`),
    registrarOcorrencia: (pacienteId, dados) => r('POST', `/escola/alunos/${id(pacienteId)}/ocorrencias`, dados),
    corrigirOcorrencia: (ocorrenciaId, dados) => r('PUT', `/escola/ocorrencias/${id(ocorrenciaId)}`, dados),
  },

  auditoria: {
    listar: (filtro) => r('GET', q('/auditoria', filtro)),
  },

  indicadores: {
    resumo: () => r('GET', '/indicadores/resumo'),
    listarAlertas: (motivo, filtro) => r('GET', q(`/indicadores/alertas/${id(motivo)}`, filtro)),
    sessoesPorProfissional: () => r('GET', '/indicadores/sessoes-por-profissional'),
    ponteEscola: () => r('GET', '/indicadores/ponte-escola'),
  },

  usuarios: {
    listar: (filtro) => r('GET', q('/usuarios', filtro)),
    alterarPerfis: (usuarioId, perfis) => r('PUT', `/usuarios/${id(usuarioId)}/perfis`, { perfis }),
    desativar: (usuarioId) => r('POST', `/usuarios/${id(usuarioId)}/desativacao`),
    reativar: (usuarioId) => r('POST', `/usuarios/${id(usuarioId)}/reativacao`),
  },
}
