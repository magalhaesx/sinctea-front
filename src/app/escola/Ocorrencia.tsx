import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Tela } from '../LayoutApp'
import { Aviso } from '../../ui/Aviso'
import { Botao } from '../../ui/Botao'
import { Titulo } from '../../ui/Titulo'
import { EstadoCarregando } from '../../ui/EstadoCarregando'
import { EstadoErro } from '../../ui/EstadoErro'
import { dataIsoParaLocal } from '../../dominio/datas'
import { JANELA_CORRECAO_OCORRENCIA_MINUTOS, podeCorrigirOcorrencia } from '../../dominio/regras'
import {
  ErroServico, servicos, type AlunoEscola, type Intensidade, type OcorrenciaEscolar,
} from '../../servicos'

/**
 * Tela 19 · Registrar ocorrencia · /app/escola/:pacienteId/ocorrencia (UC16)
 *
 * O professor RELATA o que observou; a leitura clinica e do profissional
 * habilitado. Nada aqui pede interpretacao, e nada aqui culpabiliza.
 *
 * A janela de 30 minutos e promessa do texto de confirmacao, entao ela existe
 * de verdade: o botao de corrigir mostra quanto tempo falta, some quando o
 * prazo acaba, e a versao anterior fica no registro de acessos — o que a tela
 * diz, em vez de insinuar um apagamento que nao acontece.
 */

const TIPOS = ['Saiu da sala', 'Tapou os ouvidos', 'Recusou a tarefa', 'Chorou', 'Agrediu-se', 'Outro']
const INTENSIDADES = ['1', '2', '3', '4', '5']
const MOMENTOS = ['Entrada', 'Atividade em grupo', 'Recreio', 'Troca de atividade', 'Saída']

const hora = (iso: string) =>
  dataIsoParaLocal(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** Minutos inteiros que faltam, nunca negativos. */
function minutosRestantes(registradaEm: string, agora: Date): number {
  const fim = Date.parse(registradaEm) + JANELA_CORRECAO_OCORRENCIA_MINUTOS * 60_000
  return Math.max(0, Math.ceil((fim - agora.getTime()) / 60_000))
}

const fimDaJanela = (registradaEm: string) =>
  new Date(Date.parse(registradaEm) + JANELA_CORRECAO_OCORRENCIA_MINUTOS * 60_000).toISOString()

function Grupo({ id, titulo, ajuda, opcoes, valor, aoEscolher, refPrimeiro }: {
  id: string; titulo: string; ajuda?: string; opcoes: string[]
  valor: string | null; aoEscolher: (v: string) => void
  refPrimeiro?: React.Ref<HTMLButtonElement>
}) {
  return (
    <fieldset className="rounded-xl border border-linha p-4">
      <legend className="px-1.5 font-bold">{titulo}</legend>
      {ajuda && <p className="mb-2.5 mt-2 text-sm text-tinta2">{ajuda}</p>}
      <div className="mt-2.5 flex flex-wrap gap-2.5" id={id}>
        {opcoes.map((o, i) => (
          <button
            key={o}
            type="button"
            ref={i === 0 ? refPrimeiro : undefined}
            onClick={() => aoEscolher(o)}
            aria-pressed={valor === o}
            className={`min-h-11 cursor-pointer rounded-full border-2 px-4 py-2.5 ${
              valor === o ? 'border-esc bg-esc-sup font-bold text-esc-ink' : 'border-linha bg-sup text-tinta'
            }`}
          >
            {valor === o && <span aria-hidden="true">✓ </span>}
            {o}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'pronto'; aluno: AlunoEscola }

export function Ocorrencia() {
  const { pacienteId = '' } = useParams()
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)

  const [tipo, setTipo] = useState<string | null>(null)
  const [intensidade, setIntensidade] = useState<string | null>(null)
  const [momento, setMomento] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  /** A ocorrencia recem-registrada, enquanto a janela de correcao estiver de pe. */
  const [registrada, setRegistrada] = useState<OcorrenciaEscolar | null>(null)
  const [corrigindo, setCorrigindo] = useState(false)
  const [agora, setAgora] = useState(() => new Date())

  const primeiro = useRef<HTMLButtonElement>(null)
  const regiaoViva = useRef<HTMLDivElement>(null)
  const focarAviso = useRef(false)

  useEffect(() => {
    if (!focarAviso.current) return
    focarAviso.current = false
    regiaoViva.current?.focus()
  })

  useEffect(() => {
    let ativo = true
    setEstado({ tipo: 'carregando' })
    servicos.areaEscola.listarAlunos()
      .then((p) => {
        if (!ativo) return
        const aluno = p.itens.find((a) => a.pacienteId === pacienteId)
        if (!aluno) {
          setEstado({ tipo: 'erro', erro: new ErroServico('NAO_ENCONTRADO', 'Aluno não encontrado.') })
          return
        }
        setEstado({ tipo: 'pronto', aluno })
      })
      .catch((e) => { if (ativo) setEstado({ tipo: 'erro', erro: e }) })
    return () => { ativo = false }
  }, [pacienteId, tentativa])

  /**
   * O minuto desce sozinho enquanto houver ocorrencia na janela. O intervalo e
   * limpo ao desmontar e ao fim do prazo: sair da tela nao deixa temporizador
   * rodando por tras.
   */
  useEffect(() => {
    if (!registrada) return
    const id = setInterval(() => setAgora(new Date()), 15_000)
    return () => clearInterval(id)
  }, [registrada])

  const limparFormulario = () => {
    setTipo(null)
    setIntensidade(null)
    setMomento(null)
  }

  const faltando = () => {
    const falta: string[] = []
    if (!tipo) falta.push('o que aconteceu')
    if (!intensidade) falta.push('a intensidade')
    if (!momento) falta.push('o momento')
    return falta
  }

  const enviar = async () => {
    const falta = faltando()
    if (falta.length) {
      const lista = falta.length > 1
        ? `${falta.slice(0, -1).join(', ')} e ${falta[falta.length - 1]}`
        : falta[0]
      setErro(`Falta escolher ${lista}. Toque em uma opção de cada bloco acima.`)
      primeiro.current?.focus()
      return
    }
    setErro(null)
    setSalvando(true)
    const dados = {
      tipo: tipo!,
      intensidade: Number(intensidade) as Intensidade,
      contexto: momento!,
    }
    try {
      const ocorrencia = corrigindo && registrada
        ? await servicos.areaEscola.corrigirOcorrencia(registrada.id, dados)
        : await servicos.areaEscola.registrarOcorrencia(pacienteId, dados)
      setRegistrada(ocorrencia)
      setCorrigindo(false)
      setAgora(new Date())
      limparFormulario()
      focarAviso.current = true
    } catch (e) {
      setErro(e instanceof ErroServico ? e.message : 'Não foi possível registrar agora. Tente de novo.')
    } finally {
      setSalvando(false)
    }
  }

  const abrirCorrecao = () => {
    if (!registrada) return
    // O mesmo formulario, com os valores atuais.
    setTipo(registrada.tipo)
    setIntensidade(String(registrada.intensidade))
    setMomento(registrada.contexto)
    setCorrigindo(true)
    setErro(null)
    primeiro.current?.focus()
  }

  const naPrazo = registrada ? podeCorrigirOcorrencia(registrada.registradaEm, agora) : false
  const faltam = registrada ? minutosRestantes(registrada.registradaEm, agora) : 0
  const mostrarFormulario = !registrada || corrigindo

  return (
    <Tela
      area="esc"
      nome="Registrar ocorrência"
      papel={estado.tipo === 'pronto'
        ? `${estado.aluno.nome} · ${estado.aluno.turma}`
        : undefined}
      caminho={['Início', estado.tipo === 'pronto' ? estado.aluno.nome : 'Aluno', 'Registrar ocorrência']}
      estreito
    >
      {estado.tipo === 'carregando' && (
        <EstadoCarregando forma="cartoes" quantidade={2} rotulo="Carregando o aluno" />
      )}

      {estado.tipo === 'erro' && (
        <>
          <EstadoErro
            erro={estado.erro}
            oQue="este aluno"
            area="esc"
            aoTentarDeNovo={() => setTentativa((t) => t + 1)}
          />
          <p>
            <Link to="/app/escola" className="font-bold text-esc-ink underline">
              Voltar para os meus alunos
            </Link>
          </p>
        </>
      )}

      {estado.tipo === 'pronto' && (
        <>
          <Titulo sub="Descreva o que aconteceu, não o que significa. A interpretação clínica é da terapeuta.">
            {corrigindo ? 'Corrigir o que você registrou' : 'O que você observou?'}
          </Titulo>

          {mostrarFormulario && (
            <>
              <Grupo id="g-tipo" titulo="1. O que aconteceu" opcoes={TIPOS} valor={tipo}
                aoEscolher={(v) => { setTipo(v); setErro(null) }} refPrimeiro={primeiro} />

              <Grupo id="g-int" titulo="2. Intensidade"
                ajuda="1 = quase não atrapalhou · 5 = precisou interromper a aula"
                opcoes={INTENSIDADES} valor={intensidade}
                aoEscolher={(v) => { setIntensidade(v); setErro(null) }} />

              <Grupo id="g-mom" titulo="3. Em que momento" opcoes={MOMENTOS} valor={momento}
                aoEscolher={(v) => { setMomento(v); setErro(null) }} />

              {/* Erro descrito em texto, nomeando o que falta — WCAG 3.3.1 / e-MAG 6.6. */}
              <div aria-live="assertive">
                {erro && <p className="font-bold text-cr" role="alert">{erro}</p>}
              </div>

              <Botao area="esc" className="w-full" disabled={salvando} onClick={() => void enviar()}>
                {salvando
                  ? 'Enviando…'
                  : corrigindo ? 'Salvar a correção' : 'Registrar e avisar a terapeuta'}
              </Botao>

              {corrigindo && (
                <Botao area="esc" variante="secundaria" className="w-full" disabled={salvando}
                  onClick={() => { setCorrigindo(false); limparFormulario(); setErro(null) }}>
                  Cancelar a correção
                </Botao>
              )}
            </>
          )}

          <div ref={regiaoViva} tabIndex={-1} aria-live="polite">
            {registrada && !corrigindo && (
              <Aviso tom="ok" titulo={registrada.corrigidaEm ? 'Correção salva' : 'Ocorrência registrada'}>
                <p>
                  A terapeuta responsável foi avisada. Você não precisa fazer mais nada.
                </p>
                <p className="mt-2">
                  {naPrazo
                    ? `Você pode corrigir este registro até às ${hora(fimDaJanela(registrada.registradaEm))} (${faltam === 1 ? 'falta 1 minuto' : `faltam ${faltam} minutos`}).`
                    : 'O prazo de 30 minutos para correção terminou. Fale com a equipe terapêutica se precisar de ajuste.'}
                </p>
                {naPrazo && (
                  <p className="mt-3">
                    <Botao area="esc" variante="secundaria" onClick={abrirCorrecao}>Corrigir</Botao>
                  </p>
                )}
                {/* Nao se promete apagamento que nao acontece. */}
                <p className="mt-2 text-sm text-tinta2">
                  A versão anterior continua no registro de acessos.
                </p>
              </Aviso>
            )}
          </div>

          {!registrada && (
            <p className="text-sm text-tinta2">
              Leva cerca de 20 segundos: três toques e enviar. Feito para caber no intervalo entre
              uma atividade e outra.
            </p>
          )}
        </>
      )}
    </Tela>
  )
}
