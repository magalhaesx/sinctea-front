import { Link } from 'react-router-dom'
import { Tela } from '../componentes/Layout'

const areas = [
  {
    para: '/clinica', nome: 'Área clínica', papel: 'Terapeuta e coordenação',
    texto: 'Plano terapêutico, registro de sessão e evolução por objetivo. Funciona sem conexão.',
    cor: 'border-l-cli', tinta: 'text-cli-ink',
  },
  {
    para: '/familia', nome: 'Área da família', papel: 'Responsável',
    texto: 'Acompanhar a evolução, realizar as atividades em casa e autorizar o acesso da escola.',
    cor: 'border-l-fam', tinta: 'text-fam-ink',
  },
  {
    para: '/escola', nome: 'Área da escola', papel: 'Professor e AEE',
    texto: 'Cartão de estratégias em linguagem simples e registro de ocorrência em poucos toques.',
    cor: 'border-l-esc', tinta: 'text-esc-ink',
  },
]

export function Entrada() {
  return (
    <Tela area="neutro" caminho={['Entrada']}>
      <div>
        <h1 className="text-3xl font-bold leading-tight text-balance">
          A informação acompanha a pessoa, não a instituição
        </h1>
        <p className="mt-2 max-w-2xl text-tinta2">
          O SINCTEA liga clínica, casa e escola em torno do mesmo plano terapêutico — com o
          consentimento da família controlando cada passagem de informação.
        </p>
      </div>

      <h2 className="mt-2 text-lg font-bold">Escolha a sua área</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {areas.map((a) => (
          <Link
            key={a.para}
            to={a.para}
            className={`block rounded-xl border border-linha border-l-4 ${a.cor} bg-sup p-4 hover:bg-sup2`}
          >
            <h3 className={`text-base font-bold ${a.tinta}`}>{a.nome}</h3>
            <p className="text-[11.5px] uppercase tracking-wide text-tinta3">{a.papel}</p>
            <p className="mt-2 text-sm text-tinta2">{a.texto}</p>
          </Link>
        ))}
      </div>

      <div className="mt-2 rounded-xl border border-linha border-l-4 border-l-at bg-at-sup p-4">
        <h3 className="font-bold">Demonstração acadêmica</h3>
        <p className="mt-1 text-sm text-tinta2">
          Esta é a interface do Trabalho de Conclusão de Curso. Todos os dados exibidos são
          fictícios e nenhuma informação de pessoa real foi utilizada. O sistema não realiza
          diagnóstico e não substitui o julgamento profissional.
        </p>
      </div>
    </Tela>
  )
}
