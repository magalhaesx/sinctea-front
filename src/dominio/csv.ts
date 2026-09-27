/**
 * Geracao de CSV para exportacao.
 *
 * Duas decisoes que nao sao de gosto:
 *
 * 1. Separador ";" e UTF-8 com BOM. E assim que o Excel em portugues abre o
 *    arquivo sem juntar tudo numa coluna e sem trocar os acentos por simbolos.
 *    Virgula e o padrao do formato, mas aqui quem abre o arquivo e a
 *    coordenacao, num Excel em pt-BR.
 *
 * 2. Celula que comeca com =, +, -, @, tabulacao ou retorno de carro ganha um
 *    apostrofo na frente. Sem isso, o texto que alguem digitou num campo do
 *    sistema vira formula quando a planilha abre — e o detalhe da auditoria e
 *    o nome do usuario vem de dado digitado.
 */

/** Caracteres com que uma planilha comeca a interpretar a celula como formula. */
const INICIO_DE_FORMULA = /^[=+\-@\t\r]/

export const BOM_UTF8 = '﻿'

/** Uma celula pronta: escapada contra formula e contra o proprio separador. */
export function celulaCsv(valor: unknown): string {
  const texto = valor === null || valor === undefined ? '' : String(valor)
  const seguro = INICIO_DE_FORMULA.test(texto) ? `'${texto}` : texto
  // Aspas dentro do texto dobram; o texto inteiro vai entre aspas para que
  // ponto e virgula, quebra de linha e aspas nao partam a coluna.
  return `"${seguro.replace(/"/g, '""')}"`
}

/** Linhas de dados sob um cabecalho, com BOM na frente e CRLF entre linhas. */
export function montarCsv(cabecalho: string[], linhas: unknown[][]): string {
  const paraLinha = (celulas: unknown[]) => celulas.map(celulaCsv).join(';')
  return BOM_UTF8 + [cabecalho, ...linhas].map(paraLinha).join('\r\n') + '\r\n'
}
