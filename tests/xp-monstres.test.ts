import { describe, expect, it } from 'vitest';
import { GAME_DATA } from '../src/sim/data';

describe('XP des monstres (0.4 : une courbe selon le niveau, tools/contenu/xp_monstres.py)', () => {
  const M = GAME_DATA.monsters, sous = Object.values(GAME_DATA.zones.astrub.open!.subareas);
  const normaux = [...new Set(sous.flatMap(s => s.monsters))].map(t => M[t]).filter(m => m && !m.elite && !m.boss && !m.archiDe && (m.level ?? 0) > 10);
  it('plus de valeur provisoire à 20 XP au-dessus du niveau 10, et un monstre plus fort rapporte plus', () => {
    expect(normaux.length).toBeGreaterThan(50);
    expect(normaux.filter(m => m.xp === 20)).toEqual([]);
    for (const a of normaux) for (const b of normaux) if (a.level! < b.level!) expect(a.xp!, `${a.name} / ${b.name}`).toBeLessThanOrEqual(b.xp!);
  });
  it('un monstre de son niveau fait passer un niveau en 25 à 65 tués (XP du niveau n = 100 × n)', () => {
    for (const m of normaux) {
      const tues = (GAME_DATA.classes.iop.xpBase * m.level!) / m.xp!;
      expect(tues, m.name).toBeGreaterThanOrEqual(25);
      expect(tues, m.name).toBeLessThanOrEqual(65);
    }
  });
});
