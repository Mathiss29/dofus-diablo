import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { TROPHEES, tropheesDuBoss } from '../src/sim/dofus';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';
import { World } from '../src/sim/world';
import ICONES from '../src/data/icones_objets.json';

const AS = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const VIDE = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (test = true) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(AS), seed: 4, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  reprise: VIDE, ...(test ? { test: {} as never } : {}) });
const BOSS = ['scarabosse_dore', 'chafer_ronin', 'batofu', 'directeur_grunob', 'bworkette', 'coffre_des_forgerons', 'kwakwa', 'shin_larve',
  'craqueleur_legendaire', 'wa_wobot', 'wa_wabbit'];

describe('trophées (« 0.4 suite : 3A+3B »)', () => {
  it('85 trophées officiels du niveau 50, avec icône et stats ; 2 par boss de la 0.4 (3A)', () => {
    expect(Object.keys(TROPHEES)).toHaveLength(85);
    for (const t of Object.values(TROPHEES)) {
      expect(t.niveau).toBe(50);
      expect((ICONES as { icons: Record<string, unknown> }).icons[String(t.icon)], t.nom).toBeDefined();
      expect(Object.keys(t.stats).length, t.nom).toBeGreaterThan(0);
    }
    for (const b of BOSS) { expect(GAME_DATA.monsters[b], b).toBeDefined(); expect(tropheesDuBoss(b), b).toHaveLength(2); }
  });
  it('3B : recettes du Façonneur sans Galets ni Pépite, ingrédients présents', () => {
    const r = (ITEMS.recipes ?? []).filter(x => TROPHEES[x.result]);
    expect(r.length).toBeGreaterThan(5);
    for (const x of r) {
      expect(x.metier).toBe('faconneur');
      for (const [i] of x.ingredients) { expect(ITEMS.resources[i], i).toBeDefined(); expect(ITEMS.resources[i].name).not.toMatch(/^(Galet|Pépite$)/); }
    }
  });
  it('portés dans les cases de Dofus à partir du niveau 50, une fois chacun, gardés dans la sauvegarde', () => {
    const w = monde(), p = w.player, id = Object.keys(TROPHEES).find(k => TROPHEES[k].stats.vitalite)!;
    expect(p.gagnerTrophee(id)).toBe(true);
    expect(p.gagnerTrophee(id)).toBe(false);
    expect(p.dofusPortes).not.toContain(id);   // niveau 1 : dans le sac
    const hp = p.maxHp; p.level = 50; expect(p.porterDofus(id)).toBe(true); p.recompute();
    expect(p.maxHp - hp).toBeGreaterThanOrEqual(TROPHEES[id].stats.vitalite!);
    const e = exporterJoueur(w), w2 = monde(); restaurerJoueur(w2, e);
    expect(w2.player.trophees).toEqual([id]); expect(w2.player.dofusPortes).toContain(id);
  });
  it('hors partie de test, ni tirés ni fabriqués tant que la 0.4 n’est pas publique', () => {
    const w = monde(false), i = (ITEMS.recipes ?? []).findIndex(x => TROPHEES[x.result]);
    if (w.player.v04) return;
    expect(w.recetteVisible(ITEMS.recipes![i])).toBe(false);
    expect(monde(true).recetteVisible(ITEMS.recipes![i])).toBe(true);
  });
});
