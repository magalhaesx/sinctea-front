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
    // Um texto proprio de cada tela ou secao que so existe com o mock: a
    // agenda, as atividades de casa e o relatorio.
    for (const tela of ['Agenda do dia', 'Voltar para hoje', 'Atividades desta semana', 'Emitir relat']) {
      expect(pacote, tela).not.toContain(tela)
    }
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
