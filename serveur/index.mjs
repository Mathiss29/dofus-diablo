// Serveur multijoueur de Diablofus (maquette « Multi : », 2026-11-08).
// Écoute seulement sur 127.0.0.1 : le monde y arrive par le tunnel Cloudflare (api.diablofus.com), voir LISEZMOI.md.
// Étape actuelle : santé, ping et salons de coop (code à 5 lettres, l'hôte fait tourner la partie, le serveur relaie).
// + comptes Discord et persos en ligne (comptes.mjs, maquette « Vrai multi : » 11B). Viendront : partie sur le serveur, Bastion partagé.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { WebSocketServer } from 'ws';
import { creerComptes } from './comptes.mjs';
import { arenesDisponibles, chargerSim, heureParis, Partie } from './partie.mjs';
import { creerPresence } from './presence.mjs';
import { annonceurDiscord, creerClassement } from './classement.mjs';
import { creerFils } from './fils.mjs';

const PORT = Number(process.env.PORT ?? 3100);
const HOTE = process.env.HOTE ?? '127.0.0.1';
/** Version déployée : le commit écrit par le workflow Serveur dans VERSION, sinon « dev ». */
const VERSION = (() => { try { return readFileSync(new URL('./VERSION', import.meta.url), 'utf8').trim().slice(0, 12); } catch { return 'dev'; } })();
/** Sites autorisés à ouvrir une connexion (le jeu en ligne, et le jeu lancé en local pour les essais). */
const ORIGINES = new Set(['https://diablofus.com', 'https://www.diablofus.com', 'https://mathiss29.github.io', 'https://ombrelune-studio.github.io', 'http://localhost:5173', 'http://localhost:4173']);
const depart = Date.now();

/** Salons de coop (maquette « Multi : » 3A) : 2 à 4 joueurs, le premier est l'hôte. Le serveur ne regarde pas la partie,
 *  il relaie : instantanés de l'hôte vers ses invités, entrées des invités vers l'hôte. */
/** continents : mondes du continent entier en même temps (« En ligne : » 1A, environ 20 Mo chacun depuis 8C, sous les 1,5 Go de Node). */
/** attenteVide : un monde ouvert vide attend son groupe ce temps (ms) avant de fermer (« En ligne : » 8B) ; bossMax : joueurs du
 *  combat commun d'un boss du monde (3D). */
export const SALON = { max: 4, salons: 300, parties: 80, continents: 40, debit: 120, lettres: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', taille: 5, attenteVide: 120_000, bossMax: 16 };
const salons = new Map();
/** « En ligne : » 1A : monde ouvert de chaque groupe, « groupe:zone » → code de son salon (une partie par zone tenue par le serveur). */
const mondes = new Map();
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
    // « En ligne : » 8B : le monde d'un groupe attend 2 min (un retour de donjon, une connexion qui saute) ; le reste ferme tout de suite
    if (!sa.membres.size) { if (sa.partie.monde && sa.cleMonde && !sa.cleMonde.startsWith('boss:')) sa.videDepuis = Date.now(); else fermerPartie(sa); }
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
export function sauverParties() { return Promise.all(parties().map(sa => { try { return sa.partie.sauverTout(); } catch (e) { console.warn('partie : sauvegarde ratée', e.message); return null; } })); }
/** « En ligne : » 7B : fils des parties (fils.mjs), FILS=2 sur le VPS ; sans, les parties tournent dans ce fil. */
let fils = null;
const parties = () => [...salons.values()].filter(sa => sa.partie);
function fermerPartie(sa) {
  salons.delete(sa.code);
  if (sa.cleMonde && mondes.get(sa.cleMonde) === sa.code) mondes.delete(sa.cleMonde);
  let fini = null;
  try { fini = sa.partie.distante ? sa.partie.fermer() : sa.partie.sauverTout(); } catch (e) { console.warn('partie : sauvegarde ratée', e.message); }
  for (const m of sa.partie.membres.values()) if (m.compte) enJeu.delete(`${m.compte.compte}:${m.compte.emplacement}`);
  for (const m of sa.membres.values()) { m.salon = null; envoyer(m, { k: 'fin', raison: 'erreur' }); }
  if (!parties().length && boucle) { clearInterval(boucle); boucle = null; }
  return fini;
}
/** « En ligne : » 8B : ferme les mondes vides depuis plus de SALON.attenteVide (les persos ont été sauvés au départ de chacun). */
export function fermerMondesVides(t = Date.now()) {
  for (const sa of parties()) if (sa.videDepuis != null && !sa.membres.size && t - sa.videDepuis >= SALON.attenteVide) fermerPartie(sa);
}
let derniereRonde = 0;
function tourner() {
  if (boucle) return;
  avant = performance.now();
  boucle = setInterval(() => {
    const t = performance.now(), dt = (t - avant) / 1000; avant = t;
    for (const sa of parties()) {
      if (sa.partie.distante) continue;   // son fil la fait tourner
      try { sa.partie.avancer(dt); }
      catch (e) { console.warn(`partie ${sa.code} arrêtée :`, e.message); fermerPartie(sa); }
    }
    if (t - derniereRonde > 5000) { derniereRonde = t; fermerMondesVides(); }
  }, 1000 / 60);
}
/** monde : la partie est un monde ouvert (true = Incarnam, ou le nom de sa zone : « En ligne : » 1A), sinon l'arène d'un donjon
 *  (arene : son tag, la Crypte par défaut). cleMonde : « groupe:zone », le monde de ce groupe (les autres membres le rejoignent). */
async function creerPartie(s, monde = false, arene = null, cleMonde = null, o = {}) {
  const S = await chargerSim();
  if (s.readyState !== 1) return;
  if (cleMonde && mondes.has(cleMonde)) return entrerMonde(s, cleMonde);   // un autre membre l'a créé pendant qu'on chargeait
  if (!S) return envoyer(s, { k: 'refus', raison: 'indisponible' });
  if (arene && !monde && !arenesDisponibles(S).some(a => a.tag === arene)) return envoyer(s, { k: 'refus', raison: 'donjon' });
  const lourd = typeof monde === 'string' && monde !== 'incarnam';
  if (salons.size >= SALON.salons || parties().length >= SALON.parties || lourd && parties().filter(x => x.partie.zoneMonde && x.partie.zoneMonde !== 'incarnam').length >= SALON.continents)
    return envoyer(s, { k: 'refus', raison: 'plein' });
  const sa = { code: nouveauCode(), membres: new Map([[1, s]]), suivant: 2, cleMonde, max: o.max ?? SALON.max };
  if (cleMonde) mondes.set(cleMonde, sa.code);
  sa.partie = fils?.n ? fils.creer(sa.code, S, Math.floor(Math.random() * 2 ** 31), { monde, arene, ...o })
    : new Partie(S, (num, d) => { const c = sa.membres.get(num); if (c) envoyer(c, `{"k":"recu","de":0,"d":${JSON.stringify(d)}}`); },
      undefined, (c, perso) => lesComptes?.sauverPartie(c.compte, c.emplacement, perso), { monde, arene, donjonFini: (nom, temps, L, idoles) => leClassement?.noterDonjon(nom, temps, L, idoles), signer: it => lesComptes?.hdv?.signer(it), ...o });
  sa.partie.arrivee(1);
  salons.set(sa.code, sa); s.salon = sa; s.num = 1;
  tourner();
  return envoyer(s, { k: 'salon', code: sa.code, id: 1, hote: false, serveur: true });
}
/** Fait entrer un joueur dans un salon de partie existant (par son code). */
function entrerSalon(s, sa) {
  quitter(s);
  s.salon = sa; s.num = sa.suivant++; sa.membres.set(s.num, s); sa.videDepuis = null;
  sa.partie.arrivee(s.num);
  return envoyer(s, { k: 'salon', code: sa.code, id: s.num, hote: false, serveur: true, monde: sa.partie.zoneMonde });
}
function entrerMonde(s, cle) {
  const sa = salons.get(mondes.get(cle));
  if (!sa?.partie) { mondes.delete(cle); return false; }
  if (sa.membres.size >= (sa.max ?? SALON.max)) return envoyer(s, { k: 'refus', raison: 'complet' }), true;
  entrerSalon(s, sa); return true;
}
/** « En ligne : » 1A + 5A : un membre d'un groupe entre dans une zone du monde ouvert (en arrivant dans la zone, par une porte, ou en
 *  se groupant) : il rejoint le monde de son groupe pour cette zone, créé s'il n'existe pas. Le jeton dit qui il est ; seul, il joue
 *  sur son PC (2A) : refus « groupe ». arrivee : la porte par laquelle il arrive, gardée pour son bonjour. */
async function mondeGroupe(s, m) {
  const c = lesComptes?.persoPartie(m.jeton, m.emplacement);
  if (!c) return envoyer(s, { k: 'refus', raison: 'perso' });
  const g0 = presence?.groupeDe(c.compte);
  // « HDV : » 4B : seul, il peut choisir de jouer sur le serveur (son butin y est vu, donc vendable) : un monde rien qu'à lui
  const g = g0 ?? (m.seul === true ? `solo${c.compte}` : null);
  if (g == null) return envoyer(s, { k: 'refus', raison: 'groupe' });
  const S = await chargerSim();
  // « En ligne : » 5B : rejoindre un allié d'un clic : la partie où il joue (monde du groupe ou donjon), à côté de lui
  if (m.allie != null) {
    const id = Number(m.allie);
    if (g0 == null || presence?.groupeDe(id) !== g0) return envoyer(s, { k: 'refus', raison: 'allie' });
    const sa = parties().find(x => x.partie.positionDe(id));
    if (!sa) return envoyer(s, { k: 'refus', raison: 'allie' });
    if (sa.membres.size >= (sa.max ?? SALON.max)) return envoyer(s, { k: 'refus', raison: 'complet' });
    s.arrivee = null; s.transit = sa.partie.monde ? { position: sa.partie.positionDe(id) } : null;
    entrerSalon(s, sa); return;
  }
  // « En ligne : » 3D : le boss du monde de ce créneau : un seul combat pour tous les groupes de la zone
  if (m.boss === true) {
    const zone = typeof m.zone === 'string' && S?.mondes[m.zone] ? m.zone : null;
    if (!zone || !S.VIVANT) return envoyer(s, { k: 'refus', raison: 'indisponible' });
    const cle = `boss:${zone}:${Math.floor(heureParis() / S.VIVANT.boss.periode)}`;
    s.arrivee = null; s.transit = { position: m.position };
    if (!entrerMonde(s, cle)) { quitter(s); await creerPartie(s, zone, null, cle, { max: SALON.bossMax, combatBoss: true }); }
    return;
  }
  // « En ligne : » 4C : la porte d'un donjon dans le monde du groupe : l'arène du groupe pour ce donjon (les autres reçoivent « Rejoindre »)
  if (typeof m.arene === 'string') {
    const a = S && arenesDisponibles(S).find(x => x.tag === m.arene);
    if (!a) return envoyer(s, { k: 'refus', raison: 'donjon' });
    const cle = `${g}:arene:${a.tag}`;
    if (entrerMonde(s, cle)) return;
    quitter(s);
    await creerPartie(s, false, a.tag, cle);
    const sa = s.salon;
    if (sa?.cleMonde === cle) presence?.annoncerDonjon(c.compte, sa.code, a.nom);
    return;
  }
  const zone = typeof m.zone === 'string' ? m.zone : '';
  if (!S || !S.mondes[zone]) return envoyer(s, { k: 'refus', raison: 'indisponible' });
  s.arrivee = Array.isArray(m.arrivee) ? m.arrivee.slice(0, 2) : null;
  s.transit = { zaap: m.zaap, position: m.position, point: m.point, retour: m.retour };
  const cle = `${g}:${zone}`;
  if (!entrerMonde(s, cle)) { quitter(s); await creerPartie(s, zone, null, cle, { bossPartage: zone !== 'incarnam' }); }
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
  const arrivee = s.arrivee, transit = s.transit ?? {}; s.arrivee = null; s.transit = null;
  return { ...reste, compte: c, ...transit, ...(arrivee ? { arrivee } : {}) };
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
  if (m.k === 'mondeGroupe') return void mondeGroupe(s, m);
  if (m.k === 'rejoindre') {
    const sa = salons.get(String(m.code ?? '').toUpperCase().trim());
    if (!sa) return envoyer(s, { k: 'refus', raison: 'code' });
    if (sa.membres.size >= SALON.max) return envoyer(s, { k: 'refus', raison: 'complet' });
    if (sa.partie) return entrerSalon(s, sa);
    quitter(s);
    s.salon = sa; s.num = sa.suivant++; sa.membres.set(s.num, s);
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
export function creerServeur({ comptes = creerComptes({ dossier: process.env.DONNEES ?? new URL('./donnees', import.meta.url).pathname, origines: ORIGINES }), annoncer = annonceurDiscord(process.env.DISCORD_ANNONCES),
  nFils = Number(process.env.FILS ?? 0) || 0 } = {}) {
  lesComptes = comptes;
  void fils?.fermer();
  fils = nFils > 0 ? creerFils({ n: Math.min(nFils, 8), cle: comptes.hdv?.cleSignature,
    recevoir: (code, num, texte) => { const c = salons.get(code)?.membres.get(num); if (c) envoyer(c, `{"k":"recu","de":0,"d":${texte}}`); },
    sauver: (compte, emplacement, perso) => lesComptes?.sauverPartie(compte, emplacement, perso),
    donjonFini: (nom, temps, L, idoles) => leClassement?.noterDonjon(nom, temps, L, idoles),
    arret: code => { const sa = salons.get(code); if (sa?.partie) fermerPartie(sa); } }) : null;
  presence?.fermer();
  presence = creerPresence({ comptes, envoyer });
  leClassement?.fermer();
  leClassement = creerClassement({ comptes, enLigne: () => presence?.enLigne() ?? [], annoncer });
  comptes.surTombe = (c, perso, stele) => leClassement?.tomber(c, perso, stele);
  // « HDV : » : un perso qui joue dans une partie du serveur : les gestes de l'HDV s'y font
  if (comptes.hdv) comptes.hdv.partieDe = (c, i) => { for (const sa of parties()) { const j = sa.partie.joueurDuCompte(c, i); if (j) return j; } return null; };
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
    // « En ligne : » 8A : messages compressés (les instantanés passent d'environ 3 fois moins d'octets) ; les petits partent tels quels
    perMessageDeflate: { threshold: 1024, zlibDeflateOptions: { level: 1 }, serverNoContextTakeover: false, clientNoContextTakeover: true },
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
  http.on('close', () => {
    clearInterval(battement); presence?.fermer(); leClassement?.fermer();
    const f = fils; fils = null;
    void Promise.all(parties().map(fermerPartie)).finally(() => { void f?.fermer(); comptes.fermer(); });
  });
  return http;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = creerServeur();
  s.listen(PORT, HOTE, () => console.log(`Diablofus ${VERSION} : http://${HOTE}:${PORT}`));
  const fin = () => { console.log('arrêt'); presence?.annoncer('Le serveur redémarre : tu seras reconnecté dans un instant'); void sauverParties().finally(() => s.close(() => process.exit(0))); setTimeout(() => process.exit(0), 3000).unref(); };
  process.on('SIGTERM', fin); process.on('SIGINT', fin);
}
