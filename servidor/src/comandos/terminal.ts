/**
 * Entrada pelo terminal dos comandos do servidor. Funcoes puras: o comando
 * entrega cada pedaco que o teclado manda, e o teste confere o resultado sem
 * terminal nenhum (test/terminal.test.ts).
 *
 * Em modo raw, o terminal do Windows manda mais do que as letras: Enter como
 * "\r\n", as vezes em dois pedacos; setas e foco como sequencias de escape
 * (ESC [ ... letra); e outros controles. So caractere imprimivel entra no
 * valor. Enter termina, Backspace apaga, Ctrl+C cancela.
 */

export interface Leitura {
  valor: string
  /** Nulo enquanto a linha nao terminou. */
  fim: 'ENTER' | 'CANCELADO' | null
  /** A sequencia de escape que comecou e ainda nao terminou. Pode atravessar pedacos. */
  escape: string
  /** O Enter anterior foi "\r": um "\n" logo em seguida e o resto dele, e nao outro Enter. */
  pularLf: boolean
  /** Como a linha terminou: o proximo pedido precisa saber se pula o "\n". */
  terminouComCr: boolean
}

export function novaLeitura(opcoes: { pularLf?: boolean } = {}): Leitura {
  return { valor: '', fim: null, escape: '', pularLf: opcoes.pularLf ?? false, terminouComCr: false }
}

const ESC = '\x1b'
const LIMITE_DO_ESCAPE = 32

/** Imprimivel: nem controle C0 (< 0x20), nem DEL (0x7f), nem controle C1 (0x80 a 0x9f). */
function imprimivel(caractere: string): boolean {
  const codigo = caractere.codePointAt(0)!
  return codigo >= 0x20 && codigo !== 0x7f && !(codigo >= 0x80 && codigo <= 0x9f)
}

/**
 * A sequencia de escape terminou? CSI (ESC [) termina num byte de 0x40 a 0x7e;
 * SS3 (ESC O), no caractere seguinte; OSC (ESC ]), em BEL ou ESC \. Qualquer
 * outro caractere depois do ESC forma uma sequencia de dois, como ESC @.
 */
function escapeTerminou(sequencia: string): boolean {
  if (sequencia.length > LIMITE_DO_ESCAPE) return true
  if (sequencia.length < 2) return false
  const tipo = sequencia[1]
  const ultimo = sequencia.charCodeAt(sequencia.length - 1)
  if (tipo === '[') return sequencia.length >= 3 && ultimo >= 0x40 && ultimo <= 0x7e
  if (tipo === 'O') return sequencia.length >= 3
  if (tipo === ']') return sequencia.endsWith('\x07') || sequencia.endsWith(`${ESC}\\`)
  return true
}

/** Aplica um pedaco do teclado a leitura. Depois do fim, o resto do pedaco e descartado. */
export function aplicarTeclas(leitura: Leitura, pedaco: string): Leitura {
  let { valor, escape, pularLf } = leitura
  if (leitura.fim) return leitura
  for (const tecla of pedaco) {
    if (pularLf) {
      pularLf = false
      if (tecla === '\n') continue
    }
    // Controle no meio da sequencia vale como controle (ECMA-48): Enter,
    // Ctrl+C e Backspace nunca sao engolidos por um escape pela metade.
    if (escape && (tecla.charCodeAt(0) < 0x20 || tecla === '\x7f') && tecla !== ESC) escape = ''
    if (escape) {
      escape += tecla
      if (escapeTerminou(escape)) escape = ''
      continue
    }
    if (tecla === ESC) { escape = tecla; continue }
    if (tecla === '\x03') return { valor, fim: 'CANCELADO', escape: '', pularLf: false, terminouComCr: false }
    if (tecla === '\r' || tecla === '\n') {
      return { valor, fim: 'ENTER', escape: '', pularLf: false, terminouComCr: tecla === '\r' }
    }
    if (tecla === '\x7f' || tecla === '\b') { valor = Array.from(valor).slice(0, -1).join(''); continue }
    if (imprimivel(tecla)) valor += tecla
  }
  // ESC sozinho no fim do pedaco e a tecla Esc, e nao o comeco de uma
  // sequencia: as sequencias chegam inteiras, ou ao menos com o "[".
  if (escape === ESC) escape = ''
  return { valor, fim: null, escape, pularLf, terminouComCr: false }
}

export interface ArgumentosDoAdministrador { arquivo: string; nome: string; email: string }

/**
 * npm run criar-administrador -w @sinctea/servidor -- .env.producao --nome "Nome" --email a@b.c
 *
 * Nome e e-mail entram como argumentos, e nao pelo teclado: o que se digita
 * no terminal e o que se ve na linha de comando. Aceita --nome=Valor tambem.
 */
export function lerArgumentos(argv: string[]): ArgumentosDoAdministrador | { erro: string } {
  const valores: Record<string, string> = {}
  const soltos: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const atual = argv[i]
    const comIgual = /^--(nome|email)=(.*)$/s.exec(atual)
    if (comIgual) { valores[comIgual[1]] = comIgual[2]; continue }
    const opcao = /^--(nome|email)$/.exec(atual)
    if (opcao) {
      const proximo = argv[i + 1]
      if (proximo === undefined || proximo.startsWith('--')) return { erro: `Falta o valor de --${opcao[1]}.` }
      valores[opcao[1]] = proximo
      i++
      continue
    }
    if (atual.startsWith('--')) return { erro: `Opcao desconhecida: ${atual}.` }
    soltos.push(atual)
  }
  if (soltos.length > 1) return { erro: `So um arquivo de ambiente, e veio mais de um: ${soltos.join(' ')}.` }
  if (valores.nome === undefined || valores.email === undefined) return { erro: 'Faltam --nome e --email.' }
  return { arquivo: soltos[0] ?? '.env', nome: valores.nome, email: valores.email }
}
