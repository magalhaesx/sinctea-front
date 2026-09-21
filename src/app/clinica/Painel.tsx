import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Tela } from '../LayoutApp'
import { NOME_DO_PERFIL } from '../perfis'
import { Aviso } from '../../ui/Aviso'
import { Botao, BotaoLink } from '../../ui/Botao'
import { Cartao } from '../../ui/Cartao'
import { Etiqueta } from '../../ui/Etiqueta'
import { Titulo } from '../../ui/Titulo'
import { EstadoCarregando } from '../../ui/EstadoCarregando'
import { EstadoErro } from '../../ui/EstadoErro'
import { Paginacao } from '../../ui/Paginacao'
import { usarSessao } from '../../contexto/Sessao'
import {
  servicos, type AvisoOcorrenciaEscolar, type ItemAgenda, type Pagina, type SituacaoSessao,
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
 */

const SITUACAO: Record<SituacaoSessao, { rotulo: string; tom: 'ok' | 'at' | 'neutro'; simbolo: string }> = {
  ENCERRADA: { rotulo: 'Concluída', tom: 'ok', simbolo: '✓' },
  EM_ANDAMENTO: { rotulo: 'Em aberto', tom: 'at', simbolo: '●' },
  PAUSADA: { rotulo: 'Pausada', tom: 'at', simbolo: '▲' },
  AGENDADA: { rotulo: 'Agendada', tom: 'neutro', simbolo: '○' },
  CANCELADA: { rotulo: 'Cancelada', tom: 'neutro', simbolo: '○' },
}

const POR_PAGINA = 10

type Estado<T> =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'pronto'; dados: T }

/** AAAA-MM-DD no fuso de quem usa, que e como a agenda e pedida. */
const diaDeHoje = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

const quando = (iso: string) => {
  const data = new Date(iso)
  const hoje = new Date()
  const mesmoDia = data.toDateString() === hoje.toDateString()
  return mesmoDia
    ? `hoje, ${hora(iso)}`
    : `${data.toLocaleDateString('pt-BR')}, ${hora(iso)}`
}

export function PainelClinica() {
  const { usuario, perfilAtivo } = usarSessao()
  const [params, setParams] = useSearchParams()
  const dia = params.get('dia') ?? diaDeHoje()
  const pagina = Math.max(1, Number(params.get('pagina') ?? 1) || 1)

  const [agenda, setAgenda] = useState<Estado<Pagina<ItemAgenda>>>({ tipo: 'carregando' })
  const [avisos, setAvisos] = useState<Estado<Pagina<AvisoOcorrenciaEscolar>>>({ tipo: 'carregando' })
  const [pendentes, setPendentes] = useState(0)
  const [tentativaAgenda, setTentativaAgenda] = useState(0)
  const [tentativaAvisos, setTentativaAvisos] = useState(0)
  const [lendo, setLendo] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [erroLeitura, setErroLeitura] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    setAgenda({ tipo: 'carregando' })
    servicos.sessoes.listarAgenda({ dia, pagina, porPagina: POR_PAGINA })
      .then((dados) => { if (ativo) setAgenda({ tipo: 'pronto', dados }) })
      .catch((erro) => { if (ativo) setAgenda({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [dia, pagina, tentativaAgenda])

  useEffect(() => {
    let ativo = true
    setAvisos({ tipo: 'carregando' })
    servicos.ocorrencias.listarAvisosDaEscola({ porPagina: 5 })
      .then((dados) => { if (ativo) setAvisos({ tipo: 'pronto', dados }) })
      .catch((erro) => { if (ativo) setAvisos({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [tentativaAvisos])

  useEffect(() => {
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

  const ehHoje = dia === diaDeHoje()
  const dataPorExtenso = new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  const totalNaAgenda = agenda.tipo === 'pronto' ? agenda.dados.total : null
  const totalAvisos = avisos.tipo === 'pronto' ? avisos.dados.total : 0

  const resumo = totalNaAgenda === null
    ? 'Carregando a agenda'
    : `${totalNaAgenda === 0 ? 'Nenhum atendimento' : totalNaAgenda === 1 ? '1 atendimento' : `${totalNaAgenda} atendimentos`}` +
      `${ehHoje ? ' hoje' : ''} · ${totalAvisos === 0 ? 'nenhum aviso novo' : totalAvisos === 1 ? '1 aviso novo' : `${totalAvisos} avisos novos`}`

  return (
    <Tela
      area="cli"
      nome={usuario?.nome}
      papel={perfilAtivo ? NOME_DO_PERFIL[perfilAtivo] : undefined}
      caminho={['Área clínica', 'Painel do terapeuta']}
    >
      <Titulo sub={resumo}>{dataPorExtenso}</Titulo>

      {!ehHoje && (
        <p className="text-sm">
          Você está vendo a agenda de outro dia.{' '}
          <Link to="/app/clinica" className="font-bold text-cli-ink underline">Voltar para hoje</Link>
        </p>
      )}

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
            <ul className="flex flex-col gap-2.5">
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
        <h2 id="h-agenda" className="text-lg font-bold">Agenda do dia</h2>

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
            // Sem EstadoVazio: a acao que ele ofereceria — ir para a lista de
            // pacientes — ja esta nos atalhos e no menu (docs/02, secao 4).
            <Cartao>
              <p className="text-tinta2">
                {ehHoje
                  ? 'Nenhum atendimento agendado para hoje.'
                  : 'Nenhum atendimento agendado para este dia.'}
              </p>
            </Cartao>
          ) : (
            <>
              <ul className="flex flex-col gap-2.5">
                {agenda.dados.itens.map((i) => {
                  const s = SITUACAO[i.situacao]
                  return (
                    <li
                      key={i.sessaoId}
                      className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-linha bg-sup px-3.5 py-3"
                    >
                      <span>
                        <b className="tabular-nums">{hora(i.inicioPrevistoEm)}</b> ·{' '}
                        <Link to={`/app/clinica/pacientes/${i.paciente.id}`} className="text-cli-ink underline">
                          {i.paciente.nome}
                        </Link>
                      </span>
                      <span className="flex flex-wrap items-center gap-2.5">
                        <Etiqueta tom={s.tom} simbolo={s.simbolo}>{s.rotulo}</Etiqueta>
                        <BotaoLink para={`/app/clinica/pacientes/${i.paciente.id}/sessao`} area="cli">
                          {i.situacao === 'ENCERRADA' ? 'Ver a sessão' : 'Abrir a sessão'}
                        </BotaoLink>
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
                nomeItens={{ singular: 'atendimento', plural: 'atendimentos' }}
              />
            </>
          )
        )}
      </section>

      {/* Bloco que so diz "nada aqui" gasta atencao: sem pendencia, sem bloco. */}
      {pendentes > 0 && (
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
