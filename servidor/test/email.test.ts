import 'reflect-metadata'
import { inspect } from 'node:util'
import { Logger } from '@nestjs/common'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SE_NAO_ESPERAVA, linkDeDefinirSenha, mensagemDeConfirmacao, mensagemDeNovaSenha, mensagemDePrimeiroAcesso,
  mensagemDeRecuperacao, type Mensagem,
} from '../src/email/mensagens.js'
import { envioNaTrilha } from '../src/email/na-trilha.js'
import { ENDERECO_DO_RESEND, ServicoEmail } from '../src/email/servico-email.js'

/**
 * Item 23: o conteudo dos e-mails e os modos do envio, sem banco e sem rede.
 * Nenhum teste fala com o Resend: o fetch e trocado, e a chave e de mentira.
 */

const CHAVE = 're_chave_de_mentira_do_teste_0123456789'
const URL = 'https://sinctea.teste.example'
const LINK = `${URL}/#/app/primeiro-acesso/um-token_de-teste`
/** 14:00 em UTC sao 10:00 em Manaus. */
const EXPIRA = new Date('2026-11-28T14:00:00.000Z')

const conteudo = (m: Mensagem) => `${m.assunto}\n${m.texto}\n${m.html}`

describe('o conteudo dos e-mails', () => {
  it('o link da tela 23 sai de URL_PUBLICA, com a rota de hash', () => {
    expect(linkDeDefinirSenha(`${URL}/`, 'abc_-9')).toBe(`${URL}/#/app/primeiro-acesso/abc_-9`)
    expect(linkDeDefinirSenha(`${URL}//`, 'abc')).toBe(`${URL}/#/app/primeiro-acesso/abc`)
  })

  it('primeiro acesso: o nome, para que serve, o link, 72 horas e o "ignore"', () => {
    const m = mensagemDePrimeiroAcesso({ para: 'ana@teste.example', nome: 'Ana Souza', link: LINK, expiraEm: EXPIRA })
    expect(m).toMatchObject({ tipo: 'PRIMEIRO_ACESSO', para: 'ana@teste.example', assunto: 'Seu acesso ao SINCTEA' })
    expect(m.texto).toBe([
      'Olá, Ana Souza.',
      'A clínica cadastrou você no SINCTEA. Para entrar pela primeira vez, defina a sua senha pelo link abaixo.',
      LINK,
      'O link vale por 72 horas, até 28/11/2026 às 10:00 (Manaus), e funciona uma vez só.',
      SE_NAO_ESPERAVA,
    ].join('\n\n') + '\n')
    expect(SE_NAO_ESPERAVA).toBe('Se você não esperava este e-mail, ignore.')
    expect(m.html).toContain(`<a href="${LINK}"`)
    expect(m.html).toContain('lang="pt-BR"')
  })

  it('nova senha pela clinica: sem o motivo e sem quem gerou', () => {
    const m = mensagemDeNovaSenha({ para: 'p@teste.example', nome: 'Patrícia', link: LINK, expiraEm: EXPIRA })
    expect(m).toMatchObject({ tipo: 'NOVA_SENHA', assunto: 'Link para nova senha do SINCTEA' })
    expect(m.texto).toContain('A clínica gerou um link para você definir uma nova senha no SINCTEA.')
    expect(m.texto).toContain('O link vale por 72 horas, até 28/11/2026 às 10:00 (Manaus), e funciona uma vez só.')
    expect(m.texto).toContain(SE_NAO_ESPERAVA)
  })

  it('recuperacao: vale 1 hora', () => {
    const m = mensagemDeRecuperacao({ para: 'p@teste.example', nome: 'Patrícia', link: LINK, expiraEm: new Date('2026-11-25T15:00:00.000Z') })
    expect(m).toMatchObject({ tipo: 'RECUPERACAO', assunto: 'Nova senha do SINCTEA' })
    expect(m.texto).toContain('Recebemos um pedido para definir uma nova senha da sua conta no SINCTEA.')
    expect(m.texto).toContain('O link vale por 1 hora, até 25/11/2026 às 11:00 (Manaus), e funciona uma vez só.')
    expect(m.texto).toContain(LINK)
    expect(m.texto).toContain(SE_NAO_ESPERAVA)
  })

  it('confirmacao: a data e a hora de Manaus, e procurar a clinica em vez de ignorar', () => {
    const m = mensagemDeConfirmacao({ para: 'p@teste.example', nome: 'Patrícia', alteradaEm: new Date('2026-11-25T14:05:30.000Z') })
    expect(m).toMatchObject({ tipo: 'CONFIRMACAO', assunto: 'Sua senha do SINCTEA foi alterada' })
    expect(m.texto).toBe('Olá, Patrícia.\n\nSua senha do SINCTEA foi alterada em 25/11/2026 às 10:05 (Manaus). Se não foi você, procure a clínica.\n')
    expect(m.html).not.toContain('<a ')
    expect(conteudo(m)).not.toContain('ignore')
  })

  it('o HTML escapa o nome: o que a pessoa digitou nao vira marcacao', () => {
    const m = mensagemDePrimeiroAcesso({ para: 'x@teste.example', nome: '<b>Ana</b> & "Cia"', link: LINK, expiraEm: EXPIRA })
    expect(m.html).toContain('Olá, &lt;b&gt;Ana&lt;/b&gt; &amp; &quot;Cia&quot;.')
    expect(m.html).not.toContain('<b>Ana')
  })

  it('o nome do sistema vai so na sigla: por extenso, diria o diagnostico de alguem da familia', () => {
    const todas = [
      mensagemDePrimeiroAcesso({ para: 'x@teste.example', nome: 'Ana', link: LINK, expiraEm: EXPIRA }),
      mensagemDeNovaSenha({ para: 'x@teste.example', nome: 'Ana', link: LINK, expiraEm: EXPIRA }),
      mensagemDeRecuperacao({ para: 'x@teste.example', nome: 'Ana', link: LINK, expiraEm: EXPIRA }),
      mensagemDeConfirmacao({ para: 'x@teste.example', nome: 'Ana', alteradaEm: EXPIRA }),
    ]
    for (const m of todas) {
      for (const proibido of ['Transtorno', 'Espectro', 'utis', 'Terapêutica', 'paciente', 'criança']) {
        expect(conteudo(m), `${m.tipo}: ${proibido}`).not.toContain(proibido)
      }
    }
  })

  it('a trilha diz se o link foi por e-mail, sem o link', () => {
    expect(envioNaTrilha({ situacao: 'ENVIADO', para: 'x@teste.example' })).toBe(' Enviado por e-mail.')
    expect(envioNaTrilha({ situacao: 'FALHOU', para: 'x@teste.example' }))
      .toBe(' O e-mail não foi enviado (falha no serviço de e-mail); o link ficou na tela, para copiar.')
    expect(envioNaTrilha({ situacao: 'DESLIGADO', para: 'x@teste.example' })).toBe(' Sem envio de e-mail (desligado); o link ficou na tela, para copiar.')
    expect(envioNaTrilha(null)).toBe('')
  })
})

// ------------------------------------------------------------ Os modos

const VARIAVEIS = ['RESEND_API_KEY', 'EMAIL_REMETENTE', 'URL_PUBLICA', 'NODE_ENV'] as const
let guardadas: Record<string, string | undefined>
let linhasDoLog: string[]
let fetchOriginal: typeof fetch

/** Sobe o servico com estas variaveis, e so com elas. */
function servicoCom(variaveis: Partial<Record<(typeof VARIAVEIS)[number], string>>): ServicoEmail {
  for (const nome of VARIAVEIS) delete process.env[nome]
  Object.assign(process.env, variaveis)
  return new ServicoEmail()
}

beforeEach(() => {
  guardadas = Object.fromEntries(VARIAVEIS.map((n) => [n, process.env[n]]))
  linhasDoLog = []
  // Tudo o que o Logger do Nest e o console escreveriam fica aqui, e nada sai.
  for (const nivel of ['log', 'warn', 'error', 'debug', 'verbose', 'fatal'] as const) {
    vi.spyOn(Logger.prototype, nivel).mockImplementation((...partes: unknown[]) => { linhasDoLog.push(partes.map(String).join(' ')) })
  }
  for (const nivel of ['log', 'warn', 'error', 'info', 'debug'] as const) {
    vi.spyOn(console, nivel).mockImplementation((...partes: unknown[]) => { linhasDoLog.push(partes.map(String).join(' ')) })
  }
  fetchOriginal = globalThis.fetch
})

afterEach(() => {
  for (const nome of VARIAVEIS) {
    if (guardadas[nome] === undefined) delete process.env[nome]
    else process.env[nome] = guardadas[nome]
  }
  globalThis.fetch = fetchOriginal
  vi.restoreAllMocks()
})

const MENSAGEM = mensagemDeRecuperacao({ para: 'destino@teste.example', nome: 'Ana', link: LINK, expiraEm: EXPIRA })

describe('os modos do envio', () => {
  it('sem a chave, fora de producao: a memoria guarda, e nada vai para a rede', async () => {
    const espiao = vi.fn()
    globalThis.fetch = espiao as unknown as typeof fetch
    const servico = servicoCom({ URL_PUBLICA: URL })
    expect(servico.modo).toBe('MEMORIA')
    expect(servico.linkPara('t')).toBe(`${URL}/#/app/primeiro-acesso/t`)
    expect(await servico.enviar(MENSAGEM)).toBe('ENVIADO')
    expect(servico.caixa).toEqual([MENSAGEM])
    expect(espiao).not.toHaveBeenCalled()
  })

  it('sem a chave em producao: sobe desligado, avisa no log, e o link continua na tela', async () => {
    const servico = servicoCom({ NODE_ENV: 'production', URL_PUBLICA: URL })
    expect(servico.modo).toBe('DESLIGADO')
    expect(servico.linkPara('t')).toBeNull()
    expect(await servico.enviar(MENSAGEM)).toBe('DESLIGADO')
    expect(linhasDoLog.join('\n')).toContain('Envio de e-mail desligado: RESEND_API_KEY não está definida.')
  })

  it('com a chave e sem remetente ou endereco valido: desligado, e o log da o nome da variavel, nunca o valor', () => {
    expect(servicoCom({ RESEND_API_KEY: CHAVE, URL_PUBLICA: URL }).modo).toBe('DESLIGADO')
    expect(servicoCom({ RESEND_API_KEY: CHAVE, EMAIL_REMETENTE: 'SINCTEA <n@teste.example>', URL_PUBLICA: 'javascript:alert(1)' }).modo).toBe('DESLIGADO')
    expect(servicoCom({ RESEND_API_KEY: CHAVE, EMAIL_REMETENTE: 'SINCTEA <n@teste.example>', URL_PUBLICA: `${URL}/?de=fora` }).modo).toBe('DESLIGADO')
    const log = linhasDoLog.join('\n')
    expect(log).toContain('EMAIL_REMETENTE ausente ou inválida')
    expect(log).toContain('URL_PUBLICA ausente ou inválida')
    expect(log).not.toContain(CHAVE)
    expect(log).not.toContain('javascript')
  })

  it('com as tres, o Resend; e a chave nao e campo do servico: nem o JSON nem o inspect a mostram', () => {
    const servico = servicoCom({ RESEND_API_KEY: CHAVE, EMAIL_REMETENTE: 'SINCTEA <n@teste.example>', URL_PUBLICA: URL })
    expect(servico.modo).toBe('RESEND')
    expect(JSON.stringify(servico)).not.toContain(CHAVE)
    expect(inspect(servico, { depth: 10, showHidden: true, getters: true })).not.toContain(CHAVE)
    expect(linhasDoLog.join('\n')).not.toContain(CHAVE)
  })
})

describe('o transporte do Resend', () => {
  let chamadas: { url: string; init: RequestInit }[]
  const comResend = (responder: (init: RequestInit) => Promise<Response>) => {
    chamadas = []
    globalThis.fetch = (async (url: string | URL | Request, init: RequestInit = {}) => {
      chamadas.push({ url: String(url), init })
      return responder(init)
    }) as typeof fetch
    return servicoCom({ RESEND_API_KEY: CHAVE, EMAIL_REMETENTE: 'SINCTEA <nao-responda@teste.example>', URL_PUBLICA: URL })
  }

  it('aceito: um POST so, com a chave no cabecalho e a mensagem no corpo', async () => {
    const servico = comResend(async () => new Response('{"id":"x"}', { status: 200 }))
    expect(await servico.enviar(MENSAGEM)).toBe('ENVIADO')
    expect(chamadas).toHaveLength(1)
    const [{ url, init }] = chamadas
    expect(url).toBe(ENDERECO_DO_RESEND)
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ Authorization: `Bearer ${CHAVE}`, 'Content-Type': 'application/json' })
    expect(JSON.parse(String(init.body))).toEqual({
      from: 'SINCTEA <nao-responda@teste.example>', to: ['destino@teste.example'],
      subject: MENSAGEM.assunto, text: MENSAGEM.texto, html: MENSAGEM.html,
    })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('5xx: falhou, sem lancar; o log diz o status, e nem a resposta que ecoa a chave, nem o destinatario', async () => {
    const servico = comResend(async () => new Response(`{"erro":"chave ${CHAVE} recusada"}`, { status: 503 }))
    expect(await servico.enviar(MENSAGEM)).toBe('FALHOU')
    const log = linhasDoLog.join('\n')
    expect(log).toContain('HTTP 503')
    expect(log).not.toContain(CHAVE)
    expect(log).not.toContain('destino@teste.example')
    expect(log).not.toContain(LINK)
  })

  it('4xx: falhou, sem lancar', async () => {
    const servico = comResend(async () => new Response('{}', { status: 422 }))
    expect(await servico.enviar(MENSAGEM)).toBe('FALHOU')
    expect(linhasDoLog.join('\n')).toContain('HTTP 422')
  })

  it('tempo esgotado: o pedido e cortado, e falhou', async () => {
    const servico = comResend((init) => new Promise((_resolver, recusar) => {
      init.signal!.addEventListener('abort', () => recusar(init.signal!.reason))
    }))
    servico.tempoLimiteMs = 50
    const inicio = Date.now()
    expect(await servico.enviar(MENSAGEM)).toBe('FALHOU')
    expect(Date.now() - inicio).toBeLessThan(5_000)
    expect(linhasDoLog.join('\n')).toContain('não respondeu')
  })

  it('o limite de verdade e de 10 s', () => {
    expect(comResend(async () => new Response('{}')).tempoLimiteMs).toBe(10_000)
  })

  it('a rede fora: falhou, e a mensagem do erro, que poderia ter a chave, nao vai para o log', async () => {
    const servico = comResend(async () => { throw new TypeError(`fetch failed: Bearer ${CHAVE}`) })
    expect(await servico.enviar(MENSAGEM)).toBe('FALHOU')
    const log = linhasDoLog.join('\n')
    expect(log).toContain('não foi alcançado')
    expect(log).not.toContain(CHAVE)
  })
})
