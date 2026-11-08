import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import WebSocket from 'ws';
import { creerServeur } from './index.mjs';
import { creerComptes } from './comptes.mjs';

/** Deux comptes avec un jeton et un perso en ligne chacun (emplacement 0). */
function base() {
  const dossier = mkdtempSync(join(tmpdir(), 'df-presence-'));
  creerComptes({ dossier, env: {}, origines: new Set() }).fermer();
  const db = new DatabaseSync(join(dossier, 'diablofus.db')), t = Date.now(), J = ['a'.repeat(64), 'b'.repeat(64)];
  [['Lyra', 'cra', 'f', 12], ['Brak', 'iop', 'm', 30]].forEach(([nom, classe, sexe, level], i) => {
    db.prepare('INSERT INTO comptes (discord, nom, roles, cree, vu) VALUES (?, ?, ?, ?, ?)').run(String(100 + i), `${nom}Discord`, '[]', t, t);
    db.prepare('INSERT INTO jetons VALUES (?, ?, ?, ?)').run(createHash('sha256').update(J[i]).digest('hex'), i + 1, t, t + 864e5);
    db.prepare('INSERT INTO persos VALUES (?, 0, ?, 1)').run(i + 1, JSON.stringify({ nom, classe, sexe, hardcore: false, cree: t, maj: 1, temps: 0, lieu: '', zones: [], etat: { level } }));
  });
  db.close();
  return { dossier, J };
}

test('présence : qui est en ligne, passants du Bastion, invitation', async () => {
  const { dossier, J } = base();
  const s = creerServeur({ comptes: creerComptes({ dossier, env: {}, origines: new Set() }) });
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  const url = `ws://127.0.0.1:${s.address().port}/ws`;
  const client = async () => {
    const ws = new WebSocket(url), file = [], attente = [];
    ws.on('message', d => { const m = JSON.parse(String(d)); const a = attente.shift(); if (a) a(m); else file.push(m); });
    await new Promise(ok => ws.on('open', ok));
    const lire = () => file.length ? Promise.resolve(file.shift()) : new Promise(ok => attente.push(ok));
    return { ws, envoi: m => ws.send(JSON.stringify(m)), attendre: async f => { for (;;) { const m = await lire(); if (f(m)) return m; } } };
  };
  const a = await client(), b = await client();
  // jeton faux : refusé
  a.envoi({ k: 'presence', jeton: 'c'.repeat(64), emplacement: 0, zone: 'bastion' });
  assert.equal((await a.attendre(m => m.k === 'presence')).ok, false);
  a.envoi({ k: 'presence', jeton: J[0], emplacement: 0, zone: 'bastion', x: 100, y: 100, objets: ['8243'] });
  assert.equal((await a.attendre(m => m.k === 'presence')).ok, true);
  b.envoi({ k: 'presence', jeton: J[1], emplacement: 0, zone: 'bastion', x: 150, y: 120 });
  await b.attendre(m => m.k === 'presence');
  // chacun voit l'autre passer, avec son profil lu sur le compte (le pseudo du perso, pas celui de Discord)
  const vu = await a.attendre(m => m.k === 'autres' && m.l.length === 1 && m.profils);
  assert.equal(vu.profils[0].nom, 'Brak');
  assert.equal(vu.profils[0].niveau, 30);
  assert.ok(!JSON.stringify(vu).includes('Discord'));
  b.envoi({ k: 'pos', zone: 'bastion', x: 400, y: 300, f: 1, a: 'walk' });
  const p = await a.attendre(m => m.k === 'autres' && m.l[0]?.[1] === 400);
  assert.deepEqual(p.l[0].slice(1), [400, 300, 1, 'walk']);
  // ailleurs qu'au Bastion : on ne le voit plus passer, mais il reste dans l'onglet Discord
  b.envoi({ k: 'pos', zone: 'astrub', x: 0, y: 0 });
  await a.attendre(m => m.k === 'autres' && m.l.length === 0);
  a.envoi({ k: 'enligne' });
  const l = (await a.attendre(m => m.k === 'enligne')).l;
  assert.deepEqual(l.map(x => [x.nom, x.zone, x.groupe]), [['Brak', 'astrub', false]]);
  // invitation : il faut un groupe
  a.envoi({ k: 'inviter', id: l[0].id });
  assert.match((await a.attendre(m => m.k === 'info')).texte, /groupe/);
  a.envoi({ k: 'groupe', code: 'ABCDE' });
  a.envoi({ k: 'inviter', id: l[0].id });
  const inv = await b.attendre(m => m.k === 'invitation');
  assert.deepEqual([inv.de, inv.code], ['Lyra', 'ABCDE']);
  assert.equal((await (await fetch(`http://127.0.0.1:${s.address().port}/sante`)).json()).enLigne, 2);
  a.ws.close(); b.ws.close();
  await new Promise(r => setTimeout(r, 100));
  await new Promise(r => { s.close(r); s.closeAllConnections(); });
});
