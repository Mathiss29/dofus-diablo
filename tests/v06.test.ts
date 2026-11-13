import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES, RECOLTES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';
import { coefChanceQuiMonte, raretes } from '../src/sim/butin';
import { World } from '../src/sim/world';

const AS = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const VIDE = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (test = true, seed = 3) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(AS), seed, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES, recoltes: RECOLTES,
  reprise: VIDE, ...(test ? { test: {} as never } : {}) });

describe('0.6 : courbe d\'XP, découverte, chance de boss qui monte', () => {
  it('cachée hors partie de test', () => {
    expect(monde().player.v06).toBe(true);
    expect(monde(false).player.v06).toBe(false);
  });

  it('24A : 2 % de Légendaire au 1er boss, puis +1 % par boss raté', () => {
    const base = raretes('boss'), leg = (c: number) => { const r = raretes('boss', 0, c); return r.legendaire + r.mythique; };
    expect(base.legendaire + base.mythique).toBeGreaterThan(0);
    expect(coefChanceQuiMonte(0)).toBe(1);
    expect(coefChanceQuiMonte(1)).toBeCloseTo(1.5);
    expect(leg(coefChanceQuiMonte(2)) / leg(1)).toBeCloseTo(2, 1);
  });

  it('24A : le compteur monte sans Légendaire, retombe à zéro quand il tombe, et se garde', () => {
    const w = monde(), p = w.player;
    const n = (w as unknown as { noterBossLeg(b: string, x: { objets: { rarity: string }[] }, e: boolean): void });
    n.noterBossLeg('bouftou_royal', { objets: [{ rarity: 'rare' }] }, true);
    n.noterBossLeg('bouftou_royal', { objets: [] }, true);
    expect(p.bossSansLeg.bouftou_royal).toBe(2);
    expect(w.contexteButin('bouftou_royal', 'boss', 30).legendaire).toBeCloseTo(2);
    const s = exporterJoueur(w), w2 = monde();
    restaurerJoueur(w2, s);
    expect(w2.player.bossSansLeg.bouftou_royal).toBe(2);
    n.noterBossLeg('bouftou_royal', { objets: [{ rarity: 'legendaire' }] }, false);
    expect(p.bossSansLeg.bouftou_royal).toBeUndefined();
  });

  it('6D : +50 % d\'XP sur une carte jamais chassée, une seule fois', () => {
    const w = monde(), p = w.player;
    const g = (w as unknown as { groups: { map: string; members: unknown[] }[] }).groups.find(x => x.members.length && /^-?\d+_-?\d+$/.test(x.map));
    expect(g).toBeDefined();
    const d = (w as unknown as { decouverte(q: typeof p, c: string, f: boolean): number });
    expect(d.decouverte(p, g!.map, false)).toBe(1.5);
    expect(d.decouverte(p, g!.map, true)).toBe(1.5);
    expect(d.decouverte(p, g!.map, false)).toBe(1);
    expect(w.drainEvents().some(e => e.k === 'decouverte')).toBe(true);
    const v = monde(false);
    expect((v as unknown as typeof d).decouverte(v.player, g!.map, false)).toBe(1);
  });
});

describe('0.6 : idoles (17-18)', () => {
  it('39 idoles, 9 familles, les 3 d\'ARPG ; recettes de récolte', async () => {
    const { IDOLES_DEFS, REGLES_IDOLES, recetteIdole } = await import('../src/sim/idoles');
    const { RECOLTES } = await import('../src/sim/data');
    expect(Object.keys(IDOLES_DEFS).length).toBe(39);
    expect(Object.keys(REGLES_IDOLES.familles).length).toBe(9);
    for (const id of ['zaihort', 'leukide', 'nahuatl']) expect(IDOLES_DEFS[id]).toBeDefined();
    for (const [id, I] of Object.entries(IDOLES_DEFS)) {
      expect(REGLES_IDOLES.familles[I.famille], id).toBeDefined();
      expect(recetteIdole(id, RECOLTES).length, id).toBe(3);
    }
  });

  it('une par famille, 6 au plus, seulement celles fabriquées ; score et bonus', async () => {
    const { basculerIdole, bonusIdoles, etatIdolesVide, scoreIdoles } = await import('../src/sim/idoles');
    const e = etatIdolesVide();
    expect(basculerIdole(e, 'hebdo')).toMatch(/Bricoleur/);
    e.possedees.push('hebdo', 'muta', 'dynamo', 'tynril', 'farle', 'nocturne', 'dokoko', 'bihilete');
    expect(basculerIdole(e, 'hebdo')).toBeNull();
    expect(basculerIdole(e, 'muta')).toBeNull();
    expect(e.actives).toEqual(['muta']);
    for (const id of ['dynamo', 'tynril', 'farle', 'nocturne', 'dokoko']) expect(basculerIdole(e, id)).toBeNull();
    expect(basculerIdole(e, 'bihilete')).toMatch(/6 idoles/);
    expect(scoreIdoles(e.actives)).toBe(25 + 10 + 10 + 15 + 15 + 15);
    expect(bonusIdoles(e.actives, false)).toBeCloseTo(0.45);
    expect(bonusIdoles(e.actives, true)).toBeCloseTo(0.3);
  });

  it('les monstres apparaissent plus forts ; XP et butin en plus ; gardées avec le perso', () => {
    const w = monde(), p = w.player;
    const sans = w.spawnMonster('bouftou', p.x + 60, p.y);
    p.idoles.possedees.push('walet', 'hurzz', 'dinam');
    for (const id of ['walet', 'hurzz', 'dinam']) expect(w.basculerIdole(id)).toBeNull();
    const avec = w.spawnMonster('bouftou', p.x + 80, p.y);
    expect(avec.maxHp).toBeGreaterThan(sans.maxHp * 1.5);
    expect(avec.def.dmg).toBeGreaterThan(sans.def.dmg * 1.5);
    expect(w.bonusIdoles).toBeCloseTo((40 + 40 + 30) * 0.005);
    expect(w.contexteButin('bouftou', 'normal', 10).prospection).toBeGreaterThan(p.prospection + 50);
    const w2 = monde();
    restaurerJoueur(w2, exporterJoueur(w));
    expect(w2.player.idoles.actives).toEqual(['walet', 'hurzz', 'dinam']);
    const v = monde(false);
    v.player.idoles.possedees.push('walet'); v.basculerIdole('walet');
    expect(v.fxIdoles).toBeNull();   // hors partie de test : rien ne change
  });

  it('fabriquée chez le Bricoleur avec ses ingrédients et le niveau', () => {
    const w = monde(), p = w.player;
    (w as unknown as { atelierIci(m: string): unknown }).atelierIci = () => ({});
    expect(w.fabriquerIdole('hebdo')).toMatch(/Bricoleur niveau/);
    p.metiers.bricoleur = { level: 30, xp: 0 } as never;
    expect(w.fabriquerIdole('hebdo')).toMatch(/Ingrédients/);
    for (const [x, q] of w.recetteIdole('hebdo')) p.resources[x] = q;
    expect(w.fabriquerIdole('hebdo')).toBeNull();
    expect(p.idoles.possedees).toContain('hebdo');
    expect(Object.keys(p.resources).length).toBe(0);
    expect(w.fabriquerIdole('hebdo')).toMatch(/Déjà/);
  });
});
