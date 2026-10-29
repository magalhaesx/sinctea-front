import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BarraPreferencias } from '../componentes/BarraPreferencias'
import { Botao } from '../ui/Botao'
import { usarSessao } from '../contexto/Sessao'
import type { Perfil } from '../servicos'
import { SO_CAMINHO_PRINCIPAL } from './caminhoPrincipal'
import { FOCAVEIS, focoPresoNaGaveta, rotuloDoBotaoDoMenu } from './gaveta'
import { iniciaisDe } from './iniciais'
import { papelNaTela } from './perfis'
import { textoDoAvisoDeRedefinicao } from './textoDaRedefinicao'

/**
 * Moldura do sistema (/app). O menu, atras do botao ☰, mostra as telas do perfil ATIVO: as tres
 * areas sao independentes, e nao um sistema unico com itens ocultos por
 * permissao. Esconder item de menu tambem nao e seguranca — quem autoriza
 * cada leitura e o servidor.
 */

/** `fora`: fora do caminho principal, so com o mock (caminhoPrincipal.ts). */
type Item = { para: string; nome: string; uc?: string; cor: string; fim?: boolean; fora?: true }

/** Um passo da trilha que leva de volta a outra tela. */
export type ItemDoCaminho = { rotulo: string; para: string }
type Grupo = { titulo: string; perfis: Perfil[]; itens: Item[] }

const CLI = '#00a2af'
const FAM = '#c8402e'
const ESC = '#bf8506'
const NEUTRO = '#9db6ba'

const menu: Grupo[] = [
  {
    titulo: 'Área clínica',
    perfis: ['TERAPEUTA', 'COORDENADOR'],
    itens: [
      { para: '/app/clinica', nome: 'Painel do profissional', uc: 'UC10', cor: CLI, fim: true },
      // Plano, sessao e evolucao se abrem pela ficha, com o paciente escolhido.
      { para: '/app/clinica/pacientes', nome: 'Pacientes', uc: 'UC01', cor: CLI },
    ],
  },
  {
    titulo: 'Coordenação',
    perfis: ['COORDENADOR'],
    itens: [
      { para: '/app/coordenacao', nome: 'Indicadores da clínica', uc: 'UC18', cor: CLI, fim: true, fora: true },
      { para: '/app/coordenacao/planos', nome: 'Validar planos', uc: 'UC17', cor: CLI },
      { para: '/app/coordenacao/auditoria', nome: 'Registro de auditoria', uc: 'UC19', cor: CLI },
    ],
  },
  {
    titulo: 'Administração',
    perfis: ['ADMINISTRADOR'],
    itens: [
      { para: '/app/admin/usuarios', nome: 'Usuários e perfis', uc: 'UC20', cor: CLI },
      { para: '/app/admin/trilha', nome: 'Trilha administrativa', uc: 'UC19', cor: CLI },
    ],
  },
  {
    titulo: 'Área da família',
    perfis: ['RESPONSAVEL'],
    itens: [
      { para: '/app/familia', nome: 'Painel da família', uc: 'UC13', cor: FAM, fim: true },
      // A atividade se abre pelo painel, com a atividade escolhida.
      { para: '/app/familia/consentimento', nome: 'Autorizar a escola', uc: 'UC11', cor: FAM },
    ],
  },
  {
    titulo: 'Área da escola',
    perfis: ['PROFESSOR'],
    itens: [
      { para: '/app/escola', nome: 'Meus alunos', uc: 'UC21', cor: ESC, fim: true },
    ],
  },
  {
    titulo: 'Apoio',
    perfis: ['TERAPEUTA', 'COORDENADOR', 'ADMINISTRADOR', 'RESPONSAVEL', 'PROFESSOR'],
    itens: [
      { para: '/app/conta', nome: 'Perfil e preferências', cor: NEUTRO },
      { para: '/app/ajuda', nome: 'Acessibilidade e ajuda', cor: NEUTRO },
    ],
  },
]

export function LayoutApp() {
  const { usuario, perfilAtivo, especialidade, sair } = usarSessao()
  const navegar = useNavigate()
  const { pathname } = useLocation()
  const grupos = menu
    .filter((g) => perfilAtivo !== null && g.perfis.includes(perfilAtivo))
    .map((g) => ({ ...g, itens: g.itens.filter((i) => !(SO_CAMINHO_PRINCIPAL && i.fora)) }))

  /*
   * Item 12: o menu fica atras do botao ☰, em qualquer largura, numa gaveta
   * que abre pela esquerda. A gaveta e um dialogo modal: o foco entra nela,
   * fica preso nela, e volta ao ☰ quando ela fecha; o resto da pagina fica
   * inerte enquanto ela esta aberta.
   */
  const [aberto, setAberto] = useState(false)
  const botaoDoMenu = useRef<HTMLButtonElement>(null)
  const gaveta = useRef<HTMLDivElement>(null)
  const atras = useRef<HTMLDivElement>(null)
  const estavaAberto = useRef(false)

  // Trocar de rota fecha a gaveta, venha a troca dela ou de outro lugar.
  useEffect(() => { setAberto(false) }, [pathname])

  useEffect(() => {
    if (atras.current) atras.current.inert = aberto
    if (aberto) {
      gaveta.current?.querySelector<HTMLElement>('nav a[href]')?.focus()
      // Sem rolar o conteudo de tras enquanto a gaveta esta por cima.
      document.body.style.overflow = 'hidden'
      const aoTeclar = (evento: KeyboardEvent) => { if (evento.key === 'Escape') setAberto(false) }
      document.addEventListener('keydown', aoTeclar)
      estavaAberto.current = true
      return () => {
        document.removeEventListener('keydown', aoTeclar)
        document.body.style.overflow = ''
      }
    }
    if (estavaAberto.current) {
      estavaAberto.current = false
      botaoDoMenu.current?.focus()
    }
    return undefined
  }, [aberto])

  const prenderFoco = (evento: ReactKeyboardEvent<HTMLDivElement>) => {
    if (evento.key !== 'Tab' || !gaveta.current) return
    // So o que esta na tela: o "Sair" da gaveta some a partir de lg.
    const focaveis = [...gaveta.current.querySelectorAll<HTMLElement>(FOCAVEIS)].filter((el) => el.getClientRects().length > 0)
    const destino = focoPresoNaGaveta(focaveis.indexOf(document.activeElement as HTMLElement), focaveis.length, evento.shiftKey)
    if (destino === null) return
    evento.preventDefault()
    focaveis[destino].focus()
  }

  const encerrar = async () => {
    await sair()
    navegar('/app/entrar', { replace: true })
  }

  const quem = usuario && perfilAtivo && (
    <span className="text-[12px] leading-tight text-cromo-tinta">
      <span className="block font-bold">{usuario.nome}</span>
      <span className="block text-cromo-tinta2">{papelNaTela(perfilAtivo, especialidade)}</span>
    </span>
  )
  const botaoSair = (
    <button
      type="button"
      onClick={encerrar}
      className="min-h-11 cursor-pointer rounded-lg border-2 border-cromo-linha px-3 text-[13px] font-bold text-cromo-tinta hover:bg-cromo2"
    >
      Sair
    </button>
  )

  return (
    <div className="min-h-screen">
      <div ref={atras} className="flex min-h-screen flex-col">
        <a className="pular" href="#conteudo">Pular para o conteúdo</a>

        <header className="flex items-center justify-between gap-3 border-b border-cromo-linha px-3 py-2.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              ref={botaoDoMenu}
              type="button"
              aria-label={rotuloDoBotaoDoMenu(aberto)}
              aria-expanded={aberto}
              aria-controls="menu-do-app"
              onClick={() => setAberto((a) => !a)}
              className="grid h-11 w-11 flex-none cursor-pointer place-items-center rounded-lg border-2 border-cromo-linha text-xl leading-none text-cromo-tinta hover:bg-cromo2"
            >
              <span aria-hidden="true">☰</span>
            </button>
            <b className="text-[17px] font-bold tracking-wide text-cromo-tinta">SINCTEA</b>
            <span className="hidden text-xs text-cromo-tinta2 sm:inline">
              · Continuidade terapêutica no <abbr title="Transtorno do Espectro Autista">TEA</abbr>
            </span>
          </div>

          {/* No computador, quem esta na sessao fica no topo; no celular, dentro do menu. */}
          {quem && (
            <div className="hidden items-center gap-2.5 text-right lg:flex">
              {quem}
              {botaoSair}
            </div>
          )}
        </header>

        {/* Item 11: o cartao ocupa a largura da tela, com 20 px de margem (32 px
            a partir de xl), e so para de crescer em 1800 px, centralizado. A
            adaptacao e pela largura da tela, nunca pelo aparelho. Os 20 px
            valem tambem no celular: o respiro minimo e 16 px (docs/02). */}
        <main id="conteudo" tabIndex={-1} className="min-w-0 flex-1 overflow-x-hidden bg-cromo2 p-5 xl:p-8">
          <div className="mx-auto min-w-0 max-w-[1800px]">
            <AvisoDeRedefinicao />
            <Outlet />
          </div>
        </main>
      </div>

      {/* O fundo escurecido: o toque nele fecha a gaveta. */}
      <div
        aria-hidden="true"
        onClick={() => setAberto(false)}
        className={`fixed inset-0 z-40 bg-black/55 transition-opacity duration-200 ${aberto ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />

      {/* Fechada, a gaveta fica invisivel: fora da leitura e do teclado. Com
          "Reduzir animacao", a transicao vale zero, e ela abre sem deslizar. */}
      <div
        ref={gaveta}
        id="menu-do-app"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        onKeyDown={prenderFoco}
        // Ao abrir, so o deslize tem transicao: a gaveta fica visivel na hora, e
        // o primeiro item ja recebe o foco. Ao fechar, ela some depois do deslize.
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(20rem,88vw)] flex-col overflow-y-auto border-r border-cromo-linha bg-cromo shadow-2xl duration-200 ${
          aberto ? 'visible translate-x-0 transition-transform' : 'invisible -translate-x-full transition-[transform,visibility]'
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-cromo-linha px-3 py-2.5">
          <b className="px-2 text-[17px] font-bold tracking-wide text-cromo-tinta">SINCTEA</b>
          <button
            type="button"
            aria-label="Fechar o menu"
            onClick={() => setAberto(false)}
            className="grid h-11 w-11 cursor-pointer place-items-center rounded-lg border-2 border-cromo-linha text-lg leading-none text-cromo-tinta hover:bg-cromo2"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <nav aria-label="Telas do seu perfil" className="px-3 py-4">
          {grupos.map((g) => (
            <div key={g.titulo} className="mb-4 last:mb-0">
              <h2 className="mb-2 px-2 text-[10.5px] font-bold uppercase tracking-widest text-cromo-tinta2">
                {g.titulo}
              </h2>
              <ul className="flex flex-col gap-1.5">
                {g.itens.map((i) => (
                  <li key={i.para}>
                    {/* O NavLink marca a tela atual com aria-current="page". */}
                    <NavLink
                      to={i.para}
                      end={i.fim}
                      onClick={() => setAberto(false)}
                      className={({ isActive }) =>
                        `flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] text-cromo-tinta ${
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

        <div className="border-t border-cromo-linha px-5 py-4">
          <BarraPreferencias />
        </div>

        {quem && (
          <div className="mt-auto flex items-center justify-between gap-3 border-t border-cromo-linha px-5 py-4 lg:hidden">
            {quem}
            {botaoSair}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Item 8: a coordenacao redefiniu a senha desta conta. O aviso fica acima de
 * qualquer tela ate a pessoa dar ciencia, em qualquer janela e em qualquer
 * acesso: a ciencia fica no servidor.
 */
function AvisoDeRedefinicao() {
  const { avisoDeRedefinicao, darCienciaDaNovaSenha, perfilAtivo } = usarSessao()
  const [ocupado, setOcupado] = useState(false)
  const [falhou, setFalhou] = useState(false)
  if (!avisoDeRedefinicao) return null
  const ciente = async () => {
    setOcupado(true)
    setFalhou(false)
    try {
      await darCienciaDaNovaSenha()
    } catch {
      setFalhou(true)
    } finally {
      setOcupado(false)
    }
  }
  return (
    <div role="alert" className="mb-4 rounded-xl border border-cromo-linha border-l-4 border-l-at bg-at-sup p-4 text-tinta">
      <h2 className="mb-1 text-base font-bold">Sua senha foi redefinida</h2>
      <p className="max-w-[65ch] text-[15px]">{textoDoAvisoDeRedefinicao(avisoDeRedefinicao)}</p>
      {falhou && <p className="mt-2 text-sm font-bold text-cr">Não foi possível registrar agora. Tente de novo.</p>}
      <p className="mt-3">
        <Botao area={perfilAtivo === 'RESPONSAVEL' ? 'fam' : perfilAtivo === 'PROFESSOR' ? 'esc' : 'cli'} variante="secundaria"
          disabled={ocupado} onClick={() => void ciente()}>{ocupado ? 'Registrando…' : 'Entendi'}</Botao>
      </p>
    </div>
  )
}

/** Moldura do produto: separa visualmente o cromo do prototipo da aplicacao. */
export function Tela({
  area, papel, nome, sigla, caminho, children,
}: {
  area: 'cli' | 'fam' | 'esc' | 'neutro'
  papel?: string
  nome?: string
  /**
   * De quem sao as iniciais do icone: por padrao, o `nome` do cabecalho. Tela
   * que trata de uma crianca passa o nome dela; nulo, sem crianca escolhida,
   * o icone nao aparece. "Acesso da escola" nao vira "Ad".
   */
  sigla?: string | null
  /**
   * A trilha ate esta tela. Item com `para` vira link: e o caminho de volta
   * visivel (item 7), alem do Voltar do navegador. O ultimo e a propria tela.
   */
  caminho: Array<string | ItemDoCaminho>
  children: React.ReactNode
}) {
  const fundo = { cli: 'bg-cli-ink', fam: 'bg-fam-ink', esc: 'bg-esc-ink', neutro: 'bg-tinta2' }[area]
  const corDoLink = { cli: 'text-cli-ink', fam: 'text-fam-ink', esc: 'text-esc-ink', neutro: 'text-tinta' }[area]
  const iniciais = iniciaisDe(sigla === undefined ? nome : sigla)
  return (
    <div className="rounded-2xl border border-cromo-linha bg-fundo text-tinta overflow-hidden">
      {nome && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-linha bg-sup px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            {iniciais && (
              <span className={`grid h-9 w-9 flex-none place-items-center rounded-lg text-[13px] font-bold text-white ${fundo}`} aria-hidden="true">
                {iniciais}
              </span>
            )}
            <span>
              <span className="block text-sm font-bold leading-tight">{nome}</span>
              {papel && <span className="block text-[11.5px] text-tinta2">{papel}</span>}
            </span>
          </div>
        </div>
      )}
      <nav aria-label="Trilha de navegação" className="px-5 pt-3 text-[13px] text-tinta2 break-words">
        Você está em:{' '}
        {caminho.map((item, i) => {
          const rotulo = typeof item === 'string' ? item : item.rotulo
          const para = typeof item === 'string' || i === caminho.length - 1 ? undefined : item.para
          return (
            <span key={`${i}-${rotulo}`}>
              {i > 0 && <span aria-hidden="true"> › </span>}
              {i === caminho.length - 1
                ? <b className="text-tinta2" aria-current="page">{rotulo}</b>
                : para
                  ? <Link to={para} className={`font-bold underline underline-offset-2 ${corDoLink}`}>{rotulo}</Link>
                  : rotulo}
            </span>
          )
        })}
      </nav>
      <div className="flex flex-col gap-4 px-5 pb-6 pt-3.5">{children}</div>
    </div>
  )
}
