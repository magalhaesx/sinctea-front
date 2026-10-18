import 'reflect-metadata'
import { createHash } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'
import { Controller, Get, Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { INestApplication } from '@nestjs/common'
import { uuidV7 } from '../prisma/semente/uuid7.js'
import { Auditar, Perfis } from '../src/acesso/metadados.js'
import { LimiteDeTentativas } from '../src/autenticacao/limite-tentativas.js'
import { hashDaSenha, hashDeSenhaDesconhecida } from '../src/autenticacao/senhas.js'
import { ServicoAutenticacao } from '../src/autenticacao/servico-autenticacao.js'
import type { PrismaClient } from '../src/gerado/client.js'
import { ModuloAplicacao } from '../src/modulo-aplicacao.js'
import { clienteDe, criarBancoMigrado } from './apoio/banco.js'

/**
 * Autenticacao de verdade (docs/07, D5 e secao 0, item 1), pela API, contra
 * um banco migrado e vazio — como a producao nasce.
 *
 * O controlador de teste abaixo existe so aqui: e o jeito de exercitar a
 * guarda e o interceptador numa rota que le dado do paciente antes de os
 * modulos do item 3 existirem.
 */

const SENHA = 'senha-de-teste-123'
const pacienteDoTeste = uuidV7()

@Controller('teste')
class ControladorDeTeste {
  @Get('pacientes/:pacienteId')
  @Perfis('TERAPEUTA')
  @Auditar({
    entidade: 'Paciente', acao: 'LEITURA_AUTORIZADA', pacienteId: { parametro: 'pacienteId' },
    idEntidade: { parametro: 'pacienteId' }, detalhe: 'Leitura de teste.',
  })
  ler() {
    return { dado: 'conteudo do paciente' }
  }

  @Get('sem-declaracao')
  @Perfis('TERAPEUTA')
  semDeclaracao() {
    return { dado: 'nao deveria sair' }
  }

  // O banco recusa a gravacao (acao que a enumeracao nao tem), e a recusa so
  // chega depois, por Promise: e o caso em que esquecer de esperar a gravacao
  // deixaria o dado sair.
  @Get('auditoria-quebrada')
  @Auditar({
    entidade: 'Paciente', acao: 'ACAO_QUE_NAO_EXISTE' as unknown as 'LEITURA_AUTORIZADA', detalhe: 'Nao grava.',
  })
  auditoriaQuebrada() {
    return { dado: 'nao deveria sair sem registro' }
  }
}

@Module({ imports: [ModuloAplicacao], controllers: [ControladorDeTeste] })
class ModuloDeTeste {}

let prisma: PrismaClient
let apagar: () => Promise<void>
let aplicacao: INestApplication
let endereco: string

const u = {
  terapeuta: uuidV7(), desativado: uuidV7(), novato: uuidV7(), corrida: uuidV7(), vencido: uuidV7(),
}

interface Resposta { status: number; corpo: any; cookies: string[] }

async function pedir(metodo: string, caminho: string, opcoes: { corpo?: unknown; cookie?: string } = {}): Promise<Resposta> {
  const resposta = await fetch(`${endereco}/api${caminho}`, {
    method: metodo,
    headers: {
      ...(opcoes.corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(opcoes.cookie ? { Cookie: opcoes.cookie } : {}),
    },
    body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
  })
  const texto = await resposta.text()
  return { status: resposta.status, corpo: texto ? JSON.parse(texto) : undefined, cookies: resposta.headers.getSetCookie() }
}

/** "sinctea_sessao=valor" do Set-Cookie, pronto para o cabecalho Cookie. */
function cookieDaSessao(r: Resposta): string {
  const linha = r.cookies.find((c) => c.startsWith('sinctea_sessao='))
  if (!linha) throw new Error('resposta sem cookie de sessao')
  return linha.split(';')[0]
}

const tokenDoCookie = (cookie: string) => decodeURIComponent(cookie.split('=')[1])
const sha256 = (texto: string) => createHash('sha256').update(texto, 'utf8').digest('hex')

async function entrarComo(email: string, senha = SENHA): Promise<string> {
  const r = await pedir('POST', '/auth/entrar', { corpo: { email, senha } })
  expect(r.status).toBe(200)
  return cookieDaSessao(r)
}

async function criarUsuario(id: string, email: string, opcoes: { ativo?: boolean; perfis?: ('TERAPEUTA' | 'COORDENADOR')[]; senha?: string | null } = {}) {
  await prisma.usuario.create({ data: {
    id, nome: `Pessoa ${email}`, email,
    senhaHash: opcoes.senha === null ? await hashDeSenhaDesconhecida() : await hashDaSenha(opcoes.senha ?? SENHA),
    perfis: opcoes.perfis ?? ['TERAPEUTA'], ativo: opcoes.ativo ?? true,
  } })
  await prisma.profissional.create({ data: { usuarioId: id, especialidade: 'Fonoaudiologia', registroConselho: '' } })
}

beforeAll(async () => {
  const banco = await criarBancoMigrado(inject('urlAdministrativa'), 'sinctea_autenticacao')
  apagar = banco.apagar
  prisma = clienteDe(banco.url)
  process.env.DATABASE_URL = banco.url

  await criarUsuario(u.terapeuta, 'terapeuta@teste.example', { perfis: ['TERAPEUTA', 'COORDENADOR'] })
  await criarUsuario(u.desativado, 'desativado@teste.example', { ativo: false })
  await criarUsuario(u.novato, 'novato@teste.example', { senha: null })
  await criarUsuario(u.corrida, 'corrida@teste.example', { senha: null })
  await criarUsuario(u.vencido, 'vencido@teste.example', { senha: null })

  aplicacao = await NestFactory.create(ModuloDeTeste, { logger: false })
  aplicacao.setGlobalPrefix('api')
  await aplicacao.listen(0, '127.0.0.1')
  endereco = await aplicacao.getUrl()
})

afterAll(async () => {
  await aplicacao?.close()
  await prisma?.$disconnect()
  await apagar?.()
})

describe('entrar', () => {
  it('entra com e-mail em qualquer caixa e recebe o cookie httpOnly, Secure e SameSite=Lax', async () => {
    const r = await pedir('POST', '/auth/entrar', { corpo: { email: '  Terapeuta@TESTE.example ', senha: SENHA } })
    expect(r.status).toBe(200)
    expect(r.corpo).toMatchObject({ perfilAtivo: 'TERAPEUTA', usuario: { id: u.terapeuta, email: 'terapeuta@teste.example' } })
    expect(JSON.stringify(r.corpo)).not.toMatch(/senha/i)
    const cookie = r.cookies.find((c) => c.startsWith('sinctea_sessao='))!
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/Secure/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
    expect(cookie).toMatch(/Path=\//)
  })

  it('a mesma recusa para e-mail inexistente, senha errada e conta desativada, sem cookie', async () => {
    const tentativas = [
      { email: 'ninguem@teste.example', senha: SENHA },
      { email: 'terapeuta@teste.example', senha: 'outra-senha-qualquer' },
      { email: 'desativado@teste.example', senha: SENHA },
      { email: 'novato@teste.example', senha: '' },
      { email: 42, senha: null },
    ]
    for (const corpo of tentativas) {
      const r = await pedir('POST', '/auth/entrar', { corpo })
      expect(r.status, JSON.stringify(corpo)).toBe(401)
      expect(r.corpo).toEqual({ codigo: 'NAO_AUTENTICADO', mensagem: 'E-mail ou senha incorretos.', campos: {} })
      expect(r.cookies.some((c) => c.startsWith('sinctea_sessao=') && !c.startsWith('sinctea_sessao=;'))).toBe(false)
    }
  })

  it('o banco guarda so o resumo SHA-256 do token da sessao', async () => {
    const cookie = await entrarComo('terapeuta@teste.example')
    const token = tokenDoCookie(cookie)
    const linhas = await prisma.sessaoLogin.findMany({ where: { usuarioId: u.terapeuta } })
    expect(linhas.map((l) => l.tokenResumo)).toContain(sha256(token))
    expect(linhas.some((l) => l.tokenResumo === token)).toBe(false)
  })

  it('a entrada de demonstracao nao existe no sistema real', async () => {
    expect((await pedir('POST', '/auth/demonstracao', { corpo: { perfil: 'COORDENADOR' } })).status).toBe(404)
  })
})

describe('sessao', () => {
  it('sem cookie, a sessao atual e vazia (204)', async () => {
    expect((await pedir('GET', '/auth/sessao')).status).toBe(204)
    expect((await pedir('GET', '/auth/sessao', { cookie: 'sinctea_sessao=inventado' })).status).toBe(204)
  })

  it('com cookie, a sessao atual; depois de sair, o mesmo cookie nao vale mais', async () => {
    const cookie = await entrarComo('terapeuta@teste.example')
    const atual = await pedir('GET', '/auth/sessao', { cookie })
    expect(atual.status).toBe(200)
    expect(atual.corpo.usuario.id).toBe(u.terapeuta)

    const saida = await pedir('POST', '/auth/sair', { cookie })
    expect(saida.status).toBe(204)
    expect(saida.cookies.some((c) => c.startsWith('sinctea_sessao=;'))).toBe(true)
    expect((await pedir('GET', '/auth/sessao', { cookie })).status).toBe(204)
    expect(await prisma.sessaoLogin.count({ where: { tokenResumo: sha256(tokenDoCookie(cookie)) } })).toBe(0)
  })

  it('sessao vencida nao vale, e a linha sai do banco', async () => {
    const cookie = await entrarComo('terapeuta@teste.example')
    const resumo = sha256(tokenDoCookie(cookie))
    const linha = await prisma.sessaoLogin.findUniqueOrThrow({ where: { tokenResumo: resumo } })
    await prisma.sessaoLogin.update({
      where: { id: linha.id },
      data: { criadaEm: new Date(Date.now() - 49 * 3_600_000), expiraEm: new Date(Date.now() - 1000) },
    })
    expect((await pedir('GET', '/auth/sessao', { cookie })).status).toBe(204)
    expect((await pedir('GET', `/teste/pacientes/${pacienteDoTeste}`, { cookie })).status).toBe(401)
    expect(await prisma.sessaoLogin.count({ where: { id: linha.id } })).toBe(0)
  })

  it('conta desativada perde a sessao na chamada seguinte', async () => {
    const id = uuidV7()
    await criarUsuario(id, `sai-${id}@teste.example`)
    const cookie = await entrarComo(`sai-${id}@teste.example`)
    await prisma.usuario.update({ where: { id }, data: { ativo: false } })
    expect((await pedir('GET', '/auth/sessao', { cookie })).status).toBe(204)
  })

  it('troca para um perfil da conta; perfil que a conta nao tem e negado, e a negativa entra na trilha', async () => {
    const cookie = await entrarComo('terapeuta@teste.example')
    const troca = await pedir('POST', '/auth/perfil', { corpo: { perfil: 'COORDENADOR' }, cookie })
    expect(troca.status).toBe(200)
    expect(troca.corpo.perfilAtivo).toBe('COORDENADOR')
    expect((await pedir('GET', '/auth/sessao', { cookie })).corpo.perfilAtivo).toBe('COORDENADOR')

    const antes = await prisma.registroAuditoria.count({ where: { acao: 'ACESSO_NEGADO', usuarioId: u.terapeuta } })
    const negada = await pedir('POST', '/auth/perfil', { corpo: { perfil: 'ADMINISTRADOR' }, cookie })
    expect(negada.status).toBe(403)
    expect(await prisma.registroAuditoria.count({ where: { acao: 'ACESSO_NEGADO', usuarioId: u.terapeuta } })).toBe(antes + 1)
  })
})

describe('primeiro acesso por link', () => {
  const servico = () => aplicacao.get(ServicoAutenticacao)

  it('o link valido mostra o nome e o e-mail; o banco guarda so o resumo do token', async () => {
    const { token } = await servico().gerarAcessoInicial(u.novato)
    const r = await pedir('GET', `/auth/primeiro-acesso/${token}`)
    expect(r.corpo).toMatchObject({ situacao: 'VALIDO', nome: 'Pessoa novato@teste.example', email: 'novato@teste.example' })
    const linhas = await prisma.acessoInicial.findMany({ where: { usuarioId: u.novato } })
    expect(linhas).toHaveLength(1)
    expect(linhas[0].tokenResumo).toBe(sha256(token))
    expect(linhas[0].expiraEm.getTime() - linhas[0].criadoEm.getTime()).toBe(72 * 3_600_000)
  })

  it('senha curta e recusada sem gastar o link', async () => {
    const { token } = await servico().gerarAcessoInicial(u.novato)
    const r = await pedir('POST', `/auth/primeiro-acesso/${token}`, { corpo: { senha: 'curta' } })
    expect(r.status).toBe(422)
    expect(r.corpo.campos.senha).toMatch(/ao menos 8/)
    expect((await pedir('GET', `/auth/primeiro-acesso/${token}`)).corpo.situacao).toBe('VALIDO')
  })

  it('um link novo invalida o anterior ainda nao usado', async () => {
    const { token: antigo } = await servico().gerarAcessoInicial(u.novato)
    await servico().gerarAcessoInicial(u.novato)
    expect((await pedir('GET', `/auth/primeiro-acesso/${antigo}`)).corpo.situacao).toBe('INEXISTENTE')
  })

  it('define a senha, abre a sessao e gasta o link: a segunda vez e recusada', async () => {
    const { token } = await servico().gerarAcessoInicial(u.novato)
    const r = await pedir('POST', `/auth/primeiro-acesso/${token}`, { corpo: { senha: 'a-senha-do-novato' } })
    expect(r.status).toBe(200)
    expect(r.corpo.usuario.id).toBe(u.novato)
    const cookie = cookieDaSessao(r)
    expect((await pedir('GET', '/auth/sessao', { cookie })).corpo.usuario.id).toBe(u.novato)

    expect((await pedir('GET', `/auth/primeiro-acesso/${token}`)).corpo).toEqual({ situacao: 'USADO', nome: null, email: null, expiraEm: null, finalidade: null })
    expect((await pedir('POST', `/auth/primeiro-acesso/${token}`, { corpo: { senha: 'outra-senha-longa' } })).status).toBe(409)
    // Quem tem o link usado nao troca a senha: a do novato continua a dele.
    await entrarComo('novato@teste.example', 'a-senha-do-novato')
    expect(await prisma.registroAuditoria.count({ where: { acao: 'ALTERACAO', entidade: 'Usuario', idEntidade: u.novato } })).toBe(1)
  })

  it('dois pedidos ao mesmo tempo com o mesmo link: so um define a senha', async () => {
    const { token } = await servico().gerarAcessoInicial(u.corrida)
    const respostas = await Promise.all([
      pedir('POST', `/auth/primeiro-acesso/${token}`, { corpo: { senha: 'primeira-senha-aqui' } }),
      pedir('POST', `/auth/primeiro-acesso/${token}`, { corpo: { senha: 'segunda-senha-aqui' } }),
    ])
    expect(respostas.map((r) => r.status).sort()).toEqual([200, 409])
  })

  it('link vencido: EXPIRADO, e nao define senha', async () => {
    const { token } = await servico().gerarAcessoInicial(u.vencido)
    await prisma.acessoInicial.updateMany({
      where: { tokenResumo: sha256(token) },
      data: { criadoEm: new Date(Date.now() - 73 * 3_600_000), expiraEm: new Date(Date.now() - 3_600_000) },
    })
    expect((await pedir('GET', `/auth/primeiro-acesso/${token}`)).corpo.situacao).toBe('EXPIRADO')
    const r = await pedir('POST', `/auth/primeiro-acesso/${token}`, { corpo: { senha: 'senha-que-nao-entra' } })
    expect(r.status).toBe(409)
    expect(r.corpo.mensagem).toMatch(/venceu/)
  })

  it('link que nao existe: INEXISTENTE, sem dizer de quem seria', async () => {
    const r = await pedir('GET', '/auth/primeiro-acesso/nao-existe')
    expect(r.corpo).toEqual({ situacao: 'INEXISTENTE', nome: null, email: null, expiraEm: null, finalidade: null })
    expect((await pedir('POST', '/auth/primeiro-acesso/nao-existe', { corpo: { senha: 'senha-qualquer-longa' } })).status).toBe(404)
  })
})

describe('a guarda e o interceptador de auditoria (regra 6)', () => {
  const caminho = `/teste/pacientes/${pacienteDoTeste}`
  const daRota = () => prisma.registroAuditoria.findMany({ where: { pacienteId: pacienteDoTeste }, orderBy: { ocorridoEm: 'asc' } })

  it('sem sessao: 401, e nada entra na trilha — nao ha quem registrar', async () => {
    const antes = (await daRota()).length
    expect((await pedir('GET', caminho)).status).toBe(401)
    expect((await daRota()).length).toBe(antes)
  })

  it('perfil sem permissao: 403, e a negativa entra na trilha com o paciente', async () => {
    const cookie = await entrarComo('terapeuta@teste.example')
    await pedir('POST', '/auth/perfil', { corpo: { perfil: 'COORDENADOR' }, cookie })
    const r = await pedir('GET', caminho, { cookie })
    expect(r.status).toBe(403)
    expect(JSON.stringify(r.corpo)).not.toContain('conteudo do paciente')
    expect((await daRota()).at(-1)).toMatchObject({
      acao: 'ACESSO_NEGADO', entidade: 'Paciente', usuarioId: u.terapeuta, perfil: 'COORDENADOR',
      origem: 'CLINICA', detalhe: 'Perfil COORDENADOR sem permissão.',
    })
  })

  it('leitura autorizada: o registro entra antes de a resposta sair', async () => {
    const cookie = await entrarComo('terapeuta@teste.example')
    const r = await pedir('GET', caminho, { cookie })
    expect(r.status).toBe(200)
    expect(r.corpo).toEqual({ dado: 'conteudo do paciente' })
    expect((await daRota()).at(-1)).toMatchObject({
      acao: 'LEITURA_AUTORIZADA', entidade: 'Paciente', idEntidade: pacienteDoTeste,
      usuarioId: u.terapeuta, usuarioNome: 'Pessoa terapeuta@teste.example', perfil: 'TERAPEUTA',
      origem: 'CLINICA', detalhe: 'Leitura de teste.',
    })
  })

  it('se o registro nao puder ser gravado, o dado nao sai', async () => {
    const cookie = await entrarComo('terapeuta@teste.example')
    const r = await pedir('GET', '/teste/auditoria-quebrada', { cookie })
    expect(r.status).toBe(500)
    expect(JSON.stringify(r.corpo)).not.toContain('nao deveria sair')
  })

  it('rota sem declaracao de auditoria nao responde', async () => {
    const cookie = await entrarComo('terapeuta@teste.example')
    const r = await pedir('GET', '/teste/sem-declaracao', { cookie })
    expect(r.status).toBe(500)
    expect(JSON.stringify(r.corpo)).not.toContain('nao deveria sair')
  })
})

describe('limite de tentativas de entrada', () => {
  const limite = () => aplicacao.get(LimiteDeTentativas)
  const quinzeMinutosDepois = () => { const base = Date.now(); limite().agora = () => base + 15 * 60_000 + 1000 }
  const errar = (email: string) => pedir('POST', '/auth/entrar', { corpo: { email, senha: 'senha-errada-qualquer' } })
  const MENSAGEM = /Muitas tentativas de entrada.*15 minutos/

  beforeEach(() => { limite().limpar(); limite().agora = () => Date.now() })
  afterEach(() => { limite().limpar(); limite().agora = () => Date.now() })

  it('5 senhas erradas para o mesmo e-mail bloqueiam por 15 minutos, mesmo a senha certa; outro e-mail segue entrando', async () => {
    for (let i = 0; i < 5; i++) expect((await errar('terapeuta@teste.example')).status).toBe(401)
    const bloqueado = await pedir('POST', '/auth/entrar', { corpo: { email: 'terapeuta@teste.example', senha: SENHA } })
    expect(bloqueado.status).toBe(429)
    expect(bloqueado.corpo).toMatchObject({ codigo: 'LIMITE_TENTATIVAS', mensagem: expect.stringMatching(MENSAGEM) })
    expect(bloqueado.cookies.some((c) => c.startsWith('sinctea_sessao=') && !c.startsWith('sinctea_sessao=;'))).toBe(false)

    const outro = uuidV7()
    await criarUsuario(outro, `outro-${outro}@teste.example`)
    await entrarComo(`outro-${outro}@teste.example`)

    quinzeMinutosDepois()
    await entrarComo('terapeuta@teste.example')
  })

  it('o e-mail que nao existe bloqueia igual: o bloqueio nao revela quem tem conta', async () => {
    for (let i = 0; i < 5; i++) await errar('ninguem-aqui@teste.example')
    expect((await errar('ninguem-aqui@teste.example')).status).toBe(429)
  })

  it('a caixa do e-mail nao abre outra contagem', async () => {
    for (let i = 0; i < 5; i++) await errar(i % 2 ? 'TERAPEUTA@teste.example' : ' terapeuta@TESTE.example ')
    expect((await errar('terapeuta@teste.example')).status).toBe(429)
  })

  it('entrar com a senha certa zera a contagem daquele e-mail', async () => {
    for (let i = 0; i < 4; i++) await errar('terapeuta@teste.example')
    await entrarComo('terapeuta@teste.example')
    for (let i = 0; i < 4; i++) expect((await errar('terapeuta@teste.example')).status).toBe(401)
  })

  it('por IP: 20 erradas, em e-mails diferentes, bloqueiam o IP por 15 minutos', async () => {
    for (let i = 0; i < 20; i++) expect((await errar(`tentativa-${i}@teste.example`)).status).toBe(401)
    const bloqueado = await pedir('POST', '/auth/entrar', { corpo: { email: 'terapeuta@teste.example', senha: SENHA } })
    expect(bloqueado.status).toBe(429)
    quinzeMinutosDepois()
    await entrarComo('terapeuta@teste.example')
  })
})
