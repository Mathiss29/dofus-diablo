import { describe, expect, it } from 'vitest';
import { GAME_DATA } from '../src/sim/data';
import { DANGER, degatsMonstre } from '../src/sim/danger';

/** Maquette « Dégâts » (Mathis 2026-11-08 : 1B+1C 2B) : normaux et élites visent les PV d'un perso équipé, au moins +35 % ; boss inchangés. */
describe('dégâts des monstres', () => {
  const D = DANGER.degats;
  const sansEquipement = (d: any) => {
    const lvl = d.level ?? 1, pv = D.pvRef.base + D.pvRef.parNiveau * (lvl - 1);
    let jet = 0;
    for (const s of d.spells ?? []) { let t = 0; for (const e of s.effects) if (e.k === 'dmg' && !e.perPa) t += (e.min + e.max) / 2; jet = Math.max(jet, t); }
    const mod = jet > 0 ? Math.min(D.max, Math.max(D.min, Math.sqrt(jet / D.jetRef))) : 1;
    return pv * D.part[d.boss ? 'boss' : d.elite ? 'elite' : 'normal'] * mod;
  };
  it('normaux et élites : au moins +35 %, boss inchangés', () => {
    for (const d of Object.values(GAME_DATA.monsters) as any[]) {
      const avant = sansEquipement(d), apres = degatsMonstre(d);
      if (d.boss) expect(apres).toBe(Math.max(1, Math.round(avant)));
      else expect(apres).toBeGreaterThanOrEqual(Math.round(avant * 1.35) - 1);
    }
  });
  it('un coup normal retire 6 à 9 % des PV d\'un perso équipé de son niveau', () => {
    for (const lvl of [10, 20, 30, 40]) {
      const nu = D.pvRef.base + D.pvRef.parNiveau * (lvl - 1), equipe = nu + D.equipement.base + D.equipement.parNiveau * (lvl - 1);
      const dmg = degatsMonstre({ level: lvl, spells: [] } as any);
      expect(dmg / equipe).toBeGreaterThan(0.06); expect(dmg / equipe).toBeLessThan(0.09);
    }
  });
});
