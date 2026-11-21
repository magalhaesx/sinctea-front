import { Injectable } from '@nestjs/common'
import {
  ErroServico, type DataCivil, type FiltroAgenda, type FiltroPaginacao, type FiltroSessao, type ItemAgenda,
  type OcorrenciaComportamental, type Pagina, type RegistroAtividade, type Resultado, type Sessao,
} from '@sinctea/compartilhado'
import {
  LOCAL_PADRAO, SO_CANCELA_AGENDADA, SO_QUEM_CONDUZ_CANCELA, agendamentoPreenchido, conflitoDeHorario, conflitoDoDia,
  recusaDoInicio, validarAgendamento,
} from '@sinctea/compartilhado/dominio/agenda'
import { diaCivilEm, fimDaValidade, inicioDoDia, partesDaDataCivil } from '@sinctea/compartilhado/dominio/datas'
import { jsonCanonico } from '@sinctea/compartilhado/dominio/hash'
import {
  TOQUE_COM_OUTRO_CONTEUDO, erroDaIdentificacaoDoToque, lerInstanteComFuso, mesmoToque,
} from '@sinctea/compartilhado/dominio/toque'
import { erroDaEvolucao, percentualIndependente } from '@sinctea/compartilhado/dominio/regras'
import { Negacao } from '../acesso/negacao.js'
import { ServicoBanco, type TransacaoBanco } from '../banco/servico-banco.js'
import { paginar } from '../http/paginacao.js'
import type { SessaoServidor } from '../http/tipos-http.js'
import { exigirUuid, exigirValido } from '../http/validacao.js'
import { exigirPacienteClinico } from './alcance.js'
import { paraOcorrencia, paraRegistro, paraSessao } from './mapeadores.js'
import type { DoPaciente, Editado } from './servico-planos.js'

const RESULTADOS: Resultado[] = ['INDEPENDENTE', 'AJUDA_GESTUAL', 'AJUDA_FISICA', 'SEM_RESPOSTA']

/**
 * Como a sessao comecou, para a trilha: a nova e criacao; a agendada e a
 * pausada que voltam a andar sao alteracao, com a situacao anterior; a que ja
 * estava em andamento so foi lida.
 */
export type ComoIniciou = 'NOVA' | 'AGENDADA' | 'RETOMADA' | 'JA_EM_ANDAMENTO'
export interface Inicio { sessao: Sessao; como: ComoIniciou }

/** O que a agenda e a ficha mostram de cada sessao: horario, situacao, local e quem. */
const DA_AGENDA = {
  paciente: { select: { nome: true } },
  profissional: { select: { usuario: { select: { nome: true } } } },
} as const

type LinhaDaAgenda = {
  id: string; pacienteId: string; profissionalId: string; inicioPrevistoEm: Date; situacao: Sessao['situacao']; local: string
  paciente: { nome: string }; profissional: { usuario: { nome: string } }
}

const paraItemAgenda = (s: LinhaDaAgenda): ItemAgenda => ({
  sessaoId: s.id,
  inicioPrevistoEm: s.inicioPrevistoEm.toISOString(),
  situacao: s.situacao,
  local: s.local,
  paciente: { id: s.pacienteId, nome: s.paciente.nome },
  profissional: { id: s.profissionalId, nome: s.profissional.usuario.nome },
})

/** O dia civil inteiro de Manaus, como instantes: de 00:00 ate antes de 00:00 do dia seguinte. */
const noDia = (dia: DataCivil) => ({ gte: inicioDoDia(dia), lt: fimDaValidade(dia) })

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
      // Da mais recente para a mais antiga; a agendada e a cancelada, sem numero, vao para o fim.
      include: { registros: true }, orderBy: [{ numero: { sort: 'desc', nulls: 'last' } }, { inicioPrevistoEm: 'desc' }],
    })
    return paginar(linhas.map(paraSessao), filtro)
  }

  /**
   * A agenda de quem pede (tela 3): as proprias sessoes, de qualquer situacao,
   * no dia civil de Manaus, pelo horario previsto. Mesmo a coordenacao ve so
   * as dela aqui. Devolve o dia, porque o registro da trilha o nomeia.
   */
  async listarAgenda(sessao: SessaoServidor, filtro: FiltroAgenda): Promise<{ pagina: Pagina<ItemAgenda>; dia: DataCivil }> {
    const dia = filtro.dia ?? diaCivilEm(new Date())
    if (!partesDaDataCivil(dia)) {
      throw new ErroServico('VALIDACAO', 'Informe o dia da agenda no formato AAAA-MM-DD.', { dia: 'Informe o dia da agenda no formato AAAA-MM-DD.' })
    }
    const linhas = await this.banco.sessao.findMany({
      where: { profissionalId: sessao.usuario.id, inicioPrevistoEm: noDia(dia) },
      include: DA_AGENDA, orderBy: [{ inicioPrevistoEm: 'asc' }, { id: 'asc' }],
    })
    return { pagina: paginar(linhas.map(paraItemAgenda), filtro), dia }
  }

  /** Os agendamentos do paciente de hoje em diante, em Manaus, de qualquer profissional (tela 5). */
  async listarProximas(sessao: SessaoServidor, pacienteId: string, filtro: FiltroPaginacao): Promise<Pagina<ItemAgenda>> {
    const paciente = await exigirPacienteClinico(this.banco, sessao, pacienteId)
    const linhas = await this.banco.sessao.findMany({
      where: { pacienteId: paciente.id, situacao: 'AGENDADA', inicioPrevistoEm: { gte: inicioDoDia(diaCivilEm(new Date())) } },
      include: DA_AGENDA, orderBy: [{ inicioPrevistoEm: 'asc' }, { id: 'asc' }],
    })
    return paginar(linhas.map(paraItemAgenda), filtro)
  }

  /**
   * Agenda para quem pede, que e quem vai conduzir (item 19b). A validacao e a
   * do compartilhado; o mesmo horario e o mesmo dia, quem recusa e o banco,
   * com os dois indices unicos parciais — dois pedidos ao mesmo tempo, um
   * grava e o outro ouve por que nao.
   */
  async agendar(sessao: SessaoServidor, pacienteId: string, corpo: Record<string, unknown>): Promise<Sessao> {
    const paciente = await exigirPacienteClinico(this.banco, sessao, pacienteId)
    exigirValido(validarAgendamento(corpo, new Date()))
    const { inicioPrevistoEm, local } = agendamentoPreenchido(corpo)
    const inicio = inicioPrevistoEm!
    try {
      return paraSessao(await this.banco.sessao.create({
        data: {
          pacienteId: paciente.id, profissionalId: sessao.usuario.id, numero: null, inicioPrevistoEm: inicio,
          inicio: null, fim: null, local, situacao: 'AGENDADA', statusSync: 'SINCRONIZADO',
        },
        include: { registros: true },
      }))
    } catch (erro) {
      if ((erro as { code?: string }).code !== 'P2002') throw erro
      throw await this.conflitoDoAgendamento(sessao.usuario.id, inicio)
    }
  }

  /** Qual dos dois indices recusou: o mesmo horario primeiro, porque ele diz qual sessao conferir. */
  private async conflitoDoAgendamento(profissionalId: string, inicio: Date): Promise<ErroServico> {
    const mesmoHorario = await this.banco.sessao.count({ where: { profissionalId, situacao: 'AGENDADA', inicioPrevistoEm: inicio } })
    const mensagem = mesmoHorario > 0 ? conflitoDeHorario(inicio) : conflitoDoDia(inicio)
    return new ErroServico('CONFLITO', mensagem, { inicioPrevistoEm: mensagem })
  }

  /**
   * O numero da sessao que comeca agora: o seguinte ao maior do paciente. Quem
   * chama ja travou o paciente, e o indice unico (pacienteId, numero) e a
   * garantia: dois inicios ao mesmo tempo nao repetem numero.
   */
  private async proximoNumero(tx: TransacaoBanco, pacienteId: string): Promise<number> {
    const { _max } = await tx.sessao.aggregate({ where: { pacienteId }, _max: { numero: true } })
    return (_max.numero ?? 0) + 1
  }

  /**
   * Trava o paciente ate o fim da transacao. Inicio e cancelamento do mesmo
   * paciente passam um de cada vez: o segundo ja le o que o primeiro gravou.
   * FOR NO KEY UPDATE nao segura quem so grava linha que aponta para o
   * paciente (uma ocorrencia, um registro).
   */
  private async travarPaciente(tx: TransacaoBanco, pacienteId: string): Promise<void> {
    await tx.$queryRaw`SELECT 1 FROM "paciente" WHERE "id" = ${pacienteId}::uuid FOR NO KEY UPDATE`
  }

  /**
   * So a sessao AGENDADA, e so por quem vai conduzi-la. A situacao anterior vai
   * para a trilha. Remarcar e cancelar e agendar de novo: nao ha edicao.
   */
  async cancelar(sessao: SessaoServidor, sessaoId: string): Promise<Editado<Sessao>> {
    const linha = await this.sessaoAlcancada(sessao, sessaoId)
    if (linha.profissionalId !== sessao.usuario.id) {
      throw new Negacao(SO_QUEM_CONDUZ_CANCELA, { pacienteId: linha.pacienteId, detalhe: 'Cancelamento de sessão de outro profissional.' })
    }
    const cancelada = await this.banco.$transaction(async (tx) => {
      await this.travarPaciente(tx, linha.pacienteId)
      const gravado = await tx.sessao.updateMany({ where: { id: linha.id, situacao: 'AGENDADA' }, data: { situacao: 'CANCELADA' } })
      if (gravado.count !== 1) throw new ErroServico('CONFLITO', SO_CANCELA_AGENDADA)
      return tx.sessao.findUniqueOrThrow({ where: { id: linha.id }, include: { registros: true } })
    })
    return { resultado: paraSessao(cancelada), pacienteId: linha.pacienteId, valorAnterior: jsonCanonico({ situacao: 'AGENDADA' }) }
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

  /**
   * Inicia a sessao agendada, so no dia dela em Manaus, ou retoma a pausada.
   * Sem o id, inicia o agendamento de hoje de quem pede para o paciente, se
   * houver — o "Iniciar a sessao" da tela 7 nao o passa —; se nao, cria uma
   * sessao nova, conduzida por quem pede.
   *
   * O numero nasce aqui, com o paciente travado: segue a ordem em que as
   * sessoes comecaram, e o agendamento cancelado nao gasta numero.
   */
  async iniciar(sessao: SessaoServidor, pacienteId: unknown, sessaoAgendadaId: unknown): Promise<Inicio> {
    const paciente = await exigirPacienteClinico(this.banco, sessao, typeof pacienteId === 'string' ? pacienteId : '')
    const eu = sessao.usuario.id
    let agendadaId: string | null = null
    if (typeof sessaoAgendadaId === 'string' && sessaoAgendadaId) {
      // Alcance e dono conferidos fora da transacao: a negativa vai para a trilha.
      const alvo = await this.sessaoAlcancada(sessao, sessaoAgendadaId)
      if (alvo.pacienteId !== paciente.id || alvo.profissionalId !== eu) {
        throw new Negacao('Esta sessão está agendada para outro profissional.', { pacienteId: paciente.id, detalhe: 'Sessão agendada para outro profissional.' })
      }
      agendadaId = alvo.id
    }
    return this.banco.$transaction(async (tx): Promise<Inicio> => {
      await this.travarPaciente(tx, paciente.id)
      // Lida depois da trava: o segundo de dois toques ve o que o primeiro gravou.
      const agora = new Date()
      const alvo = agendadaId
        ? await tx.sessao.findUniqueOrThrow({ where: { id: agendadaId }, include: { registros: true } })
        : await tx.sessao.findFirst({
          where: { pacienteId: paciente.id, profissionalId: eu, situacao: 'AGENDADA', inicioPrevistoEm: noDia(diaCivilEm(agora)) },
          include: { registros: true }, orderBy: { inicioPrevistoEm: 'asc' },
        })
      if (alvo) {
        if (alvo.situacao === 'EM_ANDAMENTO') return { sessao: paraSessao(alvo), como: 'JA_EM_ANDAMENTO' }
        const recusa = recusaDoInicio(alvo, agora)
        if (recusa) throw new ErroServico('CONFLITO', recusa)
        const retomada = alvo.situacao === 'PAUSADA'
        const iniciada = await tx.sessao.update({
          where: { id: alvo.id },
          data: retomada
            ? { situacao: 'EM_ANDAMENTO' }
            : { situacao: 'EM_ANDAMENTO', inicio: agora, numero: await this.proximoNumero(tx, paciente.id), statusSync: 'SINCRONIZADO' },
          include: { registros: true },
        })
        return { sessao: paraSessao(iniciada), como: retomada ? 'RETOMADA' : 'AGENDADA' }
      }
      const nova = await tx.sessao.create({
        data: {
          pacienteId: paciente.id, profissionalId: eu, numero: await this.proximoNumero(tx, paciente.id),
          inicioPrevistoEm: agora, inicio: agora, fim: null, local: LOCAL_PADRAO, situacao: 'EM_ANDAMENTO', statusSync: 'SINCRONIZADO',
        },
        include: { registros: true },
      })
      return { sessao: paraSessao(nova), como: 'NOVA' }
    })
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

  /**
   * O toque da tela 7. Sem id nem instante, como antes do item 22: o servidor
   * gera os dois. Com eles (a fila do aparelho), o registro e gravado com o id
   * do aparelho, e o reenvio e idempotente: o mesmo id com o mesmo conteudo
   * devolve o registro ja gravado, marcado como repetido para a trilha nao
   * ganhar uma segunda criacao; com outro conteudo, CONFLITO. Dois envios do
   * mesmo id ao mesmo tempo gravam um so: a chave primaria decide.
   *
   * A ordem e a de chegada: a sessao fica travada da leitura do maior numero
   * ate a gravacao, e a fila do aparelho envia um toque por vez, em ordem.
   */
  async registrarAtividade(
    sessao: SessaoServidor, sessaoId: string, corpo: Record<string, unknown>,
  ): Promise<DoPaciente<RegistroAtividade> & { repetido: boolean }> {
    const linha = await this.exigirConducao(sessao, sessaoId)
    const { objetivoId, resultado, id, ocorridoEm } = corpo
    const enviado = { sessaoId: linha.id, objetivoId, resultado, ocorridoEm }

    // O reenvio vem antes de tudo: o toque ja foi aceito quando chegou da
    // primeira vez, mesmo que a sessao tenha mudado depois.
    const repetido = typeof id === 'string' ? await this.toqueJaGravado(id, enviado) : null
    if (repetido) return { resultado: repetido, pacienteId: linha.pacienteId, repetido: true }

    if (!RESULTADOS.includes(resultado as Resultado)) {
      throw new ErroServico('VALIDACAO', 'Resultado desconhecido.', { resultado: 'Resultado desconhecido.' })
    }
    const doPlano = typeof objetivoId === 'string' && /^[0-9a-f-]{36}$/i.test(objetivoId)
      && await this.banco.objetivo.count({ where: { id: objetivoId, plano: { pacienteId: linha.pacienteId } } }) > 0
    if (!doPlano) throw new ErroServico('VALIDACAO', 'O objetivo não pertence ao plano deste paciente.')

    try {
      const registro = await this.banco.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM "sessao" WHERE "id" = ${linha.id}::uuid FOR NO KEY UPDATE`
        const atual = await tx.sessao.findUniqueOrThrow({ where: { id: linha.id }, select: { situacao: true, inicio: true } })
        this.exigirEmAndamento(atual)
        const agora = new Date()
        exigirValido(erroDaIdentificacaoDoToque({ id, ocorridoEm }, atual.inicio, agora))
        const { _max } = await tx.registroAtividade.aggregate({ where: { sessaoId: linha.id }, _max: { ordem: true } })
        return tx.registroAtividade.create({ data: {
          ...(typeof id === 'string' ? { id: id.toLowerCase() } : {}),
          sessaoId: linha.id, objetivoId: objetivoId as string, resultado: resultado as Resultado,
          ordem: (_max.ordem ?? 0) + 1,
          ocorridoEm: ocorridoEm === undefined ? agora : lerInstanteComFuso(ocorridoEm)!,
        } })
      })
      return { resultado: paraRegistro(registro), pacienteId: linha.pacienteId, repetido: false }
    } catch (erro) {
      // O mesmo id chegou duas vezes ao mesmo tempo: o outro pedido gravou.
      if ((erro as { code?: string }).code !== 'P2002' || typeof id !== 'string') throw erro
      const gravado = await this.toqueJaGravado(id, enviado)
      if (!gravado) throw erro
      return { resultado: gravado, pacienteId: linha.pacienteId, repetido: true }
    }
  }

  /** O registro com este id, se ja existe e e o mesmo toque; CONFLITO se e outro. */
  private async toqueJaGravado(
    id: string, enviado: { sessaoId: string; objetivoId: unknown; resultado: unknown; ocorridoEm: unknown },
  ): Promise<RegistroAtividade | null> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null
    const gravado = await this.banco.registroAtividade.findUnique({ where: { id: id.toLowerCase() } })
    if (!gravado) return null
    if (!mesmoToque(gravado, enviado)) {
      throw new ErroServico('CONFLITO', TOQUE_COM_OUTRO_CONTEUDO, { id: TOQUE_COM_OUTRO_CONTEUDO })
    }
    return paraRegistro(gravado)
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
