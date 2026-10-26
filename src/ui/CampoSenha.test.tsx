import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CaixaDaSenha, CampoSenha } from './CampoSenha'
import { esconderAoEnviar, proximaVisibilidade, tipoDoCampo } from './olhoDaSenha'

/**
 * O botao de olho do campo de senha (item 14). Os testes do front rodam no
 * Node, sem navegador: a marcacao sai do renderToStaticMarkup, e o envio do
 * formulario e um evento de verdade, num EventTarget do proprio Node.
 */

const caixa = (visivel: boolean) => renderToStaticMarkup(
  <CaixaDaSenha id="senha" autoComplete="current-password" visivel={visivel} aoAlternar={() => {}} />,
)

const botao = (html: string) => html.match(/<button[^>]*>/)![0]
const campo = (html: string) => html.match(/<input[^>]*>/)![0]

describe('o botao de olho do campo de senha (item 14)', () => {
  it('o campo comeca escondido, com o botao sem pressionar', () => {
    const html = renderToStaticMarkup(<CampoSenha id="senha" autoComplete="current-password" />)
    expect(campo(html)).toContain('type="password"')
    expect(botao(html)).toContain('aria-pressed="false"')
    expect(botao(html)).toContain('aria-label="Mostrar senha"')
  })

  it('alternar troca o tipo do campo entre password e text, e o aria-pressed acompanha', () => {
    expect(proximaVisibilidade(false, 'alternar')).toBe(true)
    expect(proximaVisibilidade(true, 'alternar')).toBe(false)
    expect(tipoDoCampo(false)).toBe('password')
    expect(tipoDoCampo(true)).toBe('text')

    const escondida = caixa(false)
    expect(campo(escondida)).toContain('type="password"')
    expect(botao(escondida)).toContain('aria-pressed="false"')

    const mostrada = caixa(true)
    expect(campo(mostrada)).toContain('type="text"')
    expect(botao(mostrada)).toContain('aria-pressed="true"')
    // O rotulo nao muda com o estado: o aria-pressed e que diz.
    expect(botao(mostrada)).toContain('aria-label="Mostrar senha"')
  })

  it('o olho aberto mostra a senha; o olho cortado a esconde', () => {
    expect(caixa(false)).not.toContain('M3 3l18 18')
    expect(caixa(true)).toContain('M3 3l18 18')
    expect(caixa(true)).toMatch(/<svg[^>]*aria-hidden="true"/)
  })

  it('o botao nao envia o formulario: e type="button", e o envio continua so com o botao de enviar', () => {
    const html = renderToStaticMarkup(
      <form>
        <CampoSenha id="senha" autoComplete="current-password" />
        <button type="submit">Entrar</button>
      </form>,
    )
    expect(botao(html)).toContain('type="button"')
    expect(html.match(/type="submit"/g)).toHaveLength(1)
  })

  it('o campo fica com o mesmo id, que o liga ao rotulo, e o mesmo aria-describedby de erro', () => {
    const html = renderToStaticMarkup(
      <CampoSenha id="senha" autoComplete="new-password" aria-describedby="erro-senha" className="px-3" />,
    )
    expect(campo(html)).toContain('id="senha"')
    expect(campo(html)).toContain('aria-describedby="erro-senha"')
    // O React escreve autoComplete; no HTML, o nome do atributo nao diferencia maiusculas.
    expect(campo(html)).toMatch(/autocomplete="new-password"/i)
    expect(botao(html)).toContain('aria-controls="senha"')
    // Espaco a direita para o texto nao passar por baixo do icone.
    expect(campo(html)).toMatch(/class="[^"]*\bpr-12\b/)
  })

  it('ao enviar o formulario, a senha volta a ficar escondida, ja no proprio evento', () => {
    const formulario = new EventTarget()
    const senha = { type: 'text', form: formulario }
    let escondeu = 0
    const parar = esconderAoEnviar(senha, () => { escondeu += 1 })

    formulario.dispatchEvent(new Event('submit'))
    expect(senha.type).toBe('password')
    expect(escondeu).toBe(1)
    expect(proximaVisibilidade(true, 'enviar')).toBe(false)
    expect(proximaVisibilidade(false, 'enviar')).toBe(false)

    // Desmontado o campo, o envio nao mexe mais nele.
    parar()
    senha.type = 'text'
    formulario.dispatchEvent(new Event('submit'))
    expect(senha.type).toBe('text')
    expect(escondeu).toBe(1)
  })

  it('campo fora de formulario nao quebra', () => {
    expect(() => esconderAoEnviar({ type: 'text', form: null }, () => {})()).not.toThrow()
  })
})
