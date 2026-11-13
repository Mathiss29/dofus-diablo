import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';
import { LOOKS } from '../src/render/looks';

const AS = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const VIDE = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (test: boolean) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(AS), seed: 2, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  reprise: VIDE, sansGroupes: true, ...(test ? { test: {} as never } : {}) });
const DONJONS = ['Clos des Blops', 'Épreuve de Draegnerys', 'Antre de la Reine Nyée', 'Domaine Ancestral', 'Labyrinthe du Dragon Cochon'];

describe('arènes de la 0.6 (maquette « Arènes : 1A 2D 3A 4A+4C 5B 6B+6C 7A 8A+8B 9A+9C 10A+10C 11A »)', () => {
  it('cinq donjons en partie de test : une porte du dehors mène à l’arrivée de l’arène ; cachés en partie publique', () => {
    const w = monde(true), wg = w.worldGrid!;
    for (const nom of DONJONS) {
      const dj = w.zone.open!.donjons!.find(d => d.nom === nom), po = w.portes.find(p => p.nom === nom);
      expect(dj, nom).toBeDefined(); expect(po, nom).toBeDefined();
      expect(po!.ends[1].tag).toBe(dj!.arene!.tag);
      expect(w.map.walkable(po!.ends[0].x, po!.ends[0].y), `${nom} : porte`).toBe(true);
      const A = dj!.arene!;
      for (const c of [A.arrivee, A.boss, A.sortie, A.coffre, ...A.entrees]) expect(wg.mov[c], `${nom} : case ${c}`).toBe(1);
    }
    const pub = monde(false);
    if (!pub.player.v06) {
      for (const nom of DONJONS) {
        expect(pub.zone.open!.donjons!.some(d => d.nom === nom), nom).toBe(false);
        expect(pub.portes.some(p => p.nom === nom), nom).toBe(false);
      }
    }
  });

  it('les monstres des vagues et les boss existent, avec leur planche ; les boss ont leur âme officielle', () => {
    const o = GAME_DATA.zones.astrub.open!;
    for (const d of o.donjonsV06 ?? []) {
      for (const m of [...d.vagues!.flatMap(v => v.m), ...d.bossVague!]) {
        expect(GAME_DATA.monsters[m], `${d.nom} : ${m}`).toBeDefined();
        expect(LOOKS[GAME_DATA.monsters[m].look ?? m], `${d.nom} : planche de ${m}`).toBeDefined();
      }
      expect(GAME_DATA.monsters[d.bossVague![0]].boss, d.nom).toBe(true);
      expect(GAME_DATA.monsters[d.bossVague![0]].ame, d.nom).toBeTruthy();
    }
    expect((o.donjonsV06 ?? []).map(d => d.nom).sort()).toEqual([...DONJONS].sort());
  });

  it('clés officielles chez Goultard, seulement quand la 0.6 est visible', () => {
    for (const nom of DONJONS) {
      const cle = Object.entries(ITEMS.resources).find(([, r]) => (r as { cle?: string }).cle === nom)?.[0];
      expect(cle, nom).toBeDefined();
      expect(BOUTIQUES.goultard.some(a => a.id === cle && a.v06), nom).toBe(true);
    }
    const id = BOUTIQUES.goultard.find(a => a.v06)!.id;
    const t = monde(true); t.player.kamas = 99999;
    expect(t.acheter('goultard', id)).toBe(true);
    const pub = monde(false); pub.player.kamas = 99999;
    if (!pub.player.v06) expect(pub.acheter('goultard', id)).toBe(false);
  });

  it('dans l’arène, les vagues partent et le Labyrinthe garde ses murs (cases bloquées entre les couloirs)', () => {
    const w = monde(true), wg = w.worldGrid!;
    w.player.level = 100; w.player.recompute();
    expect(w.allerArene('arene_dragon_cochon')).toBe(true);
    expect(w.arene?.d.nom).toBe('Labyrinthe du Dragon Cochon');
    for (let i = 0; i < 60 * 6; i++) w.step(1 / 60, NO_INPUT);
    expect(w.arene!.vague).toBeGreaterThanOrEqual(1);
    const m = AS.maps.find(x => x.tag === 'arene_dragon_cochon')!, s = AS.movCartes!['arene_dragon_cochon'];
    const libres = [...s].filter(c => c === '1').length;
    expect(libres).toBeGreaterThan(600);
    expect(libres).toBeLessThan(s.length * 0.6);   // murs, piliers et noir autour du dédale
    expect(m.v06).toBe(1);
    expect(wg.mapByTag('arene_dragon_cochon')).toBeDefined();
  });
});
