// « En ligne : » 1A + 5A (2026-11-15) : chaque groupe a son monde ouvert sur le serveur, une partie par zone (Incarnam, le continent).
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
import { chargerSim, Partie } from './partie.mjs';

/** Trois comptes avec un jeton et un perso en ligne chacun (emplacement 0) ; Brak est dans Astrub. */
function base() {
  const dossier = mkdtempSync(join(tmpdir(), 'df-enligne-'));
  creerComptes({ dossier, env: {}, origines: new Set() }).fermer();
  const db = new DatabaseSync(join(dossier, 'diablofus.db')), t = Date.now(), J = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)];
  [['Lyra', 'cra', 12, null], ['Brak', 'iop', 30, 'astrub'], ['Solo', 'sadida', 5, null]].forEach(([nom, classe, level, zone], i) => {
    db.prepare('INSERT INTO comptes (discord, nom, roles, cree, vu) VALUES (?, ?, ?, ?, ?)').run(String(100 + i), `${nom}Discord`, '[]', t, t);
    db.prepare('INSERT INTO jetons VALUES (?, ?, ?, ?)').run(createHash('sha256').update(J[i]).digest('hex'), i + 1, t, t + 864e5);
    db.prepare('INSERT INTO persos VALUES (?, 0, ?, 1)').run(i + 1, JSON.stringify({ nom, classe, sexe: 'm', hardcore: false, cree: t, maj: 1, temps: 0, lieu: '', zones: [], etat: { level, ...(zone ? { zone } : {}) } }));
  });
  db.close();
  return { dossier, J };
}

test('monde du groupe : les membres d’un groupe entrent dans le même monde du continent, un joueur seul est refusé', async () => {
  const { dossier, J } = base();
  const s = creerServeur({ comptes: creerComptes({ dossier, env: {}, origines: new Set() }) });
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  const url = `ws://127.0.0.1:${s.address().port}/ws`;
  const client = async () => {
    const ws = new WebSocket(url, { origin: 'https://diablofus.com' }), file = [], attente = [];
    ws.on('message', d => { const m = JSON.parse(String(d)); const a = attente.shift(); if (a) a(m); else file.push(m); });
    await new Promise(ok => ws.on('open', ok));
    const lire = () => file.length ? Promise.resolve(file.shift()) : new Promise(ok => attente.push(ok));
    return { ws, envoi: m => ws.send(JSON.stringify(m)), attendre: async f => { for (;;) { const m = await lire(); if (f(m)) return m; } } };
  };
  // présence : Lyra invite Brak
  const pa = await client(), pb = await client(), pc = await client();
  pa.envoi({ k: 'presence', jeton: J[0], emplacement: 0, zone: 'bastion' });
  pb.envoi({ k: 'presence', jeton: J[1], emplacement: 0, zone: 'astrub' });
  pc.envoi({ k: 'presence', jeton: J[2], emplacement: 0, zone: 'astrub' });
  await pa.attendre(m => m.k === 'presence'); await pb.attendre(m => m.k === 'presence'); await pc.attendre(m => m.k === 'presence');
  pa.envoi({ k: 'enligne' });
  const brak = (await pa.attendre(m => m.k === 'enligne')).l.find(x => x.nom === 'Brak');
  pa.envoi({ k: 'inviter', id: brak.id });
  const inv = await pb.attendre(m => m.k === 'invitation');
  pb.envoi({ k: 'grpOui', groupe: inv.groupe });
  await pa.attendre(m => m.k === 'groupe' && m.membres?.length === 2);
  // le joueur seul : il joue sur son PC (2A)
  const c = await client();
  c.envoi({ k: 'mondeGroupe', zone: 'astrub', jeton: J[2], emplacement: 0 });
  assert.equal((await c.attendre(m => m.k === 'refus')).raison, 'groupe');
  // Brak (déjà dans Astrub) entre le premier : le monde du groupe est créé, il y reprend sa place
  const b = await client();
  b.envoi({ k: 'mondeGroupe', zone: 'astrub', jeton: J[1], emplacement: 0 });
  const sb = await b.attendre(m => m.k === 'salon');
  assert.equal(sb.serveur, true);
  b.envoi({ k: 'envoi', d: { k: 'bonjour', jeton: J[1], emplacement: 0, nom: 'Brak' } });
  const zb = await b.attendre(m => m.k === 'recu' && m.d.k === 'zone');
  assert.equal(zb.d.zone, 'astrub');
  // Lyra le rejoint : même salon, même monde, arrivée par la porte donnée
  const a = await client();
  a.envoi({ k: 'mondeGroupe', zone: 'astrub', jeton: J[0], emplacement: 0 });
  const sa = await a.attendre(m => m.k === 'salon');
  assert.equal(sa.code, sb.code, 'le même monde pour tout le groupe');
  a.envoi({ k: 'envoi', d: { k: 'bonjour', jeton: J[0], emplacement: 0, nom: 'Lyra' } });
  assert.equal((await a.attendre(m => m.k === 'recu' && m.d.k === 'zone')).d.zone, 'astrub');
  const sante = async () => (await fetch(`http://127.0.0.1:${s.address().port}/sante`)).json();
  assert.equal((await sante()).parties, 1);
  // Incarnam : un autre monde du même groupe
  a.envoi({ k: 'quitter' });
  await new Promise(r => setTimeout(r, 50));
  a.envoi({ k: 'mondeGroupe', zone: 'incarnam', jeton: J[0], emplacement: 0 });
  const si = await a.attendre(m => m.k === 'salon');
  assert.notEqual(si.code, sb.code);
  assert.equal((await sante()).parties, 2);
  for (const x of [pa, pb, pc, a, b, c]) x.ws.close();
  await new Promise(r => setTimeout(r, 200));
  assert.equal((await sante()).parties, 0, 'un monde vide se ferme (après avoir sauvé les persos)');
  await new Promise(r => { s.close(r); s.closeAllConnections(); });
});

test('continent sur le serveur : on garde sa place dans Astrub, on arrive par une porte, et la porte d’Incarnam envoie vers l’autre monde', async () => {
  const S = await chargerSim();
  const recus = new Map([[1, []], [2, []]]);
  const p = new Partie(S, (num, d) => recus.get(num).push(d), 5, null, { monde: 'astrub' });
  assert.equal(p.zoneMonde, 'astrub');
  p.arrivee(1); p.arrivee(2);
  p.recu(1, { k: 'bonjour', classe: 'iop', etat: { level: 20 } });
  const w = p.w;
  assert.equal(w.opts.zone, 'astrub');
  assert.equal(w.arene, null);
  const po = w.portes.find(x => x.vers?.zone === 'incarnam');
  assert.ok(po, 'le portail vers Incarnam');
  // le second arrive « par une porte » : de l'autre côté de la porte d'Incarnam (sa case d'arrivée)
  p.recu(2, { k: 'bonjour', classe: 'cra', etat: { level: 20, zone: 'incarnam', x: 1, y: 1 }, arrivee: [po.ends[0].tag, 300] });
  const q2 = w.players[1];
  assert.equal(w.players.length, 2);
  assert.equal(w.worldGrid.mapAt(q2.x, q2.y)?.tag, po.ends[0].tag, 'posé sur la carte de la porte, pas à sa place d’Incarnam');
  // il prend le portail : il part vers le monde d'Incarnam du groupe (le jeu bascule), le premier reste
  const pres = w.map.nearestFree(po.ends[0].x + 40, po.ends[0].y); q2.x = pres.x; q2.y = pres.y;
  p.recu(1, { k: 'pret' }); p.recu(2, { k: 'pret' });
  p.recu(2, { k: 'entree', i: { aim: po.ends[0], dest: { x: po.ends[0].x, y: po.ends[0].y }, versPortail: po.nom } });
  for (let i = 0; i < 240 && !recus.get(2).some(d => d.k === 'sortie'); i++) p.avancer(1 / 60);
  const s = recus.get(2).find(d => d.k === 'sortie');
  assert.equal(s?.vers?.zone, 'incarnam');
  assert.ok(!recus.get(1).some(d => d.k === 'sortie'));
  p.depart(1); p.depart(2);
});

test('fenêtres de l’invité : ses gestes (ordres) sont rejoués pour lui sur le serveur, les autres refusés', async () => {
  const S = await chargerSim();
  const p = new Partie(S, () => {}, 9, null, { monde: 'astrub' });
  p.arrivee(1); p.arrivee(2);
  p.recu(1, { k: 'bonjour', classe: 'iop', etat: { level: 20 } });
  p.recu(2, { k: 'bonjour', classe: 'cra', etat: { level: 20 } });
  const [a, b] = p.w.players;
  const k = 'vitalite';
  const pts = b.points, va = a.base[k] ?? 0, vb = b.base[k] ?? 0;
  assert.ok(pts > 0, 'des points à placer');
  p.recu(2, { k: 'ordre', c: 'p', f: 'spendPoint', a: [k, 1] });
  assert.equal(b.base[k], vb + 1, 'le point est placé chez le joueur 2');
  assert.ok(b.points < pts);
  assert.equal(a.base[k] ?? 0, va, 'pas chez le joueur 1');
  // geste hors liste (achats d'Ogrines, outils) : ignoré
  const kamas = b.kamas;
  p.recu(2, { k: 'ordre', c: 'w', f: 'recevoirAchats', a: [['x']] });
  p.recu(2, { k: 'ordre', c: 'w', f: 'donnerObjet', a: ['8243', 99] });
  assert.equal(b.kamas, kamas);
  assert.ok(!b.bag.some(it => it.id === '8243'));
  p.depart(1); p.depart(2);
});

test('donjon depuis le monde du groupe : la porte envoie le joueur vers l’arène du groupe, le monde continue sans lui', async () => {
  const S = await chargerSim();
  const recus = new Map([[1, []], [2, []]]);
  const p = new Partie(S, (num, d) => recus.get(num).push(d), 4, null, { monde: 'astrub' });
  p.arrivee(1); p.arrivee(2);
  p.recu(1, { k: 'bonjour', classe: 'iop', etat: { level: 30 } });
  p.recu(2, { k: 'bonjour', classe: 'cra', etat: { level: 30 } });
  const w = p.w, [, b] = w.players;
  const d = w.zone.open.donjons.find(x => x.arene?.tag === 'arene_grange');
  w.commeJoueur(b, () => w['traverser']({ tag: d.arene.tag, ...w.worldGrid.cellToWorld(d.arene.arrivee) }, d.nom));
  p.recu(2, { k: 'pret' });
  p.avancer(1 / 60);
  const s = recus.get(2).find(x => x.k === 'sortie');
  assert.deepEqual(s?.donjon, { tag: 'arene_grange', nom: d.nom });
  assert.equal(w.arene, null, 'pas d’arène dans le monde du groupe');
  assert.ok(!recus.get(1).some(x => x.k === 'sortie'));
  p.depart(1); p.depart(2);
});
