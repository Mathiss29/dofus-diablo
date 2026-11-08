import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { PEPITE } from '../src/sim/items';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';
import { ARCHI, World } from '../src/sim/world';
import { LOOKS } from '../src/render/looks';

const AS = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const VIDE = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (test = true, seed = 2) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(AS), seed, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  reprise: VIDE, ...(test ? { test: {} as never } : {}) });
const M = GAME_DATA.monsters;

describe('archimonstres d\'Astrub (version 0.3 : 15B)', () => {
  it('les archimonstres officiels : dessin et sons de leur monstre, plus forts, butin officiel', () => {
    const l = Object.entries(M).filter(([, d]) => d.archiDe);
    expect(l.length).toBeGreaterThanOrEqual(28);
    for (const [k, d] of l) {
      const b = M[d.archiDe!];
      expect(b, k).toBeDefined();
      expect(LOOKS[k]?.atlas, k).toBe(LOOKS[d.archiDe!].atlas);
      expect(d.hp).toBeGreaterThan(b.hp);
      expect(d.xp!).toBeGreaterThan(b.xp ?? 0);
      expect(ITEMS.drops[k]?.length, k).toBeGreaterThan(0);
    }
    expect(M.archi_tofu_malade.name).toBe('Tofurapin le Pétri');
  });

  it('parfois un archimonstre prend la place d\'un monstre de groupe (partie de test seulement)', () => {
    const avant = ARCHI.chance;
    try {
      ARCHI.chance = 1;
      const w = monde(), v = monde(false);
      expect(w.monsters.some(m => m.def.archiDe)).toBe(true);
      expect(v.monsters.some(m => m.def.archiDe)).toBe(false);
      // un seul de chaque sorte en vie à la fois
      const n: Record<string, number> = {};
      for (const m of w.monsters) if (m.def.archiDe && !m.dead) n[m.type] = (n[m.type] ?? 0) + 1;
      expect(Math.max(...Object.values(n))).toBe(1);
    } finally { ARCHI.chance = avant; }
  });

  it('Petite pierre d\'âme chez Otomaï (0.3) ; un archimonstre vaincu avec elle est capturé', () => {
    const w = monde(), p = w.player;
    p.resources[PEPITE] = 100;
    expect(w.acheter('otomai', ARCHI.pierre)).toBe(true);
    expect(monde(false).acheter('otomai', ARCHI.pierre)).toBe(false);
    const m = w.spawnMonster('archi_bouftou', p.x + 40, p.y);
    w.killMonster(m);
    expect(p.resources[ARCHI.pierre]).toBeUndefined();
    expect(p.resources[ARCHI.pleine]).toBe(1);
    expect(p.ames).toEqual(['archi_bouftou']);
    expect(w.drainEvents().find(e => e.k === 'capture')).toMatchObject({ monster: 'archi_bouftou', neuf: true });
    // sans pierre : pas de capture
    w.killMonster(w.spawnMonster('archi_boufton', p.x + 40, p.y));
    expect(p.ames).toHaveLength(1);
    const v = monde(); restaurerJoueur(v, exporterJoueur(w));
    expect(v.player.ames).toEqual(['archi_bouftou']);
  });
});
