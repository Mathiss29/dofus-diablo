import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { creerServeur } from './index.mjs';
import { creerComptes } from './comptes.mjs';
import { arenesDisponibles, chargerSim, Partie } from './partie.mjs';

test('partie sur le serveur : deux joueurs, la vague démarre, chacun reçoit son miroir', async () => {
  const S = await chargerSim();
  assert.ok(S, 'node construire-sim.mjs');
  const recus = new Map([[1, []], [2, []]]);
  const p = new Partie(S, (num, d) => recus.get(num).push(d), 7);
  p.arrivee(1); p.arrivee(2);
  p.recu(1, { k: 'bonjour', classe: 'iop', etat: null });
  p.recu(2, { k: 'bonjour', classe: 'cra', etat: { level: 20 } });
  assert.deepEqual(recus.get(1)[0].k, 'zone');
  assert.equal(p.w.players.length, 2);
  assert.ok(p.w.arene, 'dans l’arène');
  p.recu(1, { k: 'pret' }); p.recu(2, { k: 'pret' });
  const q2 = p.w.players[1], x0 = q2.x;
  p.recu(2, { k: 'entree', i: { move: { x: 1, y: 0 }, test: [{ k: 'tuer' }] } });
  for (let i = 0; i < 60 * 8; i++) p.avancer(1 / 60);
  assert.ok(q2.x > x0 + 20, 'l’entrée du joueur 2 le fait bouger');
  assert.ok(p.w.arene.vague > 0, 'les vagues commencent');
  const inst = recus.get(2).filter(d => d.k === 'instantane');
  assert.ok(inst.length > 100 && inst[0].plein, 'instantanés 30 fois par seconde, le premier complet');
  // le premier joueur part : le second continue seul
  p.depart(1);
  assert.equal(p.w.players.length, 1);
  assert.equal(p.w.players[0], q2);
  for (let i = 0; i < 60; i++) p.avancer(1 / 60);
  p.depart(2);
  assert.equal(p.w, null);
});

test('salon « serveur » par le WebSocket : créer, rejoindre, instantanés, fermeture quand tout le monde part', async () => {
  const comptes = creerComptes({ dossier: mkdtempSync(join(tmpdir(), 'df-')), env: {}, origines: new Set() });
  const s = creerServeur({ comptes });
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  const url = `ws://127.0.0.1:${s.address().port}/ws`;
  const client = async () => {
    const ws = new WebSocket(url, { origin: 'https://diablofus.com' }), file = [], attente = [];
    ws.on('message', d => { const m = JSON.parse(String(d)); const a = attente.shift(); if (a) a(m); else file.push(m); });
    await new Promise(ok => ws.on('open', ok));
    const lire = () => file.length ? Promise.resolve(file.shift()) : new Promise(ok => attente.push(ok));
    return { ws, envoi: m => ws.send(JSON.stringify(m)), lire, attendre: async f => { for (;;) { const m = await lire(); if (f(m)) return m; } } };
  };
  const a = await client(), b = await client();
  a.envoi({ k: 'creer', serveur: true });
  const sa = await a.lire();
  assert.deepEqual([sa.k, sa.hote, sa.serveur], ['salon', false, true]);
  a.envoi({ k: 'envoi', d: { k: 'bonjour', classe: 'sacrieur', etat: null } });
  const z = await a.attendre(m => m.k === 'recu' && m.d.k === 'zone');
  assert.equal(z.d.zone, 'incarnam');
  b.envoi({ k: 'rejoindre', code: sa.code });
  assert.equal((await b.lire()).serveur, true);
  b.envoi({ k: 'envoi', d: { k: 'bonjour', classe: 'osamodas', etat: null } });
  await b.attendre(m => m.k === 'recu' && m.d.k === 'zone');
  b.envoi({ k: 'envoi', d: { k: 'pret' } });
  const i = await b.attendre(m => m.k === 'recu' && m.d.k === 'instantane');
  assert.equal(i.d.plein, true);
  assert.equal((await (await fetch(`http://127.0.0.1:${s.address().port}/sante`)).json()).parties, 1);
  a.ws.close(); b.ws.close();
  await new Promise(r => setTimeout(r, 200));
  assert.equal((await (await fetch(`http://127.0.0.1:${s.address().port}/sante`)).json()).parties, 0);
  await new Promise(r => { s.close(r); s.closeAllConnections(); });
});

test('monde ouvert d’Incarnam sur le serveur : chacun sa place, ses quêtes, et une porte vers Astrub le fait partir seul', async () => {
  const S = await chargerSim();
  const recus = new Map([[1, []], [2, []]]);
  const p = new Partie(S, (num, d) => recus.get(num).push(d), 7, null, { monde: true });
  p.arrivee(1); p.arrivee(2);
  p.recu(1, { k: 'bonjour', classe: 'iop', etat: null });
  const w = p.w, po = w.portes.find(x => x.vers);
  assert.equal(w.arene, null, 'pas d’arène : le monde ouvert');
  const q1 = w.players[0];
  const fini = { enCours: [], finies: ['tuto'], etapesFinies: [], suivie: null, decouvertes: [], vaincus: ['bouftou'], objets: {} };
  const pres = w.map.nearestFree(po.ends[0].x + 40, po.ends[0].y);
  p.recu(2, { k: 'bonjour', classe: 'cra', etat: { level: 12, zone: 'incarnam', x: pres.x, y: pres.y, quetes: fini } });
  const q2 = w.players[1];
  assert.ok(q1.quetes && q2.quetes && q1.quetes !== q2.quetes, 'chacun ses quêtes');
  assert.ok(q2.quetes.vaincus.has('bouftou') && !q1.quetes.vaincus.has('bouftou'));
  assert.ok(Math.hypot(q2.x - po.ends[0].x, q2.y - po.ends[0].y) < 120, 'le second reprend sa place');
  p.recu(1, { k: 'pret' }); p.recu(2, { k: 'pret' });
  p.recu(2, { k: 'entree', i: { aim: po.ends[0], dest: { x: po.ends[0].x, y: po.ends[0].y }, versPortail: po.nom } });
  for (let i = 0; i < 120 && !recus.get(2).some(d => d.k === 'sortie'); i++) p.avancer(1 / 60);
  const s = recus.get(2).find(d => d.k === 'sortie');
  assert.ok(s?.vers?.zone, 'le second part seul vers l’autre zone');
  assert.ok(!recus.get(1).some(d => d.k === 'sortie'), 'le premier reste');
  assert.equal(w.passage, null);
});

test('donjons de groupe : un donjon d’Astrub au choix, plus de PV et de monstres à plusieurs, un allié relève l’autre, butin chacun le sien', async () => {
  const S = await chargerSim();
  const tags = arenesDisponibles(S).map(a => a.tag);
  assert.deepEqual(tags, ['arene_crypte', 'arene_grange', 'arene_chateau', 'arene_cour', 'arene_cache'], 'la Crypte et les quatre donjons d’Astrub');
  const p = new Partie(S, () => {}, 3, null, { arene: 'arene_grange' });
  p.arrivee(1); p.arrivee(2);
  p.recu(1, { k: 'bonjour', classe: 'iop', etat: { level: 40 } });
  p.recu(2, { k: 'bonjour', classe: 'cra', etat: { level: 40 } });
  const w = p.w;
  assert.equal(w.opts.zone, 'astrub');
  assert.equal(w.arene?.d.nom, 'Grange du Tournesol Affamé');
  assert.equal(w.monsters.length, 0, 'aucun monstre d’Astrub hors de l’arène');
  const [a, b] = w.players;
  p.recu(1, { k: 'entree', i: { move: { x: 1, y: 0 } } });
  for (let i = 0; i < 60 * 5 && !w.monsters.length; i++) p.avancer(1 / 60);
  const m = w.monsters[0];
  assert.ok(m, 'la première vague arrive');
  assert.equal(m.maxHp, Math.round(S.GAME_DATA.monsters[m.type].hp * 1.7), '+70 % de PV pour un joueur de plus');
  // un joueur à terre : l'autre reste à côté, il se relève en 3 s avec la moitié de ses PV
  for (const x of w.monsters) { x.dead = true; x.t = 0; }
  w.arene.demarre = false;
  b.dead = true; b.hp = 0; a.x = b.x + 30; a.y = b.y;
  p.recu(1, { k: 'entree', i: {} });
  for (let i = 0; i < 60 * 2; i++) { p.avancer(1 / 60); a.x = b.x + 30; a.y = b.y; }
  assert.equal(b.dead, true, 'pas encore');
  assert.ok(w.telegraphs.some(t => t.kind === 'circle' && t.progress > 0.5), 'le cercle de relève se remplit');
  for (let i = 0; i < 60 * 1.5; i++) { p.avancer(1 / 60); a.x = b.x + 30; a.y = b.y; }
  assert.equal(b.dead, false, 'relevé par son allié');
  assert.equal(b.hp, Math.round(b.maxHp / 2));
  // butin : un monstre vaincu donne un tirage à chacun des deux, que lui seul voit
  w.drops.length = 0;
  // (un tirage peut ne donner que des ressources, rangées dans le sac : on recommence jusqu'à un objet ou des kamas au sol)
  for (let n = 0; n < 50 && !w.drops.length; n++) {
    const cible = w.spawnMonster('bouftou', a.x + 20, a.y);
    w.commeJoueur(a, () => { cible.hp = 1; cible.dead = true; w['dropLoot'](cible); });
  }
  const pour = new Set(w.drops.map(d => d.pour));
  assert.ok(w.drops.every(d => d.pour === a.id || d.pour === b.id), 'chaque objet au sol a son propriétaire');
  assert.ok(pour.size >= 1);
  for (const d of w.drops) assert.equal(w.commeJoueur(a, () => w.shown(d)), d.pour === a.id);
  p.depart(1); p.depart(2);
});
