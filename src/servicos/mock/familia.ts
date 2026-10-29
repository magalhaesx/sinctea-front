import type {
  ServicoAtividadeCasa, ServicoConsentimento, ServicoConvite, ServicoFamilia,
} from '@sinctea/compartilhado'
import {
  ErroServico, type AtividadeCasa, type Consentimento, type ConsentimentoDetalhe,
  type ConviteEscolar, type ExecucaoAtividadeCasa, type ProfessorAEE, type VinculoEscolar,
} from '@sinctea/compartilhado'
import {
  ATIVIDADE_ENCERRADA, atividadeCasaPreenchida, calcularExpiracaoConvite, consentimentoVigente, ehDesempenho,
  erroDaObservacaoDaFamilia, idadeEmAnos, situacaoConsentimento, situacaoConvite, textoDoRegistroRepetido,
  validarNovaAtividadeCasa, validarNovoConsentimento,
} from '@sinctea/compartilhado/dominio/regras'
import { diaCivilEm } from '@sinctea/compartilhado/dominio/datas'
import { resumoDoTermo, VERSAO_CORRENTE_DO_TERMO } from '@sinctea/compartilhado/dominio/termo'
import {
  ehResponsavelDe, exigirPacienteClinico, exigirPacienteClinicoOuFamilia, exigirPacienteDaFamilia,
  exigirResponsavelLegal,
} from './acesso'
import type { AtividadeGuardada, ExecucaoGuardada } from './dados'
import {
  auditar, banco, exigirPerfil, exigirValido, gerarId, gravarSessao, naoEncontrado, paginar,
  paraSessaoUsuario, relogio, responder, todosUsuarios,
} from './infra'

// ---------------------------------------------------------------- Atividades em casa

function buscarAtividade(id: string): AtividadeGuardada {
  return banco.atividades.find((a) => a.id === id) ?? naoEncontrado('Atividade')
}

/** Como o mapeador do servidor (item 15b): do objetivo, so a redacao acessivel. */
function comParaQue(a: AtividadeGuardada): AtividadeCasa {
  const objetivo = banco.planos.flatMap((p) => p.objetivos).find((o) => o.id === a.objetivoId)
  return { ...a, paraQue: objetivo?.descricaoAcessivel ?? '' }
}

/** O nome de quem registrou, lido na hora, e nao copiado na execucao. */
function comQuemRegistrou(e: ExecucaoGuardada): ExecucaoAtividadeCasa {
  return { ...e, responsavelNome: banco.responsaveis.find((r) => r.id === e.responsavelId)?.nome ?? '' }
}

export const atividadesMock: ServicoAtividadeCasa = {
  listarPorPaciente: (pacienteId, filtro = {}) => responder(() => {
    const { sessao } = exigirPacienteClinicoOuFamilia(pacienteId, 'AtividadeCasa')
    // Encerrada, a atividade sai da lista da familia, qualquer que seja o filtro pedido (item 15).
    const ativa = sessao.perfilAtivo === 'RESPONSAVEL' ? true : filtro.ativa
    const itens = banco.atividades
      .filter((a) => a.pacienteId === pacienteId && (ativa === undefined || a.ativa === ativa))
      .sort((a, b) => b.prescritaEm.localeCompare(a.prescritaEm))
      .map(comParaQue)
    return paginar(itens, filtro)
  }),

  obter: (id) => responder(() => {
    const atividade = buscarAtividade(id)
    exigirPacienteClinicoOuFamilia(atividade.pacienteId, 'AtividadeCasa')
    return comParaQue(atividade)
  }),

  prescrever: (dados) => responder(() => {
    const { sessao } = exigirPacienteClinico(dados.pacienteId, 'AtividadeCasa')
    // Atividade solta nao existe: precisa de um objetivo do plano VIGENTE do
    // paciente, o mesmo recorte que a familia le na tela 15 (item 15).
    const plano = banco.planos.find((p) => p.pacienteId === dados.pacienteId && p.status === 'VIGENTE')
    const erros = validarNovaAtividadeCasa(dados)
    if (!plano?.objetivos.some((o) => o.id === dados.objetivoId)) {
      erros.objetivoId = 'Escolha um objetivo do plano vigente deste paciente.'
    }
    exigirValido(erros)
    const atividade: AtividadeGuardada = {
      ...atividadeCasaPreenchida(dados),
      id: gerarId('a'),
      ativa: true,
      prescritaEm: relogio.agora().toISOString(),
    }
    banco.atividades.push(atividade)
    auditar(sessao, { acao: 'CRIACAO', entidade: 'AtividadeCasa', idEntidade: atividade.id, pacienteId: atividade.pacienteId, detalhe: atividade.titulo })
    return comParaQue(atividade)
  }),

  /**
   * Sem este caminho, `ativa` nasceria verdadeira e nunca mudaria: a atividade
   * prescrita ficaria para sempre na tela da familia. O historico de execucoes
   * nao se apaga — a atividade so deixa de ser oferecida.
   */
  encerrar: (atividadeId) => responder(() => {
    const atividade = buscarAtividade(atividadeId)
    const { sessao } = exigirPacienteClinico(atividade.pacienteId, 'AtividadeCasa')
    if (!atividade.ativa) {
      throw new ErroServico('CONFLITO', 'Esta atividade já foi encerrada.')
    }
    atividade.ativa = false
    auditar(sessao, {
      acao: 'ALTERACAO', entidade: 'AtividadeCasa', idEntidade: atividade.id,
      pacienteId: atividade.pacienteId, detalhe: 'Prescrição encerrada.',
    })
    return comParaQue(atividade)
  }),

  registrarExecucao: (atividadeId, desempenho, observacao) => responder(() => {
    const atividade = buscarAtividade(atividadeId)
    const { sessao } = exigirPacienteDaFamilia(atividade.pacienteId, 'ExecucaoAtividadeCasa')
    const erros: Record<string, string> = {}
    if (!ehDesempenho(desempenho)) erros.desempenho = 'Escolha como foi hoje.'
    const erroDaObservacao = erroDaObservacaoDaFamilia(observacao ?? '')
    if (erroDaObservacao) erros.observacao = erroDaObservacao
    exigirValido(erros)
    if (!atividade.ativa) throw new ErroServico('CONFLITO', ATIVIDADE_ENCERRADA)
    // O dia em que a familia fez, no calendario da instancia: e data civil.
    const dataRealizacao = diaCivilEm(relogio.agora())
    // Um registro por atividade por dia (item 15): no servidor, o indice unico.
    const doDia = banco.execucoes.find((e) => e.atividadeId === atividadeId && e.dataRealizacao === dataRealizacao)
    if (doDia) {
      const quem = banco.responsaveis.find((r) => r.id === doDia.responsavelId)?.nome ?? 'outro responsável'
      throw new ErroServico('CONFLITO', textoDoRegistroRepetido(quem))
    }
    const execucao: ExecucaoGuardada = {
      id: gerarId('ex'),
      atividadeId,
      responsavelId: sessao.usuario.id,
      dataRealizacao,
      desempenho,
      observacao: observacao?.trim() || null,
    }
    banco.execucoes.push(execucao)
    return comQuemRegistrou(execucao)
  }),

  listarExecucoes: (atividadeId, filtro = {}) => responder(() => {
    const atividade = buscarAtividade(atividadeId)
    exigirPacienteClinicoOuFamilia(atividade.pacienteId, 'ExecucaoAtividadeCasa')
    const itens = banco.execucoes
      .filter((e) => e.atividadeId === atividadeId)
      .sort((a, b) => b.dataRealizacao.localeCompare(a.dataRealizacao))
      .map(comQuemRegistrou)
    return paginar(itens, filtro)
  }),
}

// ---------------------------------------------------------------- Familia

export const familiaMock: ServicoFamilia = {
  listarFilhos: (filtro = {}) => responder(() => {
    const sessao = exigirPerfil(['RESPONSAVEL'], 'Paciente')
    const agora = relogio.agora()
    const vinculoCom = (pacienteId: string) => banco.vinculosFamiliares
      .find((v) => v.pacienteId === pacienteId && v.responsavelId === sessao.usuario.id)
    const itens = banco.pacientes
      .filter((p) => p.ativo && ehResponsavelDe(sessao, p))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((p) => ({
        id: p.id,
        nome: p.nome,
        idade: idadeEmAnos(p.dataNascimento, agora),
        // O parentesco e da relacao, nao da pessoa: quem olha pode ser mae de
        // um e avo de outro.
        parentesco: vinculoCom(p.id)?.parentesco ?? '',
        // Tambem da relacao: decide se a tela 17 oferece autorizar uma escola.
        responsavelLegal: vinculoCom(p.id)?.responsavelLegal ?? false,
      }))
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
    responsavel: banco.responsaveis.find((r) => r.id === c.responsavelId)?.nome ?? '—',
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

/**
 * Os consentimentos de demonstracao nascem sem resumo: calcula-lo exige
 * SHA-256, que so responde por Promise, e os dados sao montados de forma
 * sincrona. Esta promessa preenche todos uma vez.
 *
 * TODO METODO QUE DEVOLVE ConsentimentoDetalhe PRECISA ESPERAR POR ELA —
 * senao a tela recebe um consentimento com hashTermo vazio e "Ver o termo que
 * aceitei" nao tem o que reconstruir.
 */
const resumosSemeados: Promise<void> = (async () => {
  for (const c of banco.consentimentos) {
    if (c.hashTermo) continue
    c.hashTermo = await resumoDoTermo({
      // Versao literal, e nao a corrente: quando existir uma 2026-11, os
      // semeados iriam todos para ela em silencio, e a demonstracao perderia o
      // unico lugar onde o caminho da versao antiga apareceria funcionando.
      versaoTermo: '2026-10',
      responsavelId: c.responsavelId,
      pacienteId: c.pacienteId,
      escolaId: c.escolaId,
      escopos: c.escopos,
      validadeAte: c.validadeAte,
      concedidoEm: c.concedidoEm,
    })
  }
})()

export const consentimentosMock: ServicoConsentimento = {
  listarPorPaciente: (pacienteId, filtro = {}) => responder(async () => {
    await resumosSemeados
    exigirPacienteClinicoOuFamilia(pacienteId, 'Consentimento')
    const itens = banco.consentimentos
      .filter((c) => c.pacienteId === pacienteId)
      .sort((a, b) => b.concedidoEm.localeCompare(a.concedidoEm))
      .map(detalharConsentimento)
    return paginar(itens, filtro)
  }),

  conceder: (dados) => responder(async () => {
    // Regra 1: quem autoriza e o Responsavel legal do paciente — nunca a
    // escola, nunca a clinica, nem outro responsavel vinculado sem essa autoridade.
    exigirPerfil(['RESPONSAVEL'], 'Consentimento', dados.pacienteId)
    const { sessao, paciente } = exigirPacienteDaFamilia(dados.pacienteId, 'Consentimento')
    exigirResponsavelLegal(sessao, paciente, 'Consentimento')
    const agora = relogio.agora()
    const erros = validarNovoConsentimento(dados, agora)
    if (dados.escolaId && !banco.escolas.some((e) => e.id === dados.escolaId)) erros.escolaId = 'Escola não encontrada.'
    exigirValido(erros)

    const escolaDoTermo = banco.escolas.find((e) => e.id === dados.escolaId)!
    const escopos = [...new Set(dados.escopos)]
    const concedidoEm = agora.toISOString()

    const consentimento: Consentimento = {
      id: gerarId('c'),
      responsavelId: sessao.usuario.id,
      pacienteId: dados.pacienteId,
      escolaId: dados.escolaId,
      escopos,
      concedidoEm,
      validadeAte: dados.validadeAte,
      revogadoEm: null,
      /*
       * O resumo do termo aceito: "sha256:<versao>:<hex>", calculado sobre os
       * dados que compoem o texto. O texto renderizado nao e gravado — ele se
       * reproduz a partir da versao mais estes campos, e o resumo prova que
       * nenhum deles mudou depois.
       */
      hashTermo: await resumoDoTermo({
        versaoTermo: VERSAO_CORRENTE_DO_TERMO,
        responsavelId: sessao.usuario.id,
        pacienteId: paciente.id,
        escolaId: escolaDoTermo.id,
        escopos,
        validadeAte: dados.validadeAte,
        concedidoEm,
      }),
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

  reemitirConvite: (consentimentoId) => responder(async () => {
    await resumosSemeados
    const consentimento = banco.consentimentos.find((c) => c.id === consentimentoId) ?? naoEncontrado('Consentimento')
    exigirPerfil(['RESPONSAVEL'], 'ConviteEscolar', consentimento.pacienteId)
    const { sessao, paciente } = exigirPacienteDaFamilia(consentimento.pacienteId, 'ConviteEscolar')
    // Convite novo e porta nova: quem aceitar passa a ver o cartao. Ampliar o
    // acesso, como conceder, exige a autoridade legal.
    exigirResponsavelLegal(sessao, paciente, 'ConviteEscolar')
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

  revogar: (consentimentoId) => responder(async () => {
    await resumosSemeados
    const consentimento = banco.consentimentos.find((c) => c.id === consentimentoId) ?? naoEncontrado('Consentimento')
    exigirPerfil(['RESPONSAVEL'], 'Consentimento', consentimento.pacienteId)
    /*
     * Sem exigirResponsavelLegal, de proposito. A regra e assimetrica: ampliar
     * o acesso de quem esta fora da clinica exige autoridade legal; encerrar
     * nao pode ser dificultado. Qualquer responsavel vinculado que perceba um
     * problema fecha a porta na hora — e quem tem a autoridade abre de novo,
     * se for o caso.
     */
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
