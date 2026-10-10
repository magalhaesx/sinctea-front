import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Tela } from '../LayoutApp'
import { Aviso } from '../../ui/Aviso'
import { Botao } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { Cartao } from '../../ui/Cartao'
import { Etiqueta } from '../../ui/Etiqueta'
import { Titulo } from '../../ui/Titulo'
import { EstadoCarregando } from '../../ui/EstadoCarregando'
import { EstadoErro } from '../../ui/EstadoErro'
import { CartaoAtividadeFamilia } from '../../componentes/CartaoAtividadeFamilia'
import { emData } from '../../dominio/datas'
import {
  ErroServico, servicos, type AtividadeCasa, type Desempenho, type ExecucaoAtividadeCasa,
} from '../../servicos'

/**
 * Tela 16 · Atividade em casa · /app/familia/atividades/:id (UC14)
 *
 * O cartao da atividade e o MESMO componente que o terapeuta ve ao prescrever
 * (tela 9): se fossem dois, o que ele confere nao seria o que a familia le.
 *
 * "Nao quis" nao e falha: a familia tentou, e isso e informacao clinica. As
 * tres opcoes tem o mesmo peso visual, e nenhuma delas e tratada como erro.
 */

const OPCOES: { valor: Desempenho; rotulo: string }[] = [
  { valor: 'SOZINHO', rotulo: 'Fez sozinho' },
  { valor: 'COM_AJUDA', rotulo: 'Fez com a minha ajuda' },
  { valor: 'NAO_QUIS', rotulo: 'Não quis fazer hoje' },
]

const NOME_DO_DESEMPENHO: Record<Desempenho, string> = {
  SOZINHO: 'Fez sozinho', COM_AJUDA: 'Fez com ajuda', NAO_QUIS: 'Não quis fazer',
}

/** "12 de setembro" — a data como se fala, sem barra nem ano. */
const porExtenso = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
    .toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'pronto'; atividade: AtividadeCasa; execucoes: ExecucaoAtividadeCasa[] }

export function Atividade() {
  const { id = '' } = useParams()
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)
  const [desempenho, setDesempenho] = useState<Desempenho | null>(null)
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState<string | null>(null)

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
    const carregar = async () => {
      const atividade = await servicos.atividades.obter(id)
      const execucoes = await servicos.atividades.listarExecucoes(id, { porPagina: 10 })
      return { atividade, execucoes: execucoes.itens }
    }
    carregar()
      .then(({ atividade, execucoes }) => {
        if (ativo) setEstado({ tipo: 'pronto', atividade, execucoes })
      })
      .catch((e) => { if (ativo) setEstado({ tipo: 'erro', erro: e }) })
    return () => { ativo = false }
  }, [id, tentativa])

  const salvar = async () => {
    if (!desempenho) {
      setErro('Falta escolher como foi hoje. Toque em uma das três opções acima.')
      setSalvo(null)
      return
    }
    setErro(null)
    setSalvando(true)
    try {
      await servicos.atividades.registrarExecucao(id, desempenho, observacao)
      setDesempenho(null)
      setObservacao('')
      setSalvo('A terapeuta vai ver isso antes da próxima sessão. Obrigado por registrar.')
      focarAviso.current = true
      setTentativa((t) => t + 1)
    } catch (e) {
      setErro(e instanceof ErroServico ? e.message : 'Não foi possível salvar agora. Tente de novo em alguns segundos.')
    } finally {
      setSalvando(false)
    }
  }

  const naoEncontrada = estado.tipo === 'erro' && estado.erro instanceof ErroServico
    && estado.erro.codigo === 'NAO_ENCONTRADO'

  return (
    <Tela
      area="fam"
      nome="Atividade de casa"
      papel={estado.tipo === 'pronto'
        ? `Sugerida pela equipe em ${porExtenso(estado.atividade.prescritaEm)}`
        : undefined}
      caminho={['Início', estado.tipo === 'pronto' ? estado.atividade.titulo : 'Atividade']}
      estreito
    >
      {/* Fora do bloco "pronto": salvar recarrega a tela, e a regiao viva
          precisa sobreviver a recarga que o proprio salvar provocou — senao o
          foco cai no corpo da pagina e o recado nunca e anunciado. */}
      <div ref={regiaoViva} tabIndex={-1} aria-live="polite">
        {salvo && <Aviso tom="ok" titulo="Registro salvo">{salvo}</Aviso>}
      </div>

      {estado.tipo === 'carregando' && (
        <EstadoCarregando forma="cartoes" quantidade={2} rotulo="Carregando a atividade" />
      )}

      {estado.tipo === 'erro' && (
        <>
          <EstadoErro
            erro={estado.erro}
            oQue="esta atividade"
            area="fam"
            titulo={naoEncontrada ? 'Não encontramos esta atividade' : undefined}
            texto={naoEncontrada
              ? 'O endereço pode estar incompleto, ou a equipe encerrou esta atividade.'
              : undefined}
            aoTentarDeNovo={naoEncontrada ? undefined : () => setTentativa((t) => t + 1)}
          />
          <p>
            <Link to="/app/familia" className="font-bold text-fam-ink underline">
              Voltar para o início
            </Link>
          </p>
        </>
      )}

      {estado.tipo === 'pronto' && (
        <>
          <Titulo>{estado.atividade.titulo}</Titulo>

          {/* O mesmo cartao da tela 9, sem adaptador: AtividadeCasa ja tem a
              forma que ele espera. */}
          <CartaoAtividadeFamilia atividade={estado.atividade} />

          {!estado.atividade.ativa && (
            <Aviso tom="neutro" titulo="Esta atividade foi encerrada">
              A equipe encerrou esta atividade. O que você registrou continua guardado.
            </Aviso>
          )}

          {estado.atividade.ativa && (
            <Cartao>
              <fieldset className="border-0 p-0">
                <legend className="text-base font-bold">Como foi hoje?</legend>
                <div className="mt-3 flex flex-col gap-2.5">
                  {OPCOES.map((o) => (
                    <button
                      key={o.valor}
                      type="button"
                      onClick={() => { setDesempenho(o.valor); setErro(null) }}
                      aria-pressed={desempenho === o.valor}
                      className={`min-h-14 cursor-pointer rounded-lg border-2 px-4 py-4 text-left font-bold ${
                        desempenho === o.valor ? 'border-fam bg-fam-sup' : 'border-linha bg-sup hover:border-fam'
                      }`}
                    >
                      {desempenho === o.valor && <span aria-hidden="true">✓ </span>}
                      {o.rotulo}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="mt-4">
                <Campo id="obs" rotulo="Quer contar alguma coisa? (opcional)" dica="Escreva com as suas palavras. Não precisa usar termo técnico.">
                  <textarea
                    id="obs"
                    rows={3}
                    aria-describedby="obs-dica"
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    placeholder="Ex.: ele tapou os ouvidos antes de apontar o cartão"
                    className="min-h-11 w-full rounded-lg border-2 border-linha bg-sup px-3 py-2.5 text-tinta"
                  />
                </Campo>
              </div>

              {erro && <p className="mt-3 font-bold text-cr" role="alert">{erro}</p>}

              <div className="mt-4">
                <Botao area="fam" className="w-full" disabled={salvando} onClick={() => void salvar()}>
                  {salvando ? 'Salvando…' : 'Salvar'}
                </Botao>
              </div>
            </Cartao>
          )}

          <section aria-labelledby="h-historico" className="flex flex-col gap-3">
            <h2 id="h-historico" className="text-lg font-bold">O que você já registrou</h2>
            {estado.execucoes.length === 0 ? (
              <Cartao>
                <p className="text-tinta2">
                  Nada registrado ainda. O primeiro registro aparece aqui assim que você salvar.
                </p>
              </Cartao>
            ) : (
              <ul className="flex flex-col gap-2">
                {estado.execucoes.map((e) => (
                  <li key={e.id} className="rounded-lg border border-linha bg-sup px-3 py-2.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <b>{emData(e.dataRealizacao)}</b>
                      {/* "Nao quis" tem o mesmo peso das outras: e informacao. */}
                      <Etiqueta simbolo="○">{NOME_DO_DESEMPENHO[e.desempenho]}</Etiqueta>
                    </span>
                    {e.observacao && <p className="mt-1 text-sm text-tinta2">“{e.observacao}”</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </Tela>
  )
}
