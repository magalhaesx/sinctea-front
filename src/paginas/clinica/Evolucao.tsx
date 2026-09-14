import { Tela } from '../../componentes/Layout'
import { Aviso, Cartao, Titulo } from '../../componentes/ui'
import { GraficoEvolucao } from '../../componentes/GraficoEvolucao'
import { objetivos, sessoes } from '../../dados/exemplo'

export function Evolucao() {
  const objetivo = objetivos[0]
  const criterio = objetivo.criterio
  const consecutivas = [...sessoes].reverse()
    .findIndex((s) => s.percentualIndependente < criterio.percentualMinimo)
  const faltam = Math.max(criterio.sessoesConsecutivas - consecutivas, 0)

  return (
    <Tela
      area="cli"
      nome="Miguel Santana, 7 anos"
      papel="Comunicação funcional · 10 sessões registradas"
      caminho={['Início', 'Miguel Santana', 'Evolução por objetivo']}
    >
      <Titulo sub="Percentual de tentativas independentes por sessão · agosto a setembro de 2026">
        Emitir mando por item preferido
      </Titulo>

      <Cartao>
        <GraficoEvolucao sessoes={sessoes} criterio={criterio.percentualMinimo} />
      </Cartao>

      <Aviso tom="ok" titulo={`${consecutivas} sessões consecutivas acima do critério`}>
        O objetivo passa a <b>dominado</b> após mais {faltam}{' '}
        {faltam === 1 ? 'sessão' : 'sessões'} igual ou acima de {criterio.percentualMinimo}%. A
        promoção não é automática: depende da confirmação do terapeuta.
      </Aviso>
    </Tela>
  )
}
