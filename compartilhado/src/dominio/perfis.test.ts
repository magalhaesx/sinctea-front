import { describe, expect, it } from 'vitest'
import { detalheDosPerfis, NOME_DO_PERFIL } from './perfis.js'

describe('os perfis com nome de tela (item 13c)', () => {
  it('o detalhe da troca de perfis usa os nomes de tela, na ordem recebida', () => {
    expect(detalheDosPerfis(['COORDENADOR', 'TERAPEUTA'])).toBe('Perfis: Coordenador clínico, Profissional da clínica')
  })

  it('nenhum nome de tela diz "terapeuta" (item 7)', () => {
    for (const nome of Object.values(NOME_DO_PERFIL)) expect(nome).not.toMatch(/terapeuta/i)
  })
})
