import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Tela } from '../LayoutApp'
import { emDataCivil } from '@sinctea/compartilhado/dominio/datas'
import { BotaoLink } from '../../ui/Botao'
import { Titulo } from '../../ui/Titulo'
import { usarSessao } from '../../contexto/Sessao'
import { ErroServico, servicos, type CartaoEscola } from '../../servicos'
import { EstadoCarregando } from '../../ui/EstadoCarregando'
import { EstadoErro } from '../../ui/EstadoErro'
import { EstadoVazio } from '../../ui/EstadoVazio'

/**
 * Tela 18 · Cartao de estrategias · /app/escola/:pacienteId
 *
 * A verificacao de consentimento acontece no servico, antes de qualquer
 * leitura, e a consulta entra na auditoria. Turma e turno vem do
 * VinculoEscolar — nada aqui e fixo no codigo.
 *
 * Acesso revogado ou vencido nao e falha: e a decisao da familia, ou o prazo
 * que ela deu. A tela diz isso e leva de volta, sem "Tentar de novo" — tentar
 * de novo daria o mesmo resultado, e sugeriria defeito onde nao ha.
 *
 * Item 20: h1 o aluno e a turma; h2 cada estrategia; h3 "Para que serve", "O
 * que fazer", "O que evitar" e "Sinal de alerta". O texto e corrido e
 * justificado, em 15px. Os tres blocos ficam em tres colunas da mesma altura a
 * partir de lg; entre md e lg, fazer e evitar lado a lado e o alerta embaixo,
 * na largura toda; no celular, um embaixo do outro, na mesma ordem.
 */

type Encerramento = 'REVOGADO' | 'EXPIRADO'

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'encerrado'; como: Encerramento; primeiroNome: string | null }
  | { tipo: 'pronto'; cartao: CartaoEscola }

function encerramento(erro: unknown): Encerramento | null {
  if (!(erro instanceof ErroServico) || erro.codigo !== 'ACESSO_NEGADO') return null
  if (erro.motivo === 'CONSENTIMENTO_REVOGADO') return 'REVOGADO'
  if (erro.motivo === 'CONSENTIMENTO_EXPIRADO') return 'EXPIRADO'
  return null
}

/**
 * O cartao negado nao traz o nome; a lista de alunos traz, porque a linha de
 * quem encerrou continua nela (passo 27 do diagrama de sequencia).
 */
async function primeiroNomeDoAluno(pacienteId: string): Promise<string | null> {
  try {
    const alunos = await servicos.areaEscola.listarAlunos({ porPagina: 100 })
    return alunos.itens.find((a) => a.pacienteId === pacienteId)?.nome ?? null
  } catch {
    return null
  }
}

export function CartaoEstrategias() {
  const { pacienteId = '' } = useParams()
  const { usuario } = usarSessao()
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true
    setEstado({ tipo: 'carregando' })
    servicos.areaEscola.obterCartao(pacienteId)
      .then((cartao) => { if (ativo) setEstado({ tipo: 'pronto', cartao }) })
      .catch(async (erro) => {
        const como = encerramento(erro)
        if (!como) {
          if (ativo) setEstado({ tipo: 'erro', erro })
          return
        }
        const primeiroNome = await primeiroNomeDoAluno(pacienteId)
        if (ativo) setEstado({ tipo: 'encerrado', como, primeiroNome })
      })
    return () => { ativo = false }
  }, [pacienteId, tentativa])

  const aluno = estado.tipo === 'pronto' ? `${estado.cartao.nome} · ${estado.cartao.turma}` : 'Cartão de estratégias'

  return (
    <Tela
      area="esc"
      nome={usuario?.nome}
      papel={estado.tipo === 'pronto' ? `${estado.cartao.turma} · ${estado.cartao.turno}` : undefined}
      caminho={['Área da escola', { rotulo: 'Meus alunos', para: '/app/escola' }, estado.tipo === 'pronto' ? estado.cartao.nome : 'Cartão de estratégias']}
    >
      <Titulo sub="Orientações práticas para o dia a dia em sala. Não é diagnóstico nem laudo.">
        {aluno}
      </Titulo>

      {estado.tipo === 'carregando' && (
        <EstadoCarregando forma="cartoes" quantidade={2} rotulo="Carregando o cartão de estratégias" />
      )}

      {estado.tipo === 'erro' && (
        <EstadoErro
          erro={estado.erro}
          oQue="o cartão de estratégias"
          area="esc"
          aoTentarDeNovo={() => setTentativa((t) => t + 1)}
        />
      )}

      {estado.tipo === 'encerrado' && (
        <EstadoVazio
          area="esc"
          titulo={estado.como === 'REVOGADO' ? 'A família encerrou este acesso.' : 'A autorização venceu.'}
          explicacao={estado.como === 'REVOGADO'
            ? `Você não vê mais as orientações ${estado.primeiroNome ? `de ${estado.primeiroNome}` : 'deste aluno'}. Se precisar, fale com a família ou com a equipe terapêutica.`
            : 'O prazo que a família definiu terminou. Uma nova autorização precisa partir dela.'}
          acao={<Link to="/app/escola" className="inline-flex min-h-11 items-center font-bold text-esc-ink underline">Voltar para meus alunos</Link>}
        />
      )}

      {estado.tipo === 'pronto' && (
        estado.cartao.estrategias.length === 0 ? (
          <EstadoVazio
            area="esc"
            titulo="Ainda não há estratégias para este aluno"
            explicacao="O profissional da clínica escreve o cartão a partir dos objetivos do plano. Assim que o primeiro for publicado, ele aparece aqui."
            acao={<Link to="/app/escola" className="inline-flex min-h-11 items-center font-bold text-esc-ink underline">Voltar para meus alunos</Link>}
          />
        ) : (
          <>
            {/* Com mais de uma estrategia, cada uma no seu bloco, com uma linha
                entre elas. */}
            <div className="flex flex-col gap-6">
              {estado.cartao.estrategias.map((e) => (
                <article key={e.titulo} className="flex flex-col gap-4 border-linha not-first:border-t not-first:pt-6">
                  <h2 className="text-lg font-bold">{e.titulo}</h2>

                  <div>
                    <h3 className="text-base font-bold">Para que serve</h3>
                    <p className="texto-corrido mt-1 text-[15px]">{e.paraQue}</p>
                  </div>

                  <div className="grid gap-3 [&>*]:min-w-0 md:grid-cols-2 lg:grid-cols-3">
                    <section className="rounded-xl border border-linha border-l-4 border-l-ok bg-ok-sup p-4">
                      <h3 className="flex items-center gap-2 text-base font-bold">
                        <span aria-hidden="true">✓</span> O que fazer
                      </h3>
                      <ul className="mt-2 grid list-disc gap-2 pl-5 text-[15px] text-tinta2">
                        {e.oQueFazer.map((i) => <li key={i} className="texto-corrido">{i}</li>)}
                      </ul>
                    </section>

                    <section className="rounded-xl border border-linha border-l-4 border-l-cr bg-cr-sup p-4">
                      <h3 className="flex items-center gap-2 text-base font-bold">
                        <span aria-hidden="true">✕</span> O que evitar
                      </h3>
                      <ul className="mt-2 grid list-disc gap-2 pl-5 text-[15px] text-tinta2">
                        {e.oQueEvitar.map((i) => <li key={i} className="texto-corrido">{i}</li>)}
                      </ul>
                    </section>

                    <section className="rounded-xl border border-linha border-l-4 border-l-at bg-at-sup p-4 md:col-span-2 lg:col-span-1">
                      <h3 className="flex items-center gap-2 text-base font-bold">
                        <span aria-hidden="true">▲</span> Sinal de alerta
                      </h3>
                      <p className="texto-corrido mt-2 text-[15px] text-tinta2">{e.sinalAlerta}</p>
                    </section>
                  </div>
                </article>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-linha pt-3">
              <span className="text-sm text-tinta2">
                Autorizado pela família até {emDataCivil(estado.cartao.validadeAte)}.
                <br />Sua consulta fica registrada.
              </span>
              {/* Item 10: so com o escopo de registro, que e a familia quem da. */}
              {estado.cartao.escopos.includes('REGISTRO_OCORRENCIA') && (
                <BotaoLink para={`/app/escola/${pacienteId}/ocorrencia`} area="esc" className="w-full sm:w-auto">
                  Registrar uma ocorrência
                </BotaoLink>
              )}
            </div>
          </>
        )
      )}
    </Tela>
  )
}
