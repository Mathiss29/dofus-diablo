import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { NO_INPUT, type PlayerInput } from '../src/sim/input';
import { Rng } from '../src/sim/math';
import { planWave } from '../src/sim/waves';
import { Player } from '../src/sim/player';
import { World } from '../src/sim/world';
import { CASE } from '../src/sim/monster';

const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
const newWorld = (seed = 42) => new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed });
const STEP = 1 / 60;

/** Joueur « bot » : tourne en rond et attaque, avec des Bonds de temps en temps. */
function botInput(w: World, i: number): PlayerInput {
  const a = i / 90;
  const target = w.monsters.find(m => !m.dead) ?? w.player;
  return {
    move: { x: Math.cos(a), y: Math.sin(a) },
    aim: { x: target.x, y: target.y },
    pressed: i % 240 === 0 ? 'bond' : i % 300 === 0 ? 'colere' : i % 120 === 0 ? 'epee' : null,
    holdAttack: true,
  };
}

describe('carte', () => {
  it('trouve des cases marchables et place le joueur dessus', () => {
    const w = newWorld();
    expect(w.map.free.length).toBeGreaterThan(200);
    expect(w.walkable(w.player.x, w.player.y)).toBe(true);
  });
});

describe('vagues des Champs d\'Astrub', () => {
  const def = GAME_DATA.zones['champs-astrub'].waves!;
  it('vague 1 : 3 Pissenlits et 1 Rose, pas de Tournesol', () => {
    const p = planWave(1, def, new Rng(1));
    expect(p.monsters.filter(m => m === 'pissenlit')).toHaveLength(3);
    expect(p.monsters.filter(m => m === 'rose')).toHaveLength(1);
    expect(p.monsters).not.toContain('tournesol');
    expect(p.boss).toBeNull();
  });
  it('vague 5 : l\'Épouvanteur et son escorte', () => {
    const p = planWave(5, def, new Rng(1));
    expect(p.boss).toBe('epouvanteur');
    expect(p.monsters.filter(m => m !== p.archi)).toHaveLength(1 + 3 + 5);
  });
  it('ne fait apparaître que des monstres de la zone', () => {
    const allowed = new Set(['pissenlit', 'rose', 'tournesol', 'epouvanteur', 'archi_pissenlit', 'archi_rose', 'archi_tournesol']);
    const rng = new Rng(7);
    for (let w = 1; w <= 30; w++) for (const m of planWave(w, def, rng).monsters) expect(allowed.has(m)).toBe(true);
  });
});

describe('simulation', () => {
  it('est déterministe : même graine et mêmes entrées = même partie', () => {
    const run = () => {
      const w = newWorld(123);
      for (let i = 0; i < 1800; i++) w.step(STEP, botInput(w, i));
      return { p: [w.player.x, w.player.y, w.player.hp], wave: w.wave, kills: w.kills, m: w.monsters.map(m => [m.type, m.x, m.y, m.hp]) };
    };
    expect(run()).toEqual(run());
  });

  it('personne ne finit sur une case bloquée (hors Bond)', () => {
    const w = newWorld(5);
    for (let i = 0; i < 3600; i++) {
      w.step(STEP, botInput(w, i));
      if (!w.player.airborne) expect(w.walkable(w.player.x, w.player.y)).toBe(true);
      for (const m of w.monsters) expect(w.walkable(m.x, m.y)).toBe(true);
    }
  });

  it('l\'attaque touche un monstre devant le joueur', () => {
    const w = newWorld();
    const p = w.player;
    const m = w.spawnMonster('pissenlit', p.x + 40, p.y);
    m.state = 'chase';
    w.drainEvents();
    w.step(STEP, { ...NO_INPUT, aim: { x: m.x, y: m.y }, pressed: 'attaque' });
    for (let i = 0; i < 10; i++) w.step(STEP, NO_INPUT);
    expect(m.hp).toBeLessThan(m.maxHp);
    expect(w.drainEvents().some(e => e.k === 'hit' && e.target === 'monster')).toBe(true);
  });

  it('lance la première vague, puis la suivante quand tout est mort', () => {
    const w = newWorld();
    for (let i = 0; i < 90; i++) w.step(STEP, NO_INPUT);
    expect(w.wave).toBe(1);
    for (const m of w.monsters) { m.dead = true; m.t = 0; }
    for (let i = 0; i < 150; i++) w.step(STEP, NO_INPUT);
    expect(w.wave).toBe(2);
  });
});

describe('PA, PM, potion et XP', () => {
  const press = (w: World, pressed: PlayerInput['pressed'], extra: Partial<PlayerInput> = {}) =>
    w.step(STEP, { ...NO_INPUT, aim: { x: w.player.x + 100, y: w.player.y }, pressed, ...extra });
  const idle = (w: World, s: number) => { for (let i = 0; i < s * 60; i++) w.step(STEP, NO_INPUT); };

  it('Pression coûte 3 PA (coût officiel), et les PA remontent ensuite', () => {
    const w = newWorld(), p = w.player;
    press(w, 'pression');
    expect(p.skill?.id).toBe('pression');
    expect(p.pa).toBeCloseTo(3, 1);
    idle(w, 3);
    expect(p.pa).toBe(p.cls.pa.max);
  });

  it('sans assez de PA, le sort ne part pas et le HUD est prévenu', () => {
    const w = newWorld(), p = w.player;
    p.pa = 2;
    press(w, 'pression');
    expect(p.skill).toBeNull();
    expect(w.drainEvents().some(e => e.k === 'noResource' && e.res === 'pa')).toBe(true);
  });

  it('le Bond consomme une charge de PM : deux Bonds d\'affilée, pas trois', () => {
    const w = newWorld(), p = w.player;
    let bonds = 0;
    for (let i = 0; i < 3; i++) {
      press(w, 'bond');
      if (p.skill?.id === 'bond') bonds++;
      idle(w, 0.5);
    }
    expect(bonds).toBe(2);
    expect(p.pm).toBeLessThan(1);
  });

  it('la potion rend 35 % des PV max et consomme une charge', () => {
    const w = newWorld(), p = w.player;
    p.hp = 50;
    press(w, null, { potion: true });
    expect(p.hp).toBe(50 + Math.round(p.maxHp * 0.35));
    expect(p.potions).toBe(p.cls.potion.charges - 1);
    press(w, null, { potion: true });   // délai entre deux gorgées
    expect(p.potions).toBe(p.cls.potion.charges - 1);
  });

  it('tuer des monstres donne de l\'XP et fait monter de niveau', () => {
    const w = newWorld(), p = w.player;
    p.gainXp(p.xpNeeded + 10, w);
    expect(p.level).toBe(2);
    expect(p.xp).toBe(10);
    expect(w.drainEvents().some(e => e.k === 'levelUp' && e.level === 2)).toBe(true);
  });

  it('tuer un monstre affiche l\'XP gagnée au-dessus de lui', () => {
    const w = newWorld(), p = w.player;
    const m = w.spawnMonster('pissenlit', p.x + 40, p.y); m.state = 'chase'; m.hp = 1;
    w.drainEvents();
    w.step(STEP, { ...NO_INPUT, aim: { x: m.x, y: m.y }, pressed: 'attaque' });
    for (let i = 0; i < 20; i++) w.step(STEP, NO_INPUT);
    const xp = w.drainEvents().find(e => e.k === 'xp');
    expect(xp && xp.k === 'xp' && xp.n).toBeGreaterThan(0);
  });
});

describe('déplacement à la souris', () => {
  it('un clic sur le sol : le perso y va en contournant les obstacles ; un clic sur un monstre : il s\'approche et frappe', () => {
    const w = new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed: 3, items: ITEMS });
    const p = w.player, map = w.map;
    const goal = map.randomFree(w.rng);
    const path = w.findPath(p, goal);
    expect(path.length).toBeGreaterThan(0);
    for (const q of path) expect(map.walkable(q.x, q.y)).toBe(true);
    w.step(STEP, { ...NO_INPUT, dest: goal });
    for (let i = 0; i < 60 * 12 && Math.hypot(p.x - goal.x, p.y - goal.y) > 4; i++) w.step(STEP, NO_INPUT);
    expect(Math.hypot(p.x - goal.x, p.y - goal.y)).toBeLessThan(30);
    const m = w.spawnMonster('bouftou', p.x + 200, p.y); m.state = 'chase';
    const hp = m.hp;
    for (let i = 0; i < 60 * 4 && m.hp === hp; i++) w.step(STEP, { ...NO_INPUT, target: m.id, aim: { x: m.x, y: m.y } });
    expect(m.hp).toBeLessThan(hp);
  });
});

describe('cadence et attaques à distance', () => {
  it('l\'auto-attaque attend sa recharge, et la Vitesse d\'attaque la raccourcit', () => {
    const w = newWorld(), p = w.player;
    const m = w.spawnMonster('pissenlit', p.x + 40, p.y); m.state = 'chase';
    const swings = () => { let n = 0; for (let i = 0; i < 120; i++) { w.step(STEP, { ...NO_INPUT, aim: { x: m.x, y: m.y }, holdAttack: true }); if (p.state === 'skill' && p.skill?.t === STEP) n++; } return n; };
    m.hp = m.maxHp = 1e6;
    const slow = swings();
    expect(slow).toBeLessThanOrEqual(Math.ceil(2 / p.attackInterval()) + 1);
    p.stats.vitesse = 100;
    expect(p.attackInterval()).toBeLessThan(1 / Player.BASE_APS);
    expect(swings()).toBeGreaterThan(slow);
  });

  it('les monstres ont leurs vrais sorts de Dofus 3', () => {
    const M = GAME_DATA.monsters;
    expect(M.pissenlit_miroitant.spells!.map(s => s.name)).toEqual(['Herbe Sauvage']);
    expect(M.feu_follet.spells![0]).toMatchObject({ name: 'Brûlure légère', po: [1, 1], missile: 129 });
    expect(M.feu_vif.spells![0].effects[0]).toMatchObject({ k: 'dmg', element: 'terre' });
    expect(M.bouftor_ethere.spells!.map(s => s.name)).toEqual(['Morsure du Bouftou', 'Fureur du Bouftou']);
  });

  it('Herbe Sauvage tombe là où était le joueur : 2 PM en moins, et on peut l\'esquiver', () => {
    const cast = (dodge: boolean) => {
      const w = newWorld(), p = w.player;
      const m = w.spawnMonster('pissenlit_miroitant', p.x + 4 * CASE, p.y); m.state = 'chase'; m.atkCd = 0;
      const hp = p.hp, pm = p.pm;
      let named = false;
      for (let i = 0; i < 60 && (m.state as string) !== 'recover'; i++) {
        w.step(STEP, dodge && (m.state as string) === 'windup' ? { ...NO_INPUT, move: { x: -1, y: 0 } } : NO_INPUT);
        named ||= w.drainEvents().some(e => e.k === 'monsterCast' && e.name === 'Herbe Sauvage');
      }
      return { named, hurt: p.hp < hp, pm: p.pm - pm };
    };
    const hit = cast(false);
    expect(hit.named).toBe(true);
    expect(hit.hurt).toBe(true);
    expect(hit.pm).toBeLessThan(-1.9);
    expect(cast(true).hurt).toBe(false);
  });

  it('un Feu Follet crache sa Brûlure légère (projectile) au contact', () => {
    const w = newWorld(), p = w.player;
    const m = w.spawnMonster('feu_follet', p.x + 60, p.y); m.state = 'chase'; m.atkCd = 0;
    const hp = p.hp;
    let shot = false;
    for (let i = 0; i < 60 * 3 && p.hp === hp; i++) { w.step(STEP, NO_INPUT); shot ||= w.projectiles.some(q => q.hostile); }
    expect(shot).toBe(true);
    expect(p.hp).toBeLessThan(hp);
  });
});
