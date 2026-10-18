import { diaCivilEm, fimDaValidade, inicioDoDia, partesDaDataCivil } from './datas.js'
import type {
  Consentimento, ConviteEscolar, CriterioDominio, DataCivil, DataIso, Destinatario, EscopoAcesso, NivelSuporte,
  NovoConsentimento, NovoObjetivo, OcorrenciaComportamental, Origem, PlanoTerapeutico,
  RegistroAtividade, Sessao, SituacaoConsentimento, SituacaoConvite, SituacaoPlano, SituacaoPrimeiroAcesso, StatusObjetivo,
} from '../tipos.js'

/**
 * Regras de negocio puras: sem React, sem rede, sem relogio implicito.
 * Toda funcao que depende do tempo recebe `agora` como parametro, para que o
 * teste controle o relogio e o servidor possa reaproveitar a mesma regra.
 *
 * E aqui que vivem as regras inviolaveis do CLAUDE.md — separadas da interface.
 */

// ---------------------------------------------------------------- Constantes

/** Convite do professor: uso unico, expira em 72 horas (regra 1). */
export const VALIDADE_CONVITE_HORAS = 72
/** Link de primeiro acesso: uso unico, 72 horas, como o convite (docs/07, secao 0). */
export const VALIDADE_PRIMEIRO_ACESSO_HORAS = 72
/** Senha: ao menos 8 caracteres, como no aceite do convite; no maximo 128, para o hash ter custo limitado. */
export const SENHA_MINIMO = 8
export const SENHA_MAXIMO = 128
/** Evolucao da sessao: o registro documental tem limite, para nao virar deposito de arquivo. */
export const EVOLUCAO_MAXIMO = 10_000
/** Janela para o professor corrigir a ocorrencia registrada (tela 19). */
export const JANELA_CORRECAO_OCORRENCIA_MINUTOS = 30
/** Suficiencia para comparar contextos na evolucao (tela 8). */
export const SUFICIENCIA_MINIMA = { registros: 5, semanas: 3 } as const
/** Limiares do bloco "o que precisa de atencao" (tela 11). */
export const LIMIARES_ATENCAO = {
  diasSemRevisaoPlano: 90,
  diasSemSessao: 15,
  diasConsentimentoVencendo: 30,
  sessoesSemAvanco: 8,
} as const

const MS_MINUTO = 60_000
const MS_HORA = 60 * MS_MINUTO
const MS_DIA = 24 * MS_HORA

const ms = (d: DataIso | Date) => (d instanceof Date ? d.getTime() : Date.parse(d))

// ---------------------------------------------------------------- Paciente

/**
 * Idade em anos completos, por aritmetica de data civil: o "hoje" e o dia em
 * Manaus, e nenhum dos dois dias vira objeto Date. Faz aniversario no proprio
 * dia, em qualquer fuso de maquina.
 */
export function idadeEmAnos(dataNascimento: DataCivil, agora: Date): number {
  const nasc = partesDaDataCivil(dataNascimento)
  const hoje = partesDaDataCivil(diaCivilEm(agora))
  if (!nasc || !hoje) return 0
  let idade = hoje.ano - nasc.ano
  const aindaNaoFezAniversario = hoje.mes < nasc.mes || (hoje.mes === nasc.mes && hoje.dia < nasc.dia)
  if (aindaNaoFezAniversario) idade -= 1
  return Math.max(0, idade)
}

/**
 * Nivel de suporte conforme DSM-5-TR, sempre por extenso ao lado do numero:
 * ninguem deve precisar decorar o que significa "2" (tela 5).
 */
export function descricaoNivelSuporte(nivel: NivelSuporte): string {
  const descricoes: Record<NivelSuporte, string> = {
    1: 'Nível 1 — exige apoio',
    2: 'Nível 2 — exige apoio substancial',
    3: 'Nível 3 — exige apoio muito substancial',
  }
  return descricoes[nivel]
}

// ---------------------------------------------------------------- Objetivo e criterio

/** Percentual de respostas independentes de um objetivo em uma sessao. Null se nao houve tentativa. */
export function percentualIndependente(registros: RegistroAtividade[], objetivoId: string): number | null {
  const doObjetivo = registros.filter((r) => r.objetivoId === objetivoId)
  if (doObjetivo.length === 0) return null
  const independentes = doObjetivo.filter((r) => r.resultado === 'INDEPENDENTE').length
  return Math.round((independentes / doObjetivo.length) * 100)
}

/**
 * O objetivo atinge o criterio quando as N sessoes mais recentes em que foi
 * trabalhado ficaram todas no percentual minimo ou acima.
 *
 * Consideram-se apenas sessoes encerradas e com ao menos uma tentativa do
 * objetivo: sessao em que o objetivo nao foi trabalhado nao quebra nem
 * completa a sequencia.
 */
export function objetivoAtingiuCriterio(
  sessoes: Sessao[],
  objetivoId: string,
  criterio: CriterioDominio,
): boolean {
  if (criterio.sessoesConsecutivas < 1) return false
  const percentuais = sessoes
    .filter((s) => s.situacao === 'ENCERRADA')
    .sort((a, b) => a.numero - b.numero)
    .map((s) => percentualIndependente(s.registros, objetivoId))
    .filter((p): p is number => p !== null)

  if (percentuais.length < criterio.sessoesConsecutivas) return false
  return percentuais
    .slice(-criterio.sessoesConsecutivas)
    .every((p) => p >= criterio.percentualMinimo)
}

/**
 * Em aquisicao, com ao menos 9 sessoes registradas, e o melhor percentual das
 * ultimas 8 nao supera o melhor percentual anterior a elas. Ou seja: ha 8
 * sessoes o objetivo nao bate o proprio recorde.
 *
 * "Nao bateu o proprio recorde" resiste a uma sessao ruim isolada, que e o que
 * comparar a ultima sessao com a de oito atras nao faria.
 *
 * `percentuais` vem em ordem cronologica, uma entrada por sessao em que o
 * objetivo foi trabalhado.
 */
export function objetivoSemAvanco(status: StatusObjetivo, percentuais: number[]): boolean {
  if (status !== 'EM_AQUISICAO') return false
  const janela = LIMIARES_ATENCAO.sessoesSemAvanco
  if (percentuais.length <= janela) return false
  const ultimas = percentuais.slice(-janela)
  const anteriores = percentuais.slice(0, -janela)
  return Math.max(...ultimas) <= Math.max(...anteriores)
}

/**
 * Evento vindo da escola enquanto o profissional habilitado nao fez a leitura
 * clinica. O professor relata o que observou; a leitura e de quem tem
 * habilitacao para faze-la.
 */
export function ehPreliminar(o: Pick<OcorrenciaComportamental, 'leituraClinicaEm'>): boolean {
  return o.leituraClinicaEm === null
}

/**
 * Validacao do formulario de objetivo (tela 6). A descricao acessivel e
 * obrigatoria e escrita pelo terapeuta — a mensagem explica por que o campo
 * existe, em vez de dizer apenas "campo obrigatorio".
 */
export function validarNovoObjetivo(dados: NovoObjetivo): Record<string, string> {
  const erros: Record<string, string> = {}
  if (!dados.dominio.trim()) erros.dominio = 'Informe o domínio do objetivo.'
  if (!dados.descricaoTecnica.trim()) erros.descricaoTecnica = 'Informe a descrição técnica, usada pela equipe.'
  if (!dados.descricaoAcessivel.trim()) {
    // A mensagem explica por que o campo existe. Regra 4 do CLAUDE.md: nao ha
    // geracao, copia nem sugestao a partir da redacao tecnica.
    erros.descricaoAcessivel =
      'A descrição acessível é o que a família e a escola vão ler. ' +
      'Ela não é gerada a partir da técnica — quem escreve é você.'
  }
  const { percentualMinimo, sessoesConsecutivas } = dados.criterio
  if (!Number.isFinite(percentualMinimo) || percentualMinimo < 1 || percentualMinimo > 100) {
    erros.percentualMinimo = 'O percentual mínimo precisa estar entre 1 e 100.'
  }
  if (!Number.isInteger(sessoesConsecutivas) || sessoesConsecutivas < 1) {
    erros.sessoesConsecutivas = 'Informe ao menos uma sessão consecutiva.'
  }
  return erros
}

/**
 * Percentual em linguagem cotidiana para a familia (tela 15):
 * "6 ou 7 de cada 10 vezes" comunica; "65%" nao.
 */
export function frequenciaEmLinguagemCotidiana(percentual: number): string {
  const p = Math.min(100, Math.max(0, percentual))
  if (p === 0) return 'nenhuma vez a cada 10 tentativas, por enquanto'
  if (p === 100) return 'todas as vezes'
  const emDez = p / 10
  const baixo = Math.floor(emDez)
  const alto = Math.ceil(emDez)
  if (baixo === alto) return `${baixo} de cada 10 vezes`
  if (baixo === 0) return 'menos de 1 de cada 10 vezes'
  return `${baixo} ou ${alto} de cada 10 vezes`
}

/**
 * Frequencia semanal como a familia le: "duas vezes por semana", nunca "2x/sem".
 * Sete vezes e todo dia, e dizer "sete vezes por semana" soa como meta a bater.
 */
export function frequenciaSemanalEmPalavras(vezes: number): string {
  const n = Math.min(7, Math.max(1, Math.round(vezes)))
  if (n === 7) return 'todos os dias'
  if (n === 1) return 'uma vez por semana'
  const nomes = ['', '', 'duas', 'três', 'quatro', 'cinco', 'seis']
  return `${nomes[n]} vezes por semana`
}

/**
 * O criterio de dominio como o destinatario le. A equipe le percentual, que e
 * a lingua certa ali; a familia le a mesma exigencia em vezes, que e como ela
 * conta em casa.
 */
export function textoDoCriterio(criterio: CriterioDominio, destinatario: Destinatario): string {
  const sessoes = criterio.sessoesConsecutivas
  if (destinatario === 'FAMILIA') {
    return `conseguir ${frequenciaEmLinguagemCotidiana(criterio.percentualMinimo)}, ` +
      (sessoes === 1 ? 'em 1 sessão' : `em ${sessoes} sessões seguidas`)
  }
  return `${criterio.percentualMinimo}% em ${sessoes} ` +
    (sessoes === 1 ? 'sessão consecutiva' : 'sessões consecutivas')
}

/**
 * O que o periodo mostrou. Para a equipe, os tres numeros; para a familia, o
 * caminho entre o primeiro e o ultimo — sem percentual nenhum, porque numero
 * de porcentagem nao e a lingua de quem le em casa.
 *
 * `percentuais` vem em ordem cronologica. Vazio quando o objetivo nao foi
 * trabalhado no periodo, e ai nao ha o que dizer.
 */
export function textoDoPeriodo(percentuais: number[], destinatario: Destinatario): string | null {
  if (percentuais.length === 0) return null
  const primeiro = percentuais[0]
  const ultimo = percentuais[percentuais.length - 1]
  if (destinatario === 'FAMILIA') {
    return percentuais.length === 1
      ? frequenciaEmLinguagemCotidiana(ultimo)
      : `de ${frequenciaEmLinguagemCotidiana(primeiro)} para ${frequenciaEmLinguagemCotidiana(ultimo)}`
  }
  return `primeiro ${primeiro}% · último ${ultimo}% · melhor ${Math.max(...percentuais)}%`
}

// ---------------------------------------------------------------- Consentimento (regras 1, 2, 5)

export function situacaoConsentimento(c: Consentimento, agora: Date): SituacaoConsentimento {
  // Revogacao vem primeiro e nao tem carencia (regra 5).
  if (c.revogadoEm !== null && ms(c.revogadoEm) <= agora.getTime()) return 'REVOGADO'
  if (agora.getTime() < ms(c.concedidoEm)) return 'AGUARDANDO_INICIO'
  // A validade e um dia civil, e vale o dia inteiro em Manaus.
  if (agora.getTime() >= fimDaValidade(c.validadeAte).getTime()) return 'EXPIRADO'
  return 'VIGENTE'
}

export function consentimentoVigente(c: Consentimento, agora: Date): boolean {
  return situacaoConsentimento(c, agora) === 'VIGENTE'
}

export function escopoPermiteLeitura(c: Consentimento, escopo: EscopoAcesso): boolean {
  return c.escopos.includes(escopo)
}

export type MotivoNegacao = 'SEM_CONSENTIMENTO' | 'REVOGADO' | 'EXPIRADO' | 'AGUARDANDO_INICIO' | 'FORA_DO_ESCOPO'

export type ResultadoVerificacao =
  | { permitido: true }
  | { permitido: false; motivo: MotivoNegacao }

/**
 * UC21 / passo 15 do diagrama de sequencia: verificacao executada a cada
 * leitura da escola, antes de qualquer retorno de dado. Sem cache.
 */
export function verificarAcessoEscola(
  c: Consentimento | null | undefined,
  escopo: EscopoAcesso,
  agora: Date,
): ResultadoVerificacao {
  if (!c) return { permitido: false, motivo: 'SEM_CONSENTIMENTO' }
  const situacao = situacaoConsentimento(c, agora)
  if (situacao !== 'VIGENTE') return { permitido: false, motivo: situacao }
  if (!escopoPermiteLeitura(c, escopo)) return { permitido: false, motivo: 'FORA_DO_ESCOPO' }
  return { permitido: true }
}

export function validarNovoConsentimento(dados: NovoConsentimento, agora: Date): Record<string, string> {
  const erros: Record<string, string> = {}
  if (dados.escopos.length === 0) erros.escopos = 'Escolha ao menos o que a escola poderá ver ou registrar.'
  // Dia civil "AAAA-MM-DD", como o campo de data entrega. Hoje vale: o acesso
  // termina no fim do dia escolhido.
  if (!partesDaDataCivil(dados.validadeAte)) erros.validadeAte = 'Informe até quando o acesso vale.'
  else if (fimDaValidade(dados.validadeAte).getTime() <= agora.getTime()) {
    erros.validadeAte = 'A validade precisa ser uma data futura.'
  }
  // A familia nomeia a instituicao: consentimento tem de ser especifico.
  if (!dados.escolaId) erros.escolaId = 'Escolha a escola.'
  return erros
}

export function consentimentoVencendo(c: Consentimento, agora: Date): boolean {
  if (!consentimentoVigente(c, agora)) return false
  const limite = agora.getTime() + LIMIARES_ATENCAO.diasConsentimentoVencendo * MS_DIA
  return fimDaValidade(c.validadeAte).getTime() <= limite
}

// ---------------------------------------------------------------- Convite (regra 1)

export function calcularExpiracaoConvite(criadoEm: Date): Date {
  return new Date(criadoEm.getTime() + VALIDADE_CONVITE_HORAS * MS_HORA)
}

/** Os quatro estados do token (tela 2). */
export function situacaoConvite(
  convite: Pick<ConviteEscolar, 'expiraEm' | 'usadoEm'>,
  consentimento: Consentimento,
  agora: Date,
): SituacaoConvite {
  if (convite.usadoEm !== null) return 'USADO'
  const situacao = situacaoConsentimento(consentimento, agora)
  if (situacao === 'REVOGADO') return 'CONSENTIMENTO_REVOGADO'
  if (situacao === 'EXPIRADO' || agora.getTime() >= ms(convite.expiraEm)) return 'EXPIRADO'
  return 'VALIDO'
}

// ---------------------------------------------------------------- Plano e cartao

/** As duas datas do plano novo: dias que existem, e a revisao depois do inicio. */
export function validarNovoPlano(dados: { dataInicio: string; dataRevisao: string }): Record<string, string> {
  const erros: Record<string, string> = {}
  if (!partesDaDataCivil(dados.dataInicio)) erros.dataInicio = 'Informe a data de início do plano.'
  if (!partesDaDataCivil(dados.dataRevisao)) erros.dataRevisao = 'Informe a data prevista para a revisão.'
  else if (!erros.dataInicio && dados.dataRevisao <= dados.dataInicio) {
    erros.dataRevisao = 'A revisão precisa ser depois do início do plano.'
  }
  return erros
}

/** Itens de lista sem espacos nas pontas, e sem os vazios. */
export function itensPreenchidos(itens: string[]): string[] {
  return itens.map((i) => i.trim()).filter((i) => i.length > 0)
}

/**
 * O cartao so existe com conteudo (lacuna 5): e o que a escola le, e cartao
 * em branco nao diz nada a ela. O banco recusa lista vazia pelo CHECK; aqui a
 * pessoa recebe o motivo em palavras.
 */
export function validarCartao(dados: { tituloSimples: string; oQueFazer: string[]; oQueEvitar: string[]; sinalAlerta: string }): Record<string, string> {
  const erros: Record<string, string> = {}
  if (!dados.tituloSimples.trim()) erros.tituloSimples = 'Escreva um título em linguagem simples.'
  if (itensPreenchidos(dados.oQueFazer).length === 0) erros.oQueFazer = 'Escreva ao menos uma coisa que ajuda.'
  if (itensPreenchidos(dados.oQueEvitar).length === 0) erros.oQueEvitar = 'Escreva ao menos uma coisa a evitar.'
  if (!dados.sinalAlerta.trim()) erros.sinalAlerta = 'Escreva o sinal de que a criança precisa de apoio.'
  return erros
}

/** Objetivo e datas se editam so com o plano em rascunho ou devolvido (item 7). */
export function planoEditavel(status: SituacaoPlano): boolean {
  return status === 'RASCUNHO' || status === 'DEVOLVIDO'
}

/**
 * Encerrar a sessao exige a evolucao (Resolucao CFP 001/2009, registro
 * documental). E texto do profissional: o sistema nunca a gera nem a
 * pre-preenche, no mesmo espirito da regra 4. Erro em palavras, ou nulo.
 */
export function erroDaEvolucao(evolucao: string): string | null {
  if (!evolucao.trim()) return 'Escreva a evolução da sessão antes de encerrar.'
  if (evolucao.length > EVOLUCAO_MAXIMO) return `A evolução pode ter no máximo ${EVOLUCAO_MAXIMO.toLocaleString('pt-BR')} caracteres.`
  return null
}

// ---------------------------------------------------------------- Conta e senha

/** Texto para busca: sem acento e sem diferenca de maiusculas. */
export function paraBusca(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/** Palavras que toda escola tem e que nao ajudam a distinguir uma da outra. */
const PALAVRAS_COMUNS_DE_ESCOLA = new Set([
  'escola', 'municipal', 'estadual', 'federal', 'particular', 'colegio', 'centro', 'educacional',
  'ensino', 'fundamental', 'medio', 'infantil', 'instituto', 'unidade', 'professor', 'professora',
  'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'emef', 'eeef', 'cmei',
])

function palavrasQueDistinguem(nome: string): string[] {
  return paraBusca(nome).split(/[^a-z0-9]+/).filter((p) => p.length >= 3 && !PALAVRAS_COMUNS_DE_ESCOLA.has(p))
}

/**
 * Duas escolas do mesmo municipio parecem a mesma quando dividem uma palavra
 * que distingue — "Escola Municipal Vitoria-Regia" e "EM Vitoria Regia" —, ou
 * quando um nome contem o outro. Serve para mostrar as candidatas antes de
 * cadastrar: quem decide se e a mesma e a familia.
 */
export function escolaParecida(nome: string, municipio: string, escola: { nome: string; municipio: string }): boolean {
  if (paraBusca(municipio.trim()) !== paraBusca(escola.municipio.trim())) return false
  const a = paraBusca(nome.trim())
  const b = paraBusca(escola.nome.trim())
  if (!a || !b) return false
  if (a.includes(b) || b.includes(a)) return true
  const deB = new Set(palavrasQueDistinguem(escola.nome))
  return palavrasQueDistinguem(nome).some((p) => deB.has(p))
}

/** E-mail como fica gravado: sem espacos nas pontas e em minusculas. */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** Erro da senha nova, ou nulo se ela serve. */
export function erroDaSenhaNova(senha: string): string | null {
  if (senha.length < SENHA_MINIMO) return `A senha precisa ter ao menos ${SENHA_MINIMO} caracteres.`
  if (senha.length > SENHA_MAXIMO) return `A senha pode ter no máximo ${SENHA_MAXIMO} caracteres.`
  return null
}

/** O motivo do link de nova senha (item 8): obrigatorio, e fica na trilha. */
export const MOTIVO_NOVA_SENHA_MAXIMO = 500

export function erroDoMotivoDaNovaSenha(motivo: string): string | null {
  if (!motivo.trim()) return 'Escreva o motivo: ele fica na trilha de auditoria, com o seu nome.'
  if (motivo.trim().length > MOTIVO_NOVA_SENHA_MAXIMO) return `O motivo pode ter no máximo ${MOTIVO_NOVA_SENHA_MAXIMO} caracteres.`
  return null
}

export function calcularExpiracaoPrimeiroAcesso(criadoEm: Date): Date {
  return new Date(criadoEm.getTime() + VALIDADE_PRIMEIRO_ACESSO_HORAS * MS_HORA)
}

/** Os estados do link de primeiro acesso. Nulo e o token que nao existe. */
export function situacaoPrimeiroAcesso(
  acesso: { expiraEm: DataIso; usadoEm: DataIso | null } | null,
  agora: Date,
): SituacaoPrimeiroAcesso {
  if (!acesso) return 'INEXISTENTE'
  if (acesso.usadoEm !== null) return 'USADO'
  if (agora.getTime() >= ms(acesso.expiraEm)) return 'EXPIRADO'
  return 'VALIDO'
}

// ---------------------------------------------------------------- Ocorrencia escolar

export function podeCorrigirOcorrencia(registradaEm: DataIso, agora: Date): boolean {
  const decorrido = agora.getTime() - ms(registradaEm)
  return decorrido >= 0 && decorrido <= JANELA_CORRECAO_OCORRENCIA_MINUTOS * MS_MINUTO
}

// ---------------------------------------------------------------- Comparacao entre contextos (tela 8)

/** Chave da semana (segunda-feira, UTC) em que a data cai. */
function chaveSemana(data: DataIso): string {
  const d = new Date(ms(data))
  const diasDesdeSegunda = (d.getUTCDay() + 6) % 7
  const segunda = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diasDesdeSegunda))
  return segunda.toISOString().slice(0, 10)
}

export interface FaltaSuficiencia {
  contexto: Origem
  registrosFaltando: number
  semanasFaltando: number
}

/**
 * A comparacao so e exibida com no minimo cinco registros distribuidos em tres
 * semanas distintas em CADA contexto. Abaixo disso a tela diz o que falta.
 *
 * Esta regra so decide se ha dados suficientes. Ela nao compara as medidas:
 * clinica, casa e escola tem escalas de natureza diferente e nunca sao
 * colocadas na mesma escala nem somadas em media.
 */
export function suficienciaComparacao(datasPorContexto: Record<Origem, DataIso[]>): {
  suficiente: boolean
  faltas: FaltaSuficiencia[]
} {
  const contextos: Origem[] = ['CLINICA', 'CASA', 'ESCOLA']
  const faltas = contextos
    .map((contexto) => {
      const datas = datasPorContexto[contexto] ?? []
      const semanas = new Set(datas.map(chaveSemana)).size
      return {
        contexto,
        registrosFaltando: Math.max(0, SUFICIENCIA_MINIMA.registros - datas.length),
        semanasFaltando: Math.max(0, SUFICIENCIA_MINIMA.semanas - semanas),
      }
    })
    .filter((f) => f.registrosFaltando > 0 || f.semanasFaltando > 0)
  return { suficiente: faltas.length === 0, faltas }
}

// ---------------------------------------------------------------- Plano e coordenacao

export function validarDevolucaoPlano(observacao: string): string | null {
  return observacao.trim().length === 0
    ? 'Escreva o que precisa mudar. Devolução sem justificativa não ensina nada a quem recebeu.'
    : null
}

export function planoPrecisaRevisao(
  plano: Pick<PlanoTerapeutico, 'dataInicio' | 'ultimaRevisaoEm'>,
  agora: Date,
): boolean {
  // ultimaRevisaoEm e instante; dataInicio e dia civil, contado do inicio do dia.
  const referencia = plano.ultimaRevisaoEm !== null
    ? ms(plano.ultimaRevisaoEm)
    : inicioDoDia(plano.dataInicio).getTime()
  return agora.getTime() - referencia > LIMIARES_ATENCAO.diasSemRevisaoPlano * MS_DIA
}

/** Paciente ativo sem nenhuma sessao tambem precisa de atencao. */
export function pacienteSemSessaoRecente(ultimaSessaoEm: DataIso | null, agora: Date): boolean {
  if (ultimaSessaoEm === null) return true
  return agora.getTime() - ms(ultimaSessaoEm) > LIMIARES_ATENCAO.diasSemSessao * MS_DIA
}

// ---------------------------------------------------------------- Usuarios

/** Desativar, nunca excluir. Um administrador nao desativa a si mesmo (tela 14). */
export function podeDesativarUsuario(atorId: string, alvoId: string): boolean {
  return atorId !== alvoId
}
