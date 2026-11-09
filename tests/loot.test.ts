import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { icons as ICON_FRAMES } from '../src/data/icones_objets.json';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { legendaryPower, rollItem, type Stat } from '../src/sim/items';
import { rollRarity } from '../src/sim/butin';
import { Rng } from '../src/sim/math';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';

const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
const STEP = 1 / 60;
const world = (seed = 42, classId = 'iop') => new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed, items: ITEMS, classId });
/** Sac vidé de l'arme de chasse de départ, pour compter les objets simplement. */
const arena = (seed = 42) => { const w = world(seed); w.player.bag.length = 0; return w; };
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
      const c = rollItem(id, def, 'commun', rng, i), r = rollItem(id, def, 'epique', rng, i);
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
  it('un Mythique a des jets parfaits et deux effets légendaires différents', () => {
    const [id, def] = find('Amulette du Mulou'), it = rollItem(id, def, 'mythique', new Rng(3), 1);
    for (const [k, [, b]] of Object.entries(def.stats)) if (b > 0) expect(it.stats[k as Stat]).toBe(b);
    expect(it.legendary && it.legendary2).toBeTruthy();
    expect(it.legendary!.id).not.toBe(it.legendary2!.id);
  });
  it('environ un légendaire sur 20 est Mythique', () => {
    const rng = new Rng(11), n: Record<string, number> = {};
    for (let i = 0; i < 200000; i++) { const r = rollRarity(rng, true); n[r] = (n[r] ?? 0) + 1; }
    const ratio = n.mythique / (n.mythique + n.legendaire);
    expect(ratio).toBeGreaterThan(0.035); expect(ratio).toBeLessThan(0.065);
  });
});

describe('équipement et caractéristiques', () => {
  it('équiper un objet ajoute ses caractéristiques, le retirer les enlève', () => {
    const w = arena(), p = w.player, [id, def] = find('Amulette du Mulou');
    const it = rollItem(id, def, 'rare', w.rng, 999);
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
  it('un boss lâche toujours un équipement : Communs et kamas aspirés, le reste ramassé d\'un clic', () => {
    const w = arena(5), p = w.player;
    const m = w.spawnMonster('royal', p.x + 40, p.y);
    m.hp = 1; m.state = 'chase';
    w.step(STEP, { ...NO_INPUT, aim: { x: m.x, y: m.y }, pressed: 'attaque' });
    for (let i = 0; i < 20; i++) w.step(STEP, NO_INPUT);
    expect(m.dead).toBe(true);
    expect(w.drops.some(d => d.item)).toBe(true);
    expect(w.drops.some(d => d.kamas)).toBe(true);
    for (const d of [...w.drops]) {
      p.x = d.x + 20; p.y = d.y;
      w.step(STEP, { ...NO_INPUT, pickup: d.uid });
      for (let i = 0; i < 40; i++) w.step(STEP, NO_INPUT);
    }
    expect(p.bag.length).toBeGreaterThan(0);
    expect(p.kamas).toBeGreaterThan(0);
    expect(w.drops).toHaveLength(0);
  });

  it('un objet Rare ou mieux n\'est pas aspiré : il reste au sol tant qu\'on ne clique pas dessus', () => {
    const w = arena(5), p = w.player;
    const [id, def] = Object.entries(ITEMS.equipment)[0];
    w.drops.push({ uid: 9999, x: p.x + 30, y: p.y, item: rollItem(id, def, 'epique', w.rng, 777), t: 1 });
    for (let i = 0; i < 60; i++) w.step(STEP, NO_INPUT);
    expect(w.drops.some(d => d.uid === 9999)).toBe(true);
    w.step(STEP, { ...NO_INPUT, pickup: 9999 });
    for (let i = 0; i < 60; i++) w.step(STEP, NO_INPUT);
    expect(p.bag.some(b => b.uid === 777)).toBe(true);
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

describe('métier Chasseur (choix 6A)', () => {
  const meatOf = (m: string) => ITEMS.drops[m].find(d => d.metier);
  it('sac vide au départ ; Couteau et Arc de Chasse sont des armes de chasse officielles', () => {
    expect(world().player.bag).toHaveLength(0);
    expect(world(42, 'cra').player.bag).toHaveLength(0);
    expect(ITEMS.equipment['1934'].chasse).toBe(true);
    expect(ITEMS.equipment['1942'].chasse).toBe(true);
  });
  it('les viandes suivent le critère officiel : arme de chasse en main et niveau de Chasseur', () => {
    const d = meatOf('feu_vif')!;
    expect(ITEMS.resources[d.item].name).toBe('Viande Intangible');
    expect(d.metier).toEqual({ id: 41, min: 1 });
    expect(ITEMS.drops.pissenlit.find(x => x.item === '17124')?.metier?.min).toBe(20);   // Viande Faisandée : Chasseur > 19
    const kill = (hunt: boolean) => {
      const w = world(); const p = w.player;
      if (hunt) { w.donnerObjet('1934'); expect(p.equip(p.bag[0].uid)).toBe(true); }
      let meat = 0;
      for (let i = 0; i < 150; i++) {
        const m = w.spawnMonster('feu_vif', p.x + 300, p.y);
        (w as unknown as { killMonster(m: unknown): void }).killMonster(m);
        meat = p.resources[d.item] ?? 0;
      }
      return { meat, job: p.metiers.chasseur };
    };
    expect(kill(false).meat).toBe(0);
    const h = kill(true);
    expect(h.meat).toBeGreaterThan(10);
    expect(h.job.level * 1000 + h.job.xp).toBeGreaterThan(1000);   // le métier a monté
  });
  it('recette officielle : Bouillon de Chair = 1 Viande Intangible, se mange (+11 PV)', () => {
    const w = world(), p = w.player, i = ITEMS.recipes!.findIndex(r => ITEMS.resources[r.result]?.name === 'Bouillon de Chair');
    expect(ITEMS.recipes![i].ingredients).toEqual([['16663', 1]]);
    expect(w.craft(i)).toBe(0);
    p.resources['16663'] = 2;
    expect(w.craft(i)).toBe(1);
    expect(p.resources['16663']).toBe(1); expect(p.resources['16670']).toBe(1);
    p.hp = p.maxHp - 50;
    expect(w.eat('16670')).toBe(true);
    expect(p.hp).toBe(p.maxHp - 39); expect(p.resources['16670']).toBeUndefined();
  });
});
