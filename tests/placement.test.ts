import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA } from '../src/sim/data';
import { MAP_COLS, MAP_ROWS, WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { PLACEMENT, caseLocale, type PlacementCarte } from '../src/sim/placement';
import { REGLAGES_TEST } from '../src/sim/outilsTest';
import { World } from '../src/sim/world';

/** Maquette « Monstres » (Mathis, 2026-11-07) : 1A+1C 2A 3A 4A+4D 5B 6A 7A. */
const lireMonde = (z: string) => JSON.parse(readFileSync(new URL(`../public/assets/mondes/${z}/monde.json`, import.meta.url), 'utf8')) as WorldData;
const incarnam = lireMonde('incarnam'), astrub = lireMonde('astrub');
const nouveau = (z: string, placements?: Record<string, PlacementCarte>, seed = 4) =>
  new World({ data: GAME_DATA, zone: z, map: new WorldGrid(z === 'astrub' ? astrub : incarnam), seed, placements, test: { ...REGLAGES_TEST } });
const surCarte = (w: World, tag: string) => w.monsters.filter(m => !m.dead && w.worldGrid!.mapAt(m.homeX, m.homeY)?.tag === tag);
const STEP = 1 / 60;

describe('placement des groupes de monstres', () => {
  const w = nouveau('incarnam'), wg = w.worldGrid!;
  it('1C + 3A : chaque carte à monstres a une proposition automatique, toujours la même, avec plus de points que de groupes (5B)', () => {
    const cartes = w.cartesAGroupes();
    expect(cartes.length).toBeGreaterThan(40);
    for (const t of cartes) {
      const pl = w.placementDe(t)!;
      expect(pl.p.length, t).toBeGreaterThanOrEqual(pl.g);
      for (const p of pl.p) expect(wg.data.mov[wg.cellOf(t, p.c)], t).toBe('1');
    }
    const autre = nouveau('incarnam', undefined, 99);
    for (const t of cartes) expect(autre.placementDe(t)).toEqual(w.placementDe(t));
  });
  it('1C : la proposition laisse libres les passages entre les sorties de la carte, ses portes et ses PNJ', () => {
    let pts = 0, surPassage = 0;
    for (const t of w.cartesAGroupes()) {
      const a = w.analyseCarte(t), pas = new Set(a.passages);
      for (const p of w.placementDe(t)!.p.slice(0, w.placementDe(t)!.g)) { pts++; if (pas.has(wg.cellOf(t, p.c))) surPassage++; }
    }
    expect(surPassage / pts).toBeLessThan(0.05);
  });
  it('1A + 6A : une carte posée à la main prend ses points (et 0 groupe la vide), les autres gardent le placement automatique', () => {
    const [t1, t2] = w.cartesAGroupes().filter(t => !wg.mapByTag(t)!.inside && !t.startsWith('temple'));
    const libres = wg.freeByMap.get(t1)!, c = caseLocale(wg, t1, libres[Math.floor(libres.length / 2)]);
    const v = nouveau('incarnam', { [t1]: { g: 1, p: [{ c, n: [7, 7] }] }, [t2]: { g: 0, p: [] } });
    const ici = surCarte(v, t1);
    expect(ici).toHaveLength(7);   // 4A : taille du point
    const q = wg.cellToWorld(wg.cellOf(t1, c)), chef = ici.find(m => Math.hypot(m.homeX - q.x, m.homeY - q.y) < 1);
    expect(chef).toBeDefined();
    expect(surCarte(v, t2)).toHaveLength(0);
    expect(v.placementPoseMain(t1)).toBe(true);
  });
  it('5B : un groupe vaincu revient sur un point libre, jamais sur celui d\'un autre groupe en vie', () => {
    const t = w.cartesAGroupes().find(x => !wg.mapByTag(x)!.inside && !x.startsWith('temple'))!;
    const libres = wg.freeByMap.get(t)!, pts = [0.2, 0.5, 0.8].map(f => caseLocale(wg, t, libres[Math.floor(libres.length * f)]));
    const v = nouveau('incarnam', { [t]: { g: 2, p: pts.map(c => ({ c, n: [2, 2] as [number, number] })) } });
    const chefs = () => surCarte(v, t).filter(m => pts.some(c => { const q = wg.cellToWorld(wg.cellOf(t, c)); return Math.hypot(m.homeX - q.x, m.homeY - q.y) < 1; }));
    for (let essai = 0; essai < 6; essai++) {
      const [a, b] = chefs();
      expect(a && b).toBeTruthy();
      expect(Math.hypot(a.homeX - b.homeX, a.homeY - b.homeY)).toBeGreaterThan(1);
      // on vide le groupe de a, on s'éloigne, il revient ailleurs que sur b
      for (const m of v.monsters.filter(o => o.group === a.group)) v.hitCircle(m.x, m.y, 1, { dmg: 99999, knock: 0 });
      const p = v.player, ici = wg.mapByTag(t)!, loin = wg.world.maps.filter(m => !m.inside && !m.n).sort((x, y) => Math.hypot(y.x - ici.x, y.y - ici.y) - Math.hypot(x.x - ici.x, x.y - ici.y))[0];
      const q = wg.cellToWorld(wg.freeByMap.get(loin.tag)![0]);
      p.x = q.x; p.y = q.y;
      for (let i = 0; i < 60 * 27; i++) v.step(STEP, NO_INPUT);
    }
  });
  it('2A : l\'éditeur (F1) repose la carte tout de suite, et revient au placement d\'origine', () => {
    const v = nouveau('incarnam'), t = v.cartesAGroupes().find(x => !wg.mapByTag(x)!.inside && !x.startsWith('temple'))!;
    const avant = v.placementDe(t), c = v.placementDe(t)!.p[0].c;
    v.step(STEP, { ...NO_INPUT, test: [{ k: 'placement', tag: t, pl: { g: 1, p: [{ c, n: [9, 9] }] } }] });
    expect(surCarte(v, t)).toHaveLength(9);
    expect(v.placementPoseMain(t)).toBe(true);
    v.step(STEP, { ...NO_INPUT, test: [{ k: 'placement', tag: t, pl: null }] });
    expect(v.placementDe(t)).toEqual(avant);
    expect(v.placementPoseMain(t)).toBe(false);
  });
});

describe('repaire d\'élite (4D)', () => {
  it('sur son repaire, l\'élite de la sous-zone mène souvent le groupe ; une seule élite en vie à la fois', () => {
    const wgA = new WorldGrid(astrub), sub = Object.entries(GAME_DATA.zones.astrub.open!.subareas).find(([, s]) => s.elite && s.groupsPerMap >= 1)!;
    const t = astrub.maps.find(m => String(m.sub) === sub[0] && !m.inside && wgA.freeByMap.get(m.tag)!.length > 200)!.tag;
    const libres = wgA.freeByMap.get(t)!, c = caseLocale(wgA, t, libres[Math.floor(libres.length / 2)]);
    const garde = { ...PLACEMENT.elite };
    try {
      PLACEMENT.elite.repaire = 1; PLACEMENT.elite.hasard = 0;
      const v = nouveau('astrub', { [t]: { g: 1, p: [{ c, r: 1 }] } });
      const elites = v.monsters.filter(m => !m.dead && m.type === sub[1].elite);
      expect(elites).toHaveLength(1);
      const q = wgA.cellToWorld(wgA.cellOf(t, c));
      expect(Math.hypot(elites[0].homeX - q.x, elites[0].homeY - q.y)).toBeLessThan(1);
    } finally { Object.assign(PLACEMENT.elite, garde); }
  });
});

describe('src/data/placements.json', () => {
  it('chaque point posé à la main est une case marchable de sa carte, 0 à 4 groupes, un seul repaire par carte', () => {
    for (const [monde, cartes] of Object.entries(PLACEMENT.cartes)) {
      const data = monde === 'astrub' ? astrub : monde === 'incarnam' ? incarnam : null;
      if (!data) { expect(Object.keys(cartes), monde).toHaveLength(0); continue; }
      const g = new WorldGrid(data);
      for (const [tag, pl] of Object.entries(cartes)) {
        expect(g.mapByTag(tag), `${monde} ${tag}`).toBeDefined();
        expect(pl.g).toBeGreaterThanOrEqual(0); expect(pl.g).toBeLessThanOrEqual(4);
        expect(pl.p.filter(p => p.r).length).toBeLessThanOrEqual(1);
        for (const p of pl.p) {
          expect(p.c >= 0 && p.c < MAP_COLS * MAP_ROWS, `${tag} ${p.c}`).toBe(true);
          expect(g.data.mov[g.cellOf(tag, p.c)], `${tag} case ${p.c} dans un mur`).toBe('1');
        }
      }
    }
  });
});
