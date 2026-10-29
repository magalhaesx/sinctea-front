import { Fragment, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tela } from '../LayoutApp'
import { Aviso } from '../../ui/Aviso'
import { Botao } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { Etiqueta } from '../../ui/Etiqueta'
import { Titulo } from '../../ui/Titulo'
import { EstadoCarregando } from '../../ui/EstadoCarregando'
import { EstadoErro } from '../../ui/EstadoErro'
import { EstadoVazio } from '../../ui/EstadoVazio'
import { Paginacao } from '../../ui/Paginacao'
import { Tabela, type Coluna } from '../../ui/Tabela'
import { NOME_DO_PERFIL } from '../perfis'
import { diaCivilEm, emDataCivil, FUSO_DA_INSTANCIA } from '@sinctea/compartilhado/dominio/datas'
// A leitura do valorAnterior mora no dominio: a tela e o CSV exportado dizem
// a mesma coisa porque leem do mesmo lugar.
import {
  camposAnteriores, ENTIDADES_AUDITADAS, NOME_DA_ENTIDADE, NOME_DO_CAMPO, nomeDaEntidade, nomeDoArquivoDaAuditoria,
  POR_PAGINA_DA_AUDITORIA, validarFiltroAuditoria,
} from '@sinctea/compartilhado/dominio/auditoria'
import {
  ehIdentificador, servicos, type AcaoAuditoria, type DataCivil, type FiltroAuditoria, type OrigemAuditoria,
  type Pagina, type RegistroDaTrilha,
} from '../../servicos'
import { usarNomeDoPaciente } from '../clinica/caminho'
import { BuscaDePaciente } from './BuscaDePaciente'

/**
 * Tela 13 · Registro de auditoria · /app/coordenacao/auditoria (UC19)
 *
 * E a resposta ao artigo 37 da LGPD: quem tocou em que dado, quando, de que
 * origem — e tambem quem TENTOU e foi recusado, que e o terceiro momento da
 * regra 6 do CLAUDE.md.
 *
 * O registro e imutavel: nao ha botao de editar nem de excluir em lugar nenhum
 * desta tela, e o contrato tambem nao oferece nenhum dos dois.
 *
 * Usuario e perfil de cada linha sao a fotografia gravada no registro. Nao se
 * resolve nenhum dos dois consultando Usuario na leitura — se fosse assim, a
 * trilha mudaria quando alguem trocasse de nome ou de perfil.
 *
 * Todo filtro vive na query string, como na tela 4: o botao voltar funciona e o
 * recorte pode ser enviado a outra pessoa.
 *
 * Item 17: o periodo e em dias de Manaus, como na tela 25, e o filtro passa
 * por validarFiltroAuditoria antes de ir, a mesma conferencia do servidor. O
 * IP nao chega aqui. Cada consulta e cada exportacao entram na trilha.
 *
 * Item 17b: a entidade aparece por extenso (NOME_DA_ENTIDADE), e o endereco
 * guarda o nome tecnico. O paciente se escolhe por busca, e nao numa lista
 * que parava nos 100 primeiros.
 */

const ACOES: Record<AcaoAuditoria, { rotulo: string; tom: 'ok' | 'at' | 'cr' | 'neutro'; simbolo: string }> = {
  CONCESSAO_ACESSO: { rotulo: 'Concessão de acesso', tom: 'ok', simbolo: '✓' },
  REVOGACAO_ACESSO: { rotulo: 'Revogação de acesso', tom: 'at', simbolo: '▲' },
  LEITURA_AUTORIZADA: { rotulo: 'Leitura autorizada', tom: 'neutro', simbolo: '○' },
  ACESSO_NEGADO: { rotulo: 'Tentativa negada', tom: 'cr', simbolo: '✕' },
  CRIACAO: { rotulo: 'Criação', tom: 'neutro', simbolo: '+' },
  ALTERACAO: { rotulo: 'Alteração', tom: 'neutro', simbolo: '±' },
}

const ORIGENS: Record<OrigemAuditoria, string> = {
  CLINICA: 'Clínica', FAMILIA: 'Família', ESCOLA: 'Escola', SISTEMA: 'Sistema',
}

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'pronto'; dados: Pagina<RegistroDaTrilha>; atualizando: boolean }

/** Data e hora de Manaus, como o periodo do filtro, qualquer que seja o fuso de quem le. */
const quando = (iso: string) => {
  const instante = new Date(iso)
  const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO_DA_INSTANCIA }).format(instante)
  return `${emDataCivil(diaCivilEm(instante))} ${hora}`
}

const colunas: Coluna<RegistroDaTrilha>[] = [
  { id: 'quando', titulo: 'Data e hora', celula: (r) => <span className="tabular-nums">{quando(r.ocorridoEm)}</span> },
  {
    id: 'quem', titulo: 'Usuário',
    // Fotografia do momento: o nome gravado no registro, nao o nome de hoje.
    celula: (r) => r.usuarioNome ?? <span className="text-tinta2">Sem sessão</span>,
  },
  {
    id: 'perfil', titulo: 'Perfil',
    celula: (r) => r.perfil ? NOME_DO_PERFIL[r.perfil] : '—',
  },
  {
    id: 'acao', titulo: 'Ação',
    celula: (r) => {
      const a = ACOES[r.acao]
      return <Etiqueta tom={a.tom} simbolo={a.simbolo}>{a.rotulo}</Etiqueta>
    },
  },
  { id: 'entidade', titulo: 'Entidade', celula: (r) => nomeDaEntidade(r.entidade) },
  { id: 'origem', titulo: 'Origem', celula: (r) => ORIGENS[r.origem] },
  {
    id: 'detalhe', titulo: 'Detalhe', quebrar: true,
    celula: (r) => (
      <>
        {r.detalhe}
        {/* O que torna a promessa da tela 19 verificavel por quem coordena:
            a versao anterior, em campos, e nao em JSON cru. */}
        {r.valorAnterior && (
          <details className="mt-1">
            <summary className="min-h-11 cursor-pointer text-[15px] font-bold text-cli-ink underline">
              Ver o que havia antes
            </summary>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[15px]">
              {camposAnteriores(r.valorAnterior).map(([campo, valor]) => (
                <Fragment key={campo}>
                  <dt className="font-bold">{NOME_DO_CAMPO[campo] ?? campo}</dt>
                  <dd>{valor}</dd>
                </Fragment>
              ))}
            </dl>
          </details>
        )}
      </>
    ),
  },
]

export function Auditoria() {
  const [params, setParams] = useSearchParams()
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)
  const [usuarios, setUsuarios] = useState<Array<{ id: string; nome: string }>>([])
  const [exportando, setExportando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [erroExportacao, setErroExportacao] = useState<string | null>(null)

  const desde = params.get('desde') ?? ''
  const ate = params.get('ate') ?? ''
  const usuarioId = params.get('usuario') ?? ''
  const acao = params.get('acao') ?? ''
  const pacienteId = params.get('paciente') ?? ''
  const entidade = params.get('entidade') ?? ''
  const pagina = Math.max(1, Number(params.get('pagina') ?? 1) || 1)
  const nomeDoPaciente = usarNomeDoPaciente(pacienteId)
  const temFiltro = Boolean(desde || ate || usuarioId || acao || pacienteId || entidade)
  const soNegadas = acao === 'ACESSO_NEGADO'

  const atualizar = (mudancas: Record<string, string | null>) => {
    const proximos = new URLSearchParams(params)
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor) proximos.set(chave, valor)
      else proximos.delete(chave)
    }
    // Trocar de filtro volta para a primeira pagina: senao a pessoa cai numa
    // pagina que o novo recorte nao tem.
    if (!('pagina' in mudancas)) proximos.delete('pagina')
    setParams(proximos)
  }

  /** O periodo vai em dias de Manaus; o servico o le do comeco de "desde" ao fim de "ate". */
  const filtroDoServico = (comPaginacao: boolean): FiltroAuditoria => ({
    desde: (desde as DataCivil) || undefined,
    ate: (ate as DataCivil) || undefined,
    usuarioId: usuarioId || undefined,
    acao: (acao as AcaoAuditoria) || undefined,
    pacienteId: pacienteId || undefined,
    entidade: entidade || undefined,
    ...(comPaginacao ? { pagina, porPagina: POR_PAGINA_DA_AUDITORIA } : {}),
  })
  // A mesma conferencia do servidor, antes de pedir: um endereco com filtro
  // errado diz o que esta errado, e nao vai ao servidor.
  const errosDoFiltro = validarFiltroAuditoria(filtroDoServico(false), ehIdentificador)
  const filtroInvalido = Object.keys(errosDoFiltro).length > 0

  useEffect(() => {
    if (filtroInvalido) return
    let ativo = true
    setEstado((e) => (e.tipo === 'pronto' ? { ...e, atualizando: true } : { tipo: 'carregando' }))
    servicos.auditoria.listar(filtroDoServico(true))
      .then((dados) => { if (ativo) setEstado({ tipo: 'pronto', dados, atualizando: false }) })
      .catch((erro) => { if (ativo) setEstado({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [desde, ate, usuarioId, acao, pacienteId, entidade, pagina, tentativa, filtroInvalido])

  /**
   * As opcoes de usuario saem da propria trilha, e nao de servicos.usuarios:
   * listar usuarios e operacao de administracao, e chama-la daqui gravaria uma
   * tentativa negada a cada abertura desta tela. Item 17: de toda a trilha, e
   * nao so das ultimas paginas, com o nome do registro mais recente.
   */
  useEffect(() => {
    let ativo = true
    servicos.auditoria.listarPessoas()
      .then((pessoas) => { if (ativo) setUsuarios(pessoas.map((p) => ({ id: p.usuarioId, nome: p.nome }))) })
      .catch(() => { if (ativo) setUsuarios([]) })
    return () => { ativo = false }
  }, [tentativa])

  const exportar = async () => {
    setAviso(null)
    setErroExportacao(null)
    setExportando(true)
    try {
      const csv = await servicos.auditoria.exportar(filtroDoServico(false))
      // O arquivo sai do navegador: nao ha back-end para guardar arquivo, e o
      // conteudo ja veio inteiro do servico.
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = nomeDoArquivoDaAuditoria(new Date())
      a.click()
      URL.revokeObjectURL(url)
      setAviso('Arquivo gerado com todos os registros do filtro. A exportação ficou registrada na própria trilha.')
      // A exportacao acabou de virar um registro: a lista precisa mostra-lo.
      setTentativa((t) => t + 1)
    } catch (e) {
      setErroExportacao((e as Error).message || 'Não foi possível exportar agora.')
    } finally {
      setExportando(false)
    }
  }

  const campo = 'min-h-11 w-full min-w-0 rounded-lg border-2 border-linha bg-sup px-3 py-2.5 text-tinta'
  const resultado = estado.tipo === 'pronto'
    ? estado.dados.total === 0
      ? 'Nenhum registro encontrado.'
      : `${estado.dados.total} ${estado.dados.total === 1 ? 'registro encontrado' : 'registros encontrados'}.`
    : ''

  return (
    <Tela area="cli" caminho={['Coordenação', 'Registro de auditoria']}>
      <Titulo sub="Quem acessou o quê, quando e de onde — inclusive o acesso que foi negado">
        Registro de auditoria
      </Titulo>

      <Aviso titulo="Registro imutável">
        Nada aqui pode ser editado ou excluído, nem por esta tela nem por nenhuma outra. É o que
        sustenta o artigo 37 da LGPD: a trilha só serve como prova se ninguém puder retocá-la.
      </Aviso>

      <section aria-labelledby="h-filtros" className="flex flex-col gap-3">
        <h2 id="h-filtros" className="sr-only">Filtros da trilha</h2>

        <div className="flex flex-wrap items-center gap-2">
          {/* O terceiro momento da regra 6, a um toque: o sistema registra o
              acesso que NAO aconteceu. */}
          <Botao
            area="cli"
            variante={soNegadas ? 'primaria' : 'secundaria'}
            aria-pressed={soNegadas}
            onClick={() => atualizar({ acao: soNegadas ? null : 'ACESSO_NEGADO' })}
          >
            {soNegadas ? '✕ Só tentativas negadas' : 'Só tentativas negadas'}
          </Botao>
          {temFiltro && (
            <Botao area="cli" variante="secundaria" onClick={() => setParams(new URLSearchParams())}>
              Limpar os filtros
            </Botao>
          )}
        </div>

        <div className="grid gap-3 [&>*]:min-w-0 sm:grid-cols-2 lg:grid-cols-3">
          <Campo id="desde" rotulo="De">
            <input id="desde" type="date" className={campo} value={desde} max={ate || undefined}
              aria-invalid={Boolean(errosDoFiltro.desde)}
              onChange={(e) => atualizar({ desde: e.target.value || null })} />
          </Campo>

          <Campo id="ate" rotulo="Até">
            <input id="ate" type="date" className={campo} value={ate} min={desde || undefined}
              aria-invalid={Boolean(errosDoFiltro.ate)}
              onChange={(e) => atualizar({ ate: e.target.value || null })} />
          </Campo>

          <Campo id="acao" rotulo="Ação">
            <select id="acao" className={campo} value={acao}
              onChange={(e) => atualizar({ acao: e.target.value || null })}>
              <option value="">Todas</option>
              {Object.entries(ACOES).map(([valor, a]) => (
                <option key={valor} value={valor}>{a.rotulo}</option>
              ))}
            </select>
          </Campo>

          <Campo id="usuario" rotulo="Usuário">
            <select id="usuario" className={campo} value={usuarioId}
              onChange={(e) => atualizar({ usuario: e.target.value || null })}>
              <option value="">Todos</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </Campo>

          <BuscaDePaciente pacienteId={pacienteId} nome={nomeDoPaciente} classeDoCampo={campo}
            aoEscolher={(id) => atualizar({ paciente: id })} />

          <Campo id="entidade" rotulo="Entidade">
            <select id="entidade" className={campo} value={entidade}
              onChange={(e) => atualizar({ entidade: e.target.value || null })}>
              <option value="">Todas</option>
              {ENTIDADES_AUDITADAS.map((e) => <option key={e} value={e}>{NOME_DA_ENTIDADE[e]}</option>)}
            </select>
          </Campo>
        </div>

        {filtroInvalido && (
          <Aviso tom="cr" titulo="Confira o filtro">
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {Object.values(errosDoFiltro).map((erro) => <li key={erro}>{erro}</li>)}
            </ul>
          </Aviso>
        )}
      </section>

      <div aria-live="polite">
        {aviso && <Aviso tom="ok" titulo="Exportado">{aviso}</Aviso>}
        {erroExportacao && (
          <Aviso tom="cr" titulo="Não foi possível exportar">{erroExportacao}</Aviso>
        )}
      </div>

      <p role="status" aria-live="polite" className="text-sm text-tinta2">{filtroInvalido ? '' : resultado}</p>

      {!filtroInvalido && estado.tipo === 'carregando' && (
        <EstadoCarregando forma="tabela" colunas={7} linhas={8} rotulo="Carregando o registro de auditoria" />
      )}

      {!filtroInvalido && estado.tipo === 'erro' && (
        <EstadoErro
          erro={estado.erro}
          oQue="o registro de auditoria"
          aoTentarDeNovo={() => setTentativa((t) => t + 1)}
        />
      )}

      {!filtroInvalido && estado.tipo === 'pronto' && estado.dados.total === 0 && (
        temFiltro ? (
          <EstadoVazio
            titulo="Nenhum registro com esses filtros"
            explicacao="Nenhuma operação registrada combina com esse recorte. Amplie o período ou limpe os filtros para ver a trilha inteira."
            acao={{ rotulo: 'Limpar os filtros', aoAcionar: () => setParams(new URLSearchParams()) }}
          />
        ) : (
          <EstadoVazio
            titulo="Nenhuma operação registrada ainda"
            explicacao="A trilha se preenche sozinha, conforme o sistema for usado: toda leitura e escrita de dado do paciente, concessão de acesso e tentativa de acesso negada."
            acao={{ rotulo: 'Atualizar', aoAcionar: () => setTentativa((t) => t + 1) }}
          />
        )
      )}

      {!filtroInvalido && estado.tipo === 'pronto' && estado.dados.total > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[15px] font-bold">
              {soNegadas ? 'Tentativas de acesso negadas' : 'Operações registradas'}
            </p>
            <Botao area="cli" variante="secundaria" disabled={exportando} onClick={() => void exportar()}>
              {exportando ? 'Gerando…' : 'Exportar em CSV'}
            </Botao>
          </div>

          <Tabela
            legenda={`Trilha de auditoria — ${resultado}`}
            colunas={colunas}
            linhas={estado.dados.itens}
            chave={(r) => r.id}
            colunaCabecalho={null}
            atualizando={estado.atualizando}
            nota="O arquivo exportado traz todos os registros do filtro, não apenas a página visível."
          />

          <Paginacao
            pagina={estado.dados.pagina}
            porPagina={estado.dados.porPagina}
            total={estado.dados.total}
            aoMudar={(p) => atualizar({ pagina: String(p) })}
            rotulo="Páginas do registro de auditoria"
            nomeItens={{ singular: 'registro', plural: 'registros' }}
          />
        </>
      )}
    </Tela>
  )
}
