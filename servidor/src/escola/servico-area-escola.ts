import { Injectable } from '@nestjs/common'
import {
  ErroServico, type AlunoEscola, type CartaoEscola, type EscopoAcesso, type FiltroPaginacao, type Intensidade,
  type MotivoNegativa, type OcorrenciaEscolar, type Pagina,
} from '@sinctea/compartilhado'
import { jsonCanonico } from '@sinctea/compartilhado/dominio/hash'
import {
  consentimentoVigente, podeCorrigirOcorrencia, situacaoConsentimento, verificarAcessoEscola, type MotivoNegacao,
} from '@sinctea/compartilhado/dominio/regras'
import { Negacao } from '../acesso/negacao.js'
import { ServicoBanco } from '../banco/servico-banco.js'
import { paraConsentimento, paraDataCivil } from '../clinica/mapeadores.js'
import type { DoPaciente } from '../clinica/servico-planos.js'
import { paginar, porNome } from '../http/paginacao.js'
import type { SessaoServidor } from '../http/tipos-http.js'
import { exigirUuid, exigirValido, textoOuVazio } from '../http/validacao.js'

const MENSAGEM_NEGACAO: Record<MotivoNegacao, string> = {
  SEM_CONSENTIMENTO: 'A família não autorizou este acesso.',
  REVOGADO: 'A família encerrou o acesso a estas informações.',
  EXPIRADO: 'O prazo do acesso autorizado pela família terminou.',
  AGUARDANDO_INICIO: 'O acesso autorizado pela família ainda não começou.',
  FORA_DO_ESCOPO: 'A família não autorizou esta ação.',
}

/** O motivo do dominio, no do contrato: e ele que faz a tela 18 dizer "acesso encerrado". */
const MOTIVO_NO_CONTRATO: Record<MotivoNegacao, MotivoNegativa> = {
  SEM_CONSENTIMENTO: 'FORA_DO_ALCANCE',
  AGUARDANDO_INICIO: 'FORA_DO_ALCANCE',
  REVOGADO: 'CONSENTIMENTO_REVOGADO',
  EXPIRADO: 'CONSENTIMENTO_EXPIRADO',
  FORA_DO_ESCOPO: 'ESCOPO_NAO_AUTORIZADO',
}

/**
 * Area da escola (UC14 a UC17, UC21, UC22; telas 18, 19 e 22), portada de
 * src/servicos/mock/escola.ts. Nada aqui devolve dado antes de verificar
 * consentimento vigente e escopo (regra 2; UC21, passo 15), e a verificacao e
 * refeita a cada chamada, sobre o registro de agora — sem cache (regra 5).
 * O que sai e projecao campo a campo: nada clinico (regra 3).
 */
@Injectable()
export class ServicoAreaEscola {
  constructor(private readonly banco: ServicoBanco) {}

  /**
   * A cadeia Consentimento → VinculoEscolar do professor. Se nenhum vinculo
   * permite o escopo, a negativa sai com o motivo e o paciente, e o filtro a
   * registra (regra 6).
   */
  private async exigirAcessoEscola(sessao: SessaoServidor, pacienteId: string, escopo: EscopoAcesso) {
    const id = exigirUuid(pacienteId, 'Aluno')
    const vinculos = await this.banco.vinculoEscolar.findMany({
      where: { pacienteId: id, professorId: sessao.usuario.id }, include: { consentimento: true },
    })
    const agora = new Date()
    let motivo: MotivoNegacao = 'SEM_CONSENTIMENTO'
    for (const vinculo of vinculos) {
      const resultado = verificarAcessoEscola(paraConsentimento(vinculo.consentimento), escopo, agora)
      if (resultado.permitido) return vinculo
      motivo = resultado.motivo
    }
    throw new Negacao(MENSAGEM_NEGACAO[motivo], { pacienteId: id, detalhe: `Negado: ${motivo}.` }, MOTIVO_NO_CONTRATO[motivo])
  }

  /**
   * UC22. A lista e calculada dos vinculos do proprio professor, sem conteudo
   * clinico (regra 2, passo 27). A linha revogada continua, marcada: sumir sem
   * explicacao faria o professor supor defeito. Quem nunca concedeu nao aparece.
   */
  async listarAlunos(sessao: SessaoServidor, filtro: FiltroPaginacao): Promise<Pagina<AlunoEscola>> {
    const vinculos = await this.banco.vinculoEscolar.findMany({
      where: { professorId: sessao.usuario.id }, include: { consentimento: { include: { escola: true } }, paciente: true },
    })
    const agora = new Date()
    const porPaciente = new Map<string, (typeof vinculos)[number]>()
    for (const v of vinculos) {
      const atual = porPaciente.get(v.pacienteId)
      const vigente = (x: typeof v) => consentimentoVigente(paraConsentimento(x.consentimento), agora)
      // Vale a autorizacao vigente; sem nenhuma vigente, a mais recente.
      if (!atual || vigente(v) || (!vigente(atual) && v.consentimento.concedidoEm > atual.consentimento.concedidoEm)) {
        porPaciente.set(v.pacienteId, v)
      }
    }
    const itens = [...porPaciente.values()].map((v): AlunoEscola => {
      const situacao = situacaoConsentimento(paraConsentimento(v.consentimento), agora)
      return {
        pacienteId: v.pacienteId,
        // Minimizacao: so o primeiro nome.
        nome: v.paciente.nome.split(' ')[0], turma: v.turma, turno: v.turno, escola: v.consentimento.escola.nome,
        situacao,
        // Sem acesso vigente, nem o que foi autorizado precisa sair daqui.
        escopos: situacao === 'VIGENTE' ? v.consentimento.escopos : [],
        validadeAte: paraDataCivil(v.consentimento.validadeAte),
      }
    }).sort(porNome)
    return paginar(itens, filtro)
  }

  /** Regra 3: so o cartao projetado — titulo, para que, o que fazer, o que evitar, sinal de alerta. */
  async obterCartao(sessao: SessaoServidor, pacienteId: string): Promise<CartaoEscola> {
    const vinculo = await this.exigirAcessoEscola(sessao, pacienteId, 'CARTAO_ESTRATEGIA')
    const paciente = await this.banco.paciente.findUniqueOrThrow({ where: { id: vinculo.pacienteId } })
    const plano = await this.banco.planoTerapeutico.findFirst({
      where: { pacienteId: paciente.id, status: 'VIGENTE' },
      include: { objetivos: { include: { cartoes: { orderBy: { atualizadoEm: 'asc' } } } } },
    })
    const objetivos = plano?.objetivos ?? []
    const cartoes = objetivos.flatMap((o) => o.cartoes.map((c) => ({ c, o })))
    return {
      pacienteId: paciente.id,
      nome: paciente.nome.split(' ')[0],
      turma: vinculo.turma,
      turno: vinculo.turno,
      validadeAte: paraDataCivil(vinculo.consentimento.validadeAte),
      escopos: [...vinculo.consentimento.escopos],
      // Projecao explicita, campo a campo: do objetivo, so a redacao acessivel.
      estrategias: cartoes.map(({ c, o }) => ({
        titulo: c.tituloSimples, paraQue: o.descricaoAcessivel,
        oQueFazer: [...c.oQueFazer], oQueEvitar: [...c.oQueEvitar], sinalAlerta: c.sinalAlerta,
      })),
      atualizadoEm: (cartoes.map(({ c }) => c.atualizadoEm).sort((a, b) => a.getTime() - b.getTime()).at(-1)
        ?? plano?.ultimaRevisaoEm ?? new Date()).toISOString(),
    }
  }

  async registrarOcorrencia(sessao: SessaoServidor, pacienteId: string, dados: Record<string, unknown>): Promise<OcorrenciaEscolar> {
    const vinculo = await this.exigirAcessoEscola(sessao, pacienteId, 'REGISTRO_OCORRENCIA')
    const conteudo = conteudoDaOcorrencia(dados)
    const agora = new Date()
    const ocorrencia = await this.banco.$transaction(async (tx) => {
      const o = await tx.ocorrenciaEscolar.create({ data: {
        vinculoId: vinculo.id, pacienteId: vinculo.pacienteId, professorId: sessao.usuario.id,
        ocorridoEm: agora, registradaEm: agora, corrigidaEm: null, ...conteudo,
      } })
      // «gera»: entra na clinica como evento comportamental preliminar, sem
      // leitura clinica. A escola relata o que observou; quem le e o profissional.
      await tx.ocorrenciaComportamental.create({ data: {
        pacienteId: vinculo.pacienteId, origem: 'ESCOLA', ocorridaEm: agora,
        antecedente: `Contexto: ${conteudo.contexto}`, comportamento: conteudo.tipo,
        consequencia: 'Não informado pela escola.', intensidade: conteudo.intensidade,
        leituraClinicaEm: null, sessaoId: null, ocorrenciaEscolarId: o.id,
      } })
      return o
    })
    return paraOcorrencia(ocorrencia)
  }

  /**
   * So quem registrou, so em 30 minutos. A versao anterior dos tres campos vai
   * para a trilha, em valorAnterior, e o evento preliminar acompanha a correcao.
   */
  async corrigirOcorrencia(sessao: SessaoServidor, ocorrenciaId: string, dados: Record<string, unknown>): Promise<DoPaciente<OcorrenciaEscolar> & { valorAnterior: string }> {
    const ocorrencia = await this.banco.ocorrenciaEscolar.findUnique({ where: { id: exigirUuid(ocorrenciaId, 'Ocorrência') } })
    if (!ocorrencia) throw new ErroServico('NAO_ENCONTRADO', 'Ocorrência não encontrada.')
    await this.exigirAcessoEscola(sessao, ocorrencia.pacienteId, 'REGISTRO_OCORRENCIA')
    if (ocorrencia.professorId !== sessao.usuario.id) {
      throw new Negacao('Somente quem registrou a ocorrência pode corrigi-la.', {
        pacienteId: ocorrencia.pacienteId, detalhe: 'Correção por quem não registrou.',
      }, 'FORA_DO_ALCANCE')
    }
    if (!podeCorrigirOcorrencia(ocorrencia.registradaEm.toISOString(), new Date())) {
      throw new ErroServico('CONFLITO', 'O prazo de 30 minutos para correção terminou.')
    }
    const conteudo = conteudoDaOcorrencia(dados)
    const valorAnterior = jsonCanonico({ tipo: ocorrencia.tipo, intensidade: ocorrencia.intensidade, contexto: ocorrencia.contexto })
    const corrigida = await this.banco.$transaction(async (tx) => {
      const o = await tx.ocorrenciaEscolar.update({ where: { id: ocorrencia.id }, data: { ...conteudo, corrigidaEm: new Date() } })
      await tx.ocorrenciaComportamental.updateMany({
        where: { ocorrenciaEscolarId: ocorrencia.id },
        data: { antecedente: `Contexto: ${conteudo.contexto}`, comportamento: conteudo.tipo, intensidade: conteudo.intensidade },
      })
      return o
    })
    return { resultado: paraOcorrencia(corrigida), pacienteId: ocorrencia.pacienteId, valorAnterior }
  }
}

function conteudoDaOcorrencia(dados: Record<string, unknown>) {
  const conteudo = { tipo: textoOuVazio(dados.tipo), intensidade: Number(dados.intensidade), contexto: textoOuVazio(dados.contexto) }
  const erros: Record<string, string> = {}
  if (!conteudo.tipo) erros.tipo = 'Escolha o que aconteceu.'
  if (![1, 2, 3, 4, 5].includes(conteudo.intensidade)) erros.intensidade = 'Escolha a intensidade, de 1 a 5.'
  if (!conteudo.contexto) erros.contexto = 'Escolha em que momento aconteceu.'
  exigirValido(erros)
  return conteudo
}

function paraOcorrencia(o: {
  id: string; vinculoId: string; pacienteId: string; professorId: string; ocorridoEm: Date; registradaEm: Date
  corrigidaEm: Date | null; tipo: string; intensidade: number; contexto: string
}): OcorrenciaEscolar {
  return {
    id: o.id, vinculoId: o.vinculoId, pacienteId: o.pacienteId, professorId: o.professorId,
    ocorridoEm: o.ocorridoEm.toISOString(), registradaEm: o.registradaEm.toISOString(),
    corrigidaEm: o.corrigidaEm?.toISOString() ?? null, tipo: o.tipo, intensidade: o.intensidade as Intensidade, contexto: o.contexto,
  }
}
