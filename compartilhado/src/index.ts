/**
 * Ponto de entrada do pacote: tipos e contratos. O dominio entra pelo caminho
 * proprio — `@sinctea/compartilhado/dominio/regras` —, um modulo por arquivo,
 * como era em src/.
 *
 * Este pacote nao importa nada de fora dele: nem do front, nem do servidor.
 * O teste de arquitetura confere.
 */
export * from './tipos.js'
export type * from './contratos.js'
