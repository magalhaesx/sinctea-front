import type { ServicoAuditoria, ServicoUsuario } from '../contratos'
import { ErroServico, type Usuario, type UsuarioQualquer } from '../tipos'
import { podeDesativarUsuario } from '../../dominio/regras'
import {
  auditar, banco, exigirPerfil, naoEncontrado, paginar, responder, todosUsuarios, usuarioPorId,
} from './infra'

// ---------------------------------------------------------------- Auditoria

/** Somente leitura. Nao existe operacao de editar ou excluir registro. */
export const auditoriaMock: ServicoAuditoria = {
  listar: (filtro = {}) => responder(() => {
    exigirPerfil(['COORDENADOR'], 'RegistroAuditoria')
    const itens = banco.auditoria
      .filter((r) => !filtro.desde || r.ocorridoEm >= filtro.desde)
      .filter((r) => !filtro.ate || r.ocorridoEm <= filtro.ate)
      .filter((r) => !filtro.usuarioId || r.usuarioId === filtro.usuarioId)
      .filter((r) => !filtro.acao || r.acao === filtro.acao)
      .filter((r) => !filtro.pacienteId || r.pacienteId === filtro.pacienteId)
      .slice()
      .reverse()
    return paginar(itens, filtro)
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
