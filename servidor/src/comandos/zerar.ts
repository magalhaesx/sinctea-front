import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '../gerado/client.js'

/**
 * Zerar o banco depois do ensaio, e conferir o papel da aplicacao (docs/07,
 * secao 0: producao comeca vazia). O mesmo codigo roda no comando, contra o
 * Neon, e no teste, contra um banco descartavel: test/zerar.test.ts.
 *
 * Zerar e: apagar e recriar o esquema public, aplicar as migracoes, sem
 * semente, e devolver ao papel da aplicacao os privilegios do modelo
 * versionado. O papel nao e recriado: a senha dele, no Render, continua
 * valendo.
 */

/** servidor/, venha o modulo de src/ (teste) ou de dist/src/ (comando). */
export function pastaDoServidor(): string {
  let pasta = dirname(fileURLToPath(import.meta.url))
  while (!existsSync(join(pasta, 'prisma', 'schema.prisma'))) {
    const acima = dirname(pasta)
    if (acima === pasta) throw new Error('Pasta do servidor nao encontrada.')
    pasta = acima
  }
  return pasta
}

/** As migracoes versionadas, na ordem em que se aplicam. */
export function migracoesVersionadas(): string[] {
  return readdirSync(join(pastaDoServidor(), 'prisma', 'migracoes'), { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name).sort()
}

/**
 * Os GRANT e o ALTER DEFAULT PRIVILEGES de prisma/papel-aplicacao.exemplo.sql,
 * sem o CREATE ROLE e sem o CONNECT no banco, que sobrevivem ao esquema.
 */
export function privilegiosDoModelo(papel: string): string[] {
  const modelo = readFileSync(join(pastaDoServidor(), 'prisma', 'papel-aplicacao.exemplo.sql'), 'utf8')
  return modelo
    .split('\n').filter((linha) => !linha.startsWith('--')).join('\n')
    .split(';').map((c) => c.replace(/\s+/g, ' ').trim()).filter(Boolean)
    .filter((c) => /^(GRANT|ALTER DEFAULT PRIVILEGES)\b/.test(c) && !/ON DATABASE/.test(c))
    .map((c) => c.replaceAll('sinctea_app', `"${papel}"`))
}

/** prisma migrate deploy contra a URL dada. Devolve so os nomes aplicados: o log do Prisma diria o endereco do banco. */
export function aplicarMigracoes(url: string): string[] {
  const cli = createRequire(import.meta.url).resolve('prisma/build/index.js')
  const r = spawnSync(process.execPath, [cli, 'migrate', 'deploy'], {
    cwd: pastaDoServidor(), env: { ...process.env, DATABASE_URL: url }, encoding: 'utf8',
  })
  const saida = `${r.stdout}\n${r.stderr}`.split('\n').filter((l) => !/Datasource/.test(l)).join('\n')
  if (r.status !== 0) throw new Error(`prisma migrate deploy falhou:\n${saida}`)
  return [...new Set(saida.match(/\d{14}_[a-z_]+/g) ?? [])].sort()
}

export interface Retrato { banco: string; usuario: string; tabelas: number; usuarios: number | null; pacientes: number | null }

/** O que existe agora, para quem vai zerar ver antes de confirmar. Nao le dado de ninguem: so conta. */
export async function retrato(dono: PrismaClient): Promise<Retrato> {
  const [{ banco, usuario }] = await dono.$queryRawUnsafe<Array<{ banco: string; usuario: string }>>(
    'SELECT current_database() AS banco, current_user AS usuario')
  const [{ tabelas }] = await dono.$queryRawUnsafe<Array<{ tabelas: number }>>(
    `SELECT count(*)::int AS tabelas FROM pg_tables WHERE schemaname = 'public'`)
  const contar = async (tabela: string) => {
    const [{ existe }] = await dono.$queryRawUnsafe<Array<{ existe: boolean }>>(
      `SELECT to_regclass('public.${tabela}') IS NOT NULL AS existe`)
    if (!existe) return null
    return (await dono.$queryRawUnsafe<Array<{ n: number }>>(`SELECT count(*)::int AS n FROM public.${tabela}`))[0].n
  }
  return { banco, usuario, tabelas, usuarios: await contar('usuario'), pacientes: await contar('paciente') }
}

/**
 * Recusa antes de apagar qualquer coisa: quem conecta tem de ser o dono das
 * tabelas, e nao o papel da aplicacao. Com a URL errada colada no arquivo,
 * nada acontece.
 */
export async function exigirDono(dono: PrismaClient, papel: string): Promise<void> {
  const [{ usuario, donoDasTabelas }] = await dono.$queryRawUnsafe<Array<{ usuario: string; donoDasTabelas: string | null }>>(
    `SELECT current_user AS usuario,
       (SELECT tableowner FROM pg_tables WHERE schemaname = 'public' AND tablename = '_prisma_migrations') AS "donoDasTabelas"`)
  if (usuario === papel) throw new Error(`Esta URL e a do papel da aplicacao (${papel}). Zerar exige a do dono.`)
  if (donoDasTabelas !== null && donoDasTabelas !== usuario) {
    throw new Error(`Quem conecta (${usuario}) nao e o dono das tabelas (${donoDasTabelas}). Nada foi apagado.`)
  }
}

/** Apaga tudo, aplica as migracoes e devolve os privilegios. Devolve as migracoes aplicadas. */
export async function zerarBanco(dono: PrismaClient, urlDoDono: string, papel: string): Promise<string[]> {
  await exigirDono(dono, papel)
  // Como o `prisma migrate reset`: o esquema inteiro, com a auditoria — que o
  // trigger protege de DELETE e TRUNCATE, mas nao do DROP do dono.
  await dono.$executeRawUnsafe('DROP SCHEMA public CASCADE')
  await dono.$executeRawUnsafe('CREATE SCHEMA public')
  const aplicadas = aplicarMigracoes(urlDoDono)
  // Depois das migracoes: o GRANT em ALL TABLES vale para as que ja existem.
  for (const comando of privilegiosDoModelo(papel)) await dono.$executeRawUnsafe(comando)
  return aplicadas
}

export interface Conferencia { rotulo: string; valor: string; ok: boolean }

class Desfazer extends Error {}

/** A conferencia do B3, conectada como o papel da aplicacao. So le; as duas tentativas sao desfeitas. */
export async function conferirPapel(comoPapel: PrismaClient, papel: string): Promise<Conferencia[]> {
  const itens: Conferencia[] = []
  const conferir = (rotulo: string, valor: unknown, ok: boolean) => itens.push({ rotulo, valor: String(valor), ok })
  const q = <T>(sql: string) => comoPapel.$queryRawUnsafe<T[]>(sql)

  const [{ usuario }] = await q<{ usuario: string }>('SELECT current_user AS usuario')
  conferir('quem conecta', usuario, usuario === papel)

  const [atributos] = await q<{ rolsuper: boolean; rolcreaterole: boolean; rolcreatedb: boolean; rolbypassrls: boolean }>(
    'SELECT rolsuper, rolcreaterole, rolcreatedb, rolbypassrls FROM pg_roles WHERE rolname = current_user')
  conferir('atributos do papel (super, cria papel, cria banco, ignora RLS)', JSON.stringify(atributos),
    !atributos.rolsuper && !atributos.rolcreaterole && !atributos.rolcreatedb && !atributos.rolbypassrls)

  const tabelas = await q<{ tabela: string; dono: boolean; basicos: boolean; trunca: boolean }>(`
    SELECT tablename AS tabela, tableowner = current_user AS dono,
      has_table_privilege(format('public.%I', tablename), 'SELECT,INSERT,UPDATE,DELETE') AS basicos,
      has_table_privilege(format('public.%I', tablename), 'TRUNCATE') AS trunca
    FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`)
  conferir('tabelas no esquema public', tabelas.length, tabelas.length > 1)
  const donas = tabelas.filter((t) => t.dono).map((t) => t.tabela)
  conferir('tabelas de que o papel e dono', donas.join(', ') || 'nenhuma', donas.length === 0)
  const semBasicos = tabelas.filter((t) => !t.basicos).map((t) => t.tabela)
  conferir('tabelas sem SELECT, INSERT, UPDATE e DELETE', semBasicos.join(', ') || 'nenhuma', semBasicos.length === 0)
  const comTruncate = tabelas.filter((t) => t.trunca).map((t) => t.tabela)
  conferir('tabelas com TRUNCATE', comTruncate.join(', ') || 'nenhuma', comTruncate.length === 0)

  const [{ cria }] = await q<{ cria: boolean }>(`SELECT has_schema_privilege('public', 'CREATE') AS cria`)
  conferir('CREATE no esquema public', cria, !cria)

  const esperadas = migracoesVersionadas()
  const aplicadas = (await q<{ nome: string }>(
    `SELECT migration_name AS nome FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY 1`))
    .map((l) => l.nome)
  conferir('migracoes aplicadas', aplicadas.join(', '), JSON.stringify(aplicadas) === JSON.stringify(esperadas))

  const gatilhos = await q<{ tabela: string; ligados: number }>(`
    SELECT c.relname AS tabela, count(*)::int AS ligados FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE NOT t.tgisinternal AND t.tgenabled <> 'D' AND c.relname IN ('registro_auditoria', 'relatorio_evolucao')
    GROUP BY c.relname ORDER BY 1`)
  conferir('triggers de imutabilidade ligados', gatilhos.map((g) => `${g.tabela}: ${g.ligados}`).join(', '),
    gatilhos.length === 2 && gatilhos.every((g) => g.ligados >= 2))

  // Tentativas de verdade, dentro de transacao desfeita: nada fica no banco.
  const tentar = async (rotulo: string, sql: string, recusa: RegExp) => {
    try {
      await comoPapel.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(sql)
        throw new Desfazer()
      })
    } catch (e) {
      if (e instanceof Desfazer) return conferir(rotulo, 'passou', false)
      const mensagem = (e as Error).message
      return conferir(rotulo, `recusado (${mensagem.match(recusa)?.[0] ?? mensagem.slice(0, 80)})`, recusa.test(mensagem))
    }
  }
  await tentar('CREATE TABLE', 'CREATE TABLE intrusa (id int)', /permission denied for schema public/)
  await tentar('desligar o trigger da auditoria', 'ALTER TABLE registro_auditoria DISABLE TRIGGER ALL', /must be owner of table registro_auditoria/)

  return itens
}
