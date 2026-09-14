import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './componentes/Layout'
import { Entrada } from './paginas/Entrada'
import { Sobre } from './paginas/Sobre'
import { Acessibilidade } from './paginas/Acessibilidade'
import { PainelClinica } from './paginas/clinica/Painel'
import { Plano } from './paginas/clinica/Plano'
import { RegistroSessao } from './paginas/clinica/Sessao'
import { Evolucao } from './paginas/clinica/Evolucao'
import { PainelFamilia } from './paginas/familia/Painel'
import { Atividade } from './paginas/familia/Atividade'
import { Consentimento } from './paginas/familia/Consentimento'
import { CartaoEstrategias } from './paginas/escola/Cartao'
import { Ocorrencia } from './paginas/escola/Ocorrencia'

const titulos: Record<string, string> = {
  '/': 'Entrada',
  '/sobre': 'A solução',
  '/clinica': 'Painel do terapeuta',
  '/clinica/plano': 'Plano Terapêutico Individual',
  '/clinica/sessao': 'Registro de sessão',
  '/clinica/evolucao': 'Evolução por objetivo',
  '/familia': 'Painel da família',
  '/familia/atividade': 'Atividade em casa',
  '/familia/consentimento': 'Autorizar o acesso da escola',
  '/escola': 'Cartão de estratégias',
  '/escola/ocorrencia': 'Registrar ocorrência',
  '/acessibilidade': 'Acessibilidade e ajuda',
}

export function App() {
  const { pathname } = useLocation()

  /* Titulo descritivo por tela — WCAG 2.4.2 / e-MAG 3.3. */
  useEffect(() => {
    document.title = `${titulos[pathname] ?? 'SINCTEA'} · SINCTEA`
  }, [pathname])

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Entrada />} />
        <Route path="/sobre" element={<Sobre />} />
        <Route path="/clinica" element={<PainelClinica />} />
        <Route path="/clinica/plano" element={<Plano />} />
        <Route path="/clinica/sessao" element={<RegistroSessao />} />
        <Route path="/clinica/evolucao" element={<Evolucao />} />
        <Route path="/familia" element={<PainelFamilia />} />
        <Route path="/familia/atividade" element={<Atividade />} />
        <Route path="/familia/consentimento" element={<Consentimento />} />
        <Route path="/escola" element={<CartaoEstrategias />} />
        <Route path="/escola/ocorrencia" element={<Ocorrencia />} />
        <Route path="/acessibilidade" element={<Acessibilidade />} />
        <Route path="*" element={<Entrada />} />
      </Route>
    </Routes>
  )
}
