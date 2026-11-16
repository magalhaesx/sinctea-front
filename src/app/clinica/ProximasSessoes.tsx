import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Aviso } from '../../ui/Aviso'
import { Botao } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { Cartao } from '../../ui/Cartao'
import { EstadoCarregando } from '../../ui/EstadoCarregando'
import { EstadoErro } from '../../ui/EstadoErro'
import { Paginacao } from '../../ui/Paginacao'
import { diaCivilEm, emDataCivil } from '@sinctea/compartilhado/dominio/datas'
import {
  LOCAL_MAXIMO, LOCAL_PADRAO, diaDoAgendamento, horaEmManaus, instanteEmManaus, quandoEmManaus, ultimoDiaAgendavel,
  validarAgendamento,
} from '@sinctea/compartilhado/dominio/agenda'
import { CancelarAgendamento } from './CancelarAgendamento'
import { ErroServico, servicos, type ItemAgenda, type Pagina } from '../../servicos'

/**
 * As proximas sessoes do paciente, na ficha (tela 5, item 19b): os
 * agendamentos de hoje em diante, de qualquer profissional. "Cancelar" so no
 * de quem esta na sessao — quem vai conduzir; o servidor recusa os demais.
 *
 * "Agendar sessao" agenda para quem esta na sessao. Data e hora sao de
 * Manaus, como na agenda; a validacao e validarAgendamento, a mesma do
 * servidor, e os erros dele voltam para o campo: o horario sob a data e a
 * hora, o local sob o local.
 */

const POR_PAGINA = 5

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'pronto'; dados: Pagina<ItemAgenda> }

const VAZIO = { data: '', hora: '', local: LOCAL_PADRAO }

export function ProximasSessoes({ pacienteId, primeiroNome, usuarioId }: {
  pacienteId: string
  primeiroNome: string
  usuarioId: string | undefined
}) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  const [pagina, setPagina] = useState(1)
  const [tentativa, setTentativa] = useState(0)
  const [aviso, setAviso] = useState<string | null>(null)
  const [agendando, setAgendando] = useState(false)
  const [campos, setCampos] = useState(VAZIO)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const campoData = useRef<HTMLInputElement>(null)
  const botaoAgendar = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let ativo = true
    // Depois de agendar ou cancelar, a lista continua na tela enquanto se atualiza.
    setEstado((atual) => (atual.tipo === 'pronto' && atual.dados.pagina === pagina ? atual : { tipo: 'carregando' }))
    servicos.sessoes.listarProximas(pacienteId, { pagina, porPagina: POR_PAGINA })
      .then((dados) => { if (ativo) setEstado({ tipo: 'pronto', dados }) })
      .catch((erro) => { if (ativo) setEstado({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [pacienteId, pagina, tentativa])

  useEffect(() => {
    if (agendando) campoData.current?.focus()
  }, [agendando])

  const fechar = () => {
    setAgendando(false)
    setErros({})
    setCampos(VAZIO)
    setTimeout(() => botaoAgendar.current?.focus())
  }

  const agendar = async (evento: FormEvent) => {
    evento.preventDefault()
    setAviso(null)
    // A mesma regra do servidor, antes de ir a ele.
    const novos: Record<string, string> = {}
    if (!campos.data) novos.data = 'Informe a data.'
    if (!campos.hora) novos.hora = 'Informe a hora.'
    const inicio = campos.data && campos.hora ? instanteEmManaus(campos.data, campos.hora) : null
    if (campos.data && campos.hora && !inicio) novos.data = 'Confira a data e a hora.'
    const dados = { inicioPrevistoEm: inicio?.toISOString() ?? '', local: campos.local }
    const doDominio = validarAgendamento(dados, new Date())
    if (inicio && doDominio.inicioPrevistoEm) novos.quando = doDominio.inicioPrevistoEm
    if (doDominio.local) novos.local = doDominio.local
    setErros(novos)
    if (Object.keys(novos).length > 0) return

    setEnviando(true)
    try {
      const sessao = await servicos.sessoes.agendar(pacienteId, dados)
      setAviso(`Sessão agendada para ${quandoEmManaus(sessao.inicioPrevistoEm)}, em ${sessao.local}.`)
      fechar()
      setPagina(1)
      setTentativa((t) => t + 1)
    } catch (e) {
      if (e instanceof ErroServico && Object.keys(e.campos).length > 0) {
        const { inicioPrevistoEm, ...resto } = e.campos
        setErros({ ...resto, ...(inicioPrevistoEm ? { quando: inicioPrevistoEm } : {}) })
      } else {
        setErros({ geral: (e as Error).message || 'Não foi possível agendar agora.' })
      }
    } finally {
      setEnviando(false)
    }
  }

  const campo = 'min-h-11 w-full rounded-lg border-2 border-linha bg-sup px-3 py-2.5 text-tinta'
  const descrito = (chave: string, ...outros: string[]) => {
    const ids = [...outros, ...(erros[chave] ? [`ag-${chave}-erro`] : [])]
    return { ...(ids.length > 0 ? { 'aria-describedby': ids.join(' ') } : {}), ...(erros[chave] ? { 'aria-invalid': true as const } : {}) }
  }
  const Erro = ({ chave }: { chave: string }) => erros[chave]
    ? <p id={`ag-${chave}-erro`} className="text-sm font-bold text-cr">{erros[chave]}</p>
    : null
  const hoje = diaCivilEm(new Date())

  return (
    <Cartao>
      <h2 className="text-lg font-bold">Próximas sessões</h2>
      <p className="mt-1 text-sm text-tinta2">De hoje em diante, com todos os profissionais da equipe.</p>

      <div aria-live="polite">
        {aviso && <div className="mt-3"><Aviso tom="ok" titulo="Pronto">{aviso}</Aviso></div>}
      </div>

      {estado.tipo === 'carregando' && (
        <div className="mt-3"><EstadoCarregando forma="lista" linhas={2} rotulo="Carregando as próximas sessões" /></div>
      )}

      {estado.tipo === 'erro' && (
        <div className="mt-3">
          <EstadoErro erro={estado.erro} oQue="as próximas sessões" nivel={3} aoTentarDeNovo={() => setTentativa((t) => t + 1)} />
        </div>
      )}

      {estado.tipo === 'pronto' && (
        estado.dados.total === 0 ? (
          // Sem EstadoVazio: a acao que ele ofereceria, agendar, esta logo abaixo.
          <p className="mt-3 text-tinta2">Nenhuma sessão agendada para {primeiroNome}.</p>
        ) : (
          <>
            <ul className="mt-3 grid items-start gap-2 [&>*]:min-w-0 lg:grid-cols-2 2xl:grid-cols-3">
              {estado.dados.itens.map((i) => {
                const quando = `${emDataCivil(diaDoAgendamento(i.inicioPrevistoEm))} às ${horaEmManaus(i.inicioPrevistoEm)}`
                return (
                  <li key={i.sessaoId} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-linha bg-sup px-3 py-2.5">
                    <span>
                      <b className="tabular-nums">{quando}</b> · {i.profissional.nome}
                      <span className="block text-sm text-tinta2">{i.local}</span>
                    </span>
                    {i.profissional.id === usuarioId && (
                      <CancelarAgendamento
                        sessaoId={i.sessaoId}
                        descricao={`${primeiroNome}, ${quando}`}
                        aoCancelar={(mensagem) => { setAviso(mensagem); setTentativa((t) => t + 1) }}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
            <div className="mt-3">
              <Paginacao
                pagina={estado.dados.pagina}
                porPagina={estado.dados.porPagina}
                total={estado.dados.total}
                aoMudar={setPagina}
                rotulo="Páginas das próximas sessões"
                nomeItens={{ singular: 'sessão', plural: 'sessões' }}
              />
            </div>
          </>
        )
      )}

      {!agendando ? (
        <p className="mt-3">
          <Botao ref={botaoAgendar} area="cli" variante="secundaria" onClick={() => { setAviso(null); setAgendando(true) }}>
            Agendar sessão
          </Botao>
        </p>
      ) : (
        <form className="mt-4 flex flex-col gap-4 border-t border-linha pt-4" onSubmit={(e) => void agendar(e)} noValidate
          aria-labelledby="h-agendar">
          <h3 id="h-agendar" className="font-bold">Agendar sessão</h3>
          <p className="-mt-2 text-sm text-tinta2">
            Para você conduzir. Data e hora de Manaus, de hoje até {emDataCivil(ultimoDiaAgendavel(new Date()))}.
          </p>
          {erros.geral && <Aviso tom="cr" titulo="Não foi possível agendar">{erros.geral}</Aviso>}
          <div className="grid gap-4 [&>*]:min-w-0 sm:grid-cols-2 lg:grid-cols-[repeat(2,minmax(0,12rem))_minmax(0,1fr)]">
            <Campo id="ag-data" rotulo="Data">
              <input id="ag-data" ref={campoData} type="date" className={campo} value={campos.data}
                min={hoje} max={ultimoDiaAgendavel(new Date())}
                onChange={(e) => setCampos({ ...campos, data: e.target.value })}
                {...descrito('data', ...(erros.quando ? ['ag-quando-erro'] : []))} />
              <Erro chave="data" />
            </Campo>
            <Campo id="ag-hora" rotulo="Hora">
              <input id="ag-hora" type="time" step={60} className={campo} value={campos.hora}
                onChange={(e) => setCampos({ ...campos, hora: e.target.value })}
                {...descrito('hora', ...(erros.quando ? ['ag-quando-erro'] : []))} />
              <Erro chave="hora" />
            </Campo>
            <Campo id="ag-local" rotulo="Local" className="sm:col-span-2 lg:col-span-1">
              <input id="ag-local" type="text" className={campo} value={campos.local} maxLength={LOCAL_MAXIMO}
                onChange={(e) => setCampos({ ...campos, local: e.target.value })}
                {...descrito('local')} />
              <Erro chave="local" />
            </Campo>
          </div>
          {/* O horario e da data com a hora: o erro dele fica sob as duas. */}
          <Erro chave="quando" />
          <div className="flex flex-wrap gap-2">
            <Botao area="cli" type="submit" disabled={enviando}>{enviando ? 'Agendando…' : 'Agendar'}</Botao>
            <Botao area="cli" variante="secundaria" onClick={fechar} disabled={enviando}>Fechar</Botao>
          </div>
        </form>
      )}
    </Cartao>
  )
}
