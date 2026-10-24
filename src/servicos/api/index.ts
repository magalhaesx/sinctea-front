import type { DadosProfissionais, Servicos, SessaoUsuario } from '@sinctea/compartilhado'
import { comParametros as q, guardarVaga, requisitar as r } from './cliente'

/**
 * Implementacao contra a API real (servidor/, NestJS).
 *
 * Mesmos contratos do mock. Nenhuma regra de acesso e aplicada aqui: quem
 * decide e o servidor. Ja implementados no servidor: autenticacao (item 1 da
 * secao 0 do docs/07), usuarios e profissionais (item 2), pacientes, plano,
 * cartao e sessao (item 3); familia, escolas, consentimento, convite e area
 * da escola (item 4). Os demais caminhos sao provisorios ate o item de cada
 * um chegar.
 */

const id = encodeURIComponent

/** Quem abre sessao recebe a vaga do navegador: a aba passa a ser dela (item 9). */
async function naVaga(pedido: Promise<SessaoUsuario>): Promise<SessaoUsuario> {
  const sessao = await pedido
  if (sessao.vaga !== null) guardarVaga(sessao.vaga)
  return sessao
}

export const servicosApi: Servicos = {
  autenticacao: {
    // Sem entrarDemonstracao: no sistema real nao existe conta sem senha (docs/07, D6).
    entrar: (email, senha) => naVaga(r('POST', '/auth/entrar', { email, senha })),
    trocarPerfil: (perfil) => r('POST', '/auth/perfil', { perfil }),
    // Sem sessao, o servidor responde 204: aqui isso vira nulo.
    sessaoAtual: async () => (await r<SessaoUsuario | undefined>('GET', '/auth/sessao')) ?? null,
    // Sai so da vaga desta aba; a aba fica sem vaga, mesmo se o servidor nao responder.
    sair: async () => {
      try {
        await r('POST', '/auth/sair')
      } finally {
        guardarVaga(null)
      }
    },
    contasAbertas: () => r('GET', '/auth/contas-abertas'),
    continuarComo: async (vaga) => {
      guardarVaga(vaga)
      const sessao = (await r<SessaoUsuario | undefined>('GET', '/auth/sessao')) ?? null
      if (!sessao) guardarVaga(null)
      return sessao
    },
    obterPrimeiroAcesso: (token) => r('GET', `/auth/primeiro-acesso/${id(token)}`),
    concluirPrimeiroAcesso: (token, senha) => naVaga(r('POST', `/auth/primeiro-acesso/${id(token)}`, { senha })),
    darCienciaDaNovaSenha: () => r('POST', '/auth/aviso-de-nova-senha'),
  },

  pacientes: {
    listar: (filtro) => r('GET', q('/pacientes', filtro)),
    obter: (pacienteId) => r('GET', `/pacientes/${id(pacienteId)}`),
    criar: (dados) => r('POST', '/pacientes', dados),
    cadastrarResponsavel: (pacienteId, dados) => r('POST', `/pacientes/${id(pacienteId)}/responsaveis`, dados),
    novoLinkDoResponsavel: (pacienteId, responsavelId) =>
      r('POST', `/pacientes/${id(pacienteId)}/responsaveis/${id(responsavelId)}/acesso-inicial`),
    linkNovaSenhaDoResponsavel: (pacienteId, responsavelId, motivo) =>
      r('POST', `/pacientes/${id(pacienteId)}/responsaveis/${id(responsavelId)}/nova-senha`, { motivo }),
    editarResponsavel: (pacienteId, responsavelId, dados) =>
      r('PUT', `/pacientes/${id(pacienteId)}/responsaveis/${id(responsavelId)}`, dados),
  },

  profissionais: {
    listar: (filtro) => r('GET', q('/profissionais', filtro)),
  },

  escolas: {
    listar: (filtro) => r('GET', q('/escolas', filtro)),
    parecidas: (nome, municipio) => r('GET', q('/escolas/parecidas', { nome, municipio })),
    cadastrar: (dados) => r('POST', '/escolas', dados),
  },

  planos: {
    obterPorPaciente: (pacienteId) => r('GET', `/pacientes/${id(pacienteId)}/plano`),
    criar: (pacienteId, dados) => r('POST', `/pacientes/${id(pacienteId)}/plano`, dados),
    adicionarObjetivo: (planoId, dados) => r('POST', `/planos/${id(planoId)}/objetivos`, dados),
    editarObjetivo: (objetivoId, dados) => r('PUT', `/objetivos/${id(objetivoId)}`, dados),
    editarDatas: (planoId, dados) => r('PUT', `/planos/${id(planoId)}/datas`, dados),
    enviarParaValidacao: (planoId) => r('POST', `/planos/${id(planoId)}/envio`),
    listarAguardandoValidacao: (filtro) => r('GET', q('/planos/aguardando-validacao', filtro)),
    aprovar: (planoId) => r('POST', `/planos/${id(planoId)}/aprovacao`),
    devolver: (planoId, observacao) => r('POST', `/planos/${id(planoId)}/devolucao`, { observacao }),
    confirmarDominio: (objetivoId) => r('POST', `/objetivos/${id(objetivoId)}/dominio`),
    listarCartoes: (objetivoId) => r('GET', `/objetivos/${id(objetivoId)}/cartoes`),
    criarCartao: (objetivoId, dados) => r('POST', `/objetivos/${id(objetivoId)}/cartoes`, dados),
    editarCartao: (cartaoId, dados) => r('PUT', `/cartoes/${id(cartaoId)}`, dados),
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
    encerrar: (sessaoId, evolucao) => r('POST', `/sessoes/${id(sessaoId)}/encerramento`, { evolucao }),
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
    encerrar: (atividadeId) => r('POST', `/atividades/${id(atividadeId)}/encerramento`),
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
    aceitar: (token, dados) => naVaga(r('POST', `/convites/${id(token)}/aceite`, dados)),
  },

  areaEscola: {
    listarAlunos: (filtro) => r('GET', q('/escola/alunos', filtro)),
    obterCartao: (pacienteId) => r('GET', `/escola/alunos/${id(pacienteId)}/cartao`),
    registrarOcorrencia: (pacienteId, dados) => r('POST', `/escola/alunos/${id(pacienteId)}/ocorrencias`, dados),
    corrigirOcorrencia: (ocorrenciaId, dados) => r('PUT', `/escola/ocorrencias/${id(ocorrenciaId)}`, dados),
  },

  auditoria: {
    listar: (filtro) => r('GET', q('/auditoria', filtro)),
    exportar: (filtro) => r('GET', q('/auditoria/csv', filtro)),
  },

  relatorios: {
    previsualizar: (pacienteId, pedido) => r('POST', `/pacientes/${id(pacienteId)}/relatorios/previa`, pedido),
    emitir: (pacienteId, pedido) => r('POST', `/pacientes/${id(pacienteId)}/relatorios`, pedido),
    listarPorPaciente: (pacienteId, filtro) => r('GET', q(`/pacientes/${id(pacienteId)}/relatorios`, filtro)),
    obter: (relatorioId) => r('GET', `/relatorios/${id(relatorioId)}`),
  },

  indicadores: {
    resumo: () => r('GET', '/indicadores/resumo'),
    listarAlertas: (motivo, filtro) => r('GET', q(`/indicadores/alertas/${id(motivo)}`, filtro)),
    sessoesPorProfissional: () => r('GET', '/indicadores/sessoes-por-profissional'),
    ponteEscola: () => r('GET', '/indicadores/ponte-escola'),
  },

  usuarios: {
    listar: (filtro) => r('GET', q('/usuarios', filtro)),
    convidar: (dados) => r('POST', '/usuarios', dados),
    // Sem dados profissionais, o servidor responde 204: aqui isso vira nulo.
    meusDadosProfissionais: async () => (await r<DadosProfissionais | undefined>('GET', '/usuarios/eu/dados-profissionais')) ?? null,
    atualizarMeusDadosProfissionais: (dados) => r('PUT', '/usuarios/eu/dados-profissionais', dados),
    alterarPerfis: (usuarioId, perfis) => r('PUT', `/usuarios/${id(usuarioId)}/perfis`, { perfis }),
    desativar: (usuarioId) => r('POST', `/usuarios/${id(usuarioId)}/desativacao`),
    reativar: (usuarioId) => r('POST', `/usuarios/${id(usuarioId)}/reativacao`),
    novoLinkDeAcesso: (usuarioId) => r('POST', `/usuarios/${id(usuarioId)}/acesso-inicial`),
  },
}
