import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Botao } from '../ui/Botao'
import { Campo } from '../ui/Campo'
import { Titulo } from '../ui/Titulo'
import { usarSessao } from '../contexto/Sessao'
import { ErroServico, servicos, type PrimeiroAcessoPublico } from '../servicos'
import { EstadoCarregando } from '../ui/EstadoCarregando'
import { EstadoErro } from '../ui/EstadoErro'
import { LayoutAcesso } from './LayoutAcesso'

/**
 * Primeiro acesso · /app/primeiro-acesso/:token
 *
 * Quem cadastra a equipe ou o responsavel entrega um link de uso unico, que
 * vale 72 horas (docs/07, secao 0, lacuna 1). A pessoa define a propria
 * senha aqui: quem cadastra nunca conhece a senha de ninguem.
 *
 * Mesmo desenho da tela 2 (convite do professor): o nome e o e-mail da conta
 * aparecem antes do formulario, para a pessoa reconhecer que o link e dela.
 */

const RECUSA: Record<Exclude<PrimeiroAcessoPublico['situacao'], 'VALIDO'>, { titulo: string; texto: string }> = {
  USADO: {
    titulo: 'Este link já foi usado',
    texto: 'Cada link vale para definir a senha uma única vez. Se a conta é sua, entre com o seu e-mail e a senha que você escolheu.',
  },
  EXPIRADO: {
    titulo: 'Este link venceu',
    texto: 'O link vale por 72 horas. Peça um novo a quem cadastrou você: a conta continua lá, só o link venceu.',
  },
  INEXISTENTE: {
    titulo: 'Este link não existe',
    texto: 'Confira se o endereço chegou inteiro. Se um link mais novo foi enviado, só ele vale.',
  },
}

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'pronto'; acesso: PrimeiroAcessoPublico }

export function PrimeiroAcesso() {
  const { token = '' } = useParams()
  const { entrarComPrimeiroAcesso } = usarSessao()
  const navegar = useNavigate()

  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erros, setErros] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let ativo = true
    setEstado({ tipo: 'carregando' })
    servicos.autenticacao.obterPrimeiroAcesso(token)
      .then((acesso) => { if (ativo) setEstado({ tipo: 'pronto', acesso }) })
      .catch((erro) => { if (ativo) setEstado({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [token, tentativa])

  const definirSenha = async (evento: FormEvent) => {
    evento.preventDefault()
    if (senha !== confirmacao) {
      setErros({ confirmacao: 'As duas senhas não conferem.' })
      return
    }
    setErros({})
    setEnviando(true)
    try {
      await entrarComPrimeiroAcesso(token, senha)
      navegar('/app', { replace: true })
    } catch (e) {
      const erro = e as ErroServico
      setErros(erro.campos && Object.keys(erro.campos).length > 0
        ? erro.campos
        : { geral: erro.message ?? 'Não foi possível definir a senha agora.' })
    } finally {
      setEnviando(false)
    }
  }

  const campo = 'min-h-11 w-full rounded-lg border border-linha bg-sup px-3 text-[15px]'

  return (
    <LayoutAcesso>
      <div className="flex flex-col gap-4 rounded-2xl border border-cromo-linha bg-fundo p-5 text-tinta sm:p-6">
        {estado.tipo === 'carregando' && (
          <EstadoCarregando forma="texto" linhas={3} rotulo="Conferindo o link" />
        )}

        {estado.tipo === 'erro' && (
          <EstadoErro erro={estado.erro} oQue="este link" aoTentarDeNovo={() => setTentativa((t) => t + 1)} />
        )}

        {estado.tipo === 'pronto' && estado.acesso.situacao !== 'VALIDO' && (
          <>
            <Titulo>{RECUSA[estado.acesso.situacao].titulo}</Titulo>
            <p className="max-w-[65ch] text-tinta2">{RECUSA[estado.acesso.situacao].texto}</p>
            <p><Link to="/app/entrar" className="font-bold text-cli-ink underline">Ir para a entrada do sistema</Link></p>
          </>
        )}

        {estado.tipo === 'pronto' && estado.acesso.situacao === 'VALIDO' && (
          <>
            <Titulo sub={`A conta de ${estado.acesso.nome} (${estado.acesso.email}) está pronta. Falta só a sua senha.`}>
              Definir minha senha
            </Titulo>

            <form className="flex flex-col gap-4" onSubmit={definirSenha} noValidate>
              <div role="alert" aria-live="assertive">
                {erros.geral && (
                  <p className="rounded-xl border border-linha border-l-4 border-l-cr bg-cr-sup p-3 font-bold text-cr">
                    <span aria-hidden="true">▲ </span>{erros.geral}
                  </p>
                )}
              </div>

              {/* O e-mail vai junto, escondido, para o gerenciador de senhas
                  guardar a senha nova com o login certo. */}
              <input type="email" autoComplete="username" value={estado.acesso.email ?? ''} readOnly hidden />

              <Campo id="senha" rotulo="Crie uma senha" dica="Ao menos 8 caracteres. Só você vai conhecê-la.">
                <input id="senha" type="password" autoComplete="new-password" className={campo}
                  value={senha} onChange={(e) => setSenha(e.target.value)}
                  aria-describedby={erros.senha ? 'erro-senha' : undefined} />
                {erros.senha && <p id="erro-senha" className="text-sm font-bold text-cr">{erros.senha}</p>}
              </Campo>

              <Campo id="confirmacao" rotulo="Repita a senha">
                <input id="confirmacao" type="password" autoComplete="new-password" className={campo}
                  value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)}
                  aria-describedby={erros.confirmacao ? 'erro-confirmacao' : undefined} />
                {erros.confirmacao && <p id="erro-confirmacao" className="text-sm font-bold text-cr">{erros.confirmacao}</p>}
              </Campo>

              <Botao type="submit" disabled={enviando}>{enviando ? 'Salvando…' : 'Definir senha e entrar'}</Botao>
            </form>
          </>
        )}
      </div>
    </LayoutAcesso>
  )
}
