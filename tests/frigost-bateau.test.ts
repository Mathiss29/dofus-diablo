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

/** Marche droit sur la porte du bateau (côté Madrestam) ; vrai si le passage démarre. */
function marcherPorte(w: World) {
  const po = w.portes.find(p => p.nom === 'Bateau pour Frigost')!, e = po.ends[0];
  w.player.x = e.x + 60; w.player.y = e.y;
  for (let i = 0; i < 120 && !w.passage; i++) w.step(1 / 60, { ...NO_INPUT, dest: { x: e.x, y: e.y } });
  return !!w.passage;
}
/** Le perso marche jusqu'au PNJ et lui parle (clic). */
function parler(w: World, pnj: string) {
  const q = w.quetes!, n = q.pnjs.find(x => x.id === pnj)!;
  w.player.x = n.x + 50; w.player.y = n.y + 20; q.cliquer(pnj);
  for (let i = 0; i < 300 && !q.dialogue; i++) w.step(1 / 60, NO_INPUT);
  return q.dialogue;
}

describe('bateau de Frigost (0.6, 3D) : quête « Cap sur Frigost » de bout en bout', () => {
  it('porte fermée avant la quête ; 25 monstres des Plaines Rocheuses ; le marin fait embarquer ; arrivée à la Bourgade', () => {
    const w = monde(), q = w.quetes!, p = w.player;
    p.level = 80; p.recompute();
    expect(p.v06).toBe(true);
    // le marin est sur le port de Madrestam, dessiné
    const marin = q.pnjs.find(x => x.id === 'marin_madrestam')!;
    expect(marin, 'marin placé').toBeDefined();
    expect(marin.tag).toBe('9_-2');
    expect(PNJ_LOOKS[QUETES.pnj.marin_madrestam.sprite!], 'planche du marin').toBeDefined();
    // 1) sans la quête, le bateau ne part pas
    expect(marcherPorte(w)).toBe(false);
    expect(w.drainEvents().some(e => e.k === 'status' && /Cap sur Frigost/.test(e.text))).toBe(true);
    // 2) le marin propose la quête
    const d = parler(w, 'marin_madrestam')!;
    expect(d?.quete).toBe('frigost_passage');
    q.repondre(d.reponses.findIndex(r => r.a === 'accepter'));
    expect(q.enCours.some(c => c.id === 'frigost_passage')).toBe(true);
    // 3) 25 monstres des Plaines Rocheuses (sous-zone 70) ; ailleurs, ça ne compte pas
    const wg = w.worldGrid!, carte = AS.maps.find(m => m.sub === 70 && !m.inside)!;
    const ici = wg.cellToWorld(wg.cellOf(carte.tag, 300)), ailleurs = wg.cellToWorld(wg.cellOf('9_-2', 300));
    const tuer = (x: number, y: number) => { const m = w.spawnMonster('craqueleur_des_plaines', x, y); m.hp = 0; w.killMonster(m); };
    const c = q.enCours.find(x => x.id === 'frigost_passage')!;
    tuer(ailleurs.x, ailleurs.y);
    w.step(1 / 60, NO_INPUT);
    expect(c.compte[0]).toBe(0);
    for (let i = 0; i < 25; i++) tuer(ici.x, ici.y);
    w.step(1 / 60, NO_INPUT);
    expect(c.etape, 'étape 2 : parler au marin').toBe(1);
    q.repondre(-1);
    // 4) retour au marin : la quête se termine, récompense donnée
    const xp = p.xp, kamas = p.kamas;
    parler(w, 'marin_madrestam'); q.repondre(-1);
    if (!q.finies.has('frigost_passage')) { parler(w, 'marin_madrestam'); q.repondre(-1); }
    expect(q.finies.has('frigost_passage')).toBe(true);
    expect(p.kamas - kamas).toBe(4000);
    expect(p.xp !== xp || p.level > 80).toBe(true);
    // 5) le bateau part : écran de voyage vers Frigost, arrivée à la Bourgade
    w.drainEvents();
    expect(marcherPorte(w)).toBe(true);
    expect(w.drainEvents().some(e => e.k === 'portalStart' && e.nom === 'Bateau pour Frigost')).toBe(true);
    const po = w.zone.open!.portes!.find(x => x.nom === 'Bateau pour Frigost')!;
    expect(po.voyage).toEqual(['madrestam', 'frigost']);
    for (const z of po.voyage!) expect((VOYAGE.zones as Record<string, unknown>)[z], z).toBeDefined();
    for (let i = 0; i < 120 && w.passage; i++) w.step(1 / 60, NO_INPUT);
    expect(wg.mapAt(p.x, p.y)?.tag).toBe('-79_-37');
    expect(w.map.walkable(p.x, p.y)).toBe(true);
    // 6) et le retour vers Madrestam marche aussi
    const b = w.portes.find(x => x.nom === 'Bateau pour Frigost')!.ends[1];
    p.x = b.x + 60; p.y = b.y; (w as unknown as { portalLock: unknown }).portalLock = null;
    for (let i = 0; i < 120 && !w.passage; i++) w.step(1 / 60, { ...NO_INPUT, dest: { x: b.x, y: b.y } });
    for (let i = 0; i < 120 && w.passage; i++) w.step(1 / 60, NO_INPUT);
    expect(wg.mapAt(p.x, p.y)?.tag).toBe('9_-2');
  });

  it('hors partie de test, tant que la 0.6 est cachée : ni bateau ni marin', () => {
    const w = monde(false);
    if (w.player.v06) return;
    expect(w.portes.some(p => p.nom === 'Bateau pour Frigost')).toBe(false);
    expect(w.quetes!.pnjs.some(n => n.id === 'marin_madrestam')).toBe(false);
  });
});
