import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';
import { LOOKS } from '../src/render/looks';

const lire = (w: string) => JSON.parse(readFileSync(new URL(`../public/assets/mondes/${w}/monde.json`, import.meta.url), 'utf8')) as WorldData;
const astrub = lire('astrub'), incarnam = lire('incarnam');
const zone = GAME_DATA.zones.astrub.open!;

/** Clique sur le portail de zone de ce monde et avance jusqu'à l'événement changeZone. */
function passerPortail(w: World) {
  const po = w.portes.find(p => p.vers)!;
  w.player.x = po.ends[0].x + 40; w.player.y = po.ends[0].y;
  for (let i = 0; i < 120; i++) {
    w.step(1 / 60, { ...NO_INPUT, dest: { x: po.ends[0].x, y: po.ends[0].y } });
    const e = w.drainEvents().find(e => e.k === 'changeZone');
    if (e && e.k === 'changeZone') return e;
  }
  return null;
}

describe('Astrub (0.2a)', () => {
  it('359 cartes du dehors, chacune avec des cases marchables', () => {
    const wg = new WorldGrid(astrub);
    expect(astrub.maps.filter(m => !m.inside).length).toBe(359);
    for (const m of astrub.maps) expect(wg.freeByMap.get(m.tag)!.length, m.tag).toBeGreaterThan(20);
  });
  it('chaque monstre des sous-zones a ses données officielles et sa planche', () => {
    for (const [id, s] of Object.entries(zone.subareas)) {
      expect(astrub.maps.some(m => String(m.sub) === id), id).toBe(true);
      for (const t of [...s.monsters, ...(s.elite ? [s.elite] : [])]) {
        expect(GAME_DATA.monsters[t]?.dofusId, t).toBeDefined();
        expect(LOOKS[GAME_DATA.monsters[t].look], t).toBeDefined();
      }
    }
  });
  it('carte du monde et points d\'intérêt officiels (Zaap, banque, donjons…)', () => {
    expect(astrub.carte).toBeDefined();
    const noms = astrub.reperes!.map(r => r.n);
    for (const n of ['Zaap', 'Banque', 'Portail vers Incarnam', 'Grange du Tournesol Affamé']) expect(noms).toContain(n);
  });
  it('portail Incarnam [4,-3] -> Astrub [6,-19], et retour', () => {
    const w1 = new World({ data: GAME_DATA, zone: 'incarnam', map: new WorldGrid(incarnam), seed: 1 });
    const aller = passerPortail(w1);
    expect(aller).toMatchObject({ zone: 'astrub', arrivee: ['6_-19', 326] });
    const w2 = new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 1, arrivee: aller!.arrivee });
    expect(w2.worldGrid!.mapAt(w2.player.x, w2.player.y)?.tag).toBe('6_-19');
    // on arrive à côté du portail, pas dessus : il ne renvoie pas tout de suite à Incarnam
    for (let i = 0; i < 60; i++) w2.step(1 / 60, NO_INPUT);
    expect(w2.drainEvents().some(e => e.k === 'changeZone')).toBe(false);
    const retour = passerPortail(w2);
    expect(retour).toMatchObject({ zone: 'incarnam', arrivee: ['4_-3', 174] });
  });
  it('trois donjons : salles exportées, monstres officiels, portes verrouillées de salle en salle', () => {
    const w = new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 1 });
    for (const d of zone.donjons!) {
      for (const [tag, groupes] of Object.entries(d.salles)) {
        expect(w.worldGrid!.mapByTag(tag), tag).toBeDefined();
        for (const g of groupes) for (const t of g) expect(LOOKS[GAME_DATA.monsters[t]?.look], t).toBeDefined();
        expect((w as unknown as { groups: { map: string }[] }).groups.filter(g => g.map === tag).length, tag).toBe(groupes.length);
      }
      expect(w.portes.filter(p => p.nom === d.nom).length).toBeGreaterThan(Object.keys(d.salles).length - 1);
    }
  });
});
