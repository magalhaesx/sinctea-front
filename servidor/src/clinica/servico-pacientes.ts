import { Injectable } from '@nestjs/common'
import {
  ErroServico, type FiltroPaciente, type LinkPrimeiroAcesso, type Pagina, type PacienteDetalhe,
  type PacienteResumo, type ResponsavelCadastrado, type ResponsavelNaFicha, type SituacaoPlano,
} from '@sinctea/compartilhado'
import { anterioresQueMudaram } from '@sinctea/compartilhado/dominio/auditoria'
import { partesDaDataCivil } from '@sinctea/compartilhado/dominio/datas'
import { jsonCanonico } from '@sinctea/compartilhado/dominio/hash'
import {
  emailValido, idadeEmAnos, normalizarEmail, paraBusca, situacaoConsentimento,
} from '@sinctea/compartilhado/dominio/regras'
import { ServicoAutenticacao } from '../autenticacao/servico-autenticacao.js'
import { hashDeSenhaDesconhecida } from '../autenticacao/senhas.js'
import { ServicoBanco } from '../banco/servico-banco.js'
import { paginar, porNome } from '../http/paginacao.js'
import type { SessaoServidor } from '../http/tipos-http.js'
import { exigirUuid, exigirValido, textoOuVazio } from '../http/validacao.js'
import { alcancaClinicamente, exigirPacienteClinico } from './alcance.js'
import { comoNivel, deDataCivil, paraConsentimento, paraDataCivil, paraResponsavelNaFicha } from './mapeadores.js'
import type { Editado } from './servico-planos.js'

const EMAIL_DE_OUTRA_AREA = 'Este e-mail já é de uma conta da equipe ou da escola.'
const EMAIL_DE_OUTRA_PESSOA = 'Este e-mail já é de outra pessoa cadastrada.'
const EMAIL_E_LOGIN = 'Esta pessoa já definiu a senha: o e-mail é o login dela, e a clínica não o troca.'

const INCLUIR_FICHA = {
  equipe: { include: { profissional: { include: { usuario: true } } } },
  vinculosFamiliares: { include: { responsavel: { include: { usuario: true } } } },
  vinculosEscolares: { include: { consentimento: { include: { escola: true } }, professor: { include: { usuario: true } } } },
  planos: { select: { status: true, dataInicio: true }, orderBy: { dataInicio: 'desc' as const }, take: 1 },
  sessoes: { where: { situacao: 'ENCERRADA' as const }, select: { inicio: true } },
} as const

/**
 * Pacientes (UC01, UC03, UC07; telas 4, 5 e 6), portado de
 * src/servicos/mock/pacientes.ts, e o cadastro do responsavel na ficha
 * (docs/07, secao 0, lacuna 2).
 */
@Injectable()
export class ServicoPacientes {
  constructor(
    private readonly banco: ServicoBanco,
    private readonly autenticacao: ServicoAutenticacao,
  ) {}

  /** Terapeuta ve apenas os pacientes que acompanha; coordenador ve todos. */
  async listar(sessao: SessaoServidor, filtro: FiltroPaciente): Promise<Pagina<PacienteResumo>> {
    const busca = filtro.busca ? paraBusca(filtro.busca.trim()) : ''
    const linhas = await this.banco.paciente.findMany({
      where: {
        ativo: true,
        ...(sessao.perfilAtivo === 'COORDENADOR' ? {} : { equipe: { some: { profissionalId: sessao.usuario.id } } }),
        ...(filtro.profissionalId ? { profissionalResponsavelId: filtro.profissionalId } : {}),
        ...(filtro.nivelSuporte ? { nivelSuporte: filtro.nivelSuporte } : {}),
      },
      include: {
        equipe: true,
        profissionalResponsavel: { include: { usuario: true } },
        planos: { select: { status: true }, orderBy: { dataInicio: 'desc' }, take: 1 },
        sessoes: { where: { situacao: 'ENCERRADA' }, select: { inicio: true } },
      },
    })
    const agora = new Date()
    const itens = linhas
      // A consulta ja recorta; a regra repetida aqui e a mesma do alcance da ficha.
      .filter((p) => alcancaClinicamente(sessao, p.equipe.map((e) => e.profissionalId)))
      .filter((p) => !busca || paraBusca(p.nome).includes(busca))
      .map((p): PacienteResumo => ({
        id: p.id, nome: p.nome, idade: idadeEmAnos(paraDataCivil(p.dataNascimento), agora), nivelSuporte: comoNivel(p.nivelSuporte),
        profissionalResponsavel: { id: p.profissionalResponsavelId, nome: p.profissionalResponsavel.usuario.nome, especialidade: p.profissionalResponsavel.especialidade },
        situacaoPlano: (p.planos[0]?.status ?? 'SEM_PLANO') as SituacaoPlano,
        ultimaSessaoEm: ultimaDe(p.sessoes),
      }))
      .filter((p) => !filtro.situacaoPlano || p.situacaoPlano === filtro.situacaoPlano)
      .sort(porNome)
    return paginar(itens, filtro)
  }

  async obter(sessao: SessaoServidor, pacienteId: string): Promise<PacienteDetalhe> {
    const { id } = await exigirPacienteClinico(this.banco, sessao, pacienteId)
    return this.detalhe(id)
  }

  async criar(sessao: SessaoServidor, dados: Record<string, unknown>): Promise<PacienteDetalhe> {
    const nome = textoOuVazio(dados.nome)
    const dataNascimento = textoOuVazio(dados.dataNascimento)
    const nivelSuporte = Number(dados.nivelSuporte)
    const profissionalResponsavelId = textoOuVazio(dados.profissionalResponsavelId)
    const erros: Record<string, string> = {}
    if (!nome) erros.nome = 'Informe o nome do paciente.'
    if (!partesDaDataCivil(dataNascimento)) erros.dataNascimento = 'Informe a data de nascimento.'
    if (![1, 2, 3].includes(nivelSuporte)) erros.nivelSuporte = 'Escolha o nível de suporte.'
    const responsavel = /^[0-9a-f-]{36}$/i.test(profissionalResponsavelId)
      ? await this.banco.profissional.findUnique({ where: { usuarioId: profissionalResponsavelId }, include: { usuario: true } })
      : null
    if (!responsavel || !responsavel.usuario.ativo) erros.profissionalResponsavelId = 'Escolha o profissional responsável.'
    exigirValido(erros)

    // A equipe nasce com o responsavel pelo caso e com quem cadastrou.
    const equipe = [...new Set([profissionalResponsavelId, sessao.usuario.id])]
    const eProfissional = await this.banco.profissional.count({ where: { usuarioId: { in: equipe } } })
    const paciente = await this.banco.$transaction(async (tx) => {
      const criado = await tx.paciente.create({ data: {
        nome, dataNascimento: deDataCivil(dataNascimento), nivelSuporte, profissionalResponsavelId, ativo: true,
      } })
      const membros = eProfissional === equipe.length ? equipe : [profissionalResponsavelId]
      await tx.equipePaciente.createMany({ data: membros.map((profissionalId) => ({ pacienteId: criado.id, profissionalId })) })
      return criado
    })
    return this.detalhe(paciente.id)
  }

  /**
   * Lacuna 2. Cria a conta do responsavel, ou reaproveita a que ja tem o
   * e-mail, e o vinculo com este paciente. O parentesco e a autoridade legal
   * sao do vinculo: a mesma pessoa pode responder legalmente por um filho e
   * nao por outro (regra 1).
   */
  async cadastrarResponsavel(sessao: SessaoServidor, pacienteId: string, dados: Record<string, unknown>): Promise<ResponsavelCadastrado> {
    const paciente = await exigirPacienteClinico(this.banco, sessao, pacienteId)
    const nome = textoOuVazio(dados.nome)
    const email = normalizarEmail(textoOuVazio(dados.email))
    const telefone = textoOuVazio(dados.telefone)
    const parentesco = textoOuVazio(dados.parentesco)
    const erros: Record<string, string> = {}
    if (!nome) erros.nome = 'Escreva o nome do responsável.'
    if (!emailValido(email)) erros.email = 'Escreva um e-mail válido.'
    if (!telefone) erros.telefone = 'Escreva um telefone para contato.'
    if (!parentesco) erros.parentesco = 'Escreva o parentesco com o paciente.'
    if (typeof dados.responsavelLegal !== 'boolean') erros.responsavelLegal = 'Diga se é o responsável legal.'
    exigirValido(erros)

    const existente = await this.banco.usuario.findUnique({ where: { email }, include: { responsavel: true } })
    if (existente && !existente.responsavel) {
      throw new ErroServico('CONFLITO', EMAIL_DE_OUTRA_AREA, { email: EMAIL_DE_OUTRA_AREA })
    }
    if (existente && await this.banco.vinculoFamiliar.count({ where: { responsavelId: existente.id, pacienteId: paciente.id } }) > 0) {
      throw new ErroServico('CONFLITO', 'Esta pessoa já está na rede de apoio deste paciente.')
    }

    const senhaHash = await hashDeSenhaDesconhecida()
    const vinculo = await this.banco.$transaction(async (tx) => {
      const usuarioId = existente?.id ?? (await tx.usuario.create({ data: {
        nome, email, senhaHash, perfis: ['RESPONSAVEL'], ativo: true,
      } })).id
      if (!existente) await tx.responsavel.create({ data: { usuarioId, telefone } })
      return tx.vinculoFamiliar.create({
        data: { responsavelId: usuarioId, pacienteId: paciente.id, parentesco, responsavelLegal: dados.responsavelLegal as boolean },
        include: { responsavel: { include: { usuario: true } } },
      })
    })
    // Conta que ja entra no sistema nao recebe link: a senha dela continua dela.
    const pendente = vinculo.responsavel.usuario.ultimoAcessoEm === null
    const link = pendente ? await this.autenticacao.gerarAcessoInicial(vinculo.responsavelId) : null
    return {
      responsavel: paraResponsavelNaFicha(vinculo),
      primeiroAcesso: link && { token: link.token, expiraEm: link.expiraEm.toISOString() },
    }
  }

  /**
   * Link novo so para quem ainda nao definiu senha. A clinica nao troca a
   * senha de quem ja entra: o responsavel e quem autoriza a escola (regra 1),
   * e a conta dele nao pode passar pela mao da equipe.
   */
  async novoLinkDoResponsavel(sessao: SessaoServidor, pacienteId: string, responsavelId: string): Promise<LinkPrimeiroAcesso> {
    const paciente = await exigirPacienteClinico(this.banco, sessao, pacienteId)
    const vinculo = await this.banco.vinculoFamiliar.findFirst({
      where: { pacienteId: paciente.id, responsavelId: exigirUuid(responsavelId, 'Responsável') },
      include: { responsavel: { include: { usuario: true } } },
    })
    if (!vinculo) throw new ErroServico('NAO_ENCONTRADO', 'Responsável não encontrado na rede de apoio deste paciente.')
    if (vinculo.responsavel.usuario.ultimoAcessoEm !== null) {
      throw new ErroServico('CONFLITO', 'Esta pessoa já definiu a senha. Se esqueceu, quem troca é ela, e não a clínica.')
    }
    const link = await this.autenticacao.gerarAcessoInicial(vinculo.responsavelId)
    return { token: link.token, expiraEm: link.expiraEm.toISOString() }
  }

  /**
   * Item 8: corrige os dados do responsavel na rede de apoio. Nome e telefone
   * sao da pessoa, e mudam em todas as fichas em que ela esta; o parentesco e
   * deste vinculo. O e-mail so muda enquanto o primeiro acesso esta pendente.
   * Quem responde legalmente nao se edita aqui (limite declarado em 18/10).
   */
  async editarResponsavel(
    sessao: SessaoServidor, pacienteId: string, responsavelId: string, dados: Record<string, unknown>,
  ): Promise<Editado<ResponsavelNaFicha>> {
    const paciente = await exigirPacienteClinico(this.banco, sessao, pacienteId)
    const vinculo = await this.banco.vinculoFamiliar.findFirst({
      where: { pacienteId: paciente.id, responsavelId: exigirUuid(responsavelId, 'Responsável') },
      include: { responsavel: { include: { usuario: true } } },
    })
    if (!vinculo) throw new ErroServico('NAO_ENCONTRADO', 'Responsável não encontrado na rede de apoio deste paciente.')
    const { usuario } = vinculo.responsavel
    const antes = { nome: usuario.nome, email: usuario.email, telefone: vinculo.responsavel.telefone, parentesco: vinculo.parentesco }
    const depois = {
      nome: textoOuVazio(dados.nome),
      email: dados.email === undefined ? usuario.email : normalizarEmail(textoOuVazio(dados.email)),
      telefone: textoOuVazio(dados.telefone),
      parentesco: textoOuVazio(dados.parentesco),
    }
    const erros: Record<string, string> = {}
    if (!depois.nome) erros.nome = 'Escreva o nome do responsável.'
    if (!emailValido(depois.email)) erros.email = 'Escreva um e-mail válido.'
    if (!depois.telefone) erros.telefone = 'Escreva um telefone para contato.'
    if (!depois.parentesco) erros.parentesco = 'Escreva o parentesco com o paciente.'
    if (dados.responsavelLegal !== undefined && dados.responsavelLegal !== vinculo.responsavelLegal) {
      erros.responsavelLegal = 'Quem responde legalmente não se altera depois do cadastro.'
    }
    exigirValido(erros)

    const trocaEmail = depois.email !== antes.email
    if (trocaEmail) {
      if (usuario.ultimoAcessoEm !== null) throw new ErroServico('CONFLITO', EMAIL_E_LOGIN, { email: EMAIL_E_LOGIN })
      const dono = await this.banco.usuario.findUnique({ where: { email: depois.email }, include: { responsavel: true } })
      if (dono && !dono.responsavel) throw new ErroServico('CONFLITO', EMAIL_DE_OUTRA_AREA, { email: EMAIL_DE_OUTRA_AREA })
      if (dono) throw new ErroServico('CONFLITO', EMAIL_DE_OUTRA_PESSOA, { email: EMAIL_DE_OUTRA_PESSOA })
    }

    const anteriores = anterioresQueMudaram(antes, depois)
    if (!anteriores) return { resultado: paraResponsavelNaFicha(vinculo), pacienteId: paciente.id, valorAnterior: null }
    try {
      const editado = await this.banco.$transaction(async (tx) => {
        if (trocaEmail) {
          // A trava fica na propria gravacao: se a pessoa definiu a senha
          // enquanto a equipe editava, o e-mail ja e login e nao muda.
          const trocado = await tx.usuario.updateMany({ where: { id: usuario.id, ultimoAcessoEm: null }, data: { email: depois.email } })
          if (trocado.count !== 1) throw new ErroServico('CONFLITO', EMAIL_E_LOGIN, { email: EMAIL_E_LOGIN })
        }
        if (depois.nome !== antes.nome) await tx.usuario.update({ where: { id: usuario.id }, data: { nome: depois.nome } })
        if (depois.telefone !== antes.telefone) {
          await tx.responsavel.update({ where: { usuarioId: usuario.id }, data: { telefone: depois.telefone } })
        }
        return tx.vinculoFamiliar.update({
          where: { id: vinculo.id }, data: { parentesco: depois.parentesco },
          include: { responsavel: { include: { usuario: true } } },
        })
      })
      return { resultado: paraResponsavelNaFicha(editado), pacienteId: paciente.id, valorAnterior: jsonCanonico(anteriores) }
    } catch (erro) {
      // Dois pedidos com o mesmo e-mail ao mesmo tempo: o indice unico decide.
      if ((erro as { code?: string }).code === 'P2002') {
        throw new ErroServico('CONFLITO', EMAIL_DE_OUTRA_PESSOA, { email: EMAIL_DE_OUTRA_PESSOA })
      }
      throw erro
    }
  }

  private async detalhe(pacienteId: string): Promise<PacienteDetalhe> {
    const p = await this.banco.paciente.findUniqueOrThrow({ where: { id: pacienteId }, include: INCLUIR_FICHA })
    const agora = new Date()
    const dataNascimento = paraDataCivil(p.dataNascimento)
    return {
      id: p.id, nome: p.nome, dataNascimento, nivelSuporte: comoNivel(p.nivelSuporte),
      profissionalResponsavelId: p.profissionalResponsavelId, ativo: p.ativo,
      equipeIds: p.equipe.map((e) => e.profissionalId),
      idade: idadeEmAnos(dataNascimento, agora),
      redeApoio: p.vinculosFamiliares.map(paraResponsavelNaFicha).sort(porNome),
      equipe: p.equipe
        .map((e) => ({ id: e.profissionalId, nome: e.profissional.usuario.nome, especialidade: e.profissional.especialidade }))
        .sort(porNome),
      vinculosEscolares: p.vinculosEscolares.map((v) => ({
        vinculoId: v.id, escola: v.consentimento.escola.nome, turma: v.turma, turno: v.turno, atuacao: v.atuacao,
        professor: v.professor.usuario.nome,
        situacaoConsentimento: situacaoConsentimento(paraConsentimento(v.consentimento), agora),
      })),
      situacaoPlano: (p.planos[0]?.status ?? 'SEM_PLANO') as SituacaoPlano,
      totalSessoes: p.sessoes.length,
      ultimaSessaoEm: ultimaDe(p.sessoes),
    }
  }
}

function ultimaDe(sessoes: Array<{ inicio: Date | null }>): string | null {
  const datas = sessoes.map((s) => s.inicio).filter((d): d is Date => d !== null).map((d) => d.toISOString()).sort()
  return datas.at(-1) ?? null
}
