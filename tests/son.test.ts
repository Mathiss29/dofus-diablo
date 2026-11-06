import { describe, expect, it } from 'vitest';
import { gainDistance, MANIFESTE, regrouper, sonDuDecor, suivante } from '../src/render/son';
import { GAME_DATA } from '../src/sim/data';
import { existsSync } from 'node:fs';

describe('Son (maquette Son, 2026-11-06)', () => {
  it('le volume baisse avec la distance', () => {
    expect(gainDistance(100)).toBe(1);
    expect(gainDistance(800)).toBeGreaterThan(0);
    expect(gainDistance(800)).toBeLessThan(1);
    expect(gainDistance(5000)).toBe(0);
  });
  it('les sources proches du décor sont regroupées', () => {
    const g = regrouper([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 2000, y: 0 }], 350);
    expect(g).toHaveLength(2);
    expect(g[0].x).toBeCloseTo(50);
  });
  it('jamais deux fois la même musique de suite', () => {
    for (let i = 0; i < 20; i++) expect(suivante(['a', 'b', 'c'], 'b', i / 20)).not.toBe('b');
    expect(suivante(['a'], 'a', 0.5)).toBe('a');
  });
  it('décor qui sonne d\'après les particules officielles', () => {
    expect(sonDuDecor('Feu')).toBe('feu');
    expect(sonDuDecor('Cascade')).toBe('cascade');
    expect(sonDuDecor('Spores')).toBeNull();
  });
  it('chaque fichier de sons.json existe', () => {
    const M = MANIFESTE, f: string[] = [...Object.values(M.ambiances), ...Object.values(M.ui), ...M.impacts,
      ...Object.values(M.sorts).flatMap(s => Object.values(s)), ...Object.values(M.gfx).flat(),
      ...Object.values(M.monstres).flatMap(m => [...m.attaque, ...m.hit, ...m.mort]),
      ...Object.values(M.musiques).flatMap(m => typeof m === 'string' ? [m] : [m.calme, m.renfort ?? m.calme])];
    for (const x of f) expect(existsSync(`public/assets/son/${x}`), x).toBe(true);
  });
  it('les monstres d\'Incarnam ont leurs sons, et chaque sort Iop a le son de son animation', () => {
    const inc = GAME_DATA.zones.incarnam.open!;
    for (const s of Object.values(inc.subareas)) for (const m of s.monsters) expect(MANIFESTE.monstres[m]?.mort.length, m).toBeGreaterThan(0);
    for (const n of [800, 801, 802, 803, 808, 809, 811, 814]) expect(MANIFESTE.sorts.iop[`AnimAttaque${n}`]).toBeTruthy();
    expect(MANIFESTE.sorts.commun.AnimArme0).toBeTruthy();
  });
});
