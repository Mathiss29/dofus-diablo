import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';

const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
const arena = () => { const w = new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed: 7, classId: 'osamodas', items: ITEMS }); w.waveDelay = 1e9; return w; };

describe('Cortège Sauvage (Invocations +3 pendant 6 s)', () => {
  it('les bêtes en trop repartent quand l\'effet se termine, la plus ancienne d\'abord', () => {
    const w = arena(), p = w.player;
    const base = w.invocationsMax(p);
    p.addMod('invocations', 3, 6, 'cortege');
    expect(w.invocationsMax(p)).toBe(base + 3);
    const betes = [0, 1, 2, 3].map(i => w.invoquer(p, 'tofu', 'tofu', p.x + 40 + i * 30, p.y)!);
    for (let i = 0; i < 60; i++) w.step(1 / 60, NO_INPUT);
    expect(betes.every(b => !b.dead)).toBe(true);           // pendant l'effet : toute la meute reste
    for (let i = 0; i < 6 * 60; i++) w.step(1 / 60, NO_INPUT);
    expect(w.invocationsPrises(p)).toBeLessThanOrEqual(base);
    expect(betes[3].dead).toBe(false);                        // la plus récente reste
    expect(betes[0].dead).toBe(true);
  });

  it('la description ne parle plus de tour', () => {
    expect(GAME_DATA.classes.osamodas.spells.cortege.desc).not.toMatch(/tour|PA/);
  });
});
