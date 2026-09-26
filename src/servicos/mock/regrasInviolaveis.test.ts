import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { ErroServico, type OcorrenciaComportamental, type Sessao } from '../tipos'
import { servicosMock as s } from '.'
import { banco, relogio } from './infra'
import { resumoSha256 } from '../../dominio/hash'

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
    const doTerapeuta = await chamar(s.pacientes.listar({ porPagina: 100 }))

    await entrarComo('COORDENADOR')
    const primeira = await chamar(s.pacientes.listar({ porPagina: 10 }))
    expect(primeira).toMatchObject({ total: 14, pagina: 1, porPagina: 10 })
    expect(primeira.itens).toHaveLength(10)

    // Segunda pagina de verdade: paginador que nunca passa da primeira nao foi testado.
    const segunda = await chamar(s.pacientes.listar({ porPagina: 10, pagina: 2 }))
    expect(segunda.itens).toHaveLength(4)
    const ids = [...primeira.itens, ...segunda.itens].map((p) => p.id)
    expect(new Set(ids).size).toBe(14)

    // O terapeuta ve so os pacientes que acompanha; o coordenador, todos.
    // O toBeLessThan sozinho passaria com lista vazia.
    expect(doTerapeuta.total).toBeGreaterThan(0)
    expect(doTerapeuta.total).toBeLessThan(primeira.total)
    expect(doTerapeuta.itens.every((p) => ids.includes(p.id))).toBe(true)
  })

  it('a ficha de paciente de outro profissional e negada ao terapeuta', async () => {
    await entrarComo('COORDENADOR')
    const todos = (await chamar(s.pacientes.listar({ porPagina: 100 }))).itens.map((p) => p.id)

    await entrarComo('TERAPEUTA')
    const meus = (await chamar(s.pacientes.listar({ porPagina: 100 }))).itens.map((p) => p.id)
    const deOutro = todos.find((id) => !meus.includes(id))!

    // O que o terapeuta acompanha, ele abre.
    expect((await chamar(s.pacientes.obter(meus[0]))).id).toBe(meus[0])
    // O que nao acompanha, nao: e a negativa fica na auditoria.
    expect((await erroDe(s.pacientes.obter(deOutro))).codigo).toBe('ACESSO_NEGADO')
    expect(await ultimaAuditoria()).toMatchObject({ acao: 'ACESSO_NEGADO', entidade: 'Paciente', pacienteId: deOutro })
  })

  it('filtro combinado com paginacao devolve pagina coerente', async () => {
    await entrarComo('COORDENADOR')
    const filtro = { nivelSuporte: 2 as const, porPagina: 2 }
    const primeira = await chamar(s.pacientes.listar(filtro))
    const segunda = await chamar(s.pacientes.listar({ ...filtro, pagina: 2 }))

    // O total e o do recorte filtrado, nao o da clinica inteira.
    const todos = await chamar(s.pacientes.listar({ porPagina: 100 }))
    expect(primeira.total).toBeLessThan(todos.total)
    expect(primeira.total).toBe(todos.itens.filter((p) => p.nivelSuporte === 2).length)
    expect(primeira.itens.every((p) => p.nivelSuporte === 2)).toBe(true)

    // A pagina 2 nao repete item da pagina 1.
    const ids = [...primeira.itens, ...segunda.itens].map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('cadastro sem nome ou com nivel fora de 1 a 3 e recusado no campo certo', async () => {
    await entrarComo('TERAPEUTA')
    const semNome = await erroDe(s.pacientes.criar({
      nome: '   ', dataNascimento: '2019-04-02', nivelSuporte: 2, profissionalResponsavelId: 'u-prof-1',
    }))
    expect(semNome.codigo).toBe('VALIDACAO')
    expect(semNome.campos.nome).toBeTruthy()

    const nivelInvalido = await erroDe(s.pacientes.criar({
      nome: 'Paciente Fictício', dataNascimento: '2019-04-02',
      nivelSuporte: 4 as unknown as 1 | 2 | 3, profissionalResponsavelId: 'u-prof-1',
    }))
    expect(nivelInvalido.codigo).toBe('VALIDACAO')
    expect(nivelInvalido.campos.nivelSuporte).toBeTruthy()
    expect(nivelInvalido.campos.nome).toBeUndefined()
  })

  it('os registros pendentes sao de quem conduziu, nao da clinica', async () => {
    await entrarComo('TERAPEUTA')
    const daAna = await chamar(s.sessoes.listarPendentesDeSincronizacao({ porPagina: 100 }))
    expect(daAna.total).toBeGreaterThan(0)
    expect(daAna.itens.every((x) => x.statusSync === 'PENDENTE' && x.profissionalId === 'u-prof-1')).toBe(true)

    // A coordenadora nao herda os registros pendentes da equipe.
    await entrarComo('COORDENADOR')
    const daJuliana = await chamar(s.sessoes.listarPendentesDeSincronizacao({ porPagina: 100 }))
    expect(daJuliana.itens.some((x) => x.profissionalId === 'u-prof-1')).toBe(false)
  })

  it('a agenda do dia so traz os atendimentos de quem esta logado', async () => {
    await entrarComo('TERAPEUTA')
    const hoje = new Date()
    const dia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
    const agenda = await chamar(s.sessoes.listarAgenda({ dia }))
    expect(agenda.total).toBeGreaterThan(0)
    expect(agenda.itens.every((i) => i.profissional.id === 'u-prof-1')).toBe(true)

    // Dia sem atendimento devolve pagina vazia, nao erro.
    const vazio = await chamar(s.sessoes.listarAgenda({ dia: '2020-01-01' }))
    expect(vazio).toMatchObject({ total: 0, itens: [] })
  })

  it('trocar de objetivo nao perde registro, e desfazer tira o ultimo da sessao', async () => {
    await entrarComo('TERAPEUTA')
    const sessao = await chamar(s.sessoes.iniciar('p-003'))
    // Sessao aberta agora nao foi a lugar nenhum: nasce pendente.
    expect(sessao.statusSync).toBe('PENDENTE')

    await chamar(s.sessoes.registrarAtividade(sessao.id, 'o-006', 'INDEPENDENTE'))
    await chamar(s.sessoes.registrarAtividade(sessao.id, 'o-006', 'AJUDA_GESTUAL'))
    await chamar(s.sessoes.registrarAtividade(sessao.id, 'o-007', 'SEM_RESPOSTA'))

    const contar = (sessao: { registros: { objetivoId: string }[] }, objetivoId: string) =>
      sessao.registros.filter((r) => r.objetivoId === objetivoId).length

    const cheia = await chamar(s.sessoes.obter(sessao.id))
    expect([contar(cheia, 'o-006'), contar(cheia, 'o-007')]).toEqual([2, 1])

    // Desfazer age sobre a sessao: sai o ultimo registro, que e do o-007.
    const depois = await chamar(s.sessoes.desfazerUltimoRegistro(sessao.id))
    expect([contar(depois, 'o-006'), contar(depois, 'o-007')]).toEqual([2, 0])

    await chamar(s.sessoes.encerrar(sessao.id))
  })

  it('confirmar dominio exige criterio atingido, e e o unico caminho para DOMINADO', async () => {
    await entrarComo('TERAPEUTA')
    const plano = await chamar(s.planos.obterPorPaciente('p-001'))

    // o-002 nao atingiu o criterio: recusa.
    const recusa = await erroDe(s.planos.confirmarDominio('o-002'))
    expect(recusa.codigo).toBe('CONFLITO')
    expect((await chamar(s.planos.obterPorPaciente('p-001'))).objetivos
      .find((o) => o.id === 'o-002')).toMatchObject({ status: 'EM_AQUISICAO', dominadoEm: null })

    // o-001 atingiu: promove, e os dois campos andam juntos.
    const promovido = await chamar(s.planos.confirmarDominio('o-001'))
    expect(promovido.status).toBe('DOMINADO')
    expect(promovido.dominadoEm).not.toBeNull()
    expect(await ultimaAuditoria()).toMatchObject({ acao: 'ALTERACAO', entidade: 'Objetivo', idEntidade: 'o-001' })

    // Promover de novo nao faz sentido.
    expect((await erroDe(s.planos.confirmarDominio('o-001'))).codigo).toBe('CONFLITO')

    // A invariante vale para todos os objetivos do plano.
    const depois = await chamar(s.planos.obterPorPaciente('p-001'))
    for (const o of [...plano.objetivos, ...depois.objetivos]) {
      expect(o.status === 'DOMINADO').toBe(o.dominadoEm !== null)
    }
  })

  it('a leitura clinica do evento da escola e registrada uma vez so', async () => {
    await entrarComo('TERAPEUTA')
    const daEscola = (await chamar(s.ocorrencias.listarPorPaciente('p-001', { origem: 'ESCOLA', porPagina: 100 }))).itens
    const preliminar = daEscola.find((o) => o.leituraClinicaEm === null)!
    const jaLida = daEscola.find((o) => o.leituraClinicaEm !== null)!

    const lida = await chamar(s.ocorrencias.registrarLeituraClinica(preliminar.id))
    expect(lida.leituraClinicaEm).not.toBeNull()
    expect(await ultimaAuditoria()).toMatchObject({
      acao: 'ALTERACAO', entidade: 'OcorrenciaComportamental', idEntidade: preliminar.id,
    })

    // Duas vezes, nao: a leitura ja aconteceu.
    expect((await erroDe(s.ocorrencias.registrarLeituraClinica(lida.id))).codigo).toBe('CONFLITO')
    expect((await erroDe(s.ocorrencias.registrarLeituraClinica(jaLida.id))).codigo).toBe('CONFLITO')
  })

  it('lido, o evento sai do painel e continua na ficha', async () => {
    await entrarComo('TERAPEUTA')
    const antes = await chamar(s.ocorrencias.listarAvisosDaEscola({ porPagina: 50 }))
    expect(antes.total).toBeGreaterThan(0)

    // O aviso aponta para o evento clinico, nao para o relato da escola: e por
    // isso que o id que ele carrega serve para registrar a leitura.
    const aviso = antes.itens[0]
    await chamar(s.ocorrencias.registrarLeituraClinica(aviso.ocorrenciaId))

    // Sai da fila do painel.
    const depois = await chamar(s.ocorrencias.listarAvisosDaEscola({ porPagina: 50 }))
    expect(depois.total).toBe(antes.total - 1)
    expect(depois.itens.map((i) => i.ocorrenciaId)).not.toContain(aviso.ocorrenciaId)

    // E continua na ficha, agora com a data da leitura — nao some da interface.
    const naFicha = await chamar(s.ocorrencias.listarPorPaciente(aviso.paciente.id, { porPagina: 100 }))
    const evento = naFicha.itens.find((o) => o.id === aviso.ocorrenciaId)
    expect(evento).toBeDefined()
    expect(evento?.leituraClinicaEm).not.toBeNull()
  })

  it('ocorrencia registrada na sessao ja nasce com leitura clinica', async () => {
    await entrarComo('TERAPEUTA')
    const sessao = await chamar(s.sessoes.iniciar('p-004'))
    const ocorrencia = await chamar(s.ocorrencias.registrarNaSessao(sessao.id, {
      antecedente: 'Fim do intervalo.', comportamento: 'Levantou da mesa.',
      consequencia: 'Retomou apos o aviso visual.', intensidade: 2,
    }))
    // Quem registrou e o profissional: nao ha o que ler depois.
    expect(ocorrencia.leituraClinicaEm).not.toBeNull()
    await chamar(s.sessoes.encerrar(sessao.id))
  })

  it('so quem alcanca o paciente confirma dominio ou registra leitura', async () => {
    await entrarComo('COORDENADOR')
    const daEscola = (await chamar(s.ocorrencias.listarPorPaciente('p-001', { origem: 'ESCOLA', porPagina: 100 }))).itens
    const preliminar = daEscola.find((o) => o.leituraClinicaEm === null)

    await entrarComo('PROFESSOR')
    expect((await erroDe(s.planos.confirmarDominio('o-002'))).codigo).toBe('ACESSO_NEGADO')
    if (preliminar) {
      expect((await erroDe(s.ocorrencias.registrarLeituraClinica(preliminar.id))).codigo).toBe('ACESSO_NEGADO')
    }
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
      pacienteId: 'p-001', escolaId: 'esc-1', escopos: ['CARTAO_ESTRATEGIA'], validadeAte: '2099-01-01T00:00:00Z',
    }))
    expect(erro.codigo).toBe('ACESSO_NEGADO')
  })

  it('terapeuta tambem nao concede', async () => {
    await entrarComo('TERAPEUTA')
    const erro = await erroDe(s.consentimentos.conceder({
      pacienteId: 'p-001', escolaId: 'esc-1', escopos: ['CARTAO_ESTRATEGIA'], validadeAte: '2099-01-01T00:00:00Z',
    }))
    expect(erro.codigo).toBe('ACESSO_NEGADO')
  })

  it('responsavel concede e recebe convite de uso unico com 72 horas', async () => {
    await entrarComo('RESPONSAVEL')
    const concedido = await chamar(s.consentimentos.conceder({
      pacienteId: 'p-002', escolaId: 'esc-2', escopos: ['CARTAO_ESTRATEGIA'], validadeAte: '2099-01-01T00:00:00Z',
    }))
    const horas = (Date.parse(concedido.conviteExpiraEm) - Date.parse(concedido.consentimento.concedidoEm)) / 3_600_000
    expect(horas).toBe(72)
    expect((await chamar(s.convites.obter(concedido.tokenConvite))).situacao).toBe('VALIDO')
  })

  it('consentimento gera convite, e so o convite aceito gera vinculo', async () => {
    await entrarComo('RESPONSAVEL')
    const concedido = await chamar(s.consentimentos.conceder({
      pacienteId: 'p-001', escolaId: 'esc-1', escopos: ['CARTAO_ESTRATEGIA'], validadeAte: '2099-01-01T00:00:00Z',
    }))
    // A escola e conhecida desde a concessao; vinculo e turma so depois do aceite.
    expect(concedido.consentimento).toMatchObject({
      escola: 'EMEF Jardim das Palmeiras', vinculoId: null, turma: null, conviteAceito: false,
    })

    await chamar(s.convites.aceitar(concedido.tokenConvite, {
      nome: 'Professor Novo', email: 'novo@escola.example', senha: '12345678',
      turma: '5º ano A', turno: 'Vespertino', atuacao: 'AEE',
    }))
    // O vinculo nasce do aceite; a escola continua sendo a que a familia nomeou.
    const aluno = (await chamar(s.areaEscola.listarAlunos())).itens.find((a) => a.pacienteId === 'p-001')
    expect(aluno).toMatchObject({
      turma: '5º ano A', turno: 'Vespertino', escola: 'EMEF Jardim das Palmeiras', situacao: 'VIGENTE',
    })
  })

  it('conceder sem escola e recusado: consentimento tem de ser especifico', async () => {
    await entrarComo('RESPONSAVEL')
    const erro = await erroDe(s.consentimentos.conceder({
      pacienteId: 'p-001', escolaId: '', escopos: ['CARTAO_ESTRATEGIA'], validadeAte: '2099-01-01T00:00:00Z',
    }))
    expect(erro.codigo).toBe('VALIDACAO')
    expect(erro.campos.escolaId).toBeTruthy()
  })

  it('o convite valido mostra a escola antes do aceite', async () => {
    const convite = await chamar(s.convites.obter('demo-convite-valido'))
    expect(convite).toMatchObject({ situacao: 'VALIDO', escola: 'EMEF Jardim das Palmeiras' })
  })

  it('reemitir convite derruba o token anterior', async () => {
    await entrarComo('RESPONSAVEL')
    const primeiro = await chamar(s.consentimentos.conceder({
      pacienteId: 'p-002', escolaId: 'esc-2', escopos: ['CARTAO_ESTRATEGIA'], validadeAte: '2099-01-01T00:00:00Z',
    }))
    expect((await chamar(s.convites.obter(primeiro.tokenConvite))).situacao).toBe('VALIDO')

    const segundo = await chamar(s.consentimentos.reemitirConvite(primeiro.consentimento.id))
    expect(segundo.tokenConvite).not.toBe(primeiro.tokenConvite)
    // Nunca dois tokens validos ao mesmo tempo.
    expect((await chamar(s.convites.obter(primeiro.tokenConvite))).situacao).toBe('EXPIRADO')
    expect((await chamar(s.convites.obter(segundo.tokenConvite))).situacao).toBe('VALIDO')
    expect(await ultimaAuditoria()).toMatchObject({ acao: 'CRIACAO', entidade: 'ConviteEscolar' })
  })

  it('reemitir convite de consentimento revogado e recusado', async () => {
    await entrarComo('RESPONSAVEL')
    const concedido = await chamar(s.consentimentos.conceder({
      pacienteId: 'p-002', escolaId: 'esc-1', escopos: ['CARTAO_ESTRATEGIA'], validadeAte: '2099-01-01T00:00:00Z',
    }))
    await chamar(s.consentimentos.revogar(concedido.consentimento.id))
    expect((await erroDe(s.consentimentos.reemitirConvite(concedido.consentimento.id))).codigo).toBe('CONFLITO')
  })

  it('a atuacao e de cada vinculo: aceitar o segundo convite nao altera o primeiro', async () => {
    const { banco } = await import('./infra')
    const antes = banco.vinculos.find((v) => v.professorId === 'u-profe-1' && v.pacienteId === 'p-001')!
    expect(antes.atuacao).toBe('Professora regente')

    await entrarComo('RESPONSAVEL')
    const concedido = await chamar(s.consentimentos.conceder({
      pacienteId: 'p-002', escolaId: 'esc-1', escopos: ['CARTAO_ESTRATEGIA'], validadeAte: '2099-01-01T00:00:00Z',
    }))
    await chamar(s.convites.aceitar(concedido.tokenConvite, {
      nome: 'Outra Professora', email: 'outra.professora@escola.example', senha: '12345678',
      turma: '1º ano A', turno: 'Matutino', atuacao: 'Atendimento educacional especializado',
    }))
    expect(antes.atuacao).toBe('Professora regente')
  })

  it('a concessao fica auditada com o nome da escola', async () => {
    await entrarComo('RESPONSAVEL')
    await chamar(s.consentimentos.conceder({
      pacienteId: 'p-001', escolaId: 'esc-2', escopos: ['CARTAO_ESTRATEGIA'], validadeAte: '2099-01-01T00:00:00Z',
    }))
    const registro = await ultimaAuditoria()
    expect(registro).toMatchObject({ acao: 'CONCESSAO_ACESSO', entidade: 'Consentimento' })
    expect(registro.detalhe).toContain('Escola Municipal Vitória-Régia')
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

    await chamar(s.convites.aceitar('demo-convite-valido', { nome: 'Professora Teste', email: 'teste@escola.example', senha: '12345678', turma: '2º ano A', turno: 'Matutino', atuacao: 'Regente' }))
    expect((await chamar(s.convites.obter('demo-convite-valido'))).situacao).toBe('USADO')
    expect((await erroDe(s.convites.aceitar('demo-convite-valido', { nome: 'Outra', email: 'outra@escola.example', senha: '12345678', turma: '2º ano A', turno: 'Matutino', atuacao: 'Regente' }))).codigo).toBe('CONFLITO')
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

  it('encerrar tira a atividade da familia e guarda o historico', async () => {
    await entrarComo('TERAPEUTA')
    const ativas = await chamar(s.atividades.listarPorPaciente('p-001', { ativa: true, porPagina: 50 }))
    const atividade = ativas.itens[0]
    const execucoesAntes = await chamar(s.atividades.listarExecucoes(atividade.id, { porPagina: 50 }))

    const encerrada = await chamar(s.atividades.encerrar(atividade.id))
    expect(encerrada.ativa).toBe(false)
    expect(await ultimaAuditoria()).toMatchObject({
      acao: 'ALTERACAO', entidade: 'AtividadeCasa', idEntidade: atividade.id,
    })

    // Sai da lista ativa, mas o que a familia registrou nao se apaga.
    const depois = await chamar(s.atividades.listarPorPaciente('p-001', { ativa: true, porPagina: 50 }))
    expect(depois.itens.map((a) => a.id)).not.toContain(atividade.id)
    const execucoesDepois = await chamar(s.atividades.listarExecucoes(atividade.id, { porPagina: 50 }))
    expect(execucoesDepois.total).toBe(execucoesAntes.total)

    // Encerrada, a familia nao registra mais — e encerrar de novo nao faz sentido.
    expect((await erroDe(s.atividades.encerrar(atividade.id))).codigo).toBe('CONFLITO')
    await entrarComo('RESPONSAVEL')
    expect((await erroDe(s.atividades.registrarExecucao(atividade.id, 'SOZINHO'))).codigo).toBe('CONFLITO')
  })

  it('so a clinica encerra a prescricao', async () => {
    await entrarComo('TERAPEUTA')
    const ativas = await chamar(s.atividades.listarPorPaciente('p-001', { ativa: true, porPagina: 50 }))
    const atividade = ativas.itens[0]
    await entrarComo('RESPONSAVEL')
    expect((await erroDe(s.atividades.encerrar(atividade.id))).codigo).toBe('ACESSO_NEGADO')
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


describe('painel da coordenacao — conta e aponta', () => {
  it('so o coordenador alcanca, e a tentativa negada fica auditada', async () => {
    for (const perfil of ['TERAPEUTA', 'RESPONSAVEL', 'PROFESSOR'] as const) {
      await entrarComo(perfil)
      expect((await erroDe(s.indicadores.resumo())).codigo).toBe('ACESSO_NEGADO')
      expect((await erroDe(s.indicadores.listarAlertas('PLANO_SEM_REVISAO'))).codigo).toBe('ACESSO_NEGADO')
      expect((await erroDe(s.indicadores.sessoesPorProfissional())).codigo).toBe('ACESSO_NEGADO')
      expect((await erroDe(s.indicadores.ponteEscola())).codigo).toBe('ACESSO_NEGADO')
      expect(await ultimaAuditoria()).toMatchObject({ acao: 'ACESSO_NEGADO', entidade: 'Indicadores' })
    }
  })

  it('nenhum numero sem rotulo de periodo, e a janela e movel', async () => {
    await entrarComo('COORDENADOR')
    const resumo = await chamar(s.indicadores.resumo())
    expect(resumo.temDados).toBe(true)
    for (const indicador of [
      resumo.pacientesEmAcompanhamento, resumo.sessoesUltimos7Dias,
      resumo.objetivosDominadosUltimos30Dias, resumo.planosComRevisaoProximos30Dias,
    ]) {
      expect(indicador.periodo).toMatch(/\d{2}\/\d{2}/)
      expect(indicador.valor).toBeGreaterThanOrEqual(0)
    }
    // Movel: o rotulo traz as duas pontas, nao "esta semana" nem "este mes".
    expect(resumo.sessoesUltimos7Dias.periodo).toMatch(/últimos 7 dias \(\d{2}\/\d{2} a \d{2}\/\d{2}\)/)
    expect(resumo.planosComRevisaoProximos30Dias.periodo).toMatch(/próximos 30 dias/)
  })

  it('o alerta aponta e nao descreve: so motivo, paciente, referencia e quantidade', async () => {
    await entrarComo('COORDENADOR')
    const pagina = await chamar(s.indicadores.listarAlertas('PLANO_SEM_REVISAO', { porPagina: 50 }))
    expect(pagina.total).toBeGreaterThan(0)
    for (const alerta of pagina.itens) {
      expect(Object.keys(alerta).sort())
        .toEqual(['motivo', 'paciente', 'quantidade', 'referenciaId', 'unidade'])
      expect(Object.keys(alerta.paciente).sort()).toEqual(['id', 'nome'])
    }
  })

  it('cada grupo vem do mais urgente para o menos', async () => {
    await entrarComo('COORDENADOR')
    // Espera ha mais tempo primeiro; quem nunca teve sessao vem antes de todos.
    for (const motivo of ['PLANO_SEM_REVISAO', 'PACIENTE_SEM_SESSAO', 'OBJETIVO_SEM_AVANCO'] as const) {
      const itens = (await chamar(s.indicadores.listarAlertas(motivo, { porPagina: 50 }))).itens
      const pesos = itens.map((a) => a.quantidade ?? Number.POSITIVE_INFINITY)
      expect(pesos).toEqual([...pesos].sort((x, y) => y - x))
    }
    // Consentimento e o contrario: o que vence antes aparece antes.
    const vencendo = (await chamar(s.indicadores.listarAlertas('CONSENTIMENTO_VENCENDO', { porPagina: 50 }))).itens
    const prazos = vencendo.map((a) => a.quantidade ?? 0)
    expect(prazos).toEqual([...prazos].sort((x, y) => x - y))
    expect(prazos.every((d) => d <= 30)).toBe(true)
  })

  it('os limiares sao os de dominio/regras, nao outros escritos no servico', async () => {
    await entrarComo('COORDENADOR')
    const planos = (await chamar(s.indicadores.listarAlertas('PLANO_SEM_REVISAO', { porPagina: 50 }))).itens
    expect(planos.every((a) => (a.quantidade ?? 0) > 90)).toBe(true)

    const semSessao = (await chamar(s.indicadores.listarAlertas('PACIENTE_SEM_SESSAO', { porPagina: 50 }))).itens
    expect(semSessao.every((a) => a.quantidade === null || a.quantidade > 15)).toBe(true)

    // Oito sessoes sem novo recorde, contadas em sessoes e nao em dias.
    const parados = (await chamar(s.indicadores.listarAlertas('OBJETIVO_SEM_AVANCO', { porPagina: 50 }))).itens
    expect(parados.length).toBeGreaterThan(0)
    for (const a of parados) {
      expect(a.unidade).toBe('sessoes')
      expect(a.quantidade ?? 0).toBeGreaterThanOrEqual(8)
    }
  })

  it('serie de grafico nao e paginada e traz a clinica inteira', async () => {
    await entrarComo('COORDENADOR')
    const serie = await chamar(s.indicadores.sessoesPorProfissional())
    expect(Object.keys(serie).sort()).toEqual(['itens', 'periodo'])
    const profissionais = await chamar(s.profissionais.listar({ porPagina: 50 }))
    expect(serie.itens).toHaveLength(profissionais.total)
    const sessoes = serie.itens.map((i) => i.sessoes)
    expect(sessoes).toEqual([...sessoes].sort((x, y) => y - x))
  })

  it('a ocorrencia sem leitura fica fora da mediana e aparece ao lado dela', async () => {
    await entrarComo('COORDENADOR')
    const antes = await chamar(s.indicadores.ponteEscola())
    expect(antes.aguardandoLeitura.quantidade).toBeGreaterThan(0)
    expect(antes.aguardandoLeitura.maisAntigaHaDias).not.toBeNull()
    expect(antes.tempoAteLeituraClinica.leituras).toBeGreaterThanOrEqual(3)
    expect(antes.tempoAteLeituraClinica.medianaHoras).not.toBeNull()

    const daEscola = (await chamar(s.ocorrencias.listarPorPaciente('p-001', { origem: 'ESCOLA', porPagina: 100 }))).itens
    const preliminar = daEscola.find((o) => o.leituraClinicaEm === null)!
    await chamar(s.ocorrencias.registrarLeituraClinica(preliminar.id))

    // A que era fila virou medida: as duas populacoes sao a mesma, separadas
    // pela leitura — por isso a mediana sozinha diria menos do que a verdade.
    const depois = await chamar(s.indicadores.ponteEscola())
    expect(depois.aguardandoLeitura.quantidade).toBe(antes.aguardandoLeitura.quantidade - 1)
    expect(depois.tempoAteLeituraClinica.leituras).toBe(antes.tempoAteLeituraClinica.leituras + 1)
  })

  it('o primeiro dia do rotulo entra na conta; o dia anterior, nao', async () => {
    await entrarComo('COORDENADOR')
    // Congela o relogio: a fronteira nao pode andar no meio da verificacao.
    const original = relogio.agora
    const agora = original()
    relogio.agora = () => agora

    /** Zero hora do primeiro dia que o rotulo da janela mostra. */
    const primeiroDia = (dias: number) => {
      const d = new Date(agora)
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - (dias - 1))
      return d
    }
    const dentro7 = primeiroDia(7)
    const fora7 = new Date(dentro7.getTime() - 1)
    const dentro30 = primeiroDia(30)
    const fora30 = new Date(dentro30.getTime() - 1)

    const sessao = (id: string, inicio: Date): Sessao => ({
      id, pacienteId: 'p-001', profissionalId: 'u-prof-1', numero: 900,
      inicioPrevistoEm: inicio.toISOString(), inicio: inicio.toISOString(),
      fim: inicio.toISOString(), local: 'Sala', situacao: 'ENCERRADA',
      statusSync: 'SINCRONIZADO', registros: [],
    })
    const ocorrencia = (id: string, ocorridaEm: Date): OcorrenciaComportamental => ({
      id, pacienteId: 'p-001', origem: 'ESCOLA', ocorridaEm: ocorridaEm.toISOString(),
      antecedente: '—', comportamento: '—', consequencia: '—', intensidade: 1,
      leituraClinicaEm: ocorridaEm.toISOString(), sessaoId: null, ocorrenciaEscolarId: null,
    })

    try {
      const antes = await chamar(s.indicadores.resumo())
      const ponteAntes = await chamar(s.indicadores.ponteEscola())

      // O rotulo promete as duas pontas; o filtro tem de cumprir a primeira.
      expect(antes.sessoesUltimos7Dias.periodo)
        .toContain(dentro7.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }))
      expect(ponteAntes.ocorrenciasUltimos30Dias.periodo)
        .toContain(dentro30.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }))

      banco.sessoes.push(sessao('s-fronteira-dentro', dentro7))
      banco.ocorrenciasComportamentais.push(ocorrencia('oc-fronteira-dentro', dentro30))
      const comDentro = await chamar(s.indicadores.resumo())
      const ponteComDentro = await chamar(s.indicadores.ponteEscola())
      expect(comDentro.sessoesUltimos7Dias.valor).toBe(antes.sessoesUltimos7Dias.valor + 1)
      expect(ponteComDentro.ocorrenciasUltimos30Dias.valor)
        .toBe(ponteAntes.ocorrenciasUltimos30Dias.valor + 1)

      // Um milissegundo antes da zero hora daquele dia ja e outro periodo.
      banco.sessoes.push(sessao('s-fronteira-fora', fora7))
      banco.ocorrenciasComportamentais.push(ocorrencia('oc-fronteira-fora', fora30))
      const comFora = await chamar(s.indicadores.resumo())
      const ponteComFora = await chamar(s.indicadores.ponteEscola())
      expect(comFora.sessoesUltimos7Dias.valor).toBe(comDentro.sessoesUltimos7Dias.valor)
      expect(ponteComFora.ocorrenciasUltimos30Dias.valor)
        .toBe(ponteComDentro.ocorrenciasUltimos30Dias.valor)
    } finally {
      relogio.agora = original
      banco.sessoes = banco.sessoes.filter((x) => !x.id.startsWith('s-fronteira'))
      banco.ocorrenciasComportamentais = banco.ocorrenciasComportamentais
        .filter((x) => !x.id.startsWith('oc-fronteira'))
    }
  })

  it('com menos de tres leituras no periodo, a mediana e nula', async () => {
    await entrarComo('COORDENADOR')
    const ponte = await chamar(s.indicadores.ponteEscola())
    if (ponte.tempoAteLeituraClinica.leituras < 3) {
      expect(ponte.tempoAteLeituraClinica.medianaHoras).toBeNull()
    } else {
      expect(ponte.tempoAteLeituraClinica.medianaHoras).toBeGreaterThan(0)
    }
    expect(ponte.escolasComVinculoAtivo.periodo).toMatch(/\d{2}\/\d{2}/)
  })
})


describe('relatorio de evolucao — documento clinico (UC09)', () => {
  const pedido = {
    periodoInicio: '2026-01-01',
    periodoFim: '2030-12-31',
    objetivoIds: ['o-001', 'o-002'],
    destinatario: 'PROFISSIONAIS' as const,
    consideracoes: 'Avanço consistente na comunicação funcional; a regulação sensorial segue exigindo apoio.',
  }

  it('a escola nunca alcanca o relatorio, e a tentativa fica auditada', async () => {
    await entrarComo('PROFESSOR')
    expect((await erroDe(s.relatorios.previsualizar('p-001', pedido))).codigo).toBe('ACESSO_NEGADO')
    expect((await erroDe(s.relatorios.emitir('p-001', pedido))).codigo).toBe('ACESSO_NEGADO')
    expect((await erroDe(s.relatorios.listarPorPaciente('p-001'))).codigo).toBe('ACESSO_NEGADO')
    expect(await ultimaAuditoria()).toMatchObject({
      acao: 'ACESSO_NEGADO', entidade: 'RelatorioEvolucao', pacienteId: 'p-001',
    })

    // A familia tambem nao: o relatorio e emitido PARA ela, nao POR ela.
    await entrarComo('RESPONSAVEL')
    expect((await erroDe(s.relatorios.emitir('p-001', pedido))).codigo).toBe('ACESSO_NEGADO')
  })

  it('sem consideracoes nao ha relatorio, e a previa nao as exige', async () => {
    await entrarComo('TERAPEUTA')
    // A previa monta o documento mesmo sem elas: e rascunho, nao emissao.
    const previa = await chamar(s.relatorios.previsualizar('p-001', { ...pedido, consideracoes: '' }))
    expect(previa.objetivos).toHaveLength(2)

    const erro = await erroDe(s.relatorios.emitir('p-001', { ...pedido, consideracoes: '   ' }))
    expect(erro.codigo).toBe('VALIDACAO')
    expect(erro.campos.consideracoes).toBe(
      'O relatório é a sua leitura clínica, não só os números. Escreva as suas considerações — elas não são geradas pelo sistema.',
    )
  })

  it('o destinatario decide qual das duas redacoes vai no documento', async () => {
    await entrarComo('TERAPEUTA')
    const plano = await chamar(s.planos.obterPorPaciente('p-001'))
    const objetivo = plano.objetivos.find((o) => o.id === 'o-001')!

    const paraEquipe = await chamar(s.relatorios.previsualizar('p-001', { ...pedido, objetivoIds: ['o-001'] }))
    const paraFamilia = await chamar(s.relatorios.previsualizar('p-001', {
      ...pedido, objetivoIds: ['o-001'], destinatario: 'FAMILIA',
    }))

    expect(paraEquipe.objetivos[0].redacao).toBe(objetivo.descricaoTecnica)
    expect(paraFamilia.objetivos[0].redacao).toBe(objetivo.descricaoAcessivel)
    expect(paraEquipe.objetivos[0].redacao).not.toBe(paraFamilia.objetivos[0].redacao)
  })

  it('emitir grava o conteudo com hash do proprio conteudo, e audita', async () => {
    await entrarComo('TERAPEUTA')
    const relatorio = await chamar(s.relatorios.emitir('p-001', pedido))

    expect(relatorio.autorNome).toBeTruthy()
    expect(relatorio.autorRegistro).toBeTruthy()
    // O hash e do conteudo emitido, nao um valor com cara de hash.
    expect(relatorio.hashConteudo).toBe(await resumoSha256(relatorio.conteudoEmitido))
    expect(await ultimaAuditoria()).toMatchObject({
      acao: 'CRIACAO', entidade: 'RelatorioEvolucao', idEntidade: relatorio.id, pacienteId: 'p-001',
    })

    // Abrir o emitido e leitura de dado sensivel.
    await entrarComo('TERAPEUTA')
    const aberto = await chamar(s.relatorios.obter(relatorio.id))
    expect(aberto.hashConteudo).toBe(relatorio.hashConteudo)
    expect(await ultimaAuditoria()).toMatchObject({
      acao: 'LEITURA_AUTORIZADA', entidade: 'RelatorioEvolucao', idEntidade: relatorio.id,
      pacienteId: 'p-001',
    })

    const lista = await chamar(s.relatorios.listarPorPaciente('p-001', { porPagina: 50 }))
    expect(lista.itens.map((r) => r.id)).toContain(relatorio.id)
  })

  it('o emitido nao se regenera: mudar o dado depois nao muda o documento', async () => {
    await entrarComo('TERAPEUTA')
    const relatorio = await chamar(s.relatorios.emitir('p-001', { ...pedido, objetivoIds: ['o-001'] }))
    const redacaoNaEmissao = relatorio.conteudoEmitido.objetivos[0].redacao

    // Mexe no banco direto porque e exatamente isto que o campo existe para
    // resistir: o dado de origem mudando depois que a copia ja saiu.
    const objetivo = banco.planos
      .flatMap((p) => p.objetivos)
      .find((o) => o.id === 'o-001')!
    const original = objetivo.descricaoTecnica
    objetivo.descricaoTecnica = 'Redacao trocada depois da emissao.'
    try {
      const aberto = await chamar(s.relatorios.obter(relatorio.id))
      expect(aberto.conteudoEmitido.objetivos[0].redacao).toBe(redacaoNaEmissao)
      expect(await resumoSha256(aberto.conteudoEmitido)).toBe(aberto.hashConteudo)

      // Gerar de novo hoje produziria outro documento — que e o motivo de o
      // relatorio ser classe, e nao uma consulta.
      const agora = await chamar(s.relatorios.previsualizar('p-001', { ...pedido, objetivoIds: ['o-001'] }))
      expect(agora.objetivos[0].redacao).not.toBe(redacaoNaEmissao)
    } finally {
      objetivo.descricaoTecnica = original
    }
  })

  it('objetivo de outro plano nao entra no relatorio', async () => {
    await entrarComo('COORDENADOR')
    const erro = await erroDe(s.relatorios.emitir('p-001', { ...pedido, objetivoIds: ['o-007'] }))
    expect(erro.codigo).toBe('VALIDACAO')
  })

  it('periodo invertido e recusado no campo do periodo', async () => {
    await entrarComo('TERAPEUTA')
    const erro = await erroDe(s.relatorios.emitir('p-001', {
      ...pedido, periodoInicio: '2026-09-30', periodoFim: '2026-09-01',
    }))
    expect(erro.campos.periodo).toBeTruthy()
  })
})
