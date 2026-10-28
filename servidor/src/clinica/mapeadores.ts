import type {
  AtividadeCasa, CartaoEstrategia, Consentimento, ExecucaoAtividadeCasa, Intensidade, NivelSuporte, Objetivo,
  OcorrenciaComportamental, PlanoTerapeutico, RegistroAtividade, ResponsavelNaFicha, Sessao,
} from '@sinctea/compartilhado'
import type {
  AtividadeCasa as LinhaAtividade, CartaoEstrategia as LinhaCartao, Consentimento as LinhaConsentimento,
  ExecucaoAtividadeCasa as LinhaExecucao, Objetivo as LinhaObjetivo,
  OcorrenciaComportamental as LinhaOcorrencia, PlanoTerapeutico as LinhaPlano, RegistroAtividade as LinhaRegistro,
  Sessao as LinhaSessao, Usuario as LinhaUsuario, VinculoFamiliar as LinhaVinculo,
} from '../gerado/client.js'

/**
 * Do banco para os tipos do compartilhado (docs/01, secao 5): nenhuma resposta
 * devolve modelo do Prisma. Data civil sai "AAAA-MM-DD", instante sai ISO.
 */

/** A coluna date volta do driver como meia-noite UTC daquele dia: o dia e o texto dela. */
export const paraDataCivil = (d: Date) => d.toISOString().slice(0, 10)
export const deDataCivil = (d: string) => new Date(`${d}T00:00:00.000Z`)
const instante = (d: Date | null) => d?.toISOString() ?? null

export function paraObjetivo(o: LinhaObjetivo): Objetivo {
  return {
    id: o.id, planoId: o.planoId, dominio: o.dominio, descricaoTecnica: o.descricaoTecnica,
    descricaoAcessivel: o.descricaoAcessivel, status: o.status, dominadoEm: instante(o.dominadoEm),
    percentualAtual: Number(o.percentualAtual),
    criterio: { percentualMinimo: o.percentualMinimo, sessoesConsecutivas: o.sessoesConsecutivas },
  }
}

export function paraPlano(p: LinhaPlano & { objetivos: LinhaObjetivo[] }): PlanoTerapeutico {
  return {
    id: p.id, pacienteId: p.pacienteId, autorId: p.autorId,
    status: p.status, dataInicio: paraDataCivil(p.dataInicio), dataRevisao: paraDataCivil(p.dataRevisao),
    ultimaRevisaoEm: instante(p.ultimaRevisaoEm), observacaoValidacao: p.observacaoValidacao,
    // Ordem de criacao: o id e UUID v7, que cresce com o tempo.
    objetivos: [...p.objetivos].sort((a, b) => a.id.localeCompare(b.id)).map(paraObjetivo),
  }
}

export function paraRegistro(r: LinhaRegistro): RegistroAtividade {
  return { id: r.id, objetivoId: r.objetivoId, ordem: r.ordem, resultado: r.resultado, ocorridoEm: r.ocorridoEm.toISOString() }
}

export function paraSessao(s: LinhaSessao & { registros: LinhaRegistro[] }): Sessao {
  return {
    id: s.id, pacienteId: s.pacienteId, profissionalId: s.profissionalId, numero: s.numero,
    inicioPrevistoEm: s.inicioPrevistoEm.toISOString(), inicio: instante(s.inicio), fim: instante(s.fim),
    local: s.local, situacao: s.situacao, statusSync: s.statusSync, evolucao: s.evolucao,
    registros: [...s.registros].sort((a, b) => a.ordem - b.ordem).map(paraRegistro),
  }
}

export function paraCartao(c: LinhaCartao): CartaoEstrategia {
  return {
    id: c.id, objetivoId: c.objetivoId, tituloSimples: c.tituloSimples, oQueFazer: c.oQueFazer,
    oQueEvitar: c.oQueEvitar, sinalAlerta: c.sinalAlerta, atualizadoEm: c.atualizadoEm.toISOString(),
  }
}

export function paraConsentimento(c: LinhaConsentimento): Consentimento {
  return {
    id: c.id, responsavelId: c.responsavelId, pacienteId: c.pacienteId, escolaId: c.escolaId,
    escopos: c.escopos, concedidoEm: c.concedidoEm.toISOString(), validadeAte: paraDataCivil(c.validadeAte),
    revogadoEm: instante(c.revogadoEm), hashTermo: c.hashTermo,
  }
}

export function paraResponsavelNaFicha(
  v: LinhaVinculo & { responsavel: { telefone: string; usuario: LinhaUsuario } },
): ResponsavelNaFicha {
  return {
    id: v.id, responsavelId: v.responsavelId, pacienteId: v.pacienteId, parentesco: v.parentesco,
    responsavelLegal: v.responsavelLegal, nome: v.responsavel.usuario.nome, email: v.responsavel.usuario.email,
    telefone: v.responsavel.telefone,
    // Quem ja definiu a senha ja entrou ao menos uma vez: ultimoAcessoEm deixa de ser nulo.
    primeiroAcessoPendente: v.responsavel.usuario.ultimoAcessoEm === null,
  }
}

export const comoNivel = (n: number) => n as NivelSuporte

export function paraOcorrencia(o: LinhaOcorrencia): OcorrenciaComportamental {
  return {
    id: o.id, pacienteId: o.pacienteId, origem: o.origem, ocorridaEm: o.ocorridaEm.toISOString(),
    antecedente: o.antecedente, comportamento: o.comportamento, consequencia: o.consequencia,
    intensidade: o.intensidade as Intensidade, leituraClinicaEm: instante(o.leituraClinicaEm),
    sessaoId: o.sessaoId, ocorrenciaEscolarId: o.ocorrenciaEscolarId,
  }
}

/** A atividade leva o id do objetivo, e nao o objetivo: nada clinico sai para a familia (item 15). */
export function paraAtividade(a: LinhaAtividade): AtividadeCasa {
  return {
    id: a.id, pacienteId: a.pacienteId, objetivoId: a.objetivoId, titulo: a.titulo, descricao: a.descricao,
    passos: a.passos, dicas: a.dicas, frequenciaSemanal: a.frequenciaSemanal, urlVideo: a.urlVideo, ativa: a.ativa,
    prescritaEm: a.prescritaEm.toISOString(),
  }
}

export function paraExecucao(e: LinhaExecucao): ExecucaoAtividadeCasa {
  return {
    id: e.id, atividadeId: e.atividadeId, responsavelId: e.responsavelId, dataRealizacao: paraDataCivil(e.dataRealizacao),
    desempenho: e.desempenho, observacao: e.observacao,
  }
}
