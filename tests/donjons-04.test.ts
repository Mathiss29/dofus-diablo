import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { World } from '../src/sim/world';

const AS = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const VIDE = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (test: boolean) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(AS), seed: 2, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  reprise: VIDE, sansGroupes: true, ...(test ? { test: {} as never } : {}) });
const DONJONS = ['Donjon des Scarafeuilles', 'Donjon des Squelettes', 'Donjon des Tofus', 'Akadémie des Gobs', 'Donjon des Bworks', 'Donjon des Forgerons',
  'Nid du Kwakwa', 'Donjon des Larves', 'Pitons Rocheux des Craqueleurs'];

describe('donjons d’Amakna aux vraies entrées (« 0.4 suite : 5A+5D »)', () => {
  it('5A : une porte sur la carte d’entrée officielle mène à l’arrivée de l’arène, ouvert à tous depuis la 0.4', () => {
    const w = monde(true), wg = w.worldGrid!;
    for (const nom of DONJONS) {
      const po = w.portes.find(p => p.nom === nom), dj = w.zone.open!.donjons!.find(d => d.nom === nom)!;
      expect(po, nom).toBeDefined();
      expect(wg.mapByTag(po!.ends[0].tag)?.essai, nom).toBeTruthy();
      // en couloirs (5B) : la porte mène à la première vraie salle ; sinon droit à l'arène
      expect(po!.ends[1].tag).toBe(dj.couloirs?.salles[0] ?? dj.arene!.tag);
      expect(w.map.walkable(po!.ends[0].x, po!.ends[0].y), nom).toBe(true);
    }
    expect(monde(false).portes.filter(p => DONJONS.includes(p.nom)).length).toBeGreaterThanOrEqual(DONJONS.length);   // 0.4 publique
  });
  it('5D : les clés officielles, vendues par Goultard au Bastion, seulement quand la 0.4 est visible', () => {
    for (const nom of DONJONS) {
      const cle = Object.entries(ITEMS.resources).find(([, r]) => (r as { cle?: string }).cle === nom)?.[0];
      expect(cle, nom).toBeDefined();
      expect(BOUTIQUES.goultard.some(a => a.id === cle)).toBe(true);
    }
    const id = BOUTIQUES.goultard.find(a => a.v04)!.id;
    const t = monde(true); t.player.kamas = 99999;
    expect(t.acheter('goultard', id)).toBe(true);
    const pub = monde(false); pub.player.kamas = 99999;
    if (!pub.player.v04) expect(pub.acheter('goultard', id)).toBe(false);
  });

  it('5B : 10 donjons en couloirs, de la première salle à l’arène du boss en marchant, ouvert à tous depuis la 0.4', () => {
    const w = monde(true), wg = w.worldGrid!;
    const enCouloirs = w.zone.open!.donjons!.filter(d => d.couloirs && !d.couloirs.salles[0].startsWith('grange') && w.couloirs(d));
    expect(enCouloirs.length).toBeGreaterThanOrEqual(10);
    let relies = 0;
    for (const d of enCouloirs) {
      const po = w.portes.find(p => p.nom === d.nom && p.ends[1].tag === d.couloirs!.salles[0]);
      if (!po) continue;   // îles des Wabbits : leurs entrées viendront avec l'île (0.4 suite : 10A)
      relies++;
      const depart = wg.cellAtWorld(po!.ends[1].x, po!.ends[1].y), but = d.arene!.arrivee;
      const vu = new Set([depart]); let front = [depart];
      while (front.length && !vu.has(but)) { const n: number[] = []; for (const c of front) for (const v of wg.neighbors(c)) if (!vu.has(v)) { vu.add(v); n.push(v); } front = n; }
      expect(vu.has(but), d.nom).toBe(true);
      expect(Object.keys(d.salles), d.nom).toEqual(d.couloirs!.salles);
    }
    expect(relies).toBeGreaterThanOrEqual(8);
    expect(monde(false).zone.open!.donjons!.some(d => d.couloirs?.salles[0]?.startsWith('scarafeuilles'))).toBe(true);   // 0.4 publique
  });
});

describe('donjons en couloirs : jamais hors carte', () => {
  it('chaque case de couloir (Grange d’Astrub, donjons d’Amakna) est dans une carte du donjon : sinon écran noir en marchant', () => {
    const wg = new WorldGrid(AS), o = GAME_DATA.zones.astrub.open!;
    for (const d of [...(o.donjons ?? []), ...(o.donjonsTest ?? [])]) {
      const c = d.couloirs;
      if (!c) continue;
      const du = new Set([...c.tags, ...c.salles, d.arene!.tag]);
      const hors = c.cases.filter(x => !du.has(wg.mapOfCell(x)?.tag ?? ''));
      expect(hors.length, `${d.nom} : ${hors.length} cases hors du donjon`).toBe(0);
    }
  });
});
