import { Injectable } from '@nestjs/common'
import {
  ErroServico, type AtividadeCasa, type ExecucaoAtividadeCasa, type FiltroPaginacao, type Pagina,
} from '@sinctea/compartilhado'
import { diaCivilEm } from '@sinctea/compartilhado/dominio/datas'
import {
  ATIVIDADE_ENCERRADA, atividadeCasaPreenchida, ehDesempenho, erroDaObservacaoDaFamilia, textoDoRegistroRepetido,
  validarNovaAtividadeCasa,
} from '@sinctea/compartilhado/dominio/regras'
import { ServicoBanco } from '../banco/servico-banco.js'
import { exigirPacienteClinico } from '../clinica/alcance.js'
import {
  deDataCivil, OBJETIVO_DA_ATIVIDADE, paraAtividade, paraExecucao, QUEM_REGISTROU,
} from '../clinica/mapeadores.js'
import type { DoPaciente } from '../clinica/servico-planos.js'
import { exigirPacienteDaFamilia } from '../familia/acesso-familia.js'
import { paginar } from '../http/paginacao.js'
import type { SessaoServidor } from '../http/tipos-http.js'
import { exigirUuid, exigirValido, textoOuVazio } from '../http/validacao.js'

export interface FiltroAtividadeServidor extends FiltroPaginacao {
  ativa?: boolean
}

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Atividades de casa (UC07, UC14; telas 9 e 16, e o bloco "Atividades desta
 * semana" da tela 15), portadas de src/servicos/mock/familia.ts, com as
 * decisoes do Cowork de 28/10 valendo sobre o mock (item 15).
 *
 * Prescrever e encerrar sao da clinica que alcanca o paciente: a equipe dele
 * e a coordenacao. Ver a atividade e registrar como foi sao de qualquer
 * responsavel vinculado, legal ou nao. Professor e administrador nunca
 * alcancam (regra 3).
 */
@Injectable()
export class ServicoAtividades {
  constructor(private readonly banco: ServicoBanco) {}

  /** A familia pelo vinculo; o resto, pelo alcance clinico, que nega professor e administrador. */
  private async alcancarPaciente(sessao: SessaoServidor, pacienteId: string): Promise<{ pacienteId: string; daFamilia: boolean }> {
    if (sessao.perfilAtivo === 'RESPONSAVEL') {
      const { paciente } = await exigirPacienteDaFamilia(this.banco, sessao, pacienteId)
      return { pacienteId: paciente.id, daFamilia: true }
    }
    const paciente = await exigirPacienteClinico(this.banco, sessao, pacienteId)
    return { pacienteId: paciente.id, daFamilia: false }
  }

  private async buscar(atividadeId: string) {
    const atividade = await this.banco.atividadeCasa.findUnique({
      where: { id: exigirUuid(atividadeId, 'Atividade') }, include: OBJETIVO_DA_ATIVIDADE,
    })
    if (!atividade) throw new ErroServico('NAO_ENCONTRADO', 'Atividade não encontrada.')
    return atividade
  }

  async listarPorPaciente(sessao: SessaoServidor, pacienteId: string, filtro: FiltroAtividadeServidor): Promise<Pagina<AtividadeCasa>> {
    const alcance = await this.alcancarPaciente(sessao, pacienteId)
    // Encerrada, a atividade sai da lista da familia, qualquer que seja o filtro pedido.
    const ativa = alcance.daFamilia ? true : filtro.ativa
    const linhas = await this.banco.atividadeCasa.findMany({
      where: { pacienteId: alcance.pacienteId, ...(ativa === undefined ? {} : { ativa }) },
      orderBy: [{ prescritaEm: 'desc' }, { id: 'desc' }],
      include: OBJETIVO_DA_ATIVIDADE,
    })
    return paginar(linhas.map(paraAtividade), filtro)
  }

  /**
   * A encerrada continua se abrindo pelo endereco: a tela 16 diz que a equipe
   * a encerrou e mostra o que a familia ja registrou.
   */
  async obter(sessao: SessaoServidor, atividadeId: string): Promise<AtividadeCasa> {
    const atividade = await this.buscar(atividadeId)
    await this.alcancarPaciente(sessao, atividade.pacienteId)
    return paraAtividade(atividade)
  }

  /**
   * So com um objetivo do plano VIGENTE do paciente, o mesmo recorte que a
   * familia le na tela 15: o objetivo em rascunho ainda nao passou pela
   * coordenacao. Que objetivo e atividade sao do mesmo paciente, o trigger
   * atividade_casa_mesmo_paciente garante tambem no banco.
   */
  async prescrever(sessao: SessaoServidor, dados: Record<string, unknown>): Promise<AtividadeCasa> {
    const paciente = await exigirPacienteClinico(this.banco, sessao, textoOuVazio(dados.pacienteId))
    const escrita = atividadeCasaPreenchida({
      titulo: textoOuVazio(dados.titulo),
      descricao: textoOuVazio(dados.descricao),
      passos: Array.isArray(dados.passos) ? dados.passos.map(textoOuVazio) : [],
      dicas: textoOuVazio(dados.dicas),
      frequenciaSemanal: typeof dados.frequenciaSemanal === 'number' ? dados.frequenciaSemanal : Number.NaN,
      urlVideo: textoOuVazio(dados.urlVideo) || null,
    })
    const erros = validarNovaAtividadeCasa(escrita)
    const objetivoId = textoOuVazio(dados.objetivoId)
    const objetivo = FORMATO_UUID.test(objetivoId)
      ? await this.banco.objetivo.findUnique({ where: { id: objetivoId.toLowerCase() }, include: { plano: true } })
      : null
    if (!objetivo || objetivo.plano.pacienteId !== paciente.id || objetivo.plano.status !== 'VIGENTE') {
      erros.objetivoId = 'Escolha um objetivo do plano vigente deste paciente.'
    }
    exigirValido(erros)
    const criada = await this.banco.atividadeCasa.create({
      data: { pacienteId: paciente.id, objetivoId: objetivo!.id, ...escrita, ativa: true, prescritaEm: new Date() },
      include: OBJETIVO_DA_ATIVIDADE,
    })
    return paraAtividade(criada)
  }

  /** A familia deixa de ve-la; o que ela registrou continua no historico. */
  async encerrar(sessao: SessaoServidor, atividadeId: string): Promise<AtividadeCasa> {
    const atividade = await this.buscar(atividadeId)
    await exigirPacienteClinico(this.banco, sessao, atividade.pacienteId)
    // Condicional na gravacao: dois encerramentos ao mesmo tempo, so um grava.
    const gravada = await this.banco.atividadeCasa.updateMany({ where: { id: atividade.id, ativa: true }, data: { ativa: false } })
    if (gravada.count !== 1) throw new ErroServico('CONFLITO', 'Esta atividade já foi encerrada.')
    return paraAtividade(await this.banco.atividadeCasa.findUniqueOrThrow({ where: { id: atividade.id }, include: OBJETIVO_DA_ATIVIDADE }))
  }

  /**
   * Um registro por atividade por dia, no dia civil de Manaus. Quem decide e
   * o indice unico (atividadeId, dataRealizacao): dois pedidos ao mesmo tempo,
   * um grava e o outro ouve quem registrou.
   */
  async registrarExecucao(sessao: SessaoServidor, atividadeId: string, corpo: Record<string, unknown>): Promise<DoPaciente<ExecucaoAtividadeCasa>> {
    const atividade = await this.buscar(atividadeId)
    await exigirPacienteDaFamilia(this.banco, sessao, atividade.pacienteId)
    const desempenho = ehDesempenho(corpo.desempenho) ? corpo.desempenho : null
    const observacao = textoOuVazio(corpo.observacao)
    const erros: Record<string, string> = {}
    if (!desempenho) erros.desempenho = 'Escolha como foi hoje.'
    const erroDaObservacao = erroDaObservacaoDaFamilia(observacao)
    if (erroDaObservacao) erros.observacao = erroDaObservacao
    exigirValido(erros)

    const dataRealizacao = deDataCivil(diaCivilEm(new Date()))
    try {
      const execucao = await this.banco.$transaction(async (tx) => {
        // A atividade travada ate o fim do registro: o encerramento que chegar
        // junto espera, ou este registro ja a ve encerrada.
        const [linha] = await tx.$queryRaw<Array<{ ativa: boolean }>>`
          SELECT "ativa" FROM "atividade_casa" WHERE "id" = ${atividade.id}::uuid FOR SHARE`
        if (!linha?.ativa) throw new ErroServico('CONFLITO', ATIVIDADE_ENCERRADA)
        return tx.execucaoAtividadeCasa.create({
          data: {
            atividadeId: atividade.id, responsavelId: sessao.usuario.id, dataRealizacao, desempenho: desempenho!,
            observacao: observacao || null,
          },
          include: QUEM_REGISTROU,
        })
      })
      return { resultado: paraExecucao(execucao), pacienteId: atividade.pacienteId }
    } catch (erro) {
      if ((erro as { code?: string }).code !== 'P2002') throw erro
      const doDia = await this.banco.execucaoAtividadeCasa.findUnique({
        where: { atividadeId_dataRealizacao: { atividadeId: atividade.id, dataRealizacao } },
        include: QUEM_REGISTROU,
      })
      throw new ErroServico('CONFLITO', textoDoRegistroRepetido(doDia?.responsavel.usuario.nome ?? 'outro responsável'))
    }
  }

  async listarExecucoes(sessao: SessaoServidor, atividadeId: string, filtro: FiltroPaginacao): Promise<DoPaciente<Pagina<ExecucaoAtividadeCasa>>> {
    const atividade = await this.buscar(atividadeId)
    await this.alcancarPaciente(sessao, atividade.pacienteId)
    const linhas = await this.banco.execucaoAtividadeCasa.findMany({
      where: { atividadeId: atividade.id }, orderBy: [{ dataRealizacao: 'desc' }, { id: 'desc' }],
      include: QUEM_REGISTROU,
    })
    return { resultado: paginar(linhas.map(paraExecucao), filtro), pacienteId: atividade.pacienteId }
  }
}
