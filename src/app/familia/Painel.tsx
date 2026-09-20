import { Link } from 'react-router-dom'
import { Tela } from '../LayoutApp'
import { DEMONSTRACAO } from '../perfis'
import { Aviso } from '../../ui/Aviso'
import { BotaoLink } from '../../ui/Botao'
import { Cartao } from '../../ui/Cartao'
import { Etiqueta } from '../../ui/Etiqueta'
import { Medidor } from '../../ui/Medidor'
import { Titulo } from '../../ui/Titulo'
import { atividades, consentimento } from '../../dados/exemplo'

export function PainelFamilia() {
  return (
    <Tela area="fam" nome="Patrícia Santana" papel="Mãe do Miguel" caminho={['Início']} estreito>
      <Titulo sub="Nas últimas quatro semanas ele pediu o que queria sozinho muito mais vezes do que antes.">
        O Miguel está avançando
      </Titulo>

      <Cartao>
        <h2 className="text-base font-bold">Pedir o que quer sem ajuda</h2>
        <div className="mt-3">
          <Medidor valor={65} area="fam" rotulo="Pedir o que quer sem ajuda" />
        </div>
        <p className="mt-2 text-sm text-tinta2">
          Em agosto eram 3 de cada 10 vezes. Agora são cerca de 6 ou 7 de cada 10.
        </p>
      </Cartao>

      <Cartao>
        <h2 className="text-base font-bold">Atividades desta semana</h2>
        <ul className="mt-3 flex flex-col gap-2.5">
          {atividades.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-linha px-3.5 py-2.5">
              <span>{a.titulo}</span>
              {a.feita
                ? <Etiqueta tom="ok" simbolo="✓">Feita</Etiqueta>
                : <Etiqueta tom="at" simbolo="●">Falta fazer</Etiqueta>}
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <BotaoLink para={`/app/familia/atividades/${DEMONSTRACAO.atividade}`} area="fam" className="w-full">
            Abrir a atividade que falta
          </BotaoLink>
        </div>
      </Cartao>

      <Aviso tom="ok" titulo={`A escola tem acesso até 31/12/2026`}>
        Prof.ª {consentimento.professor} · {consentimento.escola}. Você pode encerrar esse acesso
        quando quiser.{' '}
        <Link to="/app/familia/consentimento" className="font-bold text-fam-ink underline">
          Ver a autorização
        </Link>
      </Aviso>
    </Tela>
  )
}
