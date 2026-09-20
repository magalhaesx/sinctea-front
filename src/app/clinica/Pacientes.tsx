import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Tela } from '../LayoutApp'
import { BotaoLink } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { Etiqueta } from '../../ui/Etiqueta'
import { Titulo } from '../../ui/Titulo'
import { EstadoCarregando } from '../../ui/EstadoCarregando'
import { EstadoErro } from '../../ui/EstadoErro'
import { EstadoVazio } from '../../ui/EstadoVazio'
import { Paginacao } from '../../ui/Paginacao'
import { Tabela, type Coluna } from '../../ui/Tabela'
import { usarSessao } from '../../contexto/Sessao'
import { descricaoNivelSuporte } from '../../dominio/regras'
import {
  servicos, type NivelSuporte, type Pagina, type PacienteResumo, type Profissional,
  type SituacaoPlano,
} from '../../servicos'

/**
 * Tela 4 · Lista de pacientes · /app/clinica/pacientes (UC01)
 *
 * Quem ve o que e decidido no servico: o terapeuta alcanca os pacientes cuja
 * equipe integra, o coordenador alcanca a clinica inteira. A tela apenas
 * declara o recorte em palavras.
 *
 * Todo filtro vive na query string: o botao voltar funciona, o link pode ser
 * enviado a outra pessoa e recarregar a pagina nao perde o que foi filtrado.
 */

const POR_PAGINA = 10
const ESPERA_BUSCA_MS = 300

const SITUACAO: Record<SituacaoPlano, { rotulo: string; tom: 'ok' | 'at' | 'neutro'; simbolo: string }> = {
  VIGENTE: { rotulo: 'Vigente', tom: 'ok', simbolo: '✓' },
  DEVOLVIDO: { rotulo: 'Devolvido', tom: 'at', simbolo: '▲' },
  SEM_PLANO: { rotulo: 'Sem plano', tom: 'at', simbolo: '▲' },
  RASCUNHO: { rotulo: 'Rascunho', tom: 'neutro', simbolo: '○' },
  AGUARDANDO_VALIDACAO: { rotulo: 'Aguardando validação', tom: 'neutro', simbolo: '○' },
}

const NIVEIS: NivelSuporte[] = [1, 2, 3]

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'pronto'; dados: Pagina<PacienteResumo>; atualizando: boolean }

const colunas: Coluna<PacienteResumo>[] = [
  {
    id: 'nome', titulo: 'Paciente',
    celula: (p) => (
      <Link to={`/app/clinica/pacientes/${p.id}`} className="text-cli-ink underline">{p.nome}</Link>
    ),
  },
  { id: 'idade', titulo: 'Idade', numerica: true, celula: (p) => `${p.idade} anos` },
  {
    // Nunca so o numero: a palavra vem junto (tela 5, DSM-5-TR).
    id: 'nivel', titulo: 'Nível de suporte',
    celula: (p) => descricaoNivelSuporte(p.nivelSuporte),
  },
  { id: 'prof', titulo: 'Profissional responsável', celula: (p) => p.profissionalResponsavel.nome },
  {
    id: 'plano', titulo: 'Situação do plano',
    celula: (p) => {
      const s = SITUACAO[p.situacaoPlano]
      return <Etiqueta tom={s.tom} simbolo={s.simbolo}>{s.rotulo}</Etiqueta>
    },
  },
  {
    id: 'ultima', titulo: 'Última sessão', numerica: true,
    celula: (p) => p.ultimaSessaoEm
      ? new Date(p.ultimaSessaoEm).toLocaleDateString('pt-BR')
      : <><span aria-hidden="true">—</span><span className="sr-only">Nenhuma sessão registrada</span></>,
  },
]

export function Pacientes() {
  const { perfilAtivo } = usarSessao()
  const [params, setParams] = useSearchParams()
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)
  const [profissionais, setProfissionais] = useState<Profissional[]>([])
  const [totalDoRecorte, setTotalDoRecorte] = useState<number | null>(null)

  const busca = params.get('busca') ?? ''
  const profissionalId = params.get('profissional') ?? ''
  const nivel = params.get('nivel') ?? ''
  const plano = params.get('plano') ?? ''
  const pagina = Math.max(1, Number(params.get('pagina') ?? 1) || 1)
  const temFiltro = Boolean(busca || profissionalId || nivel || plano)

  const [texto, setTexto] = useState(busca)
  // Voltar e avancar mudam a URL: o campo de busca acompanha.
  useEffect(() => { setTexto(busca) }, [busca])

  /**
   * Toda mudanca de filtro volta para a pagina 1: sem isso a pessoa cai numa
   * pagina que nao existe mais e ve lista vazia sem entender por que.
   */
  const atualizar = (mudancas: Record<string, string | null>, substituir = false) => {
    const proximos = new URLSearchParams(params)
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor) proximos.set(chave, valor)
      else proximos.delete(chave)
    }
    if (!('pagina' in mudancas)) proximos.delete('pagina')
    setParams(proximos, { replace: substituir })
  }

  // A busca so dispara 300 ms depois da ultima tecla, e substitui o historico
  // para nao criar uma entrada de voltar por caractere digitado.
  useEffect(() => {
    if (texto === busca) return
    const id = setTimeout(() => atualizar({ busca: texto || null }, true), ESPERA_BUSCA_MS)
    return () => clearTimeout(id)
  }, [texto, busca])

  useEffect(() => {
    let ativo = true
    setEstado((e) => (e.tipo === 'pronto' ? { ...e, atualizando: true } : { tipo: 'carregando' }))
    servicos.pacientes.listar({
      busca: busca || undefined,
      profissionalId: profissionalId || undefined,
      nivelSuporte: nivel ? (Number(nivel) as NivelSuporte) : undefined,
      situacaoPlano: (plano as SituacaoPlano) || undefined,
      pagina,
      porPagina: POR_PAGINA,
    })
      .then((dados) => { if (ativo) setEstado({ tipo: 'pronto', dados, atualizando: false }) })
      .catch((erro) => { if (ativo) setEstado({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [busca, profissionalId, nivel, plano, pagina, tentativa])

  // O rotulo acima da tabela declara o RECORTE, que nao muda com o filtro.
  useEffect(() => {
    let ativo = true
    servicos.pacientes.listar({ porPagina: 1 })
      .then((p) => { if (ativo) setTotalDoRecorte(p.total) })
      .catch(() => { if (ativo) setTotalDoRecorte(null) })
    return () => { ativo = false }
  }, [perfilAtivo, tentativa])

  useEffect(() => {
    let ativo = true
    servicos.profissionais.listar({ porPagina: 100 })
      .then((p) => { if (ativo) setProfissionais(p.itens) })
      .catch(() => { if (ativo) setProfissionais([]) })
    return () => { ativo = false }
  }, [tentativa])

  const recorte = useMemo(() => {
    if (totalDoRecorte === null) return ''
    const plural = totalDoRecorte === 1 ? 'paciente' : 'pacientes'
    return perfilAtivo === 'COORDENADOR'
      ? `${totalDoRecorte} ${plural} na clínica.`
      : `Você acompanha ${totalDoRecorte} ${plural}.`
  }, [totalDoRecorte, perfilAtivo])

  const resultado = estado.tipo === 'pronto'
    ? estado.dados.total === 0
      ? 'Nenhum paciente encontrado.'
      : `${estado.dados.total} ${estado.dados.total === 1 ? 'paciente encontrado' : 'pacientes encontrados'}.`
    : ''

  const campo = 'min-h-11 w-full rounded-lg border-2 border-linha bg-sup px-3 py-2.5 text-tinta'
  const limparFiltros = () => setParams(new URLSearchParams())

  return (
    <Tela area="cli" caminho={['Área clínica', 'Pacientes']}>
      <Titulo sub="Busque, filtre e abra a ficha de quem você acompanha">Pacientes</Titulo>

      <section aria-labelledby="h-filtros" className="flex flex-col gap-3">
        <h2 id="h-filtros" className="sr-only">Filtros da lista</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo id="busca" rotulo="Buscar por nome">
            <input
              id="busca" type="search" className={campo} value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          </Campo>

          <Campo id="profissional" rotulo="Profissional responsável">
            <select id="profissional" className={campo} value={profissionalId}
              onChange={(e) => atualizar({ profissional: e.target.value || null })}>
              <option value="">Todos</option>
              {profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </Campo>

          <Campo id="nivel" rotulo="Nível de suporte">
            <select id="nivel" className={campo} value={nivel}
              onChange={(e) => atualizar({ nivel: e.target.value || null })}>
              <option value="">Todos</option>
              {NIVEIS.map((n) => <option key={n} value={n}>{descricaoNivelSuporte(n)}</option>)}
            </select>
          </Campo>

          <Campo id="plano" rotulo="Situação do plano">
            <select id="plano" className={campo} value={plano}
              onChange={(e) => atualizar({ plano: e.target.value || null })}>
              <option value="">Todas</option>
              {Object.entries(SITUACAO).map(([valor, s]) => (
                <option key={valor} value={valor}>{s.rotulo}</option>
              ))}
            </select>
          </Campo>
        </div>
      </section>

      {/* Quem usa leitor de tela precisa saber que a tabela mudou — WCAG 4.1.3. */}
      <p role="status" aria-live="polite" className="text-sm text-tinta2">{resultado}</p>

      {estado.tipo === 'carregando' && (
        <EstadoCarregando forma="tabela" colunas={6} linhas={6} rotulo="Carregando a lista de pacientes" />
      )}

      {estado.tipo === 'erro' && (
        <EstadoErro
          erro={estado.erro}
          oQue="a lista de pacientes"
          aoTentarDeNovo={() => setTentativa((t) => t + 1)}
        />
      )}

      {estado.tipo === 'pronto' && estado.dados.total === 0 && temFiltro && (
        <EstadoVazio
          titulo="Nenhum paciente encontrado"
          explicacao="Nenhum paciente do seu alcance combina com esses filtros. Confira a grafia do nome ou limpe os filtros para ver a lista inteira."
          acao={{ rotulo: 'Limpar os filtros', aoAcionar: limparFiltros }}
        />
      )}

      {estado.tipo === 'pronto' && estado.dados.total === 0 && !temFiltro && (
        <EstadoVazio
          titulo="Nenhum paciente cadastrado ainda"
          explicacao="Cadastre o primeiro para começar a montar o plano terapêutico e registrar as sessões."
          acao={<BotaoLink para="/app/clinica/pacientes/novo" area="cli">Cadastrar paciente</BotaoLink>}
        />
      )}

      {estado.tipo === 'pronto' && estado.dados.total > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[15px] font-bold">{recorte}</p>
            {/* Existe tabela: a chamada para cadastrar mora aqui. */}
            <BotaoLink para="/app/clinica/pacientes/novo" area="cli">Cadastrar paciente</BotaoLink>
          </div>

          <Tabela
            legenda={perfilAtivo === 'COORDENADOR' ? 'Pacientes da clínica' : 'Pacientes que você acompanha'}
            colunas={colunas}
            linhas={estado.dados.itens}
            chave={(p) => p.id}
            atualizando={estado.atualizando}
          />

          <Paginacao
            pagina={estado.dados.pagina}
            porPagina={estado.dados.porPagina}
            total={estado.dados.total}
            aoMudar={(p) => atualizar({ pagina: String(p) })}
            rotulo="Páginas da lista de pacientes"
            nomeItens={{ singular: 'paciente', plural: 'pacientes' }}
          />
        </>
      )}
    </Tela>
  )
}
