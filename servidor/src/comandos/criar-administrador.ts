import { existsSync } from 'node:fs'
import { PrismaPg } from '@prisma/adapter-pg'
import { ErroServico } from '@sinctea/compartilhado'
import { emailValido, normalizarEmail } from '@sinctea/compartilhado/dominio/regras'
import { PrismaClient } from '../gerado/client.js'
import { criarPrimeiroAdministrador } from './administrador.js'
import { aplicarTeclas, lerArgumentos, novaLeitura, type Leitura } from './terminal.js'

/**
 * npm run criar-administrador -w @sinctea/servidor -- .env.producao --nome "Nome Completo" --email voce@exemplo.com
 *
 * Cria a conta do primeiro administrador no banco do arquivo de ambiente
 * indicado (sem arquivo, o .env). Nome e e-mail vem da linha de comando; so a
 * senha e pedida no terminal, escondida e duas vezes. Da leitura do teclado,
 * so caractere imprimivel entra na senha (terminal.ts).
 */

const USO = 'Uso: npm run criar-administrador -w @sinctea/servidor -- .env.producao --nome "Nome Completo" --email voce@exemplo.com'

const argumentos = lerArgumentos(process.argv.slice(2))
if ('erro' in argumentos) {
  console.error(`${argumentos.erro}\n${USO}`)
  process.exit(1)
}
const { arquivo, nome, email } = argumentos
// Antes de pedir a senha: errado o e-mail, ninguem digita a senha duas vezes a toa.
if (!nome.trim()) {
  console.error(`Escreva o nome do administrador. Nome recebido: ${JSON.stringify(nome)}`)
  process.exit(1)
}
if (!emailValido(normalizarEmail(email))) {
  console.error(`Escreva um e-mail valido. E-mail recebido: ${JSON.stringify(email)}`)
  process.exit(1)
}
if (!existsSync(arquivo)) {
  console.error(`Arquivo de ambiente nao encontrado: ${arquivo}`)
  process.exit(1)
}
process.loadEnvFile(arquivo)
if (!process.env.DATABASE_URL) {
  console.error(`${arquivo} nao tem DATABASE_URL.`)
  process.exit(1)
}
if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error('Rode este comando num terminal interativo (PowerShell ou Prompt de Comando):')
  console.error('este terminal nao consegue esconder a senha enquanto ela e digitada.')
  process.exit(1)
}

/** Se o Enter anterior foi "\r", o "\n" que chega depois e o resto dele. */
let ultimoEnterFoiCr = false

/** Le a senha do teclado, sem mostrar nada. */
function lerSenha(texto: string): Promise<string> {
  process.stdout.write(texto)
  const entrada = process.stdin
  return new Promise((resolver) => {
    let leitura: Leitura = novaLeitura({ pularLf: ultimoEnterFoiCr })
    entrada.setRawMode(true)
    entrada.setEncoding('utf8')
    entrada.resume()
    const aoDigitar = (pedaco: string) => {
      leitura = aplicarTeclas(leitura, pedaco)
      if (!leitura.fim) return
      entrada.off('data', aoDigitar)
      entrada.setRawMode(false)
      entrada.pause()
      process.stdout.write('\n')
      if (leitura.fim === 'CANCELADO') {
        process.stdout.write('Cancelado. Nada foi criado.\n')
        process.exit(130)
      }
      ultimoEnterFoiCr = leitura.terminouComCr
      resolver(leitura.valor)
    }
    entrada.on('data', aoDigitar)
  })
}

const banco = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
try {
  console.log(`Primeiro administrador do SINCTEA, no banco de ${arquivo}.`)
  console.log(`Nome: ${nome}`)
  console.log(`E-mail: ${email}\n`)
  const senha = await lerSenha('Senha (nao aparece): ')
  const confirmacao = await lerSenha('Repita a senha: ')
  if (senha !== confirmacao) {
    console.error('\nAs duas senhas nao conferem. Nada foi criado.')
    process.exitCode = 1
  } else {
    const criado = await criarPrimeiroAdministrador(banco, { nome, email, senha })
    console.log(`\nAdministrador criado: ${criado.email}. Entre pela tela de entrada com essa senha.`)
  }
} catch (erro) {
  const mensagem = erro instanceof ErroServico ? erro.message : `Falhou: ${(erro as Error).message}`
  console.error(`\n${mensagem} Nada foi criado.`)
  // Para enxergar o caractere invisivel, se houver: o valor exato, entre aspas. Nunca a senha.
  if (erro instanceof ErroServico && erro.campos.email) console.error(`E-mail recebido: ${JSON.stringify(email)}`)
  if (erro instanceof ErroServico && erro.campos.nome) console.error(`Nome recebido: ${JSON.stringify(nome)}`)
  process.exitCode = 1
} finally {
  await banco.$disconnect()
}
