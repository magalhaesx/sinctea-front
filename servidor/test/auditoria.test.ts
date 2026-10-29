import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { ENTIDADES_AUDITADAS } from '@sinctea/compartilhado/dominio/auditoria'
import { diaCivilEm } from '@sinctea/compartilhado/dominio/datas'
import { uuidV7 } from '../prisma/semente/uuid7.js'
import type { PrismaClient } from '../src/gerado/client.js'
import { clienteDe, criarBancoMigrado } from './apoio/banco.js'
import { abaDoCookie, cookieDaSessao, criarUsuario, subirApi, type Api, type Resposta } from './apoio/api.js'

/**
 * Item 17: a trilha de auditoria da tela 13, pela API. So a coordenacao le e
 * exporta; o periodo e em dias de Manaus; a pagina e contada no banco; o IP
 * nao sai; cada consulta e cada exportacao deixam uma linha; nao ha rota de
 * editar nem de excluir.
 *
 * Os registros de periodos fixos (2024 e 2025) sao gravados direto no banco:
 * a trilha so recusa UPDATE e DELETE, e o filtro por dia os separa dos que a
 * propria API grava agora.
 */

let prisma: PrismaClient
let api: Api
let apagar: () => Promise<void>
const u: Record<string, string> = {}
const c: Record<string, string> = {}
const p: Record<string, string> = {}

const em90dias = () => diaCivilEm(new Date(Date.now() + 90 * 86_400_000))
const consultar = (cookie: string, consulta = '') => api.pedir('GET', `/auditoria${consulta}`, { cookie })
const exportar = (cookie: string, consulta = '') => api.pedir('GET', `/auditoria/exportacao${consulta}`, { cookie })

/** Um registro gravado direto, como o servidor o grava, num instante escolhido. */
const registro = (ocorridoEm: string, mudanca: Record<string, unknown> = {}) => ({
  id: uuidV7(), ocorridoEm: new Date(ocorridoEm), usuarioId: u.coord, usuarioNome: 'Caio Coordenador', perfil: 'COORDENADOR' as const,
  acao: 'LEITURA_AUTORIZADA' as const, entidade: 'Paciente', idEntidade: null, pacienteId: null, origem: 'CLINICA' as const,
  ipOrigem: '203.0.113.9', detalhe: 'Registro de teste.', valorAnterior: null, ...mudanca,
})

async function linhasNovas(pedido: () => Promise<Resposta>) {
  const antes = (await prisma.registroAuditoria.findMany({ select: { id: true } })).map((x) => x.id)
  const r = await pedido()
  return { r, linhas: await prisma.registroAuditoria.findMany({ where: { id: { notIn: antes } } }) }
}

beforeAll(async () => {
  const banco = await criarBancoMigrado(inject('urlAdministrativa'), 'sinctea_auditoria')
  apagar = banco.apagar
  prisma = clienteDe(banco.url)
  u.ana = await criarUsuario(prisma, { email: 'ana@teste.example', nome: 'Ana Souza', perfis: ['TERAPEUTA'] })
  u.coord = await criarUsuario(prisma, { email: 'coord@teste.example', nome: 'Caio Coordenador', perfis: ['COORDENADOR'] })
  u.admin = await criarUsuario(prisma, { email: 'admin@teste.example', nome: 'Zélia Administradora', perfis: ['ADMINISTRADOR'] })
  // Quem so agiu ha muito tempo: aparece na lista de pessoas mesmo assim.
  u.antigo = await criarUsuario(prisma, { email: 'antigo@teste.example', nome: 'Otávio Antigo', perfis: ['TERAPEUTA'] })
  api = await subirApi(banco.url)
  for (const nome of ['ana', 'coord', 'admin']) c[nome] = await api.entrar(`${nome}@teste.example`)

  p.miguel = (await api.pedir('POST', '/pacientes', {
    cookie: c.ana, corpo: { nome: 'Miguel Ficticio Santana', dataNascimento: '2019-03-12', nivelSuporte: 2, profissionalResponsavelId: u.ana },
  })).corpo.id
  const mae = await api.pedir('POST', `/pacientes/${p.miguel}/responsaveis`, {
    cookie: c.ana, corpo: { nome: 'Patrícia Ficticia', email: 'mae@teste.example', telefone: '(92) 90000-0000', parentesco: 'Mãe', responsavelLegal: true },
  })
  await api.pedir('POST', `/auth/primeiro-acesso/${mae.corpo.primeiroAcesso.token}`, { corpo: { senha: 'senha-da-familia-1' } })
  c.mae = await api.entrar('mae@teste.example', 'senha-da-familia-1')
  u.mae = mae.corpo.responsavel.responsavelId
  const escola = await api.pedir('POST', '/escolas', { cookie: c.mae, corpo: { nome: 'Escola Municipal Vitória-Régia', rede: 'Municipal', municipio: 'Manaus' } })
  const consentimento = await api.pedir('POST', '/consentimentos', {
    cookie: c.mae, corpo: { pacienteId: p.miguel, escolaId: escola.corpo.id, escopos: ['CARTAO_ESTRATEGIA'], validadeAte: em90dias() },
  })
  const carla = await api.pedir('POST', `/convites/${consentimento.corpo.tokenConvite}/aceite`, {
    corpo: { nome: 'Carla Professora', email: 'carla@escola.example', senha: 'senha-da-carla', turma: '2º ano A', turno: 'Matutino', atuacao: 'Regente' },
  })
  expect(carla.status, JSON.stringify(carla.corpo)).toBe(200)
  c.carla = cookieDaSessao(carla)
  u.carla = carla.corpo.usuario.id
})

afterAll(async () => {
  await api?.fechar()
  await prisma?.$disconnect()
  await apagar?.()
})

describe('so a coordenacao', () => {
  it('profissional, administrador, responsavel e professor sao negados nas tres rotas, e cada negativa fica na trilha', async () => {
    for (const quem of ['ana', 'admin', 'mae', 'carla']) {
      for (const caminho of ['/auditoria', '/auditoria/exportacao', '/auditoria/pessoas']) {
        const { r, linhas } = await linhasNovas(() => api.pedir('GET', caminho, { cookie: c[quem] }))
        expect(r.status, `${quem} ${caminho}`).toBe(403)
        expect(linhas, `${quem} ${caminho}`).toHaveLength(1)
        expect(linhas[0], `${quem} ${caminho}`).toMatchObject({ acao: 'ACESSO_NEGADO', entidade: 'RegistroAuditoria', usuarioId: u[quem] })
        expect(JSON.stringify(r.corpo), `${quem} ${caminho}`).not.toContain('Registro de teste')
      }
    }
  })

  it('nao existe rota de editar nem de excluir registro', async () => {
    const qualquer = (await prisma.registroAuditoria.findFirstOrThrow()).id
    for (const metodo of ['PUT', 'PATCH', 'DELETE']) {
      expect((await api.pedir(metodo, `/auditoria/${qualquer}`, { cookie: c.coord, corpo: metodo === 'DELETE' ? undefined : { detalhe: 'Outro.' } })).status, metodo).toBe(404)
    }
    expect((await api.pedir('POST', '/auditoria', { cookie: c.coord, corpo: { detalhe: 'Novo.' } })).status).toBe(404)
    expect((await prisma.registroAuditoria.findUniqueOrThrow({ where: { id: qualquer } })).detalhe).not.toBe('Outro.')
  })
})

describe('a consulta', () => {
  it('uma linha LEITURA_AUTORIZADA por consulta; com filtro de paciente, a linha leva o paciente', async () => {
    const sem = await linhasNovas(() => consultar(c.coord))
    expect(sem.r.status, JSON.stringify(sem.r.corpo)).toBe(200)
    expect(sem.linhas).toHaveLength(1)
    expect(sem.linhas[0]).toMatchObject({ acao: 'LEITURA_AUTORIZADA', entidade: 'RegistroAuditoria', pacienteId: null, usuarioId: u.coord })
    expect(sem.linhas[0].detalhe).toMatch(/^Trilha de auditoria consultada: \d+ registros \(sem filtro\)\.$/)

    const com = await linhasNovas(() => consultar(c.coord, `?pacienteId=${p.miguel}`))
    expect(com.r.status).toBe(200)
    expect(com.r.corpo.itens.every((x: { pacienteId: string }) => x.pacienteId === p.miguel)).toBe(true)
    expect(com.linhas).toHaveLength(1)
    expect(com.linhas[0]).toMatchObject({ acao: 'LEITURA_AUTORIZADA', entidade: 'RegistroAuditoria', pacienteId: p.miguel })
  })

  it('o periodo e em dias de Manaus: 23h30 do dia D entra em ate=D; 00h30 de D+1, nao', async () => {
    // 10/06/2025 23h30 em Manaus = 11/06 03h30 em UTC; 11/06 00h30 em Manaus = 11/06 04h30 em UTC.
    await prisma.registroAuditoria.createMany({ data: [
      registro('2025-06-11T03:30:00.000Z', { detalhe: 'Dia D, 23h30.' }),
      registro('2025-06-11T04:30:00.000Z', { detalhe: 'Dia D+1, 00h30.' }),
    ] })
    const doDia = await consultar(c.coord, '?desde=2025-06-10&ate=2025-06-10')
    expect(doDia.corpo.itens.map((x: { detalhe: string }) => x.detalhe)).toEqual(['Dia D, 23h30.'])
    const doSeguinte = await consultar(c.coord, '?desde=2025-06-11&ate=2025-06-11')
    expect(doSeguinte.corpo.itens.map((x: { detalhe: string }) => x.detalhe)).toEqual(['Dia D+1, 00h30.'])
  })

  it('a pagina e contada e cortada no banco: 20 por pagina, do mais recente, com o total certo', async () => {
    await prisma.registroAuditoria.createMany({
      data: Array.from({ length: 45 }, (_, i) => registro(new Date(Date.UTC(2025, 0, 15, 13, i)).toISOString(), { detalhe: `Pagina ${i}.` })),
    })
    const vistos: string[] = []
    for (const [pagina, tamanho] of [[1, 20], [2, 20], [3, 5]]) {
      const r = await consultar(c.coord, `?desde=2025-01-15&ate=2025-01-15&pagina=${pagina}&porPagina=100`)
      expect(r.corpo).toMatchObject({ total: 45, pagina, porPagina: 20 })
      expect(r.corpo.itens, String(pagina)).toHaveLength(tamanho)
      vistos.push(...r.corpo.itens.map((x: { detalhe: string }) => x.detalhe))
    }
    expect(vistos).toEqual(Array.from({ length: 45 }, (_, i) => `Pagina ${44 - i}.`))
  })

  it('o IP fica no banco: nem a consulta nem o CSV o levam', async () => {
    await prisma.registroAuditoria.create({ data: registro('2025-03-03T15:00:00.000Z', { detalhe: 'Com IP.' }) })
    expect((await prisma.registroAuditoria.findFirstOrThrow({ where: { detalhe: 'Com IP.' } })).ipOrigem).toBe('203.0.113.9')
    const lista = await consultar(c.coord, '?desde=2025-03-03&ate=2025-03-03')
    expect(lista.corpo.itens).toHaveLength(1)
    expect(Object.keys(lista.corpo.itens[0])).not.toContain('ipOrigem')
    expect(JSON.stringify(lista.corpo)).not.toContain('203.0.113.9')
    const csv = await exportar(c.coord, '?desde=2025-03-03&ate=2025-03-03')
    expect(csv.corpo).toContain('Com IP.')
    expect(csv.corpo).not.toContain('203.0.113.9')
    expect(csv.corpo.split('\r\n')[0]).not.toMatch(/\bIP\b/)
  })

  it('os erros de validacao, sem consultar e sem linha na trilha', async () => {
    for (const [consulta, campo] of [
      ['?desde=2025-06-10T00:00:00.000Z', 'desde'], ['?ate=2025-02-30', 'ate'], ['?desde=2025-06-11&ate=2025-06-10', 'ate'],
      ['?usuarioId=u-prof-1', 'usuarioId'], ['?pacienteId=nao-e-uuid', 'pacienteId'], ['?acao=APAGAR', 'acao'], ['?entidade=senhaHash', 'entidade'],
    ]) {
      for (const pedido of [consultar, exportar]) {
        const { r, linhas } = await linhasNovas(() => pedido(c.coord, consulta))
        expect(r.status, consulta).toBe(422)
        expect(Object.keys(r.corpo.campos), consulta).toEqual([campo])
        expect(linhas, consulta).toHaveLength(0)
      }
    }
  })
})

describe('a exportacao', () => {
  it('leva todo o recorte, e nao so a pagina; o arquivo leva o dia de Manaus; uma linha na trilha, com o filtro e o paciente', async () => {
    const { r, linhas } = await linhasNovas(() => exportar(c.coord, '?desde=2025-01-15&ate=2025-01-15'))
    expect(r.status).toBe(200)
    expect(r.cabecalhos.get('content-type')).toMatch(/^text\/csv/)
    expect(r.cabecalhos.get('content-disposition')).toBe(`attachment; filename="auditoria-${diaCivilEm(new Date())}.csv"`)
    // Cabecalho e 45 linhas.
    expect(r.corpo.trim().split('\r\n')).toHaveLength(46)
    // Os bytes comecam com o BOM do UTF-8: e o que faz o Excel em portugues ler os acentos.
    const bytes = new Uint8Array(await (await fetch(`${await api.aplicacao.getUrl()}/api/auditoria/exportacao?desde=2025-01-15&ate=2025-01-15`, {
      headers: { Cookie: c.coord, 'X-Sinctea-Aba': String(abaDoCookie(c.coord)) },
    })).arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(linhas).toHaveLength(1)
    expect(linhas[0]).toMatchObject({
      acao: 'LEITURA_AUTORIZADA', entidade: 'RegistroAuditoria', pacienteId: null,
      detalhe: 'Exportação da trilha: 45 registros (desde 2025-01-15, até 2025-01-15).',
    })
    const comPaciente = await linhasNovas(() => exportar(c.coord, `?pacienteId=${p.miguel}`))
    expect(comPaciente.linhas).toHaveLength(1)
    expect(comPaciente.linhas[0].pacienteId).toBe(p.miguel)
  })

  it('a celula que comeca com "=" sai protegida', async () => {
    await prisma.registroAuditoria.create({ data: registro('2025-04-04T15:00:00.000Z', { detalhe: '=1+1', usuarioNome: '@SOMA(A1)' }) })
    const csv = await exportar(c.coord, '?desde=2025-04-04&ate=2025-04-04')
    expect(csv.corpo).toContain(`"'=1+1"`)
    expect(csv.corpo).toContain(`"'@SOMA(A1)"`)
  })

  it('acima de 10.000 registros, nada sai: VALIDACAO, e nenhuma linha na trilha', async () => {
    // 10.000 no dia 01/03/2024 e um no dia seguinte, em Manaus.
    await prisma.$executeRaw`
      INSERT INTO "registro_auditoria" ("id", "ocorridoEm", "usuarioId", "usuarioNome", "perfil", "acao", "entidade", "origem", "detalhe")
      SELECT gen_random_uuid(), TIMESTAMPTZ '2024-03-01 14:00:00+00' + make_interval(secs => n), ${u.coord}::uuid, 'Caio Coordenador',
        'COORDENADOR', 'LEITURA_AUTORIZADA', 'Paciente', 'CLINICA', 'Limite ' || n
      FROM generate_series(1, 10000) AS n`
    await prisma.registroAuditoria.create({ data: registro('2024-03-02T15:00:00.000Z', { detalhe: 'Um a mais.' }) })

    const noLimite = await exportar(c.coord, '?desde=2024-03-01&ate=2024-03-01')
    expect(noLimite.status).toBe(200)
    expect(noLimite.corpo.trim().split('\r\n')).toHaveLength(10_001)

    const { r, linhas } = await linhasNovas(() => exportar(c.coord, '?desde=2024-03-01&ate=2024-03-02'))
    expect(r.status).toBe(422)
    expect(r.corpo.mensagem).toBe('O recorte tem mais de 10.000 registros. Reduza o período ou use outro filtro.')
    expect(linhas).toHaveLength(0)
  }, 60_000)
})

describe('o item 17b', () => {
  it('o CSV abre com a data e hora de Manaus, fecha com o instante em UTC e traz a entidade por extenso', async () => {
    // 05/05/2025 23h30 em Manaus = 06/05 03h30 em UTC.
    await prisma.registroAuditoria.create({ data: registro('2025-05-06T03:30:00.000Z', { entidade: 'PlanoTerapeutico', detalhe: 'Por extenso.' }) })
    const csv = await exportar(c.coord, '?desde=2025-05-05&ate=2025-05-05')
    const [cabecalho, linha] = csv.corpo.trim().split('\r\n')
    expect(cabecalho.split(';')[0]).toBe('"Data e hora (Manaus)"')
    expect(cabecalho.split(';').at(-1)).toBe('"Instante (UTC)"')
    expect(linha.split(';')[0]).toBe('"05/05/2025 23:30:00"')
    expect(linha.split(';').at(-1)).toBe('"2025-05-06T03:30:00.000Z"')
    expect(linha).toContain('"Plano terapêutico"')
    expect(linha).not.toContain('"PlanoTerapeutico"')
    // A API continua com o nome tecnico.
    const lista = await consultar(c.coord, '?desde=2025-05-05&ate=2025-05-05&entidade=PlanoTerapeutico')
    expect(lista.corpo.itens.map((x: { entidade: string }) => x.entidade)).toEqual(['PlanoTerapeutico'])
  })

  it('a ordem da tela 13 tem indice proprio: ocorridoEm e id, do mais recente', async () => {
    const [indice] = await prisma.$queryRaw<Array<{ indexdef: string }>>`
      SELECT indexdef FROM pg_indexes WHERE tablename = 'registro_auditoria' AND indexname = 'registro_auditoria_ocorridoEm_id_idx'`
    expect(indice?.indexdef).toMatch(/\("ocorridoEm" DESC, id DESC\)/)
  })
})

describe('as pessoas do filtro', () => {
  it('de toda a trilha, com o nome do registro mais recente, em ordem alfabetica; sem linha na trilha', async () => {
    // A Ana, num registro antigo, com outro nome; e, agora, renomeada.
    await prisma.registroAuditoria.createMany({ data: [
      registro('2023-01-01T15:00:00.000Z', { usuarioId: u.ana, usuarioNome: 'Ana Antiga', perfil: 'TERAPEUTA' }),
      registro('2023-01-02T15:00:00.000Z', { usuarioId: u.antigo, usuarioNome: 'Otávio Antigo', perfil: 'TERAPEUTA' }),
      registro(new Date().toISOString(), { usuarioId: u.ana, usuarioNome: 'Ana Souza Renomeada', perfil: 'TERAPEUTA' }),
    ] })
    const { r, linhas } = await linhasNovas(() => api.pedir('GET', '/auditoria/pessoas', { cookie: c.coord }))
    expect(r.status).toBe(200)
    expect(linhas).toHaveLength(0)
    const nomes = r.corpo.map((x: { nome: string }) => x.nome)
    expect(r.corpo.filter((x: { usuarioId: string }) => x.usuarioId === u.ana)).toEqual([{ usuarioId: u.ana, nome: 'Ana Souza Renomeada' }])
    expect(nomes).not.toContain('Ana Antiga')
    expect(nomes).toEqual([...nomes].sort((a: string, b: string) => a.localeCompare(b, 'pt-BR')))
    for (const quem of ['coord', 'mae', 'carla', 'admin', 'antigo']) expect(r.corpo.map((x: { usuarioId: string }) => x.usuarioId), quem).toContain(u[quem] ?? '')
  })
})

describe('a lista fechada de entidades', () => {
  it('toda entidade que o servidor declara na trilha esta em ENTIDADES_AUDITADAS', () => {
    const raiz = fileURLToPath(new URL('../src', import.meta.url))
    const arquivos = (pasta: string): string[] => readdirSync(pasta).flatMap((nome) => {
      const caminho = join(pasta, nome)
      return statSync(caminho).isDirectory() ? (nome === 'gerado' ? [] : arquivos(caminho)) : caminho.endsWith('.ts') ? [caminho] : []
    })
    const declaradas = new Set<string>()
    for (const arquivo of arquivos(raiz)) {
      const texto = readFileSync(arquivo, 'utf8')
      for (const m of texto.matchAll(/entidade: '([A-Za-z]+)'|SemDadoDoPaciente\('([A-Za-z]+)'\)/g)) declaradas.add(m[1] ?? m[2])
    }
    // Saude e publica: nem leitura nem negativa entram na trilha.
    declaradas.delete('Saude')
    expect(declaradas.size).toBeGreaterThan(10)
    expect([...declaradas].filter((e) => !(ENTIDADES_AUDITADAS as readonly string[]).includes(e))).toEqual([])
  })
})
