import { useEffect, useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Tela } from '../LayoutApp'
import { Botao, BotaoLink } from '../../ui/Botao'
import { Cartao } from '../../ui/Cartao'
import { Etiqueta } from '../../ui/Etiqueta'
import { Titulo } from '../../ui/Titulo'
import { EstadoCarregando } from '../../ui/EstadoCarregando'
import { EstadoErro } from '../../ui/EstadoErro'
import { EstadoVazio } from '../../ui/EstadoVazio'
import { BarrasProfissional } from '../../graficos/BarrasProfissional'
import {
  servicos, type AlertaAtencao, type Indicador, type MotivoAtencao, type Pagina,
  type PonteEscola, type ResumoClinica, type SessoesPorProfissional,
} from '../../servicos'

/**
 * Tela 11 · Painel de indicadores da clinica · /app/coordenacao (UC18)
 *
 * Nada e calculado aqui: os quatro blocos leem servicos.indicadores, que conta
 * e aponta. Cada bloco carrega por conta propria e tem os seus quatro estados —
 * se a ponte com a escola falhar, os alertas continuam na tela.
 *
 * O bloco 2 e o coracao: um painel de numeros bonitos nao faz ninguem voltar.
 * O que faz e a lista do que exige acao, e cada item leva ao registro.
 */

const PRIMEIROS = 5

const GRUPOS: Array<{ motivo: MotivoAtencao; titulo: string }> = [
  { motivo: 'PLANO_SEM_REVISAO', titulo: 'Planos sem revisão há mais de 90 dias' },
  { motivo: 'PACIENTE_SEM_SESSAO', titulo: 'Pacientes sem sessão há mais de 15 dias' },
  { motivo: 'CONSENTIMENTO_VENCENDO', titulo: 'Consentimentos escolares vencendo em 30 dias' },
  { motivo: 'OBJETIVO_SEM_AVANCO', titulo: 'Objetivos sem novo melhor resultado há 8 sessões' },
]

type Estado<T> =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'pronto'; dados: T }

const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`

/**
 * O item aponta, nao descreve: nome, numero e o que aconteceu. Nenhum dominio
 * de objetivo, nenhum tipo de ocorrencia — o detalhe esta no destino.
 */
function textoDoAlerta(a: AlertaAtencao): string {
  const q = a.quantidade ?? 0
  switch (a.motivo) {
    case 'PLANO_SEM_REVISAO':
      return `${plural(q, 'dia', 'dias')} sem revisão`
    case 'PACIENTE_SEM_SESSAO':
      return a.quantidade === null
        ? 'nenhuma sessão registrada'
        : `${plural(q, 'dia', 'dias')} sem sessão`
    case 'CONSENTIMENTO_VENCENDO':
      // A frase nao e enfeite: sem ela, um alerta de consentimento na area
      // clinica sugere que a clinica renova. Quem autoriza o acesso da escola
      // e so o responsavel (regra 1); a acao daqui e avisar a familia.
      return `${q === 0 ? 'vence hoje' : `vence em ${plural(q, 'dia', 'dias')}`} · a renovação é da família`
    case 'OBJETIVO_SEM_AVANCO':
      return `${plural(q, 'sessão', 'sessões')} sem novo melhor resultado`
  }
}

function destinoDoAlerta(a: AlertaAtencao): string {
  const paciente = `/app/clinica/pacientes/${a.paciente.id}`
  switch (a.motivo) {
    case 'PLANO_SEM_REVISAO': return `${paciente}/plano`
    case 'OBJETIVO_SEM_AVANCO': return `${paciente}/evolucao?objetivo=${a.referenciaId}`
    default: return paciente
  }
}

/** Rotulo em frase comum, valor grande, periodo embaixo. */
function CartaoNumero({ rotulo, valor, periodo, apagado = false }: {
  rotulo: string
  valor: ReactNode
  periodo: string
  apagado?: boolean
}) {
  return (
    <Cartao className="h-full">
      <p className="text-[15px] leading-snug">{rotulo}</p>
      {/* Algarismos proporcionais: tabular e para coluna de tabela, onde os
          numeros se alinham. Num numero grande e sozinho, ele afrouxa o
          desenho — "121" fica com buracos. */}
      <p className={`mt-1.5 text-4xl font-bold leading-none ${apagado ? 'text-tinta2' : 'text-tinta'}`}>
        {valor}
      </p>
      <p className="mt-2 text-sm leading-snug text-tinta2">{periodo}</p>
    </Cartao>
  )
}

const numeroDoResumo = (r: ResumoClinica): Array<[string, Indicador]> => [
  ['Pacientes em acompanhamento', r.pacientesEmAcompanhamento],
  ['Sessões realizadas', r.sessoesUltimos7Dias],
  ['Objetivos dominados', r.objetivosDominadosUltimos30Dias],
  ['Planos com revisão prevista', r.planosComRevisaoProximos30Dias],
]

// ---------------------------------------------------------------- Bloco 2

function GrupoAtencao({ motivo, titulo }: { motivo: MotivoAtencao; titulo: string }) {
  const [estado, setEstado] = useState<Estado<Pagina<AlertaAtencao>>>({ tipo: 'carregando' })
  const [todos, setTodos] = useState(false)
  const [tentativa, setTentativa] = useState(0)
  const idTitulo = useId()

  useEffect(() => {
    let ativo = true
    setEstado({ tipo: 'carregando' })
    servicos.indicadores.listarAlertas(motivo, { porPagina: todos ? 100 : PRIMEIROS })
      .then((dados) => { if (ativo) setEstado({ tipo: 'pronto', dados }) })
      .catch((erro) => { if (ativo) setEstado({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [motivo, todos, tentativa])

  return (
    <section aria-labelledby={idTitulo} className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={idTitulo} className="text-base font-bold">{titulo}</h3>
        {estado.tipo === 'pronto' && estado.dados.total > 0 && (
          <Etiqueta tom="at" simbolo="▲">{plural(estado.dados.total, 'item', 'itens')}</Etiqueta>
        )}
      </div>

      {estado.tipo === 'carregando' && (
        <EstadoCarregando forma="lista" linhas={2} rotulo={`Carregando: ${titulo}`} />
      )}

      {estado.tipo === 'erro' && (
        <EstadoErro
          erro={estado.erro}
          oQue="este grupo de alertas"
          nivel={3}
          aoTentarDeNovo={() => setTentativa((t) => t + 1)}
        />
      )}

      {estado.tipo === 'pronto' && (
        estado.dados.total === 0 ? (
          // A verificacao rodou e passou: dizer isso vale mais do que sumir
          // com o grupo, que deixaria a duvida se ele chegou a ser feito.
          <p className="text-[15px] text-tinta2">Nenhum no momento.</p>
        ) : (
          <>
            <ul className="flex flex-col gap-1.5">
              {estado.dados.itens.map((a) => (
                <li key={a.referenciaId}>
                  <Link
                    to={destinoDoAlerta(a)}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-linha bg-sup px-3 py-2.5 text-[15px] hover:bg-sup2"
                  >
                    <span>
                      <b className="text-cli-ink underline">{a.paciente.nome}</b> — {textoDoAlerta(a)}
                    </span>
                    <span aria-hidden="true" className="text-tinta2">›</span>
                  </Link>
                </li>
              ))}
            </ul>

            {!todos && estado.dados.total > estado.dados.itens.length && (
              <p>
                <Botao variante="secundaria" area="cli" onClick={() => setTodos(true)}>
                  Ver todos os {estado.dados.total}
                </Botao>
              </p>
            )}
          </>
        )
      )}
    </section>
  )
}

// ---------------------------------------------------------------- Bloco 3

function BlocoSessoes() {
  const [estado, setEstado] = useState<Estado<SessoesPorProfissional>>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true
    setEstado({ tipo: 'carregando' })
    servicos.indicadores.sessoesPorProfissional()
      .then((dados) => { if (ativo) setEstado({ tipo: 'pronto', dados }) })
      .catch((erro) => { if (ativo) setEstado({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [tentativa])

  return (
    <section aria-labelledby="h-sessoes" className="flex flex-col gap-3">
      <h2 id="h-sessoes" className="text-lg font-bold">Sessões por profissional</h2>

      {estado.tipo === 'carregando' && (
        <EstadoCarregando forma="lista" linhas={3} rotulo="Carregando as sessões por profissional" />
      )}

      {estado.tipo === 'erro' && (
        <EstadoErro
          erro={estado.erro}
          oQue="as sessões por profissional"
          nivel={3}
          aoTentarDeNovo={() => setTentativa((t) => t + 1)}
        />
      )}

      {estado.tipo === 'pronto' && (
        estado.dados.itens.length === 0 ? (
          <Cartao>
            <p className="text-tinta2">
              Nenhum profissional com sessão registrada no período.
            </p>
          </Cartao>
        ) : (
          <Cartao>
            <BarrasProfissional
              titulo={`Sessões conduzidas ${estado.dados.periodo}`}
              itens={estado.dados.itens.map((i) => ({
                id: i.profissional.id, nome: i.profissional.nome, sessoes: i.sessoes,
              }))}
            />
          </Cartao>
        )
      )}
    </section>
  )
}

// ---------------------------------------------------------------- Bloco 4

/** Abaixo de 48 horas a espera se conta em horas; acima disso, em dias. */
function tempoDeLeitura(horas: number): string {
  return horas < 48 ? `${horas} h` : `${Math.round(horas / 24)} dias`
}

function BlocoPonte() {
  const [estado, setEstado] = useState<Estado<PonteEscola>>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true
    setEstado({ tipo: 'carregando' })
    servicos.indicadores.ponteEscola()
      .then((dados) => { if (ativo) setEstado({ tipo: 'pronto', dados }) })
      .catch((erro) => { if (ativo) setEstado({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [tentativa])

  return (
    <section aria-labelledby="h-ponte" className="flex flex-col gap-3">
      <h2 id="h-ponte" className="text-lg font-bold">Ponte clínica–escola</h2>

      {estado.tipo === 'carregando' && (
        <EstadoCarregando forma="cartoes" quantidade={3} rotulo="Carregando a ponte com a escola" />
      )}

      {estado.tipo === 'erro' && (
        <EstadoErro
          erro={estado.erro}
          oQue="a ponte com a escola"
          nivel={3}
          aoTentarDeNovo={() => setTentativa((t) => t + 1)}
        />
      )}

      {estado.tipo === 'pronto' && (() => {
        const { escolasComVinculoAtivo: escolas, ocorrenciasUltimos30Dias: ocorrencias } = estado.dados
        const { tempoAteLeituraClinica: tempo, aguardandoLeitura: fila } = estado.dados
        return (
          <>
            <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <li>
                <CartaoNumero rotulo="Escolas com vínculo ativo" valor={escolas.valor} periodo={escolas.periodo} />
              </li>
              <li>
                <CartaoNumero
                  rotulo="Ocorrências relatadas pela escola"
                  valor={ocorrencias.valor}
                  periodo={ocorrencias.periodo}
                />
              </li>
              <li>
                <CartaoNumero
                  rotulo="Tempo até a leitura clínica"
                  valor={tempo.medianaHoras === null ? '—' : tempoDeLeitura(tempo.medianaHoras)}
                  apagado={tempo.medianaHoras === null}
                  periodo={tempo.medianaHoras === null
                    ? 'Poucas leituras no período para calcular.'
                    : `mediana de ${plural(tempo.leituras, 'leitura', 'leituras')} ${tempo.periodo}`}
                />
              </li>
            </ul>

            {/* Sempre visivel: as que ainda esperam ficam fora da mediana, e
                sao justamente as mais lentas. Escondidas, o numero pareceria
                melhor do que a realidade. */}
            {fila.quantidade === 0 ? (
              <p className="text-[15px] text-tinta2">Nenhuma ocorrência aguardando leitura.</p>
            ) : (
              <p className="flex flex-wrap items-center gap-2 text-[15px]">
                <Etiqueta tom="at" simbolo="▲">
                  {plural(fila.quantidade, 'ocorrência aguardando leitura clínica', 'ocorrências aguardando leitura clínica')}
                </Etiqueta>
                {fila.maisAntigaHaDias !== null && (
                  <span className="text-tinta2">
                    · a mais antiga {fila.maisAntigaHaDias === 0
                      ? 'é de hoje'
                      : `há ${plural(fila.maisAntigaHaDias, 'dia', 'dias')}`}
                  </span>
                )}
              </p>
            )}
          </>
        )
      })()}
    </section>
  )
}

// ---------------------------------------------------------------- Tela

/**
 * Clinica sem nenhuma sessao registrada. Exportado porque os dados de
 * demonstracao nunca estao vazios: a variante se ve em /dev/estados.
 */
export function PainelSemDados() {
  return (
    <EstadoVazio
      titulo="Os indicadores aparecem depois das primeiras sessões"
      explicacao="Assim que a equipe registrar atendimentos, este painel passa a contar sessões, acompanhar planos e apontar o que precisa de atenção."
      acao={<BotaoLink para="/app/clinica/pacientes/novo" area="cli">Cadastrar paciente</BotaoLink>}
    />
  )
}

export function PainelCoordenacao() {
  const [resumo, setResumo] = useState<Estado<ResumoClinica>>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true
    setResumo({ tipo: 'carregando' })
    servicos.indicadores.resumo()
      .then((dados) => { if (ativo) setResumo({ tipo: 'pronto', dados }) })
      .catch((erro) => { if (ativo) setResumo({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [tentativa])

  // So o resumo sabe se a clinica tem dados. Se ele falhar, os outros blocos
  // seguem: o erro e dele, nao da tela.
  const semDados = resumo.tipo === 'pronto' && !resumo.dados.temDados

  return (
    <Tela area="cli" caminho={['Coordenação', 'Indicadores da clínica']}>
      <Titulo sub="A visão de gestão da clínica, diferente do painel de quem atende">
        Indicadores da clínica
      </Titulo>

      {semDados ? <PainelSemDados /> : (
        <>
          <section aria-labelledby="h-numeros" className="flex flex-col gap-3">
            <h2 id="h-numeros" className="text-lg font-bold">A clínica em números</h2>

            {resumo.tipo === 'carregando' && (
              <EstadoCarregando forma="cartoes" quantidade={4} rotulo="Carregando os números da clínica" />
            )}

            {resumo.tipo === 'erro' && (
              <EstadoErro
                erro={resumo.erro}
                oQue="os números da clínica"
                nivel={3}
                aoTentarDeNovo={() => setTentativa((t) => t + 1)}
              />
            )}

            {resumo.tipo === 'pronto' && (
              <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {numeroDoResumo(resumo.dados).map(([rotulo, indicador]) => (
                  <li key={rotulo}>
                    <CartaoNumero rotulo={rotulo} valor={indicador.valor} periodo={indicador.periodo} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="h-atencao" className="flex flex-col gap-5">
            <h2 id="h-atencao" className="text-lg font-bold">O que precisa de atenção</h2>
            {GRUPOS.map((g) => <GrupoAtencao key={g.motivo} motivo={g.motivo} titulo={g.titulo} />)}
          </section>

          <BlocoSessoes />
          <BlocoPonte />
        </>
      )}
    </Tela>
  )
}
