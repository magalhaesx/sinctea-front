import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Tela } from '../LayoutApp'
import { Aviso } from '../../ui/Aviso'
import { Botao } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { Cartao } from '../../ui/Cartao'
import { Etiqueta } from '../../ui/Etiqueta'
import { Medidor } from '../../ui/Medidor'
import { Titulo } from '../../ui/Titulo'
import { EstadoCarregando } from '../../ui/EstadoCarregando'
import { EstadoErro } from '../../ui/EstadoErro'
import { planoEditavel, validarNovoObjetivo } from '@sinctea/compartilhado/dominio/regras'
import { CartoesDoObjetivo } from './CartoesDoObjetivo'
import { CriarPlano } from './CriarPlano'
import { EditarDatas, EditarObjetivo } from './EdicaoDoPlano'
import { PACIENTES, doPaciente, usarNomeDoPaciente } from './caminho'
import { emDataCivil } from '@sinctea/compartilhado/dominio/datas'
import {
  ErroServico, servicos, type NovoObjetivo, type Objetivo, type PlanoTerapeutico,
  type SituacaoPlano, type StatusObjetivo,
} from '../../servicos'

/**
 * Tela 6 · Plano Terapeutico Individual · /app/clinica/pacientes/:id/plano
 * UC02, UC03
 *
 * REGRA 4 DO CLAUDE.md: o objetivo tem duas redacoes gravadas separadamente, e
 * a acessivel e escrita pelo terapeuta. Esta tela NAO tem botao de gerar a
 * partir da tecnica, nem de copiar, nem preenchimento automatico ao sair do
 * campo tecnico, nem sugestao. Sao a mesma coisa com outra roupa: quem
 * responde pelo conteudo e o profissional.
 */

const SITUACAO: Record<Exclude<SituacaoPlano, 'SEM_PLANO'>, { rotulo: string; tom: 'ok' | 'at' | 'neutro'; simbolo: string }> = {
  VIGENTE: { rotulo: 'Vigente', tom: 'ok', simbolo: '✓' },
  DEVOLVIDO: { rotulo: 'Devolvido pela coordenação', tom: 'at', simbolo: '▲' },
  RASCUNHO: { rotulo: 'Rascunho', tom: 'neutro', simbolo: '○' },
  AGUARDANDO_VALIDACAO: { rotulo: 'Aguardando validação', tom: 'neutro', simbolo: '○' },
}

const STATUS_OBJETIVO: Record<StatusObjetivo, { rotulo: string; tom: 'ok' | 'at' | 'neutro'; simbolo: string }> = {
  DOMINADO: { rotulo: 'Dominado', tom: 'ok', simbolo: '✓' },
  EM_AQUISICAO: { rotulo: 'Em aquisição', tom: 'at', simbolo: '●' },
  NAO_INICIADO: { rotulo: 'Não iniciado', tom: 'neutro', simbolo: '○' },
}

const CRITERIO_PADRAO = { percentualMinimo: '80', sessoesConsecutivas: '3' }

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'pronto'; plano: PlanoTerapeutico }

/** Objetivos agrupados por dominio, na ordem em que os dominios aparecem. */
function porDominio(objetivos: Objetivo[]): [string, Objetivo[]][] {
  const grupos = new Map<string, Objetivo[]>()
  for (const o of objetivos) grupos.set(o.dominio, [...(grupos.get(o.dominio) ?? []), o])
  return [...grupos.entries()]
}

export function Plano() {
  const { id = '' } = useParams()
  const nomeDoPaciente = usarNomeDoPaciente(id)
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)

  // Modo de leitura da TELA INTEIRA: o terapeuta troca de leitura, nao de item.
  const [acessivel, setAcessivel] = useState(false)

  const [formularioAberto, setFormularioAberto] = useState(false)
  const [novo, setNovo] = useState({ dominio: '', descricaoTecnica: '', descricaoAcessivel: '', ...CRITERIO_PADRAO })
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  /** O envio para validacao que falhou (item 10): aviso de erro, e nao o "Pronto". */
  const [falhaNoEnvio, setFalhaNoEnvio] = useState<string | null>(null)
  /** Item 7: o objetivo em edicao, e se as datas estao em edicao. */
  const [editandoObjetivo, setEditandoObjetivo] = useState<string | null>(null)
  const [editandoDatas, setEditandoDatas] = useState(false)

  /** Fechada a edicao, o foco volta ao botao que a abriu. */
  const devolverFoco = (idDoBotao: string) => setTimeout(() => document.getElementById(idDoBotao)?.focus())

  /** Salvo, o plano muda na propria tela: nada recarrega, nada sai do lugar. */
  const trocarPlano = (plano: PlanoTerapeutico) => setEstado({ tipo: 'pronto', plano })
  const trocarObjetivo = (editado: Objetivo) => setEstado((atual) => atual.tipo === 'pronto'
    ? { tipo: 'pronto', plano: { ...atual.plano, objetivos: atual.plano.objetivos.map((o) => (o.id === editado.id ? editado : o)) } }
    : atual)

  // Aviso de sucesso e do plano que acabou de mudar: trocar de paciente o
  // apaga. So a troca de paciente, e nao toda recarga: gravar e recarregar em
  // seguida matava o recado com a recarga que ele mesmo pediu.
  useEffect(() => { setAviso(null); setFalhaNoEnvio(null) }, [id])

  useEffect(() => {
    let ativo = true
    // Recarga depois de salvar (item 7): o plano continua na tela, com o
    // cartao aberto e a rolagem onde estavam. So outro paciente volta ao
    // "carregando".
    setEstado((atual) => (atual.tipo === 'pronto' && atual.plano.pacienteId === id ? atual : { tipo: 'carregando' }))
    servicos.planos.obterPorPaciente(id)
      .then((plano) => { if (ativo) setEstado({ tipo: 'pronto', plano }) })
      .catch((erro) => { if (ativo) setEstado({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [id, tentativa])

  const recarregar = () => setTentativa((t) => t + 1)

  const dadosDoFormulario = (): NovoObjetivo => ({
    dominio: novo.dominio,
    descricaoTecnica: novo.descricaoTecnica,
    descricaoAcessivel: novo.descricaoAcessivel,
    criterio: {
      percentualMinimo: Number(novo.percentualMinimo),
      sessoesConsecutivas: Number(novo.sessoesConsecutivas),
    },
  })

  const adicionar = async (evento: FormEvent, planoId: string) => {
    evento.preventDefault()
    setAviso(null)
    const dados = dadosDoFormulario()
    const encontrados = validarNovoObjetivo(dados)
    if (Object.keys(encontrados).length > 0) { setErros(encontrados); return }

    setErros({})
    setSalvando(true)
    try {
      const objetivo = await servicos.planos.adicionarObjetivo(planoId, dados)
      setNovo({ dominio: '', descricaoTecnica: '', descricaoAcessivel: '', ...CRITERIO_PADRAO })
      setFormularioAberto(false)
      setAviso(`Objetivo acrescentado em ${objetivo.dominio}.`)
      recarregar()
    } catch (e) {
      const erro = e as ErroServico
      setErros(erro instanceof ErroServico && Object.keys(erro.campos).length > 0
        ? erro.campos
        : { geral: erro.message ?? 'Não foi possível salvar agora.' })
    } finally {
      setSalvando(false)
    }
  }

  const enviarParaValidacao = async (planoId: string) => {
    setAviso(null)
    setFalhaNoEnvio(null)
    try {
      await servicos.planos.enviarParaValidacao(planoId)
      setAviso('Plano enviado para a coordenação validar.')
      recarregar()
    } catch (e) {
      setFalhaNoEnvio((e as Error).message ?? 'Não foi possível enviar agora.')
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

  const semPlano = estado.tipo === 'erro' && estado.erro instanceof ErroServico
    && estado.erro.codigo === 'NAO_ENCONTRADO'
  const negado = estado.tipo === 'erro' && estado.erro instanceof ErroServico
    && estado.erro.codigo === 'ACESSO_NEGADO'

  return (
    <Tela area="cli" caminho={['Área clínica', PACIENTES, doPaciente(id, nomeDoPaciente), 'Plano Terapêutico Individual']}>
      {estado.tipo === 'carregando' && (
        <>
          <Titulo>Plano Terapêutico Individual</Titulo>
          <EstadoCarregando forma="cartoes" quantidade={2} rotulo="Carregando o plano terapêutico" />
        </>
      )}

      {estado.tipo === 'erro' && (
        <>
          <Titulo>Plano Terapêutico Individual</Titulo>
          {semPlano ? (
            <>
              <CriarPlano pacienteId={id} aoCriar={() => { setAviso('Plano criado em rascunho. Agora, os objetivos.'); recarregar() }} />
              <p>
                <Link to={`/app/clinica/pacientes/${id}`} className="font-bold text-cli-ink underline">
                  Voltar para a ficha
                </Link>
              </p>
            </>
          ) : (
            <EstadoErro
              erro={estado.erro}
              oQue="o plano terapêutico"
              titulo={negado ? 'Este plano não é do seu alcance' : undefined}
              texto={negado
                ? 'O plano é de um paciente que você não acompanha. Se precisar consultá-lo, fale com a coordenação da clínica.'
                : undefined}
              aoTentarDeNovo={negado ? undefined : recarregar}
            />
          )}
        </>
      )}

      {estado.tipo === 'pronto' && (() => {
        const plano = estado.plano
        const s = SITUACAO[plano.status]
        const podeEnviar = plano.status === 'RASCUNHO' || plano.status === 'DEVOLVIDO'
        const editavel = planoEditavel(plano.status)
        return (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <Titulo sub={`Início em ${emDataCivil(plano.dataInicio)} · próxima revisão em ${emDataCivil(plano.dataRevisao)} · ${plano.objetivos.length} ${plano.objetivos.length === 1 ? 'objetivo' : 'objetivos'}`}>
                Plano Terapêutico Individual
              </Titulo>
              <div className="flex flex-wrap items-center gap-2">
                <Etiqueta tom={s.tom} simbolo={s.simbolo}>{s.rotulo}</Etiqueta>
                {editavel && !editandoDatas && (
                  <Botao id="btn-editar-datas" area="cli" variante="secundaria" onClick={() => { setAviso(null); setEditandoDatas(true) }}>
                    Editar as datas
                  </Botao>
                )}
                {/* Uma alternancia para a tela inteira, nao um botao por objetivo. */}
                <Botao area="cli" variante="secundaria" aria-pressed={acessivel}
                  onClick={() => setAcessivel((v) => !v)}>
                  {acessivel ? 'Ver redação técnica' : 'Ver redação acessível'}
                </Botao>
              </div>
            </div>

            {editavel && editandoDatas && (
              <EditarDatas
                plano={plano}
                aoSalvar={(editado) => {
                  trocarPlano(editado)
                  setEditandoDatas(false)
                  setAviso('Datas do plano salvas. A versão anterior fica no registro de acessos.')
                  devolverFoco('btn-editar-datas')
                }}
                aoCancelar={() => { setEditandoDatas(false); devolverFoco('btn-editar-datas') }}
              />
            )}

            {/* O retorno da coordenacao vem ANTES dos objetivos: no rodape, o
                terapeuta reenvia sem corrigir. */}
            {plano.status === 'DEVOLVIDO' && plano.observacaoValidacao && (
              <Aviso tom="at" titulo="A coordenação devolveu este plano">
                <p className="text-[15px] text-tinta">{plano.observacaoValidacao}</p>
              </Aviso>
            )}

            <p className="max-w-[65ch] text-sm text-tinta2">
              O mesmo objetivo tem duas redações: a <b>técnica</b>, usada pela equipe, e a{' '}
              <b>acessível</b>, que é a única que a família e a escola enxergam.{' '}
              <Etiqueta tom={acessivel ? 'ok' : 'neutro'} simbolo={acessivel ? '✓' : '●'}>
                Exibindo a redação {acessivel ? 'acessível' : 'técnica'}
              </Etiqueta>
            </p>

            <div aria-live="polite">
              {aviso && <Aviso tom="ok" titulo="Pronto">{aviso}</Aviso>}
            </div>

            {porDominio(plano.objetivos).map(([dominio, objetivos]) => (
              <section key={dominio} aria-labelledby={`d-${dominio}`} className="flex flex-col gap-3">
                <h2 id={`d-${dominio}`} className="text-lg font-bold">{dominio}</h2>
                <ul className="flex flex-col gap-3">
                  {objetivos.map((o) => {
                    const st = STATUS_OBJETIVO[o.status]
                    return (
                      <li key={o.id}>
                        <Cartao>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <h3 className="text-base font-bold">
                              {acessivel ? 'Como a família e a escola leem' : 'Redação técnica'}
                            </h3>
                            <Etiqueta tom={st.tom} simbolo={st.simbolo}>{st.rotulo}</Etiqueta>
                          </div>
                          <p className="texto-corrido my-2.5">
                            {acessivel ? o.descricaoAcessivel : o.descricaoTecnica}
                          </p>
                          <Medidor valor={o.percentualAtual} area="cli" rotulo={`Domínio de ${dominio}`} />
                          <p className="mt-2 text-sm text-tinta2">
                            Critério: {o.criterio.percentualMinimo}% em {o.criterio.sessoesConsecutivas}{' '}
                            {o.criterio.sessoesConsecutivas === 1 ? 'sessão consecutiva' : 'sessões consecutivas'}
                          </p>
                          {editavel && editandoObjetivo !== o.id && (
                            <p className="mt-2">
                              <Botao id={`btn-editar-${o.id}`} area="cli" variante="secundaria"
                                onClick={() => { setAviso(null); setEditandoObjetivo(o.id) }}>
                                Editar o objetivo
                              </Botao>
                            </p>
                          )}
                          {editavel && editandoObjetivo === o.id && (
                            <EditarObjetivo
                              objetivo={o}
                              aoSalvar={(editado) => {
                                trocarObjetivo(editado)
                                setEditandoObjetivo(null)
                                setAviso('Objetivo salvo. A versão anterior fica no registro de acessos.')
                                devolverFoco(`btn-editar-${o.id}`)
                              }}
                              aoCancelar={() => { setEditandoObjetivo(null); devolverFoco(`btn-editar-${o.id}`) }}
                            />
                          )}
                          <CartoesDoObjetivo objetivoId={o.id} />
                        </Cartao>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}

            {/* Item 10: objetivo novo so em rascunho ou devolvido, como no servidor.
                Vigente ou na fila, o plano fica como esta; os cartoes continuam. */}
            {editavel && (
            <section aria-labelledby="h-novo" className="flex flex-col gap-3">
              <h2 id="h-novo" className="text-lg font-bold">Adicionar objetivo</h2>

              {!formularioAberto ? (
                <p>
                  <Botao area="cli" onClick={() => setFormularioAberto(true)}>Adicionar objetivo</Botao>
                </p>
              ) : (
                <Cartao>
                  <form className="flex flex-col gap-4" onSubmit={(e) => void adicionar(e, plano.id)} noValidate>
                    <div role="alert" aria-live="assertive">
                      {erros.geral && (
                        <p className="rounded-xl border border-linha border-l-4 border-l-cr bg-cr-sup p-3 font-bold text-cr">
                          <span aria-hidden="true">▲ </span>{erros.geral}
                        </p>
                      )}
                    </div>

                    <Campo id="dominio" rotulo="Domínio" dica="Comunicação funcional, regulação sensorial, autocuidado." className="max-w-2xl">
                      <input id="dominio" type="text" className={campo} value={novo.dominio}
                        onChange={(e) => setNovo({ ...novo, dominio: e.target.value })}
                        {...atributosDeErro('dominio')} />
                      <Erro chave="dominio" />
                    </Campo>

                    {/* Item 11: em tela larga, as duas redacoes lado a lado, para comparar. */}
                    <div className="grid gap-4 [&>*]:min-w-0 xl:grid-cols-2">
                    <Campo id="descricaoTecnica" rotulo="Descrição técnica" dica="Para a equipe: comportamento, condição e medida.">
                      <textarea id="descricaoTecnica" rows={3} className={area} value={novo.descricaoTecnica}
                        onChange={(e) => setNovo({ ...novo, descricaoTecnica: e.target.value })}
                        {...atributosDeErro('descricaoTecnica')} />
                      <Erro chave="descricaoTecnica" />
                    </Campo>

                    <Campo
                      id="descricaoAcessivel"
                      rotulo="Descrição acessível"
                      dica="Em linguagem cotidiana. É esta que a família e a escola leem."
                    >
                      <textarea id="descricaoAcessivel" rows={3} className={area} value={novo.descricaoAcessivel}
                        onChange={(e) => setNovo({ ...novo, descricaoAcessivel: e.target.value })}
                        {...atributosDeErro('descricaoAcessivel')} />
                      <Erro chave="descricaoAcessivel" />
                    </Campo>
                    </div>

                    <fieldset className="rounded-lg border border-linha p-4">
                      <legend className="px-1.5 font-bold">Critério de domínio</legend>
                      <div className="grid max-w-xl gap-3 sm:grid-cols-2">
                        <Campo id="percentualMinimo" rotulo="Percentual mínimo">
                          <input id="percentualMinimo" type="number" min={1} max={100} className={campo}
                            value={novo.percentualMinimo}
                            onChange={(e) => setNovo({ ...novo, percentualMinimo: e.target.value })}
                            {...atributosDeErro('percentualMinimo')} />
                          <Erro chave="percentualMinimo" />
                        </Campo>
                        <Campo id="sessoesConsecutivas" rotulo="Sessões consecutivas">
                          <input id="sessoesConsecutivas" type="number" min={1} className={campo}
                            value={novo.sessoesConsecutivas}
                            onChange={(e) => setNovo({ ...novo, sessoesConsecutivas: e.target.value })}
                            {...atributosDeErro('sessoesConsecutivas')} />
                          <Erro chave="sessoesConsecutivas" />
                        </Campo>
                      </div>
                    </fieldset>

                    <div className="flex flex-wrap gap-2">
                      <Botao area="cli" type="submit" disabled={salvando}>
                        {salvando ? 'Salvando…' : 'Salvar objetivo'}
                      </Botao>
                      <Botao area="cli" variante="secundaria" onClick={() => { setFormularioAberto(false); setErros({}) }}>
                        Cancelar
                      </Botao>
                    </div>
                  </form>
                </Cartao>
              )}
            </section>
            )}

            {podeEnviar && (
              <section aria-labelledby="h-validacao" className="flex flex-col gap-2">
                <h2 id="h-validacao" className="text-lg font-bold">Enviar para validação</h2>
                <p className="max-w-[65ch] text-sm text-tinta2">
                  A coordenação confere os objetivos e o critério de cada um. Se devolver, a
                  observação aparece no topo desta tela.
                </p>
                <div role="alert">
                  {falhaNoEnvio && <Aviso tom="cr" titulo="Não foi possível enviar">{falhaNoEnvio}</Aviso>}
                </div>
                <p><Botao area="cli" onClick={() => void enviarParaValidacao(plano.id)}>Enviar para validação</Botao></p>
              </section>
            )}
          </>
        )
      })()}
    </Tela>
  )
}
