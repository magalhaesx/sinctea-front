import { DOMINIO_SO_NO_VIGENTE } from '@sinctea/compartilhado/dominio/regras'
import { emData } from '@sinctea/compartilhado/dominio/datas'

/**
 * O bloco do dominio na tela 8 (item 16): o titulo, a frase depois do criterio
 * e se o botao "Confirmar o dominio" aparece. Fora do plano vigente, a tela
 * mostra a situacao do criterio, sem o botao. Quem decide de verdade e o
 * servico, que reconfere o plano e o criterio antes de gravar; os testes do
 * front rodam no Node, sem navegador, e a decisao fica aqui.
 */
export function blocoDoDominio({ dominadoEm, vigente, atingiu }: {
  dominadoEm: string | null
  vigente: boolean
  atingiu: boolean
}): { titulo: string; frase: string; botao: boolean } {
  if (dominadoEm) {
    return { titulo: 'Objetivo dominado', frase: `Domínio confirmado em ${emData(dominadoEm)}.`, botao: false }
  }
  const titulo = atingiu ? 'Critério de domínio atingido' : 'Ainda não atingiu o critério de domínio'
  if (!vigente) return { titulo, frase: DOMINIO_SO_NO_VIGENTE, botao: false }
  return atingiu
    ? { titulo, frase: 'A promoção a dominado não é automática: depende da sua confirmação.', botao: true }
    : { titulo, frase: 'O status atual do objetivo é definido por você, no plano.', botao: false }
}
