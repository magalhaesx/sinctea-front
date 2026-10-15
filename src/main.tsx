import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { ProvedorPreferencias } from './contexto/Preferencias'
import { ProvedorSessao } from './contexto/Sessao'
import { App } from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* HashRouter: a rota fica depois do #, e o servidor so precisa entregar o index.html na raiz. */}
    <HashRouter>
      <ProvedorPreferencias>
        <ProvedorSessao>
          <App />
        </ProvedorSessao>
      </ProvedorPreferencias>
    </HashRouter>
  </StrictMode>,
)
