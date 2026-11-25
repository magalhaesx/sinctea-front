import 'reflect-metadata'
import type { LoggerService } from '@nestjs/common'
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it, vi } from 'vitest'
import { ServicoRecuperacao } from '../src/autenticacao/servico-recuperacao.js'
import { ServicoEmail } from '../src/email/servico-email.js'
import type { PrismaClient } from '../src/gerado/client.js'
import { clienteDe, criarBancoMigrado } from './apoio/banco.js'
import { criarUsuario, subirApi, type Api, type OpcoesDoPedido, type Resposta } from './apoio/api.js'

/**
 * Item 23: o servidor com o transporte do Resend, e o Resend de mentira. O
 * fetch para api.resend.com e trocado aqui: nenhum e-mail sai, e a chave e
 * inventada. Fora do ar, recusando ou sem responder, o Resend nunca derruba a
 * operacao: ela conclui, a trilha registra a falha e a tela oferece o link.
 *
 * Tudo o que o servidor escreveria — o log do Nest, o console, a saida padrao
 * e a de erro — e cada resposta e linha da trilha sao conferidos no fim: a
 * chave nao aparece em nenhum.
 */

const CHAVE = 're_chave_de_mentira_do_envio_9876543210'
const REMETENTE = 'SINCTEA <nao-responda@teste.example>'
const URL_PUBLICA = 'https://sinctea.teste.example'

let prisma: PrismaClient
let api: Api
let apagar: () => Promise<void>
let email: ServicoEmail
const u: Record<string, string> = {}
const c: Record<string, string> = {}
const guardadas: Record<string, string | undefined> = {}

/** O que o servidor escreveu, por qualquer caminho. */
const escrito: string[] = []
const respostas: Resposta[] = []
const capturador: LoggerService = {
  log: (...p: unknown[]) => { escrito.push(p.map(String).join(' ')) },
  error: (...p: unknown[]) => { escrito.push(p.map(String).join(' ')) },
  warn: (...p: unknown[]) => { escrito.push(p.map(String).join(' ')) },
  debug: (...p: unknown[]) => { escrito.push(p.map(String).join(' ')) },
  verbose: (...p: unknown[]) => { escrito.push(p.map(String).join(' ')) },
  fatal: (...p: unknown[]) => { escrito.push(p.map(String).join(' ')) },
}

/** Como o Resend de mentira responde agora. */
let resend: (init: RequestInit) => Promise<Response>
let chamadasAoResend: RequestInit[] = []
let fetchOriginal: typeof fetch

const pedir = async (metodo: string, caminho: string, opcoes?: OpcoesDoPedido) => {
  const r = await api.pedir(metodo, caminho, opcoes)
  respostas.push(r)
  return r
}

beforeAll(async () => {
  for (const nome of ['RESEND_API_KEY', 'EMAIL_REMETENTE', 'URL_PUBLICA']) guardadas[nome] = process.env[nome]
  Object.assign(process.env, { RESEND_API_KEY: CHAVE, EMAIL_REMETENTE: REMETENTE, URL_PUBLICA })

  fetchOriginal = globalThis.fetch
  globalThis.fetch = (async (alvo: string | URL | Request, init: RequestInit = {}) => {
    const url = alvo instanceof Request ? alvo.url : String(alvo)
    if (url.startsWith('https://api.resend.com/')) {
      chamadasAoResend.push(init)
      return resend(init)
    }
    return fetchOriginal(alvo, init)
  }) as typeof fetch
  for (const fluxo of [process.stdout, process.stderr]) {
    const original = fluxo.write.bind(fluxo)
    vi.spyOn(fluxo, 'write').mockImplementation(((parte: unknown, ...resto: unknown[]) => {
      escrito.push(String(parte))
      return (original as (...a: unknown[]) => boolean)(parte, ...resto)
    }) as typeof fluxo.write)
  }
  for (const nivel of ['log', 'warn', 'error', 'info', 'debug'] as const) {
    vi.spyOn(console, nivel).mockImplementation((...p: unknown[]) => { escrito.push(p.map(String).join(' ')) })
  }

  const banco = await criarBancoMigrado(inject('urlAdministrativa'), 'sinctea_envio')
  apagar = banco.apagar
  prisma = clienteDe(banco.url)
  u.admin = await criarUsuario(prisma, { email: 'admin@teste.example', nome: 'Davi Administrador', perfis: ['ADMINISTRADOR'] })
  u.ana = await criarUsuario(prisma, { email: 'ana@teste.example', nome: 'Ana Souza', perfis: ['TERAPEUTA'] })
  await prisma.usuario.update({ where: { id: u.ana }, data: { ultimoAcessoEm: new Date() } })
  api = await subirApi(banco.url, { logger: capturador })
  email = api.aplicacao.get(ServicoEmail)
  c.admin = await api.entrar('admin@teste.example')
})

afterAll(async () => {
  await api?.fechar()
  await prisma?.$disconnect()
  await apagar?.()
  globalThis.fetch = fetchOriginal
  vi.restoreAllMocks()
  for (const [nome, valor] of Object.entries(guardadas)) {
    if (valor === undefined) delete process.env[nome]
    else process.env[nome] = valor
  }
})

beforeEach(() => {
  chamadasAoResend = []
  email.tempoLimiteMs = 10_000
})

let contas = 0
const convidar = () => pedir('POST', '/usuarios', {
  cookie: c.admin, corpo: { nome: `Pessoa ${++contas}`, email: `pessoa${contas}@teste.example`, perfis: ['COORDENADOR'] },
})

/** O link que saiu na resposta continua valendo: a tela oferece para copiar. */
async function linkVale(token: string) {
  expect((await pedir('GET', `/auth/primeiro-acesso/${token}`)).corpo.situacao).toBe('VALIDO')
}

describe('com o Resend de mentira', () => {
  it('o servidor sobe no modo do Resend, e avisa que o envio esta ligado', () => {
    expect(email.modo).toBe('RESEND')
    expect(escrito.join('\n')).toContain('Envio de e-mail ligado.')
  })

  it('aceito: um POST para a API do Resend, com o remetente e o link de URL_PUBLICA', async () => {
    resend = async () => new Response('{"id":"de-mentira"}', { status: 200 })
    const r = await convidar()
    expect(r.status).toBe(201)
    expect(r.corpo.primeiroAcesso.envio).toEqual({ situacao: 'ENVIADO', para: r.corpo.usuario.email })
    expect(chamadasAoResend).toHaveLength(1)
    expect((chamadasAoResend[0].headers as Record<string, string>).Authorization).toBe(`Bearer ${CHAVE}`)
    const corpo = JSON.parse(String(chamadasAoResend[0].body))
    expect(corpo).toMatchObject({ from: REMETENTE, to: [r.corpo.usuario.email], subject: 'Seu acesso ao SINCTEA' })
    expect(corpo.text).toContain(`${URL_PUBLICA}/#/app/primeiro-acesso/${r.corpo.primeiroAcesso.token}`)
    expect(email.caixa).toHaveLength(0)
  })

  it('5xx: a conta nasce, a trilha registra a falha, e o link vem na resposta para copiar', async () => {
    resend = async () => new Response(`{"message":"servico fora; chave ${CHAVE}"}`, { status: 503 })
    const r = await convidar()
    expect(r.status).toBe(201)
    expect(r.corpo.primeiroAcesso.envio.situacao).toBe('FALHOU')
    await linkVale(r.corpo.primeiroAcesso.token)
    const [criacao] = await prisma.registroAuditoria.findMany({ where: { entidade: 'Usuario', idEntidade: r.corpo.usuario.id, acao: 'CRIACAO' } })
    expect(criacao.detalhe).toContain('O e-mail não foi enviado (falha no serviço de e-mail); o link ficou na tela, para copiar.')
    expect(escrito.join('\n')).toContain('HTTP 503')
  })

  it('tempo esgotado: o pedido ao Resend e cortado, e o novo link sai assim mesmo', async () => {
    resend = (init) => new Promise((_resolver, recusar) => {
      init.signal!.addEventListener('abort', () => recusar(init.signal!.reason))
    })
    const conta = await prisma.usuario.findFirstOrThrow({ where: { email: 'pessoa1@teste.example' } })
    email.tempoLimiteMs = 100
    const inicio = Date.now()
    const r = await pedir('POST', `/usuarios/${conta.id}/acesso-inicial`, { cookie: c.admin })
    expect(r.status).toBe(200)
    expect(Date.now() - inicio).toBeLessThan(5_000)
    expect(r.corpo.envio.situacao).toBe('FALHOU')
    await linkVale(r.corpo.token)
    expect(escrito.join('\n')).toContain('O serviço de e-mail não respondeu')
  })

  it('4xx e a rede fora: falhou, sem lancar, e a operacao conclui', async () => {
    resend = async () => new Response('{"message":"remetente invalido"}', { status: 422 })
    const r1 = await convidar()
    expect(r1.status).toBe(201)
    expect(r1.corpo.primeiroAcesso.envio.situacao).toBe('FALHOU')
    resend = async () => { throw new TypeError(`fetch failed: Authorization Bearer ${CHAVE}`) }
    const r2 = await convidar()
    expect(r2.status).toBe(201)
    expect(r2.corpo.primeiroAcesso.envio.situacao).toBe('FALHOU')
    await linkVale(r2.corpo.primeiroAcesso.token)
  })

  it('"Esqueci minha senha" com o Resend fora: a mesma resposta, e a trilha registra a falha', async () => {
    resend = async () => new Response('{}', { status: 500 })
    const r = await fetch(`${api.endereco}/api/auth/nova-senha`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ana@teste.example' }),
    })
    expect(r.status).toBe(202)
    expect(await r.text()).toBe('')
    await api.aplicacao.get(ServicoRecuperacao).ocioso()
    const [linha] = await prisma.registroAuditoria.findMany({ where: { entidade: 'RecuperacaoDeSenha', idEntidade: u.ana } })
    expect(linha).toMatchObject({ acao: 'CRIACAO' })
    expect(linha.detalhe).toContain('o e-mail não foi enviado: falha no serviço de e-mail')
    expect(chamadasAoResend).toHaveLength(1)
  })

  it('a chave nao aparece em nenhum log, erro, resposta nem linha da trilha', async () => {
    // A captura funciona: o log tem as falhas acima.
    expect(escrito.some((l) => l.includes('HTTP 422'))).toBe(true)
    expect(escrito.some((l) => l.includes('não foi alcançado'))).toBe(true)
    expect(escrito.join('\n')).not.toContain(CHAVE)
    expect(respostas.length).toBeGreaterThan(5)
    for (const r of respostas) expect(JSON.stringify(r.corpo ?? null)).not.toContain(CHAVE)
    const trilha = await prisma.registroAuditoria.findMany()
    expect(trilha.length).toBeGreaterThan(0)
    for (const l of trilha) expect(`${l.detalhe} ${l.valorAnterior ?? ''}`).not.toContain(CHAVE)
  })
})
