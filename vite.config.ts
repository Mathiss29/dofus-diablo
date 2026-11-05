import { defineConfig } from 'vite';

// base relative : le build marche aussi bien sur GitHub Pages que sur itch.io
export default defineConfig({
  base: './',
  // version du build pour casser le cache des images (src/render/assetUrl.ts)
  define: { __BUILD__: JSON.stringify(Date.now().toString(36)) },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
});
