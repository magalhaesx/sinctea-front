import { Injectable } from '@nestjs/common'
import {
  ErroServico, type AlertaAtencao, type FiltroPaginacao, type MotivoAtencao, type Pagina, type PonteEscola,
  type ResumoClinica, type SessoesPorProfissional,
} from '@sinctea/compartilhado'
import { diaCivilEm } from '@sinctea/compartilhado/dominio/datas'
import {
  alertaConsentimentoVencendo, alertaObjetivoSemAvanco, alertaPacienteSemSessao, alertaPlanoSemRevisao,
  diasInteiros, horasAteLeitura, JANELA_CURTA_DIAS, JANELA_LONGA_DIAS, janelaFutura, janelaPassada, mediana,
  ordenarAlertas, rotuloDeHoje, rotuloFuturo, rotuloPassado,
} from '@sinctea/compartilhado/dominio/indicadores'
import { percentualIndependente } from '@sinctea/compartilhado/dominio/regras'
import { ServicoBanco } from '../banco/servico-banco.js'
import { deDataCivil, paraConsentimento, paraDataCivil, paraRegistro } from '../clinica/mapeadores.js'
import { paginar } from '../http/paginacao.js'

export const MOTIVOS: MotivoAtencao[] = ['PLANO_SEM_REVISAO', 'PACIENTE_SEM_SESSAO', 'CONSENTIMENTO_VENCENDO', 'OBJETIVO_SEM_AVANCO']

const existe = <T>(x: T | null): x is T => x !== null

/**
 * Indicadores da coordenacao (UC18, tela 11; item 19), portado de
 * src/servicos/mock/indicadores.ts. Conta e aponta, nao descreve: sai daqui
 * so numero, motivo, id e nome do paciente — nenhum texto clinico. O recorte,
 * os rotulos, a ordem e os alertas sao os de dominio/indicadores.ts, os
 * mesmos do mock; os limiares, os de dominio/regras.ts.
 *
 * Os numeros sao contados no banco. Os alertas sao calculados aqui, sobre os
 * pacientes ativos, com as funcoes do dominio, e paginados depois; o objetivo
 * parado le os registros das sessoes encerradas dos pacientes com plano
 * vigente. O limite de escala disso esta no docs/06.
 */
@Injectable()
export class ServicoIndicadores {
  constructor(private readonly banco: ServicoBanco) {}

  async resumo(agora = new Date()): Promise<ResumoClinica> {
    const semana = janelaPassada(agora, JANELA_CURTA_DIAS)
    const mes = janelaPassada(agora, JANELA_LONGA_DIAS)
    const adiante = janelaFutura(agora, JANELA_LONGA_DIAS)
    const [pacientes, sessoes, dominados, revisoes, algumaSessao] = await Promise.all([
      this.banco.paciente.count({ where: { ativo: true } }),
      // Sessao que aconteceu e sessao encerrada: agendada nao conta como feita.
      this.banco.sessao.count({ where: { situacao: 'ENCERRADA', inicio: { gte: semana.desde, lt: semana.ate } } }),
      this.banco.objetivo.count({ where: { dominadoEm: { gte: mes.desde, lt: mes.ate }, plano: { paciente: { ativo: true } } } }),
      // So o plano vigente tem revisao a cumprir; a coluna e dia civil, contra dia civil.
      this.banco.planoTerapeutico.count({ where: {
        status: 'VIGENTE', paciente: { ativo: true },
        dataRevisao: { gte: deDataCivil(adiante.primeiroDia), lte: deDataCivil(adiante.ultimoDia) },
      } }),
      // O agendamento, sozinho, nao conta: so a sessao que comecou (item 19b).
      this.banco.sessao.findFirst({ where: { inicio: { not: null } }, select: { id: true } }),
    ])
    return {
      // Clinica sem nenhuma sessao registrada nao tem indicador para mostrar.
      temDados: algumaSessao !== null,
      pacientesEmAcompanhamento: { valor: pacientes, periodo: rotuloDeHoje(agora) },
      sessoesUltimos7Dias: { valor: sessoes, periodo: rotuloPassado(agora, JANELA_CURTA_DIAS) },
      objetivosDominadosUltimos30Dias: { valor: dominados, periodo: rotuloPassado(agora, JANELA_LONGA_DIAS) },
      planosComRevisaoProximos30Dias: { valor: revisoes, periodo: rotuloFuturo(agora, JANELA_LONGA_DIAS) },
    }
  }

  async listarAlertas(motivo: string, filtro: FiltroPaginacao, agora = new Date()): Promise<Pagina<AlertaAtencao>> {
    if (!MOTIVOS.includes(motivo as MotivoAtencao)) {
      throw new ErroServico('VALIDACAO', 'Motivo de atenção desconhecido.', { motivo: 'Motivo de atenção desconhecido.' })
    }
    const doMotivo = motivo as MotivoAtencao
    return paginar(ordenarAlertas(await this.alertas(doMotivo, agora), doMotivo), filtro)
  }

  private async alertas(motivo: MotivoAtencao, agora: Date): Promise<AlertaAtencao[]> {
    const pessoa = { select: { id: true, nome: true } } as const
    switch (motivo) {
      case 'PLANO_SEM_REVISAO': {
        const planos = await this.banco.planoTerapeutico.findMany({
          where: { status: 'VIGENTE', paciente: { ativo: true } },
          select: { id: true, status: true, dataInicio: true, ultimaRevisaoEm: true, paciente: pessoa },
        })
        return planos.map((p) => alertaPlanoSemRevisao({
          id: p.id, status: p.status, dataInicio: paraDataCivil(p.dataInicio), ultimaRevisaoEm: p.ultimaRevisaoEm?.toISOString() ?? null,
        }, p.paciente, agora)).filter(existe)
      }
      case 'PACIENTE_SEM_SESSAO': {
        const [pacientes, ultimas] = await Promise.all([
          this.banco.paciente.findMany({ where: { ativo: true }, select: { id: true, nome: true } }),
          // A ultima sessao ENCERRADA de cada paciente, contada no banco.
          this.banco.sessao.groupBy({
            by: ['pacienteId'], where: { situacao: 'ENCERRADA', inicio: { not: null }, paciente: { ativo: true } },
            _max: { inicio: true },
          }),
        ])
        const ultima = new Map(ultimas.map((u) => [u.pacienteId, u._max.inicio?.toISOString() ?? null]))
        return pacientes.map((p) => alertaPacienteSemSessao(p, ultima.get(p.id) ?? null, agora)).filter(existe)
      }
      case 'CONSENTIMENTO_VENCENDO': {
        // O banco corta pela validade; o dominio decide quem esta vigente e vencendo.
        const hoje = diaCivilEm(agora)
        const consentimentos = await this.banco.consentimento.findMany({
          where: {
            paciente: { ativo: true }, revogadoEm: null,
            validadeAte: { gte: deDataCivil(hoje), lte: deDataCivil(janelaFutura(agora, JANELA_LONGA_DIAS).ultimoDia) },
          },
          include: { paciente: pessoa },
        })
        return consentimentos.map((c) => alertaConsentimentoVencendo(paraConsentimento(c), c.paciente, agora)).filter(existe)
      }
      case 'OBJETIVO_SEM_AVANCO': {
        const planos = await this.banco.planoTerapeutico.findMany({
          where: { status: 'VIGENTE', paciente: { ativo: true }, objetivos: { some: { status: 'EM_AQUISICAO' } } },
          select: {
            status: true, paciente: pessoa,
            objetivos: { where: { status: 'EM_AQUISICAO' }, select: { id: true, status: true } },
          },
        })
        const objetivoIds = planos.flatMap((p) => p.objetivos.map((o) => o.id))
        if (objetivoIds.length === 0) return []
        // Uma medida por sessao encerrada em que o objetivo foi trabalhado, em ordem de numero.
        const sessoes = await this.banco.sessao.findMany({
          where: { situacao: 'ENCERRADA', pacienteId: { in: planos.map((p) => p.paciente.id) } },
          select: { pacienteId: true, numero: true, registros: { where: { objetivoId: { in: objetivoIds } } } },
          orderBy: { numero: 'asc' },
        })
        return planos.flatMap((plano) => plano.objetivos.map((o) => {
          const percentuais = sessoes
            .filter((s) => s.pacienteId === plano.paciente.id)
            .map((s) => percentualIndependente(s.registros.map(paraRegistro), o.id))
            .filter((x): x is number => x !== null)
          return alertaObjetivoSemAvanco(o, plano.status, plano.paciente, percentuais)
        })).filter(existe)
      }
    }
  }

  /**
   * Serie de grafico, nao paginada: limitada pelo numero de profissionais.
   * Todo profissional da clinica ativo aparece, mesmo com zero, como no mock;
   * a coordenacao e a administracao sem atendimento, nao. Quem saiu, ou nao
   * tem o perfil, aparece se conduziu sessao na janela — o atendimento
   * aconteceu, e sem ele as barras nao somariam o total da clinica.
   */
  async sessoesPorProfissional(agora = new Date()): Promise<SessoesPorProfissional> {
    const mes = janelaPassada(agora, JANELA_LONGA_DIAS)
    const [contagens, profissionais] = await Promise.all([
      this.banco.sessao.groupBy({
        by: ['profissionalId'], where: { situacao: 'ENCERRADA', inicio: { gte: mes.desde, lt: mes.ate } }, _count: { _all: true },
      }),
      this.banco.usuario.findMany({ where: { profissional: { isNot: null } }, select: { id: true, nome: true, ativo: true, perfis: true } }),
    ])
    const porProfissional = new Map(contagens.map((c) => [c.profissionalId, c._count._all]))
    const itens = profissionais
      .map((p) => ({
        profissional: { id: p.id, nome: p.nome }, sessoes: porProfissional.get(p.id) ?? 0,
        atende: p.ativo && p.perfis.includes('TERAPEUTA'),
      }))
      .filter((i) => i.sessoes > 0 || i.atende)
      .sort((a, b) => b.sessoes - a.sessoes || a.profissional.nome.localeCompare(b.profissional.nome, 'pt-BR'))
      .map(({ profissional, sessoes }) => ({ profissional, sessoes }))
    return { periodo: rotuloPassado(agora, JANELA_LONGA_DIAS), itens }
  }

  async ponteEscola(agora = new Date()): Promise<PonteEscola> {
    const mes = janelaPassada(agora, JANELA_LONGA_DIAS)
    const periodo30 = rotuloPassado(agora, JANELA_LONGA_DIAS)
    const naJanela = { registradaEm: { gte: mes.desde, lt: mes.ate } }
    const [escolas, ocorrencias, lidas, aguardando] = await Promise.all([
      // A escola conta quando ha professor com vinculo ATIVO e o consentimento
      // que o sustenta esta vigente: concedido, nao revogado e dentro da
      // validade, que vale ate o fim do dia em Manaus.
      this.banco.consentimento.groupBy({
        by: ['escolaId'],
        where: {
          concedidoEm: { lte: agora }, OR: [{ revogadoEm: null }, { revogadoEm: { gt: agora } }],
          validadeAte: { gte: deDataCivil(diaCivilEm(agora)) }, vinculos: { some: { status: 'ATIVO' } },
        },
      }),
      this.banco.ocorrenciaEscolar.count({ where: naJanela }),
      // O tempo corre do registro da escola, e nao de quando aconteceu: a
      // clinica so pode ler o que ja foi registrado.
      this.banco.ocorrenciaEscolar.findMany({
        where: { ...naJanela, ocorrenciaGerada: { is: { leituraClinicaEm: { not: null } } } },
        select: { registradaEm: true, ocorrenciaGerada: { select: { leituraClinicaEm: true } } },
      }),
      // Aguardando nao tem recorte de tempo: um relato de 40 dias sem leitura
      // e exatamente o que nao pode sumir por estar fora da janela.
      this.banco.ocorrenciaEscolar.aggregate({
        where: { ocorrenciaGerada: { is: { leituraClinicaEm: null } } }, _count: { _all: true }, _min: { registradaEm: true },
      }),
    ])
    const horas = lidas.map((o) => horasAteLeitura(o.registradaEm, o.ocorrenciaGerada!.leituraClinicaEm!))
    const meio = mediana(horas)
    const maisAntiga = aguardando._min.registradaEm
    return {
      escolasComVinculoAtivo: { valor: escolas.length, periodo: rotuloDeHoje(agora) },
      ocorrenciasUltimos30Dias: { valor: ocorrencias, periodo: periodo30 },
      tempoAteLeituraClinica: { medianaHoras: meio === null ? null : Math.round(meio), leituras: horas.length, periodo: periodo30 },
      aguardandoLeitura: {
        quantidade: aguardando._count._all,
        maisAntigaHaDias: maisAntiga === null ? null : diasInteiros(maisAntiga, agora),
      },
    }
  }
}
