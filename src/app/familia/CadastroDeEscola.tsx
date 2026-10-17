import { useEffect, useRef, useState } from 'react'
import { REDES_DE_ENSINO } from '@sinctea/compartilhado'
import { Botao } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { servicos, type Escola } from '../../servicos'

/**
 * A escola que nao esta na lista, cadastrada pela familia (docs/07, secao 0,
 * lacuna 4). Antes de criar, mostra as escolas parecidas do mesmo municipio:
 * "EM Vitoria Regia" e "Escola Municipal Vitoria-Regia" sao a mesma, e duas
 * linhas para a mesma escola espalhariam as autorizacoes. Quem decide se e a
 * mesma e a familia.
 *
 * Fica dentro do formulario da tela 17, por isso nao e um <form>: os botoes
 * sao do tipo "button", e Enter num campo daqui nao envia a autorizacao.
 */
export function CadastroDeEscola({ campo, focar, aoEscolher, aoCancelar }: {
  campo: string
  /** So quando a pessoa abriu o cadastro. Aberto na carga da pagina, o foco
   *  saltaria o titulo, e o leitor de tela comecaria pelo meio. */
  focar: boolean
  aoEscolher: (escola: Escola) => void
  aoCancelar?: () => void
}) {
  const [nome, setNome] = useState('')
  const [rede, setRede] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [erros, setErros] = useState<Record<string, string>>({})
  const [parecidas, setParecidas] = useState<Escola[] | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const primeiroCampo = useRef<HTMLInputElement>(null)
  const caixaParecidas = useRef<HTMLDivElement>(null)

  useEffect(() => { if (focar) primeiroCampo.current?.focus() }, [focar])
  useEffect(() => { if (parecidas?.length) caixaParecidas.current?.focus() }, [parecidas])

  const falhou = (e: unknown) => {
    const erro = e as { campos?: Record<string, string>; message?: string }
    setErros(erro.campos && Object.keys(erro.campos).length > 0
      ? erro.campos
      : { geral: erro.message ?? 'Não foi possível cadastrar agora.' })
  }

  const cadastrar = async () => {
    setOcupado(true)
    try {
      aoEscolher(await servicos.escolas.cadastrar({ nome, rede, municipio }))
    } catch (e) {
      falhou(e)
      setParecidas(null)
    } finally {
      setOcupado(false)
    }
  }

  const procurar = async () => {
    const encontrados: Record<string, string> = {}
    if (!nome.trim()) encontrados.nome = 'Escreva o nome da escola.'
    if (!rede) encontrados.rede = 'Escolha a rede de ensino.'
    if (!municipio.trim()) encontrados.municipio = 'Escreva o município.'
    setErros(encontrados)
    if (Object.keys(encontrados).length > 0) return
    setOcupado(true)
    try {
      const achadas = await servicos.escolas.parecidas(nome, municipio)
      if (achadas.length > 0) { setParecidas(achadas); setOcupado(false); return }
    } catch (e) {
      falhou(e)
      setOcupado(false)
      return
    }
    await cadastrar()
  }

  if (parecidas && parecidas.length > 0) {
    return (
      <div ref={caixaParecidas} tabIndex={-1} className="rounded-lg border-2 border-linha p-4">
        <h3 className="font-bold">É uma destas?</h3>
        <p className="mt-1 text-sm text-tinta2">
          Já existem escolas com nome parecido em {municipio.trim()}. Se a do seu filho for uma
          delas, escolha-a: assim as autorizações ficam todas na mesma escola.
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {parecidas.map((e) => (
            <li key={e.id}>
              <Botao area="fam" variante="secundaria" className="w-full justify-start text-left"
                onClick={() => aoEscolher(e)}>
                É esta: {e.nome} · {e.rede} · {e.municipio}
              </Botao>
            </li>
          ))}
        </ul>
        <Botao area="fam" className="mt-3 w-full" disabled={ocupado} onClick={() => void cadastrar()}>
          {ocupado ? 'Cadastrando…' : `Não, cadastrar "${nome.trim()}"`}
        </Botao>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border-2 border-linha p-4">
      <h3 className="font-bold">Cadastrar a escola</h3>
      <Campo id="nova-escola-nome" rotulo="Nome da escola" dica="Como está escrito na fachada ou nos documentos da escola.">
        <input id="nova-escola-nome" ref={primeiroCampo} className={campo} value={nome} maxLength={200}
          aria-describedby="nova-escola-nome-dica" onChange={(e) => setNome(e.target.value)} />
        {erros.nome && <p className="text-sm font-bold text-cr">{erros.nome}</p>}
      </Campo>
      <Campo id="nova-escola-rede" rotulo="Rede de ensino">
        <select id="nova-escola-rede" className={campo} value={rede} onChange={(e) => setRede(e.target.value)}>
          <option value="">Escolha a rede</option>
          {REDES_DE_ENSINO.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        {erros.rede && <p className="text-sm font-bold text-cr">{erros.rede}</p>}
      </Campo>
      <Campo id="nova-escola-municipio" rotulo="Município">
        <input id="nova-escola-municipio" className={campo} value={municipio} maxLength={120}
          onChange={(e) => setMunicipio(e.target.value)} />
        {erros.municipio && <p className="text-sm font-bold text-cr">{erros.municipio}</p>}
      </Campo>
      {erros.geral && <p role="alert" className="font-bold text-cr">{erros.geral}</p>}
      <Botao area="fam" className="w-full" disabled={ocupado} onClick={() => void procurar()}>
        {ocupado ? 'Procurando…' : 'Cadastrar a escola'}
      </Botao>
      {aoCancelar && (
        <Botao area="fam" variante="secundaria" className="w-full" disabled={ocupado} onClick={aoCancelar}>
          Voltar para a lista
        </Botao>
      )}
    </div>
  )
}
