import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Tela } from '../LayoutApp'
import { Aviso } from '../../ui/Aviso'
import { Botao } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { Cartao } from '../../ui/Cartao'
import { Etiqueta } from '../../ui/Etiqueta'
import { Titulo } from '../../ui/Titulo'
import { EstadoCarregando } from '../../ui/EstadoCarregando'
import { EstadoErro } from '../../ui/EstadoErro'
import { EstadoVazio } from '../../ui/EstadoVazio'
import { Paginacao } from '../../ui/Paginacao'
import { usarSessao } from '../../contexto/Sessao'
import { emData } from '../../dominio/datas'
import { validarDevolucaoPlano } from '../../dominio/regras'
import {
  ErroServico, servicos, type Pagina, type PlanoParaValidacao, type PlanoTerapeutico,
} from '../../servicos'

/**
 * Tela 12 · Validar planos terapeuticos · /app/coordenacao/planos (UC17)
 *
 * As duas redacoes aparecem LADO A LADO, e nao em alternancia como na tela 6.
 * Ali o terapeuta escreve uma de cada vez; aqui comparar e a tarefa. E esta
 * tela o controle de qualidade da regra 4: a coordenacao confere se a redacao
 * acessivel e de fato acessivel, e a unica forma de conferir isso e ver as
 * duas ao mesmo tempo.
 *
 * Nao ha historico proprio: aprovar e devolver ja entram na auditoria com o
 * detalhe, e quem decidiu o que e quando e exatamente o que ela responde. O
 * relatorio precisou de classe propria porque o documento tem de ser
 * reapresentado; aqui basta saber quem decidiu.
 */

const POR_PAGINA = 10

type Estado<T> =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'pronto'; dados: T }

export function Planos() {
  const { usuario } = usarSessao()
  const [params, setParams] = useSearchParams()
  const pacienteId = params.get('paciente') ?? ''
  const pagina = Math.max(1, Number(params.get('pagina') ?? 1) || 1)

  const [fila, setFila] = useState<Estado<Pagina<PlanoParaValidacao>>>({ tipo: 'carregando' })
  const [plano, setPlano] = useState<Estado<PlanoTerapeutico> | null>(null)
  const [tentativa, setTentativa] = useState(0)

  const [devolvendo, setDevolvendo] = useState(false)
  const [observacao, setObservacao] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState<string | null>(null)

  const regiaoViva = useRef<HTMLDivElement>(null)
  const focarAviso = useRef(false)

  useEffect(() => {
    if (!focarAviso.current) return
    focarAviso.current = false
    regiaoViva.current?.focus()
  })

  useEffect(() => {
    let ativo = true
    setFila({ tipo: 'carregando' })
    servicos.planos.listarAguardandoValidacao({ pagina, porPagina: POR_PAGINA })
      .then((dados) => { if (ativo) setFila({ tipo: 'pronto', dados }) })
      .catch((erro) => { if (ativo) setFila({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [pagina, tentativa])

  useEffect(() => {
    if (!pacienteId) { setPlano(null); return }
    let ativo = true
    setPlano({ tipo: 'carregando' })
    setDevolvendo(false)
    setObservacao('')
    setErros({})
    servicos.planos.obterPorPaciente(pacienteId)
      .then((dados) => { if (ativo) setPlano({ tipo: 'pronto', dados }) })
      .catch((erro) => { if (ativo) setPlano({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [pacienteId, tentativa])

  const abrir = (id: string) => {
    // O recado e da decisao anterior: abrir outro plano o apaga. Apagar por
    // efeito na troca de pacienteId nao servia — decidir fecha o plano, e o
    // recado morria junto com o fechamento que ele mesmo provocou.
    setAviso(null)
    setErros({})
    const proximos = new URLSearchParams(params)
    proximos.set('paciente', id)
    setParams(proximos)
  }

  const fechar = () => {
    const proximos = new URLSearchParams(params)
    proximos.delete('paciente')
    setParams(proximos)
  }

  const decidir = async (acao: () => Promise<PlanoTerapeutico>, recado: string) => {
    setErros({})
    setAviso(null)
    setOcupado(true)
    try {
      await acao()
      setAviso(recado)
      setObservacao('')
      setDevolvendo(false)
      fechar()
      setTentativa((t) => t + 1)
    } catch (e) {
      const erro = e as ErroServico
      setErros(erro instanceof ErroServico && Object.keys(erro.campos).length > 0
        ? erro.campos
        : { geral: (erro as Error).message ?? 'Não foi possível concluir agora.' })
    } finally {
      setOcupado(false)
      focarAviso.current = true
    }
  }

  const devolver = (planoId: string) => {
    // A regra vive no dominio: devolucao sem justificativa nao ensina nada a
    // quem recebeu. O servico recusa de novo, se passar daqui.
    const erro = validarDevolucaoPlano(observacao)
    if (erro) { setErros({ observacao: erro }); return }
    return decidir(
      () => servicos.planos.devolver(planoId, observacao),
      'Plano devolvido com a sua observação. O autor recebe o plano de volta para ajustar.',
    )
  }

  const area = 'w-full rounded-lg border-2 border-linha bg-sup px-3 py-2.5 text-tinta'
  const naFila = fila.tipo === 'pronto' ? fila.dados.itens : []
  const item = naFila.find((p) => p.paciente.id === pacienteId)
  const souAutor = plano?.tipo === 'pronto' && plano.dados.autorId === usuario?.id

  return (
    <Tela area="cli" caminho={['Coordenação', 'Validar planos terapêuticos']}>
      <Titulo sub="A coordenação confere o plano antes de ele valer — inclusive se a redação acessível é mesmo acessível">
        Validar planos terapêuticos
      </Titulo>

      <div ref={regiaoViva} tabIndex={-1} aria-live="polite">
        {aviso && <Aviso tom="ok" titulo="Pronto">{aviso}</Aviso>}
        {erros.geral && <Aviso tom="cr" titulo="Não foi possível concluir">{erros.geral}</Aviso>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <section aria-labelledby="h-fila" className="flex min-w-0 flex-col gap-3">
          <h2 id="h-fila" className="text-lg font-bold">Aguardando validação</h2>

          {fila.tipo === 'carregando' && (
            <EstadoCarregando forma="lista" linhas={3} rotulo="Carregando a fila de planos" />
          )}

          {fila.tipo === 'erro' && (
            <EstadoErro
              erro={fila.erro}
              oQue="a fila de planos"
              nivel={3}
              aoTentarDeNovo={() => setTentativa((t) => t + 1)}
            />
          )}

          {fila.tipo === 'pronto' && (
            fila.dados.total === 0 ? (
              <EstadoVazio
                nivel={3}
                titulo="Nenhum plano aguardando validação"
                explicacao="Quando um terapeuta enviar um plano, ele aparece aqui. Enquanto isso, o registro de auditoria mostra as validações já feitas."
                acao={(
                  <Link
                    to="/app/coordenacao/auditoria?entidade=PlanoTerapeutico"
                    className="min-h-11 items-center font-bold text-cli-ink underline"
                  >
                    Ver as validações no registro de auditoria
                  </Link>
                )}
              />
            ) : (
              <>
                <ul className="flex flex-col gap-2">
                  {fila.dados.itens.map((p) => {
                    const aberto = p.paciente.id === pacienteId
                    return (
                      <li key={p.planoId}>
                        <button
                          type="button"
                          aria-current={aberto ? 'true' : undefined}
                          onClick={() => abrir(p.paciente.id)}
                          className={`flex min-h-11 w-full flex-col items-start gap-0.5 rounded-lg border-2 bg-sup px-3 py-2.5 text-left text-[15px] hover:bg-sup2 ${aberto ? 'border-cli' : 'border-linha'}`}
                        >
                          <b className="text-cli-ink">{p.paciente.nome}</b>
                          <span className="text-sm text-tinta2">
                            {p.autor.nome} · enviado em {emData(p.enviadoEm)}
                          </span>
                          <span className="text-sm text-tinta2">
                            {p.totalObjetivos} {p.totalObjetivos === 1 ? 'objetivo' : 'objetivos'}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>

                <Paginacao
                  pagina={fila.dados.pagina}
                  porPagina={fila.dados.porPagina}
                  total={fila.dados.total}
                  aoMudar={(p) => {
                    const proximos = new URLSearchParams(params)
                    proximos.set('pagina', String(p))
                    setParams(proximos)
                  }}
                  rotulo="Páginas da fila de planos"
                  nomeItens={{ singular: 'plano', plural: 'planos' }}
                />
              </>
            )
          )}

          <p className="text-sm">
            <Link
              to="/app/coordenacao/auditoria?entidade=PlanoTerapeutico"
              className="font-bold text-cli-ink underline"
            >
              Ver as validações no registro de auditoria
            </Link>
          </p>
        </section>

        <section aria-labelledby="h-plano" className="flex min-w-0 flex-col gap-3">
          <h2 id="h-plano" className="text-lg font-bold">
            {item ? `Plano de ${item.paciente.nome}` : 'Plano escolhido'}
          </h2>

          {!pacienteId && (
            <Cartao>
              <p className="text-tinta2">
                Escolha um plano na fila ao lado para conferir os objetivos e decidir.
              </p>
            </Cartao>
          )}

          {plano?.tipo === 'carregando' && (
            <EstadoCarregando forma="cartoes" quantidade={2} rotulo="Carregando o plano terapêutico" />
          )}

          {plano?.tipo === 'erro' && (
            <EstadoErro
              erro={plano.erro}
              oQue="este plano"
              nivel={3}
              aoTentarDeNovo={() => setTentativa((t) => t + 1)}
            />
          )}

          {plano?.tipo === 'pronto' && (
            <>
              <Cartao>
                <dl className="grid gap-x-4 gap-y-1.5 text-[15px] sm:grid-cols-[auto_1fr]">
                  <dt className="font-bold">Autor</dt>
                  <dd>{item?.autor.nome ?? '—'}</dd>
                  <dt className="font-bold">Início previsto</dt>
                  <dd>{emData(plano.dados.dataInicio)}</dd>
                  <dt className="font-bold">Próxima revisão</dt>
                  <dd>{emData(plano.dados.dataRevisao)}</dd>
                  <dt className="font-bold">Objetivos</dt>
                  <dd className="tabular-nums">{plano.dados.objetivos.length}</dd>
                </dl>
              </Cartao>

              {souAutor && (
                <Aviso tom="at" titulo="Este plano é seu">
                  Você escreveu este plano. A validação precisa de outra pessoa da coordenação —
                  é o que faz a conferência valer.
                </Aviso>
              )}

              <ul className="flex flex-col gap-3">
                {plano.dados.objetivos.map((o) => (
                  <li key={o.id}>
                    <Cartao>
                      <h3 className="text-[13px] font-bold uppercase tracking-wider text-tinta2">
                        {o.dominio}
                      </h3>
                      {/* Lado a lado: comparar as duas redacoes e a tarefa desta tela. */}
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="min-w-0 rounded-lg border border-linha bg-sup2 p-3">
                          <h4 className="text-sm font-bold">Redação técnica — a equipe lê</h4>
                          <p className="mt-1 text-[15px]">{o.descricaoTecnica}</p>
                        </div>
                        <div className="min-w-0 rounded-lg border border-fam bg-fam-sup p-3">
                          <h4 className="text-sm font-bold">Redação acessível — a família e a escola leem</h4>
                          <p className="mt-1 text-[15px]">{o.descricaoAcessivel}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-tinta2">
                        Critério de domínio: {o.criterio.percentualMinimo}% em{' '}
                        {o.criterio.sessoesConsecutivas}{' '}
                        {o.criterio.sessoesConsecutivas === 1 ? 'sessão consecutiva' : 'sessões consecutivas'}
                      </p>
                    </Cartao>
                  </li>
                ))}
              </ul>

              {!souAutor && (
                <Cartao>
                  <h3 className="text-base font-bold">Decisão</h3>
                  {devolvendo ? (
                    <div className="mt-3 flex flex-col gap-3">
                      <Campo
                        id="observacao"
                        rotulo="O que precisa mudar"
                        dica="O autor recebe este texto junto com o plano. Diga o que ajustar, não só que está errado."
                      >
                        <textarea
                          id="observacao"
                          rows={4}
                          className={area}
                          value={observacao}
                          onChange={(e) => setObservacao(e.target.value)}
                          aria-describedby={erros.observacao ? 'observacao-erro' : 'observacao-dica'}
                          aria-invalid={erros.observacao ? true : undefined}
                        />
                      </Campo>
                      {erros.observacao && (
                        <p id="observacao-erro" className="text-sm font-bold text-cr">{erros.observacao}</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Botao area="cli" disabled={ocupado}
                          onClick={() => void devolver(plano.dados.id)}>
                          {ocupado ? 'Devolvendo…' : 'Devolver com esta observação'}
                        </Botao>
                        <Botao area="cli" variante="secundaria" disabled={ocupado}
                          onClick={() => { setDevolvendo(false); setErros({}) }}>
                          Cancelar
                        </Botao>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="mt-1 text-sm text-tinta2">
                        Aprovar faz o plano passar a vigente. Não é definitivo: o plano continua
                        podendo ser revisto depois.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Botao area="cli" disabled={ocupado}
                          onClick={() => void decidir(
                            () => servicos.planos.aprovar(plano.dados.id),
                            `Plano de ${item?.paciente.nome ?? 'paciente'} aprovado. Ele passa a vigente.`,
                          )}>
                          {ocupado ? 'Aprovando…' : 'Aprovar plano'}
                        </Botao>
                        <Botao area="cli" variante="secundaria" disabled={ocupado}
                          onClick={() => setDevolvendo(true)}>
                          Devolver para ajuste
                        </Botao>
                      </div>
                    </>
                  )}
                </Cartao>
              )}

              <p>
                <Etiqueta simbolo="○">
                  A decisão fica registrada na auditoria, com quem decidiu e quando
                </Etiqueta>
              </p>
            </>
          )}
        </section>
      </div>
    </Tela>
  )
}
