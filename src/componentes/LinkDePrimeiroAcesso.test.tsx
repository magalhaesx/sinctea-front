import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { LinkPrimeiroAcesso, SituacaoDoEnvio } from '../servicos'
import { LinkDePrimeiroAcesso, foiPorEmail } from './LinkDePrimeiroAcesso'

/**
 * O link que a clinica gera, nas telas 5 e 14 (item 23). O servidor diz se o
 * e-mail foi; a tela diz para onde, ou pede para copiar e entregar. Em
 * qualquer caso, o "Copiar link" fica.
 */

const semJanela = typeof window === 'undefined'
beforeAll(() => {
  // O componente monta o endereco a partir de onde o sistema esta aberto.
  if (semJanela) (globalThis as { window?: unknown }).window = { location: { href: 'http://localhost:3002/#/app/admin/usuarios' } }
})
afterAll(() => {
  if (semJanela) delete (globalThis as { window?: unknown }).window
})

const link = (situacao: SituacaoDoEnvio): LinkPrimeiroAcesso => ({
  token: 'um-token', expiraEm: '2026-11-28T14:00:00.000Z', envio: { situacao, para: 'elisa@teste.example' },
})
const tela = (situacao: SituacaoDoEnvio, finalidade?: 'NOVA_SENHA') =>
  renderToStaticMarkup(<LinkDePrimeiroAcesso nome="Elisa" link={link(situacao)} finalidade={finalidade} />)

describe('o link que a clinica gera, tambem por e-mail', () => {
  it('enviado: diz para onde, mantem o "Copiar link" e o que fazer se nao chegar', () => {
    const html = tela('ENVIADO')
    expect(html).toContain('Enviamos o link para elisa@teste.example.')
    expect(html).toContain('Se a pessoa não receber, copie e entregue.')
    expect(html).toContain('Copiar link')
    expect(html).toContain('#/app/primeiro-acesso/um-token')
    expect(html).not.toContain('Entregue este link')
    expect(foiPorEmail(link('ENVIADO'))).toBe(true)
  })

  it('falhou: pede para copiar e entregar', () => {
    const html = tela('FALHOU')
    expect(html).toContain('Não conseguimos enviar o e-mail agora. Copie o link e entregue à pessoa.')
    expect(html).toContain('Entregue este link a Elisa')
    expect(html).toContain('Copiar link')
    expect(html).not.toContain('Enviamos o link')
    expect(foiPorEmail(link('FALHOU'))).toBe(false)
  })

  it('desligado: como antes do item 23', () => {
    const html = tela('DESLIGADO')
    expect(html).toContain('Entregue este link a Elisa: é por ele que a pessoa define a própria senha')
    expect(html).not.toContain('Enviamos')
    expect(html).not.toContain('Não conseguimos')
    expect(foiPorEmail(link('DESLIGADO'))).toBe(false)
  })

  it('a nova senha diz o mesmo, com o que acontece ao usar o link', () => {
    const html = tela('ENVIADO', 'NOVA_SENHA')
    expect(html).toContain('Link para nova senha de Elisa')
    expect(html).toContain('Enviamos o link para elisa@teste.example.')
    expect(html).toContain('É por ele que a pessoa escolhe a nova senha')
    expect(html).toContain('a senha anterior deixa de valer e as sessões abertas se encerram')
  })
})
