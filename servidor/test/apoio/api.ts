import 'reflect-metadata'
import { expect } from 'vitest'
import type { INestApplication } from '@nestjs/common'
import type { Perfil } from '@sinctea/compartilhado'
import { uuidV7 } from '../../prisma/semente/uuid7.js'
import { hashDaSenha } from '../../src/autenticacao/senhas.js'
import { criarAplicacao } from '../../src/aplicacao.js'
import type { PrismaClient } from '../../src/gerado/client.js'

/**
 * A API de verdade, numa porta qualquer, para os testes de integracao: o
 * mesmo criarAplicacao do main.ts, contra um banco de teste.
 */

export const SENHA_DE_TESTE = 'senha-de-teste-123'

export interface Resposta { status: number; corpo: any; cookies: string[]; cabecalhos: Headers }

/**
 * A aba que o pedido diz ser (item 9). Sem `aba`, e a da unica vaga que o
 * cookie traz: um cookie de `api.entrar` vale como uma aba so. `null`: o
 * pedido vai sem o cabecalho.
 */
export function abaDoCookie(cookie: string | undefined): number | null {
  const vagas = [...(cookie ?? '').matchAll(/sinctea_sessao_(\d)=/g)].map((m) => Number(m[1]))
  return vagas.length === 1 ? vagas[0] : null
}

export interface OpcoesDoPedido { corpo?: unknown; cookie?: string; aba?: number | string | null }

export interface Api {
  aplicacao: INestApplication
  pedir(metodo: string, caminho: string, opcoes?: OpcoesDoPedido): Promise<Resposta>
  entrar(email: string, senha?: string): Promise<string>
  fechar(): Promise<void>
}

export async function subirApi(urlDoBanco: string): Promise<Api> {
  process.env.DATABASE_URL = urlDoBanco
  const aplicacao = await criarAplicacao({ logger: false })
  await aplicacao.listen(0, '127.0.0.1')
  const endereco = await aplicacao.getUrl()

  const pedir: Api['pedir'] = async (metodo, caminho, opcoes = {}) => {
    const aba = opcoes.aba === undefined ? abaDoCookie(opcoes.cookie) : opcoes.aba
    const r = await fetch(`${endereco}/api${caminho}`, {
      method: metodo,
      headers: {
        ...(opcoes.corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(opcoes.cookie ? { Cookie: opcoes.cookie } : {}),
        ...(aba === null ? {} : { 'X-Sinctea-Aba': String(aba) }),
      },
      body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
    })
    const texto = await r.text()
    // O CSV da trilha (item 17) vem como texto; o resto, em JSON.
    const json = (r.headers.get('content-type') ?? 'application/json').includes('json')
    return {
      status: r.status, corpo: texto ? (json ? JSON.parse(texto) : texto) : undefined,
      cookies: r.headers.getSetCookie(), cabecalhos: r.headers,
    }
  }

  const entrar: Api['entrar'] = async (email, senha = SENHA_DE_TESTE) => {
    const r = await pedir('POST', '/auth/entrar', { corpo: { email, senha } })
    expect(r.status, `entrar como ${email}`).toBe(200)
    return cookieDaSessao(r)
  }

  return { aplicacao, pedir, entrar, fechar: () => aplicacao.close() }
}

/** "sinctea_sessao_N=valor" do Set-Cookie, pronto para o cabecalho Cookie. */
export function cookieDaSessao(r: Resposta): string {
  const linha = r.cookies.find((c) => /^sinctea_sessao_\d=[^;]/.test(c))
  if (!linha) throw new Error('resposta sem cookie de sessao')
  return linha.split(';')[0]
}

type Tipo = 'PROFISSIONAL' | 'RESPONSAVEL' | 'PROFESSOR_AEE'

/** Usuario ficticio com senha de teste, e a linha da subclasse. */
export async function criarUsuario(prisma: PrismaClient, opcoes: {
  email: string; nome?: string; perfis: Perfil[]; tipo?: Tipo; ativo?: boolean; senha?: string
}): Promise<string> {
  const id = uuidV7()
  const tipo = opcoes.tipo ?? 'PROFISSIONAL'
  await prisma.usuario.create({ data: {
    id, nome: opcoes.nome ?? `Pessoa ${opcoes.email}`, email: opcoes.email,
    senhaHash: await hashDaSenha(opcoes.senha ?? SENHA_DE_TESTE), perfis: opcoes.perfis, ativo: opcoes.ativo ?? true,
  } })
  if (tipo === 'PROFISSIONAL') {
    await prisma.profissional.create({ data: { usuarioId: id, especialidade: 'Fonoaudiologia', registroConselho: 'CRFa 0000-FICT' } })
  } else if (tipo === 'RESPONSAVEL') {
    await prisma.responsavel.create({ data: { usuarioId: id, telefone: '(92) 90000-0000' } })
  } else {
    await prisma.professorAEE.create({ data: { usuarioId: id } })
  }
  return id
}
