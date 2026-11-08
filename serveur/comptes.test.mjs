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
