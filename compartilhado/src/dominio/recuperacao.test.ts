import { describe, expect, it } from 'vitest'
import {
  LINK_DE_RECUPERACAO_QUE_NAO_VALE, RECUPERACOES_POR_CONTA_POR_HORA, RECUPERACOES_POR_DIA,
  RECUPERACOES_POR_ORIGEM_POR_HORA, RESPOSTA_DA_RECUPERACAO, SE_A_PESSOA_NAO_RECEBER, VALIDADE_DA_RECUPERACAO_MS,
  calcularExpiracaoRecuperacao, textoDoEnvio,
} from './recuperacao.js'
import { ENTIDADES_ADMINISTRATIVAS, ENTIDADES_AUDITADAS, NOME_DA_ENTIDADE } from './auditoria.js'

/** Item 23: "Esqueci minha senha" e os links por e-mail. */
describe('a recuperacao de senha', () => {
  it('o link vale 1 hora, contada de quando foi gerado', () => {
    const criado = new Date('2026-11-25T14:00:00.000Z')
    expect(VALIDADE_DA_RECUPERACAO_MS).toBe(3_600_000)
    expect(calcularExpiracaoRecuperacao(criado).toISOString()).toBe('2026-11-25T15:00:00.000Z')
  })

  it('os limites da caixa: 3 por conta e 10 por origem por hora, 50 por dia na clinica', () => {
    expect([RECUPERACOES_POR_CONTA_POR_HORA, RECUPERACOES_POR_ORIGEM_POR_HORA, RECUPERACOES_POR_DIA]).toEqual([3, 10, 50])
  })

  it('a resposta e uma so, e nao diz se a conta existe', () => {
    expect(RESPOSTA_DA_RECUPERACAO).toBe(
      'Se houver uma conta com esse e-mail, enviamos um link para definir uma nova senha. Ele vale por 1 hora.')
    expect(LINK_DE_RECUPERACAO_QUE_NAO_VALE).toBe('Este link não vale mais. Peça outro em Esqueci minha senha.')
  })

  it('a trilha conhece o pedido, com nome de gente, no recorte administrativo', () => {
    expect(ENTIDADES_AUDITADAS).toContain('RecuperacaoDeSenha')
    expect(ENTIDADES_ADMINISTRATIVAS).toContain('RecuperacaoDeSenha')
    expect(NOME_DA_ENTIDADE.RecuperacaoDeSenha).toBe('Pedido de nova senha')
  })
})

describe('textoDoEnvio', () => {
  it('enviado: diz para onde; a tela acrescenta o que fazer se nao chegar', () => {
    expect(textoDoEnvio({ situacao: 'ENVIADO', para: 'ana@teste.example' })).toBe('Enviamos o link para ana@teste.example.')
    expect(SE_A_PESSOA_NAO_RECEBER).toBe('Se a pessoa não receber, copie e entregue.')
  })

  it('falhou: pede para copiar e entregar', () => {
    expect(textoDoEnvio({ situacao: 'FALHOU', para: 'ana@teste.example' }))
      .toBe('Não conseguimos enviar o e-mail agora. Copie o link e entregue à pessoa.')
  })

  it('desligado: nada a dizer, a tela fica como antes do item 23', () => {
    expect(textoDoEnvio({ situacao: 'DESLIGADO', para: 'ana@teste.example' })).toBeNull()
  })
})
