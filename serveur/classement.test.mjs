import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { creerComptes } from './comptes.mjs';
import { creerClassement, annonceurDiscord } from './classement.mjs';

function monde() {
  const comptes = creerComptes({ dossier: mkdtempSync(join(tmpdir(), 'diablofus-cl-')), env: {}, origines: new Set() });
  const db = comptes.db;
  db.prepare("INSERT INTO comptes (id, discord, nom, cree, vu) VALUES (1, 'a', 'A', 0, 0), (2, 'b', 'B', 0, 0), (3, 'c', 'C', 0, 0)").run();
  const poser = (compte, emp, p) => db.prepare('INSERT INTO persos (compte, emplacement, donnees, maj) VALUES (?, ?, ?, 0)').run(compte, emp, JSON.stringify(p));
  const annonces = [];
  let t = 1000;
  const cl = creerClassement({ comptes, auto: false, annoncer: x => annonces.push(x), maintenant: () => t++, enLigne: () => ['2-0'] });
  return { comptes, db, poser, cl, annonces };
}
const perso = (nom, level, xp, o = {}) => ({ nom, classe: 'iop', sexe: 'm', hardcore: false, temps: 100, lieu: 'Astrub', zones: [], ...o, etat: { level, xp, metiers: {}, zaaps: [], ...o.etat } });

test('classement : niveau, Hardcore à part, métiers, exploration', () => {
  const { poser, cl, comptes } = monde();
  poser(1, 0, perso('Goultard', 58, 900, { zones: ['a', 'b', 'c'], etat: { metiers: { paysan: { level: 42, xp: 10 }, mineur: { level: 1, xp: 0 } } } }));
  poser(2, 0, perso('Fleche', 58, 1200, { classe: 'cra', hardcore: true, zones: ['a'] }));
  poser(3, 1, perso('Petit', 3, 10, { etat: { metiers: { paysan: { level: 50, xp: 0 } } } }));
  poser(3, 2, perso('Essai', 200, 1e9, { test: true }));   // 5C : jamais les persos de test
  const c = cl.calculer();
  assert.deepEqual(c.listes.niveau, ['2-0', '1-0', '3-1']);
  assert.deepEqual(c.listes.hardcore, ['2-0']);
  assert.deepEqual(c.listes.metiers.paysan, ['3-1', '1-0']);
  assert.equal(c.listes.metiers.mineur, undefined);   // niveau 1 sans XP : pas classé
  assert.deepEqual(c.listes.exploration, ['1-0', '2-0']);
  assert.equal(c.persos['1-0'].nom, 'Goultard');
  assert.equal(c.persos['1-0'].c, 1);
  assert.equal(JSON.stringify(c).includes('"A"'), false);   // 7D : jamais le pseudo Discord
  comptes.fermer();
});

test('classement : se cacher (5A), fiche (7C), en ligne (7B)', async () => {
  const { db, poser, cl, comptes } = monde();
  poser(1, 0, perso('Goultard', 10, 0, { etat: { equipment: { arme: { id: 'epee', rarity: 3 } }, dofusPortes: ['emeraude'] } }));
  poser(2, 0, perso('Fleche', 9, 0));
  const f = cl.fiche('1-0');
  assert.equal(f.nom, 'Goultard'); assert.equal(f.equipement.arme.id, 'epee'); assert.deepEqual(f.dofusPortes, ['emeraude']); assert.equal(f.rangs.niveau, 1);
  db.prepare('INSERT INTO social (compte, cache) VALUES (1, 1)').run();
  assert.deepEqual(cl.calculer().listes.niveau, ['2-0']);
  assert.equal(cl.fiche('1-0'), null);
  assert.equal(cl.fiche('n-importe'), null);
  // la route renvoie le cache + qui est en ligne
  let corps = '';
  const res = { writeHead() {}, end(x) { corps = x; } };
  assert.equal(await cl.route({ method: 'GET', headers: {} }, res, new URL('http://x/classement')), true);
  const d = JSON.parse(corps);
  assert.deepEqual(d.enLigne, ['2-0']);
  assert.equal(d.total, 1);
  assert.equal(await cl.route({ method: 'GET', headers: {} }, res, new URL('http://x/ailleurs')), false);
  comptes.fermer();
});

test('classement : premiers gravés une fois, nouvelle tête annoncée (9A, 9B)', () => {
  const { poser, db, cl, annonces, comptes } = monde();
  poser(1, 0, perso('Goultard', 52, 0));
  cl.calculer();
  assert.equal(annonces.length, 1);   // niveau 50 ; pas d'annonce de tête au tout premier calcul
  assert.match(annonces[0], /Goultard.*niveau 50/);
  poser(2, 0, perso('Fleche', 60, 0, { etat: { dofus: ['emeraude'] } }));
  const c = cl.calculer();
  assert.deepEqual(c.premiers.map(p => [p.cle, p.nom]), [['niveau_50', 'Goultard'], ['dofus', 'Fleche']]);
  assert.ok(annonces.some(a => /Fleche.*1re place/.test(a)));
  assert.ok(annonces.some(a => /Fleche.*Dofus/.test(a)));
  const n = annonces.length;
  cl.calculer();
  assert.equal(annonces.length, n);   // rien de neuf : pas de nouvelle annonce
  void db;
  comptes.fermer();
});

test('classement : records de donjon par perso et par mode, premier à finir (2D, 9A)', () => {
  const { poser, cl, annonces, comptes } = monde();
  poser(1, 0, perso('Goultard', 10, 0)); poser(2, 0, perso('Fleche', 10, 0));
  cl.noterDonjon('Crypte de Kardorim', 200, [{ compte: 1, emplacement: 0, nom: 'Goultard', classe: 'iop' }]);
  cl.noterDonjon('Crypte de Kardorim', 250, [{ compte: 1, emplacement: 0, nom: 'Goultard', classe: 'iop' }]);   // moins bien : ignoré
  cl.noterDonjon('Crypte de Kardorim', 150, [{ compte: 1, emplacement: 0, nom: 'Goultard', classe: 'iop' }, { compte: 2, emplacement: 0, nom: 'Fleche', classe: 'cra' }]);
  const c = cl.calculer();
  assert.deepEqual(c.donjons['Crypte de Kardorim'].solo.map(r => [r.id, r.temps]), [['1-0', 200]]);
  assert.deepEqual(c.donjons['Crypte de Kardorim'].groupe.map(r => r.id).sort(), ['1-0', '2-0']);
  assert.equal(annonces.filter(a => /Crypte/.test(a)).length, 1);
  assert.equal(cl.rangs('2-0').donjons['Crypte de Kardorim|groupe'] > 0, true);
  comptes.fermer();
});

test('classement : un Hardcore mort reste dans les Tombés (3B)', () => {
  const { cl, comptes } = monde();
  assert.equal(cl.tomber(1, perso('Normal', 5, 0)), false);
  assert.equal(cl.tomber(1, perso('Brave', 12, 0, { hardcore: true }), { lieu: 'Champs d\'Astrub', tueur: 'Bouftou' }), true);
  const c = cl.calculer();
  assert.equal(c.tombes.length, 1);
  assert.equal(c.tombes[0].nom, 'Brave'); assert.equal(c.tombes[0].tueur, 'Bouftou'); assert.equal(c.tombes[0].niveau, 12);
  comptes.fermer();
});

test('annonces Discord : seulement un vrai webhook, sans mentions', async () => {
  const envois = [];
  assert.doesNotThrow(() => annonceurDiscord('')('rien'));
  assert.doesNotThrow(() => annonceurDiscord('https://exemple.com/x', async () => envois.push(1))('rien'));
  const a = annonceurDiscord('https://discord.com/api/webhooks/1/abc', async (u, o) => { envois.push(JSON.parse(o.body)); return { ok: true }; });
  a('Bonjour @everyone');
  await new Promise(r => setTimeout(r, 10));
  assert.equal(envois.length, 1);
  assert.deepEqual(envois[0].allowed_mentions, { parse: [] });
});
