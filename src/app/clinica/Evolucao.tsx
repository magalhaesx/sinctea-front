import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Tela } from '../LayoutApp'
import { Aviso } from '../../ui/Aviso'
import { Botao } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { Cartao } from '../../ui/Cartao'
import { Etiqueta } from '../../ui/Etiqueta'
import { Titulo } from '../../ui/Titulo'
import { EstadoCarregando } from '../../ui/EstadoCarregando'
import { EstadoErro } from '../../ui/EstadoErro'
import { FaixasContexto } from '../../graficos/FaixasContexto'
import { LinhaEvolucao, type PontoSessao } from '../../graficos/LinhaEvolucao'
import {
  objetivoAtingiuCriterio, percentualIndependente, suficienciaComparacao, SUFICIENCIA_MINIMA,
} from '../../dominio/regras'
import {
  ErroServico, servicos, type AtividadeCasa, type Desempenho, type ExecucaoAtividadeCasa,
  type Objetivo, type OcorrenciaComportamental, type Origem, type Sessao,
} from '../../servicos'

/**
 * Tela 8 · Evolucao por objetivo · /app/clinica/pacientes/:id/evolucao (UC08)
 *
 * A comparacao entre contextos so aparece com dados suficientes, e nunca em
 * versao parcial: abaixo do minimo, a tela diz o que falta, contexto por
 * contexto. A regra vive em dominio/regras.ts, nao aqui.
 *
 * A promocao a dominado tambem e daqui, e nao e automatica: atingir o criterio
 * habilita o botao, quem promove e o profissional. O servico reconfere o
 * criterio antes de gravar.
 */

const emData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')

const NOME_DO_CONTEXTO: Record<Origem, string> = {
  CLINICA: 'na clínica', CASA: 'em casa', ESCOLA: 'na escola',
}

type Dados = {
  objetivos: Objetivo[]
  sessoes: Sessao[]
  atividades: AtividadeCasa[]
  execucoes: ExecucaoAtividadeCasa[]
  ocorrencias: OcorrenciaComportamental[]
}

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'pronto'; dados: Dados }

/** "Faltam 2 registros e 1 semana na escola." */
function frase(falta: { contexto: Origem; registrosFaltando: number; semanasFaltando: number }): string {
  const partes: string[] = []
  if (falta.registrosFaltando > 0) {
    partes.push(`${falta.registrosFaltando} ${falta.registrosFaltando === 1 ? 'registro' : 'registros'}`)
  }
  if (falta.semanasFaltando > 0) {
    partes.push(`${falta.semanasFaltando} ${falta.semanasFaltando === 1 ? 'semana' : 'semanas'}`)
  }
  const verbo = falta.registrosFaltando + falta.semanasFaltando === 1 ? 'Falta' : 'Faltam'
  return `${verbo} ${partes.join(' e ')} ${NOME_DO_CONTEXTO[falta.contexto]}.`
}

export function Evolucao() {
  const { id = '' } = useParams()
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)
  const [objetivoId, setObjetivoId] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [erroAcao, setErroAcao] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    setEstado({ tipo: 'carregando' })
    // O aviso e do objetivo que acabou de mudar: trocar de paciente o apaga.
    setAviso(null)
    setErroAcao(null)
    const carregar = async (): Promise<Dados> => {
      const [plano, sessoes, atividades, ocorrencias] = await Promise.all([
        servicos.planos.obterPorPaciente(id),
        servicos.sessoes.listarPorPaciente(id, { situacao: 'ENCERRADA', porPagina: 100 }),
        servicos.atividades.listarPorPaciente(id, { porPagina: 100 }),
        servicos.ocorrencias.listarPorPaciente(id, { origem: 'ESCOLA', porPagina: 100 }),
      ])
      const execucoes = (await Promise.all(
        atividades.itens.map((a) => servicos.atividades.listarExecucoes(a.id, { porPagina: 100 })),
      )).flatMap((p) => p.itens)
      return {
        objetivos: plano.objetivos,
        sessoes: sessoes.itens,
        atividades: atividades.itens,
        execucoes,
        ocorrencias: ocorrencias.itens,
      }
    }
    carregar()
      .then((dados) => {
        if (!ativo) return
        setObjetivoId((atual) => atual || dados.objetivos[0]?.id || '')
        setEstado({ tipo: 'pronto', dados })
      })
      .catch((erro) => { if (ativo) setEstado({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [id, tentativa])

  const trocarObjetivo = (id: string) => {
    setObjetivoId(id)
    setAviso(null)
    setErroAcao(null)
  }

  const confirmarDominio = async (objetivoId: string) => {
    setAviso(null)
    setErroAcao(null)
    setConfirmando(true)
    try {
      const atualizado = await servicos.planos.confirmarDominio(objetivoId)
      setEstado((atual) => atual.tipo === 'pronto'
        ? {
          ...atual,
          dados: {
            ...atual.dados,
            objetivos: atual.dados.objetivos.map((o) => o.id === atualizado.id ? atualizado : o),
          },
        }
        : atual)
      setAviso('Domínio confirmado. O objetivo passa a constar como dominado no plano.')
    } catch (e) {
      setErroAcao((e as Error).message || 'Não foi possível confirmar agora.')
    } finally {
      setConfirmando(false)
    }
  }

  const series = useMemo(() => {
    if (estado.tipo !== 'pronto' || !objetivoId) return null
    const { sessoes, atividades, execucoes, ocorrencias } = estado.dados

    // Clinica: percentual de tentativas independentes do objetivo, por sessao.
    const clinica = sessoes
      .slice()
      .sort((a, b) => a.numero - b.numero)
      .map((s) => ({ sessao: s, percentual: percentualIndependente(s.registros, objetivoId) }))
      .filter((p): p is { sessao: Sessao; percentual: number } => p.percentual !== null)
      .map(({ sessao, percentual }) => ({
        rotulo: `S${sessao.numero}`,
        data: sessao.inicio ?? sessao.inicioPrevistoEm,
        percentual,
      }))

    // Casa: execucoes das atividades ligadas a ESTE objetivo.
    const doObjetivo = new Set(atividades.filter((a) => a.objetivoId === objetivoId).map((a) => a.id))
    const casa = execucoes
      .filter((e) => doObjetivo.has(e.atividadeId))
      .map((e) => ({ data: e.dataRealizacao, desempenho: e.desempenho as Desempenho }))
      .sort((a, b) => a.data.localeCompare(b.data))

    // Escola: ocorrencias do ALUNO. Nao ha objetivo em OcorrenciaEscolar.
    const escola = ocorrencias
      .map((o) => ({ data: o.ocorridaEm, intensidade: o.intensidade as number }))
      .sort((a, b) => a.data.localeCompare(b.data))

    return { clinica, casa, escola }
  }, [estado, objetivoId])

  const negado = estado.tipo === 'erro' && estado.erro instanceof ErroServico
    && estado.erro.codigo === 'ACESSO_NEGADO'
  const semPlano = estado.tipo === 'erro' && estado.erro instanceof ErroServico
    && estado.erro.codigo === 'NAO_ENCONTRADO'

  return (
    <Tela area="cli" caminho={['Área clínica', 'Pacientes', 'Evolução por objetivo']}>
      {estado.tipo === 'carregando' && (
        <>
          <Titulo>Evolução por objetivo</Titulo>
          <EstadoCarregando forma="cartoes" quantidade={2} rotulo="Carregando a evolução do objetivo" />
        </>
      )}

      {estado.tipo === 'erro' && (
        <>
          <Titulo>Evolução por objetivo</Titulo>
          {semPlano ? (
            <Cartao><p className="text-tinta2">Este paciente ainda não tem plano terapêutico, então não há objetivo para acompanhar.</p></Cartao>
          ) : (
            <EstadoErro
              erro={estado.erro}
              oQue="a evolução deste paciente"
              titulo={negado ? 'Esta evolução não é do seu alcance' : undefined}
              texto={negado
                ? 'O paciente não está entre os que você acompanha. Se precisar consultar, fale com a coordenação da clínica.'
                : undefined}
              aoTentarDeNovo={negado ? undefined : () => setTentativa((t) => t + 1)}
            />
          )}
        </>
      )}

      {estado.tipo === 'pronto' && series && (() => {
        const objetivo = estado.dados.objetivos.find((o) => o.id === objetivoId)
        if (!objetivo) {
          return (
            <>
              <Titulo>Evolução por objetivo</Titulo>
              <Cartao><p className="text-tinta2">O plano deste paciente ainda não tem objetivos.</p></Cartao>
            </>
          )
        }

        const pontos: PontoSessao[] = series.clinica
        const atingiu = objetivoAtingiuCriterio(estado.dados.sessoes, objetivo.id, objetivo.criterio)
        const dominado = objetivo.status === 'DOMINADO'
        const suficiencia = suficienciaComparacao({
          CLINICA: series.clinica.map((p) => p.data),
          CASA: series.casa.map((p) => p.data),
          ESCOLA: series.escola.map((p) => p.data),
        })

        return (
          <>
            <Titulo sub={`${pontos.length} ${pontos.length === 1 ? 'sessão registrada' : 'sessões registradas'} com este objetivo`}>
              Evolução por objetivo
            </Titulo>

            <Cartao>
              <Campo id="objetivo" rotulo="Objetivo">
                <select
                  id="objetivo"
                  className="min-h-11 w-full rounded-lg border-2 border-linha bg-sup px-3 py-2.5 text-tinta"
                  value={objetivo.id}
                  onChange={(e) => trocarObjetivo(e.target.value)}
                >
                  {estado.dados.objetivos.map((o) => <option key={o.id} value={o.id}>{o.dominio}</option>)}
                </select>
              </Campo>
              <p className="mt-2 max-w-[65ch] text-sm text-tinta2">{objetivo.descricaoTecnica}</p>
            </Cartao>

            <div aria-live="polite">
              {aviso && <Aviso tom="ok" titulo="Pronto">{aviso}</Aviso>}
              {erroAcao && (
                <Aviso tom="cr" titulo="Não foi possível confirmar o domínio">{erroAcao}</Aviso>
              )}
            </div>

            <section aria-labelledby="h-clinica" className="flex flex-col gap-3">
              <h2 id="h-clinica" className="text-lg font-bold">Na clínica, sessão a sessão</h2>
              <Cartao>
                {pontos.length === 0 ? (
                  <p className="text-tinta2">
                    Nenhuma sessão encerrada registrou tentativas deste objetivo ainda.
                  </p>
                ) : (
                  <LinhaEvolucao
                    titulo="Tentativas independentes por sessão"
                    pontos={pontos}
                    criterio={objetivo.criterio.percentualMinimo}
                  />
                )}
              </Cartao>

              <Aviso tom={dominado || atingiu ? 'ok' : 'neutro'} titulo={dominado
                ? 'Objetivo dominado'
                : atingiu
                  ? 'Critério de domínio atingido'
                  : 'Ainda não atingiu o critério de domínio'}>
                <p className="text-[15px] text-tinta">
                  O critério é {objetivo.criterio.percentualMinimo}% em{' '}
                  {objetivo.criterio.sessoesConsecutivas}{' '}
                  {objetivo.criterio.sessoesConsecutivas === 1 ? 'sessão consecutiva' : 'sessões consecutivas'}.{' '}
                  {dominado && objetivo.dominadoEm
                    ? `Domínio confirmado em ${emData(objetivo.dominadoEm)}.`
                    : atingiu
                      ? 'A promoção a dominado não é automática: depende da sua confirmação.'
                      : 'O status atual do objetivo é definido por você, no plano.'}
                </p>
                <p className="mt-2">
                  <Etiqueta tom={dominado ? 'ok' : 'neutro'} simbolo={dominado ? '✓' : '○'}>
                    {dominado ? 'Dominado' : objetivo.status === 'EM_AQUISICAO' ? 'Em aquisição' : 'Não iniciado'}
                  </Etiqueta>
                </p>
                {atingiu && !dominado && (
                  <p className="mt-3">
                    <Botao area="cli" onClick={() => void confirmarDominio(objetivo.id)}
                      disabled={confirmando}>
                      {confirmando ? 'Confirmando…' : 'Confirmar o domínio'}
                    </Botao>
                  </p>
                )}
              </Aviso>
            </section>

            <section aria-labelledby="h-contextos" className="flex flex-col gap-3">
              <h2 id="h-contextos" className="text-lg font-bold">Comparação entre os três contextos</h2>

              {suficiencia.suficiente ? (
                <Cartao>
                  <FaixasContexto clinica={series.clinica} casa={series.casa} escola={series.escola} />
                </Cartao>
              ) : (
                // Nada de versao parcial nem esmaecida: abaixo do minimo, a
                // tela diz o que falta, contexto por contexto.
                <Aviso tom="at" titulo="Dados insuficientes para comparar">
                  <p className="max-w-[65ch] text-[15px] text-tinta">
                    A comparação só aparece com pelo menos {SUFICIENCIA_MINIMA.registros} registros
                    distribuídos em {SUFICIENCIA_MINIMA.semanas} semanas em cada contexto. Abaixo
                    disso, a leitura seria enganosa.
                  </p>
                  <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-[15px] text-tinta">
                    {suficiencia.faltas.map((f) => <li key={f.contexto}>{frase(f)}</li>)}
                  </ul>
                </Aviso>
              )}
            </section>
          </>
        )
      })()}
    </Tela>
  )
}
