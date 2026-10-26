import { Fragment, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FUSO_DA_INSTANCIA, diaCivilEm, emDataCivil } from '@sinctea/compartilhado/dominio/datas'
import { NOME_DO_CAMPO, camposAnteriores } from '@sinctea/compartilhado/dominio/auditoria'
import { Tela } from '../LayoutApp'
import { NOME_DO_PERFIL } from '../perfis'
import { Campo } from '../../ui/Campo'
import { Cartao } from '../../ui/Cartao'
import { Etiqueta } from '../../ui/Etiqueta'
import { EstadoCarregando } from '../../ui/EstadoCarregando'
import { EstadoErro } from '../../ui/EstadoErro'
import { EstadoVazio } from '../../ui/EstadoVazio'
import { Paginacao } from '../../ui/Paginacao'
import { Tabela, type Coluna } from '../../ui/Tabela'
import { Titulo } from '../../ui/Titulo'
import { servicos, type AcaoAuditoria, type Pagina, type Perfil, type RegistroAdministrativo } from '../../servicos'

/**
 * Tela 25 · Trilha administrativa · /app/admin/trilha (UC19, com o administrador como segundo ator; item 13)
 *
 * O que aconteceu nas contas, nos links de acesso, nas escolas e na propria
 * trilha. O administrador nunca alcanca dado clinico (regra 3): quem recorta e
 * o servidor, que so devolve registro sem paciente e de uma entidade da lista
 * fechada (ENTIDADES_ADMINISTRATIVAS). O IP nao vem. Sem editar, sem excluir e
 * sem exportar. Ler esta tela tambem entra na trilha. A escola cadastrada por
 * um responsavel aparece sem o nome dele (item 13b).
 */

const ACOES: Record<AcaoAuditoria, { rotulo: string; tom: 'ok' | 'at' | 'cr' | 'neutro'; simbolo: string }> = {
  CONCESSAO_ACESSO: { rotulo: 'Concessão de acesso', tom: 'ok', simbolo: '✓' },
  REVOGACAO_ACESSO: { rotulo: 'Revogação de acesso', tom: 'at', simbolo: '▲' },
  LEITURA_AUTORIZADA: { rotulo: 'Leitura', tom: 'neutro', simbolo: '○' },
  ACESSO_NEGADO: { rotulo: 'Tentativa negada', tom: 'cr', simbolo: '✕' },
  CRIACAO: { rotulo: 'Criação', tom: 'neutro', simbolo: '+' },
  ALTERACAO: { rotulo: 'Alteração', tom: 'neutro', simbolo: '±' },
}

const ENTIDADES: Record<string, string> = {
  Usuario: 'Conta', Profissional: 'Profissional', Escola: 'Escola', RegistroAuditoria: 'Trilha',
}

/** Os perfis de antes, com nome de gente; o resto, como o dominio le. */
const comoLer = (campo: string, valor: unknown) => (campo === 'perfis' && Array.isArray(valor)
  ? valor.map((p) => NOME_DO_PERFIL[p as Perfil] ?? String(p)).join(', ')
  : undefined)

/** Data e hora de Manaus, a da instancia, qualquer que seja o fuso de quem le. */
const quando = (iso: string) => {
  const instante = new Date(iso)
  const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO_DA_INSTANCIA }).format(instante)
  return `${emDataCivil(diaCivilEm(instante))} ${hora}`
}

const colunas: Coluna<RegistroAdministrativo>[] = [
  { id: 'quando', titulo: 'Data e hora', celula: (r) => <span className="tabular-nums">{quando(r.ocorridoEm)}</span> },
  {
    id: 'quem', titulo: 'Quem agiu',
    // Fotografia do momento: o nome e o perfil gravados no registro. Sem o
    // nome e com o perfil, so o perfil: a escola cadastrada pela familia.
    celula: (r) => r.usuarioNome
      ? <>{r.usuarioNome}<span className="block text-sm text-tinta2">{r.perfil ? NOME_DO_PERFIL[r.perfil] : 'Sem perfil'}</span></>
      : r.perfil === 'RESPONSAVEL' ? 'Um responsável'
        : <span className="text-tinta2">{r.perfil ? NOME_DO_PERFIL[r.perfil] : 'Sem sessão'}</span>,
  },
  {
    id: 'acao', titulo: 'Ação',
    celula: (r) => <Etiqueta tom={ACOES[r.acao].tom} simbolo={ACOES[r.acao].simbolo}>{ACOES[r.acao].rotulo}</Etiqueta>,
  },
  {
    id: 'detalhe', titulo: 'Entidade e detalhe', quebrar: true,
    celula: (r) => (
      <>
        <b>{ENTIDADES[r.entidade] ?? r.entidade}</b>
        <span className="block max-w-[65ch]">{r.detalhe}</span>
      </>
    ),
  },
  {
    id: 'antes', titulo: 'O que mudou', quebrar: true,
    celula: (r) => r.acao === 'ALTERACAO' && r.valorAnterior ? (
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {camposAnteriores(r.valorAnterior, comoLer).map(([campo, valor]) => (
          <Fragment key={campo}>
            <dt className="font-bold">{NOME_DO_CAMPO[campo] ?? campo}, antes</dt>
            <dd>{valor}</dd>
          </Fragment>
        ))}
      </dl>
    ) : <span className="text-tinta2">—</span>,
  },
]

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'pronto'; dados: Pagina<RegistroAdministrativo>; atualizando: boolean }

export function TrilhaAdministrativa() {
  const [params, setParams] = useSearchParams()
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)
  const [pessoas, setPessoas] = useState<Array<{ id: string; nome: string }>>([])

  const desde = params.get('desde') ?? ''
  const ate = params.get('ate') ?? ''
  const usuarioId = params.get('pessoa') ?? ''
  const acao = params.get('acao') ?? ''
  const pagina = Math.max(1, Number(params.get('pagina') ?? 1) || 1)
  const temFiltro = Boolean(desde || ate || usuarioId || acao)

  const atualizar = (mudancas: Record<string, string | null>) => {
    const proximos = new URLSearchParams(params)
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor) proximos.set(chave, valor)
      else proximos.delete(chave)
    }
    // Trocar de filtro volta para a primeira pagina.
    if (!('pagina' in mudancas)) proximos.delete('pagina')
    setParams(proximos)
  }

  useEffect(() => {
    let ativo = true
    setEstado((e) => (e.tipo === 'pronto' ? { ...e, atualizando: true } : { tipo: 'carregando' }))
    servicos.auditoria.listarAdministrativa({
      desde: desde || undefined, ate: ate || undefined, usuarioId: usuarioId || undefined,
      acao: (acao as AcaoAuditoria) || undefined, pagina,
    })
      .then((dados) => { if (ativo) setEstado({ tipo: 'pronto', dados, atualizando: false }) })
      .catch((erro) => { if (ativo) setEstado({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [desde, ate, usuarioId, acao, pagina, tentativa])

  // As pessoas do filtro sao as contas: o administrador ja as le na tela 14.
  useEffect(() => {
    let ativo = true
    servicos.usuarios.listar({ porPagina: 100 })
      .then((p) => { if (ativo) setPessoas(p.itens.map((u) => ({ id: u.id, nome: u.nome }))) })
      .catch(() => { if (ativo) setPessoas([]) })
    return () => { ativo = false }
  }, [])

  const campo = 'min-h-11 w-full min-w-0 rounded-lg border-2 border-linha bg-sup px-3 py-2.5 text-tinta'

  return (
    <Tela area="cli" caminho={['Administração', 'Trilha administrativa']}>
      <Titulo sub="O que aconteceu nas contas, nos links de acesso, nas escolas e na própria trilha. Nenhum registro de paciente aparece aqui.">
        Trilha administrativa
      </Titulo>

      <Cartao>
        <h2 className="sr-only">Filtros</h2>
        <div className="grid gap-3 [&>*]:min-w-0 sm:grid-cols-2 xl:grid-cols-4">
          <Campo id="trilha-desde" rotulo="Desde">
            <input id="trilha-desde" type="date" className={campo} value={desde} max={ate || undefined}
              onChange={(e) => atualizar({ desde: e.target.value || null })} />
          </Campo>
          <Campo id="trilha-ate" rotulo="Até">
            <input id="trilha-ate" type="date" className={campo} value={ate} min={desde || undefined}
              onChange={(e) => atualizar({ ate: e.target.value || null })} />
          </Campo>
          <Campo id="trilha-pessoa" rotulo="Pessoa">
            <select id="trilha-pessoa" className={campo} value={usuarioId}
              onChange={(e) => atualizar({ pessoa: e.target.value || null })}>
              <option value="">Todas</option>
              {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </Campo>
          <Campo id="trilha-acao" rotulo="Ação">
            <select id="trilha-acao" className={campo} value={acao}
              onChange={(e) => atualizar({ acao: e.target.value || null })}>
              <option value="">Todas</option>
              {(Object.keys(ACOES) as AcaoAuditoria[]).map((a) => <option key={a} value={a}>{ACOES[a].rotulo}</option>)}
            </select>
          </Campo>
        </div>
      </Cartao>

      {estado.tipo === 'carregando' && <EstadoCarregando forma="tabela" colunas={5} rotulo="Carregando a trilha administrativa" />}

      {estado.tipo === 'erro' && (
        <EstadoErro erro={estado.erro} oQue="a trilha administrativa" aoTentarDeNovo={() => setTentativa((t) => t + 1)} />
      )}

      {estado.tipo === 'pronto' && (estado.dados.total === 0 ? (
        <EstadoVazio
          titulo={temFiltro ? 'Nenhum registro neste filtro' : 'Nenhum registro ainda'}
          explicacao={temFiltro
            ? 'Nenhum registro combina com esse recorte. Mude o período, a pessoa ou a ação, ou limpe os filtros.'
            : 'Os registros aparecem aqui conforme as contas, os links e as escolas mudam.'}
          acao={temFiltro
            ? { rotulo: 'Limpar os filtros', aoAcionar: () => setParams(new URLSearchParams()) }
            : { rotulo: 'Atualizar', aoAcionar: () => setTentativa((t) => t + 1) }}
        />
      ) : (
        <>
          <Tabela
            legenda={`Trilha administrativa — ${estado.dados.total} ${estado.dados.total === 1 ? 'registro' : 'registros'}, do mais recente para o mais antigo`}
            colunas={colunas}
            linhas={estado.dados.itens}
            chave={(r) => r.id}
            colunaCabecalho={null}
            atualizando={estado.atualizando}
          />
          <Paginacao
            pagina={estado.dados.pagina}
            porPagina={estado.dados.porPagina}
            total={estado.dados.total}
            aoMudar={(p) => atualizar({ pagina: String(p) })}
            rotulo="Páginas da trilha administrativa"
            nomeItens={{ singular: 'registro', plural: 'registros' }}
          />
        </>
      ))}
    </Tela>
  )
}
