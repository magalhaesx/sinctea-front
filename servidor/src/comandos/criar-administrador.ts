import { existsSync } from 'node:fs'
import { PrismaPg } from '@prisma/adapter-pg'
import { ErroServico } from '@sinctea/compartilhado'
import { PrismaClient } from '../gerado/client.js'
import { criarPrimeiroAdministrador } from './administrador.js'

/**
 * npm run criar-administrador -w @sinctea/servidor -- .env.producao
 *
 * Cria a conta do primeiro administrador no banco do arquivo de ambiente
 * indicado (sem argumento, o .env). Pede nome, e-mail e senha no terminal; a
 * senha nao aparece enquanto e digitada e e pedida duas vezes.
 */

const arquivo = process.argv[2] ?? '.env'
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

/** Le uma linha do teclado. Com `oculto`, nada do que se digita aparece. */
function perguntar(texto: string, oculto = false): Promise<string> {
  process.stdout.write(texto)
  const entrada = process.stdin
  return new Promise((resolver) => {
    let valor = ''
    entrada.setRawMode(true)
    entrada.setEncoding('utf8')
    entrada.resume()
    const aoDigitar = (teclas: string) => {
      for (const tecla of teclas) {
        if (tecla === '\u0003') {
          entrada.setRawMode(false)
          process.stdout.write('\nCancelado.\n')
          process.exit(130)
        }
        if (tecla === '\r' || tecla === '\n') {
          entrada.off('data', aoDigitar)
          entrada.setRawMode(false)
          entrada.pause()
          process.stdout.write('\n')
          resolver(valor)
          return
        }
        if (tecla === '\u007f' || tecla === '\b') {
          if (valor.length > 0) {
            valor = valor.slice(0, -1)
            if (!oculto) process.stdout.write('\b \b')
          }
          continue
        }
        valor += tecla
        if (!oculto) process.stdout.write(tecla)
      }
    }
    entrada.on('data', aoDigitar)
  })
}

const banco = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
try {
  console.log(`Primeiro administrador do SINCTEA, no banco de ${arquivo}.\n`)
  const nome = await perguntar('Nome: ')
  const email = await perguntar('E-mail: ')
  const senha = await perguntar('Senha (nao aparece): ', true)
  const confirmacao = await perguntar('Repita a senha: ', true)
  if (senha !== confirmacao) {
    console.error('\nAs duas senhas nao conferem. Nada foi criado.')
    process.exitCode = 1
  } else {
    const criado = await criarPrimeiroAdministrador(banco, { nome, email, senha })
    console.log(`\nAdministrador criado: ${criado.email}. Entre pela tela de entrada com essa senha.`)
  }
} catch (erro) {
  console.error(`\n${erro instanceof ErroServico ? erro.message : `Falhou: ${(erro as Error).message}`} Nada foi criado.`)
  process.exitCode = 1
} finally {
  await banco.$disconnect()
}
