import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { regions } from '../src/sim/renommee';
import { World } from '../src/sim/world';

const AS = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const VIDE = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = () => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(AS), seed: 5, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  reprise: VIDE, sansGroupes: true, test: {} as never });

describe('0.6 (25B) : succès « Maître de la tranche »', () => {
  it('les cinq donjons 60-90 et le palier 2 de renommée dans leurs cinq régions ; titre et ornement (aura)', () => {
    const S = QUETES.succes.maitre_tranche_60_90, w = monde(), q = w.quetes!, p = w.player, R = regions(w);
    expect(S.recompense?.titre).toBe('Maître de la tranche');
    expect(S.recompense?.ornement?.id).toBe(900);
    const donjons = S.objectifs.filter(o => 'donjon' in o).map(o => (o as { donjon: string }).donjon);
    for (const d of donjons) expect(w.zone.open!.donjons!.some(x => x.nom === d), d).toBe(true);
    expect(donjons.length).toBe(5);
    const rg = S.objectifs.filter(o => 'renommee' in o) as ({ nom: string; renommee: string; palier: number })[];
    for (const o of rg) expect(R.has(o.renommee), o.renommee).toBe(true);
    expect(S.objectifs.every(o => q.objectifSuccesFait(o))).toBe(false);
    for (const d of donjons) q.donjons[d] = { v: 1, m: 0 };
    for (const o of rg) p.renommee[o.renommee] = 1;
    expect(S.objectifs.every(o => q.objectifSuccesFait(o))).toBe(false);
    expect(q.progres(rg[0])).toEqual([1, 2]);
    for (const o of rg) p.renommee[o.renommee] = 2;
    expect(S.objectifs.every(o => q.objectifSuccesFait(o))).toBe(true);
  });
});
