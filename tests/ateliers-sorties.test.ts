import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import zones from '../src/data/zones.json';

const lire = (m: string) => JSON.parse(readFileSync(new URL(`../public/assets/mondes/${m}/monde.json`, import.meta.url), 'utf8')) as WorldData;
/** Un pas de case dans le monde du jeu : deux cases qui se touchent par un côté sont à ce pas, par un coin à ce pas en x et en y. */
const PAS = 86 * 1.1 / 2;

type Open = { portes: { a: [string, number]; b: [string, number] }[]; ateliers?: { nom: string; postes?: [string, number, number, number, number][] }[] };

describe('ateliers écartés des sorties (Mathis, 2026-11-08 : « ne pas mettre d’atelier collé à la sortie »)', () => {
  for (const nom of ['incarnam', 'astrub'] as const) {
    it(`${nom} : aucune machine d’atelier sur une case voisine d’une sortie`, () => {
      const wg = new WorldGrid(lire(nom)), open = (zones as unknown as Record<string, { open: Open }>)[nom].open;
      const sorties = open.portes.flatMap(p => [p.a, p.b]).filter(([tag]) => wg.mapByTag(tag));
      let vues = 0;
      for (const a of open.ateliers ?? []) for (const [tag, c] of a.postes ?? []) {
        if (!wg.mapByTag(tag)) continue;
        const q = wg.cellToWorld(wg.cellOf(tag, c));
        for (const [t, s] of sorties) {
          if (t !== tag) continue;
          const e = wg.cellToWorld(wg.cellOf(t, s)), pas = Math.round(Math.max(Math.abs(q.x - e.x), Math.abs(q.y - e.y)) / PAS);
          expect(pas, `${a.nom} : machine case ${c}, sortie case ${s}`).toBeGreaterThanOrEqual(2);
          vues++;
        }
      }
      expect(vues).toBeGreaterThan(5);
    });
  }
  it('concasseur des mineurs et établis des bijoutiers : trois cases au moins entre la machine et le paillasson', () => {
    const wg = new WorldGrid(lire('astrub')), open = (zones as unknown as Record<string, { open: Open }>).astrub.open;
    const dist = (tag: string, c: number, s: number) => {
      const q = wg.cellToWorld(wg.cellOf(tag, c)), e = wg.cellToWorld(wg.cellOf(tag, s));
      return Math.round(Math.max(Math.abs(q.x - e.x), Math.abs(q.y - e.y)) / PAS);
    };
    const postes = (tag: string) => open.ateliers!.flatMap(a => a.postes ?? []).filter(p => p[0] === tag);
    for (const [tag, sortie] of [['atelier_mineurs', 497], ['atelier_bijoutiers', 495]] as const)
      expect(Math.min(...postes(tag).map(p => dist(tag, p[1], sortie))), tag).toBeGreaterThanOrEqual(3);
    // la case laissée par le concasseur redevient du plancher, celle où il est posé est bloquée
    const mov = (c: number) => wg.mov[wg.cellOf('atelier_mineurs', c)] === 1 ? '1' : '0';
    expect([mov(483), mov(454)]).toEqual(['1', '0']);
  });
});
