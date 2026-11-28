import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { DOFUS, TROPHEES, tropheesDuBoss } from '../src/sim/dofus';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';
import { World } from '../src/sim/world';
import ICONES from '../src/data/icones_objets.json';

const AS = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const VIDE = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (test = true) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(AS), seed: 4, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  reprise: VIDE, ...(test ? { test: {} as never } : {}) });
const BOSS = ['scarabosse_dore', 'chafer_ronin', 'batofu', 'directeur_grunob', 'bworkette', 'coffre_des_forgerons', 'kwakwa', 'shin_larve',
  'craqueleur_legendaire', 'wa_wobot', 'wa_wabbit'];
const BOSS07 = ['koulosse', 'maitre_corbac', 'silf_le_rasboul_majeur', 'damadrya', 'skeunk', 'blop_multicolore_royal', 'royalmouth', 'gobrechaun'];

describe('trophées (« 0.4 suite : 3A+3B »)', () => {
  it('85 trophées officiels du niveau 50, avec icône et stats ; 2 par boss de la 0.4 (3A)', () => {
    expect(Object.values(TROPHEES).filter(t => t.niveau === 50)).toHaveLength(85);
    for (const t of Object.values(TROPHEES)) {
      expect([50, 100]).toContain(t.niveau);
      expect((ICONES as { icons: Record<string, unknown> }).icons[String(t.icon)], t.nom).toBeDefined();
      expect(Object.keys(t.stats).length, t.nom).toBeGreaterThan(0);
    }
    for (const b of BOSS) { expect(GAME_DATA.monsters[b], b).toBeDefined(); expect(tropheesDuBoss(b), b).toHaveLength(2); }
  });
  it('3B : recettes du Façonneur sans Galets ni Pépite, ingrédients présents', () => {
    const r = (ITEMS.recipes ?? []).filter(x => TROPHEES[x.result]);   // niveau 100 : aucune (minerais absents)
    expect(r.length).toBeGreaterThan(5);
    for (const x of r) {
      expect(x.metier).toBe('faconneur');
      for (const [i] of x.ingredients) { expect(ITEMS.resources[i], i).toBeDefined(); expect(ITEMS.resources[i].name).not.toMatch(/^(Galet|Pépite$)/); }
    }
  });
  it('portés dans les cases de Dofus à partir du niveau 50, une fois chacun, gardés dans la sauvegarde', () => {
    const w = monde(), p = w.player, id = Object.keys(TROPHEES).find(k => TROPHEES[k].stats.vitalite && TROPHEES[k].niveau === 50)!;
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
  it('0.7 (9C) : 87 trophées du niveau 100 répartis entre les 8 boss de donjon de la 0.7, un au plus par victoire', () => {
    const t = Object.keys(TROPHEES).filter(k => TROPHEES[k].niveau === 100);
    expect(t).toHaveLength(87);
    for (const b of BOSS07) { expect(GAME_DATA.monsters[b], b).toBeDefined(); expect(tropheesDuBoss(b).length, b).toBeGreaterThanOrEqual(10); }
    expect(t.every(k => TROPHEES[k].v07 && BOSS07.includes(TROPHEES[k].boss!))).toBe(true);
    const w = monde(), p = w.player;
    let gagnes = 0;
    for (let i = 0; i < 40; i++) {
      const n = p.trophees.length; w.killMonster(w.spawnMonster('skeunk', p.x + 40, p.y));
      expect(p.trophees.length - n).toBeLessThanOrEqual(1); gagnes += p.trophees.length - n;
    }
    expect(gagnes).toBeGreaterThan(0);
    expect(p.trophees.every(k => TROPHEES[k].boss === 'skeunk')).toBe(true);
  });
  it('0.7 (9D) : le Dofus Kaliptus tombe sur Skeunk, jamais hors partie de test tant que la 0.7 est cachée', () => {
    expect(DOFUS['8072'].boss?.skeunk).toBeGreaterThan(0);
    const w = monde(); w.rng.next = () => 0;   // tous les tirages réussissent
    w.killMonster(w.spawnMonster('skeunk', w.player.x + 40, w.player.y));
    expect(w.player.dofus).toContain('8072');
    const pub = monde(false);
    if (pub.player.v07) return;
    pub.rng.next = () => 0;
    pub.killMonster(pub.spawnMonster('skeunk', pub.player.x + 40, pub.player.y));
    expect(pub.player.dofus).not.toContain('8072');
    expect(pub.player.trophees.some(k => TROPHEES[k].v07)).toBe(false);
  });
  it('0.7 (9A+9B) : équipements 91-120 et leurs panoplies, cachés hors partie de test', () => {
    const neufs = Object.values(ITEMS.equipment).filter(e => e.level > 90 && e.level <= 120);
    expect(neufs.length).toBeGreaterThan(250);
    expect(Object.values(ITEMS.sets).filter(s => s.items.some(i => (ITEMS.equipment[String(i)]?.level ?? 0) > 90)).length).toBeGreaterThan(50);
    const pub = monde(false) as unknown as { player: { v07: boolean }; equipSecours: { level: number }[] };
    const test = monde(true) as unknown as { equipSecours: { level: number }[] };
    if (!pub.player.v07) expect(pub.equipSecours.every(e => e.level <= 90)).toBe(true);
    expect(test.equipSecours.some(e => e.level > 90)).toBe(true);
  });
});
