import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';

const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const loin = (w: World, x: number, y: number) => Math.abs(x - w.player.x) + Math.abs(y - w.player.y);

describe('groupes de monstres posés autour des joueurs (0.4)', () => {
  it('seuls les groupes proches existent ; ils suivent le joueur qui voyage, les anciens sont rangés', () => {
    const w = new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 1, test: {} as never });
    // (les groupes officiels des donjons, à l'intérieur, sont toujours là : peu nombreux)
    const vivants = () => w.monsters.filter(m => !m.dead && m.group >= 0 && !w.worldGrid!.mapAt(m.homeX, m.homeY)?.inside);
    expect(vivants().length).toBeGreaterThan(0);
    // bien moins que tout Amakna + Astrub (≈ 11 000 en partie de test)
    expect(vivants().length).toBeLessThan(800);
    // les monstres de l'arrivée sont là tout de suite (avant le premier pas), et aucun loin du joueur
    expect(vivants().every(m => loin(w, m.x, m.y) < World.POSE + 1500)).toBe(true);
    const avant = new Set(vivants().map(m => m.id));
    // voyage vers une carte d'Amakna, loin du départ
    const wg = w.worldGrid!, carte = wg.mapByCoords(0, 0)!, q = wg.cellToWorld(wg.freeByMap.get(carte.tag)![0]);
    expect(loin(w, q.x, q.y)).toBeGreaterThan(World.RETRAIT + 2000);
    w.player.x = q.x; w.player.y = q.y;
    for (let i = 0; i < 60; i++) w.step(1 / 60, NO_INPUT);
    const apres = vivants();
    expect(apres.some(m => wg.mapAt(m.x, m.y)?.sub === carte.sub || loin(w, m.x, m.y) < World.POSE)).toBe(true);
    expect(apres.some(m => avant.has(m.id))).toBe(false);
    expect(apres.every(m => loin(w, m.x, m.y) < World.POSE + 1500)).toBe(true);
  });
  it('un groupe qui poursuit le joueur n\'est pas rangé', () => {
    const w = new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 1 });
    const m = w.monsters.find(m => !m.dead && m.group >= 0)!;
    w.aggroGroup(m);
    m.x = w.player.x + World.RETRAIT + 500;
    for (let i = 0; i < 40; i++) { m.state = 'chase'; w.step(1 / 60, NO_INPUT); }
    expect(w.monsters.includes(m)).toBe(true);
  });
});
