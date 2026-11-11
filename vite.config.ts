import { defineConfig, loadEnv, type Plugin } from 'vite';

/** Origine (schéma + hôte) d'une adresse, ou null si elle est vide ou invalide. */
const origine = (u: string | undefined) => { try { const x = new URL(u ?? ''); return `${x.protocol}//${x.host}`; } catch { return null; } };

/**
 * Sécurité (audit du 2026-11-11) : politique de contenu (CSP) posée dans la page du jeu publiée. GitHub Pages ne permet pas
 * d'envoyer d'en-têtes, d'où la balise <meta>. Le navigateur n'exécute alors que les scripts du site lui-même : un texte
 * piégé glissé dans la page (pseudo, sauvegarde importée, partie à plusieurs) ne peut pas lancer de code ni voler la connexion
 * Discord gardée dans le navigateur. Les adresses autorisées viennent des mêmes variables que le jeu (VITE_ASSETS_URL,
 * VITE_API_URL, VITE_COOP_URL). Seulement au build : le serveur de dev de Vite a besoin de scripts en ligne.
 */
function politiqueContenu(env: Record<string, string>): Plugin {
  const assets = origine(env.VITE_ASSETS_URL);
  const api = origine(env.VITE_API_URL ?? 'https://api.diablofus.com');
  const coop = origine(env.VITE_COOP_URL ?? 'wss://api.diablofus.com/ws');
  const L = (...x: (string | null)[]) => [...new Set(x.filter(Boolean))].join(' ');
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    `img-src ${L("'self'", 'data:', 'blob:', assets, 'https://cdn.discordapp.com')}`,
    `media-src ${L("'self'", 'data:', 'blob:', assets)}`,
    `connect-src ${L("'self'", 'data:', 'blob:', assets, api, coop)}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  return {
    name: 'politique-contenu', apply: 'build',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend' }],
  };
}

// base relative : le build marche aussi bien sur GitHub Pages que sur itch.io
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [politiqueContenu({ ...loadEnv(mode, process.cwd(), 'VITE_'), ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('VITE_'))) as Record<string, string> })],
  // version du build pour casser le cache des images (src/render/assetUrl.ts)
  define: { __BUILD__: JSON.stringify(Date.now().toString(36)) },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
  // le serveur multijoueur (serveur/) a ses propres tests (node --test)
  test: { exclude: ['**/node_modules/**', 'serveur/**'] },
}));
