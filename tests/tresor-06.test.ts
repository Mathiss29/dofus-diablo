import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { defCoffreFuyard } from '../src/sim/coffreFuyard';
import { PORTAIL_TRESOR, poolTresor } from '../src/sim/salleTresor';
import { World } from '../src/sim/world';

const AS = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const VIDE = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (test = true) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(AS), seed: 5, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  reprise: VIDE, sansGroupes: true, ...(test ? { test: {} as never } : {}) });
const pas = (w: World, n: number) => { for (let i = 0; i < n; i++) { w.player.invuln = 1e9; w.step(1 / 20, NO_INPUT); w.drainEvents(); } };
/** Un Coffre Malveillant qui détale dans les Abraknydes (sous-zone 168), abattu. */
function coffreAbattu(w: World) {
  const p = w.player, c0 = w.worldGrid!.mapByTag('-10_-13')!, free = w.worldGrid!.freeByMap.get(c0.tag)!, q = w.worldGrid!.cellToWorld(free[Math.floor(free.length / 2)]);
  p.x = q.x; p.y = q.y;
  const c = w.spawnMonster('coffre_malveillant', p.x + 120, p.y, defCoffreFuyard(GAME_DATA.monsters.coffre_malveillant, w.niveauEn(p.x, p.y)));
  c.fuyard = true;
  w.killMonster(c);
  return { x: c.x, y: c.y };
}

describe('0.6 (22B) : le portail du Coffre Malveillant et la Salle au trésor', () => {
  it('une fois sur 20, un portail doré qui s’éteint au bout de 30 s ; jamais en partie publique', () => {
    const w = monde(), ch = PORTAIL_TRESOR.chance;
    expect(ch).toBe(0.05);
    PORTAIL_TRESOR.chance = 1;
    try {
      coffreAbattu(w);
      expect(w.portailTresor?.vie).toBe(30);
      w.player.x += 600;
      pas(w, 20 * 31);
      expect(w.portailTresor).toBeNull();
      const pub = monde(false);
      if (!pub.player.v06) { coffreAbattu(pub); expect(pub.portailTresor).toBeNull(); }
    } finally { PORTAIL_TRESOR.chance = ch; }
  });

  it('on y entre : coffres, monstres dorés de la sous-zone au niveau de la sous-zone, Coffre des Forgerons ; coffre et retour au portail', () => {
    const w = monde(), ch = PORTAIL_TRESOR.chance, p = w.player;
    PORTAIL_TRESOR.chance = 1;
    try {
      const o = coffreAbattu(w), P = w.portailTresor!, cle = p.cleDonjon;
      p.x = P.x; p.y = P.y;
      pas(w, 2);
      const a = w.arene!;
      expect(a?.d.nom).toBe('Salle au trésor');
      expect(w.worldGrid!.mapAt(p.x, p.y)?.tag).toBe('arene_tresor');
      expect(p.cleDonjon).toBe(cle);   // pas de clé
      expect(poolTresor(w).length).toBeGreaterThan(0);
      const vus = new Set<string>();
      for (let i = 0; i < 2000 && !a.fini; i++) {
        pas(w, 2);
        for (const m of w.monsters) if (m.arene && !m.dead && m.state !== 'spawn') {
          vus.add(m.type);
          if (m.dore) expect(m.def.level).toBe(P.niveau);
          m.intouchable = false; w.killMonster(m);
        }
      }
      expect(a.fini).toBe(true);
      expect(vus.has('coffre_malveillant')).toBe(true);
      expect(vus.has('coffre_des_forgerons')).toBe(true);
      expect([...vus].some(t => poolTresor(w).includes(t))).toBe(true);
      expect(a.butin!.kamas).toBeGreaterThanOrEqual(20 * P.niveau * PORTAIL_TRESOR.tirages);   // au niveau de la sous-zone, deux tirages
      p.x = a.pts.sortie.x; p.y = a.pts.sortie.y;
      pas(w, 40);
      expect(w.arene).toBeNull();
      expect(Math.hypot(p.x - o.x, p.y - o.y)).toBeLessThan(400);
      expect(w.visiteTresor).toBeNull();
    } finally { PORTAIL_TRESOR.chance = ch; }
  });
});
