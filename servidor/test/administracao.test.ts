import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { diaCivilEm } from '@sinctea/compartilhado/dominio/datas'
import { ENTIDADES_ADMINISTRATIVAS } from '@sinctea/compartilhado/dominio/auditoria'
import { resumoDoToken } from '../src/autenticacao/servico-sessoes.js'
import type { PrismaClient } from '../src/gerado/client.js'
import { clienteDe, criarBancoMigrado } from './apoio/banco.js'
import { criarUsuario, subirApi, type Api } from './apoio/api.js'

/**
 * Item 13: o que o administrador faz alem de gerenciar usuarios, sem nunca
 * alcancar dado clinico (regra 3), nem pelo texto da auditoria.
 *
 * O link para nova senha, pela administracao, da equipe que ja definiu a
 * senha e do professor — o do responsavel continua com a coordenacao. E a
 * trilha administrativa (tela 25): so registro sem paciente, de contas, links,
 * escolas e da propria trilha; sem IP; ler tambem entra na trilha.
 */

let prisma: PrismaClient
let api: Api
let apagar: () => Promise<void>
const u: Record<string, string> = {}
const c: Record<string, string> = {}
const p: Record<string, string> = {}
const tokens: string[] = []

const PACIENTE = 'Miguel Ficticio'
const MOTIVO = 'Pediu pelo telefone da recepção: esqueceu a senha.'
const trilha = (cookie: string, filtro: Record<string, string | number | undefined> = {}) => {
  const q = new URLSearchParams(
    Object.entries(filtro).flatMap(([k, v]): [string, string][] => (v === undefined ? [] : [[k, String(v)]])),
  ).toString()
  return api.pedir('GET', `/admin/trilha${q ? `?${q}` : ''}`, { cookie })
}
/** A trilha administrativa inteira, pagina por pagina. */
const trilhaInteira = async () => {
  const itens: any[] = []
  for (let pagina = 1; ; pagina++) {
    const r = await trilha(c.admin, { pagina })
    expect(r.status, JSON.stringify(r.corpo)).toBe(200)
    itens.push(...r.corpo.itens)
    if (pagina * r.corpo.porPagina >= r.corpo.total) return itens
  }
}
const novaSenha = (cookie: string, usuarioId: string, corpo: unknown) =>
  api.pedir('POST', `/usuarios/${usuarioId}/nova-senha`, { cookie, corpo })
const sessaoDe = (cookie: string) => api.pedir('GET', '/auth/sessao', { cookie })

beforeAll(async () => {
  const banco = await criarBancoMigrado(inject('urlAdministrativa'), 'sinctea_administracao')
  apagar = banco.apagar
  prisma = clienteDe(banco.url)
  u.admin = await criarUsuario(prisma, { email: 'admin@teste.example', nome: 'Zélia Administradora', perfis: ['ADMINISTRADOR'] })
  u.ana = await criarUsuario(prisma, { email: 'ana@teste.example', nome: 'Ana Souza', perfis: ['TERAPEUTA'] })
  u.coord = await criarUsuario(prisma, { email: 'coord@teste.example', nome: 'Carla Coordenadora', perfis: ['COORDENADOR'] })
  u.prof = await criarUsuario(prisma, { email: 'prof@teste.example', nome: 'Dora Professora', perfis: ['PROFESSOR'], tipo: 'PROFESSOR_AEE' })
  u.novoProf = await criarUsuario(prisma, { email: 'novo.prof@teste.example', perfis: ['PROFESSOR'], tipo: 'PROFESSOR_AEE' })
  u.desligado = await criarUsuario(prisma, { email: 'desligado@teste.example', perfis: ['TERAPEUTA'] })
  api = await subirApi(banco.url)
  for (const nome of ['admin', 'ana', 'coord']) c[nome] = await api.entrar(`${nome}@teste.example`)
  // A professora e a pessoa desligada ja entraram: a senha esta definida.
  c.prof = await api.entrar('prof@teste.example')
  await api.entrar('desligado@teste.example')
  expect((await api.pedir('POST', `/usuarios/${u.desligado}/desativacao`, { cookie: c.admin })).status).toBe(200)

  // Registros clinicos no banco: o paciente, a ficha, a lista, o responsavel,
  // o link de nova senha que a coordenacao gera para ele, e negativas.
  p.paciente = (await api.pedir('POST', '/pacientes', {
    cookie: c.ana, corpo: { nome: PACIENTE, dataNascimento: '2019-03-12', nivelSuporte: 2, profissionalResponsavelId: u.ana },
  })).corpo.id
  expect((await api.pedir('GET', '/pacientes', { cookie: c.ana })).status).toBe(200)
  expect((await api.pedir('GET', `/pacientes/${p.paciente}`, { cookie: c.ana })).status).toBe(200)
  const mae = await api.pedir('POST', `/pacientes/${p.paciente}/responsaveis`, {
    cookie: c.ana,
    corpo: { nome: 'Patrícia Ficticia', email: 'patricia@teste.example', telefone: '(92) 90000-0001', parentesco: 'Mãe', responsavelLegal: true },
  })
  p.mae = mae.corpo.responsavel.responsavelId
  tokens.push(mae.corpo.primeiroAcesso.token)
  expect((await api.pedir('POST', `/auth/primeiro-acesso/${mae.corpo.primeiroAcesso.token}`, { corpo: { senha: 'senha-da-patricia' } })).status).toBe(200)
  c.mae = await api.entrar('patricia@teste.example', 'senha-da-patricia')
  const daMae = await api.pedir('POST', `/pacientes/${p.paciente}/responsaveis/${p.mae}/nova-senha`, { cookie: c.coord, corpo: { motivo: MOTIVO } })
  expect(daMae.status, JSON.stringify(daMae.corpo)).toBe(200)
  tokens.push(daMae.corpo.token)
  // O administrador nao le a ficha: negado, e a negativa e do paciente.
  expect((await api.pedir('GET', `/pacientes/${p.paciente}`, { cookie: c.admin })).status).toBe(403)
  expect((await api.pedir('GET', '/pacientes', { cookie: c.admin })).status).toBe(403)
})

afterAll(async () => {
  await api?.fechar()
  await prisma?.$disconnect()
  await apagar?.()
})

describe('link para nova senha pela administracao', () => {
  const linksDe = (usuarioId: string) => prisma.acessoInicial.count({ where: { usuarioId, finalidade: 'NOVA_SENHA' } })

  it('o do responsavel nao: e da coordenacao, na ficha; a negativa fica na trilha, e nenhum link nasce', async () => {
    const antes = await linksDe(p.mae)
    const r = await novaSenha(c.admin, p.mae, { motivo: MOTIVO })
    expect(r.status).toBe(403)
    expect(r.corpo.mensagem).toMatch(/coordenação/)
    expect(await linksDe(p.mae)).toBe(antes)
    expect(await prisma.registroAuditoria.findFirst({
      where: { usuarioId: u.admin, acao: 'ACESSO_NEGADO', idEntidade: p.mae }, orderBy: { ocorridoEm: 'desc' },
    })).toMatchObject({ entidade: 'Usuario', pacienteId: null })
  })

  it('quem nao e administrador nao gera, nem com motivo; a negativa fica na trilha', async () => {
    for (const nome of ['coord', 'ana', 'prof']) {
      expect((await novaSenha(c[nome], u.prof, { motivo: MOTIVO })).status).toBe(403)
      expect(await prisma.registroAuditoria.count({ where: { usuarioId: u[nome], acao: 'ACESSO_NEGADO', entidade: 'Usuario' } }))
        .toBeGreaterThan(0)
    }
    expect(await linksDe(u.prof)).toBe(0)
  })

  it('sem motivo, so com espacos, nao texto ou longo demais: recusado, e nenhum link nasce', async () => {
    for (const corpo of [{}, { motivo: '' }, { motivo: '   ' }, { motivo: 42 }, { motivo: 'x'.repeat(501) }]) {
      const r = await novaSenha(c.admin, u.prof, corpo)
      expect(r.status, JSON.stringify(corpo)).toBe(422)
      expect(r.corpo.campos).toHaveProperty('motivo')
    }
    expect(await linksDe(u.prof)).toBe(0)
  })

  it('quem nao definiu a senha recebe o link de primeiro acesso; quem definiu, so o de nova senha; desativada, nenhum', async () => {
    expect((await novaSenha(c.admin, u.novoProf, { motivo: MOTIVO })).status).toBe(409)
    expect((await novaSenha(c.admin, u.desligado, { motivo: MOTIVO })).status).toBe(409)
    // A equipe que ja entrou nao recebe mais o link de primeiro acesso, sem motivo.
    expect((await api.pedir('POST', `/usuarios/${u.ana}/acesso-inicial`, { cookie: c.admin })).status).toBe(409)
    expect(await prisma.acessoInicial.count({ where: { usuarioId: { in: [u.novoProf, u.desligado, u.ana] } } })).toBe(0)
  })

  for (const [quem, email, nome] of [
    ['do professor', 'prof@teste.example', 'prof'],
    ['da equipe', 'ana@teste.example', 'ana'],
  ] as const) {
    it(`o ${quem}: o link nasce com o motivo na trilha; usado, troca a senha, encerra as sessoes e traz o aviso com o nome de quem gerou`, async () => {
      const abertas = [await api.entrar(email), await api.entrar(email)]
      for (const cookie of abertas) expect((await sessaoDe(cookie)).status).toBe(200)

      const r = await novaSenha(c.admin, u[nome], { motivo: `  ${MOTIVO}  ` })
      expect(r.status, JSON.stringify(r.corpo)).toBe(200)
      tokens.push(r.corpo.token)
      const horas = (new Date(r.corpo.expiraEm).getTime() - Date.now()) / 3_600_000
      expect(horas).toBeGreaterThan(71.9)
      expect(horas).toBeLessThanOrEqual(72)
      const linha = await prisma.acessoInicial.findFirstOrThrow({ where: { usuarioId: u[nome], finalidade: 'NOVA_SENHA' } })
      expect(linha).toMatchObject({ tokenResumo: resumoDoToken(r.corpo.token), geradoPorId: u.admin, usadoEm: null })

      const gerado = await prisma.registroAuditoria.findFirstOrThrow({
        where: { idEntidade: u[nome], entidade: 'Usuario', acao: 'ALTERACAO' }, orderBy: { ocorridoEm: 'desc' },
      })
      expect(gerado).toMatchObject({ usuarioId: u.admin, usuarioNome: 'Zélia Administradora', perfil: 'ADMINISTRADOR', pacienteId: null })
      expect(gerado.detalhe).toContain(`Motivo: ${MOTIVO}`)
      expect(gerado.detalhe).not.toContain(r.corpo.token)

      // Enquanto o link nao e usado, a senha antiga ainda vale.
      expect((await sessaoDe(abertas[0])).status).toBe(200)
      const usado = await api.pedir('POST', `/auth/primeiro-acesso/${r.corpo.token}`, { corpo: { senha: `nova-senha-${nome}-123` } })
      expect(usado.status).toBe(200)
      for (const cookie of abertas) expect((await sessaoDe(cookie)).status).toBe(204)
      expect(await prisma.sessaoLogin.count({ where: { usuarioId: u[nome] } })).toBe(1)
      expect((await api.pedir('POST', '/auth/entrar', { corpo: { email, senha: 'senha-de-teste-123' } })).status).toBe(401)
      expect((await api.pedir('POST', `/auth/primeiro-acesso/${r.corpo.token}`, { corpo: { senha: 'outra-senha-qualquer' } })).status).toBe(409)

      const concluido = await prisma.registroAuditoria.findFirstOrThrow({
        where: { idEntidade: u[nome], entidade: 'Usuario', acao: 'ALTERACAO' }, orderBy: { ocorridoEm: 'desc' },
      })
      expect(concluido.detalhe).toBe('Senha redefinida pelo link de nova senha que Zélia Administradora gerou; as sessões abertas foram encerradas.')

      const { usadoEm } = await prisma.acessoInicial.findFirstOrThrow({ where: { usuarioId: u[nome], finalidade: 'NOVA_SENHA' } })
      const aviso = { redefinidaEm: usadoEm!.toISOString(), aPedidoDe: 'Zélia Administradora' }
      expect(usado.corpo.avisoDeRedefinicao).toEqual(aviso)
      c[nome] = await api.entrar(email, `nova-senha-${nome}-123`)
      expect((await sessaoDe(c[nome])).corpo.avisoDeRedefinicao).toEqual(aviso)
      expect((await api.pedir('POST', '/auth/aviso-de-nova-senha', { cookie: c[nome] })).corpo.avisoDeRedefinicao).toBeNull()
      expect((await sessaoDe(await api.entrar(email, `nova-senha-${nome}-123`))).corpo.avisoDeRedefinicao).toBeNull()
    })
  }
})

describe('trilha administrativa', () => {
  it('quem nao e administrador recebe a recusa, e a recusa fica na trilha', async () => {
    for (const nome of ['coord', 'ana', 'mae', 'prof']) {
      const r = await trilha(c[nome])
      expect(r.status, nome).toBe(403)
      expect(r.corpo).not.toHaveProperty('itens')
      expect(await prisma.registroAuditoria.findFirst({
        where: { usuarioId: u[nome] ?? p.mae, acao: 'ACESSO_NEGADO' }, orderBy: { ocorridoEm: 'desc' },
      })).toMatchObject({ entidade: 'RegistroAuditoria', pacienteId: null })
    }
    expect((await trilha('')).status).toBe(401)
  })

  it('o administrador nao recebe nenhum registro com paciente, mesmo havendo registros clinicos no banco', async () => {
    // O banco tem de tudo: registro com paciente, inclusive de entidade da
    // lista (o link do responsavel), e registro clinico sem paciente (a
    // lista de pacientes).
    const comPaciente = await prisma.registroAuditoria.findMany({ where: { pacienteId: { not: null } }, select: { id: true } })
    expect(comPaciente.length).toBeGreaterThanOrEqual(5)
    expect(await prisma.registroAuditoria.count({ where: { pacienteId: { not: null }, entidade: 'Usuario' } })).toBeGreaterThan(0)
    expect(await prisma.registroAuditoria.count({ where: { pacienteId: null, entidade: 'Paciente' } })).toBeGreaterThan(0)

    const itens = await trilhaInteira()
    const proibidos = new Set(comPaciente.map((r) => r.id))
    expect(itens.length).toBeGreaterThan(10)
    for (const item of itens) {
      expect(proibidos.has(item.id)).toBe(false)
      expect(ENTIDADES_ADMINISTRATIVAS).toContain(item.entidade)
      expect(item).not.toHaveProperty('pacienteId')
      expect(item).not.toHaveProperty('ipOrigem')
    }
    const texto = JSON.stringify(itens)
    expect(texto).not.toContain(PACIENTE)
    expect(texto).not.toContain(p.paciente)
    // O que o banco tem sem paciente e da lista, a trilha devolve inteiro
    // (menos as leituras desta propria consulta, gravadas depois de cada pagina).
    const esperados = await prisma.registroAuditoria.findMany({
      where: { pacienteId: null, entidade: { in: [...ENTIDADES_ADMINISTRATIVAS] } }, select: { id: true },
    })
    const devolvidos = new Set(itens.map((i) => i.id))
    const faltando = esperados.filter((r) => !devolvidos.has(r.id))
    expect(faltando.length).toBeLessThanOrEqual(Math.ceil(itens.length / 20))
  })

  it('nenhuma senha, resumo nem token aparece na trilha', async () => {
    const texto = JSON.stringify(await prisma.registroAuditoria.findMany())
    expect(texto).not.toMatch(/\$argon2/)
    expect(texto).not.toMatch(/senhaHash|tokenResumo/)
    expect(texto).not.toMatch(/\b[0-9a-f]{64}\b/)
    expect(tokens.length).toBeGreaterThanOrEqual(4)
    for (const token of tokens) {
      expect(texto).not.toContain(token)
      expect(texto).not.toContain(resumoDoToken(token))
    }
  })

  it('ler a trilha entra na trilha, como leitura do administrador, e sem paciente', async () => {
    const r = await trilha(c.admin)
    const leitura = await prisma.registroAuditoria.findFirstOrThrow({
      where: { usuarioId: u.admin, entidade: 'RegistroAuditoria' }, orderBy: [{ ocorridoEm: 'desc' }, { id: 'desc' }],
    })
    expect(leitura).toMatchObject({
      acao: 'LEITURA_AUTORIZADA', pacienteId: null, perfil: 'ADMINISTRADOR',
      detalhe: `Trilha administrativa consultada (${r.corpo.total} registros).`,
    })
    // E a leitura aparece na consulta seguinte, a mais recente.
    expect((await trilha(c.admin)).corpo.itens[0]).toMatchObject({ id: leitura.id, usuarioNome: 'Zélia Administradora' })
  })

  it('vinte por pagina, da mais recente para a mais antiga', async () => {
    // Cada leitura grava uma: le ate haver mais de duas paginas. Com limite,
    // para a leitura que nao grava falhar aqui, e nao no tempo do teste.
    for (let i = 0; i < 60 && (await trilha(c.admin)).corpo.total <= 41; i++);
    const primeira = (await trilha(c.admin)).corpo
    expect(primeira.porPagina).toBe(20)
    expect(primeira.itens).toHaveLength(20)
    expect(primeira.total).toBeGreaterThan(40)
    const segunda = (await trilha(c.admin, { pagina: 2 })).corpo
    const todas = [...primeira.itens, ...segunda.itens].map((i) => i.ocorridoEm)
    expect(todas).toEqual([...todas].sort().reverse())
    // Ler a primeira pagina gravou um registro no topo: a segunda comeca
    // pelo ultimo da primeira, e nada se perde no caminho.
    expect(segunda.itens[0].id).toBe(primeira.itens[19].id)
    expect(new Set([...primeira.itens, ...segunda.itens].map((i) => i.id)).size).toBe(39)
  })

  it('filtra por pessoa, por acao e por periodo, nos dias de Manaus', async () => {
    const daAna = (await trilha(c.admin, { usuarioId: u.ana })).corpo
    expect(daAna.total).toBeGreaterThan(0)
    expect(daAna.itens.every((i: any) => i.usuarioId === u.ana)).toBe(true)

    const negadas = (await trilha(c.admin, { acao: 'ACESSO_NEGADO' })).corpo
    expect(negadas.total).toBeGreaterThan(0)
    expect(negadas.itens.every((i: any) => i.acao === 'ACESSO_NEGADO')).toBe(true)
    // A negativa da ficha e da lista de pacientes nao vem: e do paciente, ou clinica.
    expect(negadas.itens.some((i: any) => i.entidade === 'Paciente')).toBe(false)

    const hoje = diaCivilEm(new Date())
    const total = (await trilha(c.admin)).corpo.total
    // Mais a leitura que deu o total.
    expect((await trilha(c.admin, { desde: hoje, ate: hoje })).corpo.total).toBe(total + 1)
    expect((await trilha(c.admin, { desde: '2099-01-01' })).corpo.total).toBe(0)
    expect((await trilha(c.admin, { ate: '2000-01-01' })).corpo.total).toBe(0)
  })

  it('filtro invalido e recusado, sem erro do banco', async () => {
    for (const filtro of [{ desde: '2026-13-40' }, { ate: 'ontem' }, { desde: '2026-10-20', ate: '2026-10-19' }, { acao: 'APAGAR' }]) {
      const r = await trilha(c.admin, filtro)
      expect(r.status, JSON.stringify(filtro)).toBe(422)
    }
    expect((await trilha(c.admin, { usuarioId: 'nao-e-uuid' })).status).toBe(404)
  })

  it('a trilha nao se edita nem se apaga pela API', async () => {
    const { id } = (await trilha(c.admin)).corpo.itens[0]
    for (const metodo of ['PUT', 'PATCH', 'DELETE']) {
      expect((await api.pedir(metodo, `/admin/trilha/${id}`, { cookie: c.admin, corpo: {} })).status).toBe(404)
      expect((await api.pedir(metodo, '/admin/trilha', { cookie: c.admin, corpo: {} })).status).toBe(404)
    }
  })
})

describe('item 13b: o que mudou na conta, e a escola sem o nome da familia', () => {
  const ultimaDa = (idEntidade: string) => prisma.registroAuditoria.findFirstOrThrow({
    where: { idEntidade, acao: 'ALTERACAO' }, orderBy: [{ ocorridoEm: 'desc' }, { id: 'desc' }],
  })

  it('perfis: a trilha guarda os de antes, se o conjunto mudou; a mesma lista em outra ordem nao e mudanca', async () => {
    const id = await criarUsuario(prisma, { email: 'perfis@teste.example', perfis: ['COORDENADOR'] })
    expect((await api.pedir('PUT', `/usuarios/${id}/perfis`, { cookie: c.admin, corpo: { perfis: ['TERAPEUTA', 'COORDENADOR'] } })).status).toBe(200)
    expect((await ultimaDa(id)).valorAnterior).toBe('{"perfis":["COORDENADOR"]}')
    expect((await api.pedir('PUT', `/usuarios/${id}/perfis`, { cookie: c.admin, corpo: { perfis: ['COORDENADOR', 'TERAPEUTA'] } })).status).toBe(200)
    expect((await ultimaDa(id)).valorAnterior).toBeNull()
    // E a trilha administrativa o mostra.
    const itens = (await trilha(c.admin, { acao: 'ALTERACAO' })).corpo.itens
    expect(itens.find((i: any) => i.idEntidade === id && i.valorAnterior)).toMatchObject({ valorAnterior: '{"perfis":["COORDENADOR"]}' })
  })

  it('situacao: desativar guarda que estava ativa; reativar, que estava desativada', async () => {
    const id = await criarUsuario(prisma, { email: 'situacao@teste.example', perfis: ['TERAPEUTA'] })
    expect((await api.pedir('POST', `/usuarios/${id}/desativacao`, { cookie: c.admin })).status).toBe(200)
    expect((await ultimaDa(id)).valorAnterior).toBe('{"ativo":true}')
    expect((await api.pedir('POST', `/usuarios/${id}/reativacao`, { cookie: c.admin })).status).toBe(200)
    expect((await ultimaDa(id)).valorAnterior).toBe('{"ativo":false}')
  })

  it('dados profissionais: o dono muda, e a trilha guarda so o campo que mudou', async () => {
    const id = await criarUsuario(prisma, { email: 'dados@teste.example', perfis: ['TERAPEUTA'] })
    const cookie = await api.entrar('dados@teste.example')
    const salvar = (corpo: Record<string, string>) => api.pedir('PUT', '/usuarios/eu/dados-profissionais', { cookie, corpo })
    expect((await salvar({ especialidade: 'Psicologia', registroConselho: 'CRFa 0000-FICT' })).status).toBe(200)
    expect((await ultimaDa(id)).valorAnterior).toBe('{"especialidade":"Fonoaudiologia"}')
    expect((await salvar({ especialidade: 'Psicologia', registroConselho: 'CRP 20/0000-FICT' })).status).toBe(200)
    expect((await ultimaDa(id)).valorAnterior).toBe('{"registroConselho":"CRFa 0000-FICT"}')
    expect((await salvar({ especialidade: 'Psicologia', registroConselho: 'CRP 20/0000-FICT' })).status).toBe(200)
    expect((await ultimaDa(id)).valorAnterior).toBeNull()
  })

  it('a versao anterior da conta so tem estes quatro campos: nunca a senha nem token', async () => {
    const registros = await prisma.registroAuditoria.findMany({ where: { entidade: 'Usuario', valorAnterior: { not: null } } })
    expect(registros.length).toBeGreaterThanOrEqual(5)
    for (const r of registros) {
      for (const campo of Object.keys(JSON.parse(r.valorAnterior!))) {
        expect(['perfis', 'ativo', 'especialidade', 'registroConselho']).toContain(campo)
      }
      expect(r.valorAnterior).not.toMatch(/\$argon2|senha|token/i)
    }
  })

  it('escola cadastrada por responsavel: na trilha administrativa, so "um responsavel"; o banco guarda o nome; o filtro por pessoa nao a traz', async () => {
    const r = await api.pedir('POST', '/escolas', { cookie: c.mae, corpo: { nome: 'Escola Estadual Ficticia', rede: 'Estadual', municipio: 'Manaus' } })
    expect(r.status, JSON.stringify(r.corpo)).toBe(201)
    expect(await prisma.registroAuditoria.findFirstOrThrow({ where: { entidade: 'Escola', idEntidade: r.corpo.id } }))
      .toMatchObject({ usuarioId: p.mae, usuarioNome: 'Patrícia Ficticia', perfil: 'RESPONSAVEL', acao: 'CRIACAO' })

    const item = (await trilha(c.admin)).corpo.itens.find((i: any) => i.idEntidade === r.corpo.id)
    expect(item).toMatchObject({ entidade: 'Escola', perfil: 'RESPONSAVEL', usuarioId: null, usuarioNome: null })
    expect(JSON.stringify(item)).not.toContain('Patrícia')
    expect(JSON.stringify(item)).not.toContain(p.mae)

    const daMae = (await trilha(c.admin, { usuarioId: p.mae })).corpo
    expect(daMae.total).toBeGreaterThan(0)
    expect(daMae.itens.some((i: any) => i.entidade === 'Escola')).toBe(false)
    // O que nao e escola continua com o nome: a conta dela, a administracao ja ve na tela 14.
    expect(daMae.itens.every((i: any) => i.usuarioNome === 'Patrícia Ficticia')).toBe(true)
  })
})
