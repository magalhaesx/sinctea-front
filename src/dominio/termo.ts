import { resumoSha256 } from './hash'
import { emData } from './datas'
import type { DataIso, EscopoAcesso } from '../servicos/tipos'

/**
 * O termo de autorizacao de acesso da escola, versionado.
 *
 * Duas decisoes sustentam esta tela diante da LGPD:
 *
 * 1. **Versoes antigas permanecem neste arquivo.** Um termo aceito ha seis
 *    meses precisa poder ser reapresentado com as palavras daquela epoca — nao
 *    com as de hoje. Quando o texto mudar, acrescente a versao nova e NAO
 *    apague a anterior.
 *
 * 2. **O texto renderizado nao e gravado.** Todos os campos que o compoem ja
 *    estao persistidos no Consentimento, entao o texto se reproduz de forma
 *    deterministica a partir da versao mais os dados — e o resumo prova que
 *    nada mudou. E a mesma ideia do relatorio emitido (UC09), sem duplicar
 *    conteudo em dois lugares que podem divergir.
 */

export const VERSAO_CORRENTE_DO_TERMO = '2026-10'

/** O que o texto precisa saber para se escrever por inteiro. */
export interface DadosDoTermo {
  responsavel: string
  escola: string
  aluno: string
  escopos: EscopoAcesso[]
  validadeAte: DataIso
}

/**
 * O que entra no resumo: so fatos imutaveis do registro, sem nome nenhum.
 *
 * Nome nao entra por duas razoes. VinculoFamiliar e muitos-para-muitos, entao
 * mais de um responsavel pode abrir a mesma autorizacao, e a reconstrucao nao
 * teria como saber o nome de QUEM concedeu sem grava-lo. E nome de escola muda:
 * escola renomeada e a mesma escola, e a tela deve mostrar o nome de hoje —
 * isso e correto, nao e divergencia.
 *
 * O resumo continua cobrindo tudo que altera a autorizacao: outra escola, outra
 * crianca, outro escopo, outra validade, outra versao de texto.
 */
export interface DadosDoResumo {
  versaoTermo: string
  responsavelId: string
  pacienteId: string
  escolaId: string
  escopos: EscopoAcesso[]
  validadeAte: DataIso
  concedidoEm: DataIso
}

/** Cada escopo nas palavras do termo, sem vocabulario tecnico. */
const LINHA_DO_ESCOPO: Record<EscopoAcesso, string> = {
  CARTAO_ESTRATEGIA:
    'Cartão de estratégias — as orientações práticas escritas pela equipe terapêutica, em linguagem comum.',
  REGISTRO_OCORRENCIA:
    'Registro de ocorrência — a escola poderá relatar o que observou no dia a dia, sem acesso a nenhuma informação clínica.',
}

function texto202610(d: DadosDoTermo): string {
  const escopos = d.escopos.map((e) => LINHA_DO_ESCOPO[e]).join('\n')
  return `TERMO DE AUTORIZAÇÃO DE ACESSO DA ESCOLA
Versão 2026-10

1. O que você está autorizando
Você, ${d.responsavel}, autoriza a escola ${d.escola} a ver, pelo SINCTEA, as
informações marcadas no item 3 sobre ${d.aluno}.

2. Quem vai ver
Apenas a pessoa que receber o convite que você vai entregar, e somente depois de
criar a conta com esse convite. O convite vale uma única vez e perde a validade
em 72 horas. Ninguém da escola consegue criar conta sozinho.

3. O que a escola vai ver
${escopos}

4. O que a escola não vai ver, em nenhuma hipótese
O diagnóstico, o laudo, o nível de suporte, o plano terapêutico, a evolução das
sessões e o histórico de atendimentos.

5. Por quanto tempo
Até ${emData(d.validadeAte)}. Depois dessa data o acesso termina sozinho, sem você precisar
fazer nada.

6. Como encerrar antes
Você pode encerrar quando quiser, na tela de autorizações. O encerramento vale na
hora: na próxima vez que a escola tentar abrir, já não consegue.

7. O que fica registrado
A data e a hora desta autorização, a versão deste texto, todas as vezes que a
escola abriu as informações e também as vezes em que tentou e foi recusada.

8. Base legal
As informações sobre ${d.aluno} são dados de saúde. Elas são tratadas com o seu
consentimento, como responsável legal, conforme o artigo 11, inciso I, da Lei
Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018). Você pode pedir a
qualquer momento a relação de quem acessou.`
}

/** Toda versao ja publicada. Nenhuma linha sai daqui. */
const VERSOES: Record<string, (d: DadosDoTermo) => string> = {
  '2026-10': texto202610,
}

export function versaoConhecida(versao: string): boolean {
  return versao in VERSOES
}

/** O texto da versao pedida, com os campos preenchidos. */
export function textoDoTermo(versao: string, dados: DadosDoTermo): string {
  const escrever = VERSOES[versao]
  if (!escrever) {
    throw new Error(`Versão de termo desconhecida: ${versao}. Versões antigas não podem ser removidas.`)
  }
  return escrever(dados)
}

/**
 * "sha256:<versao>:<hex>". A versao entra DENTRO do valor para que o resumo
 * diga qual texto o reproduz — assim nenhum campo novo e preciso no modelo, e
 * o diagrama de classes nao muda.
 */
export async function resumoDoTermo(dados: DadosDoResumo): Promise<string> {
  const resumo = await resumoSha256(dados)
  return `sha256:${dados.versaoTermo}:${resumo.replace('sha256:', '')}`
}

/** A versao gravada dentro do resumo, para saber qual texto reapresentar. */
export function versaoDoResumo(hashTermo: string): string | null {
  const partes = hashTermo.split(':')
  return partes.length === 3 && partes[0] === 'sha256' ? partes[1] : null
}

/** Recalcula e compara: o termo guardado continua sendo o que foi aceito? */
export async function conferirResumoDoTermo(hashTermo: string, dados: DadosDoResumo): Promise<boolean> {
  return hashTermo === await resumoDoTermo(dados)
}
