import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { creerServeur } from './index.mjs';
import { creerComptes } from './comptes.mjs';

const ORIGINES = new Set(['https://diablofus.com']);
/** Faux Discord : un joueur, membre du serveur avec le rôle 42. */
const faux = async (url, o) => {
  const r = (code, corps) => ({ ok: code < 300, status: code, json: async () => corps });
  if (url.endsWith('/oauth2/token')) return new URLSearchParams(o.body).get('code') === 'bon' ? r(200, { access_token: 'acces' }) : r(400, {});
  if (url.endsWith('/users/@me')) return r(200, { id: '123', username: 'mathis', global_name: 'Mathis', avatar: 'abc' });
  if (url.includes('/member')) return r(200, { roles: ['42'] });
  return r(404, {});
};
async function serveur(env = { DISCORD_ID: 'id', DISCORD_SECRET: 'secret', DISCORD_SERVEUR: '9', ROLES_TESTEUR: '42' }) {
  const dossier = mkdtempSync(join(tmpdir(), 'diablofus-'));
  const comptes = creerComptes({ dossier, env, origines: ORIGINES, fetch: faux });
  const s = creerServeur({ comptes });
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${s.address().port}`;
  return { s, base, comptes, dossier, fin: () => new Promise(r => { s.close(r); s.closeAllConnections(); }) };
}
async function connecter(base) {
  const a = await fetch(`${base}/connexion?retour=${encodeURIComponent('https://diablofus.com/')}`, { redirect: 'manual' });
  assert.equal(a.status, 302);
  const d = new URL(a.headers.get('location'));
  assert.equal(d.origin, 'https://discord.com');
  assert.equal(d.searchParams.get('redirect_uri'), 'https://api.diablofus.com/connexion/retour');
  const b = await fetch(`${base}/connexion/retour?code=bon&state=${d.searchParams.get('state')}`, { redirect: 'manual' });
  const m = /^https:\/\/diablofus\.com\/#connexion=([0-9a-f]{64})$/.exec(b.headers.get('location'));
  assert.ok(m, b.headers.get('location'));
  return m[1];
}

test('connexion Discord : jeton, profil, rôles, déconnexion', async () => {
  const { base, fin } = await serveur();
  const j = await connecter(base), auth = { authorization: `Bearer ${j}` };
  const moi = await (await fetch(`${base}/moi`, { headers: auth })).json();
  assert.equal(moi.compte.nom, 'Mathis');
  assert.equal(moi.compte.testeur, true);
  assert.equal(moi.compte.admin, false);
  assert.deepEqual(moi.persos, [null, null, null]);
  assert.equal((await fetch(`${base}/moi`)).status, 401);
  await fetch(`${base}/deconnexion`, { method: 'POST', headers: auth });
  assert.equal((await fetch(`${base}/moi`, { headers: auth })).status, 401);
  await fin();
});

test('pas de redirection vers un autre site, état OAuth2 vérifié', async () => {
  const { base, fin } = await serveur();
  assert.equal((await fetch(`${base}/connexion?retour=${encodeURIComponent('https://pirate.example/')}`, { redirect: 'manual' })).status, 400);
  assert.equal((await fetch(`${base}/connexion/retour?code=bon&state=faux`, { redirect: 'manual' })).status, 400);
  await fin();
});

test('sans secrets Discord : le jeu est prévenu, rien ne plante', async () => {
  const { base, fin } = await serveur({});
  const a = await fetch(`${base}/connexion?retour=${encodeURIComponent('https://diablofus.com/')}`, { redirect: 'manual' });
  assert.equal(a.headers.get('location'), 'https://diablofus.com/#connexion-erreur=indisponible');
  assert.equal((await (await fetch(`${base}/sante`)).json()).connexion, false);
  await fin();
});

test('persos en ligne : sauvegarde, plus récent gagne, import unique, suppression, copie nocturne', async () => {
  const { base, fin, comptes, dossier } = await serveur();
  const auth = { authorization: `Bearer ${await connecter(base)}`, 'content-type': 'application/json' };
  const perso = (nom, level = 1) => ({ nom, classe: 'iop', sexe: 'm', etat: { level } });
  const put = (n, corps) => fetch(`${base}/persos/${n}`, { method: 'PUT', headers: auth, body: JSON.stringify(corps) });
  assert.equal((await put(0, { perso: perso('Goultard', 5), maj: 100 })).status, 200);
  assert.equal((await put(0, { perso: perso('Goultard', 4), maj: 50 })).status, 409);   // un vieux PC ne remplace pas une partie plus récente
  assert.equal((await put(3, { perso: perso('X'), maj: 1 })).status, 404);
  assert.equal((await put(1, { perso: { nom: 1 } })).status, 400);
  const imp = corps => fetch(`${base}/import`, { method: 'POST', headers: auth, body: JSON.stringify(corps) });
  assert.equal((await imp({ emplacement: 0, perso: perso('Local') })).status, 409);       // emplacement pris
  assert.equal((await imp({ emplacement: 1, perso: perso('Local', 30) })).status, 200);
  assert.equal((await imp({ emplacement: 2, perso: perso('Encore') })).status, 403);      // une seule fois
  const moi = await (await fetch(`${base}/moi`, { headers: auth })).json();
  assert.deepEqual(moi.persos.map(p => p?.perso.etat.level ?? null), [5, 30, null]);
  assert.equal(moi.compte.importe, true);
  assert.equal((await fetch(`${base}/coffres/normal`, { method: 'PUT', headers: auth, body: JSON.stringify({ coffre: { kamas: 12 } }) })).status, 200);
  assert.equal((await fetch(`${base}/coffres/test`, { method: 'PUT', headers: auth, body: JSON.stringify({ coffre: {} }) })).status, 404);
  assert.deepEqual((await (await fetch(`${base}/moi`, { headers: auth })).json()).coffres, { normal: { kamas: 12 } });
  await fetch(`${base}/persos/0`, { method: 'DELETE', headers: auth });
  assert.equal((await (await fetch(`${base}/moi`, { headers: auth })).json()).persos[0], null);
  assert.equal((await put(2, { perso: { ...perso('Gros'), inventaire: 'x'.repeat(3 * 1024 * 1024) } })).status, 413);
  comptes.copieNocturne(new Date('2026-11-09T03:30:00Z'));
  assert.deepEqual(readdirSync(join(dossier, 'sauvegardes')), ['diablofus-2026-11-09.db']);
  const pre = await fetch(`${base}/moi`, { method: 'OPTIONS', headers: { origin: 'https://diablofus.com' } });
  assert.equal(pre.headers.get('access-control-allow-headers'), 'authorization, content-type');
  await fin();
});

test('partie sur le serveur avec le perso du compte : lu sur le compte, sauvé au départ, un seul à la fois', async () => {
  const { base, fin } = await serveur();
  const j = await connecter(base), auth = { authorization: `Bearer ${j}`, 'content-type': 'application/json' };
  const perso = { nom: 'Lyra', classe: 'cra', sexe: 'f', hardcore: false, cree: 1, maj: 1000, temps: 60, lieu: 'Incarnam', zones: [],
    etat: { level: 30, xp: 0, points: 0, kamas: 77, potions: 3, lootFilter: 0, base: {}, bag: [], equipment: {}, resources: {}, metiers: {},
      bar: [], variants: [], learned: [], x: 123, y: 456, retour: { name: 'incarnam', x: 1, y: 2 }, zone: 'astrub' } };
  assert.equal((await fetch(`${base}/persos/1`, { method: 'PUT', headers: auth, body: JSON.stringify({ perso, maj: 1000 }) })).status, 200);
  const { default: WebSocket } = await import('ws');
  const client = async () => {
    const ws = new WebSocket(base.replace('http', 'ws') + '/ws'), file = [], attente = [];
    ws.on('message', d => { const m = JSON.parse(String(d)); const a = attente.shift(); if (a) a(m); else file.push(m); });
    await new Promise(ok => ws.on('open', ok));
    const lire = () => file.length ? Promise.resolve(file.shift()) : new Promise(ok => attente.push(ok));
    return { ws, envoi: m => ws.send(JSON.stringify(m)), attendre: async f => { for (;;) { const m = await lire(); if (f(m)) return m; } } };
  };
  const a = await client();
  a.envoi({ k: 'creer', serveur: true });
  const sa = await a.attendre(m => m.k === 'salon' || m.k === 'refus');
  if (sa.k === 'refus') { a.ws.close(); await fin(); return; }   // simulation pas construite : le test des parties le signale
  // le jeu ment sur la classe et le niveau : le serveur prend le perso du compte
  a.envoi({ k: 'envoi', d: { k: 'bonjour', classe: 'iop', etat: { level: 200 }, jeton: j, emplacement: 1 } });
  await a.attendre(m => m.k === 'recu' && m.d.k === 'zone');
  // le même perso ne peut pas entrer deux fois
  const b = await client();
  b.envoi({ k: 'rejoindre', code: sa.code });
  await b.attendre(m => m.k === 'salon');
  b.envoi({ k: 'envoi', d: { k: 'bonjour', jeton: j, emplacement: 1 } });
  assert.equal((await b.attendre(m => m.k === 'refus')).raison, 'deja');
  // jeton faux : refus
  const c = await client();
  c.envoi({ k: 'rejoindre', code: sa.code });
  await c.attendre(m => m.k === 'salon');
  c.envoi({ k: 'envoi', d: { k: 'bonjour', jeton: 'f'.repeat(64), emplacement: 1 } });
  assert.equal((await c.attendre(m => m.k === 'refus')).raison, 'perso');
  a.ws.close();
  await new Promise(r => setTimeout(r, 300));
  const moi = await (await fetch(`${base}/moi`, { headers: auth })).json();
  const p = moi.persos[1].perso;
  assert.equal(p.classe, 'cra');
  assert.equal(p.etat.level, 30, 'le niveau envoyé par le jeu est ignoré');
  assert.equal(p.etat.kamas, 77);
  assert.deepEqual([p.etat.zone, p.etat.x, p.etat.y], ['astrub', 123, 456], 'il garde sa place dans son monde');
  assert.ok(moi.persos[1].maj > 1000, 'sauvé par le serveur, daté de maintenant');
  // une copie plus ancienne envoyée ensuite par le jeu est refusée
  assert.equal((await fetch(`${base}/persos/1`, { method: 'PUT', headers: auth, body: JSON.stringify({ perso, maj: 2000 }) })).status, 409);
  b.ws.close(); c.ws.close();
  await fin();
});

test('parcours des nouveaux venus : compteurs anonymes, une fois par adresse et par étape', async () => {
  const { base, fin } = await serveur();
  const noter = e => fetch(`${base}/parcours?etape=${e}`, { method: 'POST' });
  assert.equal((await noter('accueil')).status, 200);
  await noter('accueil'); await noter('creation');
  assert.equal((await noter('nimporte')).status, 400);
  const r = await (await fetch(`${base}/parcours`)).json();
  assert.deepEqual(r.etapes, ['accueil', 'creation', 'perso', 'tuto']);
  const jour = Object.values(r.jours)[0];
  assert.deepEqual(jour, { accueil: 1, creation: 1 });
  await fin();
});
