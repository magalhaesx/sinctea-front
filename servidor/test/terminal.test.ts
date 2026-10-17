import { describe, expect, it } from 'vitest'
import { aplicarTeclas, lerArgumentos, novaLeitura, type Leitura } from '../src/comandos/terminal.js'

/**
 * A leitura do teclado do criar-administrador, sem terminal: cada pedaco e o
 * que o modo raw entregaria. O e-mail valido que virou invalido no PowerShell
 * do Lucas (17/10) e o motivo destes casos.
 */

const ler = (...pedacos: string[]): Leitura =>
  pedacos.reduce((leitura, pedaco) => aplicarTeclas(leitura, pedaco), novaLeitura())

describe('a leitura de uma linha do teclado', () => {
  it('Enter como "\\r\\n": termina no "\\r", e o "\\n" do mesmo pedaco nao entra', () => {
    expect(ler('senha-longa\r\n')).toMatchObject({ valor: 'senha-longa', fim: 'ENTER', terminouComCr: true })
  })

  it('"\\r" e "\\n" em pedacos separados: o pedido seguinte pula o "\\n", e nao termina vazio', () => {
    const primeira = ler('senha-longa\r')
    expect(primeira).toMatchObject({ valor: 'senha-longa', fim: 'ENTER', terminouComCr: true })
    let segunda = novaLeitura({ pularLf: primeira.terminouComCr })
    segunda = aplicarTeclas(segunda, '\n')
    expect(segunda.fim).toBeNull()
    segunda = aplicarTeclas(segunda, 'senha-longa\r')
    expect(segunda).toMatchObject({ valor: 'senha-longa', fim: 'ENTER' })
  })

  it('seta para a esquerda ("\\x1b[D"): a sequencia inteira some, e nada dela entra', () => {
    expect(ler('ab\x1b[Dc\r').valor).toBe('abc')
  })

  it('a sequencia de escape partida entre dois pedacos tambem some', () => {
    expect(ler('ab\x1b[', '1;5Dc\r').valor).toBe('abc')
  })

  it('escape de dois caracteres ("\\x1b@") e o foco do terminal ("\\x1b[I") nao entram', () => {
    expect(ler('a\x1b@b\x1b[Ic\x1b[Od\r').valor).toBe('abcd')
  })

  it('Backspace ("\\b" e DEL) apaga o ultimo caractere, inclusive com acento', () => {
    expect(ler('abx\bc\r').valor).toBe('abc')
    expect(ler('sã\x7fol\r').valor).toBe('sol')
    expect(ler('\b\ba\r').valor).toBe('a')
  })

  it('outros controles nao entram: tabulacao, nulo, BEL e os C1', () => {
    expect(ler('a\tb\x00c\x07d\x85e\r').valor).toBe('abcde')
  })

  it('a colagem num pedaco so: espacos, acentos e simbolos entram como vieram', () => {
    expect(ler('S3nh@ com espaço, ç e ~\r\n')).toMatchObject({ valor: 'S3nh@ com espaço, ç e ~', fim: 'ENTER' })
  })

  it('Ctrl+C cancela, e o que vinha antes nao vale', () => {
    expect(ler('meia-senha\x03resto\r').fim).toBe('CANCELADO')
  })

  it('terminada a linha, o resto do pedaco e descartado', () => {
    const fim = ler('primeira\r')
    expect(aplicarTeclas(fim, 'segunda\r')).toBe(fim)
  })

  it('Enter, Backspace e Ctrl+C no meio de uma sequencia pela metade valem como teclas', () => {
    expect(ler('abc\x1b[1\r')).toMatchObject({ valor: 'abc', fim: 'ENTER' })
    expect(ler('abc\x1b[1\x7f\r').valor).toBe('ab')
    expect(ler('abc\x1b[\x03').fim).toBe('CANCELADO')
  })

  it('a tecla Esc sozinha nao engole a letra seguinte', () => {
    expect(ler('ab\x1b', 'c\r').valor).toBe('abc')
  })
})

describe('os argumentos do criar-administrador', () => {
  it('arquivo, --nome e --email, com espaco e acento no nome', () => {
    expect(lerArgumentos(['.env.producao', '--nome', 'Lucas Magalhães Pinto', '--email', 'lucas@exemplo.com']))
      .toEqual({ arquivo: '.env.producao', nome: 'Lucas Magalhães Pinto', email: 'lucas@exemplo.com' })
  })

  it('aceita --nome=valor, em qualquer ordem, e sem arquivo usa o .env', () => {
    expect(lerArgumentos(['--email=a@b.co', '--nome=Ana']))
      .toEqual({ arquivo: '.env', nome: 'Ana', email: 'a@b.co' })
  })

  it('recusa o que falta, o que sobra e o que nao conhece', () => {
    expect(lerArgumentos(['.env.producao', '--nome', 'Ana'])).toEqual({ erro: 'Faltam --nome e --email.' })
    expect(lerArgumentos(['.env.producao', '--nome', '--email', 'a@b.co'])).toEqual({ erro: 'Falta o valor de --nome.' })
    expect(lerArgumentos(['.env.producao', '--senha', 'x'])).toEqual({ erro: 'Opcao desconhecida: --senha.' })
    expect(lerArgumentos(['a', 'b', '--nome', 'A', '--email', 'a@b.co'])).toMatchObject({ erro: expect.stringContaining('mais de um') })
  })
})
