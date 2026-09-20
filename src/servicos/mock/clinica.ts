import type { ServicoOcorrencia, ServicoPlano, ServicoSessao } from '../contratos'
import {
  ErroServico, type ItemAgenda, type Objetivo, type OcorrenciaComportamental, type PlanoTerapeutico,
  type Sessao,
} from '../tipos'
import { validarDevolucaoPlano, validarNovoObjetivo } from '../../dominio/regras'
import { alcancaClinicamente, exigirPacienteClinico } from './acesso'
import {
  auditar, banco, exigirPerfil, exigirSessao, exigirValido, gerarId, naoEncontrado, paginar,
  relogio, responder, type SessaoServidor,
} from './infra'

// ---------------------------------------------------------------- Plano

function buscarPlano(planoId: string): PlanoTerapeutico {
  return banco.planos.find((p) => p.id === planoId) ?? naoEncontrado('Plano terapêutico')
}

/** Alteracao do plano: equipe do paciente ou coordenacao. */
function exigirPlanoEditavel(planoId: string): { sessao: SessaoServidor; plano: PlanoTerapeutico } {
  const plano = buscarPlano(planoId)
  const { sessao } = exigirPacienteClinico(plano.pacienteId, 'PlanoTerapeutico')
  return { sessao, plano }
}

function exigirPlanoAguardando(planoId: string): { sessao: SessaoServidor; plano: PlanoTerapeutico } {
  const plano = buscarPlano(planoId)
  const sessao = exigirPerfil(['COORDENADOR'], 'PlanoTerapeutico', plano.pacienteId)
  if (plano.status !== 'AGUARDANDO_VALIDACAO') {
    throw new ErroServico('CONFLITO', 'Este plano não está aguardando validação.')
  }
  return { sessao, plano }
}

export const planosMock: ServicoPlano = {
  obterPorPaciente: (pacienteId) => responder(() => {
    const { sessao } = exigirPacienteClinico(pacienteId, 'PlanoTerapeutico')
    const plano = banco.planos.find((p) => p.pacienteId === pacienteId) ?? naoEncontrado('Plano terapêutico')
    auditar(sessao, { acao: 'LEITURA_AUTORIZADA', entidade: 'PlanoTerapeutico', idEntidade: plano.id, pacienteId, detalhe: 'Leitura do plano.' })
    return plano
  }),

  adicionarObjetivo: (planoId, dados) => responder(() => {
    const { sessao, plano } = exigirPlanoEditavel(planoId)
    exigirValido(validarNovoObjetivo(dados))
    const objetivo: Objetivo = {
      id: gerarId('o'),
      planoId,
      dominio: dados.dominio.trim(),
      descricaoTecnica: dados.descricaoTecnica.trim(),
      // Gravada exatamente como o terapeuta escreveu. Nenhuma geracao automatica.
      descricaoAcessivel: dados.descricaoAcessivel.trim(),
      status: 'NAO_INICIADO',
      percentualAtual: 0,
      criterio: { ...dados.criterio },
    }
    plano.objetivos.push(objetivo)
    auditar(sessao, { acao: 'CRIACAO', entidade: 'Objetivo', idEntidade: objetivo.id, pacienteId: plano.pacienteId, detalhe: `Objetivo em ${objetivo.dominio}.` })
    return objetivo
  }),

  enviarParaValidacao: (planoId) => responder(() => {
    const { sessao, plano } = exigirPlanoEditavel(planoId)
    if (plano.objetivos.length === 0) {
      throw new ErroServico('VALIDACAO', 'Adicione ao menos um objetivo antes de enviar o plano.')
    }
    if (plano.status === 'AGUARDANDO_VALIDACAO') throw new ErroServico('CONFLITO', 'O plano já aguarda validação.')
    plano.status = 'AGUARDANDO_VALIDACAO'
    auditar(sessao, { acao: 'ALTERACAO', entidade: 'PlanoTerapeutico', idEntidade: plano.id, pacienteId: plano.pacienteId, detalhe: 'Enviado para validação.' })
    return plano
  }),

  listarAguardandoValidacao: (filtro = {}) => responder(() => {
    exigirPerfil(['COORDENADOR'], 'PlanoTerapeutico')
    const itens = banco.planos
      .filter((p) => p.status === 'AGUARDANDO_VALIDACAO')
      .map((p) => ({
        planoId: p.id,
        paciente: { id: p.pacienteId, nome: banco.pacientes.find((x) => x.id === p.pacienteId)?.nome ?? '—' },
        autor: { id: p.autorId, nome: banco.profissionais.find((x) => x.id === p.autorId)?.nome ?? '—' },
        // O mock nao guarda a data do envio; usa o inicio do plano como aproximacao.
        enviadoEm: p.dataInicio,
        totalObjetivos: p.objetivos.length,
      }))
      .sort((a, b) => a.enviadoEm.localeCompare(b.enviadoEm))
    return paginar(itens, filtro)
  }),

  aprovar: (planoId) => responder(() => {
    const { sessao, plano } = exigirPlanoAguardando(planoId)
    plano.status = 'VIGENTE'
    plano.observacaoValidacao = null
    plano.ultimaRevisaoEm = relogio.agora().toISOString()
    auditar(sessao, { acao: 'ALTERACAO', entidade: 'PlanoTerapeutico', idEntidade: plano.id, pacienteId: plano.pacienteId, detalhe: 'Plano aprovado.' })
    return plano
  }),

  devolver: (planoId, observacao) => responder(() => {
    const { sessao, plano } = exigirPlanoAguardando(planoId)
    const erro = validarDevolucaoPlano(observacao)
    if (erro) exigirValido({ observacao: erro })
    plano.status = 'DEVOLVIDO'
    plano.observacaoValidacao = observacao.trim()
    auditar(sessao, { acao: 'ALTERACAO', entidade: 'PlanoTerapeutico', idEntidade: plano.id, pacienteId: plano.pacienteId, detalhe: 'Plano devolvido com observação.' })
    return plano
  }),

  iniciarCartao: (objetivoId) => responder(() => iniciarCartao(objetivoId)),
}

/** iniciarDe(): rascunho em branco, sem texto derivado do objetivo. */
function iniciarCartao(objetivoId: string) {
  const plano = banco.planos.find((p) => p.objetivos.some((o) => o.id === objetivoId))
  if (!plano) naoEncontrado('Objetivo')
  const { sessao } = exigirPacienteClinico(plano.pacienteId, 'CartaoEstrategia')
  const cartao = {
    id: gerarId('ce'),
    objetivoId,
    tituloSimples: '',
    oQueFazer: [],
    oQueEvitar: [],
    sinalAlerta: '',
    atualizadoEm: relogio.agora().toISOString(),
  }
  banco.cartoes.push(cartao)
  auditar(sessao, {
    acao: 'CRIACAO', entidade: 'CartaoEstrategia', idEntidade: cartao.id,
    pacienteId: plano.pacienteId, detalhe: 'Rascunho de cartão iniciado.',
  })
  return cartao
}

// ---------------------------------------------------------------- Sessao

function buscarSessao(sessaoId: string): Sessao {
  return banco.sessoes.find((s) => s.id === sessaoId) ?? naoEncontrado('Sessão')
}

/** So quem conduz a sessao registra nela (Sessao 0..* — 1 Profissional). */
function exigirConducao(sessaoId: string): Sessao {
  const sessao = buscarSessao(sessaoId)
  const { sessao: autenticada } = exigirPacienteClinico(sessao.pacienteId, 'Sessao')
  if (sessao.profissionalId !== autenticada.usuario.id) {
    throw new ErroServico('ACESSO_NEGADO', 'Somente o profissional que conduz a sessão pode registrar nela.')
  }
  return sessao
}

function exigirEmAndamento(sessao: Sessao): void {
  if (sessao.situacao !== 'EM_ANDAMENTO') {
    throw new ErroServico('CONFLITO', 'A sessão não está em andamento.')
  }
}

export const sessoesMock: ServicoSessao = {
  listarAgenda: (filtro = {}) => responder(() => {
    const autenticada = exigirPerfil(['TERAPEUTA', 'COORDENADOR'], 'Sessao')
    const agora = relogio.agora()
    const dia = filtro.dia ??
      `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`
    const doDia = (iso: string) => {
      const d = new Date(iso)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === dia
    }
    // Agenda e de quem atende: mesmo o coordenador ve apenas as proprias sessoes aqui.
    const itens: ItemAgenda[] = banco.sessoes
      .filter((s) => s.profissionalId === autenticada.usuario.id && doDia(s.inicioPrevistoEm))
      .sort((a, b) => a.inicioPrevistoEm.localeCompare(b.inicioPrevistoEm))
      .map((s) => ({
        sessaoId: s.id,
        inicioPrevistoEm: s.inicioPrevistoEm,
        situacao: s.situacao,
        paciente: { id: s.pacienteId, nome: banco.pacientes.find((p) => p.id === s.pacienteId)?.nome ?? '—' },
        profissional: { id: autenticada.usuario.id, nome: autenticada.usuario.nome },
      }))
    return paginar(itens, filtro)
  }),

  listarPorPaciente: (pacienteId, filtro = {}) => responder(() => {
    const { sessao } = exigirPacienteClinico(pacienteId, 'Sessao')
    auditar(sessao, { acao: 'LEITURA_AUTORIZADA', entidade: 'Sessao', pacienteId, detalhe: 'Histórico de sessões.' })
    const itens = banco.sessoes
      .filter((s) => s.pacienteId === pacienteId && (!filtro.situacao || s.situacao === filtro.situacao))
      .sort((a, b) => b.numero - a.numero)
    return paginar(itens, filtro)
  }),

  obter: (id) => responder(() => {
    const sessao = buscarSessao(id)
    exigirPacienteClinico(sessao.pacienteId, 'Sessao')
    return sessao
  }),

  iniciar: (pacienteId, sessaoAgendadaId) => responder(() => {
    const { sessao: autenticada } = exigirPacienteClinico(pacienteId, 'Sessao')
    const agora = relogio.agora().toISOString()
    if (sessaoAgendadaId) {
      const agendada = buscarSessao(sessaoAgendadaId)
      if (agendada.pacienteId !== pacienteId || agendada.profissionalId !== autenticada.usuario.id) {
        throw new ErroServico('ACESSO_NEGADO', 'Esta sessão está agendada para outro profissional.')
      }
      if (agendada.situacao === 'EM_ANDAMENTO') return agendada
      if (agendada.situacao !== 'AGENDADA' && agendada.situacao !== 'PAUSADA') {
        throw new ErroServico('CONFLITO', 'Esta sessão já foi encerrada.')
      }
      agendada.situacao = 'EM_ANDAMENTO'
      agendada.inicio ??= agora
      return agendada
    }
    const nova: Sessao = {
      id: gerarId('s'),
      pacienteId,
      profissionalId: autenticada.usuario.id,
      numero: banco.sessoes.filter((s) => s.pacienteId === pacienteId).length + 1,
      inicioPrevistoEm: agora,
      inicio: agora,
      fim: null,
      local: 'Clínica',
      situacao: 'EM_ANDAMENTO',
      statusSync: 'SINCRONIZADO',
      registros: [],
    }
    banco.sessoes.push(nova)
    auditar(autenticada, { acao: 'CRIACAO', entidade: 'Sessao', idEntidade: nova.id, pacienteId, detalhe: 'Sessão iniciada.' })
    return nova
  }),

  registrarAtividade: (sessaoId, objetivoId, resultado) => responder(() => {
    const sessao = exigirConducao(sessaoId)
    exigirEmAndamento(sessao)
    const plano = banco.planos.find((p) => p.pacienteId === sessao.pacienteId)
    if (!plano?.objetivos.some((o) => o.id === objetivoId)) {
      throw new ErroServico('VALIDACAO', 'O objetivo não pertence ao plano deste paciente.')
    }
    const registro = {
      id: gerarId('ra'),
      objetivoId,
      ordem: sessao.registros.length + 1,
      resultado,
      ocorridoEm: relogio.agora().toISOString(),
    }
    sessao.registros.push(registro)
    return registro
  }),

  desfazerUltimoRegistro: (sessaoId) => responder(() => {
    const sessao = exigirConducao(sessaoId)
    exigirEmAndamento(sessao)
    sessao.registros.pop()
    return sessao
  }),

  pausar: (sessaoId) => responder(() => {
    const sessao = exigirConducao(sessaoId)
    exigirEmAndamento(sessao)
    sessao.situacao = 'PAUSADA'
    return sessao
  }),

  encerrar: (sessaoId) => responder(() => {
    const sessao = exigirConducao(sessaoId)
    if (sessao.situacao !== 'EM_ANDAMENTO' && sessao.situacao !== 'PAUSADA') {
      throw new ErroServico('CONFLITO', 'A sessão não está aberta.')
    }
    sessao.situacao = 'ENCERRADA'
    sessao.fim = relogio.agora().toISOString()
    auditar(exigirSessao(), { acao: 'ALTERACAO', entidade: 'Sessao', idEntidade: sessao.id, pacienteId: sessao.pacienteId, detalhe: `Sessão encerrada com ${sessao.registros.length} registros.` })
    return sessao
  }),
}

// ---------------------------------------------------------------- Ocorrencia comportamental

export const ocorrenciasMock: ServicoOcorrencia = {
  listarPorPaciente: (pacienteId, filtro = {}) => responder(() => {
    const { sessao } = exigirPacienteClinico(pacienteId, 'OcorrenciaComportamental')
    auditar(sessao, { acao: 'LEITURA_AUTORIZADA', entidade: 'OcorrenciaComportamental', pacienteId, detalhe: 'Histórico de ocorrências.' })
    const itens = banco.ocorrenciasComportamentais
      .filter((o) => o.pacienteId === pacienteId)
      .filter((o) => !filtro.origem || o.origem === filtro.origem)
      .filter((o) => !filtro.desde || o.ocorridaEm >= filtro.desde)
      .sort((a, b) => b.ocorridaEm.localeCompare(a.ocorridaEm))
    return paginar(itens, filtro)
  }),

  registrarNaSessao: (sessaoId, dados) => responder(() => {
    const sessao = exigirConducao(sessaoId)
    exigirEmAndamento(sessao)
    const erros: Record<string, string> = {}
    if (!dados.antecedente.trim()) erros.antecedente = 'Descreva o que aconteceu antes.'
    if (!dados.comportamento.trim()) erros.comportamento = 'Descreva o comportamento.'
    if (!dados.consequencia.trim()) erros.consequencia = 'Descreva o que aconteceu depois.'
    if (![1, 2, 3, 4, 5].includes(dados.intensidade)) erros.intensidade = 'Escolha a intensidade, de 1 a 5.'
    exigirValido(erros)
    const ocorrencia: OcorrenciaComportamental = {
      id: gerarId('oc'),
      pacienteId: sessao.pacienteId,
      origem: 'CLINICA',
      ocorridaEm: relogio.agora().toISOString(),
      antecedente: dados.antecedente.trim(),
      comportamento: dados.comportamento.trim(),
      consequencia: dados.consequencia.trim(),
      intensidade: dados.intensidade,
      preliminar: false,
      sessaoId,
      ocorrenciaEscolarId: null,
    }
    banco.ocorrenciasComportamentais.push(ocorrencia)
    return ocorrencia
  }),

  listarAvisosDaEscola: (filtro = {}) => responder(() => {
    const sessao = exigirPerfil(['TERAPEUTA', 'COORDENADOR'], 'OcorrenciaEscolar')
    const desde = filtro.desde ?? new Date(relogio.agora().getTime() - 7 * 86_400_000).toISOString()
    const itens = banco.ocorrenciasEscolares
      .filter((o) => o.registradaEm >= desde)
      .filter((o) => {
        const paciente = banco.pacientes.find((p) => p.id === o.pacienteId)
        return paciente !== undefined && alcancaClinicamente(sessao, paciente)
      })
      .sort((a, b) => b.registradaEm.localeCompare(a.registradaEm))
      .map((o) => {
        const vinculo = banco.vinculos.find((v) => v.id === o.vinculoId)
        return {
          ocorrenciaId: o.id,
          paciente: { id: o.pacienteId, nome: banco.pacientes.find((p) => p.id === o.pacienteId)?.nome ?? '—' },
          escola: banco.escolas.find((e) => e.id === vinculo?.escolaId)?.nome ?? '—',
          registradaEm: o.registradaEm,
          tipo: o.tipo,
          intensidade: o.intensidade,
        }
      })
    return paginar(itens, filtro)
  }),
}
