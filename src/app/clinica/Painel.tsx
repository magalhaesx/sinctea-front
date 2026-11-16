import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Tela } from '../LayoutApp'
import { SO_CAMINHO_PRINCIPAL } from '../caminhoPrincipal'
import { papelNaTela } from '../perfis'
import { Aviso } from '../../ui/Aviso'
import { Botao, BotaoLink } from '../../ui/Botao'
import { Cartao } from '../../ui/Cartao'
import { Etiqueta } from '../../ui/Etiqueta'
import { Titulo } from '../../ui/Titulo'
import { EstadoCarregando } from '../../ui/EstadoCarregando'
import { EstadoErro } from '../../ui/EstadoErro'
import { Paginacao } from '../../ui/Paginacao'
import { usarSessao } from '../../contexto/Sessao'
import { dataIsoParaLocal, diaCivilEm, emDataCivil, partesDaDataCivil, somarDias } from '@sinctea/compartilhado/dominio/datas'
import { horaEmManaus } from '@sinctea/compartilhado/dominio/agenda'
import { CancelarAgendamento } from './CancelarAgendamento'
import { acaoNaAgenda, cancelavel, type AcaoNaAgenda } from './agendaDoDia'
import {
  servicos, type AvisoOcorrenciaEscolar, type ItemAgenda, type Pagina,
} from '../../servicos'

/**
 * Tela 3 · Painel do terapeuta · /app/clinica (UC10, UC04, UC06)
 *
 * Agenda e avisos vem da camada de servicos, cada bloco com os seus quatro
 * estados. O aviso da escola e lista: pode haver mais de um no mesmo dia.
 *
 * O professor relata o que observou; a leitura clinica e de quem tem
 * habilitacao para faze-la. E aqui que ela e registrada, e o aviso lido sai
 * da lista: o bloco mostra o que ainda espera pelo profissional.
 *
 * A AGENDA voltou a versao publicada com o item 19b: as sessoes de quem esta
 * na sessao, no dia de Manaus, com o dia anterior e o proximo. O dia e o de
 * Manaus, como no servidor, e a hora tambem: a sessao das 23h30 e daquele dia.
 * Os registros a sincronizar continuam so no desenvolvimento: sao o offline
 * (docs/07, secao 3A), que ainda nao existe no servidor.
 */

/** A etiqueta de cada linha. A cancelada, alem dela, fica riscada. */
const ETIQUETA: Record<AcaoNaAgenda, { rotulo: string; tom: 'ok' | 'at' | 'neutro'; simbolo: string }> = {
  INICIAR: { rotulo: 'Agendada', tom: 'neutro', simbolo: '○' },
  CANCELAR_FUTURA: { rotulo: 'Agendada', tom: 'neutro', simbolo: '○' },
  NAO_INICIADA: { rotulo: 'Não iniciada', tom: 'at', simbolo: '▲' },
  ABRIR: { rotulo: 'Em aberto', tom: 'at', simbolo: '●' },
  VER: { rotulo: 'Concluída', tom: 'ok', simbolo: '✓' },
  CANCELADA: { rotulo: 'Cancelada', tom: 'neutro', simbolo: '✕' },
}

const POR_PAGINA = 10

type Estado<T> =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'pronto'; dados: T }

/** O dia de hoje em Manaus, que e como a agenda e pedida (item 19b). */
const diaDeHoje = () => diaCivilEm(new Date())

const hora = (iso: string) =>
  dataIsoParaLocal(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

const quando = (iso: string) => {
  const data = dataIsoParaLocal(iso)
  const hoje = new Date()
  const mesmoDia = data.toDateString() === hoje.toDateString()
  return mesmoDia
    ? `hoje, ${hora(iso)}`
    : `${data.toLocaleDateString('pt-BR')}, ${hora(iso)}`
}

const contagem = (n: number, um: string, varios: string) => (n === 0 ? `Nenhuma ${um}` : n === 1 ? `1 ${um}` : `${n} ${varios}`)

export function PainelClinica() {
  const { usuario, perfilAtivo, especialidade } = usarSessao()
  const [params, setParams] = useSearchParams()
  const pedido = params.get('dia')
  const dia = pedido && partesDaDataCivil(pedido) ? pedido : diaDeHoje()
  const pagina = Math.max(1, Number(params.get('pagina') ?? 1) || 1)

  const [agenda, setAgenda] = useState<Estado<Pagina<ItemAgenda>>>({ tipo: 'carregando' })
  const [avisos, setAvisos] = useState<Estado<Pagina<AvisoOcorrenciaEscolar>>>({ tipo: 'carregando' })
  const [pendentes, setPendentes] = useState(0)
  const [tentativaAgenda, setTentativaAgenda] = useState(0)
  const [tentativaAvisos, setTentativaAvisos] = useState(0)
  const [lendo, setLendo] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [erroLeitura, setErroLeitura] = useState<string | null>(null)
  const [avisoAgenda, setAvisoAgenda] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    // Depois de cancelar, a lista continua na tela enquanto se atualiza.
    setAgenda((atual) => (atual.tipo === 'pronto' && atual.dados.pagina === pagina ? atual : { tipo: 'carregando' }))
    servicos.sessoes.listarAgenda({ dia, pagina, porPagina: POR_PAGINA })
      .then((dados) => { if (ativo) setAgenda({ tipo: 'pronto', dados }) })
      .catch((erro) => { if (ativo) setAgenda({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [dia, pagina, tentativaAgenda])

  // Trocar de dia leva o aviso do cancelamento embora: ele era do outro dia.
  useEffect(() => { setAvisoAgenda(null) }, [dia])

  useEffect(() => {
    let ativo = true
    // Depois da leitura clinica, a lista continua na tela enquanto se atualiza.
    setAvisos((atual) => (atual.tipo === 'pronto' ? atual : { tipo: 'carregando' }))
    servicos.ocorrencias.listarAvisosDaEscola({ porPagina: 5 })
      .then((dados) => { if (ativo) setAvisos({ tipo: 'pronto', dados }) })
      .catch((erro) => { if (ativo) setAvisos({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [tentativaAvisos])

  // A fila do offline ainda nao existe no servidor: so no desenvolvimento.
  useEffect(() => {
    if (SO_CAMINHO_PRINCIPAL) return
    let ativo = true
    servicos.sessoes.listarPendentesDeSincronizacao({ porPagina: 1 })
      .then((p) => { if (ativo) setPendentes(p.total) })
      .catch(() => { if (ativo) setPendentes(0) })
    return () => { ativo = false }
  }, [tentativaAgenda])

  const registrarLeitura = async (a: AvisoOcorrenciaEscolar) => {
    setAviso(null)
    setErroLeitura(null)
    setLendo(a.ocorrenciaId)
    try {
      await servicos.ocorrencias.registrarLeituraClinica(a.ocorrenciaId)
      setAviso(`Leitura clínica registrada no relato sobre ${a.paciente.nome}. O aviso sai da lista.`)
      setTentativaAvisos((t) => t + 1)
    } catch (e) {
      setErroLeitura((e as Error).message || 'Não foi possível registrar agora.')
    } finally {
      setLendo(null)
    }
  }

  const irPara = (novoDia: string) => {
    const proximos = new URLSearchParams(params)
    proximos.delete('pagina')
    if (novoDia === diaDeHoje()) proximos.delete('dia')
    else proximos.set('dia', novoDia)
    setParams(proximos)
  }

  const hoje = diaDeHoje()
  const ehHoje = dia === hoje
  const dataPorExtenso = dataIsoParaLocal(dia).toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  const totalNaAgenda = agenda.tipo === 'pronto' ? agenda.dados.total : null
  const totalAvisos = avisos.tipo === 'pronto' ? avisos.dados.total : 0

  // A agenda conta as sessoes do dia, a cancelada tambem: ela aparece na lista, com a etiqueta.
  const resumo = totalNaAgenda === null
    ? 'Carregando a agenda'
    : `${contagem(totalNaAgenda, 'sessão na agenda', 'sessões na agenda')}${ehHoje ? ' hoje' : ''} · ` +
      `${totalAvisos === 0 ? 'nenhum aviso novo' : totalAvisos === 1 ? '1 aviso novo' : `${totalAvisos} avisos novos`}`

  return (
    <Tela
      area="cli"
      nome={usuario?.nome}
      papel={perfilAtivo ? papelNaTela(perfilAtivo, especialidade) : undefined}
      caminho={['Área clínica', 'Painel do profissional']}
    >
      <Titulo sub={resumo}>{dataPorExtenso}</Titulo>

      <section aria-labelledby="h-avisos" className="flex flex-col gap-3">
        <h2 id="h-avisos" className="text-lg font-bold">Avisos da escola</h2>

        <div aria-live="polite">
          {aviso && <Aviso tom="ok" titulo="Pronto">{aviso}</Aviso>}
          {erroLeitura && (
            <Aviso tom="cr" titulo="Não foi possível registrar a leitura">{erroLeitura}</Aviso>
          )}
        </div>

        {avisos.tipo === 'carregando' && (
          <EstadoCarregando forma="texto" linhas={2} rotulo="Carregando os avisos da escola" />
        )}

        {avisos.tipo === 'erro' && (
          <EstadoErro
            erro={avisos.erro}
            oQue="os avisos da escola"
            nivel={3}
            aoTentarDeNovo={() => setTentativaAvisos((t) => t + 1)}
          />
        )}

        {avisos.tipo === 'pronto' && (
          avisos.dados.total === 0 ? (
            <Cartao><p className="text-tinta2">Nenhum aviso novo da escola nos últimos sete dias.</p></Cartao>
          ) : (
            <ul className="grid items-start gap-2.5 [&>*]:min-w-0 xl:grid-cols-2">
              {avisos.dados.itens.map((a) => (
                <li key={a.ocorrenciaId}>
                  <Aviso tom="at" titulo="A escola registrou uma ocorrência">
                    <p>
                      {a.paciente.nome} · {quando(a.registradaEm)} · {a.escola}
                    </p>
                    <p className="mt-1">
                      Relato: {a.tipo} · intensidade {a.intensidade} de 5. A leitura clínica é sua.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Botao area="cli" onClick={() => void registrarLeitura(a)}
                        disabled={lendo === a.ocorrenciaId}>
                        {lendo === a.ocorrenciaId ? 'Registrando…' : 'Registrar a leitura clínica'}
                      </Botao>
                      {/* A ficha e o ponto de entrada: de la se escolhe o que abrir. */}
                      <BotaoLink para={`/app/clinica/pacientes/${a.paciente.id}`} area="cli"
                        variante="secundaria">
                        Abrir a ficha de {a.paciente.nome.split(' ')[0]}
                      </BotaoLink>
                    </div>
                  </Aviso>
                </li>
              ))}
            </ul>
          )
        )}
      </section>

      <section aria-labelledby="h-agenda" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="h-agenda" className="text-lg font-bold">
            {ehHoje ? 'Agenda do dia' : `Agenda de ${emDataCivil(dia)}`}
          </h2>
          <nav aria-label="Dia da agenda" className="flex flex-wrap items-center gap-2">
            <Botao area="cli" variante="secundaria" onClick={() => irPara(somarDias(dia, -1))}>
              <span aria-hidden="true">←</span> Dia anterior
            </Botao>
            {!ehHoje && (
              <Link to="/app/clinica" className="inline-flex min-h-11 items-center px-2 font-bold text-cli-ink underline">
                Voltar para hoje
              </Link>
            )}
            <Botao area="cli" variante="secundaria" onClick={() => irPara(somarDias(dia, 1))}>
              Próximo dia <span aria-hidden="true">→</span>
            </Botao>
          </nav>
        </div>

        <div aria-live="polite">
          {avisoAgenda && <Aviso tom="ok" titulo="Pronto">{avisoAgenda}</Aviso>}
        </div>

        {agenda.tipo === 'carregando' && (
          <EstadoCarregando forma="lista" linhas={3} rotulo="Carregando a agenda do dia" />
        )}

        {agenda.tipo === 'erro' && (
          <EstadoErro
            erro={agenda.erro}
            oQue="a agenda do dia"
            nivel={3}
            aoTentarDeNovo={() => setTentativaAgenda((t) => t + 1)}
          />
        )}

        {agenda.tipo === 'pronto' && (
          agenda.dados.total === 0 ? (
            // Sem EstadoVazio: agendar e na ficha do paciente, e a lista de
            // pacientes ja esta nos atalhos e no menu (docs/02, secao 4).
            <Cartao>
              <p className="text-tinta2">
                {ehHoje ? 'Nenhuma sessão agendada para hoje.' : 'Nenhuma sessão agendada para este dia.'}{' '}
                Para agendar, abra a ficha do paciente.
              </p>
            </Cartao>
          ) : (
            <>
              <ul className="flex flex-col gap-2.5">
                {agenda.dados.itens.map((i) => {
                  const acao = acaoNaAgenda(i, hoje)
                  const etiqueta = ETIQUETA[acao]
                  const sessao = `/app/clinica/pacientes/${i.paciente.id}/sessao?sessao=${i.sessaoId}`
                  const cancelada = acao === 'CANCELADA'
                  return (
                    <li
                      key={i.sessaoId}
                      className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-linha bg-sup px-3.5 py-3"
                    >
                      <span className={cancelada ? 'text-tinta2 line-through' : undefined}>
                        <b className="tabular-nums">{horaEmManaus(i.inicioPrevistoEm)}</b> ·{' '}
                        <Link to={`/app/clinica/pacientes/${i.paciente.id}`} className="text-cli-ink underline">
                          {i.paciente.nome}
                        </Link>
                        <span className="text-tinta2"> · {i.local}</span>
                      </span>
                      <span className="flex flex-wrap items-center gap-2.5">
                        <Etiqueta tom={etiqueta.tom} simbolo={etiqueta.simbolo}>
                          {i.situacao === 'PAUSADA' ? 'Pausada' : etiqueta.rotulo}
                        </Etiqueta>
                        {acao === 'INICIAR' && <BotaoLink para={sessao} area="cli">Iniciar</BotaoLink>}
                        {acao === 'ABRIR' && <BotaoLink para={sessao} area="cli">Abrir a sessão</BotaoLink>}
                        {acao === 'VER' && <BotaoLink para={sessao} area="cli" variante="secundaria">Ver a sessão</BotaoLink>}
                        {cancelavel(acao) && (
                          <CancelarAgendamento
                            sessaoId={i.sessaoId}
                            descricao={`${i.paciente.nome}, ${emDataCivil(dia)} às ${horaEmManaus(i.inicioPrevistoEm)}`}
                            aoCancelar={(mensagem) => { setAvisoAgenda(mensagem); setTentativaAgenda((t) => t + 1) }}
                          />
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>

              <Paginacao
                pagina={agenda.dados.pagina}
                porPagina={agenda.dados.porPagina}
                total={agenda.dados.total}
                aoMudar={(p) => {
                  const proximos = new URLSearchParams(params)
                  proximos.set('pagina', String(p))
                  setParams(proximos)
                }}
                rotulo="Páginas da agenda do dia"
                nomeItens={{ singular: 'sessão', plural: 'sessões' }}
              />
            </>
          )
        )}
      </section>

      {/* Bloco que so diz "nada aqui" gasta atencao: sem pendencia, sem bloco.
          A condicao do offline vem primeiro: no build, ela tira o bloco do pacote. */}
      {!SO_CAMINHO_PRINCIPAL && pendentes > 0 && (
        <Aviso titulo={`${pendentes} ${pendentes === 1 ? 'registro aguardando' : 'registros aguardando'} sincronização`}>
          Foram feitos sem conexão e serão enviados assim que a rede voltar. Nada se perde — você
          pode continuar registrando normalmente.
        </Aviso>
      )}

      <div className="flex flex-wrap gap-2">
        <BotaoLink para="/app/clinica/pacientes" area="cli" variante="secundaria">Ver meus pacientes</BotaoLink>
      </div>
    </Tela>
  )
}
