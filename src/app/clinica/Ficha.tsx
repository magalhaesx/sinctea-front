import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Tela } from '../LayoutApp'
import { Aviso } from '../../ui/Aviso'
import { Botao, BotaoLink } from '../../ui/Botao'
import { Cartao } from '../../ui/Cartao'
import { Etiqueta } from '../../ui/Etiqueta'
import { Titulo } from '../../ui/Titulo'
import { EstadoCarregando } from '../../ui/EstadoCarregando'
import { EstadoErro } from '../../ui/EstadoErro'
import { Paginacao } from '../../ui/Paginacao'
import { descricaoNivelSuporte, ehPreliminar } from '../../dominio/regras'
import {
  ErroServico, servicos, type OcorrenciaComportamental, type Origem, type Pagina,
  type PacienteDetalhe, type SituacaoConsentimento, type SituacaoPlano,
} from '../../servicos'

/**
 * Tela 5 · Ficha do paciente · /app/clinica/pacientes/:id (UC01)
 *
 * A rede de apoio marca quem responde legalmente: so o responsavel legal
 * autoriza o acesso da escola (regra 1 do CLAUDE.md). Quem olha a ficha
 * precisa saber a quem recorrer sem abrir outra tela.
 *
 * Os eventos comportamentais recentes ficam aqui porque o painel do terapeuta
 * so mostra os que ainda esperam leitura clinica. Lido, o evento precisa de um
 * lugar onde continue visivel — e quem chega pelo "Abrir a ficha" do aviso nao
 * pode ter de voltar ao painel para agir sobre o que esta vendo.
 */

const SITUACAO_PLANO: Record<SituacaoPlano, { rotulo: string; tom: 'ok' | 'at' | 'neutro'; simbolo: string }> = {
  VIGENTE: { rotulo: 'Plano vigente', tom: 'ok', simbolo: '✓' },
  DEVOLVIDO: { rotulo: 'Plano devolvido', tom: 'at', simbolo: '▲' },
  SEM_PLANO: { rotulo: 'Sem plano', tom: 'at', simbolo: '▲' },
  RASCUNHO: { rotulo: 'Plano em rascunho', tom: 'neutro', simbolo: '○' },
  AGUARDANDO_VALIDACAO: { rotulo: 'Plano aguardando validação', tom: 'neutro', simbolo: '○' },
}

const SITUACAO_CONSENTIMENTO: Record<SituacaoConsentimento, { rotulo: string; tom: 'ok' | 'neutro'; simbolo: string }> = {
  VIGENTE: { rotulo: 'Acesso vigente', tom: 'ok', simbolo: '✓' },
  REVOGADO: { rotulo: 'Acesso encerrado pela família', tom: 'neutro', simbolo: '○' },
  EXPIRADO: { rotulo: 'Prazo do acesso terminado', tom: 'neutro', simbolo: '○' },
  AGUARDANDO_INICIO: { rotulo: 'Acesso ainda não começou', tom: 'neutro', simbolo: '○' },
}

const NOME_DA_ORIGEM: Record<Origem, string> = {
  CLINICA: 'Clínica', CASA: 'Casa', ESCOLA: 'Escola',
}

/** Janela dos eventos recentes, em dias. */
const DIAS_RECENTES = 30
const EVENTOS_POR_PAGINA = 5

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'pronto'; paciente: PacienteDetalhe }

type EstadoLista =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'pronto'; dados: Pagina<OcorrenciaComportamental> }

const emData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')

/**
 * Eventos comportamentais dos ultimos 30 dias, de todas as origens, com a
 * situacao da leitura clinica. Carrega por conta propria: a ficha nao espera
 * por esta lista para aparecer.
 */
function EventosComportamentais({ pacienteId, primeiroNome }: {
  pacienteId: string
  primeiroNome: string
}) {
  const [estado, setEstado] = useState<EstadoLista>({ tipo: 'carregando' })
  const [pagina, setPagina] = useState(1)
  const [tentativa, setTentativa] = useState(0)
  const [lendo, setLendo] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [erroLeitura, setErroLeitura] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    setEstado({ tipo: 'carregando' })
    const desde = new Date(Date.now() - DIAS_RECENTES * 86_400_000).toISOString()
    servicos.ocorrencias.listarPorPaciente(pacienteId, { desde, pagina, porPagina: EVENTOS_POR_PAGINA })
      .then((dados) => { if (ativo) setEstado({ tipo: 'pronto', dados }) })
      .catch((erro) => { if (ativo) setEstado({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [pacienteId, pagina, tentativa])

  const registrarLeitura = async (o: OcorrenciaComportamental) => {
    setAviso(null)
    setErroLeitura(null)
    setLendo(o.id)
    try {
      await servicos.ocorrencias.registrarLeituraClinica(o.id)
      setAviso(`Leitura clínica registrada no evento de ${emData(o.ocorridaEm)}.`)
      setTentativa((t) => t + 1)
    } catch (e) {
      setErroLeitura((e as Error).message || 'Não foi possível registrar agora.')
    } finally {
      setLendo(null)
    }
  }

  return (
    <Cartao>
      <h2 className="text-lg font-bold">Eventos comportamentais recentes</h2>
      <p className="mt-1 text-sm text-tinta2">
        Últimos {DIAS_RECENTES} dias, de todas as origens.
      </p>

      <div aria-live="polite">
        {aviso && <div className="mt-3"><Aviso tom="ok" titulo="Pronto">{aviso}</Aviso></div>}
        {erroLeitura && (
          <div className="mt-3">
            <Aviso tom="cr" titulo="Não foi possível registrar a leitura">{erroLeitura}</Aviso>
          </div>
        )}
      </div>

      {estado.tipo === 'carregando' && (
        <div className="mt-3">
          <EstadoCarregando forma="lista" linhas={3} rotulo="Carregando os eventos comportamentais" />
        </div>
      )}

      {estado.tipo === 'erro' && (
        <div className="mt-3">
          <EstadoErro
            erro={estado.erro}
            oQue="os eventos comportamentais"
            nivel={3}
            aoTentarDeNovo={() => setTentativa((t) => t + 1)}
          />
        </div>
      )}

      {estado.tipo === 'pronto' && (
        estado.dados.total === 0 ? (
          // Sem EstadoVazio: o que preenche esta lista e a sessao, e "Iniciar
          // sessao" ja esta nas acoes desta tela (docs/02, secao 4).
          <p className="mt-3 text-tinta2">
            Nenhum evento comportamental de {primeiroNome} nos últimos {DIAS_RECENTES} dias.
            Eventos entram pelo registro em sessão ou por relato da escola.
          </p>
        ) : (
          <>
            <ul className="mt-3 flex flex-col gap-2">
              {estado.dados.itens.map((o) => (
                <li
                  key={o.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-linha bg-sup px-3 py-2.5"
                >
                  <span>
                    <b>{emData(o.ocorridaEm)} · {NOME_DA_ORIGEM[o.origem]}</b>
                    <span className="block text-sm text-tinta2">
                      {o.comportamento} · intensidade {o.intensidade} de 5
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    {ehPreliminar(o) ? (
                      <>
                        <Etiqueta tom="at" simbolo="▲">Aguardando leitura clínica</Etiqueta>
                        <Botao area="cli" variante="secundaria" disabled={lendo === o.id}
                          onClick={() => void registrarLeitura(o)}>
                          {lendo === o.id ? 'Registrando…' : 'Registrar a leitura clínica'}
                        </Botao>
                      </>
                    ) : (
                      <Etiqueta tom="ok" simbolo="✓">
                        {/* Nao e preliminar: a data da leitura existe. */}
                        Leitura clínica em {emData(o.leituraClinicaEm!)}
                      </Etiqueta>
                    )}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-3">
              <Paginacao
                pagina={estado.dados.pagina}
                porPagina={estado.dados.porPagina}
                total={estado.dados.total}
                aoMudar={setPagina}
                rotulo="Páginas dos eventos comportamentais"
                nomeItens={{ singular: 'evento', plural: 'eventos' }}
              />
            </div>
          </>
        )
      )}
    </Cartao>
  )
}

export function Ficha() {
  const { id = '' } = useParams()
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true
    setEstado({ tipo: 'carregando' })
    servicos.pacientes.obter(id)
      .then((paciente) => { if (ativo) setEstado({ tipo: 'pronto', paciente }) })
      .catch((erro) => { if (ativo) setEstado({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [id, tentativa])

  const nome = estado.tipo === 'pronto' ? estado.paciente.nome : 'Ficha do paciente'
  const negado = estado.tipo === 'erro' && estado.erro instanceof ErroServico
    && estado.erro.codigo === 'ACESSO_NEGADO'

  return (
    <Tela area="cli" caminho={['Área clínica', 'Pacientes', nome]}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Titulo sub="Identificação, rede de apoio, equipe e vínculo escolar">{nome}</Titulo>
        <Link to="/app/clinica/pacientes" className="min-h-11 items-center font-bold text-cli-ink underline">
          Voltar para a lista
        </Link>
      </div>

      {estado.tipo === 'carregando' && (
        <EstadoCarregando forma="cartoes" quantidade={2} rotulo="Carregando a ficha do paciente" />
      )}

      {estado.tipo === 'erro' && (
        // Tentar de novo nao muda o alcance do perfil: sem botao neste caso.
        <EstadoErro
          erro={estado.erro}
          oQue="esta ficha"
          titulo={negado ? 'Esta ficha não é do seu alcance' : undefined}
          texto={negado
            ? 'Esta ficha é de um paciente que você não acompanha. Se precisar consultá-la, fale com a coordenação da clínica.'
            : undefined}
          aoTentarDeNovo={negado ? undefined : () => setTentativa((t) => t + 1)}
        />
      )}

      {estado.tipo === 'pronto' && (() => {
        const p = estado.paciente
        const plano = SITUACAO_PLANO[p.situacaoPlano]
        return (
          <>
            <Cartao>
              <h2 className="text-lg font-bold">Identificação</h2>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px]">
                <dt className="font-bold">Idade</dt>
                <dd>{p.idade} anos · nascimento em {emData(p.dataNascimento)}</dd>
                <dt className="font-bold">Nível de suporte</dt>
                <dd>{descricaoNivelSuporte(p.nivelSuporte)}</dd>
                <dt className="font-bold">Plano terapêutico</dt>
                <dd><Etiqueta tom={plano.tom} simbolo={plano.simbolo}>{plano.rotulo}</Etiqueta></dd>
              </dl>
            </Cartao>

            <Cartao>
              <h2 className="text-lg font-bold">Rede de apoio</h2>
              {p.redeApoio.length === 0 ? (
                <p className="mt-1 text-tinta2">Nenhum responsável cadastrado ainda.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {p.redeApoio.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-linha bg-sup px-3 py-2.5">
                      <span>
                        <b>{r.nome}</b>
                        <span className="block text-sm text-tinta2">{r.parentesco} · {r.telefone}</span>
                      </span>
                      {/* Só o responsável legal autoriza o acesso da escola. */}
                      {r.responsavelLegal
                        ? <Etiqueta tom="ok" simbolo="✓">Responsável legal</Etiqueta>
                        : <Etiqueta simbolo="○">Não responde legalmente</Etiqueta>}
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>

            <Cartao>
              <h2 className="text-lg font-bold">Equipe multiprofissional</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {p.equipe.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-linha bg-sup px-3 py-2.5">
                    <span>
                      <b>{e.nome}</b>
                      <span className="block text-sm text-tinta2">{e.especialidade}</span>
                    </span>
                    {e.id === p.profissionalResponsavelId && (
                      <Etiqueta tom="ok" simbolo="✓">Responsável pelo caso</Etiqueta>
                    )}
                  </li>
                ))}
              </ul>
            </Cartao>

            <Cartao>
              <h2 className="text-lg font-bold">Vínculo escolar</h2>
              {p.vinculosEscolares.length === 0 ? (
                // Sem acao: quem autoriza e a familia, na area dela.
                <p className="mt-1 text-tinta2">
                  Nenhuma escola tem acesso aos dados de {p.nome.split(' ')[0]}.
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {p.vinculosEscolares.map((v) => {
                    const s = SITUACAO_CONSENTIMENTO[v.situacaoConsentimento]
                    return (
                      <li key={v.vinculoId} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-linha bg-sup px-3 py-2.5">
                        <span>
                          <b>{v.escola}</b>
                          <span className="block text-sm text-tinta2">
                            {v.turma} · {v.turno} · {v.professor} ({v.atuacao})
                          </span>
                        </span>
                        <Etiqueta tom={s.tom} simbolo={s.simbolo}>{s.rotulo}</Etiqueta>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Cartao>

            <EventosComportamentais pacienteId={p.id} primeiroNome={p.nome.split(' ')[0]} />

            <Cartao>
              <h2 className="text-lg font-bold">Histórico resumido</h2>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px]">
                <dt className="font-bold">Sessões encerradas</dt>
                <dd className="tabular-nums">{p.totalSessoes}</dd>
                <dt className="font-bold">Última sessão</dt>
                <dd>{p.ultimaSessaoEm ? emData(p.ultimaSessaoEm) : 'Nenhuma sessão registrada'}</dd>
              </dl>
            </Cartao>

            <section aria-labelledby="h-acoes">
              <h2 id="h-acoes" className="mb-3 text-lg font-bold">Ações</h2>
              <div className="flex flex-wrap gap-2">
                <BotaoLink para={`/app/clinica/pacientes/${p.id}/plano`} area="cli">
                  Abrir o plano terapêutico
                </BotaoLink>
                <BotaoLink para={`/app/clinica/pacientes/${p.id}/sessao`} area="cli" variante="secundaria">
                  Iniciar sessão
                </BotaoLink>
                <BotaoLink para={`/app/clinica/pacientes/${p.id}/evolucao`} area="cli" variante="secundaria">
                  Ver evolução por objetivo
                </BotaoLink>
                <BotaoLink para={`/app/clinica/pacientes/${p.id}/atividades`} area="cli" variante="secundaria">
                  Atividades para casa
                </BotaoLink>
              </div>
            </section>
          </>
        )
      })()}
    </Tela>
  )
}
