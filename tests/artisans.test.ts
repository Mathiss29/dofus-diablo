import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS, RECOLTES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT, type PlayerInput } from '../src/sim/input';
import { ARTISANS } from '../src/sim/artisans';
import { rollItem } from '../src/sim/items';
import { World } from '../src/sim/world';

const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const grille = new WorldGrid(astrub);
const monde = () => new World({ data: GAME_DATA, zone: 'astrub', map: grille, seed: 3, items: ITEMS, recoltes: RECOLTES });
function recolter(w: World, id: number, entree: Partial<PlayerInput> = {}, pas = 400) {
  const p = w.player, a = w.approcheRecolte(id)!;
  p.x = a.x; p.y = a.y;
  w.step(1 / 60, { ...NO_INPUT, ...entree, recolte: id, dest: a });
  for (let i = 0; i < pas; i++) { w.step(1 / 60, { ...NO_INPUT, ...entree }); p.hp = p.maxHp; if (w.recoltes.find(r => r.id === id)!.repousse > 0) break; }
}

describe('« Métiers : » récolte et bonus des artisans (6A 6B 6D, 7A 7B)', () => {
  it('7A + 7B : un palier tous les 20 niveaux (PV du Bûcheron, vitesse du Pêcheur, stats de l\'amulette du Bijoutier)', () => {
    const w = monde(), p = w.player;
    const hp0 = p.maxHp, v0 = p.speed;
    p.metiers.bucheron = { level: 100, xp: 0 }; p.metiers.pecheur = { level: 200, xp: 0 };
    p.recompute();
    expect(p.maxHp).toBe(Math.round(hp0 * 1.05));
    expect(p.speed).toBeCloseTo(v0 * 1.1);
    const id = Object.entries(ITEMS.equipment).find(([, d]) => d.slot === 'amulette' && d.level <= 1 && Object.values(d.stats).some(([a]) => a >= 10))![0];
    const it = rollItem(id, ITEMS.equipment[id], 'commun', w.rng, 999);
    p.bag.push(it); p.equip(it.uid, 'amulette');
    const [k, v] = Object.entries(it.stats).find(([, x]) => (x as number) >= 10)! as [never, number];
    const avant = p.stat(k);
    p.metiers.bijoutier = { level: 200, xp: 0 }; p.recompute();
    expect(p.stat(k)).toBe(avant - v + Math.round(v * 1.1));
  });
  it('6A : une ressource dorée donne un coup de pouce de 20 s selon le métier (Paysan : soins)', () => {
    const w = monde(), p = w.player;
    const ble = w.recoltes.find(r => r.item === '289')!; ble.dore = true;
    recolter(w, ble.id);
    expect(p.mods.filter(m => m.src === 'dore').length).toBeGreaterThan(0);
    expect(p.stat('soins')).toBeGreaterThanOrEqual(30);
  });
  it('6B : une ressource dorée de haut niveau est gardée par un élite ; vaincu, on récolte', () => {
    const w = monde(), p = w.player;
    const orge = w.recoltes.find(r => RECOLTES.ressources[r.item]?.niveau === ARTISANS.gardeNiveau && RECOLTES.ressources[r.item].metier === 'paysan')!;
    p.metiers.paysan = { level: 40, xp: 0 }; orge.dore = true;
    recolter(w, orge.id, {}, 60);
    expect(orge.garde).toBeGreaterThan(0);
    expect(orge.repousse).toBe(0);
    const g = w.monsters.find(m => m.id === orge.garde)!;
    expect(g.def.elite).toBe(true);
    g.hp = 0; g.dead = true;
    recolter(w, orge.id);
    expect(orge.repousse).toBeGreaterThan(0);
  });
  it('6D : clic maintenu, le perso enchaîne la ressource suivante de son métier', () => {
    const w = monde();
    const ble = w.recoltes.find(r => r.item === '289' && w.recoltes.some(o => o !== r && o.item === '289' && Math.hypot(o.x - r.x, o.y - r.y) < ARTISANS.rayonChaine / 2))!;
    recolter(w, ble.id, { recolteTenue: true });
    expect(w.versRecolte ?? w.enRecolte?.id).not.toBeNull();
    expect(w.versRecolte ?? w.enRecolte?.id).not.toBe(ble.id);
  });
});
