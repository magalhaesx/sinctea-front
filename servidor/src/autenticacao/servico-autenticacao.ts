import { Injectable } from '@nestjs/common'
import {
  ErroServico, type Perfil, type PrimeiroAcessoPublico, type SessaoUsuario,
} from '@sinctea/compartilhado'
import {
  calcularExpiracaoPrimeiroAcesso, erroDaSenhaNova, normalizarEmail, situacaoPrimeiroAcesso,
} from '@sinctea/compartilhado/dominio/regras'
import { ServicoAuditoria } from '../auditoria/servico-auditoria.js'
import { ServicoBanco } from '../banco/servico-banco.js'
import type { RespostaHttp, SessaoServidor, UsuarioDaSessao } from '../http/tipos-http.js'
import { LimiteDeTentativas } from './limite-tentativas.js'
import { conferirSenha, hashDaSenha, hashDeSenhaDesconhecida } from './senhas.js'
import { ServicoSessoes, novoToken, resumoDoToken } from './servico-sessoes.js'

/** A projecao publica do usuario: o que sai numa resposta. Nunca o senhaHash. */
export function paraSessaoUsuario(usuario: UsuarioDaSessao, perfilAtivo: Perfil, especialidade: string | null = null): SessaoUsuario {
  return {
    usuario: {
      id: usuario.id, nome: usuario.nome, email: usuario.email, perfis: usuario.perfis,
      ativo: usuario.ativo, ultimoAcessoEm: usuario.ultimoAcessoEm?.toISOString() ?? null,
    },
    perfilAtivo,
    especialidade: especialidade || null,
  }
}

const CREDENCIAL_INVALIDA = 'E-mail ou senha incorretos.'

@Injectable()
export class ServicoAutenticacao {
  constructor(
    private readonly banco: ServicoBanco,
    private readonly sessoes: ServicoSessoes,
    private readonly auditoria: ServicoAuditoria,
    private readonly limite: LimiteDeTentativas,
  ) {}

  /** A sessao que sai na resposta, com a especialidade de quem e da equipe (item 7). */
  async sessaoUsuario(usuario: UsuarioDaSessao, perfilAtivo: Perfil): Promise<SessaoUsuario> {
    const profissional = await this.banco.profissional.findUnique({ where: { usuarioId: usuario.id }, select: { especialidade: true } })
    return paraSessaoUsuario(usuario, perfilAtivo, profissional?.especialidade ?? null)
  }

  /** Mensagem unica para e-mail inexistente, senha errada e conta desativada (tela 1). */
  async entrar(email: unknown, senha: unknown, ip: string | null, resposta: RespostaHttp): Promise<SessaoUsuario> {
    if (typeof email !== 'string' || typeof senha !== 'string') {
      throw new ErroServico('NAO_AUTENTICADO', CREDENCIAL_INVALIDA)
    }
    const emailNormal = normalizarEmail(email)
    // Bloqueado, recusa antes de conferir: nem a senha certa entra.
    this.limite.exigirLiberado(emailNormal, ip)
    const usuario = await this.banco.usuario.findUnique({ where: { email: emailNormal } })
    // Confere sempre, mesmo sem usuario: o tempo nao diz se o e-mail existe.
    const hash = usuario?.senhaHash ?? await hashDeSenhaDesconhecida()
    const confere = await conferirSenha(hash, senha)
    if (!usuario || !usuario.ativo || !confere || usuario.perfis.length === 0) {
      this.limite.falhou(emailNormal, ip)
      throw new ErroServico('NAO_AUTENTICADO', CREDENCIAL_INVALIDA)
    }
    this.limite.entrou(emailNormal)
    const atualizado = await this.banco.usuario.update({
      where: { id: usuario.id }, data: { ultimoAcessoEm: new Date() },
    })
    const perfilAtivo = usuario.perfis[0]
    await this.sessoes.abrir(usuario.id, perfilAtivo, resposta)
    return this.sessaoUsuario(atualizado, perfilAtivo)
  }

  async trocarPerfil(sessao: SessaoServidor, perfil: unknown): Promise<SessaoUsuario> {
    if (typeof perfil !== 'string' || !sessao.usuario.perfis.includes(perfil as Perfil)) {
      throw new ErroServico('ACESSO_NEGADO', 'Este perfil não está associado à sua conta.')
    }
    await this.sessoes.trocarPerfil(sessao.sessaoId, perfil as Perfil)
    return this.sessaoUsuario(sessao.usuario, perfil as Perfil)
  }

  // ------------------------------------------------------------ Primeiro acesso

  /**
   * Gera o link de primeiro acesso de uma conta. Devolve o token uma vez: o
   * banco fica so com o resumo. Um link novo invalida os anteriores ainda nao
   * usados da mesma conta. Usado por quem cadastra (itens 2 e 3).
   */
  async gerarAcessoInicial(usuarioId: string): Promise<{ token: string; expiraEm: Date }> {
    const token = novoToken()
    const criadoEm = new Date()
    const expiraEm = calcularExpiracaoPrimeiroAcesso(criadoEm)
    await this.banco.$transaction([
      this.banco.acessoInicial.deleteMany({ where: { usuarioId, usadoEm: null } }),
      this.banco.acessoInicial.create({ data: {
        tokenResumo: resumoDoToken(token), usuarioId, criadoEm, expiraEm,
      } }),
    ])
    return { token, expiraEm }
  }

  private async acessoPorToken(token: unknown) {
    if (typeof token !== 'string' || token.length === 0 || token.length > 200) return null
    return this.banco.acessoInicial.findUnique({
      where: { tokenResumo: resumoDoToken(token) },
      include: { usuario: true },
    })
  }

  async obterPrimeiroAcesso(token: unknown): Promise<PrimeiroAcessoPublico> {
    const acesso = await this.acessoPorToken(token)
    const situacao = situacaoPrimeiroAcesso(acesso && {
      expiraEm: acesso.expiraEm.toISOString(), usadoEm: acesso.usadoEm?.toISOString() ?? null,
    }, new Date())
    if (situacao !== 'VALIDO' || !acesso) return { situacao, nome: null, email: null, expiraEm: null }
    return {
      situacao, nome: acesso.usuario.nome, email: acesso.usuario.email,
      expiraEm: acesso.expiraEm.toISOString(),
    }
  }

  /** Define a senha, gasta o link e abre a sessao. Uso unico mesmo em corrida. */
  async concluirPrimeiroAcesso(token: unknown, senha: unknown, resposta: RespostaHttp): Promise<SessaoUsuario> {
    const erroSenha = typeof senha === 'string' ? erroDaSenhaNova(senha) : 'Escolha uma senha.'
    if (erroSenha) throw new ErroServico('VALIDACAO', erroSenha, { senha: erroSenha })

    const acesso = await this.acessoPorToken(token)
    const agora = new Date()
    const situacao = situacaoPrimeiroAcesso(acesso && {
      expiraEm: acesso.expiraEm.toISOString(), usadoEm: acesso.usadoEm?.toISOString() ?? null,
    }, agora)
    if (!acesso || situacao === 'INEXISTENTE') throw new ErroServico('NAO_ENCONTRADO', 'Este link não existe.')
    if (situacao === 'USADO') throw new ErroServico('CONFLITO', 'Este link já foi usado. Entre com a sua senha.')
    if (situacao === 'EXPIRADO') {
      throw new ErroServico('CONFLITO', 'Este link venceu. Peça um novo a quem cadastrou você.')
    }
    if (!acesso.usuario.ativo || acesso.usuario.perfis.length === 0) {
      throw new ErroServico('CONFLITO', 'Esta conta está desativada. Fale com a coordenação da clínica.')
    }

    const senhaHash = await hashDaSenha(senha as string)
    const usuario = await this.banco.$transaction(async (tx) => {
      // O "usadoEm: null" no filtro e o que garante o uso unico: de dois pedidos
      // ao mesmo tempo, so um encontra a linha ainda sem uso.
      const gasto = await tx.acessoInicial.updateMany({
        where: { id: acesso.id, usadoEm: null, expiraEm: { gt: agora } },
        data: { usadoEm: agora },
      })
      if (gasto.count !== 1) throw new ErroServico('CONFLITO', 'Este link já foi usado. Entre com a sua senha.')
      // Senha nova encerra qualquer sessao que a conta tivesse.
      await tx.sessaoLogin.deleteMany({ where: { usuarioId: acesso.usuarioId } })
      return tx.usuario.update({
        where: { id: acesso.usuarioId }, data: { senhaHash, ultimoAcessoEm: agora },
      })
    })

    const perfilAtivo = usuario.perfis[0]
    await this.sessoes.abrir(usuario.id, perfilAtivo, resposta)
    await this.auditoria.registrar(
      { sessaoId: '', perfilAtivo, usuario },
      { acao: 'ALTERACAO', entidade: 'Usuario', idEntidade: usuario.id, detalhe: 'Senha definida pelo link de primeiro acesso.' },
    )
    return this.sessaoUsuario(usuario, perfilAtivo)
  }
}
