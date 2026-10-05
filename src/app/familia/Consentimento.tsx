import { useEffect, useState, type FormEvent } from 'react'
import { Tela } from '../LayoutApp'
import { usarSessao } from '../../contexto/Sessao'
import { dataIsoParaLocal, emData } from '../../dominio/datas'
import { validarNovoConsentimento } from '../../dominio/regras'
import {
  conferirResumoDoTermo, textoDoTermo, VERSAO_CORRENTE_DO_TERMO, versaoConhecida, versaoDoResumo,
  type DadosDoResumo,
} from '../../dominio/termo'
import { Aviso } from '../../ui/Aviso'
import { Botao } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { Cartao } from '../../ui/Cartao'
import { Etiqueta } from '../../ui/Etiqueta'
import { Titulo } from '../../ui/Titulo'
import {
  servicos, type ConsentimentoConcedido, type ConsentimentoDetalhe, type Escola,
  type EscopoAcesso, type FilhoResumo,
} from '../../servicos'
import { EstadoCarregando } from '../../ui/EstadoCarregando'
import { EstadoErro } from '../../ui/EstadoErro'
import { NUNCA_VISIVEL } from '../limites'

/**
 * Tela 17 · Autorizar o acesso da escola · /app/familia/consentimento
 *
 * Quem autoriza e o Responsavel (regra 1). A familia nomeia a ESCOLA ao
 * conceder — consentimento precisa ser especifico e informado —, e o professor
 * declara turma, turno e atuacao ao aceitar o convite.
 *
 * A revogacao vale na hora (regra 5) e tem confirmacao em duas etapas.
 *
 * Conceder tambem vai em duas etapas, e a segunda e o TERMO INTEIRO. Dado de
 * saude exige consentimento especifico e destacado (LGPD, art. 11, I): uma
 * caixa marcada no meio de um formulario nao e destaque. A familia le o texto
 * com os valores dela preenchidos antes de autorizar.
 *
 * O texto nao fica gravado. O que fica e a versao, dentro do resumo — e o
 * texto se reproduz a partir dela mais os campos do consentimento, que ja
 * estao persistidos. "Ver o termo que aceitei" reconstroi e confere.
 */

const ESCOPOS: { valor: EscopoAcesso; rotulo: string; explicacao: string }[] = [
  {
    valor: 'CARTAO_ESTRATEGIA',
    rotulo: 'Cartão de estratégias',
    explicacao: 'Orientações práticas do que fazer e do que evitar, em linguagem simples.',
  },
  {
    valor: 'REGISTRO_OCORRENCIA',
    rotulo: 'Registrar o que acontece na escola',
    explicacao: 'O professor descreve situações; a leitura clínica continua com a terapeuta.',
  },
]

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'pronto'; filhos: FilhoResumo[]; escolas: Escola[]; consentimentos: ConsentimentoDetalhe[] }


export function Consentimento() {
  const { usuario } = usarSessao()
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)
  const [pacienteId, setPacienteId] = useState<string | null>(null)

  const [escolaId, setEscolaId] = useState('')
  const [escopos, setEscopos] = useState<EscopoAcesso[]>(['CARTAO_ESTRATEGIA', 'REGISTRO_OCORRENCIA'])
  const [validadeAte, setValidadeAte] = useState('')
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const [convite, setConvite] = useState<ConsentimentoConcedido | null>(null)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  /** 'formulario' escolhe; 'termo' le e autoriza. */
  const [etapa, setEtapa] = useState<'formulario' | 'termo'>('formulario')
  const [termoAberto, setTermoAberto] = useState<
    { consentimentoId: string; texto: string; confere: boolean | null } | null
  >(null)

  useEffect(() => {
    let ativo = true
    setEstado({ tipo: 'carregando' })
    const carregar = async () => {
      const [filhos, escolas] = await Promise.all([
        servicos.familia.listarFilhos(),
        servicos.escolas.listar({ porPagina: 100 }),
      ])
      const alvo = pacienteId ?? filhos.itens[0]?.id ?? null
      const consentimentos = alvo
        ? (await servicos.consentimentos.listarPorPaciente(alvo, { porPagina: 50 })).itens
        : []
      return { filhos: filhos.itens, escolas: escolas.itens, consentimentos, alvo }
    }
    carregar()
      .then(({ filhos, escolas, consentimentos, alvo }) => {
        if (!ativo) return
        setPacienteId(alvo)
        setEstado({ tipo: 'pronto', filhos, escolas, consentimentos })
      })
      .catch((erro) => { if (ativo) setEstado({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [pacienteId, tentativa])

  const recarregar = () => setTentativa((t) => t + 1)

  const alternarEscopo = (valor: EscopoAcesso) =>
    setEscopos((atual) => atual.includes(valor) ? atual.filter((e) => e !== valor) : [...atual, valor])

  /** Fim do dia escolhido: o acesso vale ate o ultimo instante daquela data. */
  const validadeIso = () => validadeAte ? new Date(`${validadeAte}T23:59:59`).toISOString() : ''

  /**
   * Primeira etapa: so confere o que a propria regra de dominio confere, para
   * ninguem ler o termo inteiro e so depois descobrir que faltou a escola.
   */
  const revisarTermo = (evento: FormEvent) => {
    evento.preventDefault()
    if (!pacienteId) return
    const encontrados = validarNovoConsentimento(
      { pacienteId, escolaId, escopos, validadeAte: validadeIso() },
      new Date(),
    )
    setErros(encontrados)
    if (Object.keys(encontrados).length === 0) setEtapa('termo')
  }

  const conceder = async () => {
    if (!pacienteId) return
    setErros({})
    setSalvando(true)
    try {
      const concedido = await servicos.consentimentos.conceder({
        pacienteId, escolaId, escopos, validadeAte: validadeIso(),
      })
      setEtapa('formulario')
      setConvite(concedido)
      setAviso(`Acesso autorizado para ${concedido.consentimento.escola}. Entregue o convite ao professor.`)
      recarregar()
    } catch (e) {
      const erro = e as { campos?: Record<string, string>; message?: string }
      setErros(erro.campos && Object.keys(erro.campos).length > 0
        ? erro.campos
        : { geral: erro.message ?? 'Não foi possível autorizar agora.' })
      // Erro de campo so se corrige no formulario.
      setEtapa('formulario')
    } finally {
      setSalvando(false)
    }
  }

  const reemitir = async (consentimentoId: string) => {
    try {
      const novo = await servicos.consentimentos.reemitirConvite(consentimentoId)
      setConvite(novo)
      setAviso('Convite novo gerado. O anterior deixou de valer neste momento.')
      recarregar()
    } catch (e) {
      setAviso((e as Error).message)
    }
  }

  const revogar = async (consentimentoId: string) => {
    try {
      const revogado = await servicos.consentimentos.revogar(consentimentoId)
      setConfirmando(null)
      setAviso(`O acesso de ${revogado.escola} foi encerrado agora.`)
      recarregar()
    } catch (e) {
      setAviso((e as Error).message)
    }
  }

  const campo = 'min-h-11 w-full rounded-lg border-2 border-linha bg-sup px-3 py-2.5 text-tinta'

  const nomeDoFilho = (id: string | null) => estado.tipo === 'pronto'
    ? estado.filhos.find((f) => f.id === id)?.nome ?? '—'
    : '—'

  /** Os campos do resumo de um consentimento ja gravado. */
  const dadosDoResumo = (c: ConsentimentoDetalhe, versao: string): DadosDoResumo => ({
    versaoTermo: versao,
    responsavel: { id: c.responsavelId, nome: usuario?.nome ?? '' },
    paciente: { id: c.pacienteId, nome: nomeDoFilho(c.pacienteId) },
    escola: { id: c.escolaId, nome: c.escola },
    escopos: c.escopos,
    validadeAte: c.validadeAte,
    concedidoEm: c.concedidoEm,
  })

  /**
   * Reconstroi o texto da versao registrada e confere o resumo. O texto nunca
   * foi guardado: ele nasce da versao mais os campos do consentimento, e e o
   * resumo que prova que nenhum deles mudou depois.
   */
  const verTermo = async (c: ConsentimentoDetalhe) => {
    if (termoAberto?.consentimentoId === c.id) { setTermoAberto(null); return }
    const versao = versaoDoResumo(c.hashTermo)
    if (!versao || !versaoConhecida(versao)) {
      setTermoAberto({
        consentimentoId: c.id,
        texto: 'Não foi possível reconstruir este termo: a versão registrada não está neste sistema.',
        confere: false,
      })
      return
    }
    const dados = dadosDoResumo(c, versao)
    setTermoAberto({
      consentimentoId: c.id,
      texto: textoDoTermo(versao, {
        responsavel: dados.responsavel.nome,
        escola: dados.escola.nome,
        aluno: dados.paciente.nome,
        escopos: dados.escopos,
        validadeAte: dados.validadeAte,
      }),
      confere: null,
    })
    const confere = await conferirResumoDoTermo(c.hashTermo, dados)
    setTermoAberto((atual) => atual?.consentimentoId === c.id ? { ...atual, confere } : atual)
  }

  // Linguagem da familia: o filho e chamado pelo primeiro nome.
  const primeiroNome = estado.tipo === 'pronto'
    ? estado.filhos.find((f) => f.id === pacienteId)?.nome.split(' ')[0] ?? 'seu filho'
    : 'seu filho'

  return (
    <Tela
      area="fam"
      nome="Acesso da escola"
      papel="Quem autoriza é você"
      caminho={['Área da família', 'Autorizar o acesso da escola']}
      estreito
    >
      <Titulo sub="Você escolhe a escola, o que ela vê e por quanto tempo. Pode encerrar a qualquer momento, e o encerramento vale na hora.">
        Autorizar o acesso da escola
      </Titulo>

      {estado.tipo === 'carregando' && (
        <EstadoCarregando forma="cartoes" quantidade={2} rotulo="Carregando as autorizações" />
      )}

      {estado.tipo === 'erro' && (
        <EstadoErro erro={estado.erro} oQue="as autorizações" area="fam" aoTentarDeNovo={recarregar} />
      )}

      {estado.tipo === 'pronto' && (
        <>
          {estado.filhos.length > 1 && (
            <Cartao>
              <Campo id="filho" rotulo="Autorização de qual filho">
                <select
                  id="filho"
                  className={campo}
                  value={pacienteId ?? ''}
                  onChange={(e) => { setPacienteId(e.target.value); setConvite(null); setAviso(null) }}
                >
                  {estado.filhos.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </Campo>
            </Cartao>
          )}

          {etapa === 'formulario' && (
          <Cartao>
            <h2 className="text-lg font-bold">Autorizar uma escola</h2>
            <form className="mt-3 flex flex-col gap-4" onSubmit={revisarTermo} noValidate>
              <Campo id="escola" rotulo="Escola" dica="O acesso vale para esta escola. Outra escola precisa de uma autorização própria.">
                <select id="escola" className={campo} value={escolaId} onChange={(e) => setEscolaId(e.target.value)}>
                  <option value="">Escolha a escola</option>
                  {estado.escolas.map((e) => (
                    <option key={e.id} value={e.id}>{e.nome} · {e.rede} · {e.municipio}</option>
                  ))}
                </select>
                {erros.escolaId && <p className="text-sm font-bold text-cr">{erros.escolaId}</p>}
              </Campo>

              <fieldset className="rounded-lg border border-linha p-4">
                <legend className="px-1.5 font-bold">O que a escola poderá acessar</legend>
                {ESCOPOS.map((e) => (
                  <div key={e.valor} className="flex items-start gap-2.5 py-2.5">
                    <input
                      id={`esc-${e.valor}`}
                      type="checkbox"
                      className="mt-1 h-6 w-6 flex-none accent-[#96301f]"
                      checked={escopos.includes(e.valor)}
                      onChange={() => alternarEscopo(e.valor)}
                    />
                    <label htmlFor={`esc-${e.valor}`}>
                      <b>{e.rotulo}</b>
                      <span className="block text-sm text-tinta2">{e.explicacao}</span>
                    </label>
                  </div>
                ))}
                {erros.escopos && <p className="text-sm font-bold text-cr">{erros.escopos}</p>}
              </fieldset>

              <div className="rounded-lg bg-sup2 p-4">
                <h3 className="font-bold">O que a escola nunca verá</h3>
                <ul className="mt-2.5 flex flex-col gap-2">
                  {NUNCA_VISIVEL.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-tinta2">
                      <svg className="mt-0.5 h-5 w-5 flex-none" viewBox="0 0 24 24" role="img" aria-label="Bloqueado" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M5.6 5.6l12.8 12.8" />
                      </svg>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>

              <Campo id="validade" rotulo="Autorizar até" dica="Depois dessa data o acesso se encerra sozinho, sem você precisar fazer nada.">
                <input
                  id="validade" type="date" className={campo}
                  value={validadeAte} onChange={(e) => setValidadeAte(e.target.value)}
                />
                {erros.validadeAte && <p className="text-sm font-bold text-cr">{erros.validadeAte}</p>}
              </Campo>

              <p className="text-sm text-tinta2">
                Guardamos a versão do termo que você aceitou e um resumo que prova que ele não
                mudou.
              </p>

              {erros.geral && <p role="alert" className="font-bold text-cr">{erros.geral}</p>}

              <Botao area="fam" type="submit" className="w-full" disabled={salvando}>
                Ler o termo e autorizar
              </Botao>
            </form>
          </Cartao>
          )}

          {/* Etapa 2: o termo inteiro, com os valores preenchidos. Consentimento
              para dado de saude precisa ser especifico e destacado — a pessoa le
              o que esta autorizando antes de autorizar (LGPD, art. 11, I). */}
          {etapa === 'termo' && (
            <Cartao>
              <h2 className="text-lg font-bold">Leia antes de autorizar</h2>
              <p className="mt-1 text-sm text-tinta2">
                Este é o termo com os seus dados. Ele fica registrado nesta versão, e você pode
                reabri-lo depois nesta mesma tela.
              </p>

              <div className="mt-3 max-h-96 overflow-y-auto whitespace-pre-line rounded-lg border border-linha bg-sup p-4 text-[15px] leading-relaxed">
                {textoDoTermo(VERSAO_CORRENTE_DO_TERMO, {
                  responsavel: usuario?.nome ?? '',
                  escola: estado.escolas.find((e) => e.id === escolaId)?.nome ?? '',
                  aluno: nomeDoFilho(pacienteId),
                  escopos,
                  validadeAte: validadeIso(),
                })}
              </div>

              {erros.geral && <p role="alert" className="mt-3 font-bold text-cr">{erros.geral}</p>}

              <div className="mt-4 flex flex-col gap-2">
                <Botao area="fam" className="w-full" disabled={salvando}
                  onClick={() => void conceder()}>
                  {salvando ? 'Autorizando…' : 'Autorizar'}
                </Botao>
                <Botao area="fam" variante="secundaria" className="w-full" disabled={salvando}
                  onClick={() => setEtapa('formulario')}>
                  Voltar e corrigir
                </Botao>
              </div>
            </Cartao>
          )}

          <div aria-live="polite">
            {aviso && <Aviso tom="ok" titulo="Pronto">{aviso}</Aviso>}
          </div>

          {convite && (
            <Cartao>
              <h2 className="text-base font-bold">Convite gerado</h2>
              <p className="mb-3 text-sm text-tinta2">
                Entregue este convite ao professor. Ele vale para um único cadastro e expira
                em {emData(convite.conviteExpiraEm)}, às {dataIsoParaLocal(convite.conviteExpiraEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.
              </p>
              <p className="font-bold break-all tabular-nums">
                {location.origin}/#/app/convite/{convite.tokenConvite}
              </p>
            </Cartao>
          )}

          <section aria-labelledby="ativos" className="flex flex-col gap-3">
            <h2 id="ativos" className="text-lg font-bold">Autorizações deste filho</h2>

            {/* Sem EstadoVazio aqui: a acao que ele ofereceria — autorizar uma
                escola — ja esta visivel logo acima (docs/02, secao 4). */}
            {estado.consentimentos.length === 0 && (
              <Cartao>
                <p className="text-tinta2">
                  Nenhuma escola tem acesso aos dados de {primeiroNome}. Quando você quiser
                  autorizar uma, use o formulário acima.
                </p>
              </Cartao>
            )}

            {estado.consentimentos.map((c) => (
              <Cartao key={c.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-base font-bold">{c.escola}</h3>
                  {c.situacao === 'VIGENTE'
                    ? <Etiqueta tom="ok" simbolo="✓">Acesso ativo</Etiqueta>
                    : c.situacao === 'REVOGADO'
                      ? <Etiqueta simbolo="○">Encerrado por você</Etiqueta>
                      : <Etiqueta simbolo="○">Prazo terminado</Etiqueta>}
                </div>

                <p className="mt-1 text-sm text-tinta2">
                  {c.professor ?? 'Ainda sem professor cadastrado'}
                  {c.turma ? ` · ${c.turma}` : ''} · autorizado em {emData(c.concedidoEm)} · vale até {emData(c.validadeAte)}
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {c.escopos.map((e) => (
                    <li key={e}>
                      <Etiqueta simbolo="✓">{ESCOPOS.find((x) => x.valor === e)?.rotulo ?? e}</Etiqueta>
                    </li>
                  ))}
                </ul>

                {c.situacao === 'VIGENTE' && !c.conviteAceito && (
                  <p className="mt-3">
                    <Botao area="fam" variante="secundaria" onClick={() => void reemitir(c.id)}>
                      Gerar novo convite
                    </Botao>
                    <span className="mt-1 block text-sm text-tinta2">
                      O convite dura 72 horas. Se o prazo passou e o professor não se cadastrou,
                      gere outro — o anterior deixa de valer.
                    </span>
                  </p>
                )}

                {/* Acao destrutiva com efeito imediato: confirmacao em duas etapas. */}
                {c.situacao === 'VIGENTE' && (
                  confirmando === c.id ? (
                    <div className="mt-3 rounded-lg border border-cr bg-cr-sup p-3.5">
                      <p className="font-bold">Encerrar o acesso de {c.escola}?</p>
                      <p className="mt-1 text-sm text-tinta2">
                        A partir de agora a escola deixa de ver o cartão de estratégias e não
                        consegue mais registrar ocorrências. Você pode autorizar de novo quando quiser.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Botao area="fam" onClick={() => void revogar(c.id)}>Sim, encerrar agora</Botao>
                        <Botao area="fam" variante="secundaria" onClick={() => setConfirmando(null)}>Cancelar</Botao>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3">
                      <Botao area="fam" variante="secundaria" onClick={() => setConfirmando(c.id)}>
                        Encerrar este acesso
                      </Botao>
                    </p>
                  )
                )}

                {/* A prova na mao da familia: o texto se reconstroi da versao
                    registrada, e o resumo diz se algum campo mudou depois. */}
                <p className="mt-3">
                  <Botao area="fam" variante="secundaria"
                    aria-expanded={termoAberto?.consentimentoId === c.id}
                    onClick={() => void verTermo(c)}>
                    {termoAberto?.consentimentoId === c.id ? 'Fechar o termo' : 'Ver o termo que aceitei'}
                  </Botao>
                </p>

                {termoAberto?.consentimentoId === c.id && (
                  <div className="mt-3">
                    <div className="max-h-96 overflow-y-auto whitespace-pre-line rounded-lg border border-linha bg-sup p-4 text-[15px] leading-relaxed">
                      {termoAberto.texto}
                    </div>
                    <p className="mt-2 text-sm" aria-live="polite">
                      {termoAberto.confere === null && 'Conferindo o texto…'}
                      {termoAberto.confere === true && (
                        <b className="text-ok">
                          Texto conferido: igual ao que você aceitou em {emData(c.concedidoEm)} às{' '}
                          {dataIsoParaLocal(c.concedidoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.
                        </b>
                      )}
                      {termoAberto.confere === false && (
                        <b className="text-cr">
                          O texto não confere com o resumo registrado. Avise a clínica.
                        </b>
                      )}
                    </p>
                  </div>
                )}
              </Cartao>
            ))}
          </section>
        </>
      )}
    </Tela>
  )
}
