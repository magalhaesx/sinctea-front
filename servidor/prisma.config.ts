import { existsSync } from 'node:fs'
import { defineConfig } from 'prisma/config'

// O Prisma 7 nao le o .env sozinho. O Node 22 le, sem dependencia nova.
if (existsSync('.env')) process.loadEnvFile('.env')

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migracoes',
    seed: 'node dist/prisma/semente.js',
  },
  datasource: {
    // Sem env(): ele lanca erro sem a variavel, e o `prisma generate` do
    // postinstall roda num `npm ci` que nao tem banco nenhum.
    url: process.env.DATABASE_URL ?? '',
    // Banco-sombra do `prisma migrate diff --from-migrations`, que e como se
    // gera migracao nova fora de um terminal interativo. Ver .env.exemplo.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
})
