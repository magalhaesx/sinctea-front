import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Tela } from '../LayoutApp'
import { usarSessao } from '../../contexto/Sessao'
import { dataIsoParaLocal, emData, emDataCivil } from '@sinctea/compartilhado/dominio/datas'
import { validarNovoConsentimento } from '@sinctea/compartilhado/dominio/regras'
import {
  conferirResumoDoTermo, textoDoTermo, VERSAO_CORRENTE_DO_TERMO, versaoConhecida, versaoDoResumo,
  type DadosDoResumo,
} from '@sinctea/compartilhado/dominio/termo'
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
import { CadastroDeEscola } from './CadastroDeEscola'

/**
 * Tela 17 · Autorizar o acesso da escola · /app/familia/consentimento
 *
 * Quem autoriza e o Responsavel legal (regra 1). A familia nomeia a ESCOLA ao
 * conceder — consentimento precisa ser especifico e informado —, e o professor
 * declara turma, turno e atuacao ao aceitar o convite.
 *
 * Quem e responsavel mas nao responde legalmente pela crianca nao ve o
 * formulario nem o "Gerar novo convite": ve as autorizacoes e pode encerra-las.
 * O servico recusa do mesmo jeito; a tela so nao oferece o que vai ser negado.
 *
 * A revogacao vale na hora (regra 5) e tem confirmacao em duas etapas.
 *
 * A escola que nao esta na lista, a familia cadastra aqui mesmo (lacuna 4),
 * depois de ver as parecidas do mesmo municipio. O sistema comeca vazio: sem
 * nenhuma escola, o cadastro ja abre.
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
  /** De que filho e o que esta na tela: recarga do mesmo nao volta ao "carregando". */
  const carregadoPara = useRef<string | null | undefined>(undefined)

  const [escolaId, setEscolaId] = useState('')
  const [cadastrandoEscola, setCadastrandoEscola] = useState(false)
  const [escopos, setEscopos] = useState<EscopoAcesso[]>(['CARTAO_ESTRATEGIA', 'REGISTRO_OCORRENCIA'])
  const [validadeAte, setValidadeAte] = useState('')
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const [convite, setConvite] = useState<ConsentimentoConcedido | null>(null)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  /** O resultado da ultima acao. Falha nao se anuncia com o titulo "Pronto". */
  const [aviso, setAviso] = useState<{ tom: 'ok' | 'cr'; texto: string } | null>(null)
  /** 'formulario' escolhe; 'termo' le e autoriza. */
  const [etapa, setEtapa] = useState<'formulario' | 'termo'>('formulario')
  const [termoAberto, setTermoAberto] = useState<
    { consentimentoId: string; texto: string; confere: boolean | null } | null
  >(null)

  /*
   * A etapa 2 desmonta o formulario e o botao que tinha o foco. Sem levar o
   * foco para o termo, ele cai no <body>: quem usa leitor de tela nao ouve
   * nada, e quem usa teclado recomeca do topo da pagina.
   */
  const caixaDoTermo = useRef<HTMLDivElement>(null)
  const selectDaEscola = useRef<HTMLSelectElement>(null)
  /*
   * O mesmo vale para encerrar, que tambem tem duas etapas: abrir a
   * confirmacao desmonta o botao, e cancelar desmonta a confirmacao. Cada
   * passo diz para onde o foco vai, como no Relatorio.tsx e na tela 8.
   */
  const caixaConfirmacao = useRef<HTMLDivElement>(null)
  const botoesEncerrar = useRef(new Map<string, HTMLButtonElement>())
  const encerrarDeQuem = useRef<string | null>(null)
  const regiaoResultado = useRef<HTMLDivElement>(null)
  const focoPendente = useRef<'termo' | 'escola' | 'confirmacao' | 'encerrar' | 'resultado' | null>(null)

  useEffect(() => {
    const alvo = focoPendente.current
    if (!alvo) return
    focoPendente.current = null
    const no = alvo === 'termo' ? caixaDoTermo.current
      : alvo === 'escola' ? selectDaEscola.current
        : alvo === 'confirmacao' ? caixaConfirmacao.current
          : alvo === 'encerrar' ? botoesEncerrar.current.get(encerrarDeQuem.current ?? '')
            : regiaoResultado.current
    no?.focus()
  })

  useEffect(() => {
    let ativo = true
    // Recarga do mesmo filho, depois de autorizar ou gerar convite: a tela
    // continua como esta enquanto busca (item 7).
    if (carregadoPara.current !== pacienteId) setEstado({ tipo: 'carregando' })
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
        carregadoPara.current = alvo
        setPacienteId(alvo)
        setEstado({ tipo: 'pronto', filhos, escolas, consentimentos })
      })
      .catch((erro) => { if (ativo) setEstado({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [pacienteId, tentativa])

  const recarregar = () => setTentativa((t) => t + 1)

  /** A escola cadastrada (ou a parecida escolhida) entra na lista ja selecionada. */
  const escolherEscola = (escola: Escola) => {
    setEstado((atual) => atual.tipo === 'pronto' && !atual.escolas.some((e) => e.id === escola.id)
      ? { ...atual, escolas: [...atual.escolas, escola].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) }
      : atual)
    setEscolaId(escola.id)
    setCadastrandoEscola(false)
    setErros(({ escolaId: _, ...resto }) => resto)
    focoPendente.current = 'escola'
  }

  const alternarEscopo = (valor: EscopoAcesso) =>
    setEscopos((atual) => atual.includes(valor) ? atual.filter((e) => e !== valor) : [...atual, valor])

  /**
   * Primeira etapa: so confere o que a propria regra de dominio confere, para
   * ninguem ler o termo inteiro e so depois descobrir que faltou a escola.
   */
  const revisarTermo = (evento: FormEvent) => {
    evento.preventDefault()
    if (!pacienteId) return
    const encontrados = validarNovoConsentimento(
      { pacienteId, escolaId, escopos, validadeAte },
      new Date(),
    )
    setErros(encontrados)
    if (Object.keys(encontrados).length === 0) {
      setEtapa('termo')
      focoPendente.current = 'termo'
    }
  }

  const conceder = async () => {
    if (!pacienteId) return
    setErros({})
    setSalvando(true)
    try {
      const concedido = await servicos.consentimentos.conceder({
        pacienteId, escolaId, escopos, validadeAte,
      })
      setEtapa('formulario')
      setConvite(concedido)
      setAviso({ tom: 'ok', texto: `Acesso autorizado para ${concedido.consentimento.escola}. Entregue o convite ao professor.` })
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
      setAviso({ tom: 'ok', texto: 'Convite novo gerado. O anterior deixou de valer neste momento.' })
      recarregar()
    } catch (e) {
      setAviso({ tom: 'cr', texto: (e as Error).message })
    }
  }

  const abrirEncerramento = (consentimentoId: string) => {
    setAviso(null)
    setConfirmando(consentimentoId)
    focoPendente.current = 'confirmacao'
  }

  const cancelarEncerramento = (consentimentoId: string) => {
    setConfirmando(null)
    encerrarDeQuem.current = consentimentoId
    focoPendente.current = 'encerrar'
  }

  const revogar = async (consentimentoId: string) => {
    try {
      const revogado = await servicos.consentimentos.revogar(consentimentoId)
      /*
       * Sem recarregar a tela: a recarga desmontaria a regiao que anuncia o
       * resultado, e o foco cairia no <body> de novo. So a autorizacao
       * encerrada muda — e o convite dela, se estava na tela, deixa de valer.
       */
      setEstado((atual) => atual.tipo === 'pronto'
        ? { ...atual, consentimentos: atual.consentimentos.map((c) => c.id === revogado.id ? revogado : c) }
        : atual)
      setConvite((atual) => atual?.consentimento.id === revogado.id ? null : atual)
      setAviso({ tom: 'ok', texto: `O acesso de ${revogado.escola} foi encerrado agora.` })
    } catch (e) {
      setAviso({ tom: 'cr', texto: (e as Error).message || 'Não foi possível encerrar agora. Tente de novo.' })
    } finally {
      setConfirmando(null)
      focoPendente.current = 'resultado'
    }
  }

  const campo = 'min-h-11 w-full rounded-lg border-2 border-linha bg-sup px-3 py-2.5 text-tinta'

  const nomeDoFilho = (id: string | null) => estado.tipo === 'pronto'
    ? estado.filhos.find((f) => f.id === id)?.nome ?? '—'
    : '—'

  /**
   * Os campos do resumo de um consentimento ja gravado: so identificadores.
   * Nome nenhum entra — quem reconstroi pode ser outro responsavel do mesmo
   * paciente, e escola renomeada continua sendo a mesma escola.
   */
  const dadosDoResumo = (c: ConsentimentoDetalhe, versao: string): DadosDoResumo => ({
    versaoTermo: versao,
    responsavelId: c.responsavelId,
    pacienteId: c.pacienteId,
    escolaId: c.escolaId,
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
      // Os nomes sao de hoje, e so servem para escrever o texto: o resumo
      // cobre as identidades, nao as palavras que as nomeiam. O responsavel e
      // quem concedeu, que pode nao ser quem esta lendo.
      texto: textoDoTermo(versao, {
        responsavel: c.responsavel,
        escola: c.escola,
        aluno: nomeDoFilho(c.pacienteId),
        escopos: c.escopos,
        validadeAte: c.validadeAte,
      }),
      confere: null,
    })
    const confere = await conferirResumoDoTermo(c.hashTermo, dados)
    setTermoAberto((atual) => atual?.consentimentoId === c.id ? { ...atual, confere } : atual)
  }

  const filho = estado.tipo === 'pronto' ? estado.filhos.find((f) => f.id === pacienteId) : undefined
  // Linguagem da familia: o filho e chamado pelo primeiro nome.
  const primeiroNome = filho?.nome.split(' ')[0] ?? 'seu filho'
  // Enquanto carrega, nada se afirma sobre quem autoriza.
  const semAutoridadeLegal = filho !== undefined && !filho.responsavelLegal

  return (
    <Tela
      area="fam"
      nome="Acesso da escola"
      papel={semAutoridadeLegal ? 'Quem autoriza é o responsável legal' : 'Quem autoriza é você'}
      caminho={[{ rotulo: 'Início', para: '/app/familia' }, 'Autorizar o acesso da escola']}
      estreito
    >
      <Titulo sub={semAutoridadeLegal
        ? 'Somente o responsável legal pode autorizar uma escola. Você pode encerrar um acesso já autorizado.'
        : 'Você escolhe a escola, o que ela vê e por quanto tempo. Pode encerrar a qualquer momento, e o encerramento vale na hora.'}>
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

          {etapa === 'formulario' && !semAutoridadeLegal && (
          <Cartao>
            <h2 className="text-lg font-bold">Autorizar uma escola</h2>
            <form className="mt-3 flex flex-col gap-4" onSubmit={revisarTermo} noValidate>
              {cadastrandoEscola || estado.escolas.length === 0 ? (
                <>
                  {estado.escolas.length === 0 && (
                    <p className="text-sm text-tinta2">
                      Nenhuma escola foi cadastrada ainda. Cadastre a escola de {primeiroNome}.
                    </p>
                  )}
                  <CadastroDeEscola
                    campo={campo}
                    focar={cadastrandoEscola}
                    aoEscolher={escolherEscola}
                    aoCancelar={estado.escolas.length > 0 ? () => { setCadastrandoEscola(false); focoPendente.current = 'escola' } : undefined}
                  />
                  {erros.escolaId && <p className="text-sm font-bold text-cr">{erros.escolaId}</p>}
                </>
              ) : (
                <Campo id="escola" rotulo="Escola" dica="O acesso vale para esta escola. Outra escola precisa de uma autorização própria.">
                  <select id="escola" ref={selectDaEscola} className={campo} value={escolaId}
                    aria-describedby="escola-dica" onChange={(e) => setEscolaId(e.target.value)}>
                    <option value="">Escolha a escola</option>
                    {estado.escolas.map((e) => (
                      <option key={e.id} value={e.id}>{e.nome} · {e.rede} · {e.municipio}</option>
                    ))}
                  </select>
                  {erros.escolaId && <p className="text-sm font-bold text-cr">{erros.escolaId}</p>}
                  <button type="button" className="self-start font-bold text-fam-ink underline underline-offset-2"
                    onClick={() => setCadastrandoEscola(true)}>
                    A escola não está na lista
                  </button>
                </Campo>
              )}

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
          {etapa === 'termo' && !semAutoridadeLegal && (
            <Cartao>
              <h2 className="text-lg font-bold">Leia antes de autorizar</h2>
              <p className="mt-1 text-sm text-tinta2">
                Este é o termo com os seus dados. Ele fica registrado nesta versão, e você pode
                reabri-lo depois nesta mesma tela.
              </p>

              <div
                ref={caixaDoTermo}
                tabIndex={-1}
                className="mt-3 max-h-96 overflow-y-auto whitespace-pre-line rounded-lg border border-linha bg-sup p-4 text-[15px] leading-relaxed"
              >
                {textoDoTermo(VERSAO_CORRENTE_DO_TERMO, {
                  responsavel: usuario?.nome ?? '',
                  escola: estado.escolas.find((e) => e.id === escolaId)?.nome ?? '',
                  aluno: nomeDoFilho(pacienteId),
                  escopos,
                  validadeAte,
                })}
              </div>

              {erros.geral && <p role="alert" className="mt-3 font-bold text-cr">{erros.geral}</p>}

              <div className="mt-4 flex flex-col gap-2">
                <Botao area="fam" className="w-full" disabled={salvando}
                  onClick={() => void conceder()}>
                  {salvando ? 'Autorizando…' : 'Autorizar'}
                </Botao>
                <Botao area="fam" variante="secundaria" className="w-full" disabled={salvando}
                  onClick={() => { setEtapa('formulario'); focoPendente.current = 'escola' }}>
                  Voltar e corrigir
                </Botao>
              </div>
            </Cartao>
          )}

          <div ref={regiaoResultado} tabIndex={-1} aria-live="polite">
            {aviso && (
              <Aviso tom={aviso.tom} titulo={aviso.tom === 'ok' ? 'Pronto' : 'Não foi possível concluir'}>
                {aviso.texto}
              </Aviso>
            )}
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
                escola — ja esta visivel logo acima (docs/02, secao 4). Para
                quem nao pode autorizar, nao ha acao a oferecer. */}
            {estado.consentimentos.length === 0 && (
              <Cartao>
                <p className="text-tinta2">
                  Nenhuma escola tem acesso aos dados de {primeiroNome}.
                  {!semAutoridadeLegal && ' Quando você quiser autorizar uma, use o formulário acima.'}
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
                      // Sem "por você": qualquer responsavel vinculado encerra, e o
                      // consentimento nao guarda quem foi. A trilha guarda.
                      ? <Etiqueta simbolo="○">Acesso encerrado</Etiqueta>
                      : <Etiqueta simbolo="○">Prazo terminado</Etiqueta>}
                </div>

                <p className="mt-1 text-sm text-tinta2">
                  {c.professor ?? 'Ainda sem professor cadastrado'}
                  {c.turma ? ` · ${c.turma}` : ''} · autorizado em {emData(c.concedidoEm)} · vale até {emDataCivil(c.validadeAte)}
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {c.escopos.map((e) => (
                    <li key={e}>
                      <Etiqueta simbolo="✓">{ESCOPOS.find((x) => x.valor === e)?.rotulo ?? e}</Etiqueta>
                    </li>
                  ))}
                </ul>

                {c.situacao === 'VIGENTE' && !c.conviteAceito && !semAutoridadeLegal && (
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
                    <div
                      ref={caixaConfirmacao}
                      tabIndex={-1}
                      role="group"
                      aria-labelledby={`encerrar-${c.id}`}
                      className="mt-3 rounded-lg border border-cr bg-cr-sup p-3.5"
                    >
                      <p id={`encerrar-${c.id}`} className="font-bold">Encerrar o acesso de {c.escola}?</p>
                      <p className="mt-1 text-sm text-tinta2">
                        A partir de agora a escola deixa de ver o cartão de estratégias e não
                        consegue mais registrar ocorrências. Você pode autorizar de novo quando quiser.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Botao area="fam" onClick={() => void revogar(c.id)}>Sim, encerrar agora</Botao>
                        <Botao area="fam" variante="secundaria" onClick={() => cancelarEncerramento(c.id)}>Cancelar</Botao>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3">
                      <Botao
                        area="fam"
                        variante="secundaria"
                        ref={(no) => {
                          if (no) botoesEncerrar.current.set(c.id, no)
                          else botoesEncerrar.current.delete(c.id)
                        }}
                        onClick={() => abrirEncerramento(c.id)}
                      >
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
                    {termoAberto?.consentimentoId === c.id
                      ? 'Fechar o termo'
                      : c.responsavelId === usuario?.id ? 'Ver o termo que aceitei' : 'Ver o termo aceito'}
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
                        // Diz o que esta provado: nenhum campo da autorizacao
                        // mudou. O nome da escola, esse pode ter mudado — e e o
                        // de hoje que aparece no texto, como deve ser.
                        <b className="text-ok">
                          Conferido: nada mudou nesta autorização desde {emData(c.concedidoEm)} às{' '}
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
