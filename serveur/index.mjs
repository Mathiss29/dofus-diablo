// Serveur multijoueur de Diablofus (maquette « Multi : », 2026-11-08).
// Écoute seulement sur 127.0.0.1 : le monde y arrive par le tunnel Cloudflare (api.diablofus.com), voir LISEZMOI.md.
// Étape actuelle : santé + WebSocket d'essai (ping). Viendront : salons de coop, Bastion partagé, comptes Discord, sauvegardes.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT ?? 3100);
const HOTE = process.env.HOTE ?? '127.0.0.1';
/** Version déployée : le commit écrit par le workflow Serveur dans VERSION, sinon « dev ». */
const VERSION = (() => { try { return readFileSync(new URL('./VERSION', import.meta.url), 'utf8').trim().slice(0, 12); } catch { return 'dev'; } })();
/** Sites autorisés à ouvrir une connexion (le jeu en ligne, et le jeu lancé en local pour les essais). */
const ORIGINES = new Set(['https://diablofus.com', 'https://www.diablofus.com', 'https://mathiss29.github.io', 'http://localhost:5173', 'http://localhost:4173']);
const depart = Date.now();

export function creerServeur() {
  const http = createServer((req, res) => {
    const o = req.headers.origin;
    if (o && ORIGINES.has(o)) res.setHeader('access-control-allow-origin', o);
    if (req.method === 'GET' && (req.url === '/sante' || req.url === '/')) {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ ok: true, jeu: 'diablofus', version: VERSION, depuis: Math.round((Date.now() - depart) / 1000), connectes: ws.clients.size }));
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('introuvable');
  });
  const ws = new WebSocketServer({
    server: http, path: '/ws', maxPayload: 64 * 1024,
    verifyClient: ({ origin }) => !origin || ORIGINES.has(origin),
  });
  ws.on('connection', socket => {
    socket.on('message', (data, binaire) => {
      if (binaire || data.length > 1024) return;
      let m; try { m = JSON.parse(String(data)); } catch { return; }
      if (m?.k === 'ping') socket.send(JSON.stringify({ k: 'pong', t: m.t ?? null, serveur: Date.now() }));
    });
  });
  // battement : coupe les connexions mortes toutes les 30 s
  const battement = setInterval(() => { for (const s of ws.clients) { if (s.vivant === false) { s.terminate(); continue; } s.vivant = false; s.ping(); } }, 30_000);
  ws.on('connection', s => { s.vivant = true; s.on('pong', () => { s.vivant = true; }); });
  http.on('close', () => clearInterval(battement));
  return http;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = creerServeur();
  s.listen(PORT, HOTE, () => console.log(`Diablofus ${VERSION} : http://${HOTE}:${PORT}`));
  const fin = () => { console.log('arrêt'); s.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); };
  process.on('SIGTERM', fin); process.on('SIGINT', fin);
}
