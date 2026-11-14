import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';

const AS = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;

describe('invocations des monstres', () => {
  it('une invocation n’invoque pas : les Blops Coco ne s’invoquent pas en chaîne (partie 60 → 90 du robot, Clos des Blops)', () => {
    const w = new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(AS), seed: 4, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
      reprise: { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} }, sansGroupes: true, test: { invincible: true } as never });
    const p = w.player;
    const b = w.spawnMonster('blop_coco', p.x + 90, p.y); b.state = 'chase';
    for (let i = 0; i < 60 * 60; i++) { p.hp = p.maxHp; w.step(1 / 60, NO_INPUT); }
    const blops = w.monsters.filter(m => !m.dead && m.type === 'blop_coco');
    expect(blops.filter(m => m.summoner && m.summoner !== b).length).toBe(0);
    expect(blops.length).toBeLessThanOrEqual(2);
  });
});
