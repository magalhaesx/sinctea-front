import { useState } from 'react'
import { Tela } from '../LayoutApp'
import { Botao } from '../../ui/Botao'
import { Cartao } from '../../ui/Cartao'
import { Etiqueta } from '../../ui/Etiqueta'
import { Medidor } from '../../ui/Medidor'
import { Titulo } from '../../ui/Titulo'
import { objetivos, paciente } from '../../dados/exemplo'

export function Plano() {
  const [acessivel, setAcessivel] = useState(false)

  return (
    <Tela
      area="cli"
      nome={`${paciente.nome}, 7 anos`}
      papel="Nível de suporte 2 · em acompanhamento desde 03/2024"
      caminho={['Início', paciente.nome, 'Plano Terapêutico Individual']}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Titulo sub="Início em 04/08/2026 · próxima revisão em 12/11/2026 · 3 objetivos ativos">
          Plano Terapêutico Individual
        </Titulo>
        <Botao area="cli" aria-pressed={acessivel} onClick={() => setAcessivel((v) => !v)}>
          {acessivel ? 'Ver em linguagem técnica' : 'Ver em linguagem acessível'}
        </Botao>
      </div>

      <p className="text-sm text-tinta2">
        O mesmo objetivo tem duas redações: a <b>técnica</b>, usada pela equipe, e a{' '}
        <b>acessível</b>, que é a única que a escola e a família enxergam.{' '}
        <Etiqueta tom={acessivel ? 'ok' : 'neutro'} simbolo={acessivel ? '✓' : '●'}>
          Exibindo a redação {acessivel ? 'acessível' : 'técnica'}
        </Etiqueta>
      </p>

      <ul className="flex flex-col gap-3">
        {objetivos.map((o) => (
          <li key={o.id}>
            <Cartao>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold">{o.dominio}</h2>
                {o.status === 'DOMINADO'
                  ? <Etiqueta tom="ok" simbolo="✓">Dominado</Etiqueta>
                  : <Etiqueta tom="at" simbolo="●">Em aquisição</Etiqueta>}
              </div>
              <p className="my-2.5">{acessivel ? o.descricaoAcessivel : o.descricaoTecnica}</p>
              <Medidor valor={o.percentualAtual} area="cli" rotulo={`Domínio de ${o.dominio}`} />
              <p className="mt-2 text-sm text-tinta2">
                {o.status === 'DOMINADO'
                  ? 'Atingido em 02/09/2026'
                  : `Critério: ${o.criterio.percentualMinimo}% em ${o.criterio.sessoesConsecutivas} sessões seguidas`}
              </p>
            </Cartao>
          </li>
        ))}
      </ul>
    </Tela>
  )
}
