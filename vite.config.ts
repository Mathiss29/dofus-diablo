import { defineConfig } from 'vite';

// base relative : le build marche aussi bien sur GitHub Pages que sur itch.io
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
});
