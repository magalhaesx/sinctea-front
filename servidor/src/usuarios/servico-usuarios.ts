import { Injectable } from '@nestjs/common'
import {
  ErroServico, type ContaCriada, type DadosProfissionais, type FiltroUsuario, type LinkPrimeiroAcesso,
  type Pagina, type Perfil, type Profissional, type Usuario,
} from '@sinctea/compartilhado'
import { emailValido, normalizarEmail, paraBusca, podeDesativarUsuario } from '@sinctea/compartilhado/dominio/regras'
import { ServicoAutenticacao } from '../autenticacao/servico-autenticacao.js'
import { ServicoSessoes } from '../autenticacao/servico-sessoes.js'
import { hashDeSenhaDesconhecida } from '../autenticacao/senhas.js'
import { ServicoBanco } from '../banco/servico-banco.js'
import { paginar, porNome } from '../http/paginacao.js'
import type { SessaoServidor } from '../http/tipos-http.js'
import { exigirUuid, exigirValido, textoOuVazio } from '../http/validacao.js'
import { paraProfissional, paraUsuario } from './mapeador.js'

/** Perfis que a gestao de usuarios concede. Familia e escola nunca saem daqui. */
const PERFIS_DE_EQUIPE: Perfil[] = ['TERAPEUTA', 'COORDENADOR', 'ADMINISTRADOR']

/**
 * Gestao de usuarios (UC20, tela 14) e dados profissionais (tela 21), portados
 * de src/servicos/mock/gestao.ts. Desativar, nunca excluir: o historico
 * clinico mantem a autoria.
 *
 * So equipe nasce aqui. O responsavel nasce do vinculo com o paciente, e o
 * professor so do convite da familia (regra 1): sem esta trava, a gestao de
 * usuarios seria a porta dos fundos da regra.
 */
@Injectable()
export class ServicoUsuarios {
  constructor(
    private readonly banco: ServicoBanco,
    private readonly autenticacao: ServicoAutenticacao,
    private readonly sessoes: ServicoSessoes,
  ) {}

  async listar(filtro: FiltroUsuario): Promise<Pagina<Usuario>> {
    const busca = filtro.busca ? paraBusca(filtro.busca.trim()) : ''
    const linhas = await this.banco.usuario.findMany({
      where: {
        ...(filtro.perfil ? { perfis: { has: filtro.perfil } } : {}),
        ...(filtro.ativo === undefined ? {} : { ativo: filtro.ativo }),
      },
    })
    const itens = linhas
      .filter((u) => !busca || paraBusca(u.nome).includes(busca) || u.email.includes(busca))
      .sort(porNome)
      .map(paraUsuario)
    return paginar(itens, filtro)
  }

  async convidar(dados: Record<string, unknown>): Promise<ContaCriada> {
    const nome = textoOuVazio(dados.nome)
    const email = normalizarEmail(textoOuVazio(dados.email))
    const perfis = Array.isArray(dados.perfis) ? [...new Set(dados.perfis as Perfil[])] : []
    const erros: Record<string, string> = {}
    if (!nome) erros.nome = 'Escreva o nome de quem vai receber a conta.'
    if (!emailValido(email)) erros.email = 'Escreva um e-mail válido.'
    if (perfis.length === 0) erros.perfis = 'Escolha ao menos um perfil.'
    if (perfis.some((p) => !PERFIS_DE_EQUIPE.includes(p))) {
      erros.perfis = 'Esta tela cadastra apenas a equipe da clínica. O responsável nasce do vínculo com o paciente, e o professor, do convite da família.'
    }
    // Item 7: a tela mostra o profissional pelo nome e pela especialidade, e
    // nunca como "terapeuta". Quem atende nasce com ela.
    if (perfis.includes('TERAPEUTA') && !textoOuVazio(dados.especialidade)) {
      erros.especialidade = 'Escreva a especialidade do profissional da clínica: Psicologia, Fonoaudiologia, Terapia Ocupacional.'
    }
    exigirValido(erros)
    if (await this.banco.usuario.count({ where: { email } }) > 0) {
      throw new ErroServico('CONFLITO', 'Já existe uma conta com este e-mail.')
    }

    // Senha que ninguem conhece ate o primeiro acesso: quem cadastra nao escolhe.
    const senhaHash = await hashDeSenhaDesconhecida()
    const usuario = await this.banco.$transaction(async (tx) => {
      const criado = await tx.usuario.create({ data: { nome, email, senhaHash, perfis, ativo: true } })
      await tx.profissional.create({ data: {
        usuarioId: criado.id,
        // O administrador costuma ter os dois a mao; quem completa depois e a
        // propria pessoa, na tela 21.
        especialidade: textoOuVazio(dados.especialidade),
        registroConselho: textoOuVazio(dados.registroConselho),
      } })
      return criado
    })
    const link = await this.autenticacao.gerarAcessoInicial(usuario.id)
    return { usuario: paraUsuario(usuario), primeiroAcesso: { token: link.token, expiraEm: link.expiraEm.toISOString() } }
  }

  async novoLinkDeAcesso(usuarioId: string): Promise<LinkPrimeiroAcesso> {
    const usuario = await this.buscar(usuarioId)
    if (!usuario.profissional) {
      throw new ErroServico('CONFLITO', 'O link de responsável é gerado na ficha do paciente, e o professor entra pelo convite da família.')
    }
    if (!usuario.ativo) throw new ErroServico('CONFLITO', 'Reative a conta antes de gerar um link para ela.')
    const link = await this.autenticacao.gerarAcessoInicial(usuario.id)
    return { token: link.token, expiraEm: link.expiraEm.toISOString() }
  }

  async alterarPerfis(sessao: SessaoServidor, usuarioId: string, perfis: unknown): Promise<Usuario> {
    const usuario = await this.buscar(usuarioId)
    // Perfis de familia e escola decorrem do tipo de cadastro, nao de uma escolha.
    const permitidos: Perfil[] = usuario.profissional ? PERFIS_DE_EQUIPE
      : usuario.responsavel ? ['RESPONSAVEL'] : ['PROFESSOR']
    const unicos = Array.isArray(perfis) ? [...new Set(perfis as Perfil[])] : []
    if (unicos.length === 0 || unicos.some((p) => !permitidos.includes(p))) {
      throw new ErroServico('VALIDACAO', 'Perfis incompatíveis com este tipo de usuário.', { perfis: 'Perfis incompatíveis com este tipo de usuário.' })
    }
    if (usuario.id === sessao.usuario.id && !unicos.includes('ADMINISTRADOR')) {
      throw new ErroServico('CONFLITO', 'Você não pode retirar o próprio perfil de administrador.')
    }
    // Quem perdeu o perfil com que estava agindo cai na proxima chamada.
    return paraUsuario(await this.banco.usuario.update({ where: { id: usuario.id }, data: { perfis: unicos } }))
  }

  async desativar(sessao: SessaoServidor, usuarioId: string): Promise<Usuario> {
    const id = exigirUuid(usuarioId, 'Usuário')
    if (!podeDesativarUsuario(sessao.usuario.id, id)) {
      throw new ErroServico('CONFLITO', 'Você não pode desativar a própria conta.')
    }
    await this.buscar(id)
    const usuario = await this.banco.usuario.update({ where: { id }, data: { ativo: false } })
    // O acesso acaba na proxima acao desta pessoa — aqui mesmo, todas as sessoes saem.
    await this.sessoes.encerrarTodasDo(id)
    return paraUsuario(usuario)
  }

  async reativar(usuarioId: string): Promise<Usuario> {
    const usuario = await this.buscar(usuarioId)
    return paraUsuario(await this.banco.usuario.update({ where: { id: usuario.id }, data: { ativo: true } }))
  }

  async meusDadosProfissionais(sessao: SessaoServidor): Promise<DadosProfissionais | null> {
    const linha = await this.banco.profissional.findUnique({ where: { usuarioId: sessao.usuario.id } })
    return linha ? { especialidade: linha.especialidade, registroConselho: linha.registroConselho } : null
  }

  /**
   * O proprio dono, e nao o administrador: o registro no conselho responde por
   * quem assina o documento, e ninguem assina no lugar de outro.
   */
  async atualizarMeusDadosProfissionais(sessao: SessaoServidor, dados: Record<string, unknown>): Promise<DadosProfissionais> {
    const linha = await this.banco.profissional.findUnique({ where: { usuarioId: sessao.usuario.id } })
    if (!linha) throw new ErroServico('CONFLITO', 'Esta conta não tem dados profissionais.')
    const especialidade = textoOuVazio(dados.especialidade)
    const registroConselho = textoOuVazio(dados.registroConselho)
    const erros: Record<string, string> = {}
    if (!especialidade) erros.especialidade = 'Escreva a sua especialidade.'
    if (!registroConselho) erros.registroConselho = 'Escreva o seu registro no conselho.'
    exigirValido(erros)
    await this.banco.profissional.update({
      where: { usuarioId: sessao.usuario.id }, data: { especialidade, registroConselho },
    })
    return { especialidade, registroConselho }
  }

  async listarProfissionais(filtro: { busca?: string; pagina?: number; porPagina?: number }): Promise<Pagina<Profissional>> {
    const busca = filtro.busca ? paraBusca(filtro.busca.trim()) : ''
    const linhas = await this.banco.usuario.findMany({
      where: { ativo: true, profissional: { isNot: null } },
      include: { profissional: true },
    })
    const itens = linhas
      .filter((u) => !busca || paraBusca(u.nome).includes(busca))
      .sort(porNome)
      .map((u) => paraProfissional({ ...u, profissional: u.profissional! }))
    return paginar(itens, filtro)
  }

  private async buscar(usuarioId: string) {
    const id = exigirUuid(usuarioId, 'Usuário')
    const usuario = await this.banco.usuario.findUnique({
      where: { id }, include: { profissional: true, responsavel: true },
    })
    if (!usuario) throw new ErroServico('NAO_ENCONTRADO', 'Usuário não encontrado.')
    return usuario
  }
}
