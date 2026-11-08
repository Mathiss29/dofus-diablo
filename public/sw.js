// Service worker de Diablofus (application installée, src/render/installation.ts).
// Il ne garde RIEN en cache : chaque ouverture charge la dernière version du jeu depuis le réseau
// (déploiement continu à chaque fusion dans main ; fichiers lourds sur assets.diablofus.com).
// Seul rôle : afficher une page « hors ligne » au lieu de l'erreur du navigateur quand il n'y a pas de réseau.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

const HORS_LIGNE = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Diablofus : hors ligne</title>
<body style="margin:0;height:100vh;display:grid;place-content:center;gap:16px;text-align:center;background:#12141b;color:#e8e2d4;font:600 16px system-ui,sans-serif">
<b style="font-size:26px;color:#f4ead0">Pas de connexion</b>
<span>Diablofus se joue en ligne : le jeu se met à jour tout seul à chaque ouverture.</span>
<button onclick="location.reload()" style="justify-self:center;font:800 15px system-ui;padding:10px 22px;border-radius:8px;border:0;background:#b9e54b;color:#12141b;cursor:pointer">Réessayer</button>
</body></html>`;

self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return;   // tout le reste passe directement par le réseau
  e.respondWith(fetch(e.request).catch(() => new Response(HORS_LIGNE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
