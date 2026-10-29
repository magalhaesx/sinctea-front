/**
 * Leitura da trilha de auditoria.
 *
 * O `valorAnterior` do RegistroAuditoria e JSON canonico — bom para comparar e
 * guardar, ruim para ler. Aqui ele vira campo e valor em linguagem de gente,
 * nas duas saidas que precisam dele: a tela 13 e o CSV exportado. Fica no
 * dominio para que as duas digam a mesma coisa.
 */

import type { AcaoAuditoria, FiltroAuditoria, Perfil, RegistroAuditoria, RegistroDaTrilha } from '../tipos.js'
import { montarCsv } from './csv.js'
import { diaCivilEm, partesDaDataCivil } from './datas.js'

/**
 * De que area veio o registro, pelo perfil com que a pessoa agia. Sem perfil
 * (o comando do primeiro administrador, uma tarefa do proprio sistema): SISTEMA.
 */
export function origemDoPerfil(perfil: Perfil | null): RegistroAuditoria['origem'] {
  if (perfil === 'RESPONSAVEL') return 'FAMILIA'
  if (perfil === 'PROFESSOR') return 'ESCOLA'
  if (perfil === null) return 'SISTEMA'
  return 'CLINICA'
}

/**
 * As entidades da trilha administrativa (item 13, tela 25): contas
 * (`Usuario`, e a lista de profissionais, `Profissional`), links de acesso (que
 * a trilha grava como `Usuario`), escolas e a propria trilha. Lista fechada:
 * entidade nova so entra depois de conferido que nenhum registro dela, sem
 * paciente, carrega dado de paciente (regra 3). Quem grava registro de uma
 * delas com recorte por paciente grava o `pacienteId` junto, e o registro sai
 * da trilha administrativa.
 */
export const ENTIDADES_ADMINISTRATIVAS = ['Usuario', 'Profissional', 'Escola', 'RegistroAuditoria'] as const

/**
 * Item 13b: na trilha administrativa, o registro de escola feito por um
 * responsavel sai sem quem agiu, so com o perfil. O administrador cuida do
 * cadastro da escola, e nao precisa saber qual familia esta ligada a ela. O
 * banco continua guardando o nome.
 */
export function semNomeNaTrilhaAdministrativa(registro: { entidade: string; perfil: Perfil | null }): boolean {
  return registro.entidade === 'Escola' && registro.perfil === 'RESPONSAVEL'
}

/** Os campos que a trilha guarda hoje, com nome de gente. */
export const NOME_DO_CAMPO: Record<string, string> = {
  tipo: 'O que aconteceu',
  intensidade: 'Intensidade',
  contexto: 'Em que momento',
  descricaoTecnica: 'Redação técnica',
  descricaoAcessivel: 'Redação acessível',
  percentualMinimo: 'Percentual mínimo',
  sessoesConsecutivas: 'Sessões consecutivas',
  dataInicio: 'Início do plano',
  dataRevisao: 'Revisão do plano',
  nome: 'Nome',
  email: 'E-mail',
  telefone: 'Telefone',
  parentesco: 'Parentesco',
  perfis: 'Perfis',
  ativo: 'Conta ativa',
  especialidade: 'Especialidade',
  registroConselho: 'Registro no conselho',
}

/**
 * O que vai para o `valorAnterior` de uma ALTERACAO: so os campos que
 * mudaram, com o valor de antes — nunca o registro inteiro, por minimizacao
 * (revisao do modelo de 11/10). Nada mudou: nulo, e nao ha o que registrar.
 */
export function anterioresQueMudaram<T extends Record<string, unknown>>(antes: T, depois: T): Partial<T> | null {
  const mudaram = (Object.keys(depois) as Array<keyof T>).filter((campo) => antes[campo] !== depois[campo])
  if (mudaram.length === 0) return null
  return Object.fromEntries(mudaram.map((campo) => [campo, antes[campo]])) as Partial<T>
}

/** Item 13b: os perfis de antes, se o conjunto mudou. A ordem nao conta. */
export function perfisQueMudaram(antes: readonly Perfil[], depois: readonly Perfil[]): { perfis: Perfil[] } | null {
  const conjunto = (perfis: readonly Perfil[]) => [...new Set(perfis)].sort().join(',')
  return conjunto(antes) === conjunto(depois) ? null : { perfis: [...antes] }
}

/** O valor guardado como se le: lista separada por virgula, sim ou nao, em branco. */
function emTexto(valor: unknown): string {
  if (Array.isArray(valor)) return valor.map(String).join(', ')
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não'
  if (valor === null || valor === '') return 'Em branco'
  return String(valor)
}

/**
 * Os pares do valor anterior, na ordem em que o JSON canonico os guardou.
 *
 * Chave desconhecida cai no proprio nome: a trilha vai receber alteracoes de
 * outras entidades, e esconder o que ainda nao se sabe nomear seria pior do
 * que mostrar a chave crua.
 */
export function camposAnteriores(
  valorAnterior: string,
  /** Quem le pode dar nome de gente a um valor (os perfis, na tela); sem nome, vale o texto. */
  comoLer?: (campo: string, valor: unknown) => string | undefined,
): Array<[string, string]> {
  try {
    const valor: unknown = JSON.parse(valorAnterior)
    if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
      return Object.entries(valor as Record<string, unknown>).map(([k, v]) => [k, comoLer?.(k, v) ?? emTexto(v)])
    }
  } catch { /* nao era JSON: cai no bruto, abaixo */ }
  return [['Valor anterior', valorAnterior]]
}

/** "Em que momento: Recreio · Intensidade: 3 · O que aconteceu: Tapou os ouvidos" */
export function versaoAnteriorEmTexto(valorAnterior: string | null): string {
  if (!valorAnterior) return ''
  return camposAnteriores(valorAnterior)
    .map(([campo, valor]) => `${NOME_DO_CAMPO[campo] ?? campo}: ${valor}`)
    .join(' · ')
}

// ---------------------------------------------------------------- Tela 13 (item 17)

/**
 * As entidades que o codigo audita hoje, no servidor e no mock: o filtro da
 * tela 13 e a validacao do servidor usam esta lista. Lista fechada: entidade
 * nova na trilha entra aqui, e o teste do servidor que le as declaracoes das
 * rotas acusa a que faltar. O link de acesso e gravado como `Usuario`.
 */
export const ENTIDADES_AUDITADAS = [
  'Paciente', 'VinculoFamiliar', 'Responsavel', 'PlanoTerapeutico', 'Objetivo', 'CartaoEstrategia', 'Sessao',
  'RegistroAtividade', 'OcorrenciaComportamental', 'OcorrenciaEscolar', 'AtividadeCasa', 'ExecucaoAtividadeCasa',
  'Consentimento', 'ConviteEscolar', 'VinculoEscolar', 'Escola', 'RelatorioEvolucao', 'Indicadores', 'Usuario',
  'Profissional', 'RegistroAuditoria',
] as const

export const ACOES_AUDITADAS: readonly AcaoAuditoria[] = [
  'CONCESSAO_ACESSO', 'REVOGACAO_ACESSO', 'LEITURA_AUTORIZADA', 'ACESSO_NEGADO', 'CRIACAO', 'ALTERACAO',
]

/** A pagina da tela 13, contada no banco. */
export const POR_PAGINA_DA_AUDITORIA = 20

/** O CSV leva o recorte inteiro, mas nao sem fim. */
export const LIMITE_DA_EXPORTACAO = 10_000
export const RECORTE_GRANDE_DEMAIS = 'O recorte tem mais de 10.000 registros. Reduza o período ou use outro filtro.'

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const ehUuid = (valor: string): boolean => FORMATO_UUID.test(valor)

/**
 * O filtro da tela 13, conferido igual na tela e no servidor. O periodo e em
 * dias civis de Manaus: de inicioDoDia(desde) a fimDaValidade(ate), e ate nao
 * vem antes de desde. Quem chama diz o que e um identificador: a API so
 * conhece UUID; o mock, ate a Etapa 12, usa ids legiveis.
 */
export function validarFiltroAuditoria(
  filtro: FiltroAuditoria, ehIdentificador: (valor: string) => boolean = ehUuid,
): Record<string, string> {
  const erros: Record<string, string> = {}
  if (filtro.desde && !partesDaDataCivil(filtro.desde)) erros.desde = 'Escreva a data de início do período.'
  if (filtro.ate && !partesDaDataCivil(filtro.ate)) erros.ate = 'Escreva a data de fim do período.'
  if (filtro.desde && filtro.ate && !erros.desde && !erros.ate && filtro.ate < filtro.desde) {
    erros.ate = 'O fim do período não pode vir antes do início.'
  }
  if (filtro.usuarioId && !ehIdentificador(filtro.usuarioId)) erros.usuarioId = 'Escolha uma pessoa da lista.'
  if (filtro.pacienteId && !ehIdentificador(filtro.pacienteId)) erros.pacienteId = 'Escolha um paciente da lista.'
  if (filtro.acao && !ACOES_AUDITADAS.includes(filtro.acao)) erros.acao = 'Escolha uma ação da lista.'
  if (filtro.entidade && !(ENTIDADES_AUDITADAS as readonly string[]).includes(filtro.entidade)) {
    erros.entidade = 'Escolha uma entidade da lista.'
  }
  return erros
}

/** O filtro em uma linha, para o detalhe do registro da exportacao e da consulta. */
export function descreverFiltroAuditoria(filtro: FiltroAuditoria): string {
  const partes = [
    filtro.desde && `desde ${filtro.desde}`,
    filtro.ate && `até ${filtro.ate}`,
    filtro.usuarioId && `usuário ${filtro.usuarioId}`,
    filtro.acao && `ação ${filtro.acao}`,
    filtro.pacienteId && `paciente ${filtro.pacienteId}`,
    filtro.entidade && `entidade ${filtro.entidade}`,
  ].filter(Boolean)
  return partes.length === 0 ? 'sem filtro' : partes.join(', ')
}

/**
 * O CSV da trilha, o mesmo no mock e no servidor, sem a coluna do IP. A
 * protecao contra formula e do celulaCsv, como em qualquer celula. A versao
 * anterior sai em texto legivel, e nao em JSON: quem abre a planilha quer ler.
 */
export function csvDaAuditoria(registros: RegistroDaTrilha[]): string {
  return montarCsv(
    ['Data e hora', 'Usuário', 'Perfil', 'Ação', 'Entidade', 'Identificador', 'Paciente', 'Origem', 'Detalhe', 'Versão anterior'],
    registros.map((r) => [
      r.ocorridoEm, r.usuarioNome ?? '', r.perfil ?? '', r.acao, r.entidade,
      r.idEntidade ?? '', r.pacienteId ?? '', r.origem, r.detalhe, versaoAnteriorEmTexto(r.valorAnterior),
    ]),
  )
}

/** "auditoria-2026-10-29.csv", no dia de Manaus. */
export const nomeDoArquivoDaAuditoria = (agora: Date): string => `auditoria-${diaCivilEm(agora)}.csv`
