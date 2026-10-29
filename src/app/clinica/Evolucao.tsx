import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Tela } from '../LayoutApp'
import { PACIENTES, doPaciente } from './caminho'
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
import { suficienciaComparacao, SUFICIENCIA_MINIMA } from '@sinctea/compartilhado/dominio/regras'
import { dataIsoParaLocal } from '@sinctea/compartilhado/dominio/datas'
import { blocoDoDominio } from './blocoDoDominio'
import {
  ErroServico, servicos, type EvolucaoObjetivo, type Origem, type PlanoTerapeutico,
} from '../../servicos'

/**
 * Tela 8 · Evolucao por objetivo · /app/clinica/pacientes/:id/evolucao (UC08)
 *
 * Duas leituras (item 16): o plano, para o seletor, e a evolucao do objetivo
 * escolhido, que o servico ja entrega montada (montarEvolucao, no
 * compartilhado) — so datas e medidas, sem texto livre de ninguem.
 *
 * A comparacao entre contextos so aparece com dados suficientes, e nunca em
 * versao parcial: abaixo do minimo, a tela diz o que falta, contexto por
 * contexto. A regra vive em dominio/regras.ts, nao aqui, e a semana e a do
 * calendario de Manaus.
 *
 * A promocao a dominado tambem e daqui, e nao e automatica: atingir o criterio
 * habilita o botao, quem promove e o profissional, e so no plano vigente. O
 * servico reconfere o plano e o criterio antes de gravar.
 *
 * E decisao clinica, auditada e sem desfazer pela tela — num tablet, no meio
 * da sessao, um toque errado promoveria o objetivo com o nome de quem tocou.
 * Por isso vai em duas etapas, como o encerramento de acesso da tela 17.
 */


const NOME_DO_CONTEXTO: Record<Origem, string> = {
  CLINICA: 'na clínica', CASA: 'em casa', ESCOLA: 'na escola',
}

type Estado<T> =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'pronto'; dados: T }

/** A evolucao vem com o objetivo a que responde: trocar de objetivo nao mostra a do anterior. */
type EstadoEvolucao = Estado<{ objetivoId: string; evolucao: EvolucaoObjetivo }>

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
  // ?objetivo= e como o alerta do painel da coordenacao aponta para UM
  // objetivo. Sem isto o link cairia sempre no primeiro do plano.
  const [params] = useSearchParams()
  const objetivoPedido = params.get('objetivo') ?? ''
  const [estado, setEstado] = useState<Estado<PlanoTerapeutico>>({ tipo: 'carregando' })
  const [evolucao, setEvolucao] = useState<EstadoEvolucao>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)
  const [objetivoId, setObjetivoId] = useState(objetivoPedido)
  const [confirmacaoAberta, setConfirmacaoAberta] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [erroAcao, setErroAcao] = useState<string | null>(null)

  const botaoConfirmar = useRef<HTMLButtonElement>(null)
  const caixaConfirmacao = useRef<HTMLDivElement>(null)
  const blocoDominio = useRef<HTMLDivElement>(null)

  /** Onde o foco tem de estar depois que o proximo quadro for desenhado. */
  const focoPendente = useRef<'caixa' | 'botao' | 'bloco' | null>(null)

  useEffect(() => {
    const alvo = focoPendente.current
    if (!alvo) return
    focoPendente.current = null
    const no = alvo === 'caixa' ? caixaConfirmacao.current
      : alvo === 'botao' ? botaoConfirmar.current
        : blocoDominio.current
    no?.focus()
  })

  useEffect(() => {
    let ativo = true
    setEstado({ tipo: 'carregando' })
    // O aviso e do objetivo que acabou de mudar: trocar de paciente o apaga.
    setAviso(null)
    setErroAcao(null)
    setConfirmacaoAberta(false)
    servicos.planos.obterPorPaciente(id)
      .then((plano) => {
        if (!ativo) return
        const existe = (objetivoId: string) => plano.objetivos.some((o) => o.id === objetivoId)
        setObjetivoId((atual) => existe(atual)
          ? atual
          : existe(objetivoPedido) ? objetivoPedido : plano.objetivos[0]?.id ?? '')
        setEstado({ tipo: 'pronto', dados: plano })
      })
      .catch((erro) => { if (ativo) setEstado({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [id, tentativa, objetivoPedido])

  // A evolucao do objetivo escolhido: uma leitura, inteira, e uma linha na trilha.
  useEffect(() => {
    if (!objetivoId) return
    let ativo = true
    setEvolucao({ tipo: 'carregando' })
    servicos.planos.obterEvolucao(objetivoId)
      .then((dados) => { if (ativo) setEvolucao({ tipo: 'pronto', dados: { objetivoId, evolucao: dados } }) })
      .catch((erro) => { if (ativo) setEvolucao({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [objetivoId, tentativa])

  const trocarObjetivo = (id: string) => {
    setObjetivoId(id)
    setAviso(null)
    setErroAcao(null)
    // A confirmacao aberta era sobre o objetivo que estava na tela.
    setConfirmacaoAberta(false)
  }

  const abrirConfirmacao = () => {
    setAviso(null)
    setErroAcao(null)
    setConfirmacaoAberta(true)
    focoPendente.current = 'caixa'
  }

  const cancelarConfirmacao = () => {
    setConfirmacaoAberta(false)
    focoPendente.current = 'botao'
  }

  const confirmarDominio = async (objetivoId: string) => {
    setAviso(null)
    setErroAcao(null)
    setSalvando(true)
    try {
      const atualizado = await servicos.planos.confirmarDominio(objetivoId)
      setEstado((atual) => atual.tipo === 'pronto'
        ? {
          ...atual,
          dados: { ...atual.dados, objetivos: atual.dados.objetivos.map((o) => o.id === atualizado.id ? atualizado : o) },
        }
        : atual)
      setAviso('Domínio confirmado. O objetivo passa a constar como dominado no plano.')
      // O botao sai da tela junto com a promocao: o foco vai para o bloco que
      // mudou, e nao para o corpo da pagina.
      focoPendente.current = 'bloco'
    } catch (e) {
      setErroAcao((e as Error).message || 'Não foi possível confirmar agora.')
      focoPendente.current = 'botao'
    } finally {
      setConfirmacaoAberta(false)
      setSalvando(false)
    }
  }

  // Na tela, so a evolucao do objetivo escolhido.
  const series = useMemo(() => {
    if (evolucao.tipo !== 'pronto' || evolucao.dados.objetivoId !== objetivoId) return null
    const { clinica, casa, escola, atingiuCriterio } = evolucao.dados.evolucao
    return {
      // Clinica: percentual de tentativas independentes do objetivo, por sessao.
      clinica: clinica.map((s): PontoSessao => ({ rotulo: `S${s.numero}`, data: s.data, percentual: s.percentual })),
      // Casa: a execucao guarda o dia, sem hora; na linha do tempo, o ponto vai
      // ao meio-dia daquele dia, longe das duas bordas.
      casa: casa.map((e) => ({ data: dataIsoParaLocal(e.data).toISOString(), desempenho: e.desempenho })),
      // Escola: ocorrencias do ALUNO. Nao ha objetivo em OcorrenciaEscolar.
      escola,
      // A semana conta no calendario de Manaus; o dia da casa vai como dia.
      suficiencia: suficienciaComparacao({
        CLINICA: clinica.map((s) => s.data),
        CASA: casa.map((e) => e.data),
        ESCOLA: escola.map((o) => o.data),
      }),
      atingiuCriterio,
    }
  }, [evolucao, objetivoId])

  const negado = estado.tipo === 'erro' && estado.erro instanceof ErroServico
    && estado.erro.codigo === 'ACESSO_NEGADO'
  const semPlano = estado.tipo === 'erro' && estado.erro instanceof ErroServico
    && estado.erro.codigo === 'NAO_ENCONTRADO'

  return (
    <Tela area="cli" caminho={['Área clínica', PACIENTES, doPaciente(id, null), 'Evolução por objetivo']}>
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

      {estado.tipo === 'pronto' && (() => {
        const plano = estado.dados
        const objetivo = plano.objetivos.find((o) => o.id === objetivoId)
        if (!objetivo) {
          return (
            <>
              <Titulo>Evolução por objetivo</Titulo>
              <Cartao><p className="text-tinta2">O plano deste paciente ainda não tem objetivos.</p></Cartao>
            </>
          )
        }

        const dominado = objetivo.status === 'DOMINADO'
        // Fora do plano vigente, a tela mostra o criterio, sem o botao (item 16).
        const bloco = series && blocoDoDominio({
          dominadoEm: objetivo.dominadoEm, vigente: plano.status === 'VIGENTE', atingiu: series.atingiuCriterio,
        })

        return (
          <>
            <Titulo sub={series
              ? `${series.clinica.length} ${series.clinica.length === 1 ? 'sessão registrada' : 'sessões registradas'} com este objetivo`
              : undefined}>
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
                  {plano.objetivos.map((o) => <option key={o.id} value={o.id}>{o.dominio}</option>)}
                </select>
              </Campo>
              <p className="texto-corrido mt-2 text-sm text-tinta2">{objetivo.descricaoTecnica}</p>
            </Cartao>

            <div aria-live="polite">
              {aviso && <Aviso tom="ok" titulo="Pronto">{aviso}</Aviso>}
              {erroAcao && (
                <Aviso tom="cr" titulo="Não foi possível confirmar o domínio">{erroAcao}</Aviso>
              )}
            </div>

            {evolucao.tipo === 'erro' && (
              <EstadoErro
                erro={evolucao.erro}
                oQue="a evolução deste objetivo"
                nivel={3}
                aoTentarDeNovo={() => setTentativa((t) => t + 1)}
              />
            )}

            {evolucao.tipo !== 'erro' && !series && (
              <EstadoCarregando forma="cartoes" quantidade={2} rotulo="Carregando a evolução do objetivo" />
            )}

            {series && bloco && (
              <>
                <section aria-labelledby="h-clinica" className="flex flex-col gap-3">
                  <h2 id="h-clinica" className="text-lg font-bold">Na clínica, sessão a sessão</h2>
                  <Cartao>
                    {series.clinica.length === 0 ? (
                      <p className="text-tinta2">
                        Nenhuma sessão encerrada registrou tentativas deste objetivo ainda.
                      </p>
                    ) : (
                      <LinhaEvolucao
                        titulo="Tentativas independentes por sessão"
                        pontos={series.clinica}
                        criterio={objetivo.criterio.percentualMinimo}
                      />
                    )}
                  </Cartao>

                  <div ref={blocoDominio} tabIndex={-1}>
                    <Aviso tom={dominado || series.atingiuCriterio ? 'ok' : 'neutro'} titulo={bloco.titulo}>
                      <p className="text-[15px] text-tinta">
                        O critério é {objetivo.criterio.percentualMinimo}% em{' '}
                        {objetivo.criterio.sessoesConsecutivas}{' '}
                        {objetivo.criterio.sessoesConsecutivas === 1 ? 'sessão consecutiva' : 'sessões consecutivas'}.{' '}
                        {bloco.frase}
                      </p>
                      <p className="mt-2">
                        <Etiqueta tom={dominado ? 'ok' : 'neutro'} simbolo={dominado ? '✓' : '○'}>
                          {dominado ? 'Dominado' : objetivo.status === 'EM_AQUISICAO' ? 'Em aquisição' : 'Não iniciado'}
                        </Etiqueta>
                      </p>
                      {bloco.botao && (
                        // Duas etapas: o primeiro clique mostra o que vai acontecer.
                        confirmacaoAberta ? (
                          <div
                            ref={caixaConfirmacao}
                            tabIndex={-1}
                            role="group"
                            aria-labelledby="confirmar-dominio"
                            className="mt-3 rounded-lg border border-at bg-at-sup p-3.5"
                          >
                            <p id="confirmar-dominio" className="font-bold text-tinta">
                              Confirmar o domínio deste objetivo?
                            </p>
                            <p className="mt-1 text-sm text-tinta2">
                              O objetivo passa a dominado e isso fica registrado com o seu nome. Não há
                              como desfazer pela tela.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Botao area="cli" onClick={() => void confirmarDominio(objetivo.id)}
                                disabled={salvando}>
                                {salvando ? 'Confirmando…' : 'Confirmar o domínio'}
                              </Botao>
                              <Botao area="cli" variante="secundaria" onClick={cancelarConfirmacao}
                                disabled={salvando}>
                                Cancelar
                              </Botao>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-3">
                            <Botao area="cli" ref={botaoConfirmar} onClick={abrirConfirmacao}>
                              Confirmar o domínio
                            </Botao>
                          </p>
                        )
                      )}
                    </Aviso>
                  </div>
                </section>

                <section aria-labelledby="h-contextos" className="flex flex-col gap-3">
                  <h2 id="h-contextos" className="text-lg font-bold">Comparação entre os três contextos</h2>

                  {series.suficiencia.suficiente ? (
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
                        {series.suficiencia.faltas.map((f) => <li key={f.contexto}>{frase(f)}</li>)}
                      </ul>
                    </Aviso>
                  )}
                </section>
              </>
            )}
          </>
        )
      })()}
    </Tela>
  )
}
