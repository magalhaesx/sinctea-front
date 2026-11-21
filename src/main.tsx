import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { ProvedorPreferencias } from './contexto/Preferencias'
import { ProvedorSessao } from './contexto/Sessao'
import { App } from './App'
import { registrarTrabalhador } from './pwa/versao'
// A fonte vem do proprio sistema, e nao do Google Fonts (item 22): o service
// worker a guarda com o app, e ela aparece sem conexao. So o subconjunto
// latino, que cobre o portugues, nos pesos e estilos que as telas usam.
import '@fontsource/atkinson-hyperlegible/latin-400.css'
import '@fontsource/atkinson-hyperlegible/latin-400-italic.css'
import '@fontsource/atkinson-hyperlegible/latin-700.css'
import './index.css'

registrarTrabalhador()

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
