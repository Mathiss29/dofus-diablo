import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import icones from '../src/data/icones_objets.json';

// Au-delà de 4096 px, les GPU des téléphones et consoles Android (AYN Thor, 2026-11-16) affichent la texture en carré noir.
const MAX = 4096;

describe('textures lisibles sur mobile', () => {
  it('planche des icônes d\'objets (butin au sol, récoltes, PNJ) : 4096 px au plus', () => {
    expect(icones.cols * icones.cell).toBeLessThanOrEqual(MAX);
    expect(icones.rows * icones.cell).toBeLessThanOrEqual(MAX);
    expect(icones.cols * icones.rows).toBeGreaterThanOrEqual(Object.keys(icones.icons).length);
  });
  it('planches des monstres, PNJ et persos : 4096 px au plus', () => {
    const trop: string[] = [];
    for (const f of readdirSync('public/assets/sprites').filter(f => f.endsWith('.json'))) {
      const d = JSON.parse(readFileSync(`public/assets/sprites/${f}`, 'utf8')) as { textures?: { image: string; size: { w: number; h: number } }[] };
      for (const t of d.textures ?? []) if (Math.max(t.size.w, t.size.h) > MAX) trop.push(t.image);
    }
    expect(trop).toEqual([]);
  });
});
