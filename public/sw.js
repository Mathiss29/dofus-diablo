// Service worker de Diablofus (application installée, src/render/installation.ts).
// « Confort 2 : » 3A (2026-11-16) : les fichiers déjà chargés (cartes, monstres, sons, code du jeu) restent sur l'appareil.
//  - Seuls les fichiers à adresse versionnée sont gardés : « ?v=empreinte » (fichiers lourds, JSON du build) et le code de Vite
//    (« assets/index-<empreinte>.js ») : une nouvelle version a une autre adresse, on ne sert donc jamais un vieux fichier.
//  - La page elle-même vient toujours du réseau (le jeu se met à jour à chaque ouverture) ; sans réseau, la dernière page vue.
//  - version.json et le serveur de jeu ne passent jamais par ici.
const CACHE = 'diablofus-fichiers-v1', PAGES = 'diablofus-pages-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE && k !== PAGES) await caches.delete(k);
  await self.clients.claim();
})()));

const HORS_LIGNE = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Diablofus : hors ligne</title>
<body style="margin:0;height:100vh;display:grid;place-content:center;gap:16px;text-align:center;background:#12141b;color:#e8e2d4;font:600 16px system-ui,sans-serif">
<b style="font-size:26px;color:#f4ead0">Pas de connexion</b>
<span>Le jeu n'a pas encore été ouvert sur cet appareil : il faut du réseau la première fois.</span>
<button onclick="location.reload()" style="justify-self:center;font:800 15px system-ui;padding:10px 22px;border-radius:8px;border:0;background:#b9e54b;color:#12141b;cursor:pointer">Réessayer</button>
</body></html>`;

/** Adresse qui ne change jamais de contenu. */
function versionnee(u) {
  if (u.searchParams.has('v')) return true;
  return u.origin === self.location.origin && /\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(?:js|css)$/.test(u.pathname);
}

let ajouts = 0;
async function garder(req, rep) {
  if (!rep || !rep.ok || rep.type === 'opaque') return;
  try {
    const c = await caches.open(CACHE);
    await c.put(req, rep);
    if (++ajouts % 150 === 0) await tailler(c);
  } catch { /* stockage plein : on joue quand même */ }
}
/** Au-delà de 1,5 Go (ou de 80 % de la place permise), on enlève les plus anciens fichiers gardés. */
async function tailler(c) {
  const est = await self.navigator.storage?.estimate?.().catch(() => null);
  if (!est || !est.usage) return;
  const max = Math.min(1.5e9, (est.quota || 2e9) * 0.8);
  if (est.usage < max) return;
  const cles = await c.keys(), n = Math.ceil(cles.length * 0.2);
  for (const k of cles.slice(0, n)) await c.delete(k);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (req.mode === 'navigate') {
    // réseau d'abord ; la page reçue est gardée pour le jour sans réseau (une par adresse, sans le #)
    e.respondWith((async () => {
      try {
        const rep = await fetch(req);
        if (rep.ok) { const c = await caches.open(PAGES); await c.put(u.origin + u.pathname, rep.clone()).catch(() => {}); }
        return rep;
      } catch {
        const c = await caches.open(PAGES);
        return (await c.match(u.origin + u.pathname)) || (await c.match(u.origin + '/')) || new Response(HORS_LIGNE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }
  if (!/^https?:$/.test(u.protocol) || !versionnee(u)) return;   // le reste passe directement par le réseau
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const deja = await c.match(req);
    if (deja) return deja;
    const rep = await fetch(req);
    if (rep.ok && rep.type !== 'opaque') e.waitUntil(garder(req, rep.clone()));
    return rep;
  })());
});
