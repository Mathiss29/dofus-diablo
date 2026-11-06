import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APPARATS, BOUTIQUES, FAMILIERS, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { PEPITE, rollItem } from '../src/sim/items';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';
import { World } from '../src/sim/world';

const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const monde = () => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 1, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  apparats: APPARATS, familierXp: FAMILIERS.xp, reprise: { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} } });
const PIOUTE = '7713';

describe('familiers (maquette Familiers 1A+1C+1D 2C 3A 4A 5A 6A)', () => {
  it('familiers officiels avec planche, bonus évolutifs et courbe d\'XP', () => {
    const l = Object.values(FAMILIERS.familiers);
    expect(l.filter(f => !f.apparat).length).toBeGreaterThan(30);
    expect(l.filter(f => f.apparat).length).toBeGreaterThan(80);
    for (const f of l) {
      expect(f.anims.some(a => a.startsWith('AnimStatique')), f.nom).toBe(true);
      expect(readFileSync(new URL(`../public/assets/sprites/${f.planche}.json`, import.meta.url), 'utf8')).toContain('AnimStatique');
    }
    expect(FAMILIERS.xp.length).toBeGreaterThanOrEqual(100);
    expect(ITEMS.equipment[PIOUTE].slot).toBe('familier');
    expect(ITEMS.equipment[PIOUTE].stats.puissance).toEqual([7, 70]);
    expect(Object.values(ITEMS.equipment).filter(d => d.familier?.monstres?.includes('piou_violet')).length).toBeGreaterThan(0);
    expect(QUETES.succes.dans_les_nuages.recompense?.objet).toBe('1711');
    expect(APPARATS.prix.familier).toBeGreaterThan(0);
  });

  it('niveau 1 à 100 : XP en chassant et en nourrissant, bonus qui grandissent', () => {
    const w = monde(), p = w.player;
    p.level = 30;
    const f = rollItem(PIOUTE, ITEMS.equipment[PIOUTE], 'epique', w.rng, 999);
    expect(f.niv).toBe(1); expect(f.rarity).toBe('commun'); expect(f.stats.puissance).toBe(7);
    p.bag.push(f); expect(p.equip(999)).toBe(true);
    const avant = p.stat('puissance');
    w.xpFamilier(FAMILIERS.xp[50]);
    expect(f.niv).toBe(51); expect(f.stats.puissance).toBe(Math.floor(7 + 0.63 * 51));
    expect(p.stat('puissance')).toBe(avant + f.stats.puissance! - 7);
    // repas : un objet du sac (pas sous cadenas) et une ressource
    const o = rollItem('1', ITEMS.equipment[Object.keys(ITEMS.equipment)[0]], 'rare', w.rng, 1000);
    o.id = Object.keys(ITEMS.equipment)[0]; p.bag.push(o);
    const xp = f.xpF!;
    expect(w.nourrirFamilier({ uid: 1000 })).toBe(true);
    expect(p.bag.some(b => b.uid === 1000)).toBe(false);
    expect(f.xpF!).toBeGreaterThan(xp);
    p.resources[PEPITE] = 5;
    expect(w.nourrirFamilier({ res: PEPITE })).toBe(false);   // pas la monnaie d'Emp
    // sauvegarde
    const w2 = monde(); restaurerJoueur(w2, exporterJoueur(w));
    expect(w2.player.equipment.familier?.niv).toBe(f.niv);
  });

  it('il suit le perso et rapporte le butin autour de lui', () => {
    const w = monde(), p = w.player;
    p.level = 30;
    p.bag.push(rollItem(PIOUTE, ITEMS.equipment[PIOUTE], 'commun', w.rng, 999)); p.equip(999);
    const id = Object.keys(ITEMS.equipment).find(k => !ITEMS.equipment[k].familier)!;
    w.drops.push({ uid: 5000, x: p.x + 200, y: p.y, t: 1, item: rollItem(id, ITEMS.equipment[id], 'epique', w.rng, 5001) });
    w.drops.push({ uid: 5002, x: p.x - 180, y: p.y + 40, t: 1, kamas: 12 });
    const k = p.kamas, n = p.bag.length;
    for (let i = 0; i < 240; i++) w.step(1 / 60, NO_INPUT);
    expect(w.familier).not.toBeNull();
    expect(p.bag.length).toBe(n + 1);
    expect(p.kamas).toBe(k + 12);
    expect(Math.hypot(w.familier!.x - p.x, w.familier!.y - p.y)).toBeLessThan(80);
  });
});
