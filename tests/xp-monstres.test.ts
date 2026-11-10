import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { GAME_DATA } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { World } from '../src/sim/world';

const incarnam = JSON.parse(readFileSync(new URL('../public/assets/mondes/incarnam/monde.json', import.meta.url), 'utf8')) as WorldData;

describe('XP des monstres (0.4 : une courbe selon le niveau, tools/contenu/xp_monstres.py)', () => {
  const M = GAME_DATA.monsters, sous = Object.values(GAME_DATA.zones.astrub.open!.subareas);
  const normaux = [...new Set(sous.flatMap(s => s.monsters))].map(t => M[t]).filter(m => m && !m.elite && !m.boss && !m.archiDe && (m.level ?? 0) > 10);
  it('plus de valeur provisoire à 20 XP au-dessus du niveau 10, et un monstre plus fort rapporte plus', () => {
    expect(normaux.length).toBeGreaterThan(50);
    expect(normaux.filter(m => m.xp === 20)).toEqual([]);
    for (const a of normaux) for (const b of normaux) if (a.level! < b.level!) expect(a.xp!, `${a.name} / ${b.name}`).toBeLessThanOrEqual(b.xp!);
  });
  it('un monstre de son niveau fait passer un niveau en 50 à 130 tués (XP du niveau n = 200 × n)', () => {
    for (const m of normaux) {
      const tues = (GAME_DATA.classes.iop.xpBase * m.level!) / m.xp!;
      expect(tues, m.name).toBeGreaterThanOrEqual(50);
      expect(tues, m.name).toBeLessThanOrEqual(130);
    }
  });
});

describe('XP des monstres trop faibles (à la place d\'un niveau max)', () => {
  it('entière jusqu\'à 5 niveaux d\'écart, moitié à 10, 5 % à 20 et au-delà', () => {
    expect(World.ecartXp(10, 20)).toBe(1);
    expect(World.ecartXp(25, 20)).toBe(1);
    expect(World.ecartXp(30, 20)).toBeCloseTo(0.5);
    expect(World.ecartXp(40, 20)).toBeCloseTo(0.05);
    expect(World.ecartXp(90, 20)).toBe(0.05);
  });
  it('un perso niveau 40 ne gagne presque rien sur un monstre d\'Incarnam', () => {
    const gain = (niveau: number) => {
      const w = new World({ data: GAME_DATA, zone: 'incarnam', map: new WorldGrid(incarnam), seed: 1, sansGroupes: true }), p = w.player;
      p.level = niveau; p.xp = 0; w.drainEvents();
      w.killMonster(w.spawnMonster('arakne', p.x + 40, p.y));
      const e = w.drainEvents().find(e => e.k === 'xp');
      return e && e.k === 'xp' ? e.n : 0;
    };
    expect(gain(1)).toBeGreaterThan(0);
    expect(gain(40)).toBeLessThanOrEqual(Math.ceil(gain(1) * 0.05));
  });
});
