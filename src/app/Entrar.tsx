import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { RESPOSTA_DA_RECUPERACAO } from '@sinctea/compartilhado/dominio/recuperacao'
import { emailValido } from '@sinctea/compartilhado/dominio/regras'
import { Botao } from '../ui/Botao'
import { Campo } from '../ui/Campo'
import { CampoSenha } from '../ui/CampoSenha'
import { Titulo } from '../ui/Titulo'
import { usarSessao } from '../contexto/Sessao'
import { ErroServico, servicos, usandoApi, type ContaAberta, type Perfil } from '../servicos'
import { LayoutAcesso } from './LayoutAcesso'
import { NOME_DO_PERFIL } from './perfis'

/**
 * Tela 1 · Entrar · /app/entrar
 *
 * "Autenticar-se" e requisito transversal, representado pela operacao
 * Usuario.autenticar() no diagrama de classes.
 *
 * Regras da tela (docs/03, tela 1):
 * - Erro de credencial nunca revela se o e-mail existe: mensagem unica.
 * - Sem CAPTCHA (e-MAG 6.8; WCAG 3.3.8).
 * - Sem limite de tempo de sessao que expire sem aviso.
 *
 * O aviso do ambiente saiu daqui em 25/10/2026 e do app inteiro em 29/10/2026,
 * por decisao do Lucas (item 21). A entrada de demonstracao so existe com o
 * mock: na versao publicada, nem entra no pacote.
 *
 * Uma conta por aba (item 9): a aba sem conta mostra, acima do formulario, as
 * contas ja abertas neste navegador, para continuar numa delas sem senha nova.
 *
 * "Esqueci minha senha" (item 23): o link abre um campo de e-mail, e a
 * resposta e sempre RESPOSTA_DA_RECUPERACAO, exista a conta ou nao. A tela
 * so recusa o e-mail mal escrito, que nao diz nada de conta nenhuma. O link
 * que nao vale mais (tela 23) volta aqui com ?esqueci, ja com o campo aberto.
 */

const PERFIS_DEMONSTRACAO: Exclude<Perfil, 'ADMINISTRADOR'>[] =
  ['TERAPEUTA', 'COORDENADOR', 'RESPONSAVEL', 'PROFESSOR']

const DESCRICAO_DEMONSTRACAO: Record<Exclude<Perfil, 'ADMINISTRADOR'>, string> = {
  TERAPEUTA: 'Agenda do dia, plano, sessão e evolução',
  COORDENADOR: 'Indicadores da clínica e validação de planos',
  RESPONSAVEL: 'Evolução em linguagem cotidiana e acesso da escola',
  PROFESSOR: 'Cartão de estratégias e registro de ocorrência',
}

export function Entrar() {
  const { entrar, entrarDemonstracao, continuarComo } = usarSessao()
  const navegar = useNavigate()
  const local = useLocation()
  const [parametros] = useSearchParams()
  const campoEmail = useRef<HTMLInputElement>(null)
  const campoRecuperacao = useRef<HTMLInputElement>(null)

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)
  const [esqueci, setEsqueci] = useState(() => parametros.has('esqueci'))
  const [emailRecuperacao, setEmailRecuperacao] = useState('')
  const [erroRecuperacao, setErroRecuperacao] = useState<string | null>(null)
  const [pedindo, setPedindo] = useState(false)
  const [pedido, setPedido] = useState(false)
  const [abertas, setAbertas] = useState<ContaAberta[]>([])
  const [carregarAbertas, setCarregarAbertas] = useState(0)

  useEffect(() => {
    let ativo = true
    servicos.autenticacao.contasAbertas()
      .then((contas) => { if (ativo) setAbertas(contas) })
      // Sem a lista, a tela continua sendo a de entrar.
      .catch(() => { if (ativo) setAbertas([]) })
    return () => { ativo = false }
  }, [carregarAbertas])

  // Volta para a tela que a pessoa tentou abrir antes de ser mandada ao login.
  const destino = (local.state as { destino?: string } | null)?.destino ?? '/app'

  const concluir = async (acao: () => Promise<void>) => {
    setErro(null)
    setEntrando(true)
    try {
      await acao()
      navegar(destino, { replace: true })
    } catch (e) {
      // Mensagem unica: nao diz se o e-mail existe (docs/03, tela 1). O limite
      // de tentativas tem a sua, que diz quanto esperar.
      // A recusa das cinco vagas e a conta que ja nao esta aberta dizem o que fazer.
      setErro(e instanceof ErroServico && e.codigo === 'NAO_AUTENTICADO'
        ? 'E-mail ou senha incorretos.'
        : e instanceof ErroServico && ['LIMITE_TENTATIVAS', 'CONFLITO', 'NAO_ENCONTRADO'].includes(e.codigo)
          ? e.message
          : 'Não foi possível entrar agora. Tente de novo em alguns segundos.')
      campoEmail.current?.focus()
    } finally {
      setEntrando(false)
    }
  }

  const continuar = (conta: ContaAberta) => concluir(async () => {
    if (!(await continuarComo(conta.vaga))) {
      setCarregarAbertas((n) => n + 1)
      throw new ErroServico('NAO_ENCONTRADO', `A conta de ${conta.nome} não está mais aberta. Entre com o e-mail e a senha.`)
    }
  })

  const enviar = (evento: FormEvent) => {
    evento.preventDefault()
    void concluir(() => entrar(email, senha))
  }

  const abrirEsqueci = () => {
    const abrir = !esqueci
    setEsqueci(abrir)
    if (abrir) {
      // O e-mail que ja foi digitado para entrar vem junto.
      if (!emailRecuperacao) setEmailRecuperacao(email)
      setTimeout(() => campoRecuperacao.current?.focus(), 0)
    }
  }

  const pedirLink = async (evento: FormEvent) => {
    evento.preventDefault()
    const escrito = emailRecuperacao.trim()
    if (!escrito) { setErroRecuperacao('Escreva o e-mail da sua conta.'); campoRecuperacao.current?.focus(); return }
    if (!emailValido(escrito.toLowerCase())) { setErroRecuperacao('Escreva um e-mail válido.'); campoRecuperacao.current?.focus(); return }
    setErroRecuperacao(null)
    setPedido(false)
    setPedindo(true)
    try {
      await servicos.autenticacao.pedirNovaSenha(escrito)
      setPedido(true)
    } catch {
      // A rota sempre responde igual: aqui so chega a falta de conexao.
      setErroRecuperacao('Não foi possível enviar o pedido agora. Tente de novo em alguns segundos.')
    } finally {
      setPedindo(false)
    }
  }

  const campo = 'min-h-11 rounded-lg border border-linha bg-sup px-3 text-[15px]'

  return (
    <LayoutAcesso>
      <div className="flex flex-col gap-4 rounded-2xl border border-cromo-linha bg-fundo p-5 text-tinta sm:p-6">
        <Titulo sub="A informação acompanha a pessoa, não a instituição">Entrar no SINCTEA</Titulo>

        {abertas.length > 0 && (
          <section aria-labelledby="contas-abertas" className="flex flex-col gap-2 border-b border-linha pb-4">
            <h2 id="contas-abertas" className="text-lg font-bold">Contas abertas neste navegador</h2>
            <ul className="flex flex-col gap-2">
              {abertas.map((conta) => (
                <li key={conta.vaga} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-linha bg-sup px-3 py-2.5">
                  <span>
                    <b>{conta.nome}</b>
                    <span className="block text-sm text-tinta2">{NOME_DO_PERFIL[conta.perfilAtivo]}</span>
                  </span>
                  <Botao variante="secundaria" disabled={entrando} onClick={() => void continuar(conta)}>
                    Continuar como {conta.nome}
                  </Botao>
                </li>
              ))}
            </ul>
            <p className="text-sm text-tinta2">Ou entre com outra conta abaixo. Cada aba fica com a sua.</p>
          </section>
        )}

        <form className="flex flex-col gap-4" onSubmit={enviar} noValidate>
          {/* Erro em regiao dinamica, com o foco devolvido ao primeiro campo —
              WCAG 3.3.1 / e-MAG 6.6. */}
          <div role="alert" aria-live="assertive">
            {erro && (
              <p id="erro-entrada" className="rounded-xl border border-linha border-l-4 border-l-cr bg-cr-sup p-3 font-bold text-cr">
                <span aria-hidden="true">▲ </span>{erro}
              </p>
            )}
          </div>

          <Campo id="email" rotulo="E-mail">
            <input
              ref={campoEmail}
              id="email"
              type="email"
              autoComplete="email"
              className={campo}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby={erro ? 'erro-entrada' : undefined}
            />
          </Campo>

          <Campo id="senha" rotulo="Senha">
            <CampoSenha
              id="senha"
              autoComplete="current-password"
              className={campo}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              aria-describedby={erro ? 'erro-entrada' : undefined}
            />
          </Campo>

          <Botao type="submit" disabled={entrando}>{entrando ? 'Entrando…' : 'Entrar'}</Botao>
        </form>

        {/* Item 23: fora do formulario de entrar, para nao aninhar formularios. */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            className="min-h-11 cursor-pointer self-start text-[15px] font-bold text-cli-ink underline"
            aria-expanded={esqueci}
            aria-controls="esqueci-minha-senha"
            onClick={abrirEsqueci}
          >
            Esqueci minha senha
          </button>
          {esqueci && (
            <form id="esqueci-minha-senha" className="flex flex-col gap-3 rounded-xl border border-linha bg-sup p-4"
              onSubmit={(e) => void pedirLink(e)} noValidate aria-labelledby="titulo-esqueci">
              <h2 id="titulo-esqueci" className="text-lg font-bold">Definir uma nova senha</h2>
              <p className="texto-corrido text-sm text-tinta2">
                Escreva o e-mail da sua conta. Mandamos para ele um link com que você escolhe a nova senha.
              </p>
              <Campo id="email-recuperacao" rotulo="E-mail da sua conta">
                <input
                  ref={campoRecuperacao}
                  id="email-recuperacao"
                  type="email"
                  autoComplete="email"
                  className={campo}
                  value={emailRecuperacao}
                  onChange={(e) => { setEmailRecuperacao(e.target.value); setPedido(false) }}
                  aria-invalid={erroRecuperacao ? true : undefined}
                  aria-describedby={erroRecuperacao ? 'erro-recuperacao' : undefined}
                />
                {erroRecuperacao && <p id="erro-recuperacao" className="text-sm font-bold text-cr">{erroRecuperacao}</p>}
              </Campo>
              <div role="status" aria-live="polite">
                {pedido && (
                  <div className="flex flex-col gap-1 rounded-xl border border-linha border-l-4 border-l-ok bg-ok-sup p-3">
                    <p className="max-w-[65ch] font-bold text-tinta">{RESPOSTA_DA_RECUPERACAO}</p>
                    <p className="texto-corrido text-sm text-tinta2">
                      Se não chegar em alguns minutos, confira a caixa de spam ou peça à clínica um link para nova senha.
                    </p>
                  </div>
                )}
              </div>
              <Botao type="submit" variante="secundaria" disabled={pedindo}>{pedindo ? 'Enviando…' : 'Enviar o link'}</Botao>
            </form>
          )}
        </div>

        {/* Bloco de demonstracao: separado por linha e rotulo claro, para
            mostrar o sistema sem cadastro (docs/03, tela 1). So com o mock. */}
        {!usandoApi && (
        <section aria-labelledby="demo" className="flex flex-col gap-3 border-t border-linha pt-4">
          <h2 id="demo" className="text-lg font-bold">Entrar para demonstração</h2>
          <p className="max-w-[65ch] text-sm text-tinta2">
            Quatro contas fictícias, uma por perfil. Nenhum dado aqui pertence a pessoa real.
            Pelo formulário acima, qualquer uma delas entra com a senha <code>demonstracao</code>.
          </p>

          <ul className="flex flex-col gap-2">
            {PERFIS_DEMONSTRACAO.map((perfil) => (
              <li key={perfil}>
                <Botao
                  variante="grande"
                  className="flex-col items-start gap-0.5"
                  disabled={entrando}
                  onClick={() => void concluir(() => entrarDemonstracao(perfil))}
                >
                  <span className="font-bold">{NOME_DO_PERFIL[perfil]}</span>
                  <span className="text-[13px] font-normal text-tinta2">{DESCRICAO_DEMONSTRACAO[perfil]}</span>
                </Botao>
              </li>
            ))}
          </ul>
        </section>
        )}

        {/* A etapa 9 troca este link pela raiz, quando o site comercial existir. */}
        <p className="border-t border-linha pt-4 text-sm">
          <Link to="/sobre" className="font-bold text-cli-ink underline">Conhecer o SINCTEA</Link>
        </p>
      </div>
    </LayoutAcesso>
  )
}
