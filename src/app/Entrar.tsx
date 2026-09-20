import { useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Botao, Campo, Titulo } from '../componentes/ui'
import { usarSessao } from '../contexto/Sessao'
import { ErroServico, type Perfil } from '../servicos'
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
  const { entrar, entrarDemonstracao } = usarSessao()
  const navegar = useNavigate()
  const local = useLocation()
  const campoEmail = useRef<HTMLInputElement>(null)

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)
  const [mostrarAjudaSenha, setMostrarAjudaSenha] = useState(false)

  // Volta para a tela que a pessoa tentou abrir antes de ser mandada ao login.
  const destino = (local.state as { destino?: string } | null)?.destino ?? '/app'

  const concluir = async (acao: () => Promise<void>) => {
    setErro(null)
    setEntrando(true)
    try {
      await acao()
      navegar(destino, { replace: true })
    } catch (e) {
      // Mensagem unica: nao diz se o e-mail existe (docs/03, tela 1).
      setErro(e instanceof ErroServico && e.codigo === 'NAO_AUTENTICADO'
        ? 'E-mail ou senha incorretos.'
        : 'Não foi possível entrar agora. Tente de novo em alguns segundos.')
      campoEmail.current?.focus()
    } finally {
      setEntrando(false)
    }
  }

  const enviar = (evento: FormEvent) => {
    evento.preventDefault()
    void concluir(() => entrar(email, senha))
  }

  const campo = 'min-h-11 rounded-lg border border-linha bg-sup px-3 text-[15px]'

  return (
    <LayoutAcesso>
      <div className="flex flex-col gap-4 rounded-2xl border border-cromo-linha bg-fundo p-5 text-tinta sm:p-6">
        <Titulo sub="A informação acompanha a pessoa, não a instituição">Entrar no SINCTEA</Titulo>

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
                Esta versão ainda não redefine senha sozinha. Peça à coordenação da clínica para
                gerar uma nova — ela chega no seu e-mail cadastrado.
              </p>
            )}
          </div>
        </form>

        {/* Bloco de demonstracao: separado por linha e rotulo claro, para
            mostrar o sistema sem cadastro (docs/03, tela 1). */}
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

        {/* A etapa 9 troca este link pela raiz, quando o site comercial existir. */}
        <p className="border-t border-linha pt-4 text-sm">
          <Link to="/sobre" className="font-bold text-cli-ink underline">Conhecer o SINCTEA</Link>
        </p>
      </div>
    </LayoutAcesso>
  )
}
