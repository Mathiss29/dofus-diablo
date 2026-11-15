// Dernière PR de la MAJ « En ligne : » (2026-11-15) : sauvegardes du solo vérifiées (2C), monde vide gardé 2 min (8B),
// rejoindre un allié d'un clic (5B), boss du monde en commun (3D), « Jouer sur le serveur » seul (« HDV : » 4B).
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
import { creerClassement } from './classement.mjs';
import { chargerSim, Partie, PARTIE } from './partie.mjs';

/** Comptes avec un jeton et un perso en ligne (emplacement 0), dans Astrub. */
function base(noms = ['Lyra', 'Brak', 'Solo']) {
  const dossier = mkdtempSync(join(tmpdir(), 'df-maj-')), t = Date.now(), J = noms.map((_, i) => String.fromCharCode(97 + i).repeat(64));
  creerComptes({ dossier, env: {}, origines: new Set() }).fermer();
  const db = new DatabaseSync(join(dossier, 'diablofus.db'));
  noms.forEach((nom, i) => {
    db.prepare('INSERT INTO comptes (discord, nom, roles, cree, vu) VALUES (?, ?, ?, ?, ?)').run(String(100 + i), `${nom}Discord`, '[]', t, t);
    db.prepare('INSERT INTO jetons VALUES (?, ?, ?, ?)').run(createHash('sha256').update(J[i]).digest('hex'), i + 1, t, t + 864e5);
    db.prepare('INSERT INTO persos VALUES (?, 0, ?, 1)').run(i + 1, JSON.stringify({ nom, classe: 'iop', sexe: 'm', hardcore: false, cree: t, maj: 1, temps: 0, lieu: '', zones: [], etat: { level: 20, kamas: 0, zone: 'astrub' } }));
  });
  db.close();
  return { dossier, J };
}
async function lancer(dossier, nFils = 0) {
  const comptes = creerComptes({ dossier, env: {}, origines: new Set() });
  const s = creerServeur({ comptes, nFils });
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  const url = `ws://127.0.0.1:${s.address().port}/ws`;
  const client = async () => {
    const ws = new WebSocket(url, { origin: 'https://diablofus.com' }), file = [], attente = [];
    ws.on('message', d => { const m = JSON.parse(String(d)); const a = attente.shift(); if (a) a(m); else file.push(m); });
    await new Promise(ok => ws.on('open', ok));
    const lire = () => file.length ? Promise.resolve(file.shift()) : new Promise(ok => attente.push(ok));
    return { ws, envoi: m => ws.send(JSON.stringify(m)), attendre: async f => { for (;;) { const m = await lire(); if (f(m)) return m; } } };
  };
  return { s, comptes, client, fin: () => new Promise(r => { s.close(r); s.closeAllConnections(); }) };
}

test('2C : une sauvegarde trafiquée du solo est gardée, mais le perso sort du Ladder', async () => {
  const { dossier, J } = base(['Lyra', 'Brak']);
  const { s, comptes, fin } = await lancer(dossier);
  const http = `http://127.0.0.1:${s.address().port}`;
  const put = (j, perso, maj) => fetch(`${http}/persos/0`, { method: 'PUT', headers: { authorization: `Bearer ${j}`, 'content-type': 'application/json' }, body: JSON.stringify({ perso, maj }) }).then(r => r.json());
  const perso = (level, temps, kamas = 0) => ({ nom: 'X', classe: 'iop', sexe: 'm', hardcore: false, temps, lieu: '', zones: [], etat: { level, xp: 0, kamas, bag: [], equipment: {} } });
  // Lyra joue normalement : 10 niveaux en une heure
  assert.equal((await put(J[0], perso(30, 3600, 50_000), 10)).douteux, undefined);
  // Brak : du niveau 20 au niveau 200 en une minute
  const r = await put(J[1], perso(200, 60), 10);
  assert.equal(r.ok, true, 'la sauvegarde est gardée');
  assert.equal(r.douteux, 'niveau');
  assert.equal(comptes.douteux(2, 0).raison, 'niveau');
  const cl = creerClassement({ comptes, auto: false });
  assert.deepEqual(cl.calculer().listes.niveau, ['1-0'], 'Brak sort du Ladder');
  cl.fermer();
  await fin();
});

test('8B : le dernier joueur parti, le monde du groupe garde son état et repart quand quelqu’un revient', async () => {
  const S = await chargerSim();
  const p = new Partie(S, () => {}, 3, null, { monde: 'astrub' });
  p.arrivee(1);
  p.recu(1, { k: 'bonjour', classe: 'iop', etat: { level: 20 } });
  const w = p.w, t = w.time;
  p.depart(1);
  assert.equal(p.w, w, 'le monde reste');
  assert.ok(p.fantome);
  p.avancer(1);
  assert.equal(w.time, t, 'il ne tourne plus quand il est vide');
  p.arrivee(2);
  p.recu(2, { k: 'bonjour', classe: 'cra', etat: { level: 20 } });
  assert.equal(p.w, w, 'le même monde');
  assert.equal(w.players.length, 1);
  assert.equal(p.fantome, null);
  p.avancer(0.1);
  assert.ok(w.time > t);
  p.depart(2);
});

test('5B + 4B : rejoindre un allié d’un clic (même salon, à côté de lui) ; seul, « Jouer sur le serveur » donne un monde à soi', async () => {
  const { dossier, J } = base();
  const { client, fin } = await lancer(dossier);
  const pa = await client(), pb = await client();
  pa.envoi({ k: 'presence', jeton: J[0], emplacement: 0, zone: 'astrub' });
  pb.envoi({ k: 'presence', jeton: J[1], emplacement: 0, zone: 'astrub' });
  await pa.attendre(m => m.k === 'presence'); await pb.attendre(m => m.k === 'presence');
  pa.envoi({ k: 'enligne' });
  const brak = (await pa.attendre(m => m.k === 'enligne')).l.find(x => x.nom === 'Brak');
  pa.envoi({ k: 'inviter', id: brak.id });
  const inv = await pb.attendre(m => m.k === 'invitation');
  pb.envoi({ k: 'grpOui', groupe: inv.groupe });
  await pa.attendre(m => m.k === 'groupe' && m.membres?.length === 2);
  // Brak entre dans le monde du groupe
  const b = await client();
  b.envoi({ k: 'mondeGroupe', zone: 'astrub', jeton: J[1], emplacement: 0 });
  const sb = await b.attendre(m => m.k === 'salon');
  b.envoi({ k: 'envoi', d: { k: 'bonjour', jeton: J[1], emplacement: 0, nom: 'Brak' } });
  const zb = (await b.attendre(m => m.k === 'recu' && m.d.k === 'zone')).d;
  // Lyra le rejoint d'un clic : même salon, posée à côté de lui
  const a = await client();
  a.envoi({ k: 'mondeGroupe', allie: brak.id, jeton: J[0], emplacement: 0 });
  assert.equal((await a.attendre(m => m.k === 'salon')).code, sb.code);
  a.envoi({ k: 'envoi', d: { k: 'bonjour', jeton: J[0], emplacement: 0, nom: 'Lyra' } });
  const za = (await a.attendre(m => m.k === 'recu' && m.d.k === 'zone')).d;
  assert.ok(Math.hypot(za.x - zb.x, za.y - zb.y) < 300, 'à côté de son allié');
  // Solo n'est dans aucun groupe : il ne peut pas rejoindre Brak
  const c = await client();
  c.envoi({ k: 'mondeGroupe', allie: brak.id, jeton: J[2], emplacement: 0 });
  assert.equal((await c.attendre(m => m.k === 'refus')).raison, 'groupe');
  // seul, il demande à jouer sur le serveur : un monde rien qu'à lui
  const d = await client();
  d.envoi({ k: 'mondeGroupe', zone: 'astrub', seul: true, jeton: J[2], emplacement: 0 });
  assert.notEqual((await d.attendre(m => m.k === 'salon')).code, sb.code);
  for (const x of [pa, pb, a, b, c, d]) x.ws.close();
  await fin();
});

test('3D : près du boss du monde, le monde du groupe envoie vers le combat commun ; le combat fini, chacun rentre', async () => {
  const S = await chargerSim();
  const recus = [];
  const compte = { compte: 7, emplacement: 0, perso: { nom: 'Lyra', classe: 'iop', etat: { level: 40 } } };
  const p = new Partie(S, (num, d) => recus.push(d), 3, null, { monde: 'astrub', bossPartage: true });
  assert.equal(p.bossPartage, true);
  p.arrivee(1);
  p.recu(1, { k: 'bonjour', compte });
  const q = p.w.players[0];
  assert.equal(p.w.opts.bossPartage, true);
  p.w.emit({ k: 'versBossMonde', joueur: q.id, cle: 'x', creneau: 12 });
  p.avancer(1 / 60);
  const s = recus.find(d => d.k === 'sortie');
  assert.deepEqual(s?.boss, { cle: 'x', creneau: 12, position: { x: q.x, y: q.y } });
  p.depart(1);
  // dans le combat commun : pas de boss (ou boss fini) : retour dans le monde du groupe au bout de quelques secondes
  const r2 = [];
  const c = new Partie(S, (num, d) => r2.push(d), 4, null, { monde: 'astrub', combatBoss: true, max: 16 });
  assert.equal(c.max, 16);
  c.arrivee(1);
  c.recu(1, { k: 'bonjour', compte });
  c.w.vivant.boss = null;
  for (let i = 0; i < (PARTIE.bossRetour + 1) * 60 && !r2.some(d => d.k === 'sortie'); i++) { c.w.vivant.boss = null; c.avancer(1 / 60); }
  assert.ok(r2.find(d => d.k === 'sortie')?.groupe?.position, 'il rentre là où il est');
  c.depart(1);
});

test('7B : une partie dans un fil à part : monde du groupe, rejoindre un allié, gestes de l’HDV, sauvegarde', async () => {
  const { dossier, J } = base(['Lyra', 'Brak']);
  const { client, comptes, fin } = await lancer(dossier, 1);
  const pa = await client(), pb = await client();
  pa.envoi({ k: 'presence', jeton: J[0], emplacement: 0, zone: 'astrub' });
  pb.envoi({ k: 'presence', jeton: J[1], emplacement: 0, zone: 'astrub' });
  await pa.attendre(m => m.k === 'presence'); await pb.attendre(m => m.k === 'presence');
  pa.envoi({ k: 'enligne' });
  const brak = (await pa.attendre(m => m.k === 'enligne')).l.find(x => x.nom === 'Brak');
  pa.envoi({ k: 'inviter', id: brak.id });
  pb.envoi({ k: 'grpOui', groupe: (await pb.attendre(m => m.k === 'invitation')).groupe });
  await pa.attendre(m => m.k === 'groupe' && m.membres?.length === 2);
  const b = await client();
  b.envoi({ k: 'mondeGroupe', zone: 'astrub', jeton: J[1], emplacement: 0 });
  const sb = await b.attendre(m => m.k === 'salon');
  b.envoi({ k: 'envoi', d: { k: 'bonjour', jeton: J[1], emplacement: 0, nom: 'Brak' } });
  assert.equal((await b.attendre(m => m.k === 'recu' && m.d.k === 'zone')).d.zone, 'astrub');
  b.envoi({ k: 'envoi', d: { k: 'pret' } });
  await b.attendre(m => m.k === 'recu' && m.d.k === 'instantane');
  // l'HDV parle à la partie dans son fil
  const P = comptes.hdv.partieDe(brak.id, 0);
  assert.ok(P, 'le perso de Brak joue dans une partie');
  assert.equal(await P.appliquer({ op: 'colis', objet: null, kamas: 5 }), true);
  // Lyra le rejoint d'un clic : la position vient du fil
  await new Promise(r => setTimeout(r, 1200));
  const a = await client();
  a.envoi({ k: 'mondeGroupe', allie: brak.id, jeton: J[0], emplacement: 0 });
  assert.equal((await a.attendre(m => m.k === 'salon')).code, sb.code);
  // Brak part : son perso est sauvé par le fil (kamas reçus compris)
  b.envoi({ k: 'quitter' });
  await new Promise(r => setTimeout(r, 300));
  const db = comptes.db.prepare('SELECT donnees FROM persos WHERE compte = ?').get(brak.id);
  const etat = JSON.parse(db.donnees).etat;
  assert.ok(etat.kamas >= 5, `sauvé avec les kamas de l’HDV : ${JSON.stringify(etat).slice(0, 200)}`);
  for (const x of [pa, pb, a, b]) x.ws.close();
  await fin();
});
