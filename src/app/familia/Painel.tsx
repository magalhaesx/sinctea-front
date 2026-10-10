import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Tela } from '../LayoutApp'
import { Aviso } from '../../ui/Aviso'
import { BotaoLink } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { Cartao } from '../../ui/Cartao'
import { Etiqueta } from '../../ui/Etiqueta'
import { Medidor } from '../../ui/Medidor'
import { Titulo } from '../../ui/Titulo'
import { EstadoCarregando } from '../../ui/EstadoCarregando'
import { EstadoErro } from '../../ui/EstadoErro'
import { usarSessao } from '../../contexto/Sessao'
import { emData } from '../../dominio/datas'
import { frequenciaEmLinguagemCotidiana, frequenciaSemanalEmPalavras } from '../../dominio/regras'
import {
  servicos, type AtividadeCasa, type ConsentimentoDetalhe, type FilhoResumo,
  type ObjetivoAcessivel,
} from '../../servicos'

/**
 * Tela 15 · Painel da familia · /app/familia (UC13)
 *
 * Nenhum termo clinico e nenhum numero cru: a evolucao vem so da redacao
 * acessivel do objetivo, escrita pelo terapeuta (regra 4), e a frequencia vem
 * sempre em palavras — "6 ou 7 de cada 10 vezes" comunica, "65%" nao.
 *
 * O texto nao usa artigo nem pronome para falar da crianca. O sistema nao sabe
 * o genero de ninguem a partir do nome, e nao vai passar a saber: a frase se
 * escreve pelo primeiro nome, sempre.
 */

type Estado<T> =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'pronto'; dados: T }

interface DadosDoFilho {
  objetivos: ObjetivoAcessivel[]
  atividades: AtividadeCasa[]
  consentimentos: ConsentimentoDetalhe[]
}

/** O que dizer sobre o acesso da escola, caso a caso. */
function situacaoDaEscola(c: ConsentimentoDetalhe): { tom: 'ok' | 'at' | 'neutro'; titulo: string; texto: string } {
  if (c.situacao === 'VIGENTE' && !c.conviteAceito) {
    return {
      tom: 'at',
      titulo: `Convite entregue, ${c.escola} ainda não entrou`,
      texto: 'O professor precisa criar a conta pelo convite que você entregou. Enquanto isso, ninguém da escola vê nada.',
    }
  }
  if (c.situacao === 'VIGENTE') {
    return {
      tom: 'ok',
      titulo: `${c.escola} tem acesso até ${emData(c.validadeAte)}`,
      texto: `${c.professor} é quem acessa. Você pode encerrar quando quiser, e o encerramento vale na hora.`,
    }
  }
  if (c.situacao === 'AGUARDANDO_INICIO') {
    return {
      tom: 'neutro',
      titulo: `${c.escola} ainda não começou a acessar`,
      texto: `O acesso que você autorizou começa a valer e vai até ${emData(c.validadeAte)}.`,
    }
  }
  if (c.situacao === 'REVOGADO') {
    return {
      tom: 'neutro',
      titulo: `Você encerrou o acesso de ${c.escola}`,
      texto: 'A escola não vê mais nada. Se quiser autorizar de novo, é só fazer uma autorização nova.',
    }
  }
  return {
    tom: 'neutro',
    titulo: `O prazo de ${c.escola} terminou`,
    texto: `O acesso valia até ${emData(c.validadeAte)} e se encerrou sozinho. Para voltar, faça uma autorização nova.`,
  }
}

export function PainelFamilia() {
  const { usuario } = usarSessao()
  const [filhos, setFilhos] = useState<Estado<FilhoResumo[]>>({ tipo: 'carregando' })
  const [pacienteId, setPacienteId] = useState<string | null>(null)
  const [dados, setDados] = useState<Estado<DadosDoFilho>>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true
    setFilhos({ tipo: 'carregando' })
    servicos.familia.listarFilhos({ porPagina: 20 })
      .then((p) => {
        if (!ativo) return
        setFilhos({ tipo: 'pronto', dados: p.itens })
        setPacienteId((atual) => atual ?? p.itens[0]?.id ?? null)
      })
      .catch((erro) => { if (ativo) setFilhos({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [tentativa])

  useEffect(() => {
    if (!pacienteId) return
    let ativo = true
    setDados({ tipo: 'carregando' })
    Promise.all([
      servicos.familia.listarObjetivos(pacienteId, { porPagina: 20 }),
      servicos.atividades.listarPorPaciente(pacienteId, { ativa: true, porPagina: 20 }),
      servicos.consentimentos.listarPorPaciente(pacienteId, { porPagina: 20 }),
    ])
      .then(([objetivos, atividades, consentimentos]) => {
        if (!ativo) return
        setDados({
          tipo: 'pronto',
          dados: { objetivos: objetivos.itens, atividades: atividades.itens, consentimentos: consentimentos.itens },
        })
      })
      .catch((erro) => { if (ativo) setDados({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [pacienteId, tentativa])

  const recarregar = () => setTentativa((t) => t + 1)

  const filho = filhos.tipo === 'pronto'
    ? filhos.dados.find((f) => f.id === pacienteId)
    : undefined
  const primeiroNome = filho?.nome.split(' ')[0] ?? ''
  const campo = 'min-h-11 w-full rounded-lg border-2 border-linha bg-sup px-3 py-2.5 text-tinta'

  return (
    <Tela
      area="fam"
      nome={usuario?.nome}
      // So o parentesco: "Mae do Miguel" nao sobrevive a dois filhos.
      papel={filho?.parentesco}
      caminho={['Início']}
      estreito
    >
      {filhos.tipo === 'carregando' && (
        <EstadoCarregando forma="cartoes" quantidade={3} rotulo="Carregando o seu painel" />
      )}

      {filhos.tipo === 'erro' && (
        <EstadoErro erro={filhos.erro} oQue="o seu painel" area="fam" aoTentarDeNovo={recarregar} />
      )}

      {filhos.tipo === 'pronto' && filhos.dados.length === 0 && (
        <Cartao>
          <p className="text-tinta2">
            Nenhuma criança está vinculada à sua conta ainda. Fale com a clínica para que o
            vínculo seja registrado.
          </p>
        </Cartao>
      )}

      {filho && (
        <>
          <Titulo sub="Veja como está indo, o que fazer em casa nesta semana e quem tem acesso.">
            Como {primeiroNome} está indo
          </Titulo>

          {/* Com um filho so, nenhum seletor: nao se escolhe entre uma coisa. */}
          {filhos.tipo === 'pronto' && filhos.dados.length > 1 && (
            <Cartao>
              <Campo id="filho" rotulo="Ver o painel de">
                <select id="filho" className={campo} value={pacienteId ?? ''}
                  onChange={(e) => setPacienteId(e.target.value)}>
                  {filhos.dados.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </Campo>
            </Cartao>
          )}

          {dados.tipo === 'carregando' && (
            <EstadoCarregando forma="cartoes" quantidade={3} rotulo={`Carregando as informações de ${primeiroNome}`} />
          )}

          {dados.tipo === 'erro' && (
            <EstadoErro
              erro={dados.erro}
              oQue={`as informações de ${primeiroNome}`}
              area="fam"
              aoTentarDeNovo={recarregar}
            />
          )}

          {dados.tipo === 'pronto' && (
            <>
              <section aria-labelledby="h-evolucao" className="flex flex-col gap-3">
                <h2 id="h-evolucao" className="text-lg font-bold">Como está indo</h2>

                {dados.dados.objetivos.length === 0 ? (
                  <Cartao>
                    <p className="text-tinta2">
                      A equipe ainda não registrou objetivos para {primeiroNome}. Assim que
                      registrar, eles aparecem aqui.
                    </p>
                  </Cartao>
                ) : (
                  dados.dados.objetivos.map((o) => (
                    <Cartao key={o.id}>
                      {/* So a redacao acessivel: a tecnica nao sai do servico. */}
                      <h3 className="text-base font-bold">{o.descricaoAcessivel}</h3>
                      <div className="mt-3">
                        {/* A descricao ja e o h3 acima: repeti-la no rotulo
                            faria o leitor de tela dizer a frase duas vezes. */}
                        <Medidor
                          valor={o.percentualAtual}
                          area="fam"
                          rotulo="Frequência"
                          emPalavras={frequenciaEmLinguagemCotidiana(o.percentualAtual)}
                        />
                      </div>
                      {o.status === 'DOMINADO' && (
                        <p className="mt-2">
                          <Etiqueta tom="ok" simbolo="✓">Já consegue sozinho</Etiqueta>
                        </p>
                      )}
                    </Cartao>
                  ))
                )}
              </section>

              <section aria-labelledby="h-atividades" className="flex flex-col gap-3">
                <h2 id="h-atividades" className="text-lg font-bold">Atividades desta semana</h2>

                {dados.dados.atividades.length === 0 ? (
                  <Cartao>
                    <p className="text-tinta2">
                      Nenhuma atividade para fazer em casa agora. Quando a equipe sugerir uma, ela
                      aparece aqui.
                    </p>
                  </Cartao>
                ) : (
                  <ul className="flex flex-col gap-2.5">
                    {dados.dados.atividades.map((a) => (
                      <li key={a.id}>
                        <Cartao>
                          <h3 className="text-base font-bold">{a.titulo}</h3>
                          <p className="mt-0.5 text-sm text-tinta2">
                            {frequenciaSemanalEmPalavras(a.frequenciaSemanal)}
                          </p>
                          <div className="mt-3">
                            <BotaoLink para={`/app/familia/atividades/${a.id}`} area="fam" className="w-full">
                              Abrir e registrar
                            </BotaoLink>
                          </div>
                        </Cartao>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="h-escola" className="flex flex-col gap-3">
                <h2 id="h-escola" className="text-lg font-bold">Acesso da escola</h2>

                {dados.dados.consentimentos.length === 0 ? (
                  <Cartao>
                    <p className="text-tinta2">
                      Nenhuma escola tem acesso aos dados de {primeiroNome}.
                    </p>
                    <p className="mt-3">
                      <Link to="/app/familia/consentimento" className="font-bold text-fam-ink underline">
                        Autorizar uma escola
                      </Link>
                    </p>
                  </Cartao>
                ) : (
                  dados.dados.consentimentos.map((c) => {
                    const s = situacaoDaEscola(c)
                    return (
                      <Aviso key={c.id} tom={s.tom} titulo={s.titulo}>
                        {s.texto}{' '}
                        <Link to="/app/familia/consentimento" className="font-bold text-fam-ink underline">
                          Ver a autorização
                        </Link>
                      </Aviso>
                    )
                  })
                )}
              </section>
            </>
          )}
        </>
      )}
    </Tela>
  )
}
