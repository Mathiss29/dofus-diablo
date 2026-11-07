import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA } from '../src/sim/data';
import { GridMap, MAP_COLS, MAP_ROWS, type MapData } from '../src/sim/gridmap';
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
});
