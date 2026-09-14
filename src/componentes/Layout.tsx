import { NavLink, Outlet } from 'react-router-dom'
import { BarraPreferencias } from './BarraPreferencias'

type Item = { para: string; nome: string; uc?: string; cor: string }
type Grupo = { titulo: string; itens: Item[] }

const menu: Grupo[] = [
  {
    titulo: 'Início',
    itens: [
      { para: '/', nome: 'Entrada', cor: '#9db6ba' },
      { para: '/sobre', nome: 'A solução', cor: '#9db6ba' },
    ],
  },
  {
    titulo: 'Área clínica',
    itens: [
      { para: '/clinica', nome: 'Painel do terapeuta', uc: 'UC10', cor: '#00a2af' },
      { para: '/clinica/plano', nome: 'Plano Terapêutico', uc: 'UC02', cor: '#00a2af' },
      { para: '/clinica/sessao', nome: 'Registro de sessão', uc: 'UC04', cor: '#00a2af' },
      { para: '/clinica/evolucao', nome: 'Evolução por objetivo', uc: 'UC08', cor: '#00a2af' },
    ],
  },
  {
    titulo: 'Área da família',
    itens: [
      { para: '/familia', nome: 'Painel da família', uc: 'UC13', cor: '#c8402e' },
      { para: '/familia/atividade', nome: 'Atividade em casa', uc: 'UC14', cor: '#c8402e' },
      { para: '/familia/consentimento', nome: 'Autorizar a escola', uc: 'UC11', cor: '#c8402e' },
    ],
  },
  {
    titulo: 'Área da escola',
    itens: [
      { para: '/escola', nome: 'Cartão de estratégias', uc: 'UC15', cor: '#bf8506' },
      { para: '/escola/ocorrencia', nome: 'Registrar ocorrência', uc: 'UC16', cor: '#bf8506' },
    ],
  },
  {
    titulo: 'Apoio',
    itens: [{ para: '/acessibilidade', nome: 'Acessibilidade e ajuda', cor: '#9db6ba' }],
  },
]

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <a className="pular" href="#conteudo">Pular para o conteúdo</a>

      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-cromo-linha px-5 py-3">
        <div className="flex items-baseline gap-2.5 min-w-0">
          <b className="text-cromo-tinta text-[17px] font-bold tracking-wide">SINCTEA</b>
          <span className="text-cromo-tinta2 text-xs">
            Continuidade terapêutica no <abbr title="Transtorno do Espectro Autista">TEA</abbr>
          </span>
        </div>
        <BarraPreferencias />
      </header>

      <div className="grid min-h-0 min-w-0 flex-1 lg:grid-cols-[266px_1fr]">
        <nav aria-label="Áreas e telas do sistema" className="min-w-0 border-b border-cromo-linha px-3 py-4 lg:border-b-0 lg:border-r">
          {menu.map((g) => (
            <div key={g.titulo} className="mb-4 last:mb-0">
              <h2 className="mb-2 px-2 text-[10.5px] font-bold uppercase tracking-widest text-cromo-tinta2">
                {g.titulo}
              </h2>
              <ul className="flex gap-1.5 overflow-x-auto lg:flex-col lg:overflow-visible">
                {g.itens.map((i) => (
                  <li key={i.para} className="flex-none lg:flex-auto">
                    <NavLink
                      to={i.para}
                      end={i.para === '/' || i.para === '/clinica' || i.para === '/familia' || i.para === '/escola'}
                      className={({ isActive }) =>
                        `flex min-h-10 items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-[13px] text-cromo-tinta lg:w-full ${
                          isActive ? 'bg-cromo2 font-bold' : 'hover:bg-cromo2'
                        }`
                      }
                    >
                      <span className="h-2 w-2 flex-none rounded-sm" style={{ background: i.cor }} aria-hidden="true" />
                      {i.nome}
                      {i.uc && <span className="ml-auto hidden text-[10.5px] tabular-nums text-cromo-tinta2 lg:inline">{i.uc}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <main id="conteudo" tabIndex={-1} className="min-w-0 overflow-x-hidden bg-cromo2 p-3 sm:p-5">
          <div className="mx-auto min-w-0 max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

/** Moldura do produto: separa visualmente o cromo do prototipo da aplicacao. */
export function Tela({
  area, papel, nome, caminho, children, estreito = false,
}: {
  area: 'cli' | 'fam' | 'esc' | 'neutro'
  papel?: string
  nome?: string
  caminho: string[]
  children: React.ReactNode
  estreito?: boolean
}) {
  const fundo = { cli: 'bg-cli-ink', fam: 'bg-fam-ink', esc: 'bg-esc-ink', neutro: 'bg-tinta2' }[area]
  const iniciais = nome ? nome.split(' ').map((p) => p[0]).slice(0, 2).join('') : ''
  return (
    <div className={`rounded-2xl border border-cromo-linha bg-fundo text-tinta overflow-hidden ${estreito ? 'max-w-lg' : ''}`}>
      {nome && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-linha bg-sup px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className={`grid h-9 w-9 flex-none place-items-center rounded-lg text-[13px] font-bold text-white ${fundo}`} aria-hidden="true">
              {iniciais}
            </span>
            <span>
              <span className="block text-sm font-bold leading-tight">{nome}</span>
              {papel && <span className="block text-[11.5px] text-tinta3">{papel}</span>}
            </span>
          </div>
        </div>
      )}
      <nav aria-label="Trilha de navegação" className="px-5 pt-3 text-sm text-tinta3 break-words">
        Você está em:{' '}
        {caminho.map((p, i) => (
          <span key={p}>
            {i > 0 && <span aria-hidden="true"> › </span>}
            {i === caminho.length - 1 ? <b className="text-tinta2">{p}</b> : p}
          </span>
        ))}
      </nav>
      <div className="flex flex-col gap-4 px-5 pb-6 pt-3.5">{children}</div>
    </div>
  )
}
