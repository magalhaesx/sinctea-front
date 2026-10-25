import { useEffect, useState, type FormEvent } from 'react'
import { Botao } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { emData } from '@sinctea/compartilhado/dominio/datas'
import { itensPreenchidos, validarCartao } from '@sinctea/compartilhado/dominio/regras'
import { ErroServico, servicos, type CartaoEstrategia, type DadosCartao } from '../../servicos'

/**
 * Cartoes de estrategias de um objetivo (tela 6; docs/07, secao 0, lacuna 5).
 * E o que a escola le. O terapeuta escreve tudo: nada vem do objetivo, nem a
 * redacao acessivel (regra 4). O rascunho fica no formulario ate salvar — no
 * banco, nao existe cartao em branco.
 */

const VAZIO: DadosCartao = { tituloSimples: '', oQueFazer: [''], oQueEvitar: [''], sinalAlerta: '' }

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'pronto'; cartoes: CartaoEstrategia[] }

export function CartoesDoObjetivo({ objetivoId }: { objetivoId: string }) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)
  /** null: formulario fechado; 'novo': criando; id: editando aquele cartao. */
  const [editando, setEditando] = useState<string | null>(null)
  const [dados, setDados] = useState<DadosCartao>(VAZIO)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    let ativo = true
    servicos.planos.listarCartoes(objetivoId)
      .then((cartoes) => { if (ativo) setEstado({ tipo: 'pronto', cartoes }) })
      .catch(() => { if (ativo) setEstado({ tipo: 'erro' }) })
    return () => { ativo = false }
  }, [objetivoId, tentativa])

  const abrir = (cartao?: CartaoEstrategia) => {
    setErros({})
    setEditando(cartao?.id ?? 'novo')
    setDados(cartao
      ? { tituloSimples: cartao.tituloSimples, oQueFazer: [...cartao.oQueFazer, ''], oQueEvitar: [...cartao.oQueEvitar, ''], sinalAlerta: cartao.sinalAlerta }
      : VAZIO)
  }

  const salvar = async (evento: FormEvent) => {
    evento.preventDefault()
    const encontrados = validarCartao(dados)
    if (Object.keys(encontrados).length > 0) { setErros(encontrados); return }
    setErros({})
    setSalvando(true)
    const conteudo = { ...dados, oQueFazer: itensPreenchidos(dados.oQueFazer), oQueEvitar: itensPreenchidos(dados.oQueEvitar) }
    try {
      if (editando === 'novo') await servicos.planos.criarCartao(objetivoId, conteudo)
      else if (editando) await servicos.planos.editarCartao(editando, conteudo)
      setEditando(null)
      setTentativa((t) => t + 1)
    } catch (e) {
      const erro = e as ErroServico
      setErros(erro instanceof ErroServico && Object.keys(erro.campos).length > 0
        ? erro.campos
        : { geral: erro.message ?? 'Não foi possível salvar o cartão agora.' })
    } finally {
      setSalvando(false)
    }
  }

  const campo = 'min-h-11 w-full min-w-0 rounded-lg border-2 border-linha bg-sup px-3 py-2.5 text-tinta'
  const prefixo = `cartao-${objetivoId}`

  /**
   * Lista editavel: cada item e um campo, e sempre ha um em branco no fim para
   * o proximo. Funcao, e nao componente: um componente declarado aqui dentro
   * seria outro a cada tecla, e o campo perderia o foco.
   */
  const lista = (chave: 'oQueFazer' | 'oQueEvitar', rotulo: string, dica: string) => (
    <fieldset className="border-0 p-0">
      <legend className="text-sm font-bold">{rotulo}</legend>
      <p className="mt-1 text-sm text-tinta2">{dica}</p>
      <ol className="mt-2 flex flex-col gap-2">
        {dados[chave].map((item, i) => (
          <li key={i}>
            <label className="sr-only" htmlFor={`${prefixo}-${chave}-${i}`}>{rotulo}, item {i + 1}</label>
            <input id={`${prefixo}-${chave}-${i}`} className={campo} value={item}
              onChange={(e) => setDados((d) => {
                const lista = [...d[chave]]
                lista[i] = e.target.value
                if (i === lista.length - 1 && e.target.value.trim()) lista.push('')
                return { ...d, [chave]: lista }
              })} />
          </li>
        ))}
      </ol>
      {erros[chave] && <p className="mt-1 text-sm font-bold text-cr">{erros[chave]}</p>}
    </fieldset>
  )

  return (
    <div className="mt-3 border-t border-linha pt-3">
      <h4 className="text-[15px] font-bold">Cartão de estratégias para a escola</h4>

      {estado.tipo === 'carregando' && <p className="mt-1 text-sm text-tinta2">Carregando os cartões…</p>}
      {estado.tipo === 'erro' && (
        <p className="mt-1 text-sm text-tinta2">
          Não foi possível carregar os cartões.{' '}
          <button type="button" className="font-bold text-cli-ink underline" onClick={() => setTentativa((t) => t + 1)}>Tentar de novo</button>
        </p>
      )}
      {estado.tipo === 'pronto' && estado.cartoes.length === 0 && editando === null && (
        <p className="mt-1 text-sm text-tinta2">Nenhum cartão ainda: a escola não lê nada sobre este objetivo.</p>
      )}
      {estado.tipo === 'pronto' && estado.cartoes.map((c) => editando !== c.id && (
        <div key={c.id} className="mt-2 rounded-lg border border-linha bg-sup p-3 text-[15px]">
          <p className="font-bold">{c.tituloSimples}</p>
          <p className="mt-1 text-sm"><b>O que ajuda:</b> {c.oQueFazer.join('; ')}</p>
          <p className="text-sm"><b>O que evitar:</b> {c.oQueEvitar.join('; ')}</p>
          <p className="text-sm"><b>Sinal de alerta:</b> {c.sinalAlerta}</p>
          <p className="mt-1 text-sm text-tinta2">Atualizado em {emData(c.atualizadoEm)}.</p>
          <Botao area="cli" variante="secundaria" className="mt-2" onClick={() => abrir(c)}>Editar cartão</Botao>
        </div>
      ))}

      {editando === null ? (
        <p className="mt-2">
          <Botao area="cli" variante="secundaria" onClick={() => abrir()}>Escrever cartão</Botao>
        </p>
      ) : (
        <form onSubmit={(e) => void salvar(e)} noValidate className="mt-3 flex max-w-4xl flex-col gap-4">
          <Campo id={`${prefixo}-titulo`} rotulo="Título, em linguagem simples" dica="É o que a professora lê primeiro.">
            <input id={`${prefixo}-titulo`} className={campo} value={dados.tituloSimples}
              onChange={(e) => setDados((d) => ({ ...d, tituloSimples: e.target.value }))} />
            {erros.tituloSimples && <p className="text-sm font-bold text-cr">{erros.tituloSimples}</p>}
          </Campo>
          {lista('oQueFazer', 'O que ajuda', 'Uma ação por linha. Ao preencher a última, aparece outra.')}
          {lista('oQueEvitar', 'O que evitar', 'Uma por linha.')}
          <Campo id={`${prefixo}-sinal`} rotulo="Sinal de alerta" dica="O que mostra que a criança precisa de apoio agora.">
            <input id={`${prefixo}-sinal`} className={campo} value={dados.sinalAlerta}
              onChange={(e) => setDados((d) => ({ ...d, sinalAlerta: e.target.value }))} />
            {erros.sinalAlerta && <p className="text-sm font-bold text-cr">{erros.sinalAlerta}</p>}
          </Campo>
          {erros.geral && <p role="alert" className="font-bold text-cr">{erros.geral}</p>}
          <div className="flex flex-wrap gap-2">
            <Botao area="cli" type="submit" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar cartão'}</Botao>
            <Botao area="cli" variante="secundaria" disabled={salvando} onClick={() => setEditando(null)}>Cancelar</Botao>
          </div>
        </form>
      )}
    </div>
  )
}
