import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';
import { ajouterPieces, coffreDe, enSurcharge, ouvrirCoffre, palierCoffre } from '../src/sim/enutrof';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';

const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
const STEP = 1 / 60;
const enu = (seed = 7) => { const w = new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed, items: ITEMS, classId: 'enutrof' }); w.waveDelay = 1e9; return w; };
const idle = (w: World, s: number) => { for (let i = 0; i < s * 60; i++) w.step(STEP, NO_INPUT); };
const tuer = (w: World, entrave = false) => {
  const p = w.player, m = w.spawnMonster('bouftou', p.x + 60, p.y);
  if (entrave) m.entraveA = w.time;
  w.killMonster(m);
};

describe('Enutrof (maquette Enutrof, « 1A+1B 2D 3D 4A+4C 5A … 16A+16C »)', () => {
  it('2D : le coffre au trésor est là dès le départ, ne compte pas comme invocation et ne frappe pas (16A)', () => {
    const w = enu(); idle(w, 0.2);
    const c = coffreDe(w.player, w)!;
    expect(c).toBeTruthy();
    expect(c.horsCompte).toBe(true);
    expect(c.def.sorts.length).toBe(0);
  });

  it('1A+1B : un monstre vaincu près de l\'Enutrof donne une pièce, deux s\'il était entravé', () => {
    const w = enu(); idle(w, 0.2);
    const p = w.player;
    tuer(w); expect(p.coffrePieces).toBe(1);
    tuer(w, true); expect(p.coffrePieces).toBe(3);
    tuer(w, true); expect(p.coffreJournal[0]).toMatchObject({ n: 4, fois: 2 });   // 3B : même gain regroupé
  });

  it('3D : coffre à 0 PV = moitié des pièces perdue et assommé, puis il revient', () => {
    const w = enu(); idle(w, 0.2);
    const p = w.player; p.coffrePieces = 80;
    const c = coffreDe(p, w)!;
    c.hp = 0; c.mourir(w);
    idle(w, 0.1);
    expect(p.coffrePieces).toBe(40);
    expect(coffreDe(p, w)).toBeFalsy();
    idle(w, p.cls.coffre!.ko + 0.5);
    expect(coffreDe(p, w)).toBeTruthy();
  });

  it('4A + 5A : ouvrir au palier Argent vide le coffre, lâche du butin, et l\'allié proche reçoit le sien, réservé', () => {
    const w = enu(); idle(w, 0.2);
    const p = w.player, q = w.ajouterJoueur('iop');
    q.x = p.x + 80; q.y = p.y;
    idle(w, 0.2);
    p.coffrePieces = 100;
    expect(palierCoffre(p)).toBe(1);
    const avant = w.drops.length;
    expect(ouvrirCoffre(p, w)).toBe(true);
    expect(p.coffrePieces).toBe(0);
    expect(w.drops.some(d => d.pour === q.id)).toBe(true);   // la part de l'allié tombe tout de suite
    idle(w, 1.5);   // 7D : le butin du coffre jaillit morceau par morceau
    expect(w.drops.length).toBeGreaterThan(avant);
    expect(w.drops.some(d => d.pour === q.id)).toBe(true);
    expect(ouvrirCoffre(p, w)).toBe(false);   // vide
  });

  it('5B : chaque palier atteint tire tout de suite son butin dans la vitrine ; ouvrir le rend', () => {
    const w = enu(); idle(w, 0.2);
    const p = w.player, C = p.cls.coffre!;
    ajouterPieces(p, C.paliers[1], w, p.x, p.y, 'test');
    expect(palierCoffre(p)).toBe(1);
    expect(p.coffreVitrine.map(v => v.palier)).toEqual([0, 1]);
    expect(p.coffreJournal[0]).toEqual({ t: 'test', n: C.paliers[1] });
    const caches = p.coffreVitrine.reduce((a, v) => a + v.butin.objets.length, 0);
    const sortis: number[] = [];
    w.drainEvents();
    expect(ouvrirCoffre(p, w)).toBe(true);
    expect(p.coffreVitrine).toEqual([]);
    for (let i = 0; i < 120; i++) { w.step(STEP, NO_INPUT); for (const e of w.drainEvents()) if (e.k === 'itemDrop') sortis.push(w.time); }
    expect(sortis.length).toBe(caches);
    if (caches > 1) expect(sortis[sortis.length - 1]).toBeGreaterThan(sortis[0]);   // 7D : un par un
    expect(p.coffreRecords.ouverts).toBe(1);
    expect(p.coffreRecords.plusGros).toBe(C.paliers[1]);
  });

  it('5B : coffre tombé = moitié des pièces et l\'objet du dernier palier perdus', () => {
    const w = enu(); idle(w, 0.2);
    const p = w.player, C = p.cls.coffre!;
    ajouterPieces(p, C.paliers[2], w, p.x, p.y);   // Or : 3 cases dans la vitrine
    expect(p.coffreVitrine.length).toBe(3);
    const c = coffreDe(p, w)!; c.hp = 0; c.mourir(w);
    expect(p.coffrePieces).toBe(C.paliers[2] - Math.floor(C.paliers[2] / 2));
    expect(p.coffreVitrine.length).toBeLessThanOrEqual(Math.min(2, palierCoffre(p) + 1));
    expect(p.coffreJournal[0].n).toBeLessThan(0);
  });

  it('6B : surcharge après Trésor, elle attire les monstres et tout est perdu s\'il tombe', () => {
    const w = enu(); idle(w, 0.2);
    const p = w.player, C = p.cls.coffre!, S = C.surcharge.paliers; idle(w, 0.5);
    ajouterPieces(p, S[0], w, p.x, p.y);
    expect(enSurcharge(p)).toBe(true);
    expect(p.coffreVitrine.length).toBe(C.paliers.length + 1);
    ajouterPieces(p, 9999, w, p.x, p.y);
    expect(p.coffrePieces).toBe(S[S.length - 1]);   // plafond
    const c = coffreDe(p, w)!;
    const m = w.spawnMonster('bouftou', c.x + 100, c.y); m.state = 'chase';
    expect(w.cibleDe(m)).toBe(c);
    c.hp = 0; c.mourir(w);
    expect(p.coffrePieces).toBe(0);
    expect(p.coffreVitrine).toEqual([]);
  });

  it('7B : le coffre ramasse les kamas au sol autour de lui', () => {
    const w = enu(); idle(w, 0.2);
    const p = w.player, c = coffreDe(p, w)!, k0 = p.kamas;
    // le perso part loin : seul le coffre est assez près des kamas
    w.drops.push({ uid: w.newUid(), x: c.x + 60, y: c.y, kamas: 37, t: 1 });
    p.x += 400;
    for (let i = 0; i < 30; i++) w.step(STEP, NO_INPUT);
    expect(p.kamas).toBe(k0 + 37);
  });

  it('8A : pièces, vitrine, journal et records gardés avec le perso', () => {
    const w = enu(); idle(w, 0.2);
    const p = w.player;
    ajouterPieces(p, 120, w, p.x, p.y, 'Archi-Bouftou');
    p.coffreRecords.ouverts = 3;
    const e = exporterJoueur(w);
    const w2 = enu(9); idle(w2, 0.1);
    restaurerJoueur(w2, JSON.parse(JSON.stringify(e)));
    const q = w2.player;
    expect(q.coffrePieces).toBe(120);
    expect(q.coffreVitrine.map(v => v.palier)).toEqual(p.coffreVitrine.map(v => v.palier));
    expect(q.coffreJournal[0].t).toBe('Archi-Bouftou');
    expect(q.coffreRecords.ouverts).toBe(3);
  });
});
