import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { World } from '../src/sim/world';
import { PEPITE } from '../src/sim/items';

const AS = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const VIDE = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (test: boolean) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(AS), seed: 2, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  reprise: VIDE, sansGroupes: true, ...(test ? { test: {} as never } : {}) });
const DONJONS = ['Donjon des Scarafeuilles', 'Donjon des Squelettes', 'Donjon des Tofus', 'Akadémie des Gobs', 'Donjon des Bworks', 'Donjon des Forgerons',
  'Nid du Kwakwa', 'Donjon des Larves', 'Pitons Rocheux des Craqueleurs'];

describe('donjons d’Amakna aux vraies entrées (« 0.4 suite : 5A+5D »)', () => {
  it('5A : une porte sur la carte d’entrée officielle mène à l’arrivée de l’arène, en partie de test seulement', () => {
    const w = monde(true), wg = w.worldGrid!;
    for (const nom of DONJONS) {
      const po = w.portes.find(p => p.nom === nom), dj = w.zone.open!.donjons!.find(d => d.nom === nom)!;
      expect(po, nom).toBeDefined();
      expect(wg.mapByTag(po!.ends[0].tag)?.essai, nom).toBeTruthy();
      expect(po!.ends[1].tag).toBe(dj.arene!.tag);
      expect(w.map.walkable(po!.ends[0].x, po!.ends[0].y), nom).toBe(true);
    }
    expect(monde(false).portes.filter(p => DONJONS.includes(p.nom))).toHaveLength(0);
  });
  it('5D : les clés officielles, vendues par Goultard au Bastion, seulement quand la 0.4 est visible', () => {
    for (const nom of DONJONS) {
      const cle = Object.entries(ITEMS.resources).find(([, r]) => (r as { cle?: string }).cle === nom)?.[0];
      expect(cle, nom).toBeDefined();
      expect(BOUTIQUES.goultard.some(a => a.id === cle)).toBe(true);
    }
    const id = BOUTIQUES.goultard.find(a => a.v04)!.id;
    const t = monde(true); t.player.resources[PEPITE] = 99999;
    expect(t.acheter('goultard', id)).toBe(true);
    const pub = monde(false); pub.player.resources[PEPITE] = 99999;
    if (!pub.player.v04) expect(pub.acheter('goultard', id)).toBe(false);
  });
});
