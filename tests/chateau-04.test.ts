import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { World } from '../src/sim/world';

const AS = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const VIDE = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (test: boolean) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(AS), seed: 3, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  reprise: VIDE, sansGroupes: true, ...(test ? { test: {} as never } : {}) });
const SALLES = ['chateau_trone', 'chateau_conseil', 'chateau_banquet', 'chateau_bibliotheque', 'chateau_chapelle', 'chateau_milice', 'chateau_milice_garde', 'chateau_cuisine'];

describe('intérieurs du Château d’Amakna (« 0.4 suite : 6A »)', () => {
  it('8 salles officielles, toutes joignables depuis le Château par des portes, en partie de test seulement', () => {
    const w = monde(true), wg = w.worldGrid!;
    for (const t of SALLES) { expect(wg.mapByTag(t)?.inside, t).toBeTruthy(); expect(wg.mapByTag(t)?.essai, t).toBeTruthy(); }
    const po = w.portes.filter(p => p.ends.some(e => SALLES.includes(e.tag)));
    for (const p of po) for (const e of p.ends) expect(w.map.walkable(e.x, e.y), `${p.nom} ${e.tag}`).toBe(true);
    // depuis le dehors (cartes du Château), chaque salle est au bout d'une suite de portes
    const vu = new Set(['4_-6', '5_-6']);
    for (let n = 0; n < 10; n++) for (const p of po) { const [a, b] = p.ends.map(e => e.tag); if (vu.has(a)) vu.add(b); if (vu.has(b)) vu.add(a); }
    for (const t of SALLES) expect(vu.has(t), t).toBe(true);
    expect(monde(false).portes.filter(p => p.ends.some(e => SALLES.includes(e.tag)))).toHaveLength(0);
  });

  it('Château vivant (6C) : gens de la Cour qui flânent, gardes et Bailli crieur, en partie de test seulement', () => {
    const w = monde(true), wg = w.worldGrid!;
    const CARTES = ['4_-7', '5_-7', '4_-6', '5_-6', '6_-6', '3_-6', '4_-5', '5_-5', '6_-5'];
    expect(w.passants?.liste.length).toBe(9);
    for (const p of w.passants!.liste) expect(CARTES).toContain(wg.mapAt(p.x, p.y)?.tag);
    // ils marchent : au bout d'une minute, au moins un a bougé et tous restent sur des cases marchables
    const avant = w.passants!.liste.map(p => [p.x, p.y]);
    for (let i = 0; i < 600; i++) w.passants!.update(0.1);
    expect(w.passants!.liste.some((p, i) => Math.hypot(p.x - avant[i][0], p.y - avant[i][1]) > 50)).toBe(true);
    for (const p of w.passants!.liste) expect(w.map.walkable(p.x, p.y)).toBe(true);
    const ids = w.quetes!.pnjs.map(p => p.id);
    for (const id of ['garde_chateau1', 'garde_chateau2', 'bailli']) expect(ids).toContain(id);
    expect(w.quetes!.pnjs.find(p => p.id === 'bailli')?.def.cris?.length).toBeGreaterThan(0);
    const pub = monde(false);
    expect(pub.passants).toBeNull();
    expect(pub.quetes!.pnjs.some(p => ['garde_chateau1', 'garde_chateau2', 'bailli'].includes(p.id))).toBe(false);
  });
});
