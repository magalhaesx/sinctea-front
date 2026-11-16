import { Injectable, type OnModuleDestroy } from '@nestjs/common'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type Prisma } from '../gerado/client.js'

/** O cliente dentro de $transaction, para quem recebe a transacao de quem a abriu. */
export type TransacaoBanco = Prisma.TransactionClient

/**
 * O PrismaClient do servidor, com o adaptador pg (Prisma 7: sem motor em Rust,
 * o driver e o do Node). A conexao e preguicosa: o servidor sobe mesmo com o
 * banco fora do ar, e e a rota de saude que diz isso, com 503.
 *
 * O Prisma so existe dentro de servidor/, e nenhuma resposta devolve um modelo
 * dele (docs/01, secao 5): o que sai e sempre um tipo de compartilhado/.
 */
@Injectable()
export class ServicoBanco extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
  }

  /** Nome da ultima migracao aplicada, ou nulo se nenhuma foi. */
  async ultimaMigracaoAplicada(): Promise<string | null> {
    const linhas = await this.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name FROM _prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      ORDER BY finished_at DESC, migration_name DESC
      LIMIT 1`
    return linhas[0]?.migration_name ?? null
  }

  /**
   * O deslocamento da sessao em relacao a UTC, em segundos. Tem de ser zero: o
   * adaptador pg manda o instante sem o deslocamento, e o banco o le no fuso da
   * sessao (migracao fuso_do_banco, item 19c).
   */
  async deslocamentoDaSessao(): Promise<number> {
    const [linha] = await this.$queryRaw<Array<{ deslocamento: number }>>`
      SELECT EXTRACT(TIMEZONE FROM now())::int AS deslocamento`
    return Number(linha.deslocamento)
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}
