// Serveur multijoueur de Diablofus (maquette « Multi : », 2026-11-08).
// Écoute seulement sur 127.0.0.1 : le monde y arrive par le tunnel Cloudflare (api.diablofus.com), voir LISEZMOI.md.
// Étape actuelle : santé, ping et salons de coop (code à 5 lettres, l'hôte fait tourner la partie, le serveur relaie).
// + comptes Discord et persos en ligne (comptes.mjs, maquette « Vrai multi : » 11B). Viendront : partie sur le serveur, Bastion partagé.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { WebSocketServer } from 'ws';
import { creerComptes } from './comptes.mjs';
import { arenesDisponibles, chargerSim, Partie } from './partie.mjs';
import { creerPresence } from './presence.mjs';
import { annonceurDiscord, creerClassement } from './classement.mjs';

const PORT = Number(process.env.PORT ?? 3100);
const HOTE = process.env.HOTE ?? '127.0.0.1';
/** Version déployée : le commit écrit par le workflow Serveur dans VERSION, sinon « dev ». */
const VERSION = (() => { try { return readFileSync(new URL('./VERSION', import.meta.url), 'utf8').trim().slice(0, 12); } catch { return 'dev'; } })();
/** Sites autorisés à ouvrir une connexion (le jeu en ligne, et le jeu lancé en local pour les essais). */
const ORIGINES = new Set(['https://diablofus.com', 'https://www.diablofus.com', 'https://mathiss29.github.io', 'http://localhost:5173', 'http://localhost:4173']);
const depart = Date.now();

/** Salons de coop (maquette « Multi : » 3A) : 2 à 4 joueurs, le premier est l'hôte. Le serveur ne regarde pas la partie,
 *  il relaie : instantanés de l'hôte vers ses invités, entrées des invités vers l'hôte. */
export const SALON = { max: 4, salons: 300, parties: 20, debit: 120, lettres: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', taille: 5 };
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
  // partie tenue par le serveur : le joueur sort, les autres continuent ; le salon ferme quand il est vide
  if (sa.partie) {
    const m = sa.partie.membres.get(s.num);
    sa.partie.depart(s.num);
    if (m?.compte) enJeu.delete(`${m.compte.compte}:${m.compte.emplacement}`);
    if (!sa.membres.size) fermerPartie(sa);
    return;
  }
  if (s.num === 1) { for (const m of sa.membres.values()) { m.salon = null; envoyer(m, { k: 'fin', raison: 'hote' }); } salons.delete(sa.code); return; }
  const h = sa.membres.get(1);
  if (h) envoyer(h, { k: 'depart', id: s.num });
}
/** Parties tenues par le serveur (maquette « Vrai multi : » 1A) : une boucle commune avance toutes les parties. */
let boucle = null, avant = 0;
/** Comptes du serveur lancé (creerServeur) : les parties y lisent et sauvent les persos. */
let lesComptes = null;
/** Persos du compte en cours de partie (« compte:emplacement ») : un même perso ne joue pas deux fois en même temps. */
const enJeu = new Set();
/** Sauve les persos de toutes les parties (arrêt du serveur). */
export function sauverParties() { for (const sa of parties()) sa.partie.sauverTout(); }
const parties = () => [...salons.values()].filter(sa => sa.partie);
function fermerPartie(sa) {
  salons.delete(sa.code);
  try { sa.partie.sauverTout(); } catch (e) { console.warn('partie : sauvegarde ratée', e.message); }
  for (const m of sa.partie.membres.values()) if (m.compte) enJeu.delete(`${m.compte.compte}:${m.compte.emplacement}`);
  for (const m of sa.membres.values()) { m.salon = null; envoyer(m, { k: 'fin', raison: 'erreur' }); }
  if (!parties().length && boucle) { clearInterval(boucle); boucle = null; }
}
function tourner() {
  if (boucle) return;
  avant = performance.now();
  boucle = setInterval(() => {
    const t = performance.now(), dt = (t - avant) / 1000; avant = t;
    for (const sa of parties()) {
      try { sa.partie.avancer(dt); }
      catch (e) { console.warn(`partie ${sa.code} arrêtée :`, e.message); fermerPartie(sa); }
    }
  }, 1000 / 60);
}
/** monde : la partie est Incarnam en monde ouvert (étape 4, monde partagé), sinon l'arène d'un donjon (arene : son tag, la Crypte par défaut). */
async function creerPartie(s, monde = false, arene = null) {
  const S = await chargerSim();
  if (s.readyState !== 1) return;
  if (!S) return envoyer(s, { k: 'refus', raison: 'indisponible' });
  if (arene && !monde && !arenesDisponibles(S).some(a => a.tag === arene)) return envoyer(s, { k: 'refus', raison: 'donjon' });
  if (salons.size >= SALON.salons || parties().length >= SALON.parties) return envoyer(s, { k: 'refus', raison: 'plein' });
  const sa = { code: nouveauCode(), membres: new Map([[1, s]]), suivant: 2 };
  sa.partie = new Partie(S, (num, d) => { const c = sa.membres.get(num); if (c) envoyer(c, `{"k":"recu","de":0,"d":${JSON.stringify(d)}}`); },
    undefined, (c, perso) => lesComptes?.sauverPartie(c.compte, c.emplacement, perso), { monde, arene, donjonFini: (nom, temps, L) => leClassement?.noterDonjon(nom, temps, L) });
  sa.partie.arrivee(1);
  salons.set(sa.code, sa); s.salon = sa; s.num = 1;
  tourner();
  return envoyer(s, { k: 'salon', code: sa.code, id: 1, hote: false, serveur: true });
}
/** Un joueur arrive dans une partie du serveur avec son jeton : on lit SON perso sur son compte (4A), le jeu n'envoie que
 *  l'emplacement. Jeton faux, emplacement vide ou perso déjà en jeu : refus, le jeu le dit au joueur. */
function bonjourCompte(s, sa, d) {
  if (!d || typeof d !== 'object' || d.k !== 'bonjour') return d;
  const { jeton, emplacement, compte: _faux, ...reste } = d;
  if (jeton == null) return reste;
  const c = lesComptes?.persoPartie(jeton, emplacement);
  const cle = c && `${c.compte}:${c.emplacement}`;
  const raison = !c ? 'perso' : !c.testeur ? 'testeur' : c.perso.hardcore ? 'hardcore' : enJeu.has(cle) || sa.partie.membres.get(s.num)?.compte ? 'deja' : null;
  if (raison) { envoyer(s, { k: 'refus', raison }); quitter(s); return null; }
  enJeu.add(cle);
  return { ...reste, compte: c };
}
/** Présence en ligne et Bastion partagé (presence.mjs), créée avec le serveur. */
let presence = null;
/** Classement des aventuriers (classement.mjs, maquette « Ladder : »), créé avec le serveur. */
let leClassement = null;
function recu(s, m, brut) {
  if (presence?.recu(s, m)) return;
  if (m.k === 'ping') return envoyer(s, { k: 'pong', t: m.t ?? null, serveur: Date.now() });
  if (m.k === 'creer') {
    quitter(s);
    if (m.serveur) return void creerPartie(s, m.monde === true, typeof m.arene === 'string' ? m.arene.slice(0, 40) : null);
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
    if (sa.partie) { sa.partie.arrivee(s.num); return envoyer(s, { k: 'salon', code: sa.code, id: s.num, hote: false, serveur: true }); }
    envoyer(s, { k: 'salon', code: sa.code, id: s.num, hote: false });
    return envoyer(sa.membres.get(1), { k: 'arrivee', id: s.num });
  }
  if (m.k === 'quitter') return quitter(s);
  // relais : l'hôte parle à un invité (a) ou à tous ; un invité parle à l'hôte. d = données de la partie, non lues ici.
  if (m.k === 'envoi' && s.salon) {
    const sa = s.salon, de = s.num;
    if (sa.partie) return sa.partie.recu(de, bonjourCompte(s, sa, m.d));
    const paquet = brut.length < 200_000 ? `{"k":"recu","de":${de},"d":${JSON.stringify(m.d ?? null)}}` : null;
    if (!paquet) return;
    if (de !== 1) return envoyer(sa.membres.get(1), paquet);
    if (m.a != null) { const c = sa.membres.get(Number(m.a)); if (c && c !== s) envoyer(c, paquet); return; }
    for (const c of sa.membres.values()) if (c !== s) envoyer(c, paquet);
  }
}

/** @param {{ comptes?: ReturnType<typeof creerComptes>, annoncer?: (texte: string) => void }} [o] */
export function creerServeur({ comptes = creerComptes({ dossier: process.env.DONNEES ?? new URL('./donnees', import.meta.url).pathname, origines: ORIGINES }), annoncer = annonceurDiscord(process.env.DISCORD_ANNONCES) } = {}) {
  lesComptes = comptes;
  presence?.fermer();
  presence = creerPresence({ comptes, envoyer });
  leClassement?.fermer();
  leClassement = creerClassement({ comptes, enLigne: () => presence?.enLigne() ?? [], annoncer });
  comptes.surTombe = (c, perso, stele) => leClassement?.tomber(c, perso, stele);
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
      res.end(JSON.stringify({ ok: true, jeu: 'diablofus', version: VERSION, depuis: Math.round((Date.now() - depart) / 1000), connectes: ws.clients.size, salons: salons.size, parties: parties().length, enLigne: presence?.nombre() ?? 0, connexion: comptes.pret, ...comptes.stats() }));
      return;
    }
    try { if (await leClassement.route(req, res, url) || await comptes.route(req, res, url)) return; }
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
    socket.on('close', () => { quitter(socket); presence?.quitter(socket); });
  });
  // battement : coupe les connexions mortes toutes les 30 s
  const battement = setInterval(() => { for (const s of ws.clients) { if (s.vivant === false) { s.terminate(); continue; } s.vivant = false; s.ping(); } }, 30_000);
  ws.on('connection', s => { s.vivant = true; s.on('pong', () => { s.vivant = true; }); });
  http.on('close', () => { clearInterval(battement); presence?.fermer(); leClassement?.fermer(); for (const sa of parties()) fermerPartie(sa); comptes.fermer(); });
  return http;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = creerServeur();
  s.listen(PORT, HOTE, () => console.log(`Diablofus ${VERSION} : http://${HOTE}:${PORT}`));
  const fin = () => { console.log('arrêt'); sauverParties(); s.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); };
  process.on('SIGTERM', fin); process.on('SIGINT', fin);
}
