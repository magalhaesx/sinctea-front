import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { ProvedorPreferencias } from './contexto/Preferencias'
import { App } from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* HashRouter: o site funciona no GitHub Pages sem configuracao de servidor. */}
    <HashRouter>
      <ProvedorPreferencias>
        <App />
      </ProvedorPreferencias>
    </HashRouter>
  </StrictMode>,
)
