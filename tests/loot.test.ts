import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { icons as ICON_FRAMES } from '../src/data/icones_objets.json';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { legendaryPower, rollItem, type Stat } from '../src/sim/items';
import { Rng } from '../src/sim/math';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';

const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
const STEP = 1 / 60;
const arena = (seed = 42) => new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed, items: ITEMS });
const find = (name: string) => Object.entries(ITEMS.equipment).find(([, d]) => d.name === name)!;

describe('objets officiels', () => {
  it('des équipements de niveau 1 à 25 avec icône, et le butin officiel des monstres du jeu', () => {
    expect(Object.keys(ITEMS.equipment).length).toBeGreaterThan(200);
    for (const d of Object.values(ITEMS.equipment)) expect((ICON_FRAMES as Record<string, number>)[d.icon]).toBeGreaterThanOrEqual(0);
    expect(ITEMS.drops.bouftou_nuageux.length).toBeGreaterThan(0);
  });
  it('la rareté règle les jets : commun dans la moitié basse, rare dans la moitié haute avec 2 lignes en plus', () => {
    const [id, def] = find('Amulette du Mulou'), rng = new Rng(3);
    const [a, b] = def.stats.vitalite!;
    for (let i = 0; i < 50; i++) {
      const c = rollItem(id, def, 'commun', rng, i), r = rollItem(id, def, 'rare', rng, i);
      expect(c.stats.vitalite).toBeLessThanOrEqual(Math.round(a + (b - a) / 2));
      expect(r.stats.vitalite).toBeGreaterThanOrEqual(Math.round(a + (b - a) / 2));
      expect(c.extra).toHaveLength(0);
      expect(r.extra).toHaveLength(2);
    }
  });
  it('un légendaire de bas niveau a un effet affaibli (40 % au niveau 10)', () => {
    expect(legendaryPower(5)).toBe(0.4);
    expect(legendaryPower(50)).toBe(1);
    const [id, def] = find('Amulette du Mulou'), it = rollItem(id, def, 'legendaire', new Rng(1), 1);
    expect(it.legendary).toBeDefined();
  });
});

describe('équipement et caractéristiques', () => {
  it('équiper un objet ajoute ses caractéristiques, le retirer les enlève', () => {
    const w = arena(), p = w.player, [id, def] = find('Amulette du Mulou');
    const it = rollItem(id, def, 'magique', w.rng, 999);
    p.bag.push(it);
    p.level = 10; p.recompute();
    const hp = p.maxHp;
    expect(p.equip(999)).toBe(true);
    expect(p.maxHp).toBe(hp + (it.stats.vitalite ?? 0));
    expect(p.bag).toHaveLength(0);
    expect(p.unequip('amulette')).toBe(true);
    expect(p.maxHp).toBe(hp);
  });
  it('on ne porte pas un objet de niveau trop haut, et les deux anneaux vont sur deux emplacements', () => {
    const w = arena(), p = w.player;
    const high = Object.entries(ITEMS.equipment).find(([, d]) => d.level > 10)!;
    p.bag.push(rollItem(high[0], high[1], 'commun', w.rng, 1));
    expect(p.equip(1)).toBe(false);
    const ring = Object.entries(ITEMS.equipment).find(([, d]) => d.slot === 'anneau' && d.level <= 1)!;
    p.bag.push(rollItem(ring[0], ring[1], 'commun', w.rng, 2), rollItem(ring[0], ring[1], 'commun', w.rng, 3));
    expect(p.equip(2)).toBe(true); expect(p.equip(3)).toBe(true);
    expect(p.equipment.anneau1?.uid).toBe(2); expect(p.equipment.anneau2?.uid).toBe(3);
  });
  it('5 points par niveau ; la Force augmente les sorts Terre de 1 % par point', () => {
    const w = arena(), p = w.player;
    p.gainXp(p.xpNeeded, w);
    expect(p.points).toBe(5);
    const before = p.damage(100, 'terre');
    expect(p.spendPoint('force' as Stat, 5)).toBe(true);
    expect(p.damage(100, 'terre')).toBeCloseTo(before * 1.05);
    expect(p.damage(100, 'air')).toBeCloseTo(before);
    expect(p.spendPoint('force' as Stat)).toBe(false);
  });
  it('une panoplie donne son bonus à partir de 2 objets', () => {
    const w = arena(), p = w.player;
    const [sid, set] = Object.entries(ITEMS.sets).find(([, s]) => s.items.length >= 2 && s.bonus['1'] && s.items.every(i => ITEMS.equipment[i].level <= 1)) ?? [];
    if (!set) return;
    p.level = 50;
    set.items.slice(0, 2).forEach((i, k) => { p.bag.push(rollItem(String(i), ITEMS.equipment[i], 'commun', w.rng, 100 + k)); p.equip(100 + k); });
    expect(p.setCount[sid!]).toBe(2);
  });
});

describe('butin au sol', () => {
  it('un boss lâche toujours un équipement, ramassé en passant dessus', () => {
    const w = arena(5), p = w.player;
    const m = w.spawnMonster('epouvanteur', p.x + 40, p.y);
    m.hp = 1; m.state = 'chase';
    w.step(STEP, { ...NO_INPUT, aim: { x: m.x, y: m.y }, pressed: 'attaque' });
    for (let i = 0; i < 20; i++) w.step(STEP, NO_INPUT);
    expect(m.dead).toBe(true);
    expect(w.drops.some(d => d.item)).toBe(true);
    for (const d of w.drops) { p.x = d.x; p.y = d.y; for (let i = 0; i < 40; i++) w.step(STEP, NO_INPUT); }
    expect(p.bag.length).toBeGreaterThan(0);
    expect(w.drops).toHaveLength(0);
  });
});

describe('auto-attaque à l\'arme', () => {
  it('sans arme : le coup de la classe ; avec une arme : son animation, son élément et ses dommages', () => {
    const w = arena(), p = w.player;
    expect(p.autoAttack).toBe('attaque');
    const [id, def] = Object.entries(ITEMS.equipment).find(([, d]) => d.weapon?.type === 'Marteau' && d.level <= 10 && d.weapon.dmg.length)!;
    p.level = 20; p.recompute();
    p.bag.push(rollItem(id, def, 'commun', w.rng, 500));
    expect(p.equip(500)).toBe(true);
    expect(p.autoAttack).toBe('arme');
    expect(p.weaponDef!.anim).toBe('arme7');
    expect(p.weaponDef!.element).toBe(def.weapon!.dmg[0].element);
    expect(p.weaponDef!.dmg).toBeGreaterThan(18);
    // le clic gauche frappe avec le marteau
    const m = w.spawnMonster('bouftou', p.x + 50, p.y);
    m.state = 'chase';
    const hp = m.hp;
    w.step(STEP, { ...NO_INPUT, aim: { x: m.x, y: m.y }, pressed: 'attaque' });
    expect(p.skill?.id).toBe('arme');
    for (let i = 0; i < 40; i++) w.step(STEP, { ...NO_INPUT, aim: { x: m.x, y: m.y } });
    expect(m.hp).toBeLessThan(hp);
    p.unequip('arme');
    expect(p.autoAttack).toBe('attaque');
  });
});
