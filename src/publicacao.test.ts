import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * A versao publicada (docs/07, secao 0, item 5): so a API, o mock fora do
 * pacote, as telas fora do caminho principal fora das rotas, e sem a entrada
 * de demonstracao. Confere-se o proprio build de producao, como o Dockerfile o
 * faz — e nao o codigo-fonte, porque o que vai ao ar e o pacote.
 *
 * O build roda num processo a parte, com NODE_ENV=production e sem
 * VITE_API_URL, numa pasta temporaria.
 */

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
let pasta: string
let pacote: string
let estilos: string

beforeAll(() => {
  pasta = mkdtempSync(join(tmpdir(), 'sinctea-publicacao-'))
  const ambiente: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'production' }
  delete ambiente.VITE_API_URL
  const r = spawnSync(process.execPath, [
    join(RAIZ, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--outDir', pasta, '--emptyOutDir', '--logLevel', 'error',
  ], { cwd: RAIZ, env: ambiente, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`vite build falhou:\n${r.stdout}\n${r.stderr}`)
  const assets = join(pasta, 'assets')
  pacote = readdirSync(assets).filter((a) => a.endsWith('.js')).map((a) => readFileSync(join(assets, a), 'utf8')).join('\n')
  estilos = readdirSync(assets).filter((a) => a.endsWith('.css')).map((a) => readFileSync(join(assets, a), 'utf8')).join('\n')
}, 180_000)

afterAll(() => { if (pasta) rmSync(pasta, { recursive: true, force: true }) })

describe('a versao publicada', () => {
  it('fala com a API do proprio endereco, em /api', () => {
    expect(pacote).toContain('"/api"')
    expect(pacote).toContain('/auth/entrar')
  })

  it('nao leva o mock: nem a senha de demonstracao, nem os personagens da semente', () => {
    for (const doMock of ['demonstracao', 'Miguel', 'Patrícia']) {
      expect(pacote, doMock).not.toContain(doMock)
    }
  })

  it('nao leva a entrada de demonstracao nem a vitrine de estados', () => {
    expect(pacote).not.toContain('Entrar para demonstra')
    expect(pacote).not.toContain('Vitrine de estados')
  })

  it('nao leva as telas fora do caminho principal', () => {
    // Um texto proprio de cada tela que so existe com o mock: a agenda.
    for (const tela of ['Agenda do dia', 'Voltar para hoje']) {
      expect(pacote, tela).not.toContain(tela)
    }
  })

  it('leva as atividades de casa do item 15: as telas 9 e 16 e o bloco da tela 15', () => {
    expect(pacote).toContain('Atividades desta semana')
    expect(pacote).toContain('Prescrever atividade')
    expect(pacote).toContain('Como foi hoje?')
    expect(pacote).toContain('Ver o vídeo')
    expect(pacote).toContain('noopener noreferrer')
    // Item 15b: para que serve, quem registrou e o registro de hoje.
    expect(pacote).toContain('Para que serve')
    expect(pacote).toContain('Registrado por')
    expect(pacote).toContain('Você já registrou hoje.')
    expect(pacote).toContain('Amanhã dá para registrar de novo.')
  })

  it('leva o relatorio de evolucao do item 18: as telas 10 e 10b e o botao da ficha', () => {
    // O botao da ficha: o link para a tela 10 com o texto dele. "Emitir
    // relatorio" sozinho tambem e o botao da propria tela 10.
    expect(pacote).toMatch(/para:`\/app\/clinica\/pacientes\/\$\{\w+\.id\}\/relatorio`[^}]*children:"Emitir relatório"/)
    expect(pacote).toContain('Pré-visualizar')
    expect(pacote).toContain('/relatorios/previa')
    expect(pacote).toContain('Imprimir ou salvar em PDF')
    expect(pacote).toContain('Para emitir, o paciente precisa de um plano vigente.')
  })

  it('imprime o cabecalho da folha do relatorio: paciente, periodo e destinatario', () => {
    // A impressao esconde todo header, que e a barra do topo; o da folha e
    // documento, e precisa ir para o papel.
    const impressao = estilos.match(/@media print\{(.*?\})\}/s)?.[1] ?? ''
    expect(impressao).toContain('header,nav,.nao-imprimir{display:none!important}')
    expect(impressao).toContain('.folha-relatorio header{display:block!important}')
  })

  it('leva o registro de auditoria do item 17: a tela 13, o menu e a exportacao', () => {
    expect(pacote).toContain('Registro de auditoria')
    expect(pacote).toContain('Só tentativas negadas')
    expect(pacote).toContain('/auditoria/exportacao')
    expect(pacote).toContain('/auditoria/pessoas')
  })

  it('leva a evolucao por objetivo do item 16: a tela 8 e o botao da ficha', () => {
    expect(pacote).toContain('Ver evolução por objetivo')
    expect(pacote).toContain('Comparação entre os três contextos')
    expect(pacote).toContain('/evolucao')
    expect(pacote).toContain('O domínio se confirma no plano vigente.')
  })

  it('leva o ciclo clinica–escola do item 6: os avisos da escola e os eventos da ficha', () => {
    expect(pacote).toContain('Avisos da escola')
    expect(pacote).toContain('Eventos comportamentais recentes')
  })

  it('leva a sessao do item 7: a evolucao, o historico de sessoes e o registro ABC', () => {
    expect(pacote).toContain('Evolução da sessão')
    expect(pacote).toContain('Histórico de sessões')
    expect(pacote).toContain('Registro ABC')
  })

  it('nenhuma tela diz "terapeuta": a pessoa aparece pelo nome e pela especialidade (item 7)', () => {
    // O enum TERAPEUTA, em maiusculas, continua no codigo: so o que se le muda.
    expect(pacote).not.toMatch(/[Tt]erapeutas?\b/)
    expect(pacote).toContain('Profissional da clínica')
  })

  it('leva o aviso do ambiente', () => {
    expect(pacote).toContain('Ambiente acadêmico do TCC SINCTEA. Não cadastre dados de pacientes reais.')
  })
})
