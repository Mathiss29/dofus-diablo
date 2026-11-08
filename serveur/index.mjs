// Serveur multijoueur de Diablofus (maquette « Multi : », 2026-11-08).
// Écoute seulement sur 127.0.0.1 : le monde y arrive par le tunnel Cloudflare (api.diablofus.com), voir LISEZMOI.md.
// Étape actuelle : santé, ping et salons de coop (code à 5 lettres, l'hôte fait tourner la partie, le serveur relaie).
// + comptes Discord et persos en ligne (comptes.mjs, maquette « Vrai multi : » 11B). Viendront : partie sur le serveur, Bastion partagé.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { WebSocketServer } from 'ws';
import { creerComptes } from './comptes.mjs';

const PORT = Number(process.env.PORT ?? 3100);
const HOTE = process.env.HOTE ?? '127.0.0.1';
/** Version déployée : le commit écrit par le workflow Serveur dans VERSION, sinon « dev ». */
const VERSION = (() => { try { return readFileSync(new URL('./VERSION', import.meta.url), 'utf8').trim().slice(0, 12); } catch { return 'dev'; } })();
/** Sites autorisés à ouvrir une connexion (le jeu en ligne, et le jeu lancé en local pour les essais). */
const ORIGINES = new Set(['https://diablofus.com', 'https://www.diablofus.com', 'https://mathiss29.github.io', 'http://localhost:5173', 'http://localhost:4173']);
const depart = Date.now();

/** Salons de coop (maquette « Multi : » 3A) : 2 à 4 joueurs, le premier est l'hôte. Le serveur ne regarde pas la partie,
 *  il relaie : instantanés de l'hôte vers ses invités, entrées des invités vers l'hôte. */
export const SALON = { max: 4, salons: 300, debit: 120, lettres: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', taille: 5 };
const salons = new Map();
function nouveauCode() {
  for (;;) {
    let c = '';
    for (let i = 0; i < SALON.taille; i++) c += SALON.lettres[Math.floor(Math.random() * SALON.lettres.length)];
    if (!salons.has(c)) return c;
  }
}
const envoyer = (s, m) => { if (s.readyState === 1) s.send(typeof m === 'string' ? m : JSON.stringify(m)); };
/** Fait sortir un joueur de son salon ; l'hôte qui part ferme le salon (bascule d'hôte plus tard, 3D). */
function quitter(s) {
  const sa = s.salon;
  if (!sa) return;
  s.salon = null;
  sa.membres.delete(s.num);
  if (s.num === 1) { for (const m of sa.membres.values()) { m.salon = null; envoyer(m, { k: 'fin', raison: 'hote' }); } salons.delete(sa.code); return; }
  const h = sa.membres.get(1);
  if (h) envoyer(h, { k: 'depart', id: s.num });
}
function recu(s, m, brut) {
  if (m.k === 'ping') return envoyer(s, { k: 'pong', t: m.t ?? null, serveur: Date.now() });
  if (m.k === 'creer') {
    quitter(s);
    if (salons.size >= SALON.salons) return envoyer(s, { k: 'refus', raison: 'plein' });
    const sa = { code: nouveauCode(), membres: new Map([[1, s]]), suivant: 2 };
    salons.set(sa.code, sa); s.salon = sa; s.num = 1;
    return envoyer(s, { k: 'salon', code: sa.code, id: 1, hote: true });
  }
  if (m.k === 'rejoindre') {
    const sa = salons.get(String(m.code ?? '').toUpperCase().trim());
    if (!sa) return envoyer(s, { k: 'refus', raison: 'code' });
    if (sa.membres.size >= SALON.max) return envoyer(s, { k: 'refus', raison: 'complet' });
    quitter(s);
    s.salon = sa; s.num = sa.suivant++; sa.membres.set(s.num, s);
    envoyer(s, { k: 'salon', code: sa.code, id: s.num, hote: false });
    return envoyer(sa.membres.get(1), { k: 'arrivee', id: s.num });
  }
  if (m.k === 'quitter') return quitter(s);
  // relais : l'hôte parle à un invité (a) ou à tous ; un invité parle à l'hôte. d = données de la partie, non lues ici.
  if (m.k === 'envoi' && s.salon) {
    const sa = s.salon, de = s.num;
    const paquet = brut.length < 200_000 ? `{"k":"recu","de":${de},"d":${JSON.stringify(m.d ?? null)}}` : null;
    if (!paquet) return;
    if (de !== 1) return envoyer(sa.membres.get(1), paquet);
    if (m.a != null) { const c = sa.membres.get(Number(m.a)); if (c && c !== s) envoyer(c, paquet); return; }
    for (const c of sa.membres.values()) if (c !== s) envoyer(c, paquet);
  }
}

/** @param {{ comptes?: ReturnType<typeof creerComptes> }} [o] */
export function creerServeur({ comptes = creerComptes({ dossier: process.env.DONNEES ?? new URL('./donnees', import.meta.url).pathname, origines: ORIGINES }) } = {}) {
  const http = createServer(async (req, res) => {
    const o = req.headers.origin;
    if (o && ORIGINES.has(o)) {
      res.setHeader('access-control-allow-origin', o);
      res.setHeader('vary', 'origin');
      res.setHeader('access-control-allow-headers', 'authorization, content-type');
      res.setHeader('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('access-control-max-age', '86400');
    }
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    const url = new URL(req.url ?? '/', 'http://diablofus');
    if (req.method === 'GET' && (url.pathname === '/sante' || url.pathname === '/')) {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ ok: true, jeu: 'diablofus', version: VERSION, depuis: Math.round((Date.now() - depart) / 1000), connectes: ws.clients.size, salons: salons.size, connexion: comptes.pret, ...comptes.stats() }));
      return;
    }
    try { if (await comptes.route(req, res, url)) return; }
    catch (err) { console.warn('requête :', err.message); if (!res.headersSent) { res.writeHead(500); res.end(); } return; }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('introuvable');
  });
  const ws = new WebSocketServer({
    server: http, path: '/ws', maxPayload: 256 * 1024,
    verifyClient: ({ origin }) => !origin || ORIGINES.has(origin),
  });
  ws.on('connection', socket => {
    // débit : au plus SALON.debit messages par seconde et par joueur (au-delà, ignorés)
    let fen = Date.now(), n = 0;
    socket.on('message', (data, binaire) => {
      if (binaire) return;
      const t = Date.now();
      if (t - fen > 1000) { fen = t; n = 0; }
      if (++n > SALON.debit) return;
      const brut = String(data);
      let m; try { m = JSON.parse(brut); } catch { return; }
      if (m && typeof m === 'object') recu(socket, m, brut);
    });
    socket.on('close', () => quitter(socket));
  });
  // battement : coupe les connexions mortes toutes les 30 s
  const battement = setInterval(() => { for (const s of ws.clients) { if (s.vivant === false) { s.terminate(); continue; } s.vivant = false; s.ping(); } }, 30_000);
  ws.on('connection', s => { s.vivant = true; s.on('pong', () => { s.vivant = true; }); });
  http.on('close', () => { clearInterval(battement); comptes.fermer(); });
  return http;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = creerServeur();
  s.listen(PORT, HOTE, () => console.log(`Diablofus ${VERSION} : http://${HOTE}:${PORT}`));
  const fin = () => { console.log('arrêt'); s.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); };
  process.on('SIGTERM', fin); process.on('SIGINT', fin);
}
