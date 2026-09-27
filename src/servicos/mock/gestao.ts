import type { ServicoAuditoria, ServicoUsuario } from '../contratos'
import {
  ErroServico, type FiltroAuditoria, type RegistroAuditoria, type Usuario, type UsuarioQualquer,
} from '../tipos'
import { podeDesativarUsuario } from '../../dominio/regras'
import { montarCsv } from '../../dominio/csv'
import {
  auditar, banco, exigirPerfil, naoEncontrado, paginar, responder, todosUsuarios, usuarioPorId,
} from './infra'

// ---------------------------------------------------------------- Auditoria

/** Somente leitura. Nao existe operacao de editar ou excluir registro. */
/** O recorte do filtro, do mais recente para o mais antigo. */
function filtrarAuditoria(filtro: FiltroAuditoria): RegistroAuditoria[] {
  return banco.auditoria
    .filter((r) => !filtro.desde || r.ocorridoEm >= filtro.desde)
    .filter((r) => !filtro.ate || r.ocorridoEm <= filtro.ate)
    .filter((r) => !filtro.usuarioId || r.usuarioId === filtro.usuarioId)
    .filter((r) => !filtro.acao || r.acao === filtro.acao)
    .filter((r) => !filtro.pacienteId || r.pacienteId === filtro.pacienteId)
    .filter((r) => !filtro.entidade || r.entidade === filtro.entidade)
    .slice()
    .reverse()
}

/** O filtro em uma linha, para caber no detalhe do registro da exportacao. */
function descreverFiltro(filtro: FiltroAuditoria): string {
  const partes = [
    filtro.desde && `desde ${filtro.desde.slice(0, 10)}`,
    filtro.ate && `ate ${filtro.ate.slice(0, 10)}`,
    filtro.usuarioId && `usuario ${filtro.usuarioId}`,
    filtro.acao && `acao ${filtro.acao}`,
    filtro.pacienteId && `paciente ${filtro.pacienteId}`,
    filtro.entidade && `entidade ${filtro.entidade}`,
  ].filter(Boolean)
  return partes.length === 0 ? 'sem filtro' : partes.join(', ')
}

export const auditoriaMock: ServicoAuditoria = {
  /**
   * Listar NAO e auditado, de proposito. Ler a trilha e o trabalho deste
   * perfil, e registrar cada abertura da tela encheria a trilha com registros
   * da propria leitura dela — o ruido acabaria escondendo o que importa.
   * Exportar e outra coisa: ali o dado sai do sistema.
   */
  listar: (filtro = {}) => responder(() => {
    exigirPerfil(['COORDENADOR'], 'RegistroAuditoria')
    return paginar(filtrarAuditoria(filtro), filtro)
  }),

  exportar: (filtro = {}) => responder(() => {
    const sessao = exigirPerfil(['COORDENADOR'], 'RegistroAuditoria')
    // Todos os registros do filtro, e nao a pagina visivel: quem exporta quer
    // o recorte inteiro, e uma planilha com um pedaco dele engana.
    const itens = filtrarAuditoria(filtro)
    const csv = montarCsv(
      ['Data e hora', 'Usuário', 'Perfil', 'Ação', 'Entidade', 'Identificador',
        'Paciente', 'Origem', 'Detalhe'],
      itens.map((r) => [
        r.ocorridoEm, r.usuarioNome ?? '', r.perfil ?? '', r.acao, r.entidade,
        r.idEntidade ?? '', r.pacienteId ?? '', r.origem, r.detalhe,
      ]),
    )
    auditar(sessao, {
      acao: 'LEITURA_AUTORIZADA', entidade: 'RegistroAuditoria', idEntidade: null,
      detalhe: `Exportação da trilha: ${itens.length} ${itens.length === 1 ? 'registro' : 'registros'} (${descreverFiltro(filtro)}).`,
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
    usuario.perfis = unicos
    auditar(sessao, { acao: 'ALTERACAO', entidade: 'Usuario', idEntidade: usuario.id, detalhe: `Perfis: ${unicos.join(', ')}` })
    return publico(usuario)
  }),

  desativar: (usuarioId) => responder(() => {
    const sessao = exigirPerfil(['ADMINISTRADOR'], 'Usuario')
    if (!podeDesativarUsuario(sessao.usuario.id, usuarioId)) {
      throw new ErroServico('CONFLITO', 'Você não pode desativar a própria conta.')
    }
    const usuario = buscarUsuario(usuarioId)
    usuario.ativo = false
    auditar(sessao, { acao: 'ALTERACAO', entidade: 'Usuario', idEntidade: usuario.id, detalhe: 'Usuário desativado.' })
    return publico(usuario)
  }),

  reativar: (usuarioId) => responder(() => {
    const sessao = exigirPerfil(['ADMINISTRADOR'], 'Usuario')
    const usuario = buscarUsuario(usuarioId)
    usuario.ativo = true
    auditar(sessao, { acao: 'ALTERACAO', entidade: 'Usuario', idEntidade: usuario.id, detalhe: 'Usuário reativado.' })
    return publico(usuario)
  }),
}
