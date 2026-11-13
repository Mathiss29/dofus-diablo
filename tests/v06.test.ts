import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';
import { coefChanceQuiMonte, raretes } from '../src/sim/butin';
import { World } from '../src/sim/world';

const AS = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const VIDE = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (test = true, seed = 3) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(AS), seed, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
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
