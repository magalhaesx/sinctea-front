import { Injectable } from '@nestjs/common'
import {
  ErroServico, type FiltroSessao, type OcorrenciaComportamental, type Pagina, type RegistroAtividade, type Resultado,
  type Sessao,
} from '@sinctea/compartilhado'
import { erroDaEvolucao, percentualIndependente } from '@sinctea/compartilhado/dominio/regras'
import { Negacao } from '../acesso/negacao.js'
import { ServicoBanco } from '../banco/servico-banco.js'
import { paginar } from '../http/paginacao.js'
import type { SessaoServidor } from '../http/tipos-http.js'
import { exigirUuid, exigirValido } from '../http/validacao.js'
import { exigirPacienteClinico } from './alcance.js'
import { paraOcorrencia, paraRegistro, paraSessao } from './mapeadores.js'
import type { DoPaciente } from './servico-planos.js'

const RESULTADOS: Resultado[] = ['INDEPENDENTE', 'AJUDA_GESTUAL', 'AJUDA_FISICA', 'SEM_RESPOSTA']

/**
 * Sessao terapeutica (UC02, tela 7), portada de src/servicos/mock/clinica.ts.
 * Feita no servidor, a sessao ja nasce sincronizada: PENDENTE e o que o
 * registro offline (docs/07, secao 3A) vai usar, quando existir.
 */
@Injectable()
export class ServicoSessoesClinicas {
  constructor(private readonly banco: ServicoBanco) {}

  async listarPorPaciente(sessao: SessaoServidor, pacienteId: string, filtro: FiltroSessao): Promise<Pagina<Sessao>> {
    const paciente = await exigirPacienteClinico(this.banco, sessao, pacienteId)
    const linhas = await this.banco.sessao.findMany({
      where: { pacienteId: paciente.id, ...(filtro.situacao ? { situacao: filtro.situacao } : {}) },
      include: { registros: true }, orderBy: { numero: 'desc' },
    })
    return paginar(linhas.map(paraSessao), filtro)
  }

  private async sessaoAlcancada(sessao: SessaoServidor, sessaoId: string) {
    const linha = await this.banco.sessao.findUnique({ where: { id: exigirUuid(sessaoId, 'Sessão') }, include: { registros: true } })
    if (!linha) throw new ErroServico('NAO_ENCONTRADO', 'Sessão não encontrada.')
    await exigirPacienteClinico(this.banco, sessao, linha.pacienteId)
    return linha
  }

  async obter(sessao: SessaoServidor, sessaoId: string): Promise<Sessao> {
    return paraSessao(await this.sessaoAlcancada(sessao, sessaoId))
  }

  /** Inicia uma sessao agendada ou cria uma nova, conduzida por quem esta na sessao de login. */
  async iniciar(sessao: SessaoServidor, pacienteId: unknown, sessaoAgendadaId: unknown): Promise<Sessao> {
    const paciente = await exigirPacienteClinico(this.banco, sessao, typeof pacienteId === 'string' ? pacienteId : '')
    const agora = new Date()
    if (typeof sessaoAgendadaId === 'string' && sessaoAgendadaId) {
      const agendada = await this.sessaoAlcancada(sessao, sessaoAgendadaId)
      if (agendada.pacienteId !== paciente.id || agendada.profissionalId !== sessao.usuario.id) {
        throw new Negacao('Esta sessão está agendada para outro profissional.', { pacienteId: paciente.id, detalhe: 'Sessão agendada para outro profissional.' })
      }
      if (agendada.situacao === 'EM_ANDAMENTO') return paraSessao(agendada)
      if (agendada.situacao !== 'AGENDADA' && agendada.situacao !== 'PAUSADA') {
        throw new ErroServico('CONFLITO', 'Esta sessão já foi encerrada.')
      }
      return paraSessao(await this.banco.sessao.update({
        where: { id: agendada.id },
        data: { situacao: 'EM_ANDAMENTO', inicio: agendada.inicio ?? agora, statusSync: 'SINCRONIZADO' },
        include: { registros: true },
      }))
    }
    const numero = await this.banco.sessao.count({ where: { pacienteId: paciente.id } }) + 1
    return paraSessao(await this.banco.sessao.create({
      data: {
        pacienteId: paciente.id, profissionalId: sessao.usuario.id, numero, inicioPrevistoEm: agora, inicio: agora,
        fim: null, local: 'Clínica', situacao: 'EM_ANDAMENTO', statusSync: 'SINCRONIZADO',
      },
      include: { registros: true },
    }))
  }

  /** So quem conduz a sessao registra nela (Sessao *—1 Profissional, "conduzida por"). */
  private async exigirConducao(sessao: SessaoServidor, sessaoId: string) {
    const linha = await this.sessaoAlcancada(sessao, sessaoId)
    if (linha.profissionalId !== sessao.usuario.id) {
      throw new Negacao('Somente o profissional que conduz a sessão pode registrar nela.', {
        pacienteId: linha.pacienteId, detalhe: 'Registro em sessão conduzida por outro profissional.',
      })
    }
    return linha
  }

  private exigirEmAndamento(linha: { situacao: string }): void {
    if (linha.situacao !== 'EM_ANDAMENTO') throw new ErroServico('CONFLITO', 'A sessão não está em andamento.')
  }

  async registrarAtividade(sessao: SessaoServidor, sessaoId: string, objetivoId: unknown, resultado: unknown): Promise<DoPaciente<RegistroAtividade>> {
    const linha = await this.exigirConducao(sessao, sessaoId)
    this.exigirEmAndamento(linha)
    if (!RESULTADOS.includes(resultado as Resultado)) {
      throw new ErroServico('VALIDACAO', 'Resultado desconhecido.', { resultado: 'Resultado desconhecido.' })
    }
    const doPlano = typeof objetivoId === 'string' && /^[0-9a-f-]{36}$/i.test(objetivoId)
      && await this.banco.objetivo.count({ where: { id: objetivoId, plano: { pacienteId: linha.pacienteId } } }) > 0
    if (!doPlano) throw new ErroServico('VALIDACAO', 'O objetivo não pertence ao plano deste paciente.')
    const registro = await this.banco.registroAtividade.create({ data: {
      sessaoId: linha.id, objetivoId: objetivoId as string, resultado: resultado as Resultado,
      ordem: linha.registros.length + 1, ocorridoEm: new Date(),
    } })
    return { resultado: paraRegistro(registro), pacienteId: linha.pacienteId }
  }

  async desfazerUltimoRegistro(sessao: SessaoServidor, sessaoId: string): Promise<Sessao> {
    const linha = await this.exigirConducao(sessao, sessaoId)
    this.exigirEmAndamento(linha)
    const ultimo = [...linha.registros].sort((a, b) => b.ordem - a.ordem)[0]
    if (ultimo) await this.banco.registroAtividade.delete({ where: { id: ultimo.id } })
    return this.obter(sessao, linha.id)
  }

  async pausar(sessao: SessaoServidor, sessaoId: string): Promise<Sessao> {
    const linha = await this.exigirConducao(sessao, sessaoId)
    this.exigirEmAndamento(linha)
    return paraSessao(await this.banco.sessao.update({ where: { id: linha.id }, data: { situacao: 'PAUSADA' }, include: { registros: true } }))
  }

  /**
   * Ocorrencia comportamental registrada na sessao (registro ABC), pelo
   * profissional que a conduz. Quem registra ja e o profissional habilitado:
   * a leitura clinica e esta, e o evento nao entra nos avisos.
   */
  async registrarOcorrencia(sessao: SessaoServidor, sessaoId: string, dados: Record<string, unknown>): Promise<DoPaciente<OcorrenciaComportamental>> {
    const linha = await this.exigirConducao(sessao, sessaoId)
    this.exigirEmAndamento(linha)
    const texto = (valor: unknown) => (typeof valor === 'string' ? valor.trim() : '')
    const conteudo = {
      antecedente: texto(dados.antecedente), comportamento: texto(dados.comportamento),
      consequencia: texto(dados.consequencia), intensidade: Number(dados.intensidade),
    }
    const erros: Record<string, string> = {}
    if (!conteudo.antecedente) erros.antecedente = 'Descreva o que aconteceu antes.'
    if (!conteudo.comportamento) erros.comportamento = 'Descreva o comportamento.'
    if (!conteudo.consequencia) erros.consequencia = 'Descreva o que aconteceu depois.'
    if (![1, 2, 3, 4, 5].includes(conteudo.intensidade)) erros.intensidade = 'Escolha a intensidade, de 1 a 5.'
    exigirValido(erros)
    const agora = new Date()
    const ocorrencia = await this.banco.ocorrenciaComportamental.create({ data: {
      pacienteId: linha.pacienteId, origem: 'CLINICA', ocorridaEm: agora, ...conteudo,
      leituraClinicaEm: agora, sessaoId: linha.id, ocorrenciaEscolarId: null,
    } })
    return { resultado: paraOcorrencia(ocorrencia), pacienteId: linha.pacienteId }
  }

  /**
   * Encerra com a evolucao do profissional (Resolucao CFP 001/2009), e o
   * objetivo trabalhado passa a mostrar o percentual de independencia desta
   * sessao — o medidor da tela 6. A evolucao e gravada como veio: o sistema
   * nao a gera, nao a completa e nao a corrige.
   */
  async encerrar(sessao: SessaoServidor, sessaoId: string, evolucao: unknown): Promise<Sessao> {
    const linha = await this.exigirConducao(sessao, sessaoId)
    if (linha.situacao !== 'EM_ANDAMENTO' && linha.situacao !== 'PAUSADA') {
      throw new ErroServico('CONFLITO', 'A sessão não está aberta.')
    }
    const texto = typeof evolucao === 'string' ? evolucao : ''
    const erro = erroDaEvolucao(texto)
    if (erro) throw new ErroServico('VALIDACAO', erro, { evolucao: erro })
    const registros = linha.registros.map(paraRegistro)
    const trabalhados = [...new Set(registros.map((r) => r.objetivoId))]
    const encerrada = await this.banco.$transaction(async (tx) => {
      for (const objetivoId of trabalhados) {
        const percentual = percentualIndependente(registros, objetivoId)
        if (percentual === null) continue
        await tx.objetivo.update({ where: { id: objetivoId }, data: { percentualAtual: percentual } })
        // Primeira sessao em que o objetivo foi trabalhado: deixa de ser "nao iniciado".
        await tx.objetivo.updateMany({ where: { id: objetivoId, status: 'NAO_INICIADO' }, data: { status: 'EM_AQUISICAO' } })
      }
      return tx.sessao.update({ where: { id: linha.id }, data: { situacao: 'ENCERRADA', fim: new Date(), evolucao: texto }, include: { registros: true } })
    })
    return paraSessao(encerrada)
  }
}
