import { Link } from 'react-router-dom'
import { Aviso, Cartao, Titulo } from '../../componentes/ui'
import { Tela } from '../LayoutApp'

/**
 * Tela 11 · Painel de indicadores da clinica · /app/coordenacao
 *
 * A tela em si e a etapa 6 do roteiro. Ate la, esta pagina existe para que o
 * perfil de coordenacao tenha um destino proprio, diferente do painel de quem
 * atende, e diz honestamente o que ainda nao foi construido.
 */
export function PainelCoordenacao() {
  return (
    <Tela area="cli" caminho={['Coordenação', 'Indicadores da clínica']}>
      <Titulo sub="A visão de gestão da clínica, diferente do painel de quem atende">
        Indicadores da clínica
      </Titulo>

      <Aviso tom="at" titulo="Esta tela ainda não foi construída">
        Ela chega na etapa 6 da implementação. Nada aqui é indicador de verdade — preferimos
        deixar a tela vazia a mostrar número inventado.
      </Aviso>

      <Cartao>
        <h2 className="text-lg font-bold">O que vai aparecer aqui</h2>
        <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-[15px]">
          <li>Pacientes em acompanhamento, sessões na semana, objetivos dominados no mês e planos vencendo em 30 dias.</li>
          <li>O que precisa de atenção: planos sem revisão, pacientes sem sessão, consentimentos vencendo e objetivos parados.</li>
          <li>Distribuição de sessões por profissional.</li>
          <li>Ponte clínica–escola: escolas com vínculo ativo, ocorrências no mês e tempo de retorno.</li>
        </ol>
        <p className="mt-3 text-sm text-tinta2">
          Enquanto isso, o <Link to="/app/clinica" className="font-bold text-cli-ink underline">painel do terapeuta</Link> já
          mostra a agenda e os avisos da escola.
        </p>
      </Cartao>
    </Tela>
  )
}
