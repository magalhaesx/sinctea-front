import { dataEHoraNaInstancia } from '@sinctea/compartilhado/dominio/datas'

/**
 * Os e-mails do sistema (item 23), em portugues, em texto e em HTML simples.
 *
 * O e-mail passa por um servico fora do Brasil. Por isso leva so o nome da
 * pessoa, para que serve o link, o link, a validade e o "ignore" — nenhum
 * dado de paciente, nem o nome da crianca, e o nome do sistema vai so na
 * sigla: por extenso, ele diria o diagnostico de alguem da familia. Tambem nao
 * vai o motivo nem quem gerou o link da clinica: o motivo fica na trilha.
 *
 * Funcoes puras, sem Nest: o teste confere o conteudo sem subir o servidor.
 */

export type TipoDeMensagem = 'PRIMEIRO_ACESSO' | 'NOVA_SENHA' | 'RECUPERACAO' | 'CONFIRMACAO'

export interface Mensagem {
  tipo: TipoDeMensagem
  para: string
  assunto: string
  texto: string
  html: string
}

export const SE_NAO_ESPERAVA = 'Se você não esperava este e-mail, ignore.'

/** Nome legivel do tipo, para o log, que nunca leva o destinatario. */
export const NOME_DO_TIPO: Record<TipoDeMensagem, string> = {
  PRIMEIRO_ACESSO: 'link de primeiro acesso',
  NOVA_SENHA: 'link de nova senha',
  RECUPERACAO: 'link de recuperação de senha',
  CONFIRMACAO: 'confirmação de senha alterada',
}

/**
 * O link da tela 23, sempre a partir de URL_PUBLICA, e nunca do Host ou da
 * origem do pedido, que quem pede pode forjar. O app usa rotas de hash.
 */
export function linkDeDefinirSenha(urlPublica: string, token: string): string {
  return `${urlPublica.replace(/\/+$/, '')}/#/app/primeiro-acesso/${encodeURIComponent(token)}`
}

/** "25/11/2026" e "14:05", no relogio de Manaus. */
function dataEHora(instante: Date): { data: string; hora: string } {
  const [data, hora] = dataEHoraNaInstancia(instante).split(' ')
  return { data, hora: hora.slice(0, 5) }
}

function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

interface Corpo {
  nome: string
  /** Os paragrafos antes do link. */
  antes: string[]
  link?: { endereco: string; rotulo: string }
  /** Os paragrafos depois do link. */
  depois: string[]
}

function montar(tipo: TipoDeMensagem, para: string, assunto: string, corpo: Corpo): Mensagem {
  const saudacao = `Olá, ${corpo.nome}.`
  const texto = [
    saudacao,
    ...corpo.antes,
    ...(corpo.link ? [corpo.link.endereco] : []),
    ...corpo.depois,
  ].join('\n\n') + '\n'
  const p = (t: string) => `<p style="margin:0 0 16px">${escapar(t)}</p>`
  const html = [
    '<!doctype html>',
    '<html lang="pt-BR"><head><meta charset="utf-8"></head>',
    '<body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#1a1a1a;background:#ffffff">',
    p(saudacao),
    ...corpo.antes.map(p),
    ...(corpo.link ? [
      `<p style="margin:0 0 8px"><a href="${escapar(corpo.link.endereco)}" style="color:#0b5cad;font-weight:bold">${escapar(corpo.link.rotulo)}</a></p>`,
      `<p style="margin:0 0 16px;font-size:14px;color:#444444;word-break:break-all">${escapar(corpo.link.endereco)}</p>`,
    ] : []),
    ...corpo.depois.map(p),
    '</body></html>',
  ].join('\n')
  return { tipo, para, assunto, texto, html }
}

export interface DadosDoLink {
  para: string
  nome: string
  link: string
  expiraEm: Date
}

function validadeDoLink(horas: string, expiraEm: Date): string {
  const { data, hora } = dataEHora(expiraEm)
  return `O link vale por ${horas}, até ${data} às ${hora} (Manaus), e funciona uma vez só.`
}

/** Primeiro acesso, da equipe (tela 14) e do responsavel (tela 5). */
export function mensagemDePrimeiroAcesso(d: DadosDoLink): Mensagem {
  return montar('PRIMEIRO_ACESSO', d.para, 'Seu acesso ao SINCTEA', {
    nome: d.nome,
    antes: ['A clínica cadastrou você no SINCTEA. Para entrar pela primeira vez, defina a sua senha pelo link abaixo.'],
    link: { endereco: d.link, rotulo: 'Definir minha senha' },
    depois: [validadeDoLink('72 horas', d.expiraEm), SE_NAO_ESPERAVA],
  })
}

/** O link para nova senha que a coordenacao ou a administracao gera, com motivo (itens 8 e 13). */
export function mensagemDeNovaSenha(d: DadosDoLink): Mensagem {
  return montar('NOVA_SENHA', d.para, 'Link para nova senha do SINCTEA', {
    nome: d.nome,
    antes: ['A clínica gerou um link para você definir uma nova senha no SINCTEA.'],
    link: { endereco: d.link, rotulo: 'Definir nova senha' },
    depois: [validadeDoLink('72 horas', d.expiraEm), SE_NAO_ESPERAVA],
  })
}

/** "Esqueci minha senha" (item 23): o link que a propria pessoa pediu. */
export function mensagemDeRecuperacao(d: DadosDoLink): Mensagem {
  return montar('RECUPERACAO', d.para, 'Nova senha do SINCTEA', {
    nome: d.nome,
    antes: ['Recebemos um pedido para definir uma nova senha da sua conta no SINCTEA.'],
    link: { endereco: d.link, rotulo: 'Definir nova senha' },
    depois: [validadeDoLink('1 hora', d.expiraEm), SE_NAO_ESPERAVA],
  })
}

/**
 * Depois que a senha muda por um link de nova senha ou de recuperacao. Aqui o
 * "ignore" nao serve: quem nao trocou a senha precisa procurar a clinica.
 */
export function mensagemDeConfirmacao(d: { para: string; nome: string; alteradaEm: Date }): Mensagem {
  const { data, hora } = dataEHora(d.alteradaEm)
  return montar('CONFIRMACAO', d.para, 'Sua senha do SINCTEA foi alterada', {
    nome: d.nome,
    antes: [`Sua senha do SINCTEA foi alterada em ${data} às ${hora} (Manaus). Se não foi você, procure a clínica.`],
    depois: [],
  })
}
