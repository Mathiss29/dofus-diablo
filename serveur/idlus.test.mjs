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
/** Faux serveur d'Idlus : un code par palier, et un palier qui monte. */
const PALIERS = { 'IDLUS-AAAA-BBBB-CCCC': { palier: 1, adieu: false }, 'IDLUS-1111-2222-3333': { palier: 3, adieu: true } };
const fauxIdlus = async (url, o) => {
  const r = (code, corps) => ({ ok: code < 300, status: code, json: async () => corps, text: async () => corps });
  if (url.endsWith('/cle-publique')) return r(200, 'cle-anon\n');
  if (url.endsWith('/rest/v1/rpc/veteran_lookup')) { assert.equal(o.headers.apikey, 'cle-anon'); return r(200, PALIERS[JSON.parse(o.body).p_code] ?? null); }
  return r(404, {});
};
async function serveur(admin = true) {
  const dossier = mkdtempSync(join(tmpdir(), 'diablofus-idlus-'));
  const env = { DISCORD_ID: 'id', DISCORD_SECRET: 'secret', DISCORD_SERVEUR: '9', ...(admin ? { ROLES_ADMIN: '42' } : {}), DISCORD_CLE_PUBLIQUE: CLE };
  const comptes = creerComptes({ dossier, env, origines: ORIGINES, fetch: faux, idlusFetch: fauxIdlus });
  const s = creerServeur({ comptes });
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${s.address().port}`;
  const a = await fetch(`${base}/connexion?retour=${encodeURIComponent('https://diablofus.com/')}`, { redirect: 'manual' });
  const etat = new URL(a.headers.get('location')).searchParams.get('state');
  const b = await fetch(`${base}/connexion/retour?code=bon&state=${etat}`, { redirect: 'manual' });
  const jeton = /#connexion=([0-9a-f]{64})$/.exec(b.headers.get('location'))[1];
  return { base, comptes, auth: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' }, fin: () => new Promise(r => { s.close(r); s.closeAllConnections(); }) };
}

const code = (base, auth, c) => fetch(`${base}/codes/utiliser`, { method: 'POST', headers: auth, body: JSON.stringify({ code: c }) }).then(async r => ({ s: r.status, d: await r.json() }));

test('code de Vétéran d\'Idlus : Ogrines du palier, une seule fois, la suite quand le palier monte', async () => {
  const { base, auth, fin } = await serveur(false);
  try {
    const a = await code(base, auth, 'idlus-aaaa-bbbb-cccc');
    assert.equal(a.s, 200); assert.equal(a.d.ogrines, 300); assert.deepEqual(a.d.idlus, { palier: 1, adieu: false });
    const moi = await (await fetch(`${base}/moi`, { headers: auth })).json();
    assert.equal(moi.ogrines, 300); assert.deepEqual(moi.idlus, { palier: 1, adieu: false });
    const b = await code(base, auth, 'IDLUS-AAAA-BBBB-CCCC');
    assert.equal(b.s, 400); assert.equal(b.d.erreur, 'idlusRien', 'rien de nouveau : pas d\'Ogrines en double');
    PALIERS['IDLUS-AAAA-BBBB-CCCC'] = { palier: 3, adieu: true };
    const c = await code(base, auth, 'IDLUS-AAAA-BBBB-CCCC');
    assert.equal(c.d.ogrines, 2200, 'Argent + Or'); assert.equal(c.d.solde, 2500); assert.deepEqual(c.d.idlus, { palier: 3, adieu: true });
    const autre = await code(base, auth, 'IDLUS-1111-2222-3333');
    assert.equal(autre.d.erreur, 'idlusAutre', 'un compte ne prend qu\'un code');
    const inconnu = await code(base, auth, 'IDLUS-9999-9999-9999');
    assert.equal(inconnu.d.erreur, 'idlusAutre');
  } finally { await fin(); }
});

test('code de Vétéran : un code inconnu est refusé', async () => {
  const { base, auth, fin } = await serveur(false);
  try {
    const x = await code(base, auth, 'IDLUS-9999-9999-9999');
    assert.equal(x.s, 400); assert.equal(x.d.erreur, 'inconnu');
  } finally { await fin(); }
});
