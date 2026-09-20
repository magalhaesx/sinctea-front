import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Tela } from '../LayoutApp'
import { Aviso } from '../../ui/Aviso'
import { Botao, BotaoLink } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { Cartao } from '../../ui/Cartao'
import { Etiqueta } from '../../ui/Etiqueta'
import { Medidor } from '../../ui/Medidor'
import { Titulo } from '../../ui/Titulo'
import { EstadoCarregando } from '../../ui/EstadoCarregando'
import { EstadoErro } from '../../ui/EstadoErro'
import { percentualIndependente } from '../../dominio/regras'
import {
  ErroServico, servicos, type Intensidade, type Objetivo, type Resultado, type Sessao,
} from '../../servicos'

/**
 * Tela 7 · Registro de sessao · /app/clinica/pacientes/:id/sessao
 * UC04, UC05, UC06
 *
 * Registro rapido, em tablet, com a crianca na frente: alvos grandes, uma
 * decisao por toque e desfazer que diz o que vai desfazer.
 *
 * ESTADO DE CONEXAO, HONESTO: nao existe back-end ainda. O indicador reflete
 * navigator.onLine e o statusSync que o servico devolve — e o servico marca
 * como PENDENTE o que foi registrado agora, porque nao subiu a lugar nenhum.
 * A fila de sincronizacao de verdade chega com o back-end, na S06 do
 * cronograma; ate la nada aqui diz "sincronizado".
 */

const RESPOSTAS: { valor: Resultado; rotulo: string }[] = [
  { valor: 'INDEPENDENTE', rotulo: 'Independente' },
  { valor: 'AJUDA_GESTUAL', rotulo: 'Com ajuda gestual' },
  { valor: 'AJUDA_FISICA', rotulo: 'Com ajuda física' },
  { valor: 'SEM_RESPOSTA', rotulo: 'Sem resposta' },
]

const INTENSIDADES: { valor: Intensidade; rotulo: string }[] = [
  { valor: 1, rotulo: '1 · leve' },
  { valor: 2, rotulo: '2' },
  { valor: 3, rotulo: '3 · moderada' },
  { valor: 4, rotulo: '4' },
  { valor: 5, rotulo: '5 · intensa' },
]

const ABC_VAZIO = { antecedente: '', comportamento: '', consequencia: '', intensidade: '' }

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'pronto'; objetivos: Objetivo[]; sessao: Sessao | null }

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export function RegistroSessao() {
  const { id = '' } = useParams()
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)
  const [objetivoId, setObjetivoId] = useState('')
  const [abc, setAbc] = useState(ABC_VAZIO)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [online, setOnline] = useState(() => navigator.onLine)
  const primeiraResposta = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const mudou = () => setOnline(navigator.onLine)
    window.addEventListener('online', mudou)
    window.addEventListener('offline', mudou)
    return () => { window.removeEventListener('online', mudou); window.removeEventListener('offline', mudou) }
  }, [])

  useEffect(() => {
    let ativo = true
    setEstado({ tipo: 'carregando' })
    setAviso(null)
    const carregar = async () => {
      const plano = await servicos.planos.obterPorPaciente(id)
      // Retoma a sessao que ja estava aberta, em vez de comecar outra.
      const emAndamento = await servicos.sessoes.listarPorPaciente(id, { situacao: 'EM_ANDAMENTO', porPagina: 1 })
      const pausada = emAndamento.itens.length === 0
        ? await servicos.sessoes.listarPorPaciente(id, { situacao: 'PAUSADA', porPagina: 1 })
        : null
      return { objetivos: plano.objetivos, sessao: emAndamento.itens[0] ?? pausada?.itens[0] ?? null }
    }
    carregar()
      .then(({ objetivos, sessao }) => {
        if (!ativo) return
        setObjetivoId((atual) => atual || objetivos[0]?.id || '')
        setEstado({ tipo: 'pronto', objetivos, sessao })
      })
      .catch((erro) => { if (ativo) setEstado({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [id, tentativa])

  const atualizarSessao = (sessao: Sessao) =>
    setEstado((e) => (e.tipo === 'pronto' ? { ...e, sessao } : e))

  const comErro = async (acao: () => Promise<void>) => {
    setOcupado(true)
    try {
      await acao()
    } catch (e) {
      const erro = e as ErroServico
      setErros(erro instanceof ErroServico && Object.keys(erro.campos).length > 0
        ? erro.campos
        : { geral: erro.message ?? 'Não foi possível concluir agora.' })
    } finally {
      setOcupado(false)
    }
  }

  const iniciar = () => comErro(async () => {
    const sessao = await servicos.sessoes.iniciar(id)
    atualizarSessao(sessao)
    setAviso(`Sessão ${sessao.numero} iniciada às ${hora(sessao.inicio ?? new Date().toISOString())}.`)
    primeiraResposta.current?.focus()
  })

  const registrar = (sessaoId: string, resultado: Resultado) => comErro(async () => {
    setErros({})
    await servicos.sessoes.registrarAtividade(sessaoId, objetivoId, resultado)
    atualizarSessao(await servicos.sessoes.obter(sessaoId))
  })

  const desfazer = (sessaoId: string) => comErro(async () => {
    atualizarSessao(await servicos.sessoes.desfazerUltimoRegistro(sessaoId))
  })

  const pausar = (sessaoId: string) => comErro(async () => {
    atualizarSessao(await servicos.sessoes.pausar(sessaoId))
    setAviso('Sessão pausada. Os registros continuam guardados.')
  })

  const encerrar = (sessaoId: string) => comErro(async () => {
    const sessao = await servicos.sessoes.encerrar(sessaoId)
    atualizarSessao(sessao)
    setAviso(`Sessão encerrada com ${sessao.registros.length} ${sessao.registros.length === 1 ? 'registro' : 'registros'}.`)
  })

  const registrarOcorrencia = (evento: FormEvent, sessaoId: string) => {
    evento.preventDefault()
    void comErro(async () => {
      setErros({})
      await servicos.ocorrencias.registrarNaSessao(sessaoId, {
        antecedente: abc.antecedente,
        comportamento: abc.comportamento,
        consequencia: abc.consequencia,
        intensidade: Number(abc.intensidade) as Intensidade,
      })
      setAbc(ABC_VAZIO)
      setAviso('Ocorrência comportamental registrada nesta sessão.')
    })
  }

  const campo = 'min-h-11 w-full rounded-lg border-2 border-linha bg-sup px-3 py-2.5 text-tinta'
  const atributosDeErro = (chave: string) => erros[chave]
    ? { 'aria-describedby': `${chave}-erro`, 'aria-invalid': true as const }
    : {}
  const Erro = ({ chave }: { chave: string }) => erros[chave]
    ? <p id={`${chave}-erro`} className="text-sm font-bold text-cr">{erros[chave]}</p>
    : null

  const negado = estado.tipo === 'erro' && estado.erro instanceof ErroServico
    && estado.erro.codigo === 'ACESSO_NEGADO'

  return (
    <Tela area="cli" caminho={['Área clínica', 'Pacientes', 'Registro de sessão']}>
      {estado.tipo === 'carregando' && (
        <>
          <Titulo>Registro de sessão</Titulo>
          <EstadoCarregando forma="cartoes" quantidade={2} rotulo="Carregando a sessão" />
        </>
      )}

      {estado.tipo === 'erro' && (
        <>
          <Titulo>Registro de sessão</Titulo>
          <EstadoErro
            erro={estado.erro}
            oQue="esta sessão"
            titulo={negado ? 'Esta sessão não é do seu alcance' : undefined}
            texto={negado
              ? 'A sessão é de um paciente que você não acompanha. Se precisar registrar por ele, fale com a coordenação da clínica.'
              : undefined}
            aoTentarDeNovo={negado ? undefined : () => setTentativa((t) => t + 1)}
          />
        </>
      )}

      {estado.tipo === 'pronto' && (() => {
        const { objetivos, sessao } = estado
        const objetivo = objetivos.find((o) => o.id === objetivoId) ?? objetivos[0]
        const registros = sessao?.registros ?? []
        const doObjetivo = registros.filter((r) => r.objetivoId === objetivo?.id)
        const ultimo = registros[registros.length - 1]
        const objetivoDoUltimo = ultimo && objetivos.find((o) => o.id === ultimo.objetivoId)
        const aberta = sessao?.situacao === 'EM_ANDAMENTO'
        const percentual = percentualIndependente(registros, objetivo?.id ?? '')

        return (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <Titulo sub={sessao
                ? `Sessão ${sessao.numero} · ${sessao.situacao === 'ENCERRADA' ? 'encerrada' : sessao.situacao === 'PAUSADA' ? 'pausada' : 'em andamento'}${sessao.inicio ? ` desde ${hora(sessao.inicio)}` : ''} · ${sessao.local}`
                : 'Nenhuma sessão aberta para este paciente'}>
                Registro de sessão
              </Titulo>

              {/* Estado de conexao sempre visivel, e honesto: nada aqui foi
                  para um servidor, porque servidor ainda nao existe. */}
              {online
                ? <Etiqueta simbolo="●">
                    {sessao?.statusSync === 'PENDENTE'
                      ? 'Conectado · registro pendente de sincronização'
                      : 'Conectado · registros ficam no aparelho'}
                  </Etiqueta>
                : <Etiqueta tom="at" simbolo="▲">Sem conexão · o registro fica pendente de sincronização</Etiqueta>}
            </div>

            <div aria-live="polite">
              {aviso && <Aviso tom="ok" titulo="Pronto">{aviso}</Aviso>}
              {erros.geral && <Aviso tom="cr" titulo="Não foi possível concluir">{erros.geral}</Aviso>}
            </div>

            {objetivos.length === 0 && (
              <Cartao>
                <p className="text-tinta2">
                  O plano deste paciente ainda não tem objetivos. Registre um objetivo antes de
                  iniciar a sessão.
                </p>
                <p className="mt-3">
                  <Link to={`/app/clinica/pacientes/${id}/plano`} className="font-bold text-cli-ink underline">
                    Abrir o plano terapêutico
                  </Link>
                </p>
              </Cartao>
            )}

            {objetivos.length > 0 && !aberta && (
              <Cartao>
                <h2 className="text-lg font-bold">
                  {sessao?.situacao === 'PAUSADA' ? 'Sessão pausada' : sessao?.situacao === 'ENCERRADA' ? 'Sessão encerrada' : 'Nenhuma sessão aberta'}
                </h2>
                <p className="mt-1 text-tinta2">
                  {sessao?.situacao === 'PAUSADA'
                    ? 'Os registros feitos até aqui continuam guardados. Retome quando voltar para o atendimento.'
                    : sessao?.situacao === 'ENCERRADA'
                      ? 'Esta sessão foi encerrada. Para registrar de novo, inicie uma sessão nova.'
                      : 'Inicie a sessão para começar a registrar as tentativas.'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Botao area="cli" onClick={() => void iniciar()} disabled={ocupado}>
                    {sessao?.situacao === 'PAUSADA' ? 'Retomar a sessão' : 'Iniciar a sessão'}
                  </Botao>
                  <BotaoLink para={`/app/clinica/pacientes/${id}`} area="cli" variante="secundaria">
                    Voltar para a ficha
                  </BotaoLink>
                </div>
              </Cartao>
            )}

            {objetivos.length > 0 && sessao && (
              <>
                <Cartao>
                  <Campo id="objetivo" rotulo="Objetivo em trabalho" dica="Trocar de objetivo não perde os registros do anterior.">
                    <select id="objetivo" className={campo} value={objetivo?.id ?? ''}
                      onChange={(e) => setObjetivoId(e.target.value)}>
                      {objetivos.map((o) => (
                        <option key={o.id} value={o.id}>{o.dominio}</option>
                      ))}
                    </select>
                  </Campo>
                  {objetivo && (
                    <p className="mt-2 max-w-[65ch] text-sm text-tinta2">{objetivo.descricaoTecnica}</p>
                  )}
                </Cartao>

                {aberta && (
                  <Cartao>
                    <h2 id="h-resp" className="text-base font-bold">Como foi esta tentativa?</h2>
                    <p className="mb-3 text-sm text-tinta2">
                      Um toque registra. Tentativa {doObjetivo.length + 1} deste objetivo.
                    </p>
                    <div className="grid gap-2.5 sm:grid-cols-2" role="group" aria-labelledby="h-resp">
                      {RESPOSTAS.map((r, i) => (
                        <button
                          key={r.valor}
                          ref={i === 0 ? primeiraResposta : undefined}
                          type="button"
                          disabled={ocupado}
                          onClick={() => void registrar(sessao.id, r.valor)}
                          className="min-h-14 cursor-pointer rounded-lg border-2 border-linha bg-sup px-4 py-4 text-left font-bold hover:border-cli disabled:cursor-not-allowed"
                        >
                          {r.rotulo}
                        </button>
                      ))}
                    </div>

                    {ultimo && (
                      <p className="mt-3">
                        {/* Desfazer age sobre a SESSAO, nao sobre o objetivo em tela:
                            o rotulo nomeia o registro que vai sumir. */}
                        <Botao area="cli" variante="secundaria" disabled={ocupado}
                          onClick={() => void desfazer(sessao.id)}>
                          Desfazer: {objetivoDoUltimo?.dominio ?? 'registro'} ·{' '}
                          {RESPOSTAS.find((r) => r.valor === ultimo.resultado)?.rotulo}
                        </Botao>
                      </p>
                    )}
                  </Cartao>
                )}

                <Cartao>
                  <h2 className="text-base font-bold">Contagem desta sessão</h2>
                  <p className="mt-1 text-sm text-tinta2">
                    {registros.length} {registros.length === 1 ? 'registro' : 'registros'} no total, somando todos os objetivos.
                  </p>
                  <ul className="mt-3 flex flex-col gap-2">
                    {objetivos.map((o) => {
                      const meus = registros.filter((r) => r.objetivoId === o.id)
                      return (
                        <li key={o.id} className="rounded-lg border border-linha bg-sup px-3 py-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <b>{o.dominio}</b>
                            <span className="text-sm tabular-nums text-tinta2">
                              {meus.length} {meus.length === 1 ? 'tentativa' : 'tentativas'}
                            </span>
                          </div>
                          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums text-tinta2">
                            {RESPOSTAS.map((r) => (
                              <li key={r.valor}>
                                {r.rotulo}: {meus.filter((m) => m.resultado === r.valor).length}
                              </li>
                            ))}
                          </ul>
                        </li>
                      )
                    })}
                  </ul>
                  {objetivo && percentual !== null && (
                    <div className="mt-3">
                      <Medidor valor={percentual} area="cli" rotulo={`Independência em ${objetivo.dominio} nesta sessão`} />
                    </div>
                  )}
                </Cartao>

                {aberta && (
                  <Cartao>
                    <h2 className="text-base font-bold">Ocorrência comportamental</h2>
                    <p className="mt-1 text-sm text-tinta2">
                      Registro ABC: o que veio antes, o que aconteceu e o que veio depois.
                    </p>
                    <form className="mt-3 flex flex-col gap-4" onSubmit={(e) => registrarOcorrencia(e, sessao.id)} noValidate>
                      <Campo id="antecedente" rotulo="Antecedente" dica="O que acontecia antes.">
                        <input id="antecedente" type="text" className={campo} value={abc.antecedente}
                          onChange={(e) => setAbc({ ...abc, antecedente: e.target.value })}
                          {...atributosDeErro('antecedente')} />
                        <Erro chave="antecedente" />
                      </Campo>

                      <Campo id="comportamento" rotulo="Comportamento" dica="O que a pessoa fez, sem interpretar.">
                        <input id="comportamento" type="text" className={campo} value={abc.comportamento}
                          onChange={(e) => setAbc({ ...abc, comportamento: e.target.value })}
                          {...atributosDeErro('comportamento')} />
                        <Erro chave="comportamento" />
                      </Campo>

                      <Campo id="consequencia" rotulo="Consequência" dica="O que veio logo depois.">
                        <input id="consequencia" type="text" className={campo} value={abc.consequencia}
                          onChange={(e) => setAbc({ ...abc, consequencia: e.target.value })}
                          {...atributosDeErro('consequencia')} />
                        <Erro chave="consequencia" />
                      </Campo>

                      {/* Cinco opcoes com rotulo, nao um controle deslizante:
                          deslizante e impreciso no dedo e pessimo no teclado. */}
                      <fieldset className="rounded-lg border border-linha p-4"
                        {...atributosDeErro('intensidade')}>
                        <legend className="px-1.5 font-bold">Intensidade</legend>
                        <div className="flex flex-wrap gap-2">
                          {INTENSIDADES.map((i) => (
                            <label key={i.valor}
                              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-linha bg-sup px-3 py-2">
                              <input type="radio" name="intensidade" className="h-5 w-5"
                                checked={abc.intensidade === String(i.valor)}
                                onChange={() => setAbc({ ...abc, intensidade: String(i.valor) })} />
                              <span className="tabular-nums">{i.rotulo}</span>
                            </label>
                          ))}
                        </div>
                        <Erro chave="intensidade" />
                      </fieldset>

                      <p>
                        <Botao area="cli" type="submit" disabled={ocupado}>Registrar ocorrência</Botao>
                      </p>
                    </form>
                  </Cartao>
                )}

                {aberta && (
                  <div className="flex flex-wrap gap-2">
                    <Botao area="cli" variante="secundaria" disabled={ocupado}
                      onClick={() => void pausar(sessao.id)}>Pausar a sessão</Botao>
                    <Botao area="cli" disabled={ocupado}
                      onClick={() => void encerrar(sessao.id)}>Encerrar a sessão</Botao>
                  </div>
                )}
              </>
            )}
          </>
        )
      })()}
    </Tela>
  )
}
