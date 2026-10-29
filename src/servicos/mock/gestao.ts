import type { ServicoAuditoria, ServicoUsuario } from '@sinctea/compartilhado'
import {
  ErroServico, type FiltroAuditoria, type Perfil, type PessoaDaTrilha, type Profissional, type RegistroAuditoria,
  type RegistroDaTrilha, type Usuario, type UsuarioQualquer,
} from '@sinctea/compartilhado'
import { erroDoMotivoDaNovaSenha, podeDesativarUsuario } from '@sinctea/compartilhado/dominio/regras'
import {
  anterioresQueMudaram, csvDaAuditoria, descreverFiltroAuditoria, ENTIDADES_ADMINISTRATIVAS, LIMITE_DA_EXPORTACAO,
  perfisQueMudaram, RECORTE_GRANDE_DEMAIS, semNomeNaTrilhaAdministrativa, validarFiltroAuditoria,
} from '@sinctea/compartilhado/dominio/auditoria'
import { jsonCanonico } from '@sinctea/compartilhado/dominio/hash'
import { detalheDosPerfis } from '@sinctea/compartilhado/dominio/perfis'
import { fimDaValidade, inicioDoDia } from '@sinctea/compartilhado/dominio/datas'
import {
  auditar, banco, exigirPerfil, exigirSessao, exigirValido, gerarId, naoEncontrado, paginar,
  relogio, responder, todosUsuarios, usuarioPorId,
} from './infra'

// ---------------------------------------------------------------- Auditoria

/** Somente leitura. Nao existe operacao de editar ou excluir registro. */
/**
 * O recorte do filtro, do mais recente para o mais antigo, sem o IP (item 17).
 * O filtro e o de validarFiltroAuditoria, o mesmo do servidor; os ids do mock
 * sao legiveis, e nao UUID.
 */
function filtrarAuditoria(filtro: FiltroAuditoria): RegistroDaTrilha[] {
  exigirValido(validarFiltroAuditoria(filtro, (id) => id.trim() !== ''))
  const desde = filtro.desde ? inicioDoDia(filtro.desde).toISOString() : null
  const ate = filtro.ate ? fimDaValidade(filtro.ate).toISOString() : null
  return banco.auditoria
    .filter((r) => (!desde || r.ocorridoEm >= desde) && (!ate || r.ocorridoEm < ate))
    .filter((r) => !filtro.usuarioId || r.usuarioId === filtro.usuarioId)
    .filter((r) => !filtro.acao || r.acao === filtro.acao)
    .filter((r) => !filtro.pacienteId || r.pacienteId === filtro.pacienteId)
    .filter((r) => !filtro.entidade || r.entidade === filtro.entidade)
    .slice()
    .reverse()
    .map(semIp)
}

const semIp = ({ ipOrigem: _ip, ...r }: RegistroAuditoria): RegistroDaTrilha => r

export const auditoriaMock: ServicoAuditoria = {
  /**
   * No servidor, cada consulta entra na trilha (item 17). Aqui, nao: os testes
   * do mock leem a trilha por esta operacao, e a propria leitura esconderia o
   * registro que eles procuram.
   */
  listar: (filtro = {}) => responder(() => {
    exigirPerfil(['COORDENADOR'], 'RegistroAuditoria')
    return paginar(filtrarAuditoria(filtro), filtro)
  }),

  listarPessoas: () => responder(() => {
    exigirPerfil(['COORDENADOR'], 'RegistroAuditoria')
    // Do mais recente para o mais antigo: o primeiro nome de cada pessoa e o mais recente.
    const porId = new Map<string, string>()
    for (const r of [...banco.auditoria].reverse()) {
      if (r.usuarioId && r.usuarioNome && !porId.has(r.usuarioId)) porId.set(r.usuarioId, r.usuarioNome)
    }
    return [...porId].map(([usuarioId, nome]): PessoaDaTrilha => ({ usuarioId, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }),

  // Item 13: as mesmas regras do servidor (servidor/src/usuarios/servico-trilha.ts).
  listarAdministrativa: (filtro = {}) => responder(() => {
    const sessao = exigirPerfil(['ADMINISTRADOR'], 'RegistroAuditoria')
    const desde = filtro.desde ? inicioDoDia(filtro.desde).toISOString() : null
    const ate = filtro.ate ? fimDaValidade(filtro.ate).toISOString() : null
    const itens = banco.auditoria
      .filter((r) => r.pacienteId === null && (ENTIDADES_ADMINISTRATIVAS as readonly string[]).includes(r.entidade))
      .filter((r) => (!desde || r.ocorridoEm >= desde) && (!ate || r.ocorridoEm < ate))
      // O registro de escola feito por responsavel sai sem quem agiu, e o filtro por pessoa nao o alcanca (item 13b).
      .filter((r) => !filtro.usuarioId || (r.usuarioId === filtro.usuarioId && !semNomeNaTrilhaAdministrativa(r)))
      .filter((r) => !filtro.acao || r.acao === filtro.acao)
      .slice().reverse()
      .map(({ ipOrigem: _ip, pacienteId: _p, ...r }) => (semNomeNaTrilhaAdministrativa(r) ? { ...r, usuarioId: null, usuarioNome: null } : r))
    const pagina = paginar(itens, { pagina: filtro.pagina, porPagina: 20 })
    auditar(sessao, {
      acao: 'LEITURA_AUTORIZADA', entidade: 'RegistroAuditoria', idEntidade: null,
      detalhe: `Trilha administrativa consultada (${pagina.total} registros).`,
    })
    return pagina
  }),

  exportar: (filtro = {}) => responder(() => {
    const sessao = exigirPerfil(['COORDENADOR'], 'RegistroAuditoria')
    // Todos os registros do filtro, e nao a pagina visivel: quem exporta quer
    // o recorte inteiro, e uma planilha com um pedaco dele engana.
    const itens = filtrarAuditoria(filtro)
    if (itens.length > LIMITE_DA_EXPORTACAO) throw new ErroServico('VALIDACAO', RECORTE_GRANDE_DEMAIS)
    const csv = csvDaAuditoria(itens)
    auditar(sessao, {
      acao: 'LEITURA_AUTORIZADA', entidade: 'RegistroAuditoria', idEntidade: null,
      // O recorte por paciente leva o paciente: sem ele, o id iria para a
      // trilha administrativa pelo texto (item 13).
      pacienteId: filtro.pacienteId ?? null,
      detalhe: `Exportação da trilha: ${itens.length} ${itens.length === 1 ? 'registro' : 'registros'} (${descreverFiltroAuditoria(filtro)}).`,
    })
    return csv
  }),
}

// ---------------------------------------------------------------- Usuarios

function publico(u: UsuarioQualquer): Usuario {
  const { id, nome, email, perfis, ativo, ultimoAcessoEm } = u
  return { id, nome, email, perfis, ativo, ultimoAcessoEm }
}

function buscarUsuario(id: string): UsuarioQualquer {
  return usuarioPorId(id) ?? naoEncontrado('Usuário')
}

function linkDoMock() {
  return { token: `mock-${gerarId('acesso')}`, expiraEm: new Date(relogio.agora().getTime() + 72 * 3_600_000).toISOString() }
}

/** Perfis que esta tela pode conceder. Familia e escola nunca saem daqui. */
const PERFIS_DE_EQUIPE: Perfil[] = ['TERAPEUTA', 'COORDENADOR', 'ADMINISTRADOR']

/** Desativar, nunca excluir: o historico clinico precisa manter a autoria. */
export const usuariosMock: ServicoUsuario = {
  listar: (filtro = {}) => responder(() => {
    exigirPerfil(['ADMINISTRADOR'], 'Usuario')
    const busca = filtro.busca?.trim().toLowerCase() ?? ''
    const itens = todosUsuarios()
      .filter((u) => !busca || u.nome.toLowerCase().includes(busca) || u.email.toLowerCase().includes(busca))
      .filter((u) => !filtro.perfil || u.perfis.includes(filtro.perfil))
      .filter((u) => filtro.ativo === undefined || u.ativo === filtro.ativo)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map(publico)
    return paginar(itens, filtro)
  }),

  /**
   * So equipe da clinica. RESPONSAVEL e PROFESSOR nunca saem daqui: o
   * responsavel nasce do vinculo com o paciente, e o professor so nasce do
   * convite da familia (regra 1). Sem esta trava, a tela de administracao
   * seria a porta dos fundos da regra — o administrador criaria um professor
   * que nenhuma familia autorizou.
   */
  convidar: (dados) => responder(() => {
    const sessao = exigirPerfil(['ADMINISTRADOR'], 'Usuario')
    const nome = dados.nome.trim()
    const email = dados.email.trim().toLowerCase()
    const perfis = [...new Set(dados.perfis)]
    const erros: Record<string, string> = {}
    if (!nome) erros.nome = 'Escreva o nome de quem vai receber a conta.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erros.email = 'Escreva um e-mail válido.'
    if (perfis.length === 0) erros.perfis = 'Escolha ao menos um perfil.'
    if (perfis.some((p) => !PERFIS_DE_EQUIPE.includes(p))) {
      erros.perfis = 'Esta tela cadastra apenas a equipe da clínica. O responsável nasce do vínculo com o paciente, e o professor, do convite da família.'
    }
    // A mesma regra do servidor (item 7): quem atende nasce com a especialidade.
    if (perfis.includes('TERAPEUTA') && !dados.especialidade?.trim()) {
      erros.especialidade = 'Escreva a especialidade do profissional da clínica: Psicologia, Fonoaudiologia, Terapia Ocupacional.'
    }
    exigirValido(erros)
    if (todosUsuarios().some((u) => u.email.toLowerCase() === email)) {
      throw new ErroServico('CONFLITO', 'Já existe uma conta com este e-mail.')
    }

    const usuario: Profissional = {
      tipo: 'PROFISSIONAL',
      id: gerarId('u'),
      nome,
      email,
      perfis,
      ativo: true,
      ultimoAcessoEm: null,
      // O administrador costuma ter os dois a mao; quem completa depois e a
      // propria pessoa, na tela 21.
      especialidade: dados.especialidade?.trim() ?? '',
      registroConselho: dados.registroConselho?.trim() ?? '',
    }
    banco.profissionais.push(usuario)
    auditar(sessao, {
      acao: 'CRIACAO', entidade: 'Usuario', idEntidade: usuario.id,
      detalhe: `Conta criada para ${email} (${perfis.join(', ')}). Link de primeiro acesso gerado.`,
    })
    return { usuario: publico(usuario), primeiroAcesso: linkDoMock() }
  }),

  // As contas de demonstracao ja tem senha: o link do mock nao abre nada. O
  // caminho de verdade e o servidor (docs/07, secao 0).
  novoLinkDeAcesso: (usuarioId) => responder(() => {
    const sessao = exigirPerfil(['ADMINISTRADOR'], 'Usuario')
    const usuario = buscarUsuario(usuarioId)
    if (usuario.tipo !== 'PROFISSIONAL') {
      throw new ErroServico('CONFLITO', 'O link de responsável é gerado na ficha do paciente, e o professor entra pelo convite da família.')
    }
    if (!usuario.ativo) throw new ErroServico('CONFLITO', 'Reative a conta antes de gerar um link para ela.')
    if (usuario.ultimoAcessoEm !== null) {
      throw new ErroServico('CONFLITO', 'Esta pessoa já definiu a senha. Use o link para nova senha, com o motivo.')
    }
    auditar(sessao, { acao: 'ALTERACAO', entidade: 'Usuario', idEntidade: usuario.id, detalhe: 'Novo link de primeiro acesso gerado; o anterior deixou de valer.' })
    return linkDoMock()
  }),

  // Item 13: as mesmas regras do servidor (servidor/src/usuarios/servico-usuarios.ts).
  linkNovaSenha: (usuarioId, motivo) => responder(() => {
    const sessao = exigirPerfil(['ADMINISTRADOR'], 'Usuario')
    const usuario = buscarUsuario(usuarioId)
    if (usuario.tipo === 'RESPONSAVEL') {
      throw new ErroServico('ACESSO_NEGADO', 'O link para nova senha do responsável é da coordenação, na ficha do paciente.')
    }
    if (!usuario.ativo) throw new ErroServico('CONFLITO', 'Reative a conta antes de gerar um link para ela.')
    if (usuario.ultimoAcessoEm === null) {
      throw new ErroServico('CONFLITO', 'Esta pessoa ainda não definiu a senha: use "Gerar novo link de acesso".')
    }
    const erroMotivo = erroDoMotivoDaNovaSenha(motivo)
    if (erroMotivo) throw new ErroServico('VALIDACAO', erroMotivo, { motivo: erroMotivo })
    auditar(sessao, {
      acao: 'ALTERACAO', entidade: 'Usuario', idEntidade: usuario.id,
      detalhe: `Link para nova senha gerado pela administração; o anterior deixou de valer. Motivo: ${motivo.trim()}`,
    })
    return linkDoMock()
  }),

  meusDadosProfissionais: () => responder(() => {
    const sessao = exigirSessao()
    const usuario = sessao.usuario
    return usuario.tipo === 'PROFISSIONAL'
      ? { especialidade: usuario.especialidade, registroConselho: usuario.registroConselho }
      : null
  }),

  /**
   * O proprio dono, e nao o administrador: o registro no conselho responde por
   * quem assina o documento, e ninguem assina no lugar de outro.
   */
  atualizarMeusDadosProfissionais: (dados) => responder(() => {
    const sessao = exigirSessao()
    const usuario = sessao.usuario
    if (usuario.tipo !== 'PROFISSIONAL') {
      throw new ErroServico('CONFLITO', 'Esta conta não tem dados profissionais.')
    }
    const especialidade = dados.especialidade.trim()
    const registroConselho = dados.registroConselho.trim()
    const erros: Record<string, string> = {}
    if (!especialidade) erros.especialidade = 'Escreva a sua especialidade.'
    if (!registroConselho) erros.registroConselho = 'Escreva o seu registro no conselho.'
    exigirValido(erros)

    // Item 13b: a versao anterior so do que mudou, como no servidor.
    const anteriores = anterioresQueMudaram(
      { especialidade: usuario.especialidade, registroConselho: usuario.registroConselho ?? null },
      { especialidade, registroConselho },
    )
    // Item 13c: sem mudanca, nada se registra; e o registro e do Profissional.
    if (!anteriores) return { especialidade, registroConselho }
    usuario.especialidade = especialidade
    usuario.registroConselho = registroConselho
    auditar(sessao, {
      acao: 'ALTERACAO', entidade: 'Profissional', idEntidade: usuario.id,
      detalhe: `Dados profissionais atualizados: ${especialidade}, ${registroConselho}.`,
      valorAnterior: anteriores && jsonCanonico(anteriores),
    })
    return { especialidade, registroConselho }
  }),

  alterarPerfis: (usuarioId, perfis) => responder(() => {
    const sessao = exigirPerfil(['ADMINISTRADOR'], 'Usuario')
    const usuario = buscarUsuario(usuarioId)
    // Perfis de familia e escola decorrem do tipo de cadastro, nao de uma escolha do administrador.
    const permitidos = usuario.tipo === 'PROFISSIONAL'
      ? ['TERAPEUTA', 'COORDENADOR', 'ADMINISTRADOR']
      : usuario.tipo === 'RESPONSAVEL' ? ['RESPONSAVEL'] : ['PROFESSOR']
    const unicos = [...new Set(perfis)]
    if (unicos.length === 0 || unicos.some((p) => !permitidos.includes(p))) {
      throw new ErroServico('VALIDACAO', 'Perfis incompatíveis com este tipo de usuário.', { perfis: 'Perfis incompatíveis com este tipo de usuário.' })
    }
    if (usuario.id === sessao.usuario.id && !unicos.includes('ADMINISTRADOR')) {
      throw new ErroServico('CONFLITO', 'Você não pode retirar o próprio perfil de administrador.')
    }
    const anteriores = perfisQueMudaram(usuario.perfis, unicos)
    // Item 13c: sem mudanca, nada se registra; o detalhe vai com os nomes de tela.
    if (!anteriores) return publico(usuario)
    usuario.perfis = unicos
    auditar(sessao, {
      acao: 'ALTERACAO', entidade: 'Usuario', idEntidade: usuario.id, detalhe: detalheDosPerfis(unicos),
      valorAnterior: jsonCanonico(anteriores),
    })
    return publico(usuario)
  }),

  desativar: (usuarioId) => responder(() => {
    const sessao = exigirPerfil(['ADMINISTRADOR'], 'Usuario')
    if (!podeDesativarUsuario(sessao.usuario.id, usuarioId)) {
      throw new ErroServico('CONFLITO', 'Você não pode desativar a própria conta.')
    }
    const usuario = buscarUsuario(usuarioId)
    const anteriores = anterioresQueMudaram({ ativo: usuario.ativo }, { ativo: false })
    usuario.ativo = false
    auditar(sessao, {
      acao: 'ALTERACAO', entidade: 'Usuario', idEntidade: usuario.id, detalhe: 'Usuário desativado.',
      valorAnterior: anteriores && jsonCanonico(anteriores),
    })
    return publico(usuario)
  }),

  reativar: (usuarioId) => responder(() => {
    const sessao = exigirPerfil(['ADMINISTRADOR'], 'Usuario')
    const usuario = buscarUsuario(usuarioId)
    const anteriores = anterioresQueMudaram({ ativo: usuario.ativo }, { ativo: true })
    usuario.ativo = true
    auditar(sessao, {
      acao: 'ALTERACAO', entidade: 'Usuario', idEntidade: usuario.id, detalhe: 'Usuário reativado.',
      valorAnterior: anteriores && jsonCanonico(anteriores),
    })
    return publico(usuario)
  }),
}
