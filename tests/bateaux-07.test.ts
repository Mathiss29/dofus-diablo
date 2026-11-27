import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import type { EtatQuetes } from '../src/sim/quests';
import { World } from '../src/sim/world';
import { PNJ_LOOKS } from '../src/render/looks';
import VOYAGE from '../src/data/voyage.json';

const AS = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const VIDE: EtatQuetes = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (test = true) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(AS), seed: 5, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  reprise: VIDE, sansGroupes: true, ...(test ? { test: {} as never } : {}) });

function marcherPorte(w: World, nom: string, bout = 0) {
  const e = w.portes.find(p => p.nom === nom)!.ends[bout];
  w.player.x = e.x + 60; w.player.y = e.y; (w as unknown as { portalLock: unknown }).portalLock = null;
  for (let i = 0; i < 120 && !w.passage; i++) w.step(1 / 60, { ...NO_INPUT, dest: { x: e.x, y: e.y } });
  return !!w.passage;
}
function parler(w: World, pnj: string) {
  const q = w.quetes!, n = q.pnjs.find(x => x.id === pnj)!;
  w.player.x = n.x + 50; w.player.y = n.y + 20; q.cliquer(pnj);
  for (let i = 0; i < 300 && !q.dialogue; i++) w.step(1 / 60, NO_INPUT);
  return q.dialogue;
}

// « 0.7 : » 2A+2B+2C : bateau d'Otomaï depuis la côte (Sufokia), de Pandala depuis Madrestam, une courte quête chacun, un Zaap par île
const BATEAUX = [
  { nom: "Bateau pour l'île d'Otomaï", pnj: 'marin_otomai', quete: 'otomai_passage', depart: '15_28', sz: 11, monstre: 'cochon_de_farle', voyage: ['sufokia', 'otomai'], zaap: 'Zaap Village côtier' },
  { nom: "Bateau pour l'île de Pandala", pnj: 'passeur_pandala', quete: 'pandala_passage', depart: '10_-5', sz: 315, monstre: 'dragoss_charbon', voyage: ['madrestam', 'pandala'], zaap: 'Zaap Village de Pandala' },
];

describe('bateaux de la 0.7 (Otomaï, Pandala) : quête courte, écran de voyage, Zaap sur l\'île', () => {
  for (const b of BATEAUX) it(b.nom, () => {
    const w = monde(), q = w.quetes!, p = w.player, wg = w.worldGrid!;
    p.level = 100; p.recompute();
    expect(p.v07).toBe(true);
    const n = q.pnjs.find(x => x.id === b.pnj)!;
    expect(n, 'PNJ placé').toBeDefined();
    expect(n.tag).toBe(b.depart);
    expect(PNJ_LOOKS[QUETES.pnj[b.pnj].sprite!]).toBeDefined();
    expect(marcherPorte(w, b.nom)).toBe(false);   // fermé avant la quête
    const d = parler(w, b.pnj)!;
    expect(d?.quete).toBe(b.quete);
    q.repondre(d.reponses.findIndex(r => r.a === 'accepter'));
    const carte = AS.maps.find(m => m.sub === b.sz && !m.inside)!, ici = wg.cellToWorld(wg.cellOf(carte.tag, 300));
    for (let i = 0; i < 25; i++) { const m = w.spawnMonster(b.monstre, ici.x, ici.y); m.hp = 0; w.killMonster(m); }
    w.step(1 / 60, NO_INPUT);
    expect(q.enCours.find(x => x.id === b.quete)!.etape).toBe(1);
    q.repondre(-1);
    parler(w, b.pnj); q.repondre(-1);
    if (!q.finies.has(b.quete)) { parler(w, b.pnj); q.repondre(-1); }
    expect(q.finies.has(b.quete)).toBe(true);
    const po = w.zone.open!.portes!.find(x => x.nom === b.nom)!;
    expect(po.voyage).toEqual(b.voyage);
    for (const z of po.voyage!) expect((VOYAGE.zones as Record<string, unknown>)[z], z).toBeDefined();
    expect(marcherPorte(w, b.nom)).toBe(true);
    for (let i = 0; i < 120 && w.passage; i++) w.step(1 / 60, NO_INPUT);
    expect(wg.mapAt(p.x, p.y)?.tag).toBe(po.b[0]);
    expect(w.map.walkable(p.x, p.y)).toBe(true);
    expect(w.zone.open!.checkpoints.some(c => c.name === b.zaap), b.zaap).toBe(true);
    // retour sur le continent
    expect(marcherPorte(w, b.nom, 1)).toBe(true);
    for (let i = 0; i < 120 && w.passage; i++) w.step(1 / 60, NO_INPUT);
    expect(wg.mapAt(p.x, p.y)?.tag).toBe(b.depart);
  });

  it('hors partie de test, tant que la 0.7 est cachée : ni bateau, ni PNJ, ni Zaap des îles', () => {
    const w = monde(false);
    if (w.player.v07) return;
    for (const b of BATEAUX) {
      expect(w.portes.some(p => p.nom === b.nom)).toBe(false);
      expect(w.quetes!.pnjs.some(n => n.id === b.pnj)).toBe(false);
      expect(w.zone.open!.checkpoints.some(c => c.name === b.zaap)).toBe(false);
    }
  });
});
