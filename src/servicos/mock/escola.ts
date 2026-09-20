import type { ServicoAreaEscola } from '../contratos'
import {
  ErroServico, type CartaoEscola, type Consentimento, type EscopoAcesso,
  type NovaOcorrenciaEscolar, type OcorrenciaEscolar, type VinculoEscolar,
} from '../tipos'
import {
  consentimentoVigente, podeCorrigirOcorrencia, situacaoConsentimento, verificarAcessoEscola,
  type MotivoNegacao,
} from '../../dominio/regras'
import {
  auditar, banco, exigirPerfil, exigirValido, gerarId, naoEncontrado, paginar, relogio, responder,
  type SessaoServidor,
} from './infra'

/**
 * Area da escola. Nada aqui retorna dado antes de verificar consentimento
 * vigente e escopo (UC21, passo 15 do diagrama de sequencia). A verificacao
 * e refeita a cada chamada, sobre o registro atual — sem cache (regra 5).
 */

const MENSAGEM_NEGACAO: Record<MotivoNegacao, string> = {
  SEM_CONSENTIMENTO: 'A família não autorizou este acesso.',
  REVOGADO: 'A família encerrou o acesso a estas informações.',
  EXPIRADO: 'O prazo do acesso autorizado pela família terminou.',
  AGUARDANDO_INICIO: 'O acesso autorizado pela família ainda não começou.',
  FORA_DO_ESCOPO: 'A família não autorizou esta ação.',
}

/**
 * Percorre a cadeia Consentimento → VinculoEscolar do professor autenticado.
 * Se nenhum vinculo permite o escopo pedido, registra a tentativa negada
 * (regra 6) e interrompe. O motivo vai em `campos.motivo` para a tela de
 * acesso encerrado.
 */
function exigirAcessoEscola(pacienteId: string, escopo: EscopoAcesso, entidade: string): {
  sessao: SessaoServidor
  vinculo: VinculoEscolar
  validadeAte: string
} {
  const sessao = exigirPerfil(['PROFESSOR'], entidade, pacienteId)
  const agora = relogio.agora()
  const vinculos = banco.vinculos.filter((v) => v.pacienteId === pacienteId && v.professorId === sessao.usuario.id)

  let motivo: MotivoNegacao = 'SEM_CONSENTIMENTO'
  for (const vinculo of vinculos) {
    const consentimento = banco.consentimentos.find((c) => c.id === vinculo.consentimentoId)
    const resultado = verificarAcessoEscola(consentimento, escopo, agora)
    if (resultado.permitido) return { sessao, vinculo, validadeAte: consentimento!.validadeAte }
    motivo = resultado.motivo
  }

  auditar(sessao, { acao: 'ACESSO_NEGADO', entidade, pacienteId, detalhe: `Negado: ${motivo}.` })
  throw new ErroServico('ACESSO_NEGADO', MENSAGEM_NEGACAO[motivo], { motivo })
}

function validarOcorrencia(dados: NovaOcorrenciaEscolar): void {
  const erros: Record<string, string> = {}
  if (!dados.oQueAconteceu.trim()) erros.oQueAconteceu = 'Escolha o que aconteceu.'
  if (![1, 2, 3, 4, 5].includes(dados.intensidade)) erros.intensidade = 'Escolha a intensidade, de 1 a 5.'
  if (!dados.momento.trim()) erros.momento = 'Escolha em que momento aconteceu.'
  exigirValido(erros)
}

export const areaEscolaMock: ServicoAreaEscola = {
  /**
   * Tela 22. Aparece quem ja concedeu acesso a este professor em algum
   * momento: a linha revogada permanece, marcada, porque sumir sem
   * explicacao faria o professor supor defeito no sistema (passo 27 do
   * diagrama de sequencia). Quem nunca concedeu nao aparece.
   */
  listarAlunos: (filtro = {}) => responder(() => {
    const sessao = exigirPerfil(['PROFESSOR'], 'VinculoEscolar')
    const agora = relogio.agora()

    const porPaciente = new Map<string, { v: VinculoEscolar; c: Consentimento }>()
    for (const v of banco.vinculos.filter((x) => x.professorId === sessao.usuario.id)) {
      const c = banco.consentimentos.find((x) => x.id === v.consentimentoId)!
      const atual = porPaciente.get(v.pacienteId)
      // Com mais de uma autorizacao para o mesmo aluno, vale a vigente; sem
      // nenhuma vigente, a mais recente.
      const melhor = !atual || consentimentoVigente(c, agora) ||
        (!consentimentoVigente(atual.c, agora) && c.concedidoEm > atual.c.concedidoEm)
      if (melhor) porPaciente.set(v.pacienteId, { v, c })
    }

    const itens = [...porPaciente.values()]
      .map(({ v, c }) => {
        const situacao = situacaoConsentimento(c, agora)
        return {
          pacienteId: v.pacienteId,
          // Minimizacao: so o primeiro nome.
          nome: banco.pacientes.find((p) => p.id === v.pacienteId)!.nome.split(' ')[0],
          situacao,
          // Sem acesso vigente, nem o que foi autorizado precisa sair daqui.
          escopos: situacao === 'VIGENTE' ? c.escopos : [],
          validadeAte: c.validadeAte,
        }
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

    auditar(sessao, {
      acao: 'LEITURA_AUTORIZADA', entidade: 'VinculoEscolar',
      detalhe: `Consulta da lista de alunos (${itens.length}).`,
    })
    return paginar(itens, filtro)
  }),

  obterCartao: (pacienteId) => responder(() => {
    const { sessao, validadeAte } = exigirAcessoEscola(pacienteId, 'CARTAO_ESTRATEGIA', 'CartaoEstrategia')
    const plano = banco.planos.find((p) => p.pacienteId === pacienteId && p.situacao === 'VIGENTE')
    const objetivos = plano?.objetivos ?? []
    const cartoes = banco.cartoes.filter((c) => objetivos.some((o) => o.id === c.objetivoId))

    // Projecao explicita, campo a campo: nada do objetivo alem da redacao acessivel.
    const cartao: CartaoEscola = {
      pacienteId,
      nome: banco.pacientes.find((p) => p.id === pacienteId)!.nome.split(' ')[0],
      validadeAte,
      estrategias: cartoes.map((c) => ({
        paraQue: objetivos.find((o) => o.id === c.objetivoId)!.descricaoAcessivel,
        oQueFazer: [...c.oQueFazer],
        oQueEvitar: [...c.oQueEvitar],
        sinalAlerta: c.sinalAlerta,
      })),
      atualizadoEm: cartoes.map((c) => c.atualizadoEm).sort().pop() ?? plano?.inicioEm ?? relogio.agora().toISOString(),
    }
    auditar(sessao, { acao: 'LEITURA_AUTORIZADA', entidade: 'CartaoEstrategia', pacienteId, detalhe: 'Consulta do cartão de estratégias.' })
    return cartao
  }),

  registrarOcorrencia: (pacienteId, dados) => responder(() => {
    const { sessao, vinculo } = exigirAcessoEscola(pacienteId, 'REGISTRO_OCORRENCIA', 'OcorrenciaEscolar')
    validarOcorrencia(dados)
    const agora = relogio.agora().toISOString()
    const ocorrencia: OcorrenciaEscolar = {
      id: gerarId('oe'),
      vinculoId: vinculo.id,
      pacienteId,
      professorId: sessao.usuario.id,
      registradaEm: agora,
      corrigidaEm: null,
      oQueAconteceu: dados.oQueAconteceu.trim(),
      intensidade: dados.intensidade,
      momento: dados.momento.trim(),
      observacao: dados.observacao?.trim() ?? '',
    }
    banco.ocorrenciasEscolares.push(ocorrencia)
    // «gera»: entra na clinica como evento comportamental preliminar, sem leitura clinica.
    banco.ocorrenciasComportamentais.push({
      id: `oc-${ocorrencia.id}`,
      pacienteId,
      origem: 'ESCOLA',
      ocorridaEm: agora,
      antecedente: `Momento: ${ocorrencia.momento}`,
      comportamento: ocorrencia.oQueAconteceu,
      consequencia: ocorrencia.observacao || 'Não informado pela escola.',
      intensidade: ocorrencia.intensidade,
      preliminar: true,
      sessaoId: null,
      ocorrenciaEscolarId: ocorrencia.id,
    })
    auditar(sessao, { acao: 'CRIACAO', entidade: 'OcorrenciaEscolar', entidadeId: ocorrencia.id, pacienteId, detalhe: 'Ocorrência registrada pela escola.' })
    return ocorrencia
  }),

  corrigirOcorrencia: (ocorrenciaId, dados) => responder(() => {
    const ocorrencia = banco.ocorrenciasEscolares.find((o) => o.id === ocorrenciaId) ?? naoEncontrado('Ocorrência')
    const { sessao } = exigirAcessoEscola(ocorrencia.pacienteId, 'REGISTRO_OCORRENCIA', 'OcorrenciaEscolar')
    if (ocorrencia.professorId !== sessao.usuario.id) {
      auditar(sessao, { acao: 'ACESSO_NEGADO', entidade: 'OcorrenciaEscolar', entidadeId: ocorrencia.id, pacienteId: ocorrencia.pacienteId, detalhe: 'Correção por quem não registrou.' })
      throw new ErroServico('ACESSO_NEGADO', 'Somente quem registrou a ocorrência pode corrigi-la.')
    }
    if (!podeCorrigirOcorrencia(ocorrencia.registradaEm, relogio.agora())) {
      throw new ErroServico('CONFLITO', 'O prazo de 30 minutos para correção terminou.')
    }
    validarOcorrencia(dados)

    // A versao original fica preservada na trilha de auditoria.
    const { oQueAconteceu, intensidade, momento, observacao } = ocorrencia
    auditar(sessao, {
      acao: 'ALTERACAO', entidade: 'OcorrenciaEscolar', entidadeId: ocorrencia.id, pacienteId: ocorrencia.pacienteId,
      detalhe: `Versão original: ${JSON.stringify({ oQueAconteceu, intensidade, momento, observacao })}`,
    })

    ocorrencia.oQueAconteceu = dados.oQueAconteceu.trim()
    ocorrencia.intensidade = dados.intensidade
    ocorrencia.momento = dados.momento.trim()
    ocorrencia.observacao = dados.observacao?.trim() ?? ''
    ocorrencia.corrigidaEm = relogio.agora().toISOString()

    const derivada = banco.ocorrenciasComportamentais.find((o) => o.ocorrenciaEscolarId === ocorrencia.id)
    if (derivada) {
      derivada.antecedente = `Momento: ${ocorrencia.momento}`
      derivada.comportamento = ocorrencia.oQueAconteceu
      derivada.consequencia = ocorrencia.observacao || 'Não informado pela escola.'
      derivada.intensidade = ocorrencia.intensidade
    }
    return ocorrencia
  }),
}
