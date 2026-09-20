import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { ErroServico } from '../tipos'
import { servicosMock as s } from '.'

/**
 * As regras inviolaveis do CLAUDE.md verificadas na camada de dados, e nao
 * na tela. Os testes compartilham o mesmo estado simulado e rodam em ordem.
 */

beforeAll(() => { vi.useFakeTimers() })
afterAll(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

/** Avanca a latencia simulada e devolve o resultado (ou lanca o erro). */
async function chamar<T>(promessa: Promise<T>): Promise<T> {
  const capturada = promessa.then((valor) => ({ valor }), (erro: unknown) => ({ erro }))
  await vi.advanceTimersByTimeAsync(700)
  const r = await capturada
  if ('erro' in r) throw r.erro
  return r.valor
}

async function erroDe(promessa: Promise<unknown>): Promise<ErroServico> {
  try {
    await chamar(promessa)
  } catch (e) {
    if (e instanceof ErroServico) return e
    throw e
  }
  throw new Error('Esperava ErroServico, mas a chamada foi bem-sucedida.')
}

const entrarComo = (perfil: 'TERAPEUTA' | 'COORDENADOR' | 'RESPONSAVEL' | 'PROFESSOR') =>
  chamar(s.autenticacao.entrarDemonstracao(perfil))

async function ultimaAuditoria() {
  const perfilAnterior = (await chamar(s.autenticacao.sessaoAtual()))?.perfilAtivo
  await entrarComo('COORDENADOR')
  const pagina = await chamar(s.auditoria.listar({ porPagina: 1 }))
  if (perfilAnterior && perfilAnterior !== 'ADMINISTRADOR') await entrarComo(perfilAnterior)
  return pagina.itens[0]
}

describe('camada simulada', () => {
  it('toda chamada leva ao menos 200 ms', async () => {
    let resolvida = false
    const p = s.autenticacao.sessaoAtual().then(() => { resolvida = true })
    await vi.advanceTimersByTimeAsync(199)
    expect(resolvida).toBe(false)
    await vi.advanceTimersByTimeAsync(401)
    await p
    expect(resolvida).toBe(true)
  })

  it('VITE_MOCK_FALHA=1 faz toda chamada falhar como indisponivel', async () => {
    vi.stubEnv('VITE_MOCK_FALHA', '1')
    expect((await erroDe(s.autenticacao.sessaoAtual())).codigo).toBe('INDISPONIVEL')
    vi.unstubAllEnvs()
  })

  it('sem sessao, nenhuma leitura clinica', async () => {
    await chamar(s.autenticacao.sair())
    expect((await erroDe(s.pacientes.listar())).codigo).toBe('NAO_AUTENTICADO')
  })

  it('listagem paginada e alcance por perfil', async () => {
    await entrarComo('TERAPEUTA')
    const doTerapeuta = await chamar(s.pacientes.listar())
    expect(doTerapeuta.total).toBe(3)

    await entrarComo('COORDENADOR')
    const pagina = await chamar(s.pacientes.listar({ porPagina: 2, pagina: 3 }))
    expect(pagina).toMatchObject({ total: 5, pagina: 3, porPagina: 2 })
    expect(pagina.itens).toHaveLength(1)
  })

  it('a busca ignora acentos', async () => {
    await entrarComo('COORDENADOR')
    expect((await chamar(s.pacientes.listar({ busca: 'brandao' }))).itens.map((p) => p.nome)).toEqual(['Heitor Brandão'])
  })
})

describe('regra 1 — quem autoriza a escola e o responsavel', () => {
  it('professor nao concede consentimento', async () => {
    await entrarComo('PROFESSOR')
    const erro = await erroDe(s.consentimentos.conceder({
      pacienteId: 'p-001', escopos: ['CARTAO_ESTRATEGIA'], validadeAte: '2099-01-01T00:00:00Z',
    }))
    expect(erro.codigo).toBe('ACESSO_NEGADO')
  })

  it('terapeuta tambem nao concede', async () => {
    await entrarComo('TERAPEUTA')
    const erro = await erroDe(s.consentimentos.conceder({
      pacienteId: 'p-001', escopos: ['CARTAO_ESTRATEGIA'], validadeAte: '2099-01-01T00:00:00Z',
    }))
    expect(erro.codigo).toBe('ACESSO_NEGADO')
  })

  it('responsavel concede e recebe convite de uso unico com 72 horas', async () => {
    await entrarComo('RESPONSAVEL')
    const concedido = await chamar(s.consentimentos.conceder({
      pacienteId: 'p-002', escopos: ['CARTAO_ESTRATEGIA'], validadeAte: '2099-01-01T00:00:00Z',
    }))
    const horas = (Date.parse(concedido.conviteExpiraEm) - Date.parse(concedido.consentimento.concedidoEm)) / 3_600_000
    expect(horas).toBe(72)
    expect((await chamar(s.convites.obter(concedido.tokenConvite))).situacao).toBe('VALIDO')
  })

  it('consentimento gera convite, e so o convite aceito gera vinculo', async () => {
    await entrarComo('RESPONSAVEL')
    const concedido = await chamar(s.consentimentos.conceder({
      pacienteId: 'p-001', escopos: ['CARTAO_ESTRATEGIA'], validadeAte: '2099-01-01T00:00:00Z',
    }))
    // Enquanto o professor nao aceita, nao ha vinculo: nem escola, nem turma.
    expect(concedido.consentimento).toMatchObject({ vinculoId: null, escola: null, turma: null, conviteAceito: false })

    await chamar(s.convites.aceitar(concedido.tokenConvite, {
      nome: 'Professor Novo', email: 'novo@escola.example', senha: '12345678',
      escolaId: 'esc-2', turma: '5º ano A', turno: 'Vespertino', atuacao: 'AEE',
    }))
    // O vinculo nasce do aceite, com a escola declarada pelo professor.
    const aluno = (await chamar(s.areaEscola.listarAlunos())).itens.find((a) => a.pacienteId === 'p-001')
    expect(aluno).toMatchObject({ turma: '5º ano A', turno: 'Vespertino', situacao: 'VIGENTE' })
  })

  it('cartao iniciado em branco nao vai para a escola', async () => {
    await entrarComo('TERAPEUTA')
    const cartao = await chamar(s.planos.iniciarCartao('o-001'))
    // iniciarDe() nao deriva texto do objetivo: nasce vazio.
    expect(cartao).toMatchObject({ tituloSimples: '', oQueFazer: [], oQueEvitar: [], sinalAlerta: '' })

    await chamar(s.autenticacao.sair())
    await chamar(s.autenticacao.entrar('novo@escola.example', 'demonstracao'))
    const visivel = await chamar(s.areaEscola.obterCartao('p-001'))
    expect(visivel.estrategias.every((e) => e.oQueFazer.length > 0 || e.sinalAlerta !== '')).toBe(true)
  })

  it('os quatro estados do convite', async () => {
    expect((await chamar(s.convites.obter('demo-convite-usado'))).situacao).toBe('USADO')
    expect((await chamar(s.convites.obter('demo-convite-expirado'))).situacao).toBe('EXPIRADO')
    expect((await chamar(s.convites.obter('demo-convite-revogado'))).situacao).toBe('CONSENTIMENTO_REVOGADO')
    const valido = await chamar(s.convites.obter('demo-convite-valido'))
    expect(valido.situacao).toBe('VALIDO')

    await chamar(s.convites.aceitar('demo-convite-valido', { nome: 'Professora Teste', email: 'teste@escola.example', senha: '12345678', escolaId: 'esc-1', turma: '2º ano A', turno: 'Matutino', atuacao: 'Regente' }))
    expect((await chamar(s.convites.obter('demo-convite-valido'))).situacao).toBe('USADO')
    expect((await erroDe(s.convites.aceitar('demo-convite-valido', { nome: 'Outra', email: 'outra@escola.example', senha: '12345678', escolaId: 'esc-1', turma: '2º ano A', turno: 'Matutino', atuacao: 'Regente' }))).codigo).toBe('CONFLITO')
  })
})

describe('regras 2 e 3 — escola so le o cartao, com consentimento', () => {
  it('le o cartao com consentimento vigente, e a leitura e auditada', async () => {
    await entrarComo('PROFESSOR')
    const cartao = await chamar(s.areaEscola.obterCartao('p-001'))
    expect(cartao.nome).toBe('Miguel')
    expect(cartao.estrategias.length).toBeGreaterThan(0)
    expect(await ultimaAuditoria()).toMatchObject({ acao: 'LEITURA_AUTORIZADA', entidade: 'CartaoEstrategia', pacienteId: 'p-001' })
  })

  it('o cartao nao carrega nenhum campo clinico', async () => {
    await entrarComo('PROFESSOR')
    const texto = JSON.stringify(await chamar(s.areaEscola.obterCartao('p-001')))
    for (const proibido of ['descricaoTecnica', 'dominio', 'nivelSuporte', 'percentual', 'registros', 'criterio', 'dataNascimento', 'Santana']) {
      expect(texto).not.toContain(proibido)
    }
  })

  it('professor nao alcanca nenhum servico clinico, e a tentativa e auditada', async () => {
    await entrarComo('PROFESSOR')
    expect((await erroDe(s.pacientes.obter('p-001'))).codigo).toBe('ACESSO_NEGADO')
    expect((await erroDe(s.planos.obterPorPaciente('p-001'))).codigo).toBe('ACESSO_NEGADO')
    expect((await erroDe(s.sessoes.listarPorPaciente('p-001'))).codigo).toBe('ACESSO_NEGADO')
    expect(await ultimaAuditoria()).toMatchObject({ acao: 'ACESSO_NEGADO', perfil: 'PROFESSOR', pacienteId: 'p-001' })
  })

  it('escopo so de cartao nao permite registrar ocorrencia', async () => {
    await chamar(s.autenticacao.sair())
    // Tiago tem apenas CARTAO_ESTRATEGIA para Davi; entra pelo e-mail com a senha de demonstracao.
    await chamar(s.autenticacao.entrar('tiago.rezende@escola.example', 'demonstracao'))
    const erro = await erroDe(s.areaEscola.registrarOcorrencia('p-003', { tipo: 'Chorou', intensidade: 2, contexto: 'Recreio' }))
    expect(erro.codigo).toBe('ACESSO_NEGADO')
    expect(erro.campos.motivo).toBe('FORA_DO_ESCOPO')
  })

  it('a familia recebe so a redacao acessivel', async () => {
    await entrarComo('RESPONSAVEL')
    const texto = JSON.stringify(await chamar(s.familia.listarObjetivos('p-001')))
    expect(texto).toContain('descricaoAcessivel')
    expect(texto).not.toContain('descricaoTecnica')
    expect(texto).not.toContain('dominio')
  })
})

describe('regra 4 — duas redacoes, a acessivel escrita pelo terapeuta', () => {
  it('objetivo sem descricao acessivel e recusado', async () => {
    await entrarComo('TERAPEUTA')
    const erro = await erroDe(s.planos.adicionarObjetivo('pl-001', {
      dominio: 'Comunicação', descricaoTecnica: 'Emitir tato', descricaoAcessivel: '',
      criterio: { percentualMinimo: 80, sessoesConsecutivas: 3 },
    }))
    expect(erro.codigo).toBe('VALIDACAO')
    expect(erro.campos.descricaoAcessivel).toBeTruthy()
  })

  it('a descricao acessivel e gravada como foi escrita', async () => {
    await entrarComo('TERAPEUTA')
    const objetivo = await chamar(s.planos.adicionarObjetivo('pl-001', {
      dominio: 'Comunicação', descricaoTecnica: 'Emitir tato de 10 itens', descricaoAcessivel: 'Dizer o nome das coisas que vê.',
      criterio: { percentualMinimo: 80, sessoesConsecutivas: 3 },
    }))
    expect(objetivo.descricaoAcessivel).toBe('Dizer o nome das coisas que vê.')
  })
})

describe('regra 5 — revogacao com efeito imediato', () => {
  it('a leitura seguinte a revogacao ja e negada e auditada', async () => {
    await entrarComo('PROFESSOR')
    await chamar(s.areaEscola.obterCartao('p-001'))

    await entrarComo('RESPONSAVEL')
    const revogado = await chamar(s.consentimentos.revogar('c-001'))
    expect(revogado.situacao).toBe('REVOGADO')

    await entrarComo('PROFESSOR')
    const erro = await erroDe(s.areaEscola.obterCartao('p-001'))
    expect(erro.codigo).toBe('ACESSO_NEGADO')
    expect(erro.campos.motivo).toBe('REVOGADO')
    expect(await ultimaAuditoria()).toMatchObject({ acao: 'ACESSO_NEGADO', entidade: 'CartaoEstrategia', pacienteId: 'p-001' })
    // Tela 22: a linha permanece, marcada, mas sem escopo nem caminho de entrada.
    const aluno = (await chamar(s.areaEscola.listarAlunos())).itens.find((a) => a.pacienteId === 'p-001')
    expect(aluno).toMatchObject({ situacao: 'REVOGADO', escopos: [] })
  })

  it('a lista de alunos nao mostra quem nunca concedeu, e a consulta e auditada', async () => {
    await entrarComo('PROFESSOR')
    const itens = (await chamar(s.areaEscola.listarAlunos())).itens
    // Carla so tem vinculo com Miguel (p-001) e Heitor (p-004).
    expect(itens.map((a) => a.pacienteId).sort()).toEqual(['p-001', 'p-004'])
    expect(await ultimaAuditoria()).toMatchObject({ acao: 'LEITURA_AUTORIZADA', entidade: 'VinculoEscolar' })
  })

  it('revogacao feita durante a latencia de uma leitura ja vale para ela', async () => {
    await chamar(s.autenticacao.sair())
    await chamar(s.autenticacao.entrar('tiago.rezende@escola.example', 'demonstracao'))
    const leitura = s.areaEscola.obterCartao('p-003').then(() => 'lida', (e: ErroServico) => e.codigo)
    // O responsavel de Davi revoga enquanto a leitura "trafega".
    const consentimento = (await import('./infra')).banco.consentimentos.find((c) => c.id === 'c-002')!
    consentimento.revogadoEm = new Date().toISOString()
    await vi.advanceTimersByTimeAsync(700)
    expect(await leitura).toBe('ACESSO_NEGADO')
  })
})

describe('regra 6 — auditoria imutavel', () => {
  it('o contrato de auditoria so tem leitura', () => {
    expect(Object.keys(s.auditoria)).toEqual(['listar'])
  })

  it('registros sao congelados', async () => {
    await entrarComo('COORDENADOR')
    const { banco } = await import('./infra')
    expect(banco.auditoria.every((r) => Object.isFrozen(r))).toBe(true)
  })

  it('registra concessao, leitura autorizada e tentativa negada', async () => {
    await entrarComo('COORDENADOR')
    const acoes = new Set((await chamar(s.auditoria.listar({ porPagina: 100 }))).itens.map((r) => r.acao))
    expect(acoes).toContain('CONCESSAO_ACESSO')
    expect(acoes).toContain('LEITURA_AUTORIZADA')
    expect(acoes).toContain('ACESSO_NEGADO')
  })
})

describe('outras regras de tela aplicadas no servico', () => {
  it('credencial invalida tem mensagem unica', async () => {
    const existe = await erroDe(s.autenticacao.entrar('ana.correia@clinica.example', 'errada'))
    const naoExiste = await erroDe(s.autenticacao.entrar('ninguem@clinica.example', 'errada'))
    expect(existe.message).toBe(naoExiste.message)
  })

  it('devolver plano exige observacao', async () => {
    await entrarComo('COORDENADOR')
    expect((await erroDe(s.planos.devolver('pl-002', ' '))).codigo).toBe('VALIDACAO')
  })

  it('administrador nao desativa a si mesmo', async () => {
    await entrarComo('COORDENADOR')
    await chamar(s.autenticacao.trocarPerfil('ADMINISTRADOR'))
    expect((await erroDe(s.usuarios.desativar('u-prof-3'))).codigo).toBe('CONFLITO')
  })

  it('atividade em casa sem objetivo do plano nao existe', async () => {
    await entrarComo('TERAPEUTA')
    const erro = await erroDe(s.atividades.prescrever({
      pacienteId: 'p-001', objetivoId: 'o-inexistente', titulo: 'Teste', descricao: '', passos: ['a'], dicas: '',
      frequenciaSemanal: 2, urlVideo: null,
    }))
    expect(erro.campos.objetivoId).toBeTruthy()
  })
})
