import type { ServicoAutenticacao } from '@sinctea/compartilhado'
import { ErroServico } from '@sinctea/compartilhado'
import { SENHA_DEMONSTRACAO, USUARIOS_DEMONSTRACAO } from './dados'
import {
  exigirSessao, gravarSessao, paraSessaoUsuario, relogio, responder, sessaoServidor,
  todosUsuarios, usuarioPorId, type SessaoServidor,
} from './infra'

function abrirSessao(usuarioId: string, perfilAtivo: SessaoServidor['perfilAtivo']) {
  const usuario = usuarioPorId(usuarioId)!
  usuario.ultimoAcessoEm = relogio.agora().toISOString()
  gravarSessao({ usuarioId, perfilAtivo })
  return paraSessaoUsuario({ usuario, perfilAtivo })
}

export const autenticacaoMock: ServicoAutenticacao = {
  entrar: (email, senha) => responder(() => {
    const usuario = todosUsuarios().find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
    // Mensagem unica: nunca revela se o e-mail existe (tela 1).
    if (!usuario || !usuario.ativo || senha !== SENHA_DEMONSTRACAO) {
      throw new ErroServico('NAO_AUTENTICADO', 'E-mail ou senha incorretos.')
    }
    return abrirSessao(usuario.id, usuario.perfis[0])
  }),

  entrarDemonstracao: (perfil) => responder(() => abrirSessao(USUARIOS_DEMONSTRACAO[perfil], perfil)),

  trocarPerfil: (perfil) => responder(() => {
    const sessao = exigirSessao()
    if (!sessao.usuario.perfis.includes(perfil)) {
      throw new ErroServico('ACESSO_NEGADO', 'Este perfil não está associado à sua conta.')
    }
    gravarSessao({ usuarioId: sessao.usuario.id, perfilAtivo: perfil })
    return paraSessaoUsuario({ usuario: sessao.usuario, perfilAtivo: perfil })
  }),

  sessaoAtual: () => responder(() => {
    const sessao = sessaoServidor()
    return sessao ? paraSessaoUsuario(sessao) : null
  }),

  sair: () => responder(() => { gravarSessao(null) }),

  // A sessao simulada e uma so: nao ha outras contas abertas para escolher (item 9).
  contasAbertas: () => responder(() => []),
  continuarComo: () => responder(() => {
    const sessao = sessaoServidor()
    return sessao ? paraSessaoUsuario(sessao) : null
  }),

  // O mock nao gera link de primeiro acesso: as contas de demonstracao ja tem
  // senha. Todo token e desconhecido aqui; o caminho de verdade e o servidor.
  obterPrimeiroAcesso: () => responder(() => ({ situacao: 'INEXISTENTE' as const, nome: null, email: null, expiraEm: null, finalidade: null })),
  concluirPrimeiroAcesso: () => responder(() => {
    throw new ErroServico('NAO_ENCONTRADO', 'Este link não existe.')
  }),
  darCienciaDaNovaSenha: () => responder(() => paraSessaoUsuario(exigirSessao())),
}
