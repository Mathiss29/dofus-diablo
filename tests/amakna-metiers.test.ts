import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS, RECOLTES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { World } from '../src/sim/world';

const AS = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const monde = (test: boolean) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(AS), seed: 3, items: ITEMS, recoltes: RECOLTES,
  ...(test ? { test: {} as never } : {}) });

describe('récoltes et ateliers d’Amakna (« 0.4 suite : 12A+12C »)', () => {
  it('12A : les ressources officielles des cartes d’Amakna, en partie de test seulement', () => {
    const t = monde(true), wg = t.worldGrid!;
    const amk = t.recoltes.filter(r => wg.mapByTag(r.tag)?.essai);
    expect(amk.length).toBeGreaterThan(3000);
    // chaque ressource a son objet (icône, nom) et son métier
    for (const r of amk) expect(ITEMS.resources[r.item], r.item).toBeDefined();
    // les rivières d'Amakna donnent leurs poissons officiels (Brochet, Anguille, Carpe d'Iem)
    for (const p of ['1847', '16461', '1794']) expect(amk.some(r => r.item === p), p).toBe(true);
    const pub = monde(false), wp = pub.worldGrid!;
    expect(pub.recoltes.some(r => wp.mapByTag(r.tag)?.essai)).toBe(false);
  });
  it('12C : les ateliers du Château d’Amakna couvrent tous les métiers, en partie de test seulement', () => {
    const t = monde(true);
    const ch = t.postes.filter(p => p.tag.startsWith('chateau_'));
    const tous = new Set(ch.flatMap(p => p.metiers));
    for (const m of Object.keys(ITEMS.metiers ?? {})) expect(tous.has(m), m).toBe(true);
    expect(monde(false).postes.some(p => p.tag.startsWith('chateau_'))).toBe(false);
  });
});
