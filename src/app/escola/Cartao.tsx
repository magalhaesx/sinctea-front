import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Tela } from '../LayoutApp'
import { Botao, Titulo } from '../../componentes/ui'
import { usarSessao } from '../../contexto/Sessao'
import { servicos, type CartaoEscola } from '../../servicos'
import { EstadoCarregando } from '../../ui/EstadoCarregando'
import { EstadoErro } from '../../ui/EstadoErro'
import { EstadoVazio } from '../../ui/EstadoVazio'

/**
 * Tela 18 · Cartao de estrategias · /app/escola/:pacienteId
 *
 * A verificacao de consentimento acontece no servico, antes de qualquer
 * leitura, e a consulta entra na auditoria. Turma e turno vem do
 * VinculoEscolar — nada aqui e fixo no codigo.
 */

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'pronto'; cartao: CartaoEscola }

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
      .catch((erro) => { if (ativo) setEstado({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [pacienteId, tentativa])

  const aluno = estado.tipo === 'pronto' ? `${estado.cartao.nome} · ${estado.cartao.turma}` : 'Cartão de estratégias'

  return (
    <Tela
      area="esc"
      nome={usuario?.nome}
      papel={estado.tipo === 'pronto' ? `${estado.cartao.turma} · ${estado.cartao.turno}` : undefined}
      caminho={['Área da escola', 'Meus alunos', estado.tipo === 'pronto' ? estado.cartao.nome : 'Cartão de estratégias']}
      estreito
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

      {estado.tipo === 'pronto' && (
        estado.cartao.estrategias.length === 0 ? (
          <EstadoVazio
            area="esc"
            titulo="Ainda não há estratégias para este aluno"
            explicacao="A terapeuta escreve o cartão a partir dos objetivos do plano. Assim que ela publicar o primeiro, ele aparece aqui."
            acao={<Link to="/app/escola" className="inline-flex min-h-11 items-center font-bold text-esc-ink underline">Voltar para meus alunos</Link>}
          />
        ) : (
          <>
            {estado.cartao.estrategias.map((e) => (
              <article key={e.titulo} className="flex flex-col gap-3">
                <h2 className="text-lg font-bold">{e.titulo}</h2>
                <p className="text-tinta2">{e.paraQue}</p>

                <section className="rounded-xl border border-linha border-l-4 border-l-ok bg-ok-sup p-4">
                  <h3 className="flex items-center gap-2 text-base font-bold">
                    <span aria-hidden="true">✓</span> O que fazer
                  </h3>
                  <ul className="mt-2 list-disc pl-5 text-tinta2">
                    {e.oQueFazer.map((i) => <li key={i} className="mb-1">{i}</li>)}
                  </ul>
                </section>

                <section className="rounded-xl border border-linha border-l-4 border-l-cr bg-cr-sup p-4">
                  <h3 className="flex items-center gap-2 text-base font-bold">
                    <span aria-hidden="true">✕</span> O que evitar
                  </h3>
                  <ul className="mt-2 list-disc pl-5 text-tinta2">
                    {e.oQueEvitar.map((i) => <li key={i} className="mb-1">{i}</li>)}
                  </ul>
                </section>

                <section className="rounded-xl border border-linha border-l-4 border-l-at bg-at-sup p-4">
                  <h3 className="flex items-center gap-2 text-base font-bold">
                    <span aria-hidden="true">▲</span> Sinal de alerta
                  </h3>
                  <p className="mt-2 text-tinta2">{e.sinalAlerta}</p>
                </section>
              </article>
            ))}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-linha pt-3">
              <span className="text-sm text-tinta2">
                Autorizado pela família até {new Date(estado.cartao.validadeAte).toLocaleDateString('pt-BR')}.
                <br />Sua consulta fica registrada.
              </span>
              <Link to={`/app/escola/${pacienteId}/ocorrencia`}>
                <Botao area="esc">Registrar uma ocorrência</Botao>
              </Link>
            </div>
          </>
        )
      )}
    </Tela>
  )
}
