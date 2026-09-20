import type {
  ServicoAtividadeCasa, ServicoConsentimento, ServicoConvite, ServicoFamilia,
} from '../contratos'
import {
  ErroServico, type AtividadeCasa, type Consentimento, type ConsentimentoDetalhe,
  type ExecucaoAtividadeCasa, type ProfessorAEE, type VinculoEscolar,
} from '../tipos'
import {
  calcularExpiracaoConvite, idadeEmAnos, situacaoConsentimento, situacaoConvite,
  validarNovoConsentimento,
} from '../../dominio/regras'
import {
  ehResponsavelDe, exigirPacienteClinico, exigirPacienteClinicoOuFamilia, exigirPacienteDaFamilia,
} from './acesso'
import {
  auditar, banco, exigirPerfil, exigirValido, gerarId, gravarSessao, naoEncontrado, paginar,
  paraSessaoUsuario, relogio, responder, todosUsuarios,
} from './infra'

// ---------------------------------------------------------------- Atividades em casa

function buscarAtividade(id: string): AtividadeCasa {
  return banco.atividades.find((a) => a.id === id) ?? naoEncontrado('Atividade')
}

export const atividadesMock: ServicoAtividadeCasa = {
  listarPorPaciente: (pacienteId, filtro = {}) => responder(() => {
    exigirPacienteClinicoOuFamilia(pacienteId, 'AtividadeCasa')
    const itens = banco.atividades
      .filter((a) => a.pacienteId === pacienteId && (filtro.ativa === undefined || a.ativa === filtro.ativa))
      .sort((a, b) => b.prescritaEm.localeCompare(a.prescritaEm))
    return paginar(itens, filtro)
  }),

  obter: (id) => responder(() => {
    const atividade = buscarAtividade(id)
    exigirPacienteClinicoOuFamilia(atividade.pacienteId, 'AtividadeCasa')
    return atividade
  }),

  prescrever: (dados) => responder(() => {
    const { sessao } = exigirPacienteClinico(dados.pacienteId, 'AtividadeCasa')
    const plano = banco.planos.find((p) => p.pacienteId === dados.pacienteId)
    const erros: Record<string, string> = {}
    // Atividade solta nao existe: precisa de um objetivo do plano do paciente.
    if (!plano?.objetivos.some((o) => o.id === dados.objetivoId)) {
      erros.objetivoId = 'Escolha o objetivo do plano a que esta atividade serve.'
    }
    if (!dados.titulo.trim()) erros.titulo = 'Dê um título que a família reconheça.'
    if (dados.passos.filter((p) => p.trim()).length === 0) erros.passos = 'Descreva ao menos um passo.'
    if (!Number.isInteger(dados.frequenciaSemanal) || dados.frequenciaSemanal < 1 || dados.frequenciaSemanal > 7) {
      erros.frequenciaSemanal = 'A frequência semanal vai de 1 a 7 vezes.'
    }
    exigirValido(erros)
    const atividade: AtividadeCasa = {
      ...dados,
      id: gerarId('a'),
      titulo: dados.titulo.trim(),
      descricao: dados.descricao.trim(),
      passos: dados.passos.map((p) => p.trim()).filter(Boolean),
      ativa: true,
      prescritaEm: relogio.agora().toISOString(),
    }
    banco.atividades.push(atividade)
    auditar(sessao, { acao: 'CRIACAO', entidade: 'AtividadeCasa', idEntidade: atividade.id, pacienteId: atividade.pacienteId, detalhe: atividade.titulo })
    return atividade
  }),

  registrarExecucao: (atividadeId, desempenho, observacao) => responder(() => {
    const atividade = buscarAtividade(atividadeId)
    const { sessao } = exigirPacienteDaFamilia(atividade.pacienteId, 'ExecucaoAtividadeCasa')
    if (!atividade.ativa) throw new ErroServico('CONFLITO', 'Esta atividade foi encerrada pela terapeuta.')
    const execucao: ExecucaoAtividadeCasa = {
      id: gerarId('ex'),
      atividadeId,
      responsavelId: sessao.usuario.id,
      dataRealizacao: relogio.agora().toISOString(),
      desempenho,
      observacao: observacao?.trim() || null,
    }
    banco.execucoes.push(execucao)
    return execucao
  }),

  listarExecucoes: (atividadeId, filtro = {}) => responder(() => {
    const atividade = buscarAtividade(atividadeId)
    exigirPacienteClinicoOuFamilia(atividade.pacienteId, 'ExecucaoAtividadeCasa')
    const itens = banco.execucoes
      .filter((e) => e.atividadeId === atividadeId)
      .sort((a, b) => b.dataRealizacao.localeCompare(a.dataRealizacao))
    return paginar(itens, filtro)
  }),
}

// ---------------------------------------------------------------- Familia

export const familiaMock: ServicoFamilia = {
  listarFilhos: (filtro = {}) => responder(() => {
    const sessao = exigirPerfil(['RESPONSAVEL'], 'Paciente')
    const agora = relogio.agora()
    const itens = banco.pacientes
      .filter((p) => p.ativo && ehResponsavelDe(sessao, p))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((p) => ({ id: p.id, nome: p.nome, idade: idadeEmAnos(p.dataNascimento, agora) }))
    return paginar(itens, filtro)
  }),

  listarObjetivos: (pacienteId, filtro = {}) => responder(() => {
    const { sessao } = exigirPacienteDaFamilia(pacienteId, 'Objetivo')
    const plano = banco.planos.find((p) => p.pacienteId === pacienteId && p.status === 'VIGENTE')
    auditar(sessao, { acao: 'LEITURA_AUTORIZADA', entidade: 'Objetivo', pacienteId, detalhe: 'Evolução em linguagem acessível.' })
    // Projecao: so a redacao acessivel. A tecnica e o dominio nao saem daqui.
    const itens = (plano?.objetivos ?? []).map((o) => ({
      id: o.id,
      descricaoAcessivel: o.descricaoAcessivel,
      status: o.status,
      percentualAtual: o.percentualAtual,
    }))
    return paginar(itens, filtro)
  }),
}

// ---------------------------------------------------------------- Consentimento

function detalharConsentimento(c: Consentimento): ConsentimentoDetalhe {
  const vinculo = banco.vinculos.find((v) => v.consentimentoId === c.id)!
  return {
    ...c,
    situacao: situacaoConsentimento(c, relogio.agora()),
    vinculoId: vinculo.id,
    escola: banco.escolas.find((e) => e.id === vinculo.escolaId)?.nome ?? '—',
    professor: banco.professores.find((p) => p.id === vinculo.professorId)?.nome ?? null,
    conviteAceito: vinculo.conviteUsadoEm !== null,
  }
}

function gerarToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export const consentimentosMock: ServicoConsentimento = {
  listarPorPaciente: (pacienteId, filtro = {}) => responder(() => {
    exigirPacienteClinicoOuFamilia(pacienteId, 'Consentimento')
    const itens = banco.consentimentos
      .filter((c) => c.pacienteId === pacienteId)
      .sort((a, b) => b.concedidoEm.localeCompare(a.concedidoEm))
      .map(detalharConsentimento)
    return paginar(itens, filtro)
  }),

  conceder: (dados) => responder(() => {
    // Regra 1: quem autoriza e o Responsavel do paciente — nunca a escola, nunca a clinica.
    exigirPerfil(['RESPONSAVEL'], 'Consentimento', dados.pacienteId)
    const { sessao } = exigirPacienteDaFamilia(dados.pacienteId, 'Consentimento')
    const agora = relogio.agora()
    const erros = validarNovoConsentimento(dados, agora)
    if (dados.escolaId && !banco.escolas.some((e) => e.id === dados.escolaId)) erros.escolaId = 'Escola não encontrada.'
    exigirValido(erros)

    const consentimento: Consentimento = {
      id: gerarId('c'),
      responsavelId: sessao.usuario.id,
      pacienteId: dados.pacienteId,
      escopos: [...new Set(dados.escopos)],
      concedidoEm: agora.toISOString(),
      validadeAte: dados.validadeAte,
      revogadoEm: null,
      // No servidor, a impressao digital do termo que o responsavel aceitou.
      hashTermo: `sha256:${gerarToken()}`,
    }
    // Sem consentimento nao ha vinculo: o vinculo nasce aqui, sem professor, com o convite.
    const vinculo: VinculoEscolar = {
      id: gerarId('v'),
      consentimentoId: consentimento.id,
      pacienteId: dados.pacienteId,
      escolaId: dados.escolaId,
      professorId: null,
      // Turma e turno chegam com o aceite do convite, quando o professor os informa.
      turma: dados.turma ?? '',
      turno: dados.turno ?? '',
      status: 'ATIVO',
      tokenConvite: gerarToken(),
      conviteCriadoEm: agora.toISOString(),
      conviteExpiraEm: calcularExpiracaoConvite(agora).toISOString(),
      conviteUsadoEm: null,
    }
    banco.consentimentos.push(consentimento)
    banco.vinculos.push(vinculo)
    auditar(sessao, {
      acao: 'CONCESSAO_ACESSO', entidade: 'Consentimento', idEntidade: consentimento.id,
      pacienteId: dados.pacienteId, detalhe: `Escopos: ${consentimento.escopos.join(', ')}`,
    })
    return {
      consentimento: detalharConsentimento(consentimento),
      tokenConvite: vinculo.tokenConvite,
      conviteExpiraEm: vinculo.conviteExpiraEm,
    }
  }),

  revogar: (consentimentoId) => responder(() => {
    const consentimento = banco.consentimentos.find((c) => c.id === consentimentoId) ?? naoEncontrado('Consentimento')
    exigirPerfil(['RESPONSAVEL'], 'Consentimento', consentimento.pacienteId)
    const { sessao } = exigirPacienteDaFamilia(consentimento.pacienteId, 'Consentimento')
    if (consentimento.revogadoEm === null) {
      // Regra 5: efeito imediato. Nao ha cache a invalidar — toda leitura da escola
      // consulta este registro de novo.
      consentimento.revogadoEm = relogio.agora().toISOString()
      auditar(sessao, {
        acao: 'REVOGACAO_ACESSO', entidade: 'Consentimento', idEntidade: consentimento.id,
        pacienteId: consentimento.pacienteId, detalhe: 'Revogado pelo responsável.',
      })
    }
    return detalharConsentimento(consentimento)
  }),
}

// ---------------------------------------------------------------- Convite

function buscarPorToken(token: string): { vinculo: VinculoEscolar; consentimento: Consentimento } | null {
  const vinculo = banco.vinculos.find((v) => v.tokenConvite === token)
  if (!vinculo) return null
  const consentimento = banco.consentimentos.find((c) => c.id === vinculo.consentimentoId)!
  return { vinculo, consentimento }
}

export const convitesMock: ServicoConvite = {
  obter: (token) => responder(() => {
    const achado = buscarPorToken(token) ?? naoEncontrado('Convite')
    const { vinculo, consentimento } = achado
    const situacao = situacaoConvite(vinculo, consentimento, relogio.agora())
    if (situacao !== 'VALIDO') {
      // Convite que nao vale mais nao revela para quem era.
      return { situacao, responsavel: null, aluno: null, escola: null, escopos: [], validadeAte: null, expiraEm: null }
    }
    const paciente = banco.pacientes.find((p) => p.id === vinculo.pacienteId)!
    return {
      situacao,
      responsavel: banco.responsaveis.find((r) => r.id === consentimento.responsavelId)?.nome ?? null,
      aluno: paciente.nome.split(' ')[0],
      escola: banco.escolas.find((e) => e.id === vinculo.escolaId)?.nome ?? null,
      escopos: consentimento.escopos,
      validadeAte: consentimento.validadeAte,
      expiraEm: vinculo.conviteExpiraEm,
    }
  }),

  aceitar: (token, dados) => responder(() => {
    const achado = buscarPorToken(token) ?? naoEncontrado('Convite')
    const { vinculo, consentimento } = achado
    const agora = relogio.agora()
    const situacao = situacaoConvite(vinculo, consentimento, agora)
    if (situacao !== 'VALIDO') {
      auditar(null, { acao: 'ACESSO_NEGADO', entidade: 'VinculoEscolar', idEntidade: vinculo.id, pacienteId: vinculo.pacienteId, detalhe: `Convite ${situacao.toLowerCase()}.` })
      throw new ErroServico('CONFLITO', 'Este convite não pode mais ser usado.')
    }

    const erros: Record<string, string> = {}
    if (!dados.nome.trim()) erros.nome = 'Informe seu nome.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email.trim())) erros.email = 'Informe um e-mail válido.'
    if (dados.senha.length < 8) erros.senha = 'A senha precisa ter ao menos 8 caracteres.'
    exigirValido(erros)

    // Aceitar o convite nao pode dar acesso a uma conta existente sem a senha dela.
    // Vincular um professor ja cadastrado a um segundo aluno fica para quando
    // houver autenticacao real (pendencia registrada).
    const email = dados.email.trim().toLowerCase()
    if (todosUsuarios().some((u) => u.email.toLowerCase() === email)) {
      throw new ErroServico('CONFLITO', 'Já existe uma conta com este e-mail.', { email: 'Já existe uma conta com este e-mail.' })
    }
    const professor: ProfessorAEE = {
      tipo: 'PROFESSOR_AEE',
      id: gerarId('u-profe'),
      nome: dados.nome.trim(),
      email,
      perfis: ['PROFESSOR'],
      ativo: true,
      ultimoAcessoEm: agora.toISOString(),
      escolaId: vinculo.escolaId,
      atuacao: dados.atuacao?.trim() || 'Professor',
    }
    banco.professores.push(professor)

    // Uso unico: o token deixa de valer no mesmo instante.
    vinculo.professorId = professor.id
    vinculo.conviteUsadoEm = agora.toISOString()
    gravarSessao({ usuarioId: professor.id, perfilAtivo: 'PROFESSOR' })
    const sessao = { usuario: professor, perfilAtivo: 'PROFESSOR' as const }
    auditar(sessao, { acao: 'CONCESSAO_ACESSO', entidade: 'VinculoEscolar', idEntidade: vinculo.id, pacienteId: vinculo.pacienteId, detalhe: 'Convite aceito pelo professor.' })
    return paraSessaoUsuario(sessao)
  }),
}
