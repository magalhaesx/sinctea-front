import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Botao } from '../ui/Botao'
import { Campo } from '../ui/Campo'
import { Titulo } from '../ui/Titulo'
import { usarSessao } from '../contexto/Sessao'
import { AVISO_AMBIENTE } from '../componentes/AvisoAmbiente'
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
 * O aviso do ambiente fica aqui e no rodape (docs/07, secao 0). A entrada de
 * demonstracao so existe com o mock: na versao publicada, nem entra no pacote.
 *
 * Uma conta por aba (item 9): a aba sem conta mostra, acima do formulario, as
 * contas ja abertas neste navegador, para continuar numa delas sem senha nova.
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
  const campoEmail = useRef<HTMLInputElement>(null)

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)
  const [mostrarAjudaSenha, setMostrarAjudaSenha] = useState(false)
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

  const campo = 'min-h-11 rounded-lg border border-linha bg-sup px-3 text-[15px]'

  return (
    <LayoutAcesso rodape={false}>
      <div className="flex flex-col gap-4 rounded-2xl border border-cromo-linha bg-fundo p-5 text-tinta sm:p-6">
        <Titulo sub="A informação acompanha a pessoa, não a instituição">Entrar no SINCTEA</Titulo>

        <p className="rounded-xl border border-linha border-l-4 border-l-at bg-at-sup p-3 text-sm font-bold">
          {AVISO_AMBIENTE}
        </p>

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
            <input
              id="senha"
              type="password"
              autoComplete="current-password"
              className={campo}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              aria-describedby={erro ? 'erro-entrada' : undefined}
            />
          </Campo>

          <Botao type="submit" disabled={entrando}>{entrando ? 'Entrando…' : 'Entrar'}</Botao>

          <div>
            <button
              type="button"
              className="min-h-11 cursor-pointer text-[15px] font-bold text-cli-ink underline"
              aria-expanded={mostrarAjudaSenha}
              onClick={() => setMostrarAjudaSenha((v) => !v)}
            >
              Esqueci minha senha
            </button>
            {mostrarAjudaSenha && (
              <p className="max-w-[65ch] text-sm text-tinta2">
                Esta versão ainda não redefine senha sozinha, nem manda e-mail. Se você é da
                equipe da clínica, peça à administração um novo link de acesso: com ele, você
                define outra senha. Se você é responsável por um paciente, peça à clínica: a
                coordenação gera um link para você escolher uma nova senha. Para a escola, a
                redefinição ainda não existe.
              </p>
            )}
          </div>
        </form>

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
