import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, RECOLTES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { FABRICATION, estPalier, prochainPalier, recettesAvec, sourcesDe } from '../src/sim/metiers';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';
import { World } from '../src/sim/world';
import type { SimEvent } from '../src/sim/events';

const lire = (m: string) => JSON.parse(readFileSync(new URL(`../public/assets/mondes/${m}/monde.json`, import.meta.url), 'utf8')) as WorldData;
const monde = (m = 'incarnam') => new World({ data: GAME_DATA, zone: m, map: new WorldGrid(lire(m)), seed: 3, items: ITEMS, recoltes: RECOLTES });
/** Clique un poste et avance jusqu'à l'ouverture de l'Artisanat. */
function allerAuPoste(w: World, id: number): SimEvent[] {
  const ev: SimEvent[] = [];
  w.step(1 / 60, { ...NO_INPUT, atelier: id, dest: w.approchePoste(id)! });
  for (let i = 0; i < 900; i++) { w.step(1 / 60, NO_INPUT); ev.push(...w.drainEvents()); if (ev.some(e => e.k === 'atelier')) break; }
  return ev;
}

describe('Interface des métiers (maquette Métiers UI)', () => {
  it('3A : chaque atelier a ses machines officielles cliquables (ou un poste au milieu de sa carte)', () => {
    for (const m of ['incarnam', 'astrub']) {
      const w = monde(m), A = w.zone.open!.ateliers!;
      for (const a of A) expect(w.postes.some(p => p.atelier === a.nom), a.nom).toBe(true);
      expect(w.postes.filter(p => p.gfx != null).length).toBeGreaterThan(m === 'astrub' ? 20 : 15);
    }
  });
  it('clic sur une machine : le perso y va et l\'Artisanat s\'ouvre ; une seule barre d\'1 s pour toute la série (5B)', () => {
    const w = monde(), p = w.player;
    const po = w.postes.find(x => x.metiers.includes('paysan') && x.gfx != null)!;
    const a = w.approchePoste(po.id)!; p.x = a.x + 80; p.y = a.y;
    const ev = allerAuPoste(w, po.id);
    expect(ev.find(e => e.k === 'atelier')).toMatchObject({ metier: 'paysan' });
    const i = ITEMS.recipes!.findIndex(r => r.result === '468');   // Pain d'Incarnam = 4 Blé
    p.resources['289'] = 12;
    expect(w.lancerFabrication(i, 99)).toBe(true);
    expect(w.enFabrication?.n).toBe(3);
    for (let t = 0; t < FABRICATION.duree - 0.1; t += 0.1) w.step(0.1, NO_INPUT);
    expect(p.resources['468']).toBeUndefined();
    for (let k = 0; k < 3; k++) w.step(0.1, NO_INPUT);
    expect(p.resources['468']).toBe(3);
    expect(p.resources['289']).toBeUndefined();
  });
  it('un geste interrompt la fabrication ; loin de l\'atelier, impossible', () => {
    const w = monde(), p = w.player, i = ITEMS.recipes!.findIndex(r => r.result === '468');
    p.resources['289'] = 4;
    expect(w.lancerFabrication(i)).toBe(false);   // pas à l'atelier
    const po = w.postes.find(x => x.metiers.includes('paysan'))!, a = w.approchePoste(po.id)!;
    p.x = a.x; p.y = a.y;
    expect(w.lancerFabrication(i)).toBe(true);
    w.step(0.1, { ...NO_INPUT, move: { x: 1, y: 0 } });
    expect(w.enFabrication).toBeNull();
    expect(w.drainEvents().some(e => e.k === 'fabricationStop')).toBe(true);
    for (let k = 0; k < 20; k++) w.step(0.1, NO_INPUT);
    expect(p.resources['289']).toBe(4);
  });
  it('8B : « Où le trouver » vient des données (récolte, butin des monstres et leurs lieux, recette, boutique)', () => {
    const ctx = { monsterName: (k: string) => GAME_DATA.monsters[k]?.name, zones: Object.values(GAME_DATA.zones), recoltes: RECOLTES, boutiques: BOUTIQUES };
    const crane = sourcesDe('16525', ITEMS, ctx);   // Crâne de Kardorim
    expect(crane.monstres[0]).toMatchObject({ cle: 'kardorim', chance: 57 });
    expect(crane.monstres[0].lieux).toContain('Crypte de Kardorim');
    expect(sourcesDe('289', ITEMS, ctx).recolte).toMatchObject({ metier: 'paysan', niveau: 1 });   // Blé
    expect(sourcesDe('468', ITEMS, ctx).recette?.metier).toBe('paysan');
    expect(sourcesDe('548', ITEMS, ctx).boutique).toBeDefined();   // Potion de Rappel chez Otomaï
    expect(recettesAvec(ITEMS, '289').length).toBeGreaterThan(3);   // 12A, 12B : le Blé sert à plusieurs recettes
  });
  it('2B, 10C : prochain palier et bannière seulement aux paliers', () => {
    expect(prochainPalier(ITEMS, 'alchimiste', 23)?.niveau).toBe(30);
    expect(prochainPalier(ITEMS, 'alchimiste', 23)!.recettes.length).toBe(4);   // + Potion de Souvenir (ingrédient d'équipement, 0.3)
    expect(estPalier(30)).toBe(true); expect(estPalier(31)).toBe(false);
  });
  it('9A : la recette suivie est gardée dans la sauvegarde', () => {
    const w = monde(); w.player.recetteSuivie = '468';
    const e = exporterJoueur(w), w2 = monde(); restaurerJoueur(w2, e);
    expect(w2.player.recetteSuivie).toBe('468');
  });
});
