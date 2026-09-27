/**
 * Conversao entre a data que vem do servico e a data da pessoa.
 *
 * Uma data sem hora — "2019-03-12" — e lida pelo navegador como meia-noite
 * UTC. A oeste de Greenwich isso volta um dia: 12/03 aparece como 11/03. Numa
 * data de nascimento de prontuario, e defeito grave.
 *
 * A regra que evita esse defeito mora aqui, e so aqui. Quem precisa formatar
 * data importa deste modulo — copia da regra e como ela volta a se perder.
 */

/**
 * ISO do servico para Date local. Data sem hora vira meio-dia local, longe das
 * duas bordas do dia; texto com hora passa direto, porque ali o instante ja
 * esta determinado.
 */
export function dataIsoParaLocal(iso: string): Date {
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
}

/**
 * Date local para AAAA-MM-DD — a forma que o campo `type="date"` e os filtros
 * de periodo esperam. Usa o dia de quem olha, nao o dia em UTC.
 */
export function diaIso(data: Date): string {
  const doisDigitos = (n: number) => String(n).padStart(2, '0')
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`
}

/** Data como ela aparece na tela: 12/03/2019. */
export function emData(iso: string): string {
  return dataIsoParaLocal(iso).toLocaleDateString('pt-BR')
}
