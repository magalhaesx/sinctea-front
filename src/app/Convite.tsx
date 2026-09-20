import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Botao } from '../ui/Botao'
import { Campo } from '../ui/Campo'
import { Cartao } from '../ui/Cartao'
import { Etiqueta } from '../ui/Etiqueta'
import { Titulo } from '../ui/Titulo'
import { usarSessao } from '../contexto/Sessao'
import { ErroServico, servicos, type ConvitePublico } from '../servicos'
import { EstadoCarregando } from '../ui/EstadoCarregando'
import { EstadoErro } from '../ui/EstadoErro'
import { LayoutAcesso } from './LayoutAcesso'
import { NUNCA_VISIVEL } from './limites'

/**
 * Tela 2 · Aceitar convite · /app/convite/:token
 *
 * Unico caminho de entrada da escola: nao existe autocadastro de professor.
 * O convite e de uso unico e expira em 72 horas.
 *
 * A escola foi nomeada pela familia no consentimento e aparece ANTES do
 * formulario: e assim que o professor distingue um convite legitimo. Ele
 * declara apenas turma, turno e atuacao.
 */

const ESCOPO: Record<string, string> = {
  CARTAO_ESTRATEGIA: 'Cartão de estratégias',
  REGISTRO_OCORRENCIA: 'Registrar o que acontece na escola',
}

const RECUSA: Record<Exclude<ConvitePublico['situacao'], 'VALIDO'>, { titulo: string; texto: string }> = {
  USADO: {
    titulo: 'Este convite já foi usado',
    texto: 'Cada convite vale para um único cadastro. Se a conta é sua, entre com seu e-mail e senha. Se não é, peça à família um convite novo.',
  },
  EXPIRADO: {
    titulo: 'Este convite expirou',
    texto: 'O convite vale por 72 horas. Peça à família que gere outro: a autorização dela continua valendo, só o convite venceu.',
  },
  CONSENTIMENTO_REVOGADO: {
    titulo: 'A família encerrou esta autorização',
    texto: 'O acesso foi encerrado antes de o cadastro ser feito. Quem decide é a família; converse com ela se ainda for necessário.',
  },
}

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'pronto'; convite: ConvitePublico }

export function Convite() {
  const { token = '' } = useParams()
  const { entrarComConvite } = usarSessao()
  const navegar = useNavigate()

  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)
  const [dados, setDados] = useState({ nome: '', email: '', senha: '', turma: '', turno: '', atuacao: '' })
  const [erros, setErros] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let ativo = true
    setEstado({ tipo: 'carregando' })
    servicos.convites.obter(token)
      .then((convite) => { if (ativo) setEstado({ tipo: 'pronto', convite }) })
      .catch((erro) => { if (ativo) setEstado({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [token, tentativa])

  const campo = (chave: keyof typeof dados) => ({
    id: chave,
    className: 'min-h-11 w-full rounded-lg border border-linha bg-sup px-3 text-[15px]',
    value: dados[chave],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDados((d) => ({ ...d, [chave]: e.target.value })),
  })

  const criarConta = async (evento: FormEvent) => {
    evento.preventDefault()
    setErros({})
    setEnviando(true)
    try {
      await entrarComConvite(token, dados)
      navegar('/app/escola', { replace: true })
    } catch (e) {
      const erro = e as ErroServico
      setErros(erro.campos && Object.keys(erro.campos).length > 0
        ? erro.campos
        : { geral: erro.message ?? 'Não foi possível criar a conta agora.' })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <LayoutAcesso>
      <div className="flex flex-col gap-4 rounded-2xl border border-cromo-linha bg-fundo p-5 text-tinta sm:p-6">
        {estado.tipo === 'carregando' && (
          <EstadoCarregando forma="texto" linhas={4} rotulo="Conferindo o convite" />
        )}

        {estado.tipo === 'erro' && (
          <EstadoErro
            erro={estado.erro}
            oQue="este convite"
            area="esc"
            aoTentarDeNovo={() => setTentativa((t) => t + 1)}
          />
        )}

        {estado.tipo === 'pronto' && estado.convite.situacao !== 'VALIDO' && (
          <>
            <Titulo>{RECUSA[estado.convite.situacao].titulo}</Titulo>
            <p className="max-w-[65ch] text-tinta2">{RECUSA[estado.convite.situacao].texto}</p>
            <p><Link to="/app/entrar" className="font-bold text-esc-ink underline">Ir para a entrada do sistema</Link></p>
          </>
        )}

        {estado.tipo === 'pronto' && estado.convite.situacao === 'VALIDO' && (
          <>
            <Titulo sub={`${estado.convite.responsavel} convidou você a acompanhar ${estado.convite.aluno} na ${estado.convite.escola}.`}>
              Criar minha conta de professor
            </Titulo>

            <Cartao>
              <h2 className="text-base font-bold">O que você poderá ver</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {estado.convite.escopos.map((e) => (
                  <li key={e}><Etiqueta tom="ok" simbolo="✓">{ESCOPO[e] ?? e}</Etiqueta></li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-tinta2">
                O acesso vale até {new Date(estado.convite.validadeAte!).toLocaleDateString('pt-BR')} e
                a família pode encerrá-lo quando quiser.
              </p>

              {/* A lista do que ele NAO vera aparece antes do formulario. */}
              <h2 className="mt-4 text-base font-bold">O que você nunca verá</h2>
              <ul className="mt-2 flex flex-col gap-2">
                {NUNCA_VISIVEL.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-tinta2">
                    <svg className="mt-0.5 h-5 w-5 flex-none" viewBox="0 0 24 24" role="img" aria-label="Bloqueado" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M5.6 5.6l12.8 12.8" />
                    </svg>
                    {b}
                  </li>
                ))}
              </ul>
            </Cartao>

            <form className="flex flex-col gap-4" onSubmit={criarConta} noValidate>
              <div role="alert" aria-live="assertive">
                {erros.geral && (
                  <p className="rounded-xl border border-linha border-l-4 border-l-cr bg-cr-sup p-3 font-bold text-cr">
                    <span aria-hidden="true">▲ </span>{erros.geral}
                  </p>
                )}
              </div>

              <Campo id="nome" rotulo="Seu nome">
                <input type="text" autoComplete="name" {...campo('nome')} />
                {erros.nome && <p className="text-sm font-bold text-cr">{erros.nome}</p>}
              </Campo>

              <Campo id="email" rotulo="Seu e-mail">
                <input type="email" autoComplete="email" {...campo('email')} />
                {erros.email && <p className="text-sm font-bold text-cr">{erros.email}</p>}
              </Campo>

              <Campo id="senha" rotulo="Crie uma senha" dica="Ao menos 8 caracteres.">
                <input type="password" autoComplete="new-password" {...campo('senha')} />
                {erros.senha && <p className="text-sm font-bold text-cr">{erros.senha}</p>}
              </Campo>

              {/* A escola ja foi nomeada pela familia: nao se pergunta aqui. */}
              <Campo id="turma" rotulo="Turma do aluno">
                <input type="text" {...campo('turma')} />
                {erros.turma && <p className="text-sm font-bold text-cr">{erros.turma}</p>}
              </Campo>

              <Campo id="turno" rotulo="Turno">
                <input type="text" {...campo('turno')} />
                {erros.turno && <p className="text-sm font-bold text-cr">{erros.turno}</p>}
              </Campo>

              <Campo id="atuacao" rotulo="Como você atua com este aluno" dica="Professor regente, atendimento educacional especializado, acompanhante.">
                <input type="text" {...campo('atuacao')} />
                {erros.atuacao && <p className="text-sm font-bold text-cr">{erros.atuacao}</p>}
              </Campo>

              <Botao area="esc" type="submit" disabled={enviando}>
                {enviando ? 'Criando…' : 'Criar minha conta'}
              </Botao>
            </form>
          </>
        )}
      </div>
    </LayoutAcesso>
  )
}
