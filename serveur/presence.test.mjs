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
  // groupe (7A) : inviter crée le groupe sans bouger personne ; l'invité accepte
  b.envoi({ k: 'dire', canal: 'groupe', texte: 'x' });
  assert.match((await b.attendre(m => m.k === 'info')).texte, /pas dans un groupe/);
  a.envoi({ k: 'inviter', id: l[0].id });
  const inv = await b.attendre(m => m.k === 'invitation');
  assert.equal(inv.de, 'Lyra');
  b.envoi({ k: 'grpOui', groupe: inv.groupe });
  const g = await a.attendre(m => m.k === 'groupe' && m.membres?.length === 2);
  assert.deepEqual([g.chef, g.membres.map(x => [x.nom, x.zone])], [1, [['Lyra', 'bastion'], ['Brak', 'astrub']]]);
  // le chef lance un donjon : l'autre reçoit le code
  b.envoi({ k: 'grpDonjon', code: 'ZZZZZ' });
  assert.match((await b.attendre(m => m.k === 'info')).texte, /chef/);
  a.envoi({ k: 'grpDonjon', code: 'QWERT', lieu: 'Crypte' });
  assert.deepEqual((({ de, code }) => [de, code])(await b.attendre(m => m.k === 'donjon')), ['Lyra', 'QWERT']);
  // chat : Tout, Privé (par le nom du perso), Groupe (même code), Bastion (seulement là-bas), messages nettoyés
  a.envoi({ k: 'dire', canal: 'tout', texte: '  salut\n  tout le monde ' });
  assert.deepEqual((({ canal, de, texte }) => [canal, de, texte])(await b.attendre(m => m.k === 'chat')), ['tout', 'Lyra', 'salut tout le monde']);
  b.envoi({ k: 'dire', canal: 'prive', a: 'lyra', texte: 'coucou' });
  assert.equal((await a.attendre(m => m.k === 'chat' && m.canal === 'prive')).texte, 'coucou');
  assert.equal((await b.attendre(m => m.k === 'chat')).vers, 'Lyra');
  b.envoi({ k: 'dire', canal: 'groupe', texte: 'on y va' });
  assert.equal((await a.attendre(m => m.k === 'chat' && m.canal === 'groupe')).texte, 'on y va');
  b.envoi({ k: 'dire', canal: 'bastion', texte: 'x' });
  assert.match((await b.attendre(m => m.k === 'info')).texte, /Bastion/);
  for (let i = 0; i < 6; i++) a.envoi({ k: 'dire', canal: 'tout', texte: 'spam' + i });
  assert.match((await a.attendre(m => m.k === 'info')).texte, /Doucement/);
  // amis (2A 2B) : demande par le nom du perso, l'autre accepte ; la liste montre le perso joué
  await new Promise(r => setTimeout(r, 5100));   // fin de la rafale de messages
  a.envoi({ k: 'ami+', nom: 'brak' });
  assert.match((await b.attendre(m => m.k === 'info')).texte, /Lyra veut être ton ami/);
  const rb = await b.attendre(m => m.k === 'amis');
  assert.deepEqual(rb.recues.map(x => x.nom), ['Lyra']);
  b.envoi({ k: 'ami+', id: rb.recues[0].id });
  assert.match((await a.attendre(m => m.k === 'info' && /amis/.test(m.texte))).texte, /Brak et toi êtes amis/);
  const la = await a.attendre(m => m.k === 'amis' && m.amis.length === 1);
  assert.deepEqual([la.amis[0].discord, la.amis[0].perso.nom, la.amis[0].perso.zone], ['BrakDiscord', 'Brak', 'astrub']);
  // réglage « refuser les invitations des inconnus » : un ami passe quand même
  b.envoi({ k: 'reglagesSociaux', horsLigne: false, inconnus: true });
  assert.equal((await b.attendre(m => m.k === 'amis' && m.inconnus)).inconnus, true);
  // Brak quitte le groupe (seul, Lyra le voit dissous), puis Lyra, son amie, peut l'inviter de nouveau
  b.envoi({ k: 'grpQuitter' });
  assert.match((await a.attendre(m => m.k === 'info' && /dissous/.test(m.texte))).texte, /dissous/);
  await new Promise(r => setTimeout(r, 3100));
  a.envoi({ k: 'inviter', id: l[0].id });
  assert.equal((await b.attendre(m => m.k === 'invitation')).de, 'Lyra');
  // ignorer (2D) : plus amis, ses messages n'arrivent plus
  b.envoi({ k: 'ignorer', id: 1 });   // Lyra
  assert.deepEqual((await b.attendre(m => m.k === 'amis' && m.ignores.length)).ignores.map(x => x.nom), ['Lyra']);
  assert.equal((await a.attendre(m => m.k === 'amis' && m.amis.length === 0)).amis.length, 0);
  a.envoi({ k: 'dire', canal: 'prive', a: 'Brak', texte: 'tu me lis ?' });
  b.envoi({ k: 'dire', canal: 'tout', texte: 'témoin' });
  assert.equal((await b.attendre(m => m.k === 'chat')).texte, 'témoin');
  assert.equal((await (await fetch(`http://127.0.0.1:${s.address().port}/sante`)).json()).enLigne, 2);
  a.ws.close(); b.ws.close();
  await new Promise(r => setTimeout(r, 100));
  await new Promise(r => { s.close(r); s.closeAllConnections(); });
});
