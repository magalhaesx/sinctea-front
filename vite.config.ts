import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base relativo: o site funciona em qualquer caminho do GitHub Pages
// (usuario.github.io/qualquer-nome-de-repositorio) sem precisar reconfigurar.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
