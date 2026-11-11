import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';

// Donjons en couloirs (maquette « Couloirs : 1C 2B 3A 4A », tools/extraction/couloirs.py) : partie de test seulement.
const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const vide = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (test: boolean) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 3, items: ITEMS, quetes: QUETES,
  boutiques: BOUTIQUES, reprise: vide, ...(test ? { test: {} as never } : {}) });
const G = (w: World) => (w as unknown as { groups: { map: string; members: { type: string }[] }[] }).groups;
const NOM = 'Grange du Tournesol Affamé';

describe('donjons en couloirs (Couloirs : 1C 2B 3A 4A)', () => {
  it('partie normale (0.4 publique, 2026-11-11) : les couloirs sont ouverts à tous, comme en partie de test', () => {
    const w = monde(false), po = w.entreeDonjon(NOM)!;
    expect(po.ends[1].tag).toBe('grange_0');
    for (const t of ['couloir_grange_1', 'couloir_grange_4']) expect(w.worldGrid!.freeByMap.get(t)!.length).toBeGreaterThan(0);
  });
  it('partie de test : antichambre, puis les salles reliées à pied par les couloirs jusqu\'à l\'arène', () => {
    const w = monde(true), wg = w.worldGrid!, d = w.zone.open!.donjons!.find(x => x.nom === NOM)!, cl = w.couloirs(d)!;
    expect(cl.salles).toEqual(['grange_1', 'grange_2', 'grange_3', 'grange_4']);
    expect(w.entreeDonjon(NOM)!.ends[1].tag).toBe('grange_0');
    expect(w.portes.some(p => p.ends[0].tag === 'grange_0' && p.ends[1].tag === 'grange_1')).toBe(true);
    // plus aucune porte entre les salles du trajet (on marche par les couloirs)
    expect(w.portes.some(p => cl.salles.includes(p.ends[0].tag) && p.ends[1].tag !== 'grange_0')).toBe(false);
    // chemin à pied : de la salle 1 à l'arrivée de l'arène
    const libre = new Set(wg.free), depart = wg.freeByMap.get('grange_1')![0], but = d.arene!.arrivee;
    const vu = new Set([depart]), file = [depart];
    for (let i = 0; i < file.length && !vu.has(but); i++) for (const v of wg.neighbors(file[i])) if (libre.has(v) && !vu.has(v)) { vu.add(v); file.push(v); }
    expect(vu.has(but)).toBe(true);
    for (const t of cl.tags) expect(w.lieux.get(t)).toBe(NOM);
  });
  it('groupes officiels dans les salles, monstres seuls dans les couloirs (2B), boss seulement dans l\'arène', () => {
    const w = monde(true), d = w.zone.open!.donjons!.find(x => x.nom === NOM)!, cl = w.couloirs(d)!, M = GAME_DATA.monsters;
    for (const t of cl.salles) expect(G(w).filter(g => g.map === t).length).toBe(d.salles[t].length);
    for (const t of cl.tags) {
      const gs = G(w).filter(g => g.map === t);
      expect(gs.length).toBe(cl.annexes?.includes(t) ? 0 : cl.nErrants);   // petites cartes sous le creux du couloir : vides
      for (const g of gs) { expect(g.members.length).toBe(1); expect(M[g.members[0].type].boss).toBeFalsy(); }
    }
    expect(G(w).some(g => g.map === 'grange_5')).toBe(false);
  });
  it('les vagues partent en entrant dans l\'arène ; revenir dans un couloir ne la vide pas, sortir du donjon si', () => {
    const w = monde(true), wg = w.worldGrid!, d = w.zone.open!.donjons!.find(x => x.nom === NOM)!, p = w.player;
    const c = wg.freeByMap.get('couloir_grange_1')![0], q = wg.cellToWorld(c);
    p.x = q.x; p.y = q.y; w.step(1 / 60, NO_INPUT);
    expect(w.arene).toBeNull();
    const a = wg.cellToWorld(d.arene!.arrivee); p.x = a.x; p.y = a.y; w.step(1 / 60, NO_INPUT);
    expect(w.arene?.nom).toBe(NOM);
    const k = wg.cellToWorld(wg.freeByMap.get('couloir_grange_4')![0]); p.x = k.x; p.y = k.y; w.step(1 / 60, NO_INPUT);
    expect(w.arene).not.toBeNull();
    const dehors = w.entreeDonjon(NOM)!.ends[0]; p.x = dehors.x; p.y = dehors.y + 120; w.step(1 / 60, NO_INPUT);
    expect(w.arene).toBeNull();
  });
});
