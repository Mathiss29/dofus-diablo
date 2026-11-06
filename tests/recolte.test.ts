import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS, RECOLTES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { RECOLTE } from '../src/sim/recolte';
import { World } from '../src/sim/world';

const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const monde = () => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 3, items: ITEMS, recoltes: RECOLTES });
/** Clique la ressource puis avance la simulation (le perso y va, puis récolte). */
function recolter(w: World, id: number, pas = 600) {
  const a = w.approcheRecolte(id)!;
  w.step(1 / 60, { ...NO_INPUT, recolte: id, dest: a });
  for (let i = 0; i < pas; i++) { w.step(1 / 60, NO_INPUT); if (w.recoltes.find(r => r.id === id)!.repousse > 0) break; }
}

describe('Métiers de récolte (0.2b)', () => {
  it('ressources officielles posées dans Astrub, chacune avec son icône et son métier', () => {
    const w = monde();
    expect(w.recoltes.length).toBeGreaterThan(1500);   // sans les copies des cartes voisines (recoltes_cases.py)
    for (const [id, r] of Object.entries(RECOLTES.ressources)) {
      expect(ITEMS.resources[id], id).toBeDefined();
      expect(ITEMS.metiers?.[r.metier], r.metier).toBeDefined();
    }
    for (const n of ['Blé', 'Bois de Frêne', 'Ortie', 'Fer', 'Goujon']) expect(Object.values(RECOLTES.ressources).some(r => r.nom === n), n).toBe(true);
  });
  it('clic sur du Blé : le perso y va, récolte en 1,2 s, gagne de l\'XP de Paysan, la ressource repousse en 60 s', () => {
    const w = monde(), p = w.player;
    const ble = w.recoltes.find(r => r.item === '289')!;
    const a = w.approcheRecolte(ble.id)!; p.x = a.x + 60; p.y = a.y;
    recolter(w, ble.id);
    expect(p.resources['289']).toBeGreaterThanOrEqual(1);
    expect(p.metiers.paysan.xp).toBeGreaterThan(0);
    expect(ble.repousse).toBeGreaterThan(RECOLTE.repousse - 1);
    for (let i = 0; i < 61 * 10; i++) w.step(0.1, NO_INPUT);
    expect(ble.repousse).toBe(0);
  });
  it('un déplacement interrompt le geste ; niveau de métier trop bas : rien', () => {
    const w = monde(), p = w.player;
    const ble = w.recoltes.find(r => r.item === '289')!, a = w.approcheRecolte(ble.id)!;
    p.x = a.x; p.y = a.y;
    w.step(1 / 60, { ...NO_INPUT, recolte: ble.id, dest: a });
    for (let i = 0; i < 20 && !w.enRecolte; i++) w.step(1 / 60, NO_INPUT);
    expect(w.enRecolte).not.toBeNull();
    w.step(1 / 60, { ...NO_INPUT, dest: { x: a.x + 200, y: a.y } });
    expect(w.enRecolte).toBeNull();
    const orme = w.recoltes.find(r => r.item === '470')!, b = w.approcheRecolte(orme.id)!;   // Bois d'Orme : Bûcheron 180
    p.x = b.x; p.y = b.y; w.drainEvents();
    recolter(w, orme.id, 60);
    expect(p.resources['470']).toBeUndefined();
    expect(w.drainEvents().some(e => e.k === 'recolteNiveau')).toBe(true);
  });
  it('chaque emplacement (Astrub, Incarnam) a son dessin officiel : planche, frames prête / coupe / récoltée', () => {
    const R = RECOLTES as unknown as Record<string, [string, number, string, number][]>;
    for (const monde of ['astrub', 'incarnam']) {
      expect(R[monde].length, monde).toBeGreaterThan(300);
      for (const g of new Set(R[monde].map(x => x[3]))) {
        const j = JSON.parse(readFileSync(new URL(`../public/assets/sprites/recoltes/${g}.json`, import.meta.url), 'utf8'));
        expect(j.frames.pret, `${g}`).toBeDefined();
        expect(j.frames.recolte, `${g}`).toBeDefined();
        expect(j.meta.image).toBe(`${g}.avif`);
      }
    }
    expect(monde().recoltes.every(r => r.gfx != null)).toBe(true);
  });
  it('Bricoleur : les recettes officielles des clés de donjon', () => {
    const r = (id: string) => ITEMS.recipes!.find(x => x.result === id)!;
    expect(r('8143')).toMatchObject({ metier: 'bricoleur', level: 10 });
    expect(r('8545')).toMatchObject({ metier: 'bricoleur', level: 1 });
    const w = monde(), p = w.player, i = ITEMS.recipes!.indexOf(r('8545'));
    for (const [id, q] of r('8545').ingredients) p.resources[id] = q;
    expect(w.craft(i)).toBe(true);
    expect(p.resources['8545']).toBe(1);
    expect(p.metiers.bricoleur.xp).toBeGreaterThan(0);
  });
});
