import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Tela } from '../LayoutApp'
import { BotaoLink } from '../../ui/Botao'
import { Cartao } from '../../ui/Cartao'
import { Etiqueta } from '../../ui/Etiqueta'
import { Titulo } from '../../ui/Titulo'
import { EstadoCarregando } from '../../ui/EstadoCarregando'
import { EstadoErro } from '../../ui/EstadoErro'
import { descricaoNivelSuporte } from '../../dominio/regras'
import {
  ErroServico, servicos, type PacienteDetalhe, type SituacaoConsentimento, type SituacaoPlano,
} from '../../servicos'

/**
 * Tela 5 · Ficha do paciente · /app/clinica/pacientes/:id (UC01)
 *
 * A rede de apoio marca quem responde legalmente: so o responsavel legal
 * autoriza o acesso da escola (regra 1 do CLAUDE.md). Quem olha a ficha
 * precisa saber a quem recorrer sem abrir outra tela.
 */

const SITUACAO_PLANO: Record<SituacaoPlano, { rotulo: string; tom: 'ok' | 'at' | 'neutro'; simbolo: string }> = {
  VIGENTE: { rotulo: 'Plano vigente', tom: 'ok', simbolo: '✓' },
  DEVOLVIDO: { rotulo: 'Plano devolvido', tom: 'at', simbolo: '▲' },
  SEM_PLANO: { rotulo: 'Sem plano', tom: 'at', simbolo: '▲' },
  RASCUNHO: { rotulo: 'Plano em rascunho', tom: 'neutro', simbolo: '○' },
  AGUARDANDO_VALIDACAO: { rotulo: 'Plano aguardando validação', tom: 'neutro', simbolo: '○' },
}

const SITUACAO_CONSENTIMENTO: Record<SituacaoConsentimento, { rotulo: string; tom: 'ok' | 'neutro'; simbolo: string }> = {
  VIGENTE: { rotulo: 'Acesso vigente', tom: 'ok', simbolo: '✓' },
  REVOGADO: { rotulo: 'Acesso encerrado pela família', tom: 'neutro', simbolo: '○' },
  EXPIRADO: { rotulo: 'Prazo do acesso terminado', tom: 'neutro', simbolo: '○' },
  AGUARDANDO_INICIO: { rotulo: 'Acesso ainda não começou', tom: 'neutro', simbolo: '○' },
}

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'pronto'; paciente: PacienteDetalhe }

const emData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')

export function Ficha() {
  const { id = '' } = useParams()
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true
    setEstado({ tipo: 'carregando' })
    servicos.pacientes.obter(id)
      .then((paciente) => { if (ativo) setEstado({ tipo: 'pronto', paciente }) })
      .catch((erro) => { if (ativo) setEstado({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [id, tentativa])

  const nome = estado.tipo === 'pronto' ? estado.paciente.nome : 'Ficha do paciente'
  const negado = estado.tipo === 'erro' && estado.erro instanceof ErroServico
    && estado.erro.codigo === 'ACESSO_NEGADO'

  return (
    <Tela area="cli" caminho={['Área clínica', 'Pacientes', nome]}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Titulo sub="Identificação, rede de apoio, equipe e vínculo escolar">{nome}</Titulo>
        <Link to="/app/clinica/pacientes" className="min-h-11 items-center font-bold text-cli-ink underline">
          Voltar para a lista
        </Link>
      </div>

      {estado.tipo === 'carregando' && (
        <EstadoCarregando forma="cartoes" quantidade={2} rotulo="Carregando a ficha do paciente" />
      )}

      {estado.tipo === 'erro' && (
        // Tentar de novo nao muda o alcance do perfil: sem botao neste caso.
        <EstadoErro
          erro={estado.erro}
          oQue="esta ficha"
          titulo={negado ? 'Esta ficha não é do seu alcance' : undefined}
          texto={negado
            ? 'Esta ficha é de um paciente que você não acompanha. Se precisar consultá-la, fale com a coordenação da clínica.'
            : undefined}
          aoTentarDeNovo={negado ? undefined : () => setTentativa((t) => t + 1)}
        />
      )}

      {estado.tipo === 'pronto' && (() => {
        const p = estado.paciente
        const plano = SITUACAO_PLANO[p.situacaoPlano]
        return (
          <>
            <Cartao>
              <h2 className="text-lg font-bold">Identificação</h2>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px]">
                <dt className="font-bold">Idade</dt>
                <dd>{p.idade} anos · nascimento em {emData(p.dataNascimento)}</dd>
                <dt className="font-bold">Nível de suporte</dt>
                <dd>{descricaoNivelSuporte(p.nivelSuporte)}</dd>
                <dt className="font-bold">Plano terapêutico</dt>
                <dd><Etiqueta tom={plano.tom} simbolo={plano.simbolo}>{plano.rotulo}</Etiqueta></dd>
              </dl>
            </Cartao>

            <Cartao>
              <h2 className="text-lg font-bold">Rede de apoio</h2>
              {p.redeApoio.length === 0 ? (
                <p className="mt-1 text-tinta2">Nenhum responsável cadastrado ainda.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {p.redeApoio.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-linha bg-sup px-3 py-2.5">
                      <span>
                        <b>{r.nome}</b>
                        <span className="block text-sm text-tinta2">{r.parentesco} · {r.telefone}</span>
                      </span>
                      {/* Só o responsável legal autoriza o acesso da escola. */}
                      {r.responsavelLegal
                        ? <Etiqueta tom="ok" simbolo="✓">Responsável legal</Etiqueta>
                        : <Etiqueta simbolo="○">Não responde legalmente</Etiqueta>}
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>

            <Cartao>
              <h2 className="text-lg font-bold">Equipe multiprofissional</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {p.equipe.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-linha bg-sup px-3 py-2.5">
                    <span>
                      <b>{e.nome}</b>
                      <span className="block text-sm text-tinta2">{e.especialidade}</span>
                    </span>
                    {e.id === p.profissionalResponsavelId && (
                      <Etiqueta tom="ok" simbolo="✓">Responsável pelo caso</Etiqueta>
                    )}
                  </li>
                ))}
              </ul>
            </Cartao>

            <Cartao>
              <h2 className="text-lg font-bold">Vínculo escolar</h2>
              {p.vinculosEscolares.length === 0 ? (
                // Sem acao: quem autoriza e a familia, na area dela.
                <p className="mt-1 text-tinta2">
                  Nenhuma escola tem acesso aos dados de {p.nome.split(' ')[0]}.
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {p.vinculosEscolares.map((v) => {
                    const s = SITUACAO_CONSENTIMENTO[v.situacaoConsentimento]
                    return (
                      <li key={v.vinculoId} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-linha bg-sup px-3 py-2.5">
                        <span>
                          <b>{v.escola}</b>
                          <span className="block text-sm text-tinta2">
                            {v.turma} · {v.turno} · {v.professor} ({v.atuacao})
                          </span>
                        </span>
                        <Etiqueta tom={s.tom} simbolo={s.simbolo}>{s.rotulo}</Etiqueta>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Cartao>

            <Cartao>
              <h2 className="text-lg font-bold">Histórico resumido</h2>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px]">
                <dt className="font-bold">Sessões encerradas</dt>
                <dd className="tabular-nums">{p.totalSessoes}</dd>
                <dt className="font-bold">Última sessão</dt>
                <dd>{p.ultimaSessaoEm ? emData(p.ultimaSessaoEm) : 'Nenhuma sessão registrada'}</dd>
              </dl>
            </Cartao>

            <section aria-labelledby="h-acoes">
              <h2 id="h-acoes" className="mb-3 text-lg font-bold">Ações</h2>
              <div className="flex flex-wrap gap-2">
                <BotaoLink para={`/app/clinica/pacientes/${p.id}/plano`} area="cli">
                  Abrir o plano terapêutico
                </BotaoLink>
                <BotaoLink para={`/app/clinica/pacientes/${p.id}/sessao`} area="cli" variante="secundaria">
                  Iniciar sessão
                </BotaoLink>
                <BotaoLink para={`/app/clinica/pacientes/${p.id}/evolucao`} area="cli" variante="secundaria">
                  Ver evolução por objetivo
                </BotaoLink>
              </div>
            </section>
          </>
        )
      })()}
    </Tela>
  )
}
