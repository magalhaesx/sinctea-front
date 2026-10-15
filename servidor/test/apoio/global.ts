import { randomBytes } from 'node:crypto'
import type { TestProject } from 'vitest/node'
import { semear } from '../../prisma/semente.js'
import { abrirServidorDeTeste, apagarBanco, clienteDe, criarBanco, migrar, nomeDescartavel } from './banco.js'

declare module 'vitest' {
  export interface ProvidedContext {
    /** Banco "postgres" do servidor de teste: para criar bancos descartaveis. */
    urlAdministrativa: string
    /** Banco migrado e semeado, so para leitura nos testes. */
    urlSemeado: string
  }
}

/**
 * Antes da suite do servidor: um servidor PostgreSQL (o do CI ou um embutido),
 * um banco com prisma migrate deploy e a semente. Se qualquer passo falhar, a
 * suite nao roda — e o erro aparece, em vez de testes pulados.
 */
export default async function prepararBanco(projeto: TestProject) {
  const servidor = await abrirServidorDeTeste()
  const nome = nomeDescartavel('sinctea_semeado')
  const url = await criarBanco(servidor.urlAdministrativa, nome)
  migrar(url)

  const prisma = clienteDe(url)
  try {
    // Senha descartavel: so o hash dela vai para o banco de teste.
    await semear(prisma, { senha: randomBytes(12).toString('hex') })
  } finally {
    await prisma.$disconnect()
  }

  projeto.provide('urlAdministrativa', servidor.urlAdministrativa)
  projeto.provide('urlSemeado', url)

  return async () => {
    await apagarBanco(servidor.urlAdministrativa, nome)
    await servidor.encerrar()
  }
}
