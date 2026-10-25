import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { BarraPreferencias } from '../componentes/BarraPreferencias'
import { Botao } from '../ui/Botao'
import { RodapeAmbiente } from '../componentes/AvisoAmbiente'
import { usarSessao } from '../contexto/Sessao'
import type { Perfil } from '../servicos'
import { SO_CAMINHO_PRINCIPAL } from './caminhoPrincipal'
import { iniciaisDe } from './iniciais'
import { papelNaTela } from './perfis'
import { textoDoAvisoDeRedefinicao } from './textoDaRedefinicao'

/**
 * Moldura do sistema (/app). O menu mostra as telas do perfil ATIVO: as tres
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
      { para: '/app/coordenacao/auditoria', nome: 'Registro de auditoria', uc: 'UC19', cor: CLI, fora: true },
    ],
  },
  {
    titulo: 'Administração',
    perfis: ['ADMINISTRADOR'],
    itens: [
      { para: '/app/admin/usuarios', nome: 'Usuários e perfis', uc: 'UC20', cor: CLI },
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
  const grupos = menu
    .filter((g) => perfilAtivo !== null && g.perfis.includes(perfilAtivo))
    .map((g) => ({ ...g, itens: g.itens.filter((i) => !(SO_CAMINHO_PRINCIPAL && i.fora)) }))

  const encerrar = async () => {
    await sair()
    navegar('/app/entrar', { replace: true })
  }

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

        <div className="flex flex-wrap items-center gap-3">
          <BarraPreferencias />
          {usuario && perfilAtivo && (
            <div className="flex items-center gap-2.5">
              <span className="text-right text-[12px] leading-tight text-cromo-tinta">
                <span className="block font-bold">{usuario.nome}</span>
                <span className="block text-cromo-tinta2">{papelNaTela(perfilAtivo, especialidade)}</span>
              </span>
              <button
                type="button"
                onClick={encerrar}
                className="min-h-11 cursor-pointer rounded-lg border-2 border-cromo-linha px-3 text-[13px] font-bold text-cromo-tinta hover:bg-cromo2"
              >
                Sair
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="grid min-h-0 min-w-0 flex-1 lg:grid-cols-[266px_1fr]">
        <nav aria-label="Telas do seu perfil" className="min-w-0 border-b border-cromo-linha px-3 py-4 lg:border-b-0 lg:border-r">
          {grupos.map((g) => (
            <div key={g.titulo} className="mb-4 last:mb-0">
              <h2 className="mb-2 px-2 text-[10.5px] font-bold uppercase tracking-widest text-cromo-tinta2">
                {g.titulo}
              </h2>
              <ul className="flex gap-1.5 overflow-x-auto lg:flex-col lg:overflow-visible">
                {g.itens.map((i) => (
                  <li key={i.para} className="flex-none lg:flex-auto">
                    <NavLink
                      to={i.para}
                      end={i.fim}
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

        {/* Item 11: o cartao ocupa a largura ao lado do menu, com 20 px de margem
            (32 px a partir de xl), e so para de crescer em 1800 px, centralizado.
            A adaptacao e pela largura da tela, nunca pelo aparelho. Os 20 px
            valem tambem no celular: o respiro minimo e 16 px (docs/02). */}
        <main id="conteudo" tabIndex={-1} className="min-w-0 overflow-x-hidden bg-cromo2 p-5 xl:p-8">
          <div className="mx-auto min-w-0 max-w-[1800px]">
            <AvisoDeRedefinicao />
            <Outlet />
          </div>
        </main>
      </div>

      <RodapeAmbiente />
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
  area, papel, nome, sigla, caminho, children, estreito = false,
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
  estreito?: boolean
}) {
  const fundo = { cli: 'bg-cli-ink', fam: 'bg-fam-ink', esc: 'bg-esc-ink', neutro: 'bg-tinta2' }[area]
  const corDoLink = { cli: 'text-cli-ink', fam: 'text-fam-ink', esc: 'text-esc-ink', neutro: 'text-tinta' }[area]
  const iniciais = iniciaisDe(sigla === undefined ? nome : sigla)
  return (
    <div className={`rounded-2xl border border-cromo-linha bg-fundo text-tinta overflow-hidden ${estreito ? 'max-w-lg' : ''}`}>
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
