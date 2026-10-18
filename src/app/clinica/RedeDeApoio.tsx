import { useState, type FormEvent } from 'react'
import { Aviso } from '../../ui/Aviso'
import { Botao } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { Cartao } from '../../ui/Cartao'
import { Etiqueta } from '../../ui/Etiqueta'
import { LinkDePrimeiroAcesso } from '../../componentes/LinkDePrimeiroAcesso'
import { ErroServico, servicos, type LinkPrimeiroAcesso, type PacienteDetalhe } from '../../servicos'
import { EdicaoDoResponsavel } from './EdicaoDoResponsavel'

/**
 * Rede de apoio da ficha (tela 5), com o cadastro do responsavel (docs/07,
 * secao 0, lacuna 2). A conta nova vem com o link de primeiro acesso, que o
 * terapeuta entrega: a pessoa define a propria senha.
 *
 * O link novo so existe enquanto a pessoa nao definiu a senha. Depois disso, a
 * clinica nao troca a senha de quem autoriza o acesso da escola (regra 1).
 */

const VAZIO = { nome: '', email: '', telefone: '', parentesco: '', responsavelLegal: '' as '' | 'sim' | 'nao' }

export function RedeDeApoio({ paciente, aoMudar }: { paciente: PacienteDetalhe; aoMudar: () => void }) {
  const [aberto, setAberto] = useState(false)
  const [dados, setDados] = useState(VAZIO)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [link, setLink] = useState<{ nome: string; link: LinkPrimeiroAcesso } | null>(null)
  /** O responsavel em edicao (item 8), pelo id da conta. */
  const [editando, setEditando] = useState<string | null>(null)

  const comErro = (e: unknown) => {
    const erro = e as ErroServico
    setErros(erro instanceof ErroServico && Object.keys(erro.campos).length > 0
      ? erro.campos
      : { geral: (erro as Error).message ?? 'Não foi possível concluir agora.' })
  }

  const cadastrar = async (evento: FormEvent) => {
    evento.preventDefault()
    setAviso(null)
    setLink(null)
    // Sem escolha, nao se envia: a autoridade legal nunca e presumida.
    if (dados.responsavelLegal === '') {
      setErros({ responsavelLegal: 'Diga se é o responsável legal.' })
      return
    }
    setErros({})
    setOcupado(true)
    try {
      const { responsavel, primeiroAcesso } = await servicos.pacientes.cadastrarResponsavel(paciente.id, {
        nome: dados.nome, email: dados.email, telefone: dados.telefone, parentesco: dados.parentesco,
        responsavelLegal: dados.responsavelLegal === 'sim',
      })
      setDados(VAZIO)
      setAberto(false)
      if (primeiroAcesso) {
        setAviso(`${responsavel.nome} entrou na rede de apoio. Entregue o link abaixo: é por ele que a pessoa define a senha.`)
        setLink({ nome: responsavel.nome, link: primeiroAcesso })
      } else {
        setAviso(`${responsavel.nome} entrou na rede de apoio. A conta já existia e já entra no sistema: nenhum link foi gerado.`)
      }
      aoMudar()
    } catch (e) {
      comErro(e)
    } finally {
      setOcupado(false)
    }
  }

  const novoLink = async (responsavelId: string, nome: string) => {
    setErros({})
    setAviso(null)
    setLink(null)
    setOcupado(true)
    try {
      const gerado = await servicos.pacientes.novoLinkDoResponsavel(paciente.id, responsavelId)
      setAviso(`Novo link para ${nome}. O anterior deixou de valer.`)
      setLink({ nome, link: gerado })
    } catch (e) {
      comErro(e)
    } finally {
      setOcupado(false)
    }
  }

  const campo = 'min-h-11 w-full min-w-0 rounded-lg border-2 border-linha bg-sup px-3 py-2.5 text-tinta'
  const Erro = ({ chave }: { chave: string }) => erros[chave]
    ? <p id={`resp-${chave}-erro`} className="text-sm font-bold text-cr">{erros[chave]}</p>
    : null
  const descrito = (chave: string) => erros[chave]
    ? { 'aria-describedby': `resp-${chave}-erro`, 'aria-invalid': true as const }
    : {}

  return (
    <Cartao>
      <h2 className="text-lg font-bold">Rede de apoio</h2>
      {paciente.redeApoio.length === 0 ? (
        <p className="mt-1 text-tinta2">Nenhum responsável cadastrado ainda.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {paciente.redeApoio.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-linha bg-sup px-3 py-2.5">
              <span>
                <b>{r.nome}</b>
                <span className="block text-sm text-tinta2">{r.parentesco} · {r.telefone} · {r.email}</span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                {/* Só o responsável legal autoriza o acesso da escola. */}
                {r.responsavelLegal
                  ? <Etiqueta tom="ok" simbolo="✓">Responsável legal</Etiqueta>
                  : <Etiqueta simbolo="○">Não responde legalmente</Etiqueta>}
                {r.primeiroAcessoPendente && (
                  <>
                    <Etiqueta tom="at" simbolo="▲">Ainda não definiu a senha</Etiqueta>
                    <Botao area="cli" variante="secundaria" disabled={ocupado}
                      onClick={() => void novoLink(r.responsavelId, r.nome)}>
                      Gerar novo link
                    </Botao>
                  </>
                )}
                {editando !== r.responsavelId && (
                  <Botao area="cli" variante="secundaria" disabled={ocupado}
                    onClick={() => { setEditando(r.responsavelId); setAviso(null); setLink(null); setErros({}) }}>
                    Editar dados
                  </Botao>
                )}
              </span>
              {editando === r.responsavelId && (
                <EdicaoDoResponsavel
                  pacienteId={paciente.id}
                  pessoa={r}
                  aoCancelar={() => setEditando(null)}
                  aoSalvar={(editado) => {
                    setEditando(null)
                    setAviso(`Dados de ${editado.nome} salvos.`)
                    aoMudar()
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <div aria-live="polite" className="mt-3 flex flex-col gap-3">
        {aviso && <Aviso tom="ok" titulo="Pronto">{aviso}</Aviso>}
        {link && <LinkDePrimeiroAcesso nome={link.nome} link={link.link} />}
        {erros.geral && <Aviso tom="cr" titulo="Não foi possível concluir">{erros.geral}</Aviso>}
      </div>

      {!aberto ? (
        <p className="mt-3">
          <Botao area="cli" variante="secundaria" onClick={() => { setAberto(true); setAviso(null); setLink(null) }}>
            Cadastrar responsável
          </Botao>
        </p>
      ) : (
        <form onSubmit={(e) => void cadastrar(e)} noValidate className="mt-4 flex flex-col gap-4 border-t border-linha pt-4">
          <h3 className="text-base font-bold">Cadastrar responsável</h3>
          <div className="grid gap-3 [&>*]:min-w-0 sm:grid-cols-2">
            <Campo id="resp-nome" rotulo="Nome">
              <input id="resp-nome" className={campo} value={dados.nome} {...descrito('nome')}
                onChange={(e) => setDados((d) => ({ ...d, nome: e.target.value }))} />
              <Erro chave="nome" />
            </Campo>
            <Campo id="resp-email" rotulo="E-mail" dica="É por ele que a pessoa entra no sistema.">
              <input id="resp-email" type="email" className={campo} value={dados.email} {...descrito('email')}
                onChange={(e) => setDados((d) => ({ ...d, email: e.target.value }))} />
              <Erro chave="email" />
            </Campo>
            <Campo id="resp-telefone" rotulo="Telefone">
              <input id="resp-telefone" type="tel" className={campo} value={dados.telefone} {...descrito('telefone')}
                onChange={(e) => setDados((d) => ({ ...d, telefone: e.target.value }))} />
              <Erro chave="telefone" />
            </Campo>
            <Campo id="resp-parentesco" rotulo="Parentesco" dica="Mãe, pai, avó, tio, madrasta.">
              <input id="resp-parentesco" className={campo} value={dados.parentesco} {...descrito('parentesco')}
                onChange={(e) => setDados((d) => ({ ...d, parentesco: e.target.value }))} />
              <Erro chave="parentesco" />
            </Campo>
          </div>

          {/* Pergunta explicita, sem padrao marcado: quem autoriza a escola e o
              responsavel legal, e isso nunca se presume. */}
          <fieldset className="border-0 p-0" {...descrito('responsavelLegal')}>
            <legend className="text-sm font-bold">É o responsável legal por {paciente.nome}?</legend>
            <p className="mt-1 text-sm text-tinta2">Só o responsável legal autoriza o acesso da escola.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(['sim', 'nao'] as const).map((v) => (
                <label key={v} className="flex min-h-11 items-center gap-2.5 rounded-lg border border-linha bg-sup px-3 py-2.5 text-[15px]">
                  <input type="radio" name="resp-legal" className="h-5 w-5 flex-none" checked={dados.responsavelLegal === v}
                    onChange={() => setDados((d) => ({ ...d, responsavelLegal: v }))} />
                  {v === 'sim' ? 'Sim, responde legalmente' : 'Não'}
                </label>
              ))}
            </div>
            <Erro chave="responsavelLegal" />
          </fieldset>

          <div className="flex flex-wrap gap-2">
            <Botao area="cli" type="submit" disabled={ocupado}>{ocupado ? 'Cadastrando…' : 'Cadastrar e gerar o link'}</Botao>
            <Botao area="cli" variante="secundaria" disabled={ocupado} onClick={() => { setAberto(false); setErros({}) }}>Cancelar</Botao>
          </div>
        </form>
      )}
    </Cartao>
  )
}
