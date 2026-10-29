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
import { LinkDePrimeiroAcesso } from '../../componentes/LinkDePrimeiroAcesso'
import { usarSessao } from '../../contexto/Sessao'
import { emData } from '@sinctea/compartilhado/dominio/datas'
import { MOTIVO_NOVA_SENHA_MAXIMO } from '@sinctea/compartilhado/dominio/regras'
import {
  ErroServico, servicos, type FinalidadeAcesso, type LinkPrimeiroAcesso, type Pagina, type Perfil, type Usuario,
} from '../../servicos'

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
 *
 * A conta nasce sem senha conhecida: o administrador recebe um link de primeiro
 * acesso, de uso unico e 72 horas, e o entrega a pessoa, que define a propria
 * senha (docs/07, secao 0). O mesmo vale para o link novo, quando o anterior
 * venceu ou a pessoa esqueceu a senha.
 */

const POR_PAGINA = 10

const PERFIS_DE_EQUIPE: Perfil[] = ['TERAPEUTA', 'COORDENADOR', 'ADMINISTRADOR']
const TODOS_OS_PERFIS: Perfil[] = [...PERFIS_DE_EQUIPE, 'RESPONSAVEL', 'PROFESSOR']

const VAZIO = { nome: '', email: '', perfis: [] as Perfil[], especialidade: '', registroConselho: '' }

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'pronto'; dados: Pagina<Usuario>; atualizando: boolean }

/** Familia e escola decorrem do tipo de cadastro: aqui sao so leitura. */
const ehDaEquipe = (u: Usuario) =>
  !u.perfis.includes('RESPONSAVEL') && !u.perfis.includes('PROFESSOR')

/**
 * Item 13: o link para nova senha, pela administracao, vale para a equipe que
 * ja definiu a senha e para o professor. O do responsavel e da coordenacao.
 */
const aceitaNovaSenha = (u: Usuario) => u.ativo && u.ultimoAcessoEm !== null
  && (u.perfis.includes('PROFESSOR') || ehDaEquipe(u))

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
  /** De que formulario veio o erro: a criacao e a gestao da conta tem, as duas, o campo perfis. */
  const [errosDe, setErrosDe] = useState<'convite' | 'gestao'>('convite')
  const [aviso, setAviso] = useState<string | null>(null)
  const [link, setLink] = useState<{ nome: string; link: LinkPrimeiroAcesso; finalidade?: FinalidadeAcesso } | null>(null)
  /** Item 13: o link para nova senha da conta aberta, com o motivo. */
  const [pedindoNovaSenha, setPedindoNovaSenha] = useState(false)
  const [motivo, setMotivo] = useState('')

  const regiaoViva = useRef<HTMLDivElement>(null)
  const focarAviso = useRef(false)
  /** O campo que recebe o foco depois do proximo desenho, pelo id: o botao que abriu some. */
  const focarDepois = useRef<string | null>(null)

  useEffect(() => {
    const alvo = focarDepois.current
    focarDepois.current = null
    if (alvo) document.getElementById(alvo)?.focus()
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
    setLink(null)
    setErros({})
    setConfirmandoDesativar(false)
    setPedindoNovaSenha(false)
    setMotivo('')
    setAbertoId(u.id)
    setPerfisEditados(u.perfis)
  }

  const errosConvite = errosDe === 'convite' ? erros : {}
  const errosGestao = errosDe === 'gestao' ? erros : {}

  const comErro = (e: unknown, de: 'convite' | 'gestao') => {
    setErrosDe(de)
    const erro = e as ErroServico
    setErros(erro instanceof ErroServico && Object.keys(erro.campos).length > 0
      ? erro.campos
      : { geral: (erro as Error).message ?? 'Não foi possível concluir agora.' })
  }

  const convidar = async (evento: FormEvent) => {
    evento.preventDefault()
    setAviso(null)
    setLink(null)
    setErros({})
    setOcupado(true)
    try {
      const { usuario, primeiroAcesso } = await servicos.usuarios.convidar(convite)
      setConvite(VAZIO)
      // Sem servidor de e-mail, nao se finge que algo foi enviado: o link e
      // entregue por quem cadastrou.
      setAviso(`Conta criada para ${usuario.email}. Entregue o link abaixo a ${usuario.nome}.`)
      setLink({ nome: usuario.nome, link: primeiroAcesso })
      focarAviso.current = true
      recarregar()
    } catch (e) {
      comErro(e, 'convite')
    } finally {
      setOcupado(false)
    }
  }

  const gerarNovaSenha = async (evento: FormEvent, u: Usuario) => {
    evento.preventDefault()
    setAviso(null)
    setLink(null)
    setErros({})
    setOcupado(true)
    try {
      const gerado = await servicos.usuarios.linkNovaSenha(u.id, motivo)
      setPedindoNovaSenha(false)
      setMotivo('')
      setAviso(`Link para nova senha de ${u.nome}. O motivo ficou na trilha, com o seu nome.`)
      setLink({ nome: u.nome, link: gerado, finalidade: 'NOVA_SENHA' })
      focarAviso.current = true
    } catch (e) {
      comErro(e, 'gestao')
      // O erro do motivo leva ao campo; o geral, ao aviso.
      if (e instanceof ErroServico && e.campos.motivo) focarDepois.current = 'gestao-motivo'
      else focarAviso.current = true
    } finally {
      setOcupado(false)
    }
  }

  const gerarLink = async (u: Usuario) => {
    setAviso(null)
    setLink(null)
    setErros({})
    setOcupado(true)
    try {
      const novo = await servicos.usuarios.novoLinkDeAcesso(u.id)
      setAviso(`Novo link para ${u.nome}. O anterior deixou de valer; a senha atual vale até o novo ser usado.`)
      setLink({ nome: u.nome, link: novo })
      focarAviso.current = true
    } catch (e) {
      comErro(e, 'gestao')
    } finally {
      setOcupado(false)
    }
  }

  const executar = async (acao: () => Promise<Usuario>, recado: (u: Usuario) => string) => {
    setAviso(null)
    setLink(null)
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
      comErro(e, 'gestao')
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
        {link && <div className="mt-3"><LinkDePrimeiroAcesso nome={link.nome} link={link.link} finalidade={link.finalidade} /></div>}
        {erros.geral && <Aviso tom="cr" titulo="Não foi possível concluir">{erros.geral}</Aviso>}
      </div>

      <section aria-labelledby="h-convidar" className="flex flex-col gap-3">
        <h2 id="h-convidar" className="text-lg font-bold">Criar conta para a equipe</h2>
        <Cartao>
          <form onSubmit={(e) => void convidar(e)} className="flex flex-col gap-4">
            {/* Os quatro campos numa linha so a partir de lg (item 21). */}
            <div className="grid gap-3 [&>*]:min-w-0 sm:grid-cols-2 lg:grid-cols-4">
              <Campo id="nome" rotulo="Nome">
                <input id="nome" className={campo} value={convite.nome}
                  onChange={(e) => setConvite((c) => ({ ...c, nome: e.target.value }))}
                  aria-invalid={errosConvite.nome ? true : undefined} aria-describedby={errosConvite.nome ? 'nome-erro' : undefined} />
              </Campo>
              <Campo id="email" rotulo="E-mail">
                <input id="email" type="email" className={campo} value={convite.email}
                  onChange={(e) => setConvite((c) => ({ ...c, email: e.target.value }))}
                  aria-invalid={errosConvite.email ? true : undefined} aria-describedby={errosConvite.email ? 'email-erro' : undefined} />
              </Campo>
            {/* Opcionais: o administrador costuma ter os dois a mao, e quem
                completa depois e a propria pessoa, em Perfil e preferencias.
                Sem o registro preenchido, essa pessoa nao emite relatorio. */}
              {/* Item 7: obrigatoria para o profissional da clinica, que a tela
                  mostra pelo nome e pela especialidade. */}
              <Campo id="especialidade"
                rotulo={convite.perfis.includes('TERAPEUTA') ? 'Especialidade' : 'Especialidade (opcional)'}
                dica={convite.perfis.includes('TERAPEUTA') ? 'Obrigatória para o profissional da clínica: Psicologia, Fonoaudiologia, Terapia Ocupacional.' : undefined}>
                <input id="especialidade" className={campo} value={convite.especialidade}
                  onChange={(e) => setConvite((c) => ({ ...c, especialidade: e.target.value }))}
                  aria-invalid={errosConvite.especialidade ? true : undefined}
                  aria-describedby={errosConvite.especialidade ? 'especialidade-erro' : undefined} />
                {errosConvite.especialidade && <p id="especialidade-erro" className="text-sm font-bold text-cr">{errosConvite.especialidade}</p>}
              </Campo>
              <Campo id="registro" rotulo="Registro no conselho (opcional)">
                <input id="registro" className={campo} value={convite.registroConselho}
                  onChange={(e) => setConvite((c) => ({ ...c, registroConselho: e.target.value }))} />
              </Campo>
            </div>
            {/* Depois dos quatro campos (item 11), cada erro continua ligado ao seu
                campo pelo aria-describedby, e a mensagem diz de que campo e. */}
            {errosConvite.nome && <p id="nome-erro" className="text-sm font-bold text-cr">{errosConvite.nome}</p>}
            {errosConvite.email && <p id="email-erro" className="text-sm font-bold text-cr">{errosConvite.email}</p>}

            <fieldset className="border-0 p-0" aria-invalid={errosConvite.perfis ? true : undefined}
              aria-describedby={errosConvite.perfis ? 'perfis-erro' : undefined}>
              <legend className="text-sm font-bold">Perfis</legend>
              {/* Responsavel e professor nao aparecem: o responsavel nasce do
                  vinculo com o paciente, e o professor, do convite da familia. */}
              <p className="mt-1 max-w-[65ch] text-sm text-tinta2">
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
            {errosConvite.perfis && <p id="perfis-erro" className="text-sm font-bold text-cr">{errosConvite.perfis}</p>}

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
            <fieldset className="border-0 p-0" aria-invalid={errosGestao.perfis ? true : undefined}
              aria-describedby={errosGestao.perfis ? 'gestao-perfis-erro' : undefined}>
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
            {errosGestao.perfis && <p id="gestao-perfis-erro" className="mt-2 text-sm font-bold text-cr">{errosGestao.perfis}</p>}

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

              {/* Item 13: link vencido, enquanto a pessoa nao definiu a senha. Depois,
                  o link e o de nova senha, com motivo — da equipe e do professor. */}
              {ehDaEquipe(aberto) && aberto.ativo && aberto.ultimoAcessoEm === null && (
                <Botao area="cli" variante="secundaria" disabled={ocupado}
                  onClick={() => void gerarLink(aberto)}>
                  Gerar novo link de acesso
                </Botao>
              )}
              {aceitaNovaSenha(aberto) && !pedindoNovaSenha && (
                <Botao id="gestao-nova-senha" area="cli" variante="secundaria" disabled={ocupado}
                  onClick={() => {
                    setPedindoNovaSenha(true); setMotivo(''); setAviso(null); setLink(null); setErros({})
                    focarDepois.current = 'gestao-motivo'
                  }}>
                  Gerar link para nova senha
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

            {aberto.perfis.includes('RESPONSAVEL') && (
              <p className="mt-3 max-w-[65ch] text-sm text-tinta2">
                O link para nova senha do responsável é da coordenação, na ficha do paciente.
              </p>
            )}

            {pedindoNovaSenha && aceitaNovaSenha(aberto) && (
              <form onSubmit={(e) => void gerarNovaSenha(e, aberto)} noValidate
                className="mt-3 flex max-w-3xl flex-col gap-3 border-t border-linha pt-3">
                <h3 className="text-base font-bold">Link para nova senha de {aberto.nome}</h3>
                <p className="max-w-[65ch] text-sm text-tinta2">
                  Ao usar o link, a pessoa escolhe a nova senha, a anterior deixa de valer e as sessões
                  abertas se encerram. No acesso seguinte, ela vê que a senha foi redefinida pela
                  clínica, a seu pedido.
                </p>
                <Campo id="gestao-motivo" rotulo="Motivo"
                  dica={`Fica na trilha de auditoria, com o seu nome. Até ${MOTIVO_NOVA_SENHA_MAXIMO} caracteres.`}>
                  <textarea id="gestao-motivo" rows={3} maxLength={MOTIVO_NOVA_SENHA_MAXIMO} value={motivo}
                    className="min-h-11 w-full min-w-0 rounded-lg border-2 border-linha bg-sup px-3 py-2.5 text-tinta"
                    aria-invalid={errosGestao.motivo ? true : undefined}
                    aria-describedby={errosGestao.motivo ? 'gestao-motivo-erro' : undefined}
                    onChange={(e) => setMotivo(e.target.value)} />
                  {errosGestao.motivo && <p id="gestao-motivo-erro" className="text-sm font-bold text-cr">{errosGestao.motivo}</p>}
                </Campo>
                <div className="flex flex-wrap gap-2">
                  <Botao area="cli" type="submit" disabled={ocupado}>{ocupado ? 'Gerando…' : 'Gerar o link'}</Botao>
                  <Botao area="cli" variante="secundaria" disabled={ocupado}
                    onClick={() => { setPedindoNovaSenha(false); setErros({}); focarDepois.current = 'gestao-nova-senha' }}>
                    Cancelar
                  </Botao>
                </div>
              </form>
            )}

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
