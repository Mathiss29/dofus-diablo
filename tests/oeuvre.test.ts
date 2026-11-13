import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS, RECOLTES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { rollItem, type Stat } from '../src/sim/items';
import { poolOfficiel, monstresDeZone } from '../src/sim/butin';
import { OEUVRE, PIERRES, bonusPierre, coutOeuvre, panosArtisan } from '../src/sim/oeuvre';
import { World } from '../src/sim/world';

const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const grille = new WorldGrid(astrub);
const monde = () => new World({ data: GAME_DATA, zone: 'astrub', map: grille, seed: 3, items: ITEMS, recoltes: RECOLTES });
const devant = (w: World, metier: string) => { const po = w.postes.find(x => x.metiers.includes(metier))!, q = w.approchePoste(po.id)!; w.player.x = q.x; w.player.y = q.y; };
const amulette = Object.entries(ITEMS.equipment).find(([, d]) => d.slot === 'amulette' && d.level <= 1 && Object.values(d.stats).some(([a]) => a >= 10))![0];

describe('« Métiers : » travailler le butin (2A 2C 3B 3D)', () => {
  it('2A : chef-d\'œuvre chez le Bijoutier, +5 % par palier, ressources liées et kamas, 4e palier avec une ressource de boss', () => {
    const w = monde(), p = w.player;
    const it = rollItem(amulette, ITEMS.equipment[amulette], 'rare', w.rng, 999);
    p.bag.push(it); p.equip(it.uid, 'amulette');
    const [k, v] = Object.entries(it.stats).find(([, x]) => (x as number) >= 10)! as [Stat, number];
    const avant = p.stat(k);
    devant(w, 'bijoutier');
    expect(w.oeuvrer(it.uid)).toMatch(/Bijoutier niveau 15/);
    p.metiers.bijoutier = { level: 60, xp: 0 };
    const c1 = coutOeuvre(ITEMS, GAME_DATA.monsters, amulette, 1);
    expect(c1.kamas).toBeGreaterThan(0);
    expect(w.oeuvrer(it.uid)).toMatch(/Il manque/);
    for (let n = 1; n <= OEUVRE.paliers; n++) for (const [r, q] of coutOeuvre(ITEMS, GAME_DATA.monsters, amulette, n).res) p.resources[r] = (p.resources[r] ?? 0) + q;
    p.kamas = 1e7;
    expect(coutOeuvre(ITEMS, GAME_DATA.monsters, amulette, 4).res.length).toBeGreaterThan(c1.res.length);
    expect(w.oeuvrer(it.uid)).toBeNull();
    expect(it.oeuvre).toBe(1);
    expect(p.stat(k)).toBe(avant - v + Math.round(v * (1 + 0.03 + 0.05)));   // Bijoutier 60 : 7B (+3 %) et 1er palier (+5 %)
    for (let n = 2; n <= OEUVRE.paliers; n++) expect(w.oeuvrer(it.uid)).toBeNull();
    expect(it.oeuvre).toBe(4);
    expect(w.oeuvrer(it.uid)).toMatch(/achevé/);
    // pas ailleurs qu'à l'atelier du bon métier
    devant(w, 'cordonnier');
    expect(w.metierOeuvreIci(ITEMS.equipment[amulette])).toBeNull();
  });
  it('2C : le Mineur perce, le Bijoutier sertit une pierre précieuse ; une autre la remplace', () => {
    const w = monde(), p = w.player;
    const it = rollItem(amulette, ITEMS.equipment[amulette], 'commun', w.rng, 998);
    p.bag.push(it); p.equip(it.uid, 'amulette');
    devant(w, 'bijoutier');
    expect(w.sertir(it.uid, '547')).toMatch(/percer/);
    devant(w, 'mineur');
    p.resources['312'] = 10; p.resources['441'] = 10; p.kamas = 1e6;
    expect(w.percer(it.uid)).toBeNull();
    expect(it.perce).toBe(true);
    devant(w, 'bijoutier');
    const int0 = p.stat('intelligence'), cha0 = p.stat('chance');
    p.resources['547'] = 1; p.resources['546'] = 1;
    expect(w.sertir(it.uid, '547')).toBeNull();
    const [s, n] = bonusPierre('547', ITEMS.equipment[amulette].level)!;
    expect(s).toBe(PIERRES['547']);
    expect(p.stat('intelligence')).toBe(int0 + n);
    expect(w.sertir(it.uid, '546')).toBeNull();
    expect(p.stat('intelligence')).toBe(int0);
    expect(p.stat('chance')).toBeGreaterThan(cha0);
    expect(p.resources['547']).toBeUndefined();
  });
  it('3B : jet choisi, la ligne sort à son maximum', () => {
    const w = monde(), p = w.player;
    const i = ITEMS.recipes!.findIndex(r => ITEMS.equipment[r.result] && r.level <= 1 && Object.values(ITEMS.equipment[r.result].stats).some(([a, b]) => a >= 0 && b > a));
    const r = ITEMS.recipes![i], def = ITEMS.equipment[r.result];
    const [k, [, max]] = Object.entries(def.stats).find(([, [a, b]]) => a >= 0 && b > a)! as [Stat, [number, number]];
    for (const [id, q] of r.ingredients) p.resources[id] = q * 5;
    devant(w, r.metier);
    expect(w.craft(i, 5, null, k)).toBe(5);
    expect(p.bag.slice(-5).every(b => b.stats[k] === max)).toBe(true);
  });
  it('3D : les pièces des panoplies d\'artisan ne tombent plus en butin aléatoire', () => {
    const { sets, pieces } = panosArtisan(ITEMS);
    expect(sets.size).toBeGreaterThan(10);
    const pool = poolOfficiel(ITEMS, Object.values(GAME_DATA.zones).flatMap(monstresDeZone));
    expect(pool.some(e => pieces.has(e.id))).toBe(false);
    expect(pool.length).toBeGreaterThan(50);
  });
});
