import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tela } from '../LayoutApp'
import { Aviso } from '../../ui/Aviso'
import { Botao } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { Cartao } from '../../ui/Cartao'
import { Etiqueta } from '../../ui/Etiqueta'
import { Titulo } from '../../ui/Titulo'
import { EstadoCarregando } from '../../ui/EstadoCarregando'
import { EstadoErro } from '../../ui/EstadoErro'
import { EstadoVazio } from '../../ui/EstadoVazio'
import { Paginacao } from '../../ui/Paginacao'
import { Tabela, type Coluna } from '../../ui/Tabela'
import { NOME_DO_PERFIL } from '../perfis'
import { usarSessao } from '../../contexto/Sessao'
import { emData } from '../../dominio/datas'
import { ErroServico, servicos, type Pagina, type Perfil, type Usuario } from '../../servicos'

/**
 * Tela 14 · Gerenciar usuarios e perfis · /app/admin/usuarios (UC20)
 *
 * Desativar, nunca excluir: o historico clinico precisa manter a autoria de
 * quem registrou cada coisa. E o administrador nao desativa a si mesmo — a
 * regra vive em podeDesativarUsuario, e a tela nem oferece o botao na propria
 * linha.
 *
 * Esta tela cadastra APENAS equipe da clinica. Responsavel e professor nunca
 * saem daqui: o responsavel nasce do vinculo com o paciente, e o professor so
 * nasce do convite da familia. Fosse diferente, esta seria a porta dos fundos
 * da regra 1 do CLAUDE.md.
 */

const POR_PAGINA = 10

const PERFIS_DE_EQUIPE: Perfil[] = ['TERAPEUTA', 'COORDENADOR', 'ADMINISTRADOR']
const TODOS_OS_PERFIS: Perfil[] = [...PERFIS_DE_EQUIPE, 'RESPONSAVEL', 'PROFESSOR']

const VAZIO = { nome: '', email: '', perfis: [] as Perfil[] }

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'pronto'; dados: Pagina<Usuario>; atualizando: boolean }

/** Familia e escola decorrem do tipo de cadastro: aqui sao so leitura. */
const ehDaEquipe = (u: Usuario) =>
  !u.perfis.includes('RESPONSAVEL') && !u.perfis.includes('PROFESSOR')

export function Usuarios() {
  const { usuario: eu } = usarSessao()
  const [params, setParams] = useSearchParams()
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)

  const busca = params.get('busca') ?? ''
  const perfil = params.get('perfil') ?? ''
  const situacao = params.get('situacao') ?? ''
  const pagina = Math.max(1, Number(params.get('pagina') ?? 1) || 1)
  const temFiltro = Boolean(busca || perfil || situacao)

  const [texto, setTexto] = useState(busca)
  useEffect(() => { setTexto(busca) }, [busca])

  const [convite, setConvite] = useState(VAZIO)
  const [abertoId, setAbertoId] = useState<string | null>(null)
  const [perfisEditados, setPerfisEditados] = useState<Perfil[]>([])
  const [confirmandoDesativar, setConfirmandoDesativar] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState<string | null>(null)

  const regiaoViva = useRef<HTMLDivElement>(null)
  const focarAviso = useRef(false)

  useEffect(() => {
    if (!focarAviso.current) return
    focarAviso.current = false
    regiaoViva.current?.focus()
  })

  const atualizar = (mudancas: Record<string, string | null>, substituir = false) => {
    const proximos = new URLSearchParams(params)
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor) proximos.set(chave, valor)
      else proximos.delete(chave)
    }
    if (!('pagina' in mudancas)) proximos.delete('pagina')
    setParams(proximos, { replace: substituir })
  }

  useEffect(() => {
    if (texto === busca) return
    const id = setTimeout(() => atualizar({ busca: texto || null }, true), 300)
    return () => clearTimeout(id)
  }, [texto, busca])

  useEffect(() => {
    let ativo = true
    setEstado((e) => (e.tipo === 'pronto' ? { ...e, atualizando: true } : { tipo: 'carregando' }))
    servicos.usuarios.listar({
      busca: busca || undefined,
      perfil: (perfil as Perfil) || undefined,
      ativo: situacao ? situacao === 'ativos' : undefined,
      pagina,
      porPagina: POR_PAGINA,
    })
      .then((dados) => { if (ativo) setEstado({ tipo: 'pronto', dados, atualizando: false }) })
      .catch((erro) => { if (ativo) setEstado({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [busca, perfil, situacao, pagina, tentativa])

  const recarregar = () => setTentativa((t) => t + 1)

  const abrir = (u: Usuario) => {
    // O recado e da acao anterior: abrir outra pessoa o apaga (docs/02, secao 4).
    setAviso(null)
    setErros({})
    setConfirmandoDesativar(false)
    setAbertoId(u.id)
    setPerfisEditados(u.perfis)
  }

  const comErro = (e: unknown) => {
    const erro = e as ErroServico
    setErros(erro instanceof ErroServico && Object.keys(erro.campos).length > 0
      ? erro.campos
      : { geral: (erro as Error).message ?? 'Não foi possível concluir agora.' })
  }

  const convidar = async (evento: FormEvent) => {
    evento.preventDefault()
    setAviso(null)
    setErros({})
    setOcupado(true)
    try {
      const criado = await servicos.usuarios.convidar(convite)
      setConvite(VAZIO)
      // Sem servidor de e-mail, nao se finge que o convite saiu.
      setAviso(`Conta criada para ${criado.email}. Sem servidor de e-mail neste protótipo, nenhum convite foi enviado.`)
      focarAviso.current = true
      recarregar()
    } catch (e) {
      comErro(e)
    } finally {
      setOcupado(false)
    }
  }

  const executar = async (acao: () => Promise<Usuario>, recado: (u: Usuario) => string) => {
    setAviso(null)
    setErros({})
    setOcupado(true)
    try {
      const atualizado = await acao()
      setAviso(recado(atualizado))
      setPerfisEditados(atualizado.perfis)
      setConfirmandoDesativar(false)
      focarAviso.current = true
      recarregar()
    } catch (e) {
      comErro(e)
    } finally {
      setOcupado(false)
    }
  }

  const campo = 'min-h-11 w-full min-w-0 rounded-lg border-2 border-linha bg-sup px-3 py-2.5 text-tinta'

  const colunas: Coluna<Usuario>[] = [
    { id: 'nome', titulo: 'Nome', celula: (u) => u.nome },
    { id: 'email', titulo: 'E-mail', quebrar: true, celula: (u) => u.email },
    {
      id: 'perfis', titulo: 'Perfis',
      celula: (u) => u.perfis.map((p) => NOME_DO_PERFIL[p]).join(', '),
    },
    {
      id: 'situacao', titulo: 'Situação',
      celula: (u) => u.ativo
        ? <Etiqueta tom="ok" simbolo="✓">Ativo</Etiqueta>
        : <Etiqueta simbolo="○">Desativado</Etiqueta>,
    },
    {
      id: 'acesso', titulo: 'Último acesso',
      celula: (u) => u.ultimoAcessoEm
        ? emData(u.ultimoAcessoEm)
        : <span className="text-tinta2">Aguardando primeiro acesso</span>,
    },
    {
      id: 'acoes', titulo: 'Ações',
      celula: (u) => (
        <Botao variante="secundaria" area="cli" aria-expanded={abertoId === u.id}
          onClick={() => (abertoId === u.id ? setAbertoId(null) : abrir(u))}>
          {abertoId === u.id ? 'Fechar' : 'Gerenciar'}
        </Botao>
      ),
    },
  ]

  const aberto = estado.tipo === 'pronto'
    ? estado.dados.itens.find((u) => u.id === abertoId)
    : undefined
  const souEu = aberto?.id === eu?.id

  return (
    <Tela area="cli" caminho={['Administração', 'Usuários e perfis']}>
      <Titulo sub="Quem tem conta, com que perfil e desde quando — a conta se desativa, nunca se exclui">
        Usuários e perfis
      </Titulo>

      <div ref={regiaoViva} tabIndex={-1} aria-live="polite">
        {aviso && <Aviso tom="ok" titulo="Pronto">{aviso}</Aviso>}
        {erros.geral && <Aviso tom="cr" titulo="Não foi possível concluir">{erros.geral}</Aviso>}
      </div>

      <section aria-labelledby="h-convidar" className="flex flex-col gap-3">
        <h2 id="h-convidar" className="text-lg font-bold">Criar conta para a equipe</h2>
        <Cartao>
          <form onSubmit={(e) => void convidar(e)} className="flex flex-col gap-4">
            <div className="grid gap-3 [&>*]:min-w-0 sm:grid-cols-2">
              <Campo id="nome" rotulo="Nome">
                <input id="nome" className={campo} value={convite.nome}
                  onChange={(e) => setConvite((c) => ({ ...c, nome: e.target.value }))}
                  aria-invalid={erros.nome ? true : undefined} />
              </Campo>
              <Campo id="email" rotulo="E-mail">
                <input id="email" type="email" className={campo} value={convite.email}
                  onChange={(e) => setConvite((c) => ({ ...c, email: e.target.value }))}
                  aria-invalid={erros.email ? true : undefined} />
              </Campo>
            </div>
            {erros.nome && <p className="text-sm font-bold text-cr">{erros.nome}</p>}
            {erros.email && <p className="text-sm font-bold text-cr">{erros.email}</p>}

            <fieldset className="border-0 p-0">
              <legend className="text-sm font-bold">Perfis</legend>
              {/* Responsavel e professor nao aparecem: o responsavel nasce do
                  vinculo com o paciente, e o professor, do convite da familia. */}
              <p className="mt-1 text-sm text-tinta2">
                Esta tela cadastra apenas a equipe da clínica. O responsável nasce do vínculo com o
                paciente, e o professor, do convite da família.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {PERFIS_DE_EQUIPE.map((p) => (
                  <label key={p} className="flex min-h-11 items-center gap-2.5 rounded-lg border border-linha bg-sup px-3 py-2.5 text-[15px]">
                    <input
                      type="checkbox"
                      className="h-5 w-5 flex-none"
                      checked={convite.perfis.includes(p)}
                      onChange={() => setConvite((c) => ({
                        ...c,
                        perfis: c.perfis.includes(p) ? c.perfis.filter((x) => x !== p) : [...c.perfis, p],
                      }))}
                    />
                    {NOME_DO_PERFIL[p]}
                  </label>
                ))}
              </div>
            </fieldset>
            {erros.perfis && <p className="text-sm font-bold text-cr">{erros.perfis}</p>}

            <div>
              <Botao area="cli" type="submit" disabled={ocupado}>
                {ocupado ? 'Criando…' : 'Criar conta'}
              </Botao>
            </div>
          </form>
        </Cartao>
      </section>

      <section aria-labelledby="h-filtros" className="flex flex-col gap-3">
        <h2 id="h-filtros" className="sr-only">Filtros da lista de usuários</h2>
        <div className="grid gap-3 [&>*]:min-w-0 sm:grid-cols-2 lg:grid-cols-3">
          <Campo id="busca" rotulo="Buscar por nome ou e-mail">
            <input id="busca" type="search" className={campo} value={texto}
              onChange={(e) => setTexto(e.target.value)} />
          </Campo>
          <Campo id="perfil" rotulo="Perfil">
            <select id="perfil" className={campo} value={perfil}
              onChange={(e) => atualizar({ perfil: e.target.value || null })}>
              <option value="">Todos</option>
              {TODOS_OS_PERFIS.map((p) => (
                <option key={p} value={p}>{NOME_DO_PERFIL[p]}</option>
              ))}
            </select>
          </Campo>
          <Campo id="situacao" rotulo="Situação">
            <select id="situacao" className={campo} value={situacao}
              onChange={(e) => atualizar({ situacao: e.target.value || null })}>
              <option value="">Todas</option>
              <option value="ativos">Ativos</option>
              <option value="desativados">Desativados</option>
            </select>
          </Campo>
        </div>
      </section>

      {estado.tipo === 'carregando' && (
        <EstadoCarregando forma="tabela" colunas={6} linhas={6} rotulo="Carregando os usuários" />
      )}

      {estado.tipo === 'erro' && (
        <EstadoErro erro={estado.erro} oQue="a lista de usuários" aoTentarDeNovo={recarregar} />
      )}

      {estado.tipo === 'pronto' && estado.dados.total === 0 && (
        <EstadoVazio
          titulo="Nenhuma conta com esses filtros"
          explicacao="Nenhum usuário combina com esse recorte. Confira a grafia ou limpe os filtros para ver todas as contas."
          acao={{ rotulo: 'Limpar os filtros', aoAcionar: () => setParams(new URLSearchParams()) }}
        />
      )}

      {estado.tipo === 'pronto' && estado.dados.total > 0 && (
        <>
          <Tabela
            legenda={temFiltro ? 'Usuários que combinam com os filtros' : 'Todas as contas do sistema'}
            colunas={colunas}
            linhas={estado.dados.itens}
            chave={(u) => u.id}
            atualizando={estado.atualizando}
          />

          <Paginacao
            pagina={estado.dados.pagina}
            porPagina={estado.dados.porPagina}
            total={estado.dados.total}
            aoMudar={(p) => atualizar({ pagina: String(p) })}
            rotulo="Páginas da lista de usuários"
            nomeItens={{ singular: 'conta', plural: 'contas' }}
          />
        </>
      )}

      {aberto && (
        <section aria-labelledby="h-gerenciar" className="flex flex-col gap-3">
          <h2 id="h-gerenciar" className="text-lg font-bold">{aberto.nome}</h2>
          <Cartao>
            <fieldset className="border-0 p-0">
              <legend className="text-sm font-bold">Perfis</legend>
              {ehDaEquipe(aberto) ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {PERFIS_DE_EQUIPE.map((p) => (
                    <label key={p} className="flex min-h-11 items-center gap-2.5 rounded-lg border border-linha bg-sup px-3 py-2.5 text-[15px]">
                      <input
                        type="checkbox"
                        className="h-5 w-5 flex-none"
                        checked={perfisEditados.includes(p)}
                        onChange={() => setPerfisEditados((atual) => atual.includes(p)
                          ? atual.filter((x) => x !== p)
                          : [...atual, p])}
                      />
                      {NOME_DO_PERFIL[p]}
                    </label>
                  ))}
                </div>
              ) : (
                // Perfil de familia e de escola decorre do tipo de cadastro:
                // aqui ele se le, nao se escolhe.
                <p className="mt-2 text-[15px]">
                  {aberto.perfis.map((p) => NOME_DO_PERFIL[p]).join(', ')}
                  <span className="mt-1 block text-sm text-tinta2">
                    Este perfil vem do cadastro — do vínculo com o paciente ou do convite da
                    família — e não se altera por aqui.
                  </span>
                </p>
              )}
            </fieldset>
            {erros.perfis && <p className="mt-2 text-sm font-bold text-cr">{erros.perfis}</p>}

            <div className="mt-4 flex flex-wrap gap-2">
              {ehDaEquipe(aberto) && (
                <Botao area="cli" disabled={ocupado}
                  onClick={() => void executar(
                    () => servicos.usuarios.alterarPerfis(aberto.id, perfisEditados),
                    (u) => `Perfis de ${u.nome} atualizados.`,
                  )}>
                  {ocupado ? 'Salvando…' : 'Salvar perfis'}
                </Botao>
              )}

              {!aberto.ativo && (
                <Botao area="cli" variante="secundaria" disabled={ocupado}
                  onClick={() => void executar(
                    () => servicos.usuarios.reativar(aberto.id),
                    (u) => `${u.nome} pode entrar no sistema de novo.`,
                  )}>
                  Reativar conta
                </Botao>
              )}

              {/* O administrador nao desativa a si mesmo: a tela nem oferece. */}
              {aberto.ativo && !souEu && !confirmandoDesativar && (
                <Botao area="cli" variante="secundaria" disabled={ocupado}
                  onClick={() => setConfirmandoDesativar(true)}>
                  Desativar conta
                </Botao>
              )}
            </div>

            {souEu && (
              <p className="mt-3 text-sm text-tinta2">
                Esta é a sua conta. Desativar a si mesmo deixaria o sistema sem quem administra.
              </p>
            )}

            {/* Duas etapas: quem for desativado perde o acesso na chamada seguinte. */}
            {confirmandoDesativar && aberto.ativo && (
              <div role="group" aria-labelledby={`desativar-${aberto.id}`}
                className="mt-3 rounded-lg border border-at bg-at-sup p-3.5">
                <p id={`desativar-${aberto.id}`} className="font-bold text-tinta">
                  Desativar a conta de {aberto.nome}?
                </p>
                <p className="mt-1 text-sm text-tinta2">
                  O acesso acaba na próxima ação desta pessoa, mesmo que ela esteja com o sistema
                  aberto. A conta não é excluída: tudo o que ela registrou mantém a autoria, e a
                  conta pode ser reativada depois.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Botao area="cli" disabled={ocupado}
                    onClick={() => void executar(
                      () => servicos.usuarios.desativar(aberto.id),
                      (u) => `${u.nome} não entra mais no sistema. A conta continua existindo.`,
                    )}>
                    {ocupado ? 'Desativando…' : 'Desativar conta'}
                  </Botao>
                  <Botao area="cli" variante="secundaria" disabled={ocupado}
                    onClick={() => setConfirmandoDesativar(false)}>
                    Cancelar
                  </Botao>
                </div>
              </div>
            )}
          </Cartao>
        </section>
      )}
    </Tela>
  )
}
