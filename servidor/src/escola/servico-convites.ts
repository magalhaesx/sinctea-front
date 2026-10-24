import { Injectable } from '@nestjs/common'
import { ErroServico, type ConvitePublico, type SessaoUsuario } from '@sinctea/compartilhado'
import { consentimentoVigente, emailValido, erroDaSenhaNova, normalizarEmail, situacaoConvite } from '@sinctea/compartilhado/dominio/regras'
import { ServicoAuditoria } from '../auditoria/servico-auditoria.js'
import { LimiteDeTentativas } from '../autenticacao/limite-tentativas.js'
import { conferirSenha, hashDaSenha } from '../autenticacao/senhas.js'
import { paraSessaoUsuario } from '../autenticacao/servico-autenticacao.js'
import { ServicoSessoes } from '../autenticacao/servico-sessoes.js'
import { resumoDoToken } from '../autenticacao/tokens.js'
import { ServicoBanco } from '../banco/servico-banco.js'
import { paraConsentimento, paraDataCivil } from '../clinica/mapeadores.js'
import type { RequisicaoHttp, RespostaHttp, SessaoServidor } from '../http/tipos-http.js'
import { exigirValido, textoOuVazio } from '../http/validacao.js'

export interface ConviteAceito {
  sessaoUsuario: SessaoUsuario
  sessao: SessaoServidor
  vinculoId: string
  pacienteId: string
}

/**
 * Convite escolar (UC13, tela 2), portado de src/servicos/mock/familia.ts.
 * Unico caminho de entrada da escola: nao existe autocadastro de professor
 * (regra 1). Uso unico, 72 horas, e o banco guarda so o resumo do token.
 *
 * Professor com mais de um aluno (revisao de 16/10): o mesmo formulario serve.
 * E-mail novo cria a conta; e-mail de professor que ja existe exige a senha
 * dessa conta — e a tentativa conta no limite de tentativas — e o vinculo
 * novo entra nela. E-mail da equipe ou de responsavel e recusado.
 */
@Injectable()
export class ServicoConvites {
  constructor(
    private readonly banco: ServicoBanco,
    private readonly sessoes: ServicoSessoes,
    private readonly auditoria: ServicoAuditoria,
    private readonly limite: LimiteDeTentativas,
  ) {}

  private async conviteDoToken(token: string) {
    if (!token || token.length > 200) return null
    return this.banco.conviteEscolar.findUnique({
      where: { tokenResumo: resumoDoToken(token) },
      include: { consentimento: { include: { escola: true, paciente: true, responsavel: { include: { usuario: true } } } } },
    })
  }

  /** Convite que nao vale mais nao revela para quem era. */
  async obter(token: string): Promise<{ convite: ConvitePublico; pacienteId: string | null }> {
    const achado = await this.conviteDoToken(token)
    if (!achado) throw new ErroServico('NAO_ENCONTRADO', 'Convite não encontrado.')
    const consentimento = paraConsentimento(achado.consentimento)
    const situacao = situacaoConvite(
      { expiraEm: achado.expiraEm.toISOString(), usadoEm: achado.usadoEm?.toISOString() ?? null }, consentimento, new Date(),
    )
    if (situacao !== 'VALIDO') {
      return { convite: { situacao, responsavel: null, aluno: null, escola: null, escopos: [], validadeAte: null, expiraEm: null }, pacienteId: null }
    }
    const c = achado.consentimento
    return {
      convite: {
        situacao, responsavel: c.responsavel.usuario.nome,
        // Minimizacao: so o primeiro nome do aluno.
        aluno: c.paciente.nome.split(' ')[0], escola: c.escola.nome, escopos: c.escopos,
        validadeAte: paraDataCivil(c.validadeAte), expiraEm: achado.expiraEm.toISOString(),
      },
      pacienteId: c.pacienteId,
    }
  }

  async aceitar(token: string, dados: Record<string, unknown>, requisicao: RequisicaoHttp, resposta: RespostaHttp): Promise<ConviteAceito> {
    const ip = requisicao.ip ?? null
    const achado = await this.conviteDoToken(token)
    if (!achado) throw new ErroServico('NAO_ENCONTRADO', 'Convite não encontrado.')
    const agora = new Date()
    const situacao = situacaoConvite(
      { expiraEm: achado.expiraEm.toISOString(), usadoEm: achado.usadoEm?.toISOString() ?? null },
      paraConsentimento(achado.consentimento), agora,
    )
    if (situacao !== 'VALIDO') {
      // Sem sessao ainda, a tentativa entra na trilha sem autor (regra 6).
      await this.auditoria.registrar(null, {
        acao: 'ACESSO_NEGADO', entidade: 'ConviteEscolar', idEntidade: achado.id,
        pacienteId: achado.consentimento.pacienteId, detalhe: `Convite ${situacao.toLowerCase()}.`, ipOrigem: ip,
      })
      throw new ErroServico('CONFLITO', 'Este convite não pode mais ser usado.')
    }

    const nome = textoOuVazio(dados.nome)
    const email = normalizarEmail(textoOuVazio(dados.email))
    const senha = typeof dados.senha === 'string' ? dados.senha : ''
    const turma = textoOuVazio(dados.turma)
    const turno = textoOuVazio(dados.turno)
    const erros: Record<string, string> = {}
    if (!emailValido(email)) erros.email = 'Informe um e-mail válido.'
    if (!turma) erros.turma = 'Informe a turma do aluno.'
    if (!turno) erros.turno = 'Informe o turno.'

    const existente = emailValido(email)
      ? await this.banco.usuario.findUnique({ where: { email }, include: { professorAee: true } })
      : null
    if (existente && !existente.professorAee) {
      throw new ErroServico('CONFLITO', 'Este e-mail é de uma conta da clínica ou da família. Use o seu e-mail de professor.',
        { email: 'Este e-mail é de uma conta da clínica ou da família. Use o seu e-mail de professor.' })
    }
    if (!existente) {
      if (!nome) erros.nome = 'Informe seu nome.'
      const erroSenha = erroDaSenhaNova(senha)
      if (erroSenha) erros.senha = erroSenha
    }
    exigirValido(erros)

    if (existente) {
      // A conta existe: so entra quem tem a senha dela, e o palpite conta no limite.
      this.limite.exigirLiberado(email, ip)
      if (!existente.ativo || !(await conferirSenha(existente.senhaHash, senha))) {
        this.limite.falhou(email, ip)
        throw new ErroServico('NAO_AUTENTICADO', 'E-mail ou senha incorretos.')
      }
      this.limite.entrou(email)
    }
    const senhaHash = existente ? null : await hashDaSenha(senha)
    // A vaga antes de gastar o convite: sem vaga, o convite continua valendo.
    const vaga = await this.sessoes.vagaLivre(requisicao)

    const { professor, vinculo } = await this.banco.$transaction(async (tx) => {
      // Uso unico, mesmo em corrida: so um pedido encontra o convite sem uso.
      const gasto = await tx.conviteEscolar.updateMany({
        where: { id: achado.id, usadoEm: null, expiraEm: { gt: agora } }, data: { usadoEm: agora },
      })
      if (gasto.count !== 1) throw new ErroServico('CONFLITO', 'Este convite não pode mais ser usado.')
      // A familia pode ter encerrado no meio do caminho: vale o consentimento de agora.
      const consentimento = await tx.consentimento.findUniqueOrThrow({ where: { id: achado.consentimentoId } })
      if (!consentimentoVigente(paraConsentimento(consentimento), agora)) {
        throw new ErroServico('CONFLITO', 'Este convite não pode mais ser usado.')
      }
      const professor = existente
        ? await tx.usuario.update({ where: { id: existente.id }, data: { ultimoAcessoEm: agora } })
        : await tx.usuario.create({ data: { nome, email, senhaHash: senhaHash!, perfis: ['PROFESSOR'], ativo: true, ultimoAcessoEm: agora } })
      if (!existente) await tx.professorAEE.create({ data: { usuarioId: professor.id } })
      const vinculo = await tx.vinculoEscolar.create({ data: {
        consentimentoId: consentimento.id, conviteId: achado.id, pacienteId: consentimento.pacienteId,
        professorId: professor.id, turma, turno,
        // Atuacao e da relacao: a mesma professora pode ser regente de um aluno e AEE de outro.
        atuacao: textoOuVazio(dados.atuacao) || 'Professor', status: 'ATIVO',
      } })
      return { professor, vinculo }
    })

    await this.sessoes.abrir(professor.id, 'PROFESSOR', requisicao, resposta, vaga)
    const sessaoUsuario = paraSessaoUsuario(professor, 'PROFESSOR', { vaga })
    return {
      sessaoUsuario,
      sessao: { sessaoId: '', perfilAtivo: 'PROFESSOR', usuario: professor, vaga },
      vinculoId: vinculo.id,
      pacienteId: vinculo.pacienteId,
    }
  }
}
