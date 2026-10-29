import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import type { PrismaClient } from '../src/gerado/client.js'
import { clienteDe, criarBancoMigrado } from './apoio/banco.js'
import { criarUsuario, subirApi, type Api } from './apoio/api.js'

/**
 * Item 3 do caminho principal (docs/07, secao 0): pacientes, plano com cartao
 * e sessao, pela API, num banco que comeca vazio. As regras que o item toca:
 * o alcance clinico, a regra 3 (a escola nunca le dado clinico), a regra 4
 * (a redacao acessivel e escrita, nunca gerada) e a regra 6 (toda leitura,
 * escrita e negativa registrada, com o paciente).
 */

let prisma: PrismaClient
let api: Api
let apagar: () => Promise<void>
const u: Record<string, string> = {}
const c: Record<string, string> = {}

const OBJETIVO = {
  dominio: 'Comunicação funcional',
  descricaoTecnica: 'Emitir mando por item preferido em 8 de 10 tentativas.',
  descricaoAcessivel: '  Pedir o que quer, apontando ou falando.  ',
  criterio: { percentualMinimo: 80, sessoesConsecutivas: 2 },
}
const CARTAO = {
  tituloSimples: ' Pedir ajuda ',
  oQueFazer: ['Mostrar a figura do que ele quer', '  ', 'Esperar a resposta'],
  oQueEvitar: ['Falar várias coisas de uma vez'],
  sinalAlerta: 'Tapa os ouvidos e se afasta.',
}

beforeAll(async () => {
  const banco = await criarBancoMigrado(inject('urlAdministrativa'), 'sinctea_clinica')
  apagar = banco.apagar
  prisma = clienteDe(banco.url)
  u.ana = await criarUsuario(prisma, { email: 'ana@teste.example', nome: 'Ana Terapeuta', perfis: ['TERAPEUTA'] })
  u.bia = await criarUsuario(prisma, { email: 'bia@teste.example', nome: 'Bia Terapeuta', perfis: ['TERAPEUTA'] })
  u.caio = await criarUsuario(prisma, { email: 'caio@teste.example', nome: 'Caio Coordenador', perfis: ['COORDENADOR', 'TERAPEUTA'] })
  u.duda = await criarUsuario(prisma, { email: 'duda@teste.example', nome: 'Duda Coordenadora', perfis: ['COORDENADOR'] })
  u.prof = await criarUsuario(prisma, { email: 'prof@teste.example', perfis: ['PROFESSOR'], tipo: 'PROFESSOR_AEE' })
  u.adm = await criarUsuario(prisma, { email: 'adm@teste.example', perfis: ['ADMINISTRADOR'] })
  api = await subirApi(banco.url)
  for (const nome of ['ana', 'bia', 'caio', 'duda', 'prof', 'adm']) c[nome] = await api.entrar(`${nome}@teste.example`)
})

afterAll(async () => {
  await api?.fechar()
  await prisma?.$disconnect()
  await apagar?.()
})

const trilha = (where: Record<string, unknown>) => prisma.registroAuditoria.findMany({ where, orderBy: { ocorridoEm: 'asc' } })
const ultimaDe = async (where: Record<string, unknown>) => (await trilha(where)).at(-1)

async function novoPaciente(cookie: string, nome: string, responsavelId: string): Promise<string> {
  const r = await api.pedir('POST', '/pacientes', { cookie, corpo: { nome, dataNascimento: '2019-03-12', nivelSuporte: 2, profissionalResponsavelId: responsavelId } })
  expect(r.status, JSON.stringify(r.corpo)).toBe(201)
  return r.corpo.id
}

describe('pacientes e alcance clinico', () => {
  let p1: string

  beforeAll(async () => { p1 = await novoPaciente(c.ana, 'Miguel Ficticio', u.ana) })

  it('quem cadastra e o responsavel pelo caso formam a equipe; o cadastro e a ficha entram na trilha', async () => {
    const ficha = await api.pedir('GET', `/pacientes/${p1}`, { cookie: c.ana })
    expect(ficha.status).toBe(200)
    expect(ficha.corpo).toMatchObject({ nome: 'Miguel Ficticio', dataNascimento: '2019-03-12', equipeIds: [u.ana], situacaoPlano: 'SEM_PLANO', redeApoio: [], totalSessoes: 0 })
    expect(await ultimaDe({ pacienteId: p1, acao: 'CRIACAO' })).toMatchObject({ entidade: 'Paciente', usuarioId: u.ana })
    expect(await ultimaDe({ pacienteId: p1, acao: 'LEITURA_AUTORIZADA' })).toMatchObject({ entidade: 'Paciente', detalhe: 'Ficha do paciente.' })
  })

  it('terapeuta de fora nao ve na lista e e negado na ficha, com a negativa registrada; a coordenacao ve', async () => {
    expect((await api.pedir('GET', '/pacientes', { cookie: c.bia })).corpo.total).toBe(0)
    expect((await api.pedir('GET', `/pacientes/${p1}`, { cookie: c.bia })).status).toBe(403)
    expect(await ultimaDe({ pacienteId: p1, acao: 'ACESSO_NEGADO' })).toMatchObject({ usuarioId: u.bia, detalhe: 'Paciente fora do alcance do perfil.' })
    const lista = await api.pedir('GET', '/pacientes', { cookie: c.duda })
    expect(lista.corpo.itens.map((p: { id: string }) => p.id)).toContain(p1)
    expect(await ultimaDe({ usuarioId: u.duda, acao: 'LEITURA_AUTORIZADA' })).toMatchObject({ entidade: 'Paciente', detalhe: expect.stringMatching(/^Lista de pacientes: \d+\.$/) })
  })

  it('regra 3: professor, administrador e quem nao tem sessao nao alcancam nada da clinica', async () => {
    for (const caminho of ['/pacientes', `/pacientes/${p1}`, `/pacientes/${p1}/plano`, `/pacientes/${p1}/sessoes`]) {
      expect((await api.pedir('GET', caminho, { cookie: c.prof })).status, caminho).toBe(403)
      expect((await api.pedir('GET', caminho, { cookie: c.adm })).status, caminho).toBe(403)
      expect((await api.pedir('GET', caminho)).status, caminho).toBe(401)
    }
    expect(await ultimaDe({ usuarioId: u.prof, acao: 'ACESSO_NEGADO' })).toMatchObject({ perfil: 'PROFESSOR', origem: 'ESCOLA' })
  })

  it('cadastro com dado faltando ou profissional inexistente e recusado', async () => {
    const r = await api.pedir('POST', '/pacientes', { cookie: c.ana, corpo: {} })
    expect(r.status).toBe(422)
    expect(Object.keys(r.corpo.campos).sort()).toEqual(['dataNascimento', 'nivelSuporte', 'nome', 'profissionalResponsavelId'])
    const fantasma = await api.pedir('POST', '/pacientes', { cookie: c.ana, corpo: { nome: 'X', dataNascimento: '2019-02-30', nivelSuporte: 1, profissionalResponsavelId: u.prof } })
    expect(Object.keys(fantasma.corpo.campos).sort()).toEqual(['dataNascimento', 'profissionalResponsavelId'])
  })
})

describe('responsavel na ficha (lacuna 2)', () => {
  let p1: string
  let p2: string

  beforeAll(async () => {
    p1 = await novoPaciente(c.ana, 'Sofia Ficticia', u.ana)
    p2 = await novoPaciente(c.ana, 'Davi Ficticio', u.ana)
  })

  const cadastrar = (pacienteId: string, corpo: Record<string, unknown>) =>
    api.pedir('POST', `/pacientes/${pacienteId}/responsaveis`, { cookie: c.ana, corpo })
  const MAE = { nome: 'Patrícia Ficticia', email: ' Patricia@Teste.EXAMPLE ', telefone: '(92) 90000-0001', parentesco: 'Mãe', responsavelLegal: true }

  it('cria a conta com e-mail em minusculas e o link; a ficha mostra a pessoa pendente; o link nao entra na trilha', async () => {
    const r = await cadastrar(p1, MAE)
    expect(r.status).toBe(201)
    expect(r.corpo.responsavel).toMatchObject({ nome: 'Patrícia Ficticia', email: 'patricia@teste.example', parentesco: 'Mãe', responsavelLegal: true, primeiroAcessoPendente: true })
    const { token } = r.corpo.primeiroAcesso
    const registro = await ultimaDe({ pacienteId: p1, entidade: 'VinculoFamiliar' })
    expect(registro!.detalhe).toContain('responsável legal')
    expect(registro!.detalhe).not.toContain(token)

    const ficha = await api.pedir('GET', `/pacientes/${p1}`, { cookie: c.ana })
    expect(ficha.corpo.redeApoio).toEqual([expect.objectContaining({ email: 'patricia@teste.example', primeiroAcessoPendente: true })])

    // Link novo, enquanto ela nao definiu a senha: o anterior deixa de valer.
    const novo = await api.pedir('POST', `/pacientes/${p1}/responsaveis/${r.corpo.responsavel.responsavelId}/acesso-inicial`, { cookie: c.ana })
    expect(novo.status).toBe(200)
    expect((await api.pedir('GET', `/auth/primeiro-acesso/${token}`)).corpo.situacao).toBe('INEXISTENTE')

    expect((await api.pedir('POST', `/auth/primeiro-acesso/${novo.corpo.token}`, { corpo: { senha: 'senha-da-patricia' } })).status).toBe(200)
    const daMae = await api.entrar('patricia@teste.example', 'senha-da-patricia')
    expect((await api.pedir('GET', '/auth/sessao', { cookie: daMae })).corpo.perfilAtivo).toBe('RESPONSAVEL')
  })

  it('depois de a pessoa definir a senha, a clinica nao gera link: quem autoriza a escola nao perde a conta para a equipe', async () => {
    const ficha = await api.pedir('GET', `/pacientes/${p1}`, { cookie: c.ana })
    const mae = ficha.corpo.redeApoio[0]
    expect(mae.primeiroAcessoPendente).toBe(false)
    expect((await api.pedir('POST', `/pacientes/${p1}/responsaveis/${mae.responsavelId}/acesso-inicial`, { cookie: c.ana })).status).toBe(409)
  })

  it('a mesma pessoa num segundo filho: a conta e reaproveitada, sem link, e a autoridade legal e do vinculo', async () => {
    const r = await cadastrar(p2, { ...MAE, parentesco: 'Madrasta', responsavelLegal: false })
    expect(r.status).toBe(201)
    expect(r.corpo.primeiroAcesso).toBeNull()
    expect(r.corpo.responsavel).toMatchObject({ parentesco: 'Madrasta', responsavelLegal: false })
    expect(await prisma.usuario.count({ where: { email: 'patricia@teste.example' } })).toBe(1)
  })

  it('recusa a mesma pessoa duas vezes no mesmo paciente, e-mail de conta da equipe e dado faltando', async () => {
    expect((await cadastrar(p1, MAE)).status).toBe(409)
    expect((await cadastrar(p1, { ...MAE, email: 'BIA@teste.example' })).status).toBe(409)
    const vazio = await cadastrar(p1, {})
    expect(Object.keys(vazio.corpo.campos).sort()).toEqual(['email', 'nome', 'parentesco', 'responsavelLegal', 'telefone'])
  })

  it('terapeuta de fora nao cadastra responsavel, e a negativa fica registrada com o paciente', async () => {
    expect((await api.pedir('POST', `/pacientes/${p1}/responsaveis`, { cookie: c.bia, corpo: { ...MAE, email: 'x@teste.example' } })).status).toBe(403)
    expect(await ultimaDe({ pacienteId: p1, acao: 'ACESSO_NEGADO' })).toMatchObject({ usuarioId: u.bia, entidade: 'VinculoFamiliar' })
  })
})

describe('plano, validacao e regra 4 (lacuna 3)', () => {
  let p1: string
  let planoId: string

  beforeAll(async () => { p1 = await novoPaciente(c.ana, 'Heitor Ficticio', u.ana) })

  it('paciente sem plano: 404; o plano nasce em RASCUNHO, com datas validas, e uma vez so', async () => {
    expect((await api.pedir('GET', `/pacientes/${p1}/plano`, { cookie: c.ana })).status).toBe(404)
    const invalido = await api.pedir('POST', `/pacientes/${p1}/plano`, { cookie: c.ana, corpo: { dataInicio: '2026-10-16', dataRevisao: '2026-10-01' } })
    expect(invalido.corpo.campos.dataRevisao).toMatch(/depois do início/)
    const r = await api.pedir('POST', `/pacientes/${p1}/plano`, { cookie: c.ana, corpo: { dataInicio: '2026-10-16', dataRevisao: '2027-04-16' } })
    expect(r.status).toBe(201)
    expect(r.corpo).toMatchObject({ status: 'RASCUNHO', autorId: u.ana, dataInicio: '2026-10-16', dataRevisao: '2027-04-16', objetivos: [] })
    planoId = r.corpo.id
    expect((await api.pedir('POST', `/pacientes/${p1}/plano`, { cookie: c.ana, corpo: { dataInicio: '2026-10-16', dataRevisao: '2027-04-16' } })).status).toBe(409)
    expect((await api.pedir('GET', `/pacientes/${p1}`, { cookie: c.ana })).corpo.situacaoPlano).toBe('RASCUNHO')
  })

  it('regra 4: objetivo sem redacao acessivel e recusado; a escrita e gravada como veio, sem nada gerado', async () => {
    const sem = await api.pedir('POST', `/planos/${planoId}/objetivos`, { cookie: c.ana, corpo: { ...OBJETIVO, descricaoAcessivel: '   ' } })
    expect(sem.status).toBe(422)
    expect(sem.corpo.campos.descricaoAcessivel).toBeTruthy()
    const r = await api.pedir('POST', `/planos/${planoId}/objetivos`, { cookie: c.ana, corpo: OBJETIVO })
    expect(r.status).toBe(201)
    expect(r.corpo).toMatchObject({ descricaoAcessivel: 'Pedir o que quer, apontando ou falando.', status: 'NAO_INICIADO', percentualAtual: 0 })
    // Rota pelo plano: a trilha tem o paciente mesmo assim.
    expect(await ultimaDe({ idEntidade: r.corpo.id })).toMatchObject({ acao: 'CRIACAO', entidade: 'Objetivo', pacienteId: p1 })
  })

  it('envio, fila da coordenacao com a data da trilha, e aprovacao por quem nao escreveu', async () => {
    expect((await api.pedir('POST', `/planos/${planoId}/envio`, { cookie: c.ana })).corpo.status).toBe('AGUARDANDO_VALIDACAO')
    expect((await api.pedir('GET', '/planos/aguardando-validacao', { cookie: c.ana })).status).toBe(403)
    const fila = await api.pedir('GET', '/planos/aguardando-validacao', { cookie: c.duda })
    const item = fila.corpo.itens.find((p: { planoId: string }) => p.planoId === planoId)
    const envio = await ultimaDe({ idEntidade: planoId, detalhe: 'Enviado para validação.' })
    expect(item).toMatchObject({ paciente: { id: p1 }, autor: { id: u.ana }, totalObjetivos: 1, enviadoEm: envio!.ocorridoEm.toISOString() })
    expect((await api.pedir('POST', `/planos/${planoId}/devolucao`, { cookie: c.duda, corpo: { observacao: ' ' } })).status).toBe(422)
    const aprovado = await api.pedir('POST', `/planos/${planoId}/aprovacao`, { cookie: c.duda })
    expect(aprovado.corpo).toMatchObject({ status: 'VIGENTE', observacaoValidacao: null })
    expect(aprovado.corpo.ultimaRevisaoEm).not.toBeNull()
  })

  it('quem escreveu o plano nao o valida, nem sendo coordenador', async () => {
    const p2 = await novoPaciente(c.caio, 'Laura Ficticia', u.caio)
    await api.pedir('POST', '/auth/perfil', { cookie: c.caio, corpo: { perfil: 'COORDENADOR' } })
    const plano = await api.pedir('POST', `/pacientes/${p2}/plano`, { cookie: c.caio, corpo: { dataInicio: '2026-10-16', dataRevisao: '2027-01-16' } })
    await api.pedir('POST', `/planos/${plano.corpo.id}/objetivos`, { cookie: c.caio, corpo: OBJETIVO })
    await api.pedir('POST', `/planos/${plano.corpo.id}/envio`, { cookie: c.caio })
    const proprio = await api.pedir('POST', `/planos/${plano.corpo.id}/aprovacao`, { cookie: c.caio })
    expect(proprio.status).toBe(409)
    expect(proprio.corpo.mensagem).toMatch(/Você escreveu este plano/)
    const devolvido = await api.pedir('POST', `/planos/${plano.corpo.id}/devolucao`, { cookie: c.duda, corpo: { observacao: 'Falta o critério do segundo objetivo.' } })
    expect(devolvido.corpo).toMatchObject({ status: 'DEVOLVIDO', observacaoValidacao: 'Falta o critério do segundo objetivo.' })
  })
})

describe('cartao de estrategias (lacuna 5) e regra 4', () => {
  let p1: string
  let objetivoId: string

  beforeAll(async () => {
    p1 = await novoPaciente(c.ana, 'Noah Ficticio', u.ana)
    const plano = await api.pedir('POST', `/pacientes/${p1}/plano`, { cookie: c.ana, corpo: { dataInicio: '2026-10-16', dataRevisao: '2027-04-16' } })
    objetivoId = (await api.pedir('POST', `/planos/${plano.corpo.id}/objetivos`, { cookie: c.ana, corpo: OBJETIVO })).corpo.id
  })

  it('cartao em branco nao existe: os quatro campos sao exigidos', async () => {
    const r = await api.pedir('POST', `/objetivos/${objetivoId}/cartoes`, { cookie: c.ana, corpo: { tituloSimples: '', oQueFazer: ['  '], oQueEvitar: [], sinalAlerta: '' } })
    expect(r.status).toBe(422)
    expect(Object.keys(r.corpo.campos).sort()).toEqual(['oQueEvitar', 'oQueFazer', 'sinalAlerta', 'tituloSimples'])
    expect(await prisma.cartaoEstrategia.count({ where: { objetivoId } })).toBe(0)
  })

  it('cria com o que o terapeuta escreveu — nada vem do objetivo —, lista e edita; tudo na trilha', async () => {
    const r = await api.pedir('POST', `/objetivos/${objetivoId}/cartoes`, { cookie: c.ana, corpo: CARTAO })
    expect(r.status).toBe(201)
    expect(r.corpo).toMatchObject({
      tituloSimples: 'Pedir ajuda', oQueFazer: ['Mostrar a figura do que ele quer', 'Esperar a resposta'],
      oQueEvitar: ['Falar várias coisas de uma vez'], sinalAlerta: 'Tapa os ouvidos e se afasta.',
    })
    expect(JSON.stringify(r.corpo)).not.toContain(OBJETIVO.descricaoAcessivel.trim())
    const lista = await api.pedir('GET', `/objetivos/${objetivoId}/cartoes`, { cookie: c.ana })
    expect(lista.corpo).toHaveLength(1)
    const editado = await api.pedir('PUT', `/cartoes/${r.corpo.id}`, { cookie: c.ana, corpo: { ...CARTAO, oQueFazer: ['Mostrar a figura'] } })
    expect(editado.corpo.oQueFazer).toEqual(['Mostrar a figura'])
    const registros = await trilha({ entidade: 'CartaoEstrategia', pacienteId: p1 })
    expect(registros.map((x) => x.acao)).toEqual(['CRIACAO', 'LEITURA_AUTORIZADA', 'ALTERACAO'])
  })

  it('de fora da equipe, ou da escola, nao se le nem se escreve o cartao pela clinica; a negativa leva o paciente', async () => {
    expect((await api.pedir('GET', `/objetivos/${objetivoId}/cartoes`, { cookie: c.bia })).status).toBe(403)
    expect(await ultimaDe({ acao: 'ACESSO_NEGADO', usuarioId: u.bia, entidade: 'CartaoEstrategia' })).toMatchObject({ pacienteId: p1 })
    expect((await api.pedir('POST', `/objetivos/${objetivoId}/cartoes`, { cookie: c.prof, corpo: CARTAO })).status).toBe(403)
  })
})

describe('sessao, registro e dominio', () => {
  let p1: string
  let planoId: string
  let objetivoId: string
  let outroObjetivo: string

  beforeAll(async () => {
    p1 = await novoPaciente(c.ana, 'Enzo Ficticio', u.ana)
    const plano = await api.pedir('POST', `/pacientes/${p1}/plano`, { cookie: c.ana, corpo: { dataInicio: '2026-10-16', dataRevisao: '2027-04-16' } })
    planoId = plano.corpo.id
    objetivoId = (await api.pedir('POST', `/planos/${plano.corpo.id}/objetivos`, { cookie: c.ana, corpo: OBJETIVO })).corpo.id
    const p2 = await novoPaciente(c.ana, 'Outro Ficticio', u.ana)
    const plano2 = await api.pedir('POST', `/pacientes/${p2}/plano`, { cookie: c.ana, corpo: { dataInicio: '2026-10-16', dataRevisao: '2027-04-16' } })
    outroObjetivo = (await api.pedir('POST', `/planos/${plano2.corpo.id}/objetivos`, { cookie: c.ana, corpo: OBJETIVO })).corpo.id
  })

  const sessaoCom = async (resultados: string[]) => {
    const s = await api.pedir('POST', '/sessoes', { cookie: c.ana, corpo: { pacienteId: p1 } })
    for (const resultado of resultados) {
      expect((await api.pedir('POST', `/sessoes/${s.corpo.id}/registros`, { cookie: c.ana, corpo: { objetivoId, resultado } })).status).toBe(201)
    }
    return s.corpo.id as string
  }

  it('a sessao nasce sincronizada; so quem conduz registra; objetivo de outro paciente e resultado inventado sao recusados', async () => {
    const s = await api.pedir('POST', '/sessoes', { cookie: c.ana, corpo: { pacienteId: p1 } })
    expect(s.corpo).toMatchObject({ numero: 1, situacao: 'EM_ANDAMENTO', statusSync: 'SINCRONIZADO', profissionalId: u.ana })
    const id = s.corpo.id

    const coord = await api.pedir('POST', `/sessoes/${id}/registros`, { cookie: c.duda, corpo: { objetivoId, resultado: 'INDEPENDENTE' } })
    expect(coord.status).toBe(403)
    expect(await ultimaDe({ acao: 'ACESSO_NEGADO', usuarioId: u.duda })).toMatchObject({ pacienteId: p1, detalhe: 'Registro em sessão conduzida por outro profissional.' })

    expect((await api.pedir('POST', `/sessoes/${id}/registros`, { cookie: c.ana, corpo: { objetivoId: outroObjetivo, resultado: 'INDEPENDENTE' } })).status).toBe(422)
    expect((await api.pedir('POST', `/sessoes/${id}/registros`, { cookie: c.ana, corpo: { objetivoId, resultado: 'MAIS_OU_MENOS' } })).status).toBe(422)

    for (const resultado of ['INDEPENDENTE', 'AJUDA_FISICA']) {
      await api.pedir('POST', `/sessoes/${id}/registros`, { cookie: c.ana, corpo: { objetivoId, resultado } })
    }
    const desfeita = await api.pedir('DELETE', `/sessoes/${id}/registros/ultimo`, { cookie: c.ana })
    expect(desfeita.corpo.registros.map((r: { resultado: string }) => r.resultado)).toEqual(['INDEPENDENTE'])
    expect((await api.pedir('POST', `/sessoes/${id}/pausa`, { cookie: c.ana })).corpo.situacao).toBe('PAUSADA')
    expect((await api.pedir('POST', `/sessoes/${id}/registros`, { cookie: c.ana, corpo: { objetivoId, resultado: 'INDEPENDENTE' } })).status).toBe(409)
    expect((await api.pedir('POST', `/sessoes/${id}/encerramento`, { cookie: c.ana, corpo: { evolucao: 'Evolução de teste.' } })).corpo.situacao).toBe('ENCERRADA')

    // Cada tentativa gravada e uma escrita de dado do paciente: as duas na trilha.
    // A recusada, na sessao pausada, nao gravou nada.
    expect((await trilha({ pacienteId: p1, entidade: 'RegistroAtividade', acao: 'CRIACAO' })).length).toBe(2)
  })

  it('encerrar atualiza o medidor do objetivo, e a primeira sessao tira o objetivo de "nao iniciado"', async () => {
    await api.pedir('POST', `/sessoes/${await sessaoCom(['INDEPENDENTE', 'AJUDA_GESTUAL', 'INDEPENDENTE', 'INDEPENDENTE'])}/encerramento`, { cookie: c.ana, corpo: { evolucao: 'Evolução de teste.' } })
    const plano = await api.pedir('GET', `/pacientes/${p1}/plano`, { cookie: c.ana })
    expect(plano.corpo.objetivos[0]).toMatchObject({ percentualAtual: 75, status: 'EM_AQUISICAO' })
  })

  it('dominio so com o criterio atingido nas sessoes encerradas; uma vez so', async () => {
    // Desde o item 16, o dominio so se confirma no plano vigente.
    expect((await api.pedir('POST', `/objetivos/${objetivoId}/dominio`, { cookie: c.ana })).corpo.mensagem).toBe('O domínio se confirma no plano vigente.')
    await api.pedir('POST', `/planos/${planoId}/envio`, { cookie: c.ana })
    expect((await api.pedir('POST', `/planos/${planoId}/aprovacao`, { cookie: c.duda })).corpo.status).toBe('VIGENTE')
    const antes = await api.pedir('POST', `/objetivos/${objetivoId}/dominio`, { cookie: c.ana })
    expect(antes.status).toBe(409)
    expect(antes.corpo.mensagem).toMatch(/^O critério ainda não foi atingido/)
    for (let i = 0; i < 2; i++) {
      await api.pedir('POST', `/sessoes/${await sessaoCom(['INDEPENDENTE', 'INDEPENDENTE', 'INDEPENDENTE', 'INDEPENDENTE', 'AJUDA_GESTUAL'])}/encerramento`, { cookie: c.ana, corpo: { evolucao: 'Evolução de teste.' } })
    }
    const r = await api.pedir('POST', `/objetivos/${objetivoId}/dominio`, { cookie: c.ana })
    expect(r.status).toBe(200)
    expect(r.corpo.status).toBe('DOMINADO')
    expect(r.corpo.dominadoEm).not.toBeNull()
    expect(await ultimaDe({ idEntidade: objetivoId, detalhe: 'Domínio confirmado.' })).toMatchObject({ pacienteId: p1, usuarioId: u.ana })
    expect((await api.pedir('POST', `/objetivos/${objetivoId}/dominio`, { cookie: c.ana })).status).toBe(409)
  })

  it('historico e leitura da sessao: so quem alcanca, e registrados', async () => {
    const historico = await api.pedir('GET', `/pacientes/${p1}/sessoes`, { cookie: c.ana })
    expect(historico.corpo.itens.map((s: { numero: number }) => s.numero)).toEqual([4, 3, 2, 1])
    const umaSessao = historico.corpo.itens[0].id
    expect((await api.pedir('GET', `/sessoes/${umaSessao}`, { cookie: c.bia })).status).toBe(403)
    expect((await api.pedir('GET', `/sessoes/${umaSessao}`, { cookie: c.ana })).status).toBe(200)
    expect(await ultimaDe({ idEntidade: umaSessao, acao: 'LEITURA_AUTORIZADA' })).toMatchObject({ pacienteId: p1, entidade: 'Sessao' })
  })
})
