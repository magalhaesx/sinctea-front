import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Tela } from '../LayoutApp'
import { Aviso } from '../../ui/Aviso'
import { Botao } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { Cartao } from '../../ui/Cartao'
import { Etiqueta } from '../../ui/Etiqueta'
import { Titulo } from '../../ui/Titulo'
import { EstadoCarregando } from '../../ui/EstadoCarregando'
import { EstadoErro } from '../../ui/EstadoErro'
import { Paginacao } from '../../ui/Paginacao'
import { CartaoAtividadeFamilia } from '../../componentes/CartaoAtividadeFamilia'
import { frequenciaSemanalEmPalavras } from '../../dominio/regras'
import {
  ErroServico, servicos, type AtividadeCasa, type Desempenho, type ExecucaoAtividadeCasa,
  type NovaAtividadeCasa, type Objetivo, type Pagina, type PlanoTerapeutico,
} from '../../servicos'

/**
 * Tela 9 · Prescrever atividade para casa · /app/clinica/pacientes/:id/atividades
 * UC07
 *
 * A adesao aparece em contagem, nunca em percentual. A familia le a propria
 * atividade na tela 16, e um percentual de adesao vira nota — nota vira culpa.
 * "Nao quis" e registro como os outros: a familia tentou, e isso e informacao
 * clinica.
 *
 * O cartao "Como a familia vai ver" acompanha quem escreve, e e o mesmo
 * componente que a tela da familia usa. Nao ha botao que simplifique o texto:
 * a redacao acessivel e escrita por quem prescreve (regra 4 do CLAUDE.md).
 */

const POR_PAGINA = 5
const JANELA_DIAS = 7

const NOME_DO_DESEMPENHO: Record<Desempenho, string> = {
  SOZINHO: 'sozinho', COM_AJUDA: 'com ajuda', NAO_QUIS: 'não quis',
}

const VAZIO = {
  objetivoId: '', titulo: '', descricao: '', passos: '', dicas: '',
  frequenciaSemanal: '3', urlVideo: '',
}

type Estado<T> =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'pronto'; dados: T }

const emData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')
const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`

/** Zero hora do primeiro dos ultimos sete dias, contando hoje. */
function inicioDaJanela(agora: Date): number {
  const d = new Date(agora)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - (JANELA_DIAS - 1))
  return d.getTime()
}

const emLinhas = (texto: string) => texto.split('\n').map((l) => l.trim()).filter(Boolean)

// ------------------------------------------------------------- Execucoes

/**
 * Contagem dos ultimos sete dias e divisao por desempenho. Pede cem execucoes
 * porque o servico devolve as mais recentes primeiro — cobre a janela com
 * folga, e a conta e de um paciente so, nao da clinica inteira.
 */
function Adesao({ atividade }: { atividade: AtividadeCasa }) {
  const [estado, setEstado] = useState<Estado<ExecucaoAtividadeCasa[]>>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true
    setEstado({ tipo: 'carregando' })
    servicos.atividades.listarExecucoes(atividade.id, { porPagina: 100 })
      .then((p) => { if (ativo) setEstado({ tipo: 'pronto', dados: p.itens }) })
      .catch((erro) => { if (ativo) setEstado({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [atividade.id, tentativa])

  if (estado.tipo === 'carregando') {
    return <EstadoCarregando forma="texto" linhas={2} rotulo="Carregando os registros da família" />
  }

  if (estado.tipo === 'erro') {
    return (
      <EstadoErro
        erro={estado.erro}
        oQue="os registros desta atividade"
        nivel={3}
        aoTentarDeNovo={() => setTentativa((t) => t + 1)}
      />
    )
  }

  const desde = inicioDaJanela(new Date())
  const daJanela = estado.dados.filter((e) => Date.parse(e.dataRealizacao) >= desde)
  const conta = (d: Desempenho) => daJanela.filter((e) => e.desempenho === d).length

  return (
    <div className="text-[15px]">
      <p>
        <b>{plural(daJanela.length, 'registro', 'registros')} nos últimos {JANELA_DIAS} dias</b>
        {' · '}
        prescrita {plural(atividade.frequenciaSemanal, 'vez', 'vezes')} por semana
      </p>
      {/* "Nao quis" conta como registro: a familia tentou. */}
      <p className="mt-0.5 text-tinta2">
        {(['SOZINHO', 'COM_AJUDA', 'NAO_QUIS'] as const)
          .map((d) => `${NOME_DO_DESEMPENHO[d]} ${conta(d)}`)
          .join(' · ')}
      </p>
    </div>
  )
}

function Historico({ atividadeId }: { atividadeId: string }) {
  const [estado, setEstado] = useState<Estado<Pagina<ExecucaoAtividadeCasa>>>({ tipo: 'carregando' })
  const [pagina, setPagina] = useState(1)
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true
    setEstado({ tipo: 'carregando' })
    servicos.atividades.listarExecucoes(atividadeId, { pagina, porPagina: POR_PAGINA })
      .then((dados) => { if (ativo) setEstado({ tipo: 'pronto', dados }) })
      .catch((erro) => { if (ativo) setEstado({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [atividadeId, pagina, tentativa])

  return (
    <div className="mt-3 border-t border-linha pt-3">
      {estado.tipo === 'carregando' && (
        <EstadoCarregando forma="lista" linhas={3} rotulo="Carregando o histórico de execuções" />
      )}

      {estado.tipo === 'erro' && (
        <EstadoErro
          erro={estado.erro}
          oQue="o histórico desta atividade"
          nivel={3}
          aoTentarDeNovo={() => setTentativa((t) => t + 1)}
        />
      )}

      {estado.tipo === 'pronto' && (
        estado.dados.total === 0 ? (
          <p className="text-[15px] text-tinta2">
            A família ainda não registrou nenhuma execução desta atividade.
          </p>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {estado.dados.itens.map((e) => (
                <li key={e.id} className="rounded-lg border border-linha bg-sup px-3 py-2.5 text-[15px]">
                  <span className="flex flex-wrap items-center gap-2">
                    <b>{emData(e.dataRealizacao)}</b>
                    <Etiqueta simbolo="○">{NOME_DO_DESEMPENHO[e.desempenho]}</Etiqueta>
                  </span>
                  {e.observacao && <p className="mt-1 text-tinta2">“{e.observacao}”</p>}
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <Paginacao
                pagina={estado.dados.pagina}
                porPagina={estado.dados.porPagina}
                total={estado.dados.total}
                aoMudar={setPagina}
                rotulo="Páginas do histórico de execuções"
                nomeItens={{ singular: 'registro', plural: 'registros' }}
              />
            </div>
          </>
        )
      )}
    </div>
  )
}

// -------------------------------------------------------------- Atividade

function CartaoAtividade({ atividade, objetivo, aoEncerrar }: {
  atividade: AtividadeCasa
  objetivo: Objetivo | undefined
  aoEncerrar: (a: AtividadeCasa) => Promise<void>
}) {
  const [historico, setHistorico] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const botaoEncerrar = useRef<HTMLButtonElement>(null)
  const caixa = useRef<HTMLDivElement>(null)
  const focoPendente = useRef<'caixa' | 'botao' | null>(null)

  useEffect(() => {
    const alvo = focoPendente.current
    if (!alvo) return
    focoPendente.current = null
    const no = alvo === 'caixa' ? caixa.current : botaoEncerrar.current
    no?.focus()
  })

  const confirmar = async () => {
    setSalvando(true)
    try {
      await aoEncerrar(atividade)
    } finally {
      setSalvando(false)
      setConfirmando(false)
    }
  }

  return (
    <Cartao>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold">{atividade.titulo}</h3>
          <p className="mt-0.5 text-sm text-tinta2">
            {objetivo
              ? <>Objetivo: {objetivo.dominio} — {objetivo.descricaoTecnica}</>
              : 'Objetivo fora do plano vigente.'}
          </p>
        </div>
        <span className="text-sm text-tinta2">Prescrita em {emData(atividade.prescritaEm)}</span>
      </div>

      <div className="mt-3">
        <Adesao atividade={atividade} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Botao variante="secundaria" area="cli" aria-expanded={historico}
          onClick={() => setHistorico((v) => !v)}>
          {historico ? 'Ocultar o histórico' : 'Ver o histórico'}
        </Botao>
        {!confirmando && (
          <Botao variante="secundaria" area="cli" ref={botaoEncerrar}
            onClick={() => { setConfirmando(true); focoPendente.current = 'caixa' }}>
            Encerrar atividade
          </Botao>
        )}
      </div>

      {/* Duas etapas, como toda acao sem desfazer pela tela. */}
      {confirmando && (
        <div
          ref={caixa}
          tabIndex={-1}
          role="group"
          aria-labelledby={`encerrar-${atividade.id}`}
          className="mt-3 rounded-lg border border-at bg-at-sup p-3.5"
        >
          <p id={`encerrar-${atividade.id}`} className="font-bold text-tinta">
            Encerrar “{atividade.titulo}”?
          </p>
          <p className="mt-1 text-sm text-tinta2">
            A família deixa de ver esta atividade e não consegue mais registrar execuções. O que
            já foi registrado permanece no histórico.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Botao area="cli" onClick={() => void confirmar()} disabled={salvando}>
              {salvando ? 'Encerrando…' : 'Encerrar atividade'}
            </Botao>
            <Botao area="cli" variante="secundaria" disabled={salvando}
              onClick={() => { setConfirmando(false); focoPendente.current = 'botao' }}>
              Cancelar
            </Botao>
          </div>
        </div>
      )}

      {historico && <Historico atividadeId={atividade.id} />}
    </Cartao>
  )
}

// ------------------------------------------------------------------ Tela

export function Atividades() {
  const { id = '' } = useParams()
  const [plano, setPlano] = useState<Estado<PlanoTerapeutico | null>>({ tipo: 'carregando' })
  const [ativas, setAtivas] = useState<Estado<Pagina<AtividadeCasa>>>({ tipo: 'carregando' })
  const [pagina, setPagina] = useState(1)
  const [tentativa, setTentativa] = useState(0)

  const [formulario, setFormulario] = useState(VAZIO)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const regiaoViva = useRef<HTMLDivElement>(null)
  const focarAviso = useRef(false)

  useEffect(() => {
    const alvo = focarAviso.current
    if (!alvo) return
    focarAviso.current = false
    regiaoViva.current?.focus()
  })

  // O recado e do que acabou de acontecer com ESTE paciente. So a troca de
  // paciente o apaga: as acoes daqui recarregam a lista, e limpar a cada
  // recarga mataria o recado com a recarga que ele mesmo pediu.
  useEffect(() => { setAviso(null); setErros({}) }, [id])

  useEffect(() => {
    let ativo = true
    setPlano({ tipo: 'carregando' })
    servicos.planos.obterPorPaciente(id)
      .then((dados) => { if (ativo) setPlano({ tipo: 'pronto', dados }) })
      .catch((erro) => {
        if (!ativo) return
        // Sem plano nao e falha desta tela: e o caso de "ainda nao da para
        // prescrever", e a lista de atividades continua valendo.
        const semPlano = erro instanceof ErroServico && erro.codigo === 'NAO_ENCONTRADO'
        setPlano(semPlano ? { tipo: 'pronto', dados: null } : { tipo: 'erro', erro })
      })
    return () => { ativo = false }
  }, [id, tentativa])

  useEffect(() => {
    let ativo = true
    setAtivas({ tipo: 'carregando' })
    servicos.atividades.listarPorPaciente(id, { ativa: true, pagina, porPagina: POR_PAGINA })
      .then((dados) => { if (ativo) setAtivas({ tipo: 'pronto', dados }) })
      .catch((erro) => { if (ativo) setAtivas({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [id, pagina, tentativa])

  const recarregar = () => setTentativa((t) => t + 1)

  const vigente = plano.tipo === 'pronto' && plano.dados?.status === 'VIGENTE' ? plano.dados : null
  const objetivos = vigente?.objetivos ?? []
  const objetivoPorId = (objetivoId: string) =>
    plano.tipo === 'pronto' ? plano.dados?.objetivos.find((o) => o.id === objetivoId) : undefined

  const encerrar = async (a: AtividadeCasa) => {
    setAviso(null)
    setErros({})
    try {
      await servicos.atividades.encerrar(a.id)
      setAviso(`“${a.titulo}” foi encerrada. A família não vê mais esta atividade.`)
      recarregar()
    } catch (e) {
      setErros({ geral: (e as Error).message || 'Não foi possível encerrar agora.' })
    } finally {
      // O cartao sai da lista com o encerramento: o foco vai para o recado.
      focarAviso.current = true
    }
  }

  const prescrever = async (evento: FormEvent) => {
    evento.preventDefault()
    setAviso(null)
    setErros({})
    setSalvando(true)
    const dados: NovaAtividadeCasa = {
      pacienteId: id,
      objetivoId: formulario.objetivoId,
      titulo: formulario.titulo,
      descricao: formulario.descricao,
      passos: emLinhas(formulario.passos),
      dicas: formulario.dicas,
      frequenciaSemanal: Number(formulario.frequenciaSemanal),
      urlVideo: formulario.urlVideo.trim() || null,
    }
    try {
      const atividade = await servicos.atividades.prescrever(dados)
      setFormulario(VAZIO)
      setAviso(`“${atividade.titulo}” foi prescrita. A família já pode ver a atividade.`)
      focarAviso.current = true
      recarregar()
    } catch (e) {
      const erro = e as ErroServico
      setErros(erro instanceof ErroServico && Object.keys(erro.campos).length > 0
        ? erro.campos
        : { geral: erro.message ?? 'Não foi possível prescrever agora.' })
    } finally {
      setSalvando(false)
    }
  }

  const campo = 'min-h-11 w-full rounded-lg border-2 border-linha bg-sup px-3 py-2.5 text-tinta'
  const area = 'w-full rounded-lg border-2 border-linha bg-sup px-3 py-2.5 text-tinta'
  const atributosDeErro = (chave: string) => erros[chave]
    ? { 'aria-describedby': `${chave}-erro`, 'aria-invalid': true as const }
    : {}
  const Erro = ({ chave }: { chave: string }) => erros[chave]
    ? <p id={`${chave}-erro`} className="text-sm font-bold text-cr">{erros[chave]}</p>
    : null

  const negado = plano.tipo === 'erro' && plano.erro instanceof ErroServico
    && plano.erro.codigo === 'ACESSO_NEGADO'

  return (
    <Tela area="cli" caminho={['Área clínica', 'Pacientes', 'Atividades para casa']}>
      <Titulo sub="O que a família faz entre uma sessão e outra, escrito na linguagem de quem vai ler">
        Atividades para casa
      </Titulo>

      <div ref={regiaoViva} tabIndex={-1} aria-live="polite">
        {aviso && <Aviso tom="ok" titulo="Pronto">{aviso}</Aviso>}
        {erros.geral && <Aviso tom="cr" titulo="Não foi possível concluir">{erros.geral}</Aviso>}
      </div>

      <section aria-labelledby="h-ativas" className="flex flex-col gap-3">
        <h2 id="h-ativas" className="text-lg font-bold">Atividades ativas</h2>

        {ativas.tipo === 'carregando' && (
          <EstadoCarregando forma="cartoes" quantidade={2} rotulo="Carregando as atividades ativas" />
        )}

        {ativas.tipo === 'erro' && (
          <EstadoErro
            erro={ativas.erro}
            oQue="as atividades deste paciente"
            nivel={3}
            titulo={negado ? 'Estas atividades não são do seu alcance' : undefined}
            aoTentarDeNovo={() => recarregar()}
          />
        )}

        {ativas.tipo === 'pronto' && (
          ativas.dados.total === 0 ? (
            // Sem EstadoVazio: a acao que ele ofereceria e o formulario logo
            // abaixo, nesta mesma tela (docs/02, secao 4).
            <Cartao>
              <p className="text-tinta2">
                {plano.tipo === 'pronto' && !vigente
                  // Sem plano vigente nao ha formulario abaixo: apontar para ele
                  // seria mandar a pessoa procurar o que nao esta la.
                  ? 'Nenhuma atividade ativa no momento.'
                  : 'Nenhuma atividade ativa no momento. Use o formulário abaixo para prescrever a primeira.'}
              </p>
            </Cartao>
          ) : (
            <>
              <ul className="flex flex-col gap-3">
                {ativas.dados.itens.map((a) => (
                  <li key={a.id}>
                    <CartaoAtividade
                      atividade={a}
                      objetivo={objetivoPorId(a.objetivoId)}
                      aoEncerrar={encerrar}
                    />
                  </li>
                ))}
              </ul>
              <Paginacao
                pagina={ativas.dados.pagina}
                porPagina={ativas.dados.porPagina}
                total={ativas.dados.total}
                aoMudar={setPagina}
                rotulo="Páginas das atividades ativas"
                nomeItens={{ singular: 'atividade', plural: 'atividades' }}
              />
            </>
          )
        )}
      </section>

      <section aria-labelledby="h-nova" className="flex flex-col gap-3">
        <h2 id="h-nova" className="text-lg font-bold">Prescrever nova</h2>

        {plano.tipo === 'carregando' && (
          <EstadoCarregando forma="cartoes" quantidade={1} rotulo="Carregando o plano terapêutico" />
        )}

        {plano.tipo === 'erro' && (
          <EstadoErro
            erro={plano.erro}
            oQue="o plano terapêutico"
            nivel={3}
            aoTentarDeNovo={negado ? undefined : () => recarregar()}
          />
        )}

        {plano.tipo === 'pronto' && !vigente && (
          // Atividade solta nao existe: ela se vincula a um objetivo do plano.
          <Cartao>
            <p className="text-tinta2">Para prescrever, o paciente precisa de um plano vigente.</p>
            <p className="mt-3">
              <Link to={`/app/clinica/pacientes/${id}/plano`} className="font-bold text-cli-ink underline">
                Abrir o plano terapêutico
              </Link>
            </p>
          </Cartao>
        )}

        {vigente && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Cartao>
              <form onSubmit={(e) => void prescrever(e)} className="flex flex-col gap-4">
                <Campo id="objetivo" rotulo="Objetivo do plano" dica="Atividade sem objetivo não existe: a família precisa saber para que serve.">
                  <select id="objetivo" className={campo} value={formulario.objetivoId}
                    onChange={(e) => setFormulario((f) => ({ ...f, objetivoId: e.target.value }))}
                    {...atributosDeErro('objetivoId')}>
                    <option value="">Escolha o objetivo</option>
                    {objetivos.map((o) => (
                      <option key={o.id} value={o.id}>{o.dominio} — {o.descricaoTecnica}</option>
                    ))}
                  </select>
                </Campo>
                <Erro chave="objetivoId" />

                <Campo id="titulo" rotulo="Título" dica="Como a família vai chamar esta atividade.">
                  <input id="titulo" className={campo} value={formulario.titulo}
                    onChange={(e) => setFormulario((f) => ({ ...f, titulo: e.target.value }))}
                    {...atributosDeErro('titulo')} />
                </Campo>
                <Erro chave="titulo" />

                <Campo id="descricao" rotulo="Descrição" dica="Uma frase sobre o que fazer e quando.">
                  <textarea id="descricao" rows={2} className={area} value={formulario.descricao}
                    onChange={(e) => setFormulario((f) => ({ ...f, descricao: e.target.value }))} />
                </Campo>

                <Campo id="passos" rotulo="Passos" dica="Um passo por linha, na ordem de fazer.">
                  <textarea id="passos" rows={5} className={area} value={formulario.passos}
                    onChange={(e) => setFormulario((f) => ({ ...f, passos: e.target.value }))}
                    {...atributosDeErro('passos')} />
                </Campo>
                <Erro chave="passos" />

                <Campo id="dicas" rotulo="Dicas" dica="O que ajuda quando não sai de primeira.">
                  <textarea id="dicas" rows={2} className={area} value={formulario.dicas}
                    onChange={(e) => setFormulario((f) => ({ ...f, dicas: e.target.value }))} />
                </Campo>

                <Campo id="frequencia" rotulo="Frequência semanal">
                  <select id="frequencia" className={campo} value={formulario.frequenciaSemanal}
                    onChange={(e) => setFormulario((f) => ({ ...f, frequenciaSemanal: e.target.value }))}
                    {...atributosDeErro('frequenciaSemanal')}>
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <option key={n} value={n}>{frequenciaSemanalEmPalavras(n)}</option>
                    ))}
                  </select>
                </Campo>
                <Erro chave="frequenciaSemanal" />

                <Campo id="video" rotulo="Vídeo (opcional)" dica="Endereço de um vídeo curto mostrando como fazer.">
                  <input id="video" type="url" className={campo} value={formulario.urlVideo}
                    onChange={(e) => setFormulario((f) => ({ ...f, urlVideo: e.target.value }))} />
                </Campo>

                <div>
                  <Botao area="cli" type="submit" disabled={salvando}>
                    {salvando ? 'Prescrevendo…' : 'Prescrever atividade'}
                  </Botao>
                </div>
              </form>
            </Cartao>

            <div className="flex flex-col gap-2">
              <h3 className="text-base font-bold">Como a família vai ver</h3>
              <p className="text-sm text-tinta2">
                Atualiza enquanto você escreve. A redação é sua: o sistema não reescreve o seu
                texto nem gera versão simplificada.
              </p>
              <CartaoAtividadeFamilia
                atividade={{
                  titulo: formulario.titulo,
                  descricao: formulario.descricao,
                  passos: emLinhas(formulario.passos),
                  dicas: formulario.dicas,
                  frequenciaSemanal: Number(formulario.frequenciaSemanal),
                  urlVideo: formulario.urlVideo.trim() || null,
                }}
              />
            </div>
          </div>
        )}
      </section>
    </Tela>
  )
}
