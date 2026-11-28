import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { DALAS, dalaEn, facteurDala } from '../src/sim/dalas';
import { World } from '../src/sim/world';

const AS = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const monde = (test: boolean) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(AS), seed: 3, items: ITEMS, ...(test ? { test: {} as never } : {}) });

describe('0.7 (13C) : dalas élémentaires de Pandala', () => {
  it('Akwadala, Terrdala et Plantala : +20 % dans leur élément, pour les joueurs et les monstres', () => {
    expect(Object.values(DALAS).map(d => d.element).sort()).toEqual(['air', 'eau', 'terre']);
    const w = monde(true), wg = w.worldGrid!;
    const tag = AS.maps.find(m => m.sub === 941)!.tag, c = wg.cellToWorld(wg.freeByMap.get(tag)![0]);
    expect(dalaEn(w, c.x, c.y)?.nom).toBe('Akwadala');
    expect(facteurDala(w, c.x, c.y, 'eau')).toBeCloseTo(1.2);
    expect(facteurDala(w, c.x, c.y, 'feu')).toBe(1);
    const p = w.player; p.x = c.x; p.y = c.y; p.invuln = 0;
    const hp = p.hp; p.hurt(100, c.x + 50, c.y, w, 'eau'); const eau = hp - p.hp;
    p.hp = hp; p.hurt(100, c.x + 50, c.y, w, 'feu'); const feu = hp - p.hp;
    expect(eau).toBeGreaterThan(feu);
    w.step(1 / 60, NO_INPUT);
    expect(w.drainEvents().some(e => e.k === 'status' && /Akwadala/.test((e as { text: string }).text))).toBe(true);
  });
  it('rien tant que la 0.7 est cachée', () => {
    const w = monde(false);
    if (w.v07Ouvert) return;
    const tag = AS.maps.find(m => m.sub === 944)!.tag, wg = w.worldGrid!, c = wg.cellToWorld(wg.freeByMap.get(tag)![0]);
    expect(facteurDala(w, c.x, c.y, 'terre')).toBe(1);
  });
});
