// Hôtel de Vente (« HDV : », 2026-11-15) : annonces, achats, colis, signatures du serveur, limite du solo, parties du serveur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { creerComptes } from './comptes.mjs';
import { creerServeur } from './index.mjs';

const JOUR = 86_400_000;
const CHAPEAU = { uid: 7, id: '629', rarity: 'rare', stats: { initiative: 180, vitalite: 43, force: 12 }, extra: ['force'] };

/** Deux comptes (Lyra : 1, Brak : 2) avec un perso en ligne chacun ; Brak a 5 000 kamas sur sa sauvegarde. */
function base(t0 = Date.now()) {
  const dossier = mkdtempSync(join(tmpdir(), 'df-hdv-'));
  creerComptes({ dossier, env: {}, origines: new Set() }).fermer();
  const db = new DatabaseSync(join(dossier, 'diablofus.db')), J = ['a'.repeat(64), 'b'.repeat(64)];
  [['Lyra', 100], ['Brak', 5000]].forEach(([nom, kamas], i) => {
    db.prepare('INSERT INTO comptes (discord, nom, roles, cree, vu) VALUES (?, ?, ?, ?, ?)').run(String(100 + i), `${nom}D`, '[]', t0, t0);
    db.prepare('INSERT INTO jetons VALUES (?, ?, ?, ?)').run(createHash('sha256').update(J[i]).digest('hex'), i + 1, t0, t0 + 90 * JOUR);
    db.prepare('INSERT INTO persos VALUES (?, 0, ?, 1)').run(i + 1, JSON.stringify({ nom, classe: 'iop', sexe: 'm', hardcore: false, cree: t0, maj: 1, temps: 0, lieu: '', zones: [], etat: { level: 50, kamas } }));
  });
  db.close();
  let t = t0;
  const comptes = creerComptes({ dossier, env: { HDV_SECRET: 'essai' }, origines: new Set(), maintenant: () => t });
  return { comptes, hdv: comptes.hdv, J, lyra: { id: 1 }, brak: { id: 2 }, avancer: ms => { t += ms; } };
}

test('ressources : mise en vente avec taxe, achat, kamas du vendeur en colis, limite du solo', async () => {
  const { comptes, hdv, lyra, brak } = base();
  const v = await hdv.vendre(lyra, { emplacement: 0, objet: { k: 'ressource', id: '289', n: 10 }, prix: 1000 });
  assert.equal(v.ok, true); assert.equal(v.taxe, 20); assert.equal(v.applique, false);
  assert.equal((await hdv.vendre(lyra, { emplacement: 0, objet: { k: 'ressource', id: '289', n: 7 }, prix: 10 })).erreur, 'lot');
  assert.equal((await hdv.vendre(lyra, { emplacement: 0, objet: { k: 'ressource', id: '14635', n: 1 }, prix: 10 })).erreur, 'pepite');
  assert.equal((await hdv.vendre(lyra, { emplacement: 0, objet: { k: 'ressource', id: '289', n: 1 }, prix: 0 })).erreur, 'prix');
  assert.equal((await hdv.acheter(lyra, { emplacement: 0, id: v.id })).erreur, 'soi');
  assert.equal((await hdv.acheter(brak, { emplacement: 0, id: v.id, prix: 999 })).erreur, 'prixChange');
  const a = await hdv.acheter(brak, { emplacement: 0, id: v.id, prix: 1000 });
  assert.deepEqual(a.objet, { k: 'ressource', id: '289', n: 10 });
  assert.equal((await hdv.acheter(brak, { emplacement: 0, id: v.id })).erreur, 'vendu');
  // 6B : Lyra touche ses kamas à la prochaine connexion
  const e = await hdv.encaisser(lyra, { emplacement: 0 });
  assert.equal(e.kamas, 1000); assert.match(e.textes[0], /Blé ×10 vendu 1\s000 kamas/u);
  assert.equal((await hdv.encaisser(lyra, { emplacement: 0 })).kamas, 0);
  // Brak avait 5 000 kamas sauvés : 1 000 dépensés, une annonce à 4 500 ne passe plus
  const w = await hdv.vendre(lyra, { emplacement: 0, objet: { k: 'ressource', id: '289', n: 100 }, prix: 4500 });
  assert.equal((await hdv.acheter(brak, { emplacement: 0, id: w.id })).erreur, 'kamas');
  // 4C : 500 unités par jour en solo (110 déjà posées)
  for (let i = 0; i < 3; i++) assert.equal((await hdv.vendre(lyra, { emplacement: 0, objet: { k: 'ressource', id: '289', n: 100 }, prix: 10 })).ok, true);
  const q = await hdv.vendre(lyra, { emplacement: 0, objet: { k: 'ressource', id: '289', n: 100 }, prix: 10 });
  assert.equal(q.erreur, 'quota'); assert.equal(q.reste, 90);
  comptes.fermer();
});

test('équipement : seulement signé par le serveur, une signature ne se vend qu’une fois par son propriétaire', async () => {
  const { comptes, hdv, lyra, brak } = base();
  assert.equal((await hdv.vendre(lyra, { emplacement: 0, objet: { k: 'objet', item: CHAPEAU }, prix: 500 })).erreur, 'signature');
  const signe = hdv.signer({ ...CHAPEAU });
  assert.ok(hdv.signature(signe));
  assert.equal(hdv.signature({ ...signe, rarity: 'epique' }), null);   // signature recopiée sur un autre objet
  assert.equal((await hdv.vendre(lyra, { emplacement: 0, objet: { k: 'objet', item: { ...signe, stats: { vitalite: 900 } } }, prix: 500 })).erreur, 'jets');
  const v = await hdv.vendre(lyra, { emplacement: 0, objet: { k: 'objet', item: signe }, prix: 500 });
  assert.equal(v.ok, true);
  assert.equal((await hdv.vendre(lyra, { emplacement: 0, objet: { k: 'objet', item: signe }, prix: 400 })).erreur, 'signature');   // copie trafiquée
  const a = await hdv.acheter(brak, { emplacement: 0, id: v.id });
  assert.equal(a.objet.item.srv, signe.srv);
  assert.equal((await hdv.vendre(lyra, { emplacement: 0, objet: { k: 'objet', item: signe }, prix: 400 })).erreur, 'signature');   // n'est plus à elle
  assert.equal((await hdv.vendre(brak, { emplacement: 0, objet: { k: 'objet', item: a.objet.item }, prix: 900 })).ok, true);   // Brak peut le revendre
  comptes.fermer();
});

test('annonces : 16 par perso, 7 jours puis retour en colis ; retrait', async () => {
  const { comptes, hdv, lyra, avancer } = base();
  const ids = [];
  for (let i = 0; i < 16; i++) ids.push((await hdv.vendre(lyra, { emplacement: 0, objet: { k: 'ressource', id: '289', n: 1 }, prix: 5 })).id);
  assert.equal((await hdv.vendre(lyra, { emplacement: 0, objet: { k: 'ressource', id: '289', n: 1 }, prix: 5 })).erreur, 'annonces');
  const r = await hdv.retirer(lyra, { emplacement: 0, id: ids[0] });
  assert.deepEqual(r.objet, { k: 'ressource', id: '289', n: 1 });
  avancer(8 * JOUR);
  const e = await hdv.encaisser(lyra, { emplacement: 0 });
  assert.equal(e.objets.length, 15); assert.match(e.textes[0], /annonce finie/);
  comptes.fermer();
});

test('perso dans une partie du serveur : le serveur fait le geste lui-même, sans limite du solo', async () => {
  const { comptes, hdv, lyra, brak } = base();
  const S = await import('./partie/sim.mjs');
  const joueur = (kamas, bag = [], resources = {}) => ({ kamas, bag, resources, apparats: [], apparat: {}, tailleSac: 60 });
  const monde = j => ({ newUid: () => 99, players: [j], coffre: { onglets: [[]] }, opts: { items: S.ITEMS }, commeJoueur: (_q, f) => f() });
  const L = joueur(100, [hdv.signer({ ...CHAPEAU })], { 289: 600 }), B = joueur(5000);
  hdv.partieDe = c => { const j = c === 1 ? L : B; return { appliquer: op => Promise.resolve(S.opHdv(monde(j), j, op)) }; };   // comme une partie dans un autre fil
  const v = await hdv.vendre(lyra, { emplacement: 0, objet: { k: 'ressource', id: '289', n: 100 }, prix: 1000 });
  assert.equal(v.applique, true); assert.equal(L.resources[289], 500); assert.equal(L.kamas, 80);
  for (let i = 0; i < 5; i++) assert.equal((await hdv.vendre(lyra, { emplacement: 0, objet: { k: 'ressource', id: '289', n: 100 }, prix: 10 })).ok, true);   // 600 unités en tout : pas de limite ici
  // l'objet de la partie fait foi (uid), pas celui envoyé
  const o = await hdv.vendre(lyra, { emplacement: 0, objet: { k: 'objet', item: { ...CHAPEAU, uid: 7 } }, prix: 300 });
  assert.equal(o.ok, true); assert.equal(L.bag.length, 0);
  const a = await hdv.acheter(brak, { emplacement: 0, id: o.id });
  assert.equal(a.applique, true); assert.equal(B.kamas, 4700); assert.equal(B.bag.length, 1); assert.equal(B.bag[0].uid, 99);
  const e = await hdv.encaisser(lyra, { emplacement: 0 });
  assert.equal(e.applique, true); assert.equal(e.kamas, 300); assert.ok(L.kamas >= 300);
  comptes.fermer();
});

test('routes : offres filtrées et triées à l’unité, prix moyen, mes annonces, favoris', async () => {
  const { comptes, hdv, lyra, brak, J } = base();
  const s = creerServeur({ comptes });
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${s.address().port}`, auth = j => ({ authorization: `Bearer ${j}`, 'content-type': 'application/json' });
  await hdv.vendre(lyra, { emplacement: 0, objet: { k: 'ressource', id: '289', n: 10 }, prix: 200 });
  await hdv.vendre(lyra, { emplacement: 0, objet: { k: 'ressource', id: '289', n: 1 }, prix: 15 });
  const v = await hdv.vendre(lyra, { emplacement: 0, objet: { k: 'ressource', id: '289', n: 100 }, prix: 900 });
  await hdv.acheter(brak, { emplacement: 0, id: v.id });
  const o = await (await fetch(`${url}/hdv/offres?type=ressource&cat=paysan&q=bl`, { headers: auth(J[1]) })).json();
  assert.deepEqual(o.offres.map(x => x.prix), [15, 200]);   // 15 l'unité, puis 20
  assert.equal(o.moyennes['r:289'], 9);
  assert.equal((await (await fetch(`${url}/hdv/offres?type=ressource&cat=mineur`, { headers: auth(J[1]) })).json()).offres.length, 0);
  const p = await (await fetch(`${url}/hdv/prix?cle=r:289`, { headers: auth(J[1]) })).json();
  assert.equal(p.courbe.length, 1); assert.equal(p.courbe[0].n, 100);
  await fetch(`${url}/hdv/favori`, { method: 'POST', headers: auth(J[1]), body: JSON.stringify({ cle: 'r:289', nom: 'Blé', seuil: 16 }) });
  const moi = await (await fetch(`${url}/hdv/moi?emplacement=0`, { headers: auth(J[1]) })).json();
  assert.equal(moi.max, 16); assert.equal(moi.achats.length, 1); assert.equal(moi.favoris[0].alerte, true);
  const elle = await (await fetch(`${url}/hdv/moi?emplacement=0`, { headers: auth(J[0]) })).json();
  assert.equal(elle.annonces.length, 2); assert.equal(elle.colis, 1); assert.equal(elle.kamas, 900);
  assert.equal((await fetch(`${url}/hdv/offres`)).status, 401);
  await new Promise(r => { s.close(r); s.closeAllConnections(); });
});

test('âmes : l’échange passe par l’HDV, une âme du solo compte 25 unités dans la limite du jour', async () => {
  const { comptes, hdv, lyra, brak } = base();
  const S = await import('./partie/sim.mjs');
  const ame = Object.keys(S.ITEMS.resources).find(k => S.ITEMS.resources[k].ame);
  const v = await hdv.vendre(lyra, { emplacement: 0, objet: { k: 'ame', id: ame }, prix: 2000 });
  assert.equal(v.ok, true);
  const a = await hdv.acheter(brak, { emplacement: 0, id: v.id });
  assert.deepEqual(a.objet, { k: 'ame', id: ame });
  // 25 (l'âme vendue) + 3 lots de 100 + 7 âmes = 500 : l'âme suivante dépasse la limite du jour
  for (let i = 0; i < 3; i++) assert.equal((await hdv.vendre(lyra, { emplacement: 0, objet: { k: 'ressource', id: '289', n: 100 }, prix: 10 })).ok, true);
  for (let i = 0; i < 7; i++) assert.equal((await hdv.vendre(lyra, { emplacement: 0, objet: { k: 'ame', id: ame }, prix: 10 })).ok, true);
  assert.equal((await hdv.vendre(lyra, { emplacement: 0, objet: { k: 'ame', id: ame }, prix: 10 })).erreur, 'quota');
  assert.equal((await hdv.vendre(brak, { emplacement: 0, objet: { k: 'ame', id: ame }, prix: 10 })).ok, true);   // la limite est par compte
  comptes.fermer();
});

test('partie du serveur : les objets qui y apparaissent sont signés, jamais ceux que le perso a apportés', async () => {
  const { chargerSim, Partie } = await import('./partie.mjs');
  const S = await chargerSim();
  const { hdv, comptes } = base();
  const p = new Partie(S, () => {}, 7, null, { signer: it => hdv.signer(it) });
  p.arrivee(1);
  p.recu(1, { k: 'bonjour', classe: 'iop', etat: { level: 30, bag: [{ ...CHAPEAU }] } });
  const q = p.w.players[0];
  assert.equal(q.bag.length, 1);
  q.bag.push({ ...CHAPEAU, uid: 999 });
  for (let i = 0; i < 61; i++) p.avancer(1 / 60);
  assert.equal(q.bag[0].srv, undefined);
  assert.ok(hdv.signature(q.bag[1]));
  p.depart(1);
  comptes.fermer();
});
