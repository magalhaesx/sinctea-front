import type {
  ServicoAtividadeCasa, ServicoConsentimento, ServicoConvite, ServicoFamilia,
} from '../contratos'
import {
  ErroServico, type AtividadeCasa, type Consentimento, type ConsentimentoDetalhe,
  type ConviteEscolar, type ExecucaoAtividadeCasa, type ProfessorAEE, type VinculoEscolar,
} from '../tipos'
import {
  calcularExpiracaoConvite, consentimentoVigente, idadeEmAnos, situacaoConsentimento,
  situacaoConvite, validarNovoConsentimento,
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

/**
 * A escola e conhecida desde a concessao; professor e turma so existem depois
 * que alguem aceita o convite. Vale sempre o convite mais recente.
 */
function detalharConsentimento(c: Consentimento): ConsentimentoDetalhe {
  const convite = conviteAtual(c.id)
  const vinculo = banco.vinculos.find((v) => v.consentimentoId === c.id)
  return {
    ...c,
    situacao: situacaoConsentimento(c, relogio.agora()),
    escola: banco.escolas.find((e) => e.id === c.escolaId)?.nome ?? '—',
    vinculoId: vinculo?.id ?? null,
    professor: vinculo ? banco.professores.find((p) => p.id === vinculo.professorId)?.nome ?? '—' : null,
    turma: vinculo?.turma ?? null,
    conviteAceito: convite?.usadoEm != null,
  }
}

/** O ultimo convite emitido para o consentimento. */
function conviteAtual(consentimentoId: string): ConviteEscolar | undefined {
  return banco.convites
    .filter((cv) => cv.consentimentoId === consentimentoId)
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))
    .pop()
}

/** Emite um convite novo e derruba o anterior que ainda nao foi usado. */
function emitirConvite(consentimento: Consentimento, agora: Date): ConviteEscolar {
  for (const anterior of banco.convites.filter((cv) => cv.consentimentoId === consentimento.id)) {
    // Nunca dois tokens validos ao mesmo tempo: o antigo vence agora.
    if (anterior.usadoEm === null) anterior.expiraEm = agora.toISOString()
  }
  const convite: ConviteEscolar = {
    id: gerarId('cv'),
    consentimentoId: consentimento.id,
    token: gerarToken(),
    criadoEm: agora.toISOString(),
    expiraEm: calcularExpiracaoConvite(agora).toISOString(),
    usadoEm: null,
  }
  banco.convites.push(convite)
  return convite
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
      escolaId: dados.escolaId,
      escopos: [...new Set(dados.escopos)],
      concedidoEm: agora.toISOString(),
      validadeAte: dados.validadeAte,
      revogadoEm: null,
      // No servidor, a impressao digital do termo que o responsavel aceitou.
      hashTermo: `sha256:${gerarToken()}`,
    }
    banco.consentimentos.push(consentimento)
    // Sem consentimento nao ha convite. O vinculo so nasce quando o professor
    // aceita: e ele quem declara turma, turno e atuacao.
    const convite = emitirConvite(consentimento, agora)
    const escola = banco.escolas.find((e) => e.id === consentimento.escolaId)?.nome ?? '—'
    auditar(sessao, {
      acao: 'CONCESSAO_ACESSO', entidade: 'Consentimento', idEntidade: consentimento.id,
      pacienteId: dados.pacienteId,
      // E este registro que prova o que a familia autorizou.
      detalhe: `Escola: ${escola} · escopos: ${consentimento.escopos.join(', ')}`,
    })
    return {
      consentimento: detalharConsentimento(consentimento),
      tokenConvite: convite.token,
      conviteExpiraEm: convite.expiraEm,
    }
  }),

  reemitirConvite: (consentimentoId) => responder(() => {
    const consentimento = banco.consentimentos.find((c) => c.id === consentimentoId) ?? naoEncontrado('Consentimento')
    exigirPerfil(['RESPONSAVEL'], 'ConviteEscolar', consentimento.pacienteId)
    const { sessao } = exigirPacienteDaFamilia(consentimento.pacienteId, 'ConviteEscolar')
    const agora = relogio.agora()
    if (!consentimentoVigente(consentimento, agora)) {
      throw new ErroServico('CONFLITO', 'Este acesso não está mais vigente. Autorize de novo para gerar um convite.')
    }
    const convite = emitirConvite(consentimento, agora)
    auditar(sessao, {
      acao: 'CRIACAO', entidade: 'ConviteEscolar', idEntidade: convite.id,
      pacienteId: consentimento.pacienteId, detalhe: 'Novo convite emitido; o anterior deixou de valer.',
    })
    return {
      consentimento: detalharConsentimento(consentimento),
      tokenConvite: convite.token,
      conviteExpiraEm: convite.expiraEm,
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
      // O vinculo do ano letivo tambem se encerra. O controle de acesso continua
      // sendo o consentimento, consultado a cada leitura.
      for (const v of banco.vinculos.filter((x) => x.consentimentoId === consentimento.id)) {
        v.status = 'ENCERRADO'
      }
      auditar(sessao, {
        acao: 'REVOGACAO_ACESSO', entidade: 'Consentimento', idEntidade: consentimento.id,
        pacienteId: consentimento.pacienteId, detalhe: 'Revogado pelo responsável.',
      })
    }
    return detalharConsentimento(consentimento)
  }),
}

// ---------------------------------------------------------------- Convite

function buscarPorToken(token: string): { convite: ConviteEscolar; consentimento: Consentimento } | null {
  const convite = banco.convites.find((cv) => cv.token === token)
  if (!convite) return null
  const consentimento = banco.consentimentos.find((c) => c.id === convite.consentimentoId)!
  return { convite, consentimento }
}

export const convitesMock: ServicoConvite = {
  obter: (token) => responder(() => {
    const achado = buscarPorToken(token) ?? naoEncontrado('Convite')
    const { convite, consentimento } = achado
    const situacao = situacaoConvite(convite, consentimento, relogio.agora())
    if (situacao !== 'VALIDO') {
      // Convite que nao vale mais nao revela para quem era.
      return { situacao, responsavel: null, aluno: null, escola: null, escopos: [], validadeAte: null, expiraEm: null }
    }
    const paciente = banco.pacientes.find((p) => p.id === consentimento.pacienteId)!
    return {
      situacao,
      responsavel: banco.responsaveis.find((r) => r.id === consentimento.responsavelId)?.nome ?? null,
      aluno: paciente.nome.split(' ')[0],
      escola: banco.escolas.find((e) => e.id === consentimento.escolaId)?.nome ?? null,
      escopos: consentimento.escopos,
      validadeAte: consentimento.validadeAte,
      expiraEm: convite.expiraEm,
    }
  }),

  aceitar: (token, dados) => responder(() => {
    const achado = buscarPorToken(token) ?? naoEncontrado('Convite')
    const { convite, consentimento } = achado
    const agora = relogio.agora()
    const situacao = situacaoConvite(convite, consentimento, agora)
    if (situacao !== 'VALIDO') {
      auditar(null, {
        acao: 'ACESSO_NEGADO', entidade: 'ConviteEscolar', idEntidade: convite.id,
        pacienteId: consentimento.pacienteId, detalhe: `Convite ${situacao.toLowerCase()}.`,
      })
      throw new ErroServico('CONFLITO', 'Este convite não pode mais ser usado.')
    }

    const erros: Record<string, string> = {}
    if (!dados.nome.trim()) erros.nome = 'Informe seu nome.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email.trim())) erros.email = 'Informe um e-mail válido.'
    if (dados.senha.length < 8) erros.senha = 'A senha precisa ter ao menos 8 caracteres.'
    if (!dados.turma.trim()) erros.turma = 'Informe a turma do aluno.'
    if (!dados.turno.trim()) erros.turno = 'Informe o turno.'
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
    }
    banco.professores.push(professor)

    // Uso unico: o token deixa de valer no mesmo instante, e o vinculo nasce aqui.
    convite.usadoEm = agora.toISOString()
    const vinculo: VinculoEscolar = {
      id: gerarId('v'),
      consentimentoId: consentimento.id,
      conviteId: convite.id,
      pacienteId: consentimento.pacienteId,
      professorId: professor.id,
      turma: dados.turma.trim(),
      turno: dados.turno.trim(),
      // Atuacao e da relacao: a mesma professora pode ser regente de um aluno
      // e professora de AEE de outro.
      atuacao: dados.atuacao.trim() || 'Professor',
      status: 'ATIVO',
    }
    banco.vinculos.push(vinculo)

    gravarSessao({ usuarioId: professor.id, perfilAtivo: 'PROFESSOR' })
    const sessao = { usuario: professor, perfilAtivo: 'PROFESSOR' as const }
    auditar(sessao, {
      acao: 'CONCESSAO_ACESSO', entidade: 'VinculoEscolar', idEntidade: vinculo.id,
      pacienteId: vinculo.pacienteId, detalhe: 'Convite aceito pelo professor.',
    })
    return paraSessaoUsuario(sessao)
  }),
}
