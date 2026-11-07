import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA } from '../src/sim/data';
import { GridMap, MAP_COLS, MAP_ROWS, WorldGrid, type MapData, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';

/** Bug de Mathis (2026-11-07) : les monstres fonçaient tout droit dans les gros décors (autel de l'arène) et y restaient coincés. */
const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
const STEP = 1 / 60;
/** Carte toute marchable avec un gros bloc de décor au milieu (colonnes 4 à 9, rangées 8 à 31). */
function carteAvecBloc(): GridMap {
  let mov = '';
  for (let r = 0; r < MAP_ROWS; r++) for (let k = 0; k < MAP_COLS; k++) mov += k >= 4 && k <= 9 && r >= 8 && r <= 31 ? '0' : '1';
  return new GridMap({ ...carte, mov, decor: [] });
}

describe('contournement du décor', () => {
  it('un monstre de l\'autre côté d\'un gros décor en fait le tour pour rejoindre le joueur', () => {
    const map = carteAvecBloc(), w = new World({ data: GAME_DATA, zone: 'champs-astrub', map, seed: 5 });
    w.monsters.length = 0;
    const p = w.player, cible = map.cellToWorld(20 * MAP_COLS + 12), dep = map.cellToWorld(20 * MAP_COLS + 1);
    p.x = cible.x; p.y = cible.y; p.hp = p.maxHp = 1e9;
    expect(w.clearShot(dep, cible)).toBe(false);   // le bloc est bien entre les deux
    const m = w.spawnMonster('bouftou', dep.x, dep.y); m.state = 'chase';
    let proche = Infinity;
    for (let i = 0; i < 60 * 12; i++) {
      p.x = cible.x; p.y = cible.y;
      w.step(STEP, NO_INPUT);
      proche = Math.min(proche, Math.hypot(m.x - p.x, m.y - p.y));
      expect(map.walkable(m.x, m.y)).toBe(true);
    }
    expect(proche).toBeLessThan(m.radius + p.radius + 60);
  });

  it('dans l\'arène de la Crypte, les monstres en route s\'écartent les uns des autres au lieu de se rentrer dedans', () => {
    const data = JSON.parse(readFileSync(new URL('../public/assets/mondes/incarnam/monde.json', import.meta.url), 'utf8')) as WorldData;
    const w = new World({ data: GAME_DATA, zone: 'incarnam', map: new WorldGrid(data), seed: 30 }), wg = w.worldGrid!;
    w.allerArene('arene_crypte');
    const p = w.player, free = wg.freeByMap.get('arene_crypte')!, pos = wg.cellToWorld(free[free.length >> 1]);
    let contacts = 0, n = 0;
    for (let t = 0; t < 60 * 20; t++) {
      p.hp = p.maxHp; p.dead = false; p.x = pos.x; p.y = pos.y;
      w.step(STEP, NO_INPUT);
      for (const m of w.monsters) {
        if (m.dead || m.state !== 'chase' || Math.hypot(m.x - p.x, m.y - p.y) < 150) continue;
        n++; if (w.monsters.some(o => o !== m && !o.dead && Math.hypot(o.x - m.x, o.y - m.y) < o.radius + m.radius + 2)) contacts++;
      }
      for (const m of w.monsters) if (!m.dead && Math.hypot(m.x - p.x, m.y - p.y) < 90 && w.time > 5) w.killMonster(m);
    }
    expect(n).toBeGreaterThan(500);
    expect(contacts / n).toBeLessThan(0.15);   // environ 0,5 sans l'évitement
  });
});
