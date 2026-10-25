/**
 * Leitura da trilha de auditoria.
 *
 * O `valorAnterior` do RegistroAuditoria e JSON canonico — bom para comparar e
 * guardar, ruim para ler. Aqui ele vira campo e valor em linguagem de gente,
 * nas duas saidas que precisam dele: a tela 13 e o CSV exportado. Fica no
 * dominio para que as duas digam a mesma coisa.
 */

import type { Perfil, RegistroAuditoria } from '../tipos.js'

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

/**
 * Os pares do valor anterior, na ordem em que o JSON canonico os guardou.
 *
 * Chave desconhecida cai no proprio nome: a trilha vai receber alteracoes de
 * outras entidades, e esconder o que ainda nao se sabe nomear seria pior do
 * que mostrar a chave crua.
 */
export function camposAnteriores(valorAnterior: string): Array<[string, string]> {
  try {
    const valor: unknown = JSON.parse(valorAnterior)
    if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
      return Object.entries(valor as Record<string, unknown>).map(([k, v]) => [k, String(v)])
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
