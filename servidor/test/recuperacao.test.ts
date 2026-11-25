import { request as pedidoHttp } from 'node:http'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { dataEHoraNaInstancia } from '@sinctea/compartilhado/dominio/datas'
import { LINK_DE_RECUPERACAO_QUE_NAO_VALE } from '@sinctea/compartilhado/dominio/recuperacao'
import { ServicoAutenticacao } from '../src/autenticacao/servico-autenticacao.js'
import { ServicoRecuperacao } from '../src/autenticacao/servico-recuperacao.js'
import { resumoDoToken } from '../src/autenticacao/servico-sessoes.js'
import type { Mensagem } from '../src/email/mensagens.js'
import { ServicoEmail } from '../src/email/servico-email.js'
import type { PrismaClient } from '../src/gerado/client.js'
import { clienteDe, criarBancoMigrado } from './apoio/banco.js'
import { SENHA_DE_TESTE, abaDoCookie, criarUsuario, subirApi, type Api } from './apoio/api.js'

/**
 * Item 23: "Esqueci minha senha" e os links que a clinica gera, agora tambem
 * por e-mail. Tudo com o transporte de memoria: nenhum e-mail sai daqui.
 *
 * A rota responde sempre igual, e so depois o pedido e examinado. Os limites
 * sao contados na trilha: por conta e por origem, na ultima hora; o teto da
 * clinica, em 24 horas. Para o teste ter origens diferentes, o Express confia
 * no X-Forwarded-For, como em producao confia no do proxy do Render.
 */

const URL_PUBLICA = 'https://sinctea.teste.example'
const PACIENTE = { nome: 'Joaquim Ventania', dataNascimento: '2019-03-12', nivelSuporte: 2 }

let prisma: PrismaClient
let api: Api
let apagar: () => Promise<void>
let email: ServicoEmail
let recuperacao: ServicoRecuperacao
let urlAnterior: string | undefined
let chaveAnterior: string | undefined
const u: Record<string, string> = {}
const c: Record<string, string> = {}

let ultimoIp = 0
const novoIp = () => `10.23.0.${++ultimoIp}`

/** O pedido do "Esqueci minha senha", de uma origem. */
async function pedirNovaSenha(endereco: unknown, ip = novoIp()) {
  const inicio = performance.now()
  const r = await fetch(`${api.endereco}/api/auth/nova-senha`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
    body: JSON.stringify({ email: endereco }),
  })
  const corpo = await r.text()
  const cabecalhos = [...r.headers.entries()].filter(([nome]) => nome !== 'date').sort()
  return { status: r.status, corpo, cabecalhos, ms: performance.now() - inicio }
}

/** Um pedido com Host, X-Forwarded-Host e Origin forjados: o fetch nao deixa trocar o Host. */
function pedirComHostForjado(caminho: string, corpo: unknown, extras: Record<string, string> = {}): Promise<{ status: number; corpo: any }> {
  const alvo = new URL(api.endereco)
  const texto = JSON.stringify(corpo)
  return new Promise((resolver, recusar) => {
    const pedido = pedidoHttp({
      host: alvo.hostname, port: alvo.port, path: `/api${caminho}`, method: 'POST',
      headers: {
        Host: 'malicioso.example', 'X-Forwarded-Host': 'malicioso.example', 'X-Forwarded-Proto': 'http',
        Origin: 'https://malicioso.example', Referer: 'https://malicioso.example/entrar',
        'X-Forwarded-For': novoIp(), 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(texto)),
        ...extras,
      },
    }, (resposta) => {
      let recebido = ''
      resposta.setEncoding('utf8')
      resposta.on('data', (parte: string) => { recebido += parte })
      resposta.on('end', () => resolver({ status: resposta.statusCode ?? 0, corpo: recebido ? JSON.parse(recebido) : undefined }))
    })
    pedido.on('error', recusar)
    pedido.end(texto)
  })
}

const caixaPara = (para: string) => email.caixa.filter((m) => m.para === para)
function tokenDe(m: Mensagem): string {
  const achado = /#\/app\/primeiro-acesso\/([A-Za-z0-9_-]+)/.exec(m.texto)
  if (!achado) throw new Error(`mensagem sem link: ${m.assunto}`)
  return achado[1]
}
const pedidos = (where: Record<string, unknown>) => prisma.registroAuditoria.findMany({
  where: { entidade: 'RecuperacaoDeSenha', ...where }, orderBy: [{ ocorridoEm: 'asc' }, { id: 'asc' }],
})
const ocioso = async () => { await recuperacao.ocioso(); await email.ocioso() }
const comSenhaDefinida = (id: string) => prisma.usuario.update({ where: { id }, data: { ultimoAcessoEm: new Date() } })

beforeAll(async () => {
  urlAnterior = process.env.URL_PUBLICA
  chaveAnterior = process.env.RESEND_API_KEY
  process.env.URL_PUBLICA = URL_PUBLICA
  delete process.env.RESEND_API_KEY

  const banco = await criarBancoMigrado(inject('urlAdministrativa'), 'sinctea_recuperacao')
  apagar = banco.apagar
  prisma = clienteDe(banco.url)
  u.ana = await criarUsuario(prisma, { email: 'ana@teste.example', nome: 'Ana Souza', perfis: ['TERAPEUTA'] })
  u.bruno = await criarUsuario(prisma, { email: 'bruno@teste.example', nome: 'Bruno Lima', perfis: ['TERAPEUTA'] })
  u.coord = await criarUsuario(prisma, { email: 'coord@teste.example', nome: 'Carla Coordenadora', perfis: ['COORDENADOR'] })
  u.admin = await criarUsuario(prisma, { email: 'admin@teste.example', nome: 'Davi Administrador', perfis: ['ADMINISTRADOR'] })
  u.inativa = await criarUsuario(prisma, { email: 'inativa@teste.example', perfis: ['TERAPEUTA'], ativo: false })
  u.novata = await criarUsuario(prisma, { email: 'novata@teste.example', perfis: ['TERAPEUTA'] })
  for (const nome of ['conta3', 'contaip', 'contadia', 'host']) {
    u[nome] = await criarUsuario(prisma, { email: `${nome}@teste.example`, perfis: ['TERAPEUTA'] })
    await comSenhaDefinida(u[nome])
  }
  await comSenhaDefinida(u.inativa)

  api = await subirApi(banco.url)
  ;(api.aplicacao.getHttpAdapter().getInstance() as { set(nome: string, valor: unknown): void }).set('trust proxy', true)
  email = api.aplicacao.get(ServicoEmail)
  recuperacao = api.aplicacao.get(ServicoRecuperacao)
  for (const nome of ['ana', 'bruno', 'coord', 'admin']) c[nome] = await api.entrar(`${nome}@teste.example`)
})

afterAll(async () => {
  await api?.fechar()
  await prisma?.$disconnect()
  await apagar?.()
  if (urlAnterior === undefined) delete process.env.URL_PUBLICA
  else process.env.URL_PUBLICA = urlAnterior
  if (chaveAnterior !== undefined) process.env.RESEND_API_KEY = chaveAnterior
})

describe('"Esqueci minha senha": a mesma resposta, exista a conta ou nao', () => {
  it('o servidor de teste usa a memoria: nada sai daqui', () => {
    expect(email.modo).toBe('MEMORIA')
  })

  it('com conta, sem conta, conta desativada, sem senha definida e e-mail mal escrito: 202, sem corpo, antes de olhar a conta', async () => {
    // O envio fica preso ate o teste soltar: se a resposta esperasse o envio,
    // o pedido da conta que existe nao voltaria.
    let soltar!: () => void
    const preso = new Promise<void>((r) => { soltar = r })
    const enviar = email.enviar.bind(email)
    email.enviar = async (m) => { await preso; return enviar(m) }
    const casos: unknown[] = ['ana@teste.example', ' ANA@Teste.EXAMPLE ', 'ninguem@teste.example', 'inativa@teste.example', 'novata@teste.example', 'nao-e-email', 42]
    const respostas = []
    try {
      for (const caso of casos) respostas.push(await pedirNovaSenha(caso))
      expect(caixaPara('ana@teste.example')).toHaveLength(0)
    } finally {
      soltar()
    }
    await ocioso()
    email.enviar = enviar

    for (const r of respostas) {
      expect(r.status).toBe(202)
      expect(r.corpo).toBe('')
      expect(r.cabecalhos).toEqual(respostas[0].cabecalhos)
      expect(r.ms).toBeLessThan(2_000)
    }
    // Duas vezes a mesma conta, em maiusculas e com espaco: dois links, e o segundo invalida o primeiro.
    expect(caixaPara('ana@teste.example').map((m) => m.tipo)).toEqual(['RECUPERACAO', 'RECUPERACAO'])
    for (const outro of ['ninguem@teste.example', 'inativa@teste.example', 'novata@teste.example']) expect(caixaPara(outro)).toHaveLength(0)
    expect(await prisma.acessoInicial.count({ where: { finalidade: 'RECUPERACAO', usuarioId: { in: [u.inativa, u.novata] } } })).toBe(0)
  })

  it('a trilha: o pedido de conta existente fica com a conta; o de e-mail sem conta, sem o e-mail, so com a origem', async () => {
    const daAna = await pedidos({ idEntidade: u.ana })
    expect(daAna).toHaveLength(2)
    for (const l of daAna) {
      expect(l).toMatchObject({ acao: 'CRIACAO', usuarioId: null, usuarioNome: null, perfil: null, origem: 'SISTEMA', pacienteId: null })
      expect(l.ipOrigem).toMatch(/^10\.23\.0\.\d+$/)
      expect(l.detalhe).toBe('Link de recuperação de senha gerado e enviado por e-mail, válido por 1 hora; os links anteriores ainda não usados deixaram de valer.')
    }
    const semConta = await pedidos({ idEntidade: null })
    expect(semConta).toHaveLength(3)
    for (const l of semConta) {
      expect(l).toMatchObject({ acao: 'ACESSO_NEGADO', usuarioId: null, detalhe: 'Pedido de nova senha para um e-mail sem conta. O e-mail digitado não foi guardado; nada foi enviado.' })
      expect(l.ipOrigem).toMatch(/^10\.23\.0\.\d+$/)
    }
    expect((await pedidos({ idEntidade: u.inativa }))[0]).toMatchObject({ acao: 'ACESSO_NEGADO', detalhe: 'Pedido de nova senha para uma conta desativada. Nada foi enviado.' })
    expect((await pedidos({ idEntidade: u.novata }))[0].detalhe).toContain('ainda não definiu a senha')
    // O e-mail digitado sem conta nao esta em lugar nenhum da trilha.
    const todas = await prisma.registroAuditoria.findMany()
    expect(todas.some((l) => `${l.detalhe} ${l.valorAnterior ?? ''}`.includes('ninguem'))).toBe(false)
  })
})

describe('o link de recuperacao', () => {
  it('vale 1 hora, sem autor; o anterior deixou de valer', async () => {
    const [primeiro, segundo] = caixaPara('ana@teste.example')
    expect((await api.pedir('GET', `/auth/primeiro-acesso/${tokenDe(primeiro)}`)).corpo.situacao).toBe('INEXISTENTE')
    expect(segundo.texto).toContain(`${URL_PUBLICA}/#/app/primeiro-acesso/`)
    const valido = await api.pedir('GET', `/auth/primeiro-acesso/${tokenDe(segundo)}`)
    expect(valido.corpo).toMatchObject({ situacao: 'VALIDO', finalidade: 'RECUPERACAO', nome: 'Ana Souza', email: 'ana@teste.example' })
    const linha = await prisma.acessoInicial.findUniqueOrThrow({ where: { tokenResumo: resumoDoToken(tokenDe(segundo)) } })
    expect(linha.expiraEm.getTime() - linha.criadoEm.getTime()).toBe(60 * 60_000)
    expect(linha.geradoPorId).toBeNull()
  })

  it('usado: troca a senha, derruba todas as sessoes, nao avisa "redefinida pela clinica" e manda a confirmacao', async () => {
    const outraSessao = await api.entrar('ana@teste.example')
    const token = tokenDe(caixaPara('ana@teste.example')[1])
    const r = await api.pedir('POST', `/auth/primeiro-acesso/${token}`, { corpo: { senha: 'a-nova-senha-da-ana' } })
    expect(r.status, JSON.stringify(r.corpo)).toBe(200)
    expect(r.corpo.avisoDeRedefinicao).toBeNull()
    for (const cookie of [c.ana, outraSessao]) expect((await api.pedir('GET', '/auth/sessao', { cookie })).status).toBe(204)

    await email.ocioso()
    const confirmacao = caixaPara('ana@teste.example')[2]
    const { usadoEm } = await prisma.acessoInicial.findUniqueOrThrow({ where: { tokenResumo: resumoDoToken(token) } })
    const [data, hora] = dataEHoraNaInstancia(usadoEm!).split(' ')
    expect(confirmacao).toMatchObject({ tipo: 'CONFIRMACAO', assunto: 'Sua senha do SINCTEA foi alterada' })
    expect(confirmacao.texto).toContain(`Sua senha do SINCTEA foi alterada em ${data} às ${hora.slice(0, 5)} (Manaus). Se não foi você, procure a clínica.`)

    const [alteracao] = await prisma.registroAuditoria.findMany({ where: { entidade: 'Usuario', idEntidade: u.ana, acao: 'ALTERACAO' } })
    expect(alteracao).toMatchObject({ usuarioId: u.ana })
    expect(alteracao.detalhe).toBe('Senha redefinida pelo link de recuperação que a própria pessoa pediu em "Esqueci minha senha"; as sessões abertas foram encerradas.')

    // A senha nova entra; a velha, nao.
    c.ana = await api.entrar('ana@teste.example', 'a-nova-senha-da-ana')
    expect((await api.pedir('POST', '/auth/entrar', { corpo: { email: 'ana@teste.example', senha: SENHA_DE_TESTE } })).status).toBe(401)
  })

  it('uso unico: a segunda vez e recusada, e a tela sabe que era de recuperacao', async () => {
    const token = tokenDe(caixaPara('ana@teste.example')[1])
    const r = await api.pedir('POST', `/auth/primeiro-acesso/${token}`, { corpo: { senha: 'mais-uma-senha-longa' } })
    expect(r.status).toBe(409)
    expect(r.corpo.mensagem).toBe(LINK_DE_RECUPERACAO_QUE_NAO_VALE)
    expect((await api.pedir('GET', `/auth/primeiro-acesso/${token}`)).corpo)
      .toEqual({ situacao: 'USADO', nome: null, email: null, expiraEm: null, finalidade: 'RECUPERACAO' })
  })

  it('vencido: "Este link nao vale mais"', async () => {
    const { token } = await api.aplicacao.get(ServicoAutenticacao).gerarAcessoInicial(u.bruno, { finalidade: 'RECUPERACAO' })
    await prisma.acessoInicial.update({ where: { tokenResumo: resumoDoToken(token) }, data: { expiraEm: new Date(Date.now() - 1) } })
    expect((await api.pedir('GET', `/auth/primeiro-acesso/${token}`)).corpo).toMatchObject({ situacao: 'EXPIRADO', finalidade: 'RECUPERACAO' })
    const r = await api.pedir('POST', `/auth/primeiro-acesso/${token}`, { corpo: { senha: 'senha-que-nao-entra' } })
    expect(r.status).toBe(409)
    expect(r.corpo.mensagem).toBe(LINK_DE_RECUPERACAO_QUE_NAO_VALE)
  })
})

describe('os limites, todos com a mesma resposta', () => {
  it('por conta: 3 pedidos por hora; o quarto nao manda nada, e uma hora depois volta', async () => {
    for (let i = 0; i < 4; i++) expect((await pedirNovaSenha('conta3@teste.example')).status).toBe(202)
    await ocioso()
    expect(caixaPara('conta3@teste.example')).toHaveLength(3)
    const linhas = await pedidos({ idEntidade: u.conta3 })
    expect(linhas.map((l) => l.acao)).toEqual(['CRIACAO', 'CRIACAO', 'CRIACAO', 'ACESSO_NEGADO'])
    expect(linhas[3].detalhe).toBe('Pedido de nova senha recusado: já são 3 pedidos para esta conta na última hora. Nada foi enviado.')

    recuperacao.agora = () => new Date(Date.now() + 61 * 60_000)
    try {
      expect((await pedirNovaSenha('conta3@teste.example')).status).toBe(202)
      await ocioso()
    } finally {
      recuperacao.agora = () => new Date()
    }
    expect(caixaPara('conta3@teste.example')).toHaveLength(4)
  })

  it('por origem: 10 pedidos por hora, com conta ou sem; o decimo primeiro nao manda nada, nem para conta valida', async () => {
    const ip = '10.99.0.1'
    for (let i = 0; i < 10; i++) expect((await pedirNovaSenha(`sem-conta-${i}@teste.example`, ip)).status).toBe(202)
    expect((await pedirNovaSenha('contaip@teste.example', ip)).status).toBe(202)
    await ocioso()
    expect(caixaPara('contaip@teste.example')).toHaveLength(0)
    const daOrigem = await pedidos({ ipOrigem: ip })
    expect(daOrigem).toHaveLength(11)
    // A recusa pela origem vem antes de procurar a conta: a linha nao diz se o e-mail tem dono.
    expect(daOrigem[10]).toMatchObject({
      acao: 'ACESSO_NEGADO', idEntidade: null,
      detalhe: 'Pedido de nova senha recusado: já são 10 pedidos desta origem na última hora. Nada foi enviado.',
    })
    // De outra origem, a mesma conta recebe.
    expect((await pedirNovaSenha('contaip@teste.example', '10.99.0.2')).status).toBe(202)
    await ocioso()
    expect(caixaPara('contaip@teste.example')).toHaveLength(1)
  })

  it('o teto da clinica: 50 links de recuperacao em 24 horas, abaixo da cota gratis do Resend', async () => {
    // Daqui a tres dias, 50 links gerados, um por minuto: o relogio do servico vai ate la.
    const la = Date.now() + 3 * 86_400_000
    await prisma.registroAuditoria.createMany({ data: Array.from({ length: 50 }, (_, i) => ({
      ocorridoEm: new Date(la - i * 60_000), acao: 'CRIACAO' as const, entidade: 'RecuperacaoDeSenha',
      origem: 'SISTEMA' as const, detalhe: 'Link simulado pelo teste do teto da clínica.',
    })) })
    try {
      recuperacao.agora = () => new Date(la + 60_000)
      expect((await pedirNovaSenha('contadia@teste.example')).status).toBe(202)
      await ocioso()
      expect(caixaPara('contadia@teste.example')).toHaveLength(0)
      expect((await pedidos({ idEntidade: u.contadia })).at(-1)).toMatchObject({
        acao: 'ACESSO_NEGADO',
        detalhe: 'Pedido de nova senha recusado: a clínica chegou ao teto de 50 links de recuperação em 24 horas. Nada foi enviado.',
      })
      // 24 horas depois dos primeiros, sobram menos de 50 na janela: volta a enviar.
      recuperacao.agora = () => new Date(la + 86_400_000 - 30 * 60_000)
      expect((await pedirNovaSenha('contadia@teste.example')).status).toBe(202)
      await ocioso()
      expect(caixaPara('contadia@teste.example')).toHaveLength(1)
    } finally {
      recuperacao.agora = () => new Date()
    }
  })

  it('o teto conta os links gerados, e nao os pedidos recusados: 60 pedidos sem conta no dia nao impedem o envio', async () => {
    // Daqui a seis dias, longe dos 50 do teste anterior: 60 recusas, uma por minuto.
    const la = Date.now() + 6 * 86_400_000
    await prisma.registroAuditoria.createMany({ data: Array.from({ length: 60 }, (_, i) => ({
      ocorridoEm: new Date(la - i * 60_000), acao: 'ACESSO_NEGADO' as const, entidade: 'RecuperacaoDeSenha',
      origem: 'SISTEMA' as const, detalhe: 'Recusa simulada pelo teste do teto da clínica.',
    })) })
    try {
      recuperacao.agora = () => new Date(la + 60_000)
      expect((await pedirNovaSenha('contadia@teste.example')).status).toBe(202)
      await ocioso()
    } finally {
      recuperacao.agora = () => new Date()
    }
    expect(caixaPara('contadia@teste.example')).toHaveLength(2)
    expect((await pedidos({ idEntidade: u.contadia })).at(-1)).toMatchObject({ acao: 'CRIACAO' })
  })
})

describe('o link do e-mail sai de URL_PUBLICA, nunca do pedido', () => {
  it('com Host, X-Forwarded-Host e Origin forjados, no "Esqueci minha senha"', async () => {
    expect((await pedirComHostForjado('/auth/nova-senha', { email: 'host@teste.example' })).status).toBe(202)
    await ocioso()
    const [m] = caixaPara('host@teste.example')
    expect(m.texto).toContain(`${URL_PUBLICA}/#/app/primeiro-acesso/${tokenDe(m)}`)
    expect(`${m.texto}${m.html}`).not.toContain('malicioso')
  })

  it('e no link que a administracao gera', async () => {
    const r = await pedirComHostForjado('/usuarios', { nome: 'Hélio Host', email: 'helio@teste.example', perfis: ['COORDENADOR'] }, {
      Cookie: c.admin, 'X-Sinctea-Aba': String(abaDoCookie(c.admin)),
    })
    expect(r.status, JSON.stringify(r.corpo)).toBe(201)
    const [m] = caixaPara('helio@teste.example')
    expect(m.texto).toContain(`${URL_PUBLICA}/#/app/primeiro-acesso/${r.corpo.primeiroAcesso.token}`)
    expect(`${m.texto}${m.html}`).not.toContain('malicioso')
  })
})

describe('os links que a clinica gera, agora tambem por e-mail', () => {
  it('equipe (tela 14): primeiro acesso, novo link e nova senha com motivo; a confirmacao so depois da nova senha', async () => {
    const criada = await api.pedir('POST', '/usuarios', {
      cookie: c.admin, corpo: { nome: 'Fábio Novo', email: 'fabio@teste.example', perfis: ['TERAPEUTA'], especialidade: 'Psicologia' },
    })
    expect(criada.status, JSON.stringify(criada.corpo)).toBe(201)
    const id = criada.corpo.usuario.id
    expect(criada.corpo.primeiroAcesso.envio).toEqual({ situacao: 'ENVIADO', para: 'fabio@teste.example' })
    const [m1] = caixaPara('fabio@teste.example')
    expect(m1).toMatchObject({ tipo: 'PRIMEIRO_ACESSO', assunto: 'Seu acesso ao SINCTEA' })
    expect(m1.texto).toContain('Olá, Fábio Novo.')
    expect(tokenDe(m1)).toBe(criada.corpo.primeiroAcesso.token)
    const [criacao] = await prisma.registroAuditoria.findMany({ where: { entidade: 'Usuario', idEntidade: id, acao: 'CRIACAO' } })
    expect(criacao.detalhe).toBe('Conta criada para fabio@teste.example (TERAPEUTA). Link de primeiro acesso gerado. Enviado por e-mail.')

    const novo = await api.pedir('POST', `/usuarios/${id}/acesso-inicial`, { cookie: c.admin })
    expect(novo.corpo.envio).toEqual({ situacao: 'ENVIADO', para: 'fabio@teste.example' })
    expect(tokenDe(caixaPara('fabio@teste.example')[1])).toBe(novo.corpo.token)
    expect((await api.pedir('POST', `/auth/primeiro-acesso/${novo.corpo.token}`, { corpo: { senha: 'senha-do-fabio-1' } })).status).toBe(200)
    await email.ocioso()
    // O primeiro acesso nao tinha senha a trocar: nao ha confirmacao.
    expect(caixaPara('fabio@teste.example')).toHaveLength(2)

    const motivo = 'Esqueceu a senha e pediu na recepção.'
    const nova = await api.pedir('POST', `/usuarios/${id}/nova-senha`, { cookie: c.admin, corpo: { motivo } })
    expect(nova.corpo.envio).toEqual({ situacao: 'ENVIADO', para: 'fabio@teste.example' })
    const m3 = caixaPara('fabio@teste.example')[2]
    expect(m3).toMatchObject({ tipo: 'NOVA_SENHA', assunto: 'Link para nova senha do SINCTEA' })
    expect(`${m3.texto}${m3.html}`).not.toContain(motivo)
    expect(`${m3.texto}${m3.html}`).not.toContain('Davi')
    const [alteracao] = await prisma.registroAuditoria.findMany({
      where: { entidade: 'Usuario', idEntidade: id, acao: 'ALTERACAO', usuarioId: u.admin, detalhe: { contains: 'nova senha' } },
    })
    expect(alteracao.detalhe).toBe(`Link para nova senha gerado pela administração; o anterior deixou de valer. Motivo: ${motivo} Enviado por e-mail.`)

    expect((await api.pedir('POST', `/auth/primeiro-acesso/${nova.corpo.token}`, { corpo: { senha: 'senha-do-fabio-2' } })).status).toBe(200)
    await email.ocioso()
    expect(caixaPara('fabio@teste.example').map((m) => m.tipo)).toEqual(['PRIMEIRO_ACESSO', 'PRIMEIRO_ACESSO', 'NOVA_SENHA', 'CONFIRMACAO'])
  })

  it('responsavel (tela 5): nenhum e-mail leva o nome, a data de nascimento ou o id do paciente', async () => {
    const paciente = await api.pedir('POST', '/pacientes', { cookie: c.bruno, corpo: { ...PACIENTE, profissionalResponsavelId: u.bruno } })
    expect(paciente.status, JSON.stringify(paciente.corpo)).toBe(201)
    const pacienteId = paciente.corpo.id
    const mae = await api.pedir('POST', `/pacientes/${pacienteId}/responsaveis`, {
      cookie: c.bruno,
      corpo: { nome: 'Patrícia Ribeiro', email: 'patricia@teste.example', telefone: '(92) 90000-0001', parentesco: 'Mãe', responsavelLegal: true },
    })
    expect(mae.status, JSON.stringify(mae.corpo)).toBe(201)
    expect(mae.corpo.primeiroAcesso.envio).toEqual({ situacao: 'ENVIADO', para: 'patricia@teste.example' })
    const responsavelId = mae.corpo.responsavel.responsavelId
    const vinculo = await prisma.registroAuditoria.findFirstOrThrow({ where: { entidade: 'VinculoFamiliar', pacienteId, acao: 'CRIACAO' } })
    expect(vinculo.detalhe).toContain('Link de primeiro acesso gerado. Enviado por e-mail.')

    const novo = await api.pedir('POST', `/pacientes/${pacienteId}/responsaveis/${responsavelId}/acesso-inicial`, { cookie: c.bruno })
    expect(novo.corpo.envio.situacao).toBe('ENVIADO')
    expect((await api.pedir('POST', `/auth/primeiro-acesso/${novo.corpo.token}`, { corpo: { senha: 'senha-da-patricia-1' } })).status).toBe(200)

    const nova = await api.pedir('POST', `/pacientes/${pacienteId}/responsaveis/${responsavelId}/nova-senha`, {
      cookie: c.coord, corpo: { motivo: 'Perdeu o celular onde guardava a senha.' },
    })
    expect(nova.corpo.envio).toEqual({ situacao: 'ENVIADO', para: 'patricia@teste.example' })
    expect((await api.pedir('POST', `/auth/primeiro-acesso/${nova.corpo.token}`, { corpo: { senha: 'senha-da-patricia-2' } })).status).toBe(200)
    await email.ocioso()

    expect((await pedirNovaSenha('patricia@teste.example')).status).toBe(202)
    await ocioso()
    const recuperacaoDela = caixaPara('patricia@teste.example').at(-1)!
    expect((await api.pedir('POST', `/auth/primeiro-acesso/${tokenDe(recuperacaoDela)}`, { corpo: { senha: 'senha-da-patricia-3' } })).status).toBe(200)
    await email.ocioso()

    const dela = caixaPara('patricia@teste.example')
    expect(dela.map((m) => m.tipo)).toEqual(['PRIMEIRO_ACESSO', 'PRIMEIRO_ACESSO', 'NOVA_SENHA', 'CONFIRMACAO', 'RECUPERACAO', 'CONFIRMACAO'])
    for (const m of dela) {
      const tudo = `${m.assunto}\n${m.texto}\n${m.html}`
      expect(tudo).toContain('Patrícia Ribeiro')
      for (const proibido of ['Joaquim', 'Ventania', '2019', '12/03', pacienteId, 'Bruno', 'Carla', 'Perdeu o celular', 'Mãe', 'paciente']) {
        expect(tudo, `${m.tipo}: ${proibido}`).not.toContain(proibido)
      }
    }
  })
})
