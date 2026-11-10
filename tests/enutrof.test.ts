import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';
import { coffreDe, ouvrirCoffre, palierCoffre } from '../src/sim/enutrof';

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
    expect(w.drops.length).toBeGreaterThan(avant);
    expect(w.drops.some(d => d.pour === q.id)).toBe(true);
    expect(ouvrirCoffre(p, w)).toBe(false);   // vide
  });
});
