import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Botao } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { validarNovoObjetivo, validarNovoPlano } from '@sinctea/compartilhado/dominio/regras'
import { ErroServico, servicos, type Objetivo, type PlanoTerapeutico } from '../../servicos'

/**
 * Edicao do plano enquanto ele esta em RASCUNHO ou DEVOLVIDO (item 7): as duas
 * redacoes e o criterio de um objetivo, e as datas do plano. A trilha guarda o
 * valor anterior so do que mudou.
 *
 * REGRA 4: o formulario abre com o que o terapeuta ja escreveu, para ele
 * corrigir. Nada aqui gera, copia ou sugere a redacao acessivel a partir da
 * tecnica.
 */

const campo = 'min-h-11 w-full min-w-0 rounded-lg border-2 border-linha bg-sup px-3 py-2.5 text-tinta'
const area = 'w-full rounded-lg border-2 border-linha bg-sup px-3 py-2.5 text-tinta'

function errosDe(e: unknown, padrao: string): Record<string, string> {
  const erro = e as ErroServico
  return erro instanceof ErroServico && Object.keys(erro.campos).length > 0 ? erro.campos : { geral: erro.message ?? padrao }
}

function Erro({ erros, chave }: { erros: Record<string, string>; chave: string }) {
  return erros[chave] ? <p id={`${chave}-erro`} className="text-sm font-bold text-cr">{erros[chave]}</p> : null
}

export function EditarObjetivo({ objetivo, aoSalvar, aoCancelar }: {
  objetivo: Objetivo
  aoSalvar: (editado: Objetivo) => void
  aoCancelar: () => void
}) {
  const prefixo = `editar-${objetivo.id}`
  const [dados, setDados] = useState({
    descricaoTecnica: objetivo.descricaoTecnica,
    descricaoAcessivel: objetivo.descricaoAcessivel,
    percentualMinimo: String(objetivo.criterio.percentualMinimo),
    sessoesConsecutivas: String(objetivo.criterio.sessoesConsecutivas),
  })
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const primeiro = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { primeiro.current?.focus() }, [])

  const salvar = async (evento: FormEvent) => {
    evento.preventDefault()
    const edicao = {
      descricaoTecnica: dados.descricaoTecnica,
      descricaoAcessivel: dados.descricaoAcessivel,
      criterio: { percentualMinimo: Number(dados.percentualMinimo), sessoesConsecutivas: Number(dados.sessoesConsecutivas) },
    }
    const encontrados = validarNovoObjetivo({ dominio: objetivo.dominio, ...edicao })
    if (Object.keys(encontrados).length > 0) { setErros(encontrados); return }
    setErros({})
    setSalvando(true)
    try {
      aoSalvar(await servicos.planos.editarObjetivo(objetivo.id, edicao))
    } catch (e) {
      setErros(errosDe(e, 'Não foi possível salvar o objetivo agora.'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form className="mt-3 flex flex-col gap-4 rounded-lg border-2 border-linha p-4" onSubmit={(e) => void salvar(e)} noValidate>
      <h4 className="font-bold">Editar o objetivo</h4>
      {erros.geral && <p role="alert" className="font-bold text-cr">{erros.geral}</p>}
      {/* Item 11: em tela larga, as duas redacoes lado a lado, para comparar. */}
      <div className="grid gap-4 [&>*]:min-w-0 xl:grid-cols-2">
      <Campo id={`${prefixo}-tecnica`} rotulo="Descrição técnica" dica="Para a equipe: comportamento, condição e medida.">
        <textarea id={`${prefixo}-tecnica`} ref={primeiro} rows={3} className={area} value={dados.descricaoTecnica}
          onChange={(e) => setDados({ ...dados, descricaoTecnica: e.target.value })}
          aria-invalid={erros.descricaoTecnica ? true : undefined} />
        <Erro erros={erros} chave="descricaoTecnica" />
      </Campo>
      <Campo id={`${prefixo}-acessivel`} rotulo="Descrição acessível" dica="Em linguagem cotidiana. É esta que a família e a escola leem.">
        <textarea id={`${prefixo}-acessivel`} rows={3} className={area} value={dados.descricaoAcessivel}
          onChange={(e) => setDados({ ...dados, descricaoAcessivel: e.target.value })}
          aria-invalid={erros.descricaoAcessivel ? true : undefined} />
        <Erro erros={erros} chave="descricaoAcessivel" />
      </Campo>
      </div>
      <fieldset className="rounded-lg border border-linha p-4">
        <legend className="px-1.5 font-bold">Critério de domínio</legend>
        <div className="grid max-w-xl gap-3 sm:grid-cols-2">
          <Campo id={`${prefixo}-percentual`} rotulo="Percentual mínimo">
            <input id={`${prefixo}-percentual`} type="number" min={1} max={100} className={campo} value={dados.percentualMinimo}
              onChange={(e) => setDados({ ...dados, percentualMinimo: e.target.value })}
              aria-invalid={erros.percentualMinimo ? true : undefined} />
            <Erro erros={erros} chave="percentualMinimo" />
          </Campo>
          <Campo id={`${prefixo}-sessoes`} rotulo="Sessões consecutivas">
            <input id={`${prefixo}-sessoes`} type="number" min={1} className={campo} value={dados.sessoesConsecutivas}
              onChange={(e) => setDados({ ...dados, sessoesConsecutivas: e.target.value })}
              aria-invalid={erros.sessoesConsecutivas ? true : undefined} />
            <Erro erros={erros} chave="sessoesConsecutivas" />
          </Campo>
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Botao area="cli" type="submit" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar o objetivo'}</Botao>
        <Botao area="cli" variante="secundaria" disabled={salvando} onClick={aoCancelar}>Cancelar</Botao>
      </div>
    </form>
  )
}

export function EditarDatas({ plano, aoSalvar, aoCancelar }: {
  plano: PlanoTerapeutico
  aoSalvar: (editado: PlanoTerapeutico) => void
  aoCancelar: () => void
}) {
  const [dataInicio, setDataInicio] = useState(plano.dataInicio)
  const [dataRevisao, setDataRevisao] = useState(plano.dataRevisao)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const primeiro = useRef<HTMLInputElement>(null)
  useEffect(() => { primeiro.current?.focus() }, [])

  const salvar = async (evento: FormEvent) => {
    evento.preventDefault()
    const encontrados = validarNovoPlano({ dataInicio, dataRevisao })
    if (Object.keys(encontrados).length > 0) { setErros(encontrados); return }
    setErros({})
    setSalvando(true)
    try {
      aoSalvar(await servicos.planos.editarDatas(plano.id, { dataInicio, dataRevisao }))
    } catch (e) {
      setErros(errosDe(e, 'Não foi possível salvar as datas agora.'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form className="flex flex-col gap-4 rounded-lg border-2 border-linha p-4" onSubmit={(e) => void salvar(e)} noValidate>
      <h2 className="text-base font-bold">Editar as datas do plano</h2>
      <div className="grid max-w-xl gap-3 [&>*]:min-w-0 sm:grid-cols-2">
        <Campo id="editar-inicio" rotulo="Início do plano">
          <input id="editar-inicio" ref={primeiro} type="date" className={campo} value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)} aria-invalid={erros.dataInicio ? true : undefined} />
          <Erro erros={erros} chave="dataInicio" />
        </Campo>
        <Campo id="editar-revisao" rotulo="Revisão prevista">
          <input id="editar-revisao" type="date" className={campo} value={dataRevisao}
            onChange={(e) => setDataRevisao(e.target.value)} aria-invalid={erros.dataRevisao ? true : undefined} />
          <Erro erros={erros} chave="dataRevisao" />
        </Campo>
      </div>
      {erros.geral && <p role="alert" className="font-bold text-cr">{erros.geral}</p>}
      <div className="flex flex-wrap gap-2">
        <Botao area="cli" type="submit" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar as datas'}</Botao>
        <Botao area="cli" variante="secundaria" disabled={salvando} onClick={aoCancelar}>Cancelar</Botao>
      </div>
    </form>
  )
}
