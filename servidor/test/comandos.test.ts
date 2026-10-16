import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { conferirSenha } from '../src/autenticacao/senhas.js'
import { criarPrimeiroAdministrador } from '../src/comandos/administrador.js'
import type { PrismaClient } from '../src/gerado/client.js'
import { clienteDe, criarBancoMigrado } from './apoio/banco.js'

/**
 * O comando do primeiro administrador (docs/07, secao 0), pela funcao que ele
 * chama, num banco vazio: e assim que a producao nasce.
 */

let prisma: PrismaClient
let apagar: () => Promise<void>

beforeAll(async () => {
  const banco = await criarBancoMigrado(inject('urlAdministrativa'), 'sinctea_comandos')
  apagar = banco.apagar
  prisma = clienteDe(banco.url)
})

afterAll(async () => {
  await prisma?.$disconnect()
  await apagar?.()
})

describe('criar o primeiro administrador', () => {
  it('recusa dado invalido sem criar nada', async () => {
    await expect(criarPrimeiroAdministrador(prisma, { nome: ' ', email: 'adm@teste.example', senha: 'senha-longa-ok' }))
      .rejects.toThrow(/nome/)
    await expect(criarPrimeiroAdministrador(prisma, { nome: 'Adm', email: 'sem-arroba', senha: 'senha-longa-ok' }))
      .rejects.toThrow(/e-mail/)
    await expect(criarPrimeiroAdministrador(prisma, { nome: 'Adm', email: 'adm@teste.example', senha: 'curta' }))
      .rejects.toThrow(/ao menos 8/)
    expect(await prisma.usuario.count()).toBe(0)
  })

  it('cria a conta com senha em argon2id, e-mail em minusculas e a criacao na trilha', async () => {
    const criado = await criarPrimeiroAdministrador(prisma, {
      nome: '  Pessoa Administradora ', email: ' Adm@Teste.EXAMPLE ', senha: 'a-senha-do-administrador',
    })
    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: criado.id }, include: { profissional: true } })
    expect(usuario).toMatchObject({ nome: 'Pessoa Administradora', email: 'adm@teste.example', perfis: ['ADMINISTRADOR'], ativo: true })
    expect(usuario.senhaHash).toMatch(/^\$argon2id\$/)
    expect(usuario.senhaHash).not.toContain('a-senha-do-administrador')
    expect(await conferirSenha(usuario.senhaHash, 'a-senha-do-administrador')).toBe(true)
    // O registro no conselho e do dono: nasce em branco.
    expect(usuario.profissional).toMatchObject({ especialidade: '', registroConselho: '' })
    expect(await prisma.registroAuditoria.findFirst({ where: { idEntidade: criado.id } }))
      .toMatchObject({ acao: 'CRIACAO', entidade: 'Usuario', origem: 'SISTEMA', usuarioId: null })
  })

  it('recusa um segundo administrador: o proximo nasce pela gestao de usuarios', async () => {
    await expect(criarPrimeiroAdministrador(prisma, { nome: 'Outra', email: 'outra@teste.example', senha: 'outra-senha-longa' }))
      .rejects.toThrow(/Já existe administrador/)
    expect(await prisma.usuario.count()).toBe(1)
  })

  it('o banco recusa e-mail com maiuscula, mesmo vindo por fora do comando', async () => {
    await expect(prisma.usuario.create({ data: {
      nome: 'Maiuscula', email: 'Maiuscula@teste.example', senhaHash: 'x', perfis: ['TERAPEUTA'], ativo: true,
    } })).rejects.toThrow(/usuario_email_minusculo/)
  })
})
