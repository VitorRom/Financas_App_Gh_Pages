import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * O GitHub Pages serve o site em https://<usuario>.github.io/<repositorio>/, então os
 * assets precisam ser referenciados a partir desse subcaminho. Em desenvolvimento a
 * base é a raiz. Defina VITE_BASE no workflow de deploy.
 */
const base = process.env.VITE_BASE || '/';

/**
 * O Pages não tem fallback de SPA: uma URL como /transactions devolveria 404 porque
 * não existe arquivo com esse nome. Servir o próprio index.html como página de 404
 * faz o React Router assumir a rota no navegador.
 */
function spaFallbackForPages() {
  return {
    name: 'spa-fallback-404',
    apply: 'build',
    closeBundle() {
      const dist = resolve(process.cwd(), 'dist');
      copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'));
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), spaFallbackForPages()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
