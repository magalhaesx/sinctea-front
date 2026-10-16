import { ErroServico } from '@sinctea/compartilhado'
import { origemDoPerfil } from '@sinctea/compartilhado/dominio/auditoria'
import { emailValido, erroDaSenhaNova, normalizarEmail } from '@sinctea/compartilhado/dominio/regras'
import { hashDaSenha } from '../autenticacao/senhas.js'
import type { PrismaClient } from '../gerado/client.js'

export interface DadosDoAdministrador {
  nome: string
  email: string
  senha: string
}

/**
 * Como o sistema nasce (docs/07, secao 0): a unica conta que nao vem das telas.
 * Recusa se ja houver administrador — o segundo nasce pela gestao de usuarios,
 * pelas maos do primeiro. A senha vira argon2id; quem roda o comando e quem a
 * escolhe, e ela nao fica em lugar nenhum alem do hash.
 */
export async function criarPrimeiroAdministrador(banco: PrismaClient, dados: DadosDoAdministrador): Promise<{ id: string; email: string }> {
  const nome = dados.nome.trim()
  const email = normalizarEmail(dados.email)
  const erros: Record<string, string> = {}
  if (!nome) erros.nome = 'Escreva o nome do administrador.'
  if (!emailValido(email)) erros.email = 'Escreva um e-mail válido.'
  const erroSenha = erroDaSenhaNova(dados.senha)
  if (erroSenha) erros.senha = erroSenha
  if (Object.keys(erros).length > 0) throw new ErroServico('VALIDACAO', Object.values(erros)[0], erros)

  const senhaHash = await hashDaSenha(dados.senha)
  return banco.$transaction(async (tx) => {
    if (await tx.usuario.count({ where: { perfis: { has: 'ADMINISTRADOR' } } }) > 0) {
      throw new ErroServico('CONFLITO', 'Já existe administrador. O próximo é cadastrado por ele, na gestão de usuários.')
    }
    if (await tx.usuario.count({ where: { email } }) > 0) {
      throw new ErroServico('CONFLITO', 'Já existe uma conta com este e-mail.')
    }
    const usuario = await tx.usuario.create({ data: {
      nome, email, senhaHash, perfis: ['ADMINISTRADOR'], ativo: true,
    } })
    // Especialidade e registro em branco: quem completa e o proprio dono, em
    // Perfil e preferencias, nunca a administracao (CLAUDE.md).
    await tx.profissional.create({ data: { usuarioId: usuario.id, especialidade: '', registroConselho: '' } })
    await tx.registroAuditoria.create({ data: {
      ocorridoEm: new Date(), usuarioId: null, usuarioNome: null, perfil: null,
      acao: 'CRIACAO', entidade: 'Usuario', idEntidade: usuario.id, pacienteId: null,
      origem: origemDoPerfil(null), ipOrigem: null,
      detalhe: `Primeiro administrador criado pelo comando criar-administrador (${email}).`,
      valorAnterior: null,
    } })
    return { id: usuario.id, email }
  })
}
