import { Injectable } from '@nestjs/common'
import {
  ErroServico, type AvisoOcorrenciaEscolar, type FiltroPaginacao, type Intensidade, type OcorrenciaComportamental,
  type Origem, type Pagina,
} from '@sinctea/compartilhado'
import { ehPreliminar } from '@sinctea/compartilhado/dominio/regras'
import { ServicoBanco } from '../banco/servico-banco.js'
import { paginar } from '../http/paginacao.js'
import type { SessaoServidor } from '../http/tipos-http.js'
import { exigirUuid } from '../http/validacao.js'
import { alcancaClinicamente, exigirPacienteClinico } from './alcance.js'
import { paraOcorrencia } from './mapeadores.js'
import type { DoPaciente } from './servico-planos.js'

/** Janela dos avisos da escola no painel, quando quem pede nao diz outra. */
const DIAS_DOS_AVISOS = 7

export interface FiltroOcorrenciaServidor extends FiltroPaginacao {
  origem?: Origem
  desde?: Date
}

/**
 * Eventos comportamentais e avisos da escola na clinica (UC10, tela 3; tela
 * 5), portados de src/servicos/mock/clinica.ts. E o fim do ciclo
 * clinica–escola: o professor relata o que observou, o relato entra como
 * evento preliminar, e a leitura clinica e do profissional habilitado. So a
 * equipe do paciente — e a coordenacao — alcanca o evento (regra 3).
 */
@Injectable()
export class ServicoOcorrencias {
  constructor(private readonly banco: ServicoBanco) {}

  /** Todos os eventos do paciente, de todas as origens, do mais recente ao mais antigo. */
  async listarPorPaciente(sessao: SessaoServidor, pacienteId: string, filtro: FiltroOcorrenciaServidor): Promise<Pagina<OcorrenciaComportamental>> {
    const paciente = await exigirPacienteClinico(this.banco, sessao, pacienteId)
    const linhas = await this.banco.ocorrenciaComportamental.findMany({
      where: {
        pacienteId: paciente.id,
        ...(filtro.origem ? { origem: filtro.origem } : {}),
        ...(filtro.desde ? { ocorridaEm: { gte: filtro.desde } } : {}),
      },
      orderBy: [{ ocorridaEm: 'desc' }, { id: 'desc' }],
    })
    return paginar(linhas.map(paraOcorrencia), filtro)
  }

  /**
   * Os relatos recentes da escola que ainda esperam a leitura clinica, dos
   * pacientes que quem pede alcanca. Registrada a leitura, o aviso sai da
   * lista: o painel mostra o que espera pelo profissional, e nao o historico.
   */
  async listarAvisosDaEscola(sessao: SessaoServidor, filtro: FiltroOcorrenciaServidor): Promise<Pagina<AvisoOcorrenciaEscolar>> {
    const desde = filtro.desde ?? new Date(Date.now() - DIAS_DOS_AVISOS * 86_400_000)
    const linhas = await this.banco.ocorrenciaComportamental.findMany({
      where: { origem: 'ESCOLA', leituraClinicaEm: null, ocorrenciaEscolar: { registradaEm: { gte: desde } } },
      include: {
        paciente: { include: { equipe: true } },
        ocorrenciaEscolar: { include: { vinculo: { include: { consentimento: { include: { escola: true } } } } } },
      },
    })
    const itens = linhas
      // O mesmo alcance da ficha, de alcance.ts: o terapeuta, so a equipe do paciente.
      .filter((o) => alcancaClinicamente(sessao, o.paciente.equipe.map((e) => e.profissionalId)))
      .flatMap((o): AvisoOcorrenciaEscolar[] => {
        const escolar = o.ocorrenciaEscolar
        if (!escolar) return []
        return [{
          ocorrenciaId: o.id,
          paciente: { id: o.paciente.id, nome: o.paciente.nome },
          escola: escolar.vinculo.consentimento.escola.nome,
          registradaEm: escolar.registradaEm.toISOString(),
          tipo: escolar.tipo,
          intensidade: escolar.intensidade as Intensidade,
        }]
      })
      .sort((a, b) => b.registradaEm.localeCompare(a.registradaEm))
    return paginar(itens, filtro)
  }

  /** A leitura clinica do evento preliminar, uma vez so. */
  async registrarLeituraClinica(sessao: SessaoServidor, ocorrenciaId: string): Promise<DoPaciente<OcorrenciaComportamental>> {
    const ocorrencia = await this.banco.ocorrenciaComportamental.findUnique({ where: { id: exigirUuid(ocorrenciaId, 'Ocorrência') } })
    if (!ocorrencia) throw new ErroServico('NAO_ENCONTRADO', 'Ocorrência não encontrada.')
    await exigirPacienteClinico(this.banco, sessao, ocorrencia.pacienteId)
    if (!ehPreliminar(paraOcorrencia(ocorrencia))) {
      throw new ErroServico('CONFLITO', 'A leitura clínica deste evento já foi registrada.')
    }
    // Condicional na gravacao: dois profissionais ao mesmo tempo, so um registra.
    const gravada = await this.banco.ocorrenciaComportamental.updateMany({
      where: { id: ocorrencia.id, leituraClinicaEm: null }, data: { leituraClinicaEm: new Date() },
    })
    if (gravada.count !== 1) throw new ErroServico('CONFLITO', 'A leitura clínica deste evento já foi registrada.')
    const lida = await this.banco.ocorrenciaComportamental.findUniqueOrThrow({ where: { id: ocorrencia.id } })
    return { resultado: paraOcorrencia(lida), pacienteId: lida.pacienteId }
  }
}
