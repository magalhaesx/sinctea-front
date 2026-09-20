import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { matchPath, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ExigePerfil } from './contexto/ExigePerfil'
import { usarSessao } from './contexto/Sessao'
import type { Perfil } from './servicos'
import { Ajuda } from './app/Ajuda'
import { Conta } from './app/Conta'
import { Convite } from './app/Convite'
import { Entrar } from './app/Entrar'
import { LayoutApp } from './app/LayoutApp'
import { PAINEL_DO_PERFIL } from './app/perfis'
import { PainelClinica } from './app/clinica/Painel'
import { Plano } from './app/clinica/Plano'
import { RegistroSessao } from './app/clinica/Sessao'
import { Evolucao } from './app/clinica/Evolucao'
import { PainelCoordenacao } from './app/coordenacao/Painel'
import { PainelFamilia } from './app/familia/Painel'
import { Atividade } from './app/familia/Atividade'
import { Consentimento } from './app/familia/Consentimento'
import { Alunos } from './app/escola/Alunos'
import { CartaoEstrategias } from './app/escola/Cartao'
import { Ocorrencia } from './app/escola/Ocorrencia'
import { Sobre } from './paginas/Sobre'

/* Vitrine de componentes: so existe em desenvolvimento. No build de producao
   a condicao vira `false` e o modulo nem entra no pacote. */
const VitrineEstados = import.meta.env.DEV
  ? lazy(() => import('./paginas/VitrineEstados').then((m) => ({ default: m.VitrineEstados })))
  : null

const CLINICA: Perfil[] = ['TERAPEUTA', 'COORDENADOR']
const TODOS: Perfil[] = ['TERAPEUTA', 'COORDENADOR', 'ADMINISTRADOR', 'RESPONSAVEL', 'PROFESSOR']

/** Titulo de documento por rota — WCAG 2.4.2 / e-MAG 3.3. */
const titulos: [padrao: string, titulo: string][] = [
  ['/sobre', 'A solução'],
  ['/app/entrar', 'Entrar'],
  ['/app/convite/:token', 'Aceitar convite'],
  ['/app/clinica', 'Painel do terapeuta'],
  ['/app/clinica/pacientes/:id/plano', 'Plano Terapêutico Individual'],
  ['/app/clinica/pacientes/:id/sessao', 'Registro de sessão'],
  ['/app/clinica/pacientes/:id/evolucao', 'Evolução por objetivo'],
  ['/app/coordenacao', 'Indicadores da clínica'],
  ['/app/familia', 'Painel da família'],
  ['/app/familia/atividades/:id', 'Atividade em casa'],
  ['/app/familia/consentimento', 'Autorizar o acesso da escola'],
  ['/app/escola', 'Meus alunos'],
  ['/app/escola/:pacienteId', 'Cartão de estratégias'],
  ['/app/escola/:pacienteId/ocorrencia', 'Registrar ocorrência'],
  ['/app/conta', 'Perfil e preferências'],
  ['/app/ajuda', 'Acessibilidade e ajuda'],
  ['/dev/estados', 'Vitrine de estados'],
]

/** /app manda cada perfil para o seu painel (docs/01, secao 2). */
function RaizDoApp() {
  const { perfilAtivo } = usarSessao()
  return <Navigate to={perfilAtivo ? PAINEL_DO_PERFIL[perfilAtivo] : '/app/entrar'} replace />
}

const protegida = (perfis: Perfil[], tela: ReactNode) => <ExigePerfil perfis={perfis}>{tela}</ExigePerfil>

/** Moldura minima das telas que vivem fora do /app: o site ate a etapa 9. */
function Solta({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-cromo2 p-3 sm:p-5">
      <div className="mx-auto min-w-0 max-w-5xl">{children}</div>
    </div>
  )
}

export function App() {
  const { pathname } = useLocation()

  useEffect(() => {
    const achado = titulos.find(([padrao]) => matchPath(padrao, pathname))
    document.title = `${achado ? achado[1] : 'SINCTEA'} · SINCTEA`
  }, [pathname])

  return (
    <Routes>
      {/* A etapa 9 coloca o site comercial na raiz; ate la, a raiz leva ao login. */}
      <Route path="/" element={<Navigate to="/app/entrar" replace />} />
      <Route path="/sobre" element={<Solta><Sobre /></Solta>} />

      <Route path="/app/entrar" element={<Entrar />} />
      {/* Publica: o professor ainda nao tem conta quando abre o convite. */}
      <Route path="/app/convite/:token" element={<Convite />} />

      <Route path="/app" element={protegida(TODOS, <LayoutApp />)}>
        <Route index element={<RaizDoApp />} />

        <Route path="clinica" element={protegida(CLINICA, <PainelClinica />)} />
        <Route path="clinica/pacientes/:id/plano" element={protegida(CLINICA, <Plano />)} />
        <Route path="clinica/pacientes/:id/sessao" element={protegida(CLINICA, <RegistroSessao />)} />
        <Route path="clinica/pacientes/:id/evolucao" element={protegida(CLINICA, <Evolucao />)} />

        <Route path="coordenacao" element={protegida(['COORDENADOR'], <PainelCoordenacao />)} />

        <Route path="familia" element={protegida(['RESPONSAVEL'], <PainelFamilia />)} />
        <Route path="familia/atividades/:id" element={protegida(['RESPONSAVEL'], <Atividade />)} />
        <Route path="familia/consentimento" element={protegida(['RESPONSAVEL'], <Consentimento />)} />

        <Route path="escola" element={protegida(['PROFESSOR'], <Alunos />)} />
        <Route path="escola/:pacienteId" element={protegida(['PROFESSOR'], <CartaoEstrategias />)} />
        <Route path="escola/:pacienteId/ocorrencia" element={protegida(['PROFESSOR'], <Ocorrencia />)} />

        <Route path="conta" element={protegida(TODOS, <Conta />)} />
        <Route path="ajuda" element={protegida(TODOS, <Ajuda />)} />
      </Route>

      {VitrineEstados && (
        <Route path="/dev/estados" element={<Solta><Suspense><VitrineEstados /></Suspense></Solta>} />
      )}

      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}
