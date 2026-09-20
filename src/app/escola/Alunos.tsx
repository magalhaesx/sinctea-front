import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cartao, Etiqueta, Titulo } from '../../componentes/ui'
import { servicos, type AlunoEscola, type Pagina } from '../../servicos'
import { EstadoCarregando } from '../../ui/EstadoCarregando'
import { EstadoErro } from '../../ui/EstadoErro'
import { EstadoVazio } from '../../ui/EstadoVazio'
import { Tela } from '../LayoutApp'

/**
 * Lista de alunos do professor · /app/escola
 *
 * Porta de entrada da area da escola: um professor pode ter mais de um aluno
 * autorizado, e o mapa de rotas so previa /app/escola/:pacienteId.
 *
 * So aparece aqui quem tem consentimento vigente — a verificacao acontece no
 * servico, a cada leitura. Nenhum conteudo clinico: nome, o que a familia
 * autorizou e ate quando.
 */

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'pronto'; dados: Pagina<AlunoEscola> }

const ESCOPO = {
  CARTAO_ESTRATEGIA: 'Cartão de estratégias',
  REGISTRO_OCORRENCIA: 'Registro de ocorrência',
} as const

export function Alunos() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true
    setEstado({ tipo: 'carregando' })
    servicos.areaEscola.listarAlunos()
      .then((dados) => { if (ativo) setEstado({ tipo: 'pronto', dados }) })
      .catch((erro) => { if (ativo) setEstado({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [tentativa])

  return (
    <Tela area="esc" caminho={['Área da escola', 'Meus alunos']}>
      <Titulo sub="Alunos cujas famílias autorizaram o seu acesso">Meus alunos</Titulo>

      {estado.tipo === 'carregando' && (
        <EstadoCarregando forma="lista" linhas={2} rotulo="Carregando seus alunos" />
      )}

      {estado.tipo === 'erro' && (
        <EstadoErro
          erro={estado.erro}
          oQue="a lista de alunos"
          area="esc"
          aoTentarDeNovo={() => setTentativa((t) => t + 1)}
        />
      )}

      {estado.tipo === 'pronto' && (
        estado.dados.itens.length === 0 ? (
          <EstadoVazio
            area="esc"
            titulo="Nenhum aluno autorizado neste momento"
            explicacao="Quem autoriza o acesso é o responsável pelo aluno, e cada autorização tem prazo. Se o acesso terminou ou ainda não começou, peça à família um novo convite."
            acao={<Link to="/app/ajuda" className="inline-flex min-h-11 items-center font-bold text-esc-ink underline">Ver como funciona o acesso da escola</Link>}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {estado.dados.itens.map((aluno) => (
              <li key={aluno.pacienteId}>
                <Cartao>
                  <h2 className="text-lg font-bold">
                    {aluno.situacao === 'VIGENTE' ? (
                      <Link to={`/app/escola/${aluno.pacienteId}`} className="text-esc-ink underline">
                        {aluno.nome}
                      </Link>
                    ) : (
                      aluno.nome
                    )}
                  </h2>
                  {/* Turma e turno vem do VinculoEscolar. */}
                  <p className="text-sm text-tinta2">{aluno.turma} · {aluno.turno}</p>

                  {aluno.situacao === 'VIGENTE' ? (
                    <>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {aluno.escopos.map((e) => (
                          <li key={e}><Etiqueta tom="ok" simbolo="✓">{ESCOPO[e]}</Etiqueta></li>
                        ))}
                      </ul>
                      <p className="mt-2 text-sm text-tinta2">
                        Acesso autorizado até {new Date(aluno.validadeAte).toLocaleDateString('pt-BR')}.
                      </p>
                    </>
                  ) : (
                    <>
                      {/* Tom neutro: encerrar o acesso e decisao legitima da familia,
                          nao erro. A linha permanece para que o professor saiba o que
                          aconteceu, sem caminho de entrada. */}
                      <p className="mt-2"><Etiqueta simbolo="○">Acesso encerrado pela família</Etiqueta></p>
                      <p className="mt-2 max-w-[65ch] text-sm text-tinta2">
                        {aluno.situacao === 'EXPIRADO'
                          ? 'O prazo que a família autorizou terminou. Para voltar a ver o cartão, peça a ela um novo convite.'
                          : 'A família encerrou este acesso. Para voltar a ver o cartão, peça a ela um novo convite.'}
                      </p>
                    </>
                  )}
                </Cartao>
              </li>
            ))}
          </ul>
        )
      )}
    </Tela>
  )
}
