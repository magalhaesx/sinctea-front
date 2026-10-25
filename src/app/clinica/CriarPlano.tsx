import { useState, type FormEvent } from 'react'
import { Botao } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { Cartao } from '../../ui/Cartao'
import { diaCivilEm } from '@sinctea/compartilhado/dominio/datas'
import { validarNovoPlano } from '@sinctea/compartilhado/dominio/regras'
import { ErroServico, servicos } from '../../servicos'

/**
 * Paciente sem plano (tela 6): o plano nasce em RASCUNHO, com a data de inicio
 * e a da revisao (docs/07, secao 0, lacuna 3). Os objetivos entram depois, no
 * proprio plano.
 */

/** Seis meses depois, como sugestao: quem decide a revisao e o terapeuta. */
function seisMesesDepois(dia: string): string {
  const [ano, mes, d] = dia.split('-').map(Number)
  const alvo = new Date(Date.UTC(ano, mes - 1 + 6, d))
  return alvo.toISOString().slice(0, 10)
}

export function CriarPlano({ pacienteId, aoCriar }: { pacienteId: string; aoCriar: () => void }) {
  const hoje = diaCivilEm(new Date())
  const [dataInicio, setDataInicio] = useState(hoje)
  const [dataRevisao, setDataRevisao] = useState(seisMesesDepois(hoje))
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)

  const criar = async (evento: FormEvent) => {
    evento.preventDefault()
    const encontrados = validarNovoPlano({ dataInicio, dataRevisao })
    if (Object.keys(encontrados).length > 0) { setErros(encontrados); return }
    setErros({})
    setSalvando(true)
    try {
      await servicos.planos.criar(pacienteId, { dataInicio, dataRevisao })
      aoCriar()
    } catch (e) {
      const erro = e as ErroServico
      setErros(erro instanceof ErroServico && Object.keys(erro.campos).length > 0
        ? erro.campos
        : { geral: erro.message ?? 'Não foi possível criar o plano agora.' })
    } finally {
      setSalvando(false)
    }
  }

  const campo = 'min-h-11 w-full min-w-0 rounded-lg border-2 border-linha bg-sup px-3 py-2.5 text-tinta'

  return (
    <Cartao>
      <p className="text-tinta2">
        Este paciente ainda não tem plano terapêutico. O plano nasce em rascunho; os objetivos entram
        nele, e depois ele segue para a coordenação validar.
      </p>
      <form onSubmit={(e) => void criar(e)} noValidate className="mt-4 flex flex-col gap-4">
        <div className="grid max-w-xl gap-3 [&>*]:min-w-0 sm:grid-cols-2">
          <Campo id="plano-inicio" rotulo="Início do plano">
            <input id="plano-inicio" type="date" className={campo} value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)} aria-invalid={erros.dataInicio ? true : undefined} />
            {erros.dataInicio && <p className="text-sm font-bold text-cr">{erros.dataInicio}</p>}
          </Campo>
          <Campo id="plano-revisao" rotulo="Revisão prevista" dica="Sugerimos seis meses depois do início.">
            <input id="plano-revisao" type="date" className={campo} value={dataRevisao}
              onChange={(e) => setDataRevisao(e.target.value)} aria-invalid={erros.dataRevisao ? true : undefined} />
            {erros.dataRevisao && <p className="text-sm font-bold text-cr">{erros.dataRevisao}</p>}
          </Campo>
        </div>
        {erros.geral && <p role="alert" className="font-bold text-cr">{erros.geral}</p>}
        <div>
          <Botao area="cli" type="submit" disabled={salvando}>{salvando ? 'Criando…' : 'Criar plano'}</Botao>
        </div>
      </form>
    </Cartao>
  )
}
