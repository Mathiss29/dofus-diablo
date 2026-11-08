import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { COFFRE, coffreVide, relireCoffre, type Coffre } from '../src/sim/coffre';
import { World } from '../src/sim/world';

const lire = (w: string) => JSON.parse(readFileSync(new URL(`../public/assets/mondes/${w}/monde.json`, import.meta.url), 'utf8')) as WorldData;
const HS = lire('havresac'), AS = lire('astrub');
const VIDE = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (zone: string, coffre: Coffre, test = true) => new World({ data: GAME_DATA, zone, map: new WorldGrid(zone === 'havresac' ? HS : AS), seed: 1,
  items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES, reprise: VIDE, coffre, ...(test ? { test: {} as never } : {}) });
const devant = (w: World) => { const c = w.postes.find(p => p.coffre)!, q = w.map.nearestFree(c.x, c.y); w.player.x = q.x; w.player.y = q.y; return c; };
const objet = (w: World) => { const [id] = Object.entries(ITEMS.equipment).find(([, d]) => !d.familier)!; const it = { uid: w.newUid(), id, rarity: 'rare' as const, stats: {}, extra: [] }; w.player.bag.push(it); return it; };

describe('coffre partagé (version 0.3 : 12A+12B+12D)', () => {
  it('12A : un coffre au Havre-Sac, 5 onglets ; on range et on reprend devant lui seulement', () => {
    const c = coffreVide(), w = monde('havresac', c), p = w.player;
    expect(c.onglets).toHaveLength(COFFRE.onglets);
    const it = objet(w);
    const co = w.postes.find(x => x.coffre)!, loin = w.worldGrid!.freeByMap.get('0_0')!.map(i => w.worldGrid!.cellToWorld(i))
      .sort((x, y) => Math.hypot(y.x - co.x, y.y - co.y) - Math.hypot(x.x - co.x, x.y - co.y))[0];
    p.x = loin.x; p.y = loin.y;
    expect(w.deposer(it.uid, 0)).toBe(false);   // loin du coffre
    devant(w);
    expect(w.presCoffre).toBe(true);
    expect(w.deposer(it.uid, 2)).toBe(true);
    expect(c.onglets[2]).toHaveLength(1);
    expect(p.bag.some(b => b.uid === it.uid)).toBe(false);
    expect(w.drainEvents().some(e => e.k === 'coffre')).toBe(true);
    expect(w.retirer(2, 0)).toBe(true);
    expect(c.onglets[2]).toHaveLength(0);
    expect(p.bag.at(-1)!.id).toBe(it.id);
  });

  it('12B : la Banque d\'Astrub ouvre le même coffre, que le perso suivant retrouve', () => {
    const c = coffreVide(), a = monde('havresac', c);
    devant(a); const it = objet(a); a.deposer(it.uid, 0);
    const sauve = relireCoffre(JSON.parse(JSON.stringify(c)));
    const b = monde('astrub', sauve);
    const poste = b.postes.find(p => p.coffre)!;
    expect(poste.tag).toBe('banque');
    devant(b);
    expect(b.retirer(0, 0)).toBe(true);
    expect(b.player.bag.at(-1)!.id).toBe(it.id);
  });

  it('un onglet plein refuse ; hors partie de test (0.3 pas sortie) pas de coffre', () => {
    const c = coffreVide(), w = monde('havresac', c);
    devant(w);
    for (let i = 0; i < COFFRE.places; i++) expect(w.deposer(objet(w).uid, 1)).toBe(true);
    expect(w.deposer(objet(w).uid, 1)).toBe(false);
    expect(monde('havresac', coffreVide(), false).postes.some(p => p.coffre)).toBe(false);
  });

  it('relire un coffre abîmé ne plante pas et garde les objets valables', () => {
    expect(relireCoffre(null).onglets).toHaveLength(5);
    expect(relireCoffre({ onglets: [[{ id: '1', rarity: 'rare', stats: {}, extra: [], uid: 1 }, null, { x: 1 }], 'abc'] }).onglets[0]).toHaveLength(1);
  });

  it('11A : les ateliers des 6 métiers de fabrication sont dans la Cité d\'Astrub (partie de test seulement)', () => {
    const w = monde('astrub', coffreVide()), v = monde('astrub', coffreVide(), false);
    for (const m of ['bijoutier', 'cordonnier', 'tailleur', 'forgeron', 'sculpteur', 'faconneur']) {
      expect(w.postes.some(p => p.metiers.includes(m)), m).toBe(true);
      expect(v.postes.some(p => p.metiers.includes(m)), m).toBe(false);
    }
  });
});
