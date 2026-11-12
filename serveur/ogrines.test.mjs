import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { creerServeur } from './index.mjs';
import { creerComptes } from './comptes.mjs';

const ORIGINES = new Set(['https://diablofus.com']);
/** Faux Discord : le joueur 123, avec le rôle 42 (admin si ROLES_ADMIN = 42). */
const faux = async (url, o) => {
  const r = (code, corps) => ({ ok: code < 300, status: code, json: async () => corps });
  if (url.endsWith('/oauth2/token')) return r(200, { access_token: 'acces' });
  if (url.endsWith('/users/@me')) return r(200, { id: '123', username: 'mathis', global_name: 'Mathis', avatar: null });
  if (url.includes('/member')) return r(200, { roles: ['42'] });
  return r(404, {});
};
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const CLE = publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('hex');
async function serveur(admin = true) {
  const dossier = mkdtempSync(join(tmpdir(), 'diablofus-og-'));
  const env = { DISCORD_ID: 'id', DISCORD_SECRET: 'secret', DISCORD_SERVEUR: '9', ...(admin ? { ROLES_ADMIN: '42' } : {}), DISCORD_CLE_PUBLIQUE: CLE };
  const comptes = creerComptes({ dossier, env, origines: ORIGINES, fetch: faux });
  const s = creerServeur({ comptes });
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${s.address().port}`;
  const a = await fetch(`${base}/connexion?retour=${encodeURIComponent('https://diablofus.com/')}`, { redirect: 'manual' });
  const etat = new URL(a.headers.get('location')).searchParams.get('state');
  const b = await fetch(`${base}/connexion/retour?code=bon&state=${etat}`, { redirect: 'manual' });
  const jeton = /#connexion=([0-9a-f]{64})$/.exec(b.headers.get('location'))[1];
  return { base, comptes, auth: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' }, fin: () => new Promise(r => { s.close(r); s.closeAllConnections(); }) };
}

test('codes cadeaux : un admin crée, chaque compte l\'utilise une fois, Ogrines sur le compte', async () => {
  const { base, auth, fin } = await serveur();
  const cree = await (await fetch(`${base}/codes`, { method: 'POST', headers: auth, body: JSON.stringify({ ogrines: 500, objets: ['1090'], max: 1, jours: 7 }) })).json();
  assert.match(cree.code, /^DIABLO-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  const moi0 = await (await fetch(`${base}/moi`, { headers: auth })).json();
  assert.equal(moi0.ogrines, 0);
  const u = await fetch(`${base}/codes/utiliser`, { method: 'POST', headers: auth, body: JSON.stringify({ code: cree.code.toLowerCase() }) });
  assert.equal(u.status, 200);
  assert.deepEqual(await u.json(), { ogrines: 500, objets: ['1090'], solde: 500 });
  const deux = await (await fetch(`${base}/codes/utiliser`, { method: 'POST', headers: auth, body: JSON.stringify({ code: cree.code }) })).json();
  assert.equal(deux.erreur, 'deja');
  assert.equal((await (await fetch(`${base}/codes/utiliser`, { method: 'POST', headers: auth, body: JSON.stringify({ code: 'FAUX' }) })).json()).erreur, 'inconnu');
  assert.equal((await (await fetch(`${base}/ogrines`, { headers: auth })).json()).solde, 500);
  await fin();
});

test('seuls les admins créent des codes ; essais limités', async () => {
  const { base, auth, fin } = await serveur(false);
  assert.equal((await fetch(`${base}/codes`, { method: 'POST', headers: auth, body: JSON.stringify({ ogrines: 500 }) })).status, 403);
  let dernier;
  for (let i = 0; i < 21; i++) dernier = await fetch(`${base}/codes/utiliser`, { method: 'POST', headers: auth, body: JSON.stringify({ code: `X${i}` }) });
  assert.equal(dernier.status, 429);
  assert.equal((await fetch(`${base}/codes/utiliser`, { method: 'POST', body: '{}' })).status, 401);
  await fin();
});

test('robot Discord : signature vérifiée, /code et /ogrines réservés aux admins', async () => {
  const { base, auth, comptes, fin } = await serveur();
  const envoyer = (corps, signe = true) => {
    const t = String(Math.floor(Date.now() / 1000)), brut = JSON.stringify(corps);
    const sig = signe ? sign(null, Buffer.from(t + brut), privateKey).toString('hex') : '00'.repeat(64);
    return fetch(`${base}/discord/interactions`, { method: 'POST', headers: { 'x-signature-ed25519': sig, 'x-signature-timestamp': t, 'content-type': 'application/json' }, body: brut });
  };
  assert.equal((await envoyer({ type: 1 }, false)).status, 401);
  assert.deepEqual(await (await envoyer({ type: 1 })).json(), { type: 1 });
  const membre = roles => ({ roles, user: { username: 'mathis' } });
  const refus = await (await envoyer({ type: 2, member: membre(['7']), data: { name: 'code', options: [{ name: 'ogrines', value: 300 }] } })).json();
  assert.match(refus.data.content, /Réservé/);
  const r = await (await envoyer({ type: 2, member: membre(['42']), data: { name: 'code', options: [{ name: 'ogrines', value: 300 }, { name: 'utilisations', value: 50 }, { name: 'nom', value: 'live-nowel' }] } })).json();
  assert.equal(r.data.flags, 64);
  assert.match(r.data.content, /LIVE-NOWEL/);
  assert.equal((await (await fetch(`${base}/codes/utiliser`, { method: 'POST', headers: auth, body: JSON.stringify({ code: 'live-nowel' }) })).json()).solde, 300);
  const g = await (await envoyer({ type: 2, member: membre(['42']), data: { name: 'ogrines', options: [{ name: 'joueur', value: '123' }, { name: 'nombre', value: 200 }, { name: 'raison', value: 'concours' }] } })).json();
  assert.match(g.data.content, /solde 500/);
  assert.equal(comptes.ogrines.bouger(1, -600, 'test'), false);   // pas assez
  await fin();
});
