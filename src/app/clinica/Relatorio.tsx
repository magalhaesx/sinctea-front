import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Tela } from '../LayoutApp'
import { Aviso } from '../../ui/Aviso'
import { Botao } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { Cartao } from '../../ui/Cartao'
import { Titulo } from '../../ui/Titulo'
import { EstadoCarregando } from '../../ui/EstadoCarregando'
import { EstadoErro } from '../../ui/EstadoErro'
import { Paginacao } from '../../ui/Paginacao'
import { FolhaRelatorio, NOME_DO_DESTINATARIO } from '../../componentes/FolhaRelatorio'
import {
  ErroServico, servicos, type ConteudoRelatorio, type Destinatario, type Pagina,
  type PedidoRelatorio, type PlanoTerapeutico, type RelatorioEvolucao,
} from '../../servicos'

/**
 * Tela 10 · Emitir relatorio de evolucao · /app/clinica/pacientes/:id/relatorio
 * UC09
 *
 * Documento clinico: so terapeuta da equipe e coordenacao alcancam, e toda
 * emissao entra na auditoria. A escola nunca chega aqui — a rota e da area
 * clinica e o servico recusa o perfil.
 *
 * A pre-visualizacao usa o MESMO componente do documento emitido. Se fossem
 * dois desenhos, o que se confere antes de emitir nao seria o que sai.
 *
 * Nao ha botao que escreva as consideracoes: o relatorio e a leitura clinica
 * de quem assina (regra 4 do CLAUDE.md).
 */

const POR_PAGINA = 5
const DIAS_PADRAO = 90

type Estado<T> =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'pronto'; dados: T }

/**
 * Data em AAAA-MM-DD vira meio-dia local antes de virar Date: sem isso o
 * navegador le a data-only como meia-noite UTC e o fuso puxa o dia para tras —
 * 12/03 nasce virando 11/03. Texto com hora passa direto.
 */
const emData = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('pt-BR')

/** AAAA-MM-DD no fuso de quem usa: o periodo e de dias inteiros. */
function diaIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function Relatorio() {
  const { id = '' } = useParams()
  const navegar = useNavigate()

  const [plano, setPlano] = useState<Estado<PlanoTerapeutico>>({ tipo: 'carregando' })
  const [historico, setHistorico] = useState<Estado<Pagina<RelatorioEvolucao>>>({ tipo: 'carregando' })
  const [pagina, setPagina] = useState(1)
  const [tentativa, setTentativa] = useState(0)

  const hoje = new Date()
  const [periodoInicio, setPeriodoInicio] = useState(
    diaIso(new Date(hoje.getTime() - DIAS_PADRAO * 86_400_000)),
  )
  const [periodoFim, setPeriodoFim] = useState(diaIso(hoje))
  const [objetivoIds, setObjetivoIds] = useState<string[]>([])
  const [destinatario, setDestinatario] = useState<Destinatario>('PROFISSIONAIS')
  const [consideracoes, setConsideracoes] = useState('')

  const [previa, setPrevia] = useState<ConteudoRelatorio | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erros, setErros] = useState<Record<string, string>>({})

  const regiaoPrevia = useRef<HTMLDivElement>(null)
  const focarPrevia = useRef(false)

  useEffect(() => {
    if (!focarPrevia.current) return
    focarPrevia.current = false
    regiaoPrevia.current?.focus()
  })

  useEffect(() => {
    let ativo = true
    setPlano({ tipo: 'carregando' })
    servicos.planos.obterPorPaciente(id)
      .then((dados) => {
        if (!ativo) return
        setPlano({ tipo: 'pronto', dados })
        // Sem escolha feita, o relatorio cobre o plano inteiro.
        setObjetivoIds((atual) => atual.length > 0 ? atual : dados.objetivos.map((o) => o.id))
      })
      .catch((erro) => { if (ativo) setPlano({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [id, tentativa])

  useEffect(() => {
    let ativo = true
    setHistorico({ tipo: 'carregando' })
    servicos.relatorios.listarPorPaciente(id, { pagina, porPagina: POR_PAGINA })
      .then((dados) => { if (ativo) setHistorico({ tipo: 'pronto', dados }) })
      .catch((erro) => { if (ativo) setHistorico({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [id, pagina, tentativa])

  const pedido = (): PedidoRelatorio => ({
    periodoInicio, periodoFim, objetivoIds, destinatario, consideracoes,
  })

  const comoErros = (e: unknown): Record<string, string> => {
    const erro = e as ErroServico
    return erro instanceof ErroServico && Object.keys(erro.campos).length > 0
      ? erro.campos
      : { geral: (erro as Error).message ?? 'Não foi possível concluir agora.' }
  }

  const previsualizar = async (evento: FormEvent) => {
    evento.preventDefault()
    setErros({})
    setOcupado(true)
    try {
      setPrevia(await servicos.relatorios.previsualizar(id, pedido()))
      focarPrevia.current = true
    } catch (e) {
      setPrevia(null)
      setErros(comoErros(e))
    } finally {
      setOcupado(false)
    }
  }

  const emitir = async () => {
    setErros({})
    setOcupado(true)
    try {
      const relatorio = await servicos.relatorios.emitir(id, pedido())
      navegar(`/app/clinica/pacientes/${id}/relatorio/${relatorio.id}`)
    } catch (e) {
      setErros(comoErros(e))
    } finally {
      setOcupado(false)
    }
  }

  const alternarObjetivo = (objetivoId: string) => {
    setObjetivoIds((atual) => atual.includes(objetivoId)
      ? atual.filter((x) => x !== objetivoId)
      : [...atual, objetivoId])
  }

  const campo = 'min-h-11 w-full rounded-lg border-2 border-linha bg-sup px-3 py-2.5 text-tinta'
  const Erro = ({ chave }: { chave: string }) => erros[chave]
    ? <p id={`${chave}-erro`} className="text-sm font-bold text-cr">{erros[chave]}</p>
    : null

  const negado = plano.tipo === 'erro' && plano.erro instanceof ErroServico
    && plano.erro.codigo === 'ACESSO_NEGADO'
  const semPlano = plano.tipo === 'erro' && plano.erro instanceof ErroServico
    && plano.erro.codigo === 'NAO_ENCONTRADO'

  return (
    <Tela area="cli" caminho={['Área clínica', 'Pacientes', 'Relatório de evolução']}>
      <Titulo sub="Documento clínico: o que sair aqui fica guardado como saiu, e a emissão entra na auditoria">
        Emitir relatório de evolução
      </Titulo>

      <div aria-live="polite">
        {erros.geral && <Aviso tom="cr" titulo="Não foi possível concluir">{erros.geral}</Aviso>}
      </div>

      {plano.tipo === 'carregando' && (
        <EstadoCarregando forma="cartoes" quantidade={2} rotulo="Carregando o plano terapêutico" />
      )}

      {plano.tipo === 'erro' && (
        semPlano ? (
          <Cartao>
            <p className="text-tinta2">
              Este paciente ainda não tem plano terapêutico, então não há objetivo para relatar.
            </p>
            <p className="mt-3">
              <Link to={`/app/clinica/pacientes/${id}/plano`} className="font-bold text-cli-ink underline">
                Abrir o plano terapêutico
              </Link>
            </p>
          </Cartao>
        ) : (
          <EstadoErro
            erro={plano.erro}
            oQue="o plano deste paciente"
            titulo={negado ? 'Este paciente não é do seu alcance' : undefined}
            aoTentarDeNovo={negado ? undefined : () => setTentativa((t) => t + 1)}
          />
        )
      )}

      {plano.tipo === 'pronto' && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* min-w-0: sem isso a coluna da grade cresce ate o min-content do
              campo de data, e a 320px o bloco passa da borda. */}
          <section aria-labelledby="h-pedido" className="flex min-w-0 flex-col gap-3">
            <h2 id="h-pedido" className="text-lg font-bold">O que entra no relatório</h2>
            <Cartao>
              <form onSubmit={(e) => void previsualizar(e)} className="flex flex-col gap-4">
                {/* Os dois campos de data precisam poder encolher: o seletor
                    nativo tem largura minima propria, e a 320px com Texto
                    maior ela estoura a coluna. O min-w-0 vai no embrulho do
                    Campo, que e quem nao cede. */}
                <div className="grid gap-3 [&>*]:min-w-0 sm:grid-cols-2">
                  <Campo id="inicio" rotulo="Início do período">
                    {/* min-w-0: o campo de data tem largura minima propria, do
                        seletor nativo, e a 320px ela estoura a coluna. */}
                    <input id="inicio" type="date" className={`${campo} min-w-0`} value={periodoInicio}
                      onChange={(e) => setPeriodoInicio(e.target.value)} />
                  </Campo>
                  <Campo id="fim" rotulo="Fim do período">
                    <input id="fim" type="date" className={`${campo} min-w-0`} value={periodoFim}
                      onChange={(e) => setPeriodoFim(e.target.value)} />
                  </Campo>
                </div>
                <Erro chave="periodo" />

                <fieldset className="border-0 p-0">
                  <legend className="text-sm font-bold">Objetivos</legend>
                  <div className="mt-2 flex flex-col gap-2">
                    {plano.dados.objetivos.map((o) => (
                      <label key={o.id} className="flex min-h-11 items-start gap-2.5 rounded-lg border border-linha bg-sup px-3 py-2.5 text-[15px]">
                        <input
                          type="checkbox"
                          className="mt-1 h-5 w-5 flex-none"
                          checked={objetivoIds.includes(o.id)}
                          onChange={() => alternarObjetivo(o.id)}
                        />
                        <span>
                          <b>{o.dominio}</b>
                          <span className="block text-sm text-tinta2">{o.descricaoTecnica}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <Erro chave="objetivoIds" />

                <fieldset className="border-0 p-0">
                  <legend className="text-sm font-bold">Destinatário</legend>
                  {/* A escolha decide qual redacao do objetivo vai impressa. */}
                  <p className="mt-1 text-sm text-tinta2">
                    A equipe recebe a redação técnica; a família recebe a redação acessível, escrita
                    por você no plano.
                  </p>
                  <div className="mt-2 flex flex-col gap-2">
                    {(['PROFISSIONAIS', 'FAMILIA'] as const).map((d) => (
                      <label key={d} className="flex min-h-11 items-center gap-2.5 rounded-lg border border-linha bg-sup px-3 py-2.5 text-[15px]">
                        <input
                          type="radio"
                          name="destinatario"
                          className="h-5 w-5 flex-none"
                          checked={destinatario === d}
                          onChange={() => setDestinatario(d)}
                        />
                        {NOME_DO_DESTINATARIO[d]}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <Campo
                  id="consideracoes"
                  rotulo="Considerações do profissional"
                  dica="A sua leitura do período. É esta parte que o relatório existe para carregar."
                >
                  <textarea
                    id="consideracoes"
                    rows={6}
                    className="w-full rounded-lg border-2 border-linha bg-sup px-3 py-2.5 text-tinta"
                    value={consideracoes}
                    onChange={(e) => setConsideracoes(e.target.value)}
                    aria-describedby={erros.consideracoes ? 'consideracoes-erro' : 'consideracoes-dica'}
                    aria-invalid={erros.consideracoes ? true : undefined}
                  />
                </Campo>
                <Erro chave="consideracoes" />

                <div className="flex flex-wrap gap-2">
                  {/* Emitir e o que grava; pre-visualizar e o submit para que a
                      tecla Enter num campo mostre o documento, e nao o emita. */}
                  <Botao area="cli" disabled={ocupado} onClick={() => void emitir()}>
                    {ocupado ? 'Aguarde…' : 'Emitir relatório'}
                  </Botao>
                  <Botao area="cli" variante="secundaria" type="submit" disabled={ocupado}>
                    Pré-visualizar
                  </Botao>
                </div>
              </form>
            </Cartao>

            <section aria-labelledby="h-historico" className="flex flex-col gap-3">
              <h2 id="h-historico" className="text-lg font-bold">Relatórios emitidos</h2>

              {historico.tipo === 'carregando' && (
                <EstadoCarregando forma="lista" linhas={2} rotulo="Carregando os relatórios emitidos" />
              )}

              {historico.tipo === 'erro' && (
                <EstadoErro
                  erro={historico.erro}
                  oQue="os relatórios deste paciente"
                  nivel={3}
                  aoTentarDeNovo={() => setTentativa((t) => t + 1)}
                />
              )}

              {historico.tipo === 'pronto' && (
                historico.dados.total === 0 ? (
                  // Sem EstadoVazio: a acao que ele ofereceria e o formulario
                  // ao lado, nesta mesma tela (docs/02, secao 4).
                  <Cartao>
                    <p className="text-tinta2">
                      Nenhum relatório emitido para este paciente ainda.
                    </p>
                  </Cartao>
                ) : (
                  <>
                    <ul className="flex flex-col gap-2">
                      {historico.dados.itens.map((r) => (
                        <li key={r.id}>
                          <Link
                            to={`/app/clinica/pacientes/${id}/relatorio/${r.id}`}
                            className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-lg border border-linha bg-sup px-3 py-2.5 text-[15px] hover:bg-sup2"
                          >
                            <span>
                              <b className="text-cli-ink underline">
                                {emData(r.periodoInicio)} a {emData(r.periodoFim)}
                              </b>
                              <span className="block text-sm text-tinta2">
                                {NOME_DO_DESTINATARIO[r.destinatario]} · emitido em{' '}
                                {new Date(r.emitidoEm).toLocaleDateString('pt-BR')} por {r.autorNome}
                              </span>
                            </span>
                            <span aria-hidden="true" className="text-tinta2">›</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <Paginacao
                      pagina={historico.dados.pagina}
                      porPagina={historico.dados.porPagina}
                      total={historico.dados.total}
                      aoMudar={setPagina}
                      rotulo="Páginas dos relatórios emitidos"
                      nomeItens={{ singular: 'relatório', plural: 'relatórios' }}
                    />
                  </>
                )
              )}
            </section>
          </section>

          <section aria-labelledby="h-previa" className="flex min-w-0 flex-col gap-3">
            <h2 id="h-previa" className="text-lg font-bold">Pré-visualização</h2>
            <div ref={regiaoPrevia} tabIndex={-1}>
              {previa ? (
                <FolhaRelatorio conteudo={previa} />
              ) : (
                <Cartao>
                  <p className="text-tinta2">
                    Escolha o período, os objetivos e o destinatário e use “Pré-visualizar”. O
                    documento aparece aqui exatamente como vai ser emitido.
                  </p>
                </Cartao>
              )}
            </div>
          </section>
        </div>
      )}
    </Tela>
  )
}
