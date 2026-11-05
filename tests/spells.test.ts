import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { GridMap, WorldGrid, type MapData, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT, type PlayerInput } from '../src/sim/input';
import { World } from '../src/sim/world';

const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
const monde = JSON.parse(readFileSync(new URL('../public/assets/mondes/incarnam/monde.json', import.meta.url), 'utf8')) as WorldData;
const STEP = 1 / 60;
const arena = (seed = 42) => new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed });
const press = (w: World, pressed: PlayerInput['pressed'], aim = { x: w.player.x + 100, y: w.player.y }) =>
  w.step(STEP, { ...NO_INPUT, aim, pressed });
const idle = (w: World, s: number) => { for (let i = 0; i < s * 60; i++) w.step(STEP, NO_INPUT); };
const iop = GAME_DATA.classes.iop;

describe('barre de sorts du Iop', () => {
  it('6 sorts officiels sur 1 à 6, chacun avec son icône, plus le Bond sur Espace', () => {
    expect(iop.bar).toHaveLength(6);
    for (const id of [...iop.bar, iop.mobility, iop.favorite]) {
      expect(iop.spells[id]).toBeDefined();
      expect(readFileSync(new URL(`../public/assets/ui/sorts/sort_${iop.spells[id].icon}.png`, import.meta.url)).length).toBeGreaterThan(100);
    }
    expect(iop.spells[iop.mobility].move?.kind).toBe('leap');
  });

  it('chaque sort de la barre touche un monstre placé devant le joueur', () => {
    for (const id of iop.bar) {
      const w = arena(), p = w.player;
      const m = w.spawnMonster('pissenlit', p.x + 50, p.y);
      m.state = 'chase';
      press(w, id, { x: m.x, y: m.y });
      idle(w, 1);
      expect(m.hp, id).toBeLessThan(m.maxHp);
    }
  });

  it('un sort inconnu est ignoré', () => {
    const w = arena();
    press(w, 'sort_qui_nexiste_pas');
    expect(w.player.skill).toBeNull();
  });
});

describe('Rage', () => {
  it('monte en frappant et en prenant des coups', () => {
    const w = arena(), p = w.player;
    const m = w.spawnMonster('pissenlit', p.x + 40, p.y);
    m.state = 'chase';
    press(w, 'attaque', { x: m.x, y: m.y });
    idle(w, 0.4);
    expect(p.rage).toBeGreaterThan(0);
    const r = p.rage;
    p.invuln = 0;
    p.hurt(5, p.x + 10, p.y, w);
    expect(p.rage).toBeCloseTo(r + iop.rage.perHurt);
  });

  it('pleine, elle renforce le sort suivant puis se vide', () => {
    const hit = (full: boolean) => {
      const w = arena(7), p = w.player;
      const m = w.spawnMonster('epouvanteur', p.x + 60, p.y);
      m.state = 'chase';
      p.rage = full ? iop.rage.max : 0;
      w.drainEvents();
      press(w, 'pression', { x: m.x, y: m.y });
      idle(w, 0.5);
      return { dmg: m.maxHp - m.hp, rage: p.rage, spent: w.drainEvents().some(e => e.k === 'rageSpent') };
    };
    const normal = hit(false), boosted = hit(true);
    expect(boosted.spent).toBe(true);
    expect(normal.spent).toBe(false);
    expect(boosted.dmg).toBeGreaterThan(normal.dmg * 1.3);
    expect(boosted.rage).toBeLessThan(iop.rage.max);
  });

  it('pleine, elle pousse l\'effet signature du sort de 50 % (Pression érode 15 % au lieu de 10 %)', () => {
    const erode = (full: boolean) => {
      const w = arena(7), p = w.player;
      const m = w.spawnMonster('epouvanteur', p.x + 60, p.y);
      m.state = 'chase';
      p.rage = full ? iop.rage.max : 0;
      w.drainEvents();
      press(w, 'pression', { x: m.x, y: m.y });
      idle(w, 0.5);
      const dmg = w.drainEvents().filter(e => e.k === 'hit' && e.target === 'monster').reduce((a, e) => a + (e as { amount: number }).amount, 0);
      return (m.def.hp - m.maxHp) / dmg;
    };
    expect(erode(false)).toBeCloseTo(0.1, 1);
    expect(erode(true)).toBeCloseTo(0.15, 1);
  });

  it('les résistances officielles du monstre réduisent les dommages de leur élément', () => {
    const w = arena(5), p = w.player;
    const m = w.spawnMonster('epouvanteur', p.x + 300, p.y);
    m.state = 'chase';
    (m as { def: typeof m.def }).def = { ...m.def, res: { terre: 40, neutre: 0 } };   // terre et neutre suivent toutes deux la Force
    const hit = (element: 'terre' | 'neutre') => {
      let t = 0;
      for (let i = 0; i < 30; i++) { m.hp = m.maxHp; w.hitCircle(m.x, m.y, 1, { dmg: 20, knock: 0, element }); t += m.maxHp - m.hp; }
      return t;
    };
    expect(hit('terre')).toBeLessThan(hit('neutre') * 0.75);
  });

  it('le Bond ne consomme pas la Rage', () => {
    const w = arena(), p = w.player;
    p.rage = iop.rage.max;
    press(w, 'bond');
    expect(p.skill?.id).toBe('bond');
    expect(p.rage).toBe(iop.rage.max);
  });
});

describe('sorts particuliers', () => {
  it('Fureur : les dommages augmentent à chaque lancer', () => {
    const crit = iop.critChance;
    iop.critChance = 0;   // sans coups critiques, pour comparer les dommages
    const w = arena(3), p = w.player;
    const m = w.spawnMonster('epouvanteur', p.x + 60, p.y);
    m.state = 'chase';
    const dmg: number[] = [];
    for (let i = 0; i < 3; i++) {
      p.pa = iop.pa.max; p.cd.fureur = 0; p.rage = 0;
      const before = m.hp;
      m.x = p.x + 60; m.y = p.y; m.kx = m.ky = 0;
      press(w, 'fureur', { x: m.x, y: m.y });
      idle(w, 0.6);
      dmg.push(before - m.hp);
    }
    iop.critChance = crit;
    expect(p.stacks.fureur.n).toBe(3);
    expect(dmg[2]).toBeGreaterThan(dmg[0] * 1.3);
  });

  it('Déferlement : la ruée s\'arrête devant le premier ennemi', () => {
    const w = arena(), p = w.player, x0 = p.x;
    const m = w.spawnMonster('epouvanteur', p.x + 150, p.y);
    m.state = 'chase';
    press(w, 'deferlement', { x: p.x + 400, y: p.y });
    idle(w, 0.5);
    expect(p.x).toBeGreaterThan(x0 + 60);
    expect(p.x).toBeLessThan(m.x + 5);
    expect(m.hp).toBeLessThan(m.maxHp);
  });
});

describe('mort et retour au Zaap', () => {
  it('revient au dernier point de retour sans pénalité (niveau, XP, potions gardés)', () => {
    const w = new World({ data: GAME_DATA, zone: 'incarnam', map: new WorldGrid(monde), seed: 1 }), p = w.player;
    const home = { x: p.x, y: p.y };
    p.gainXp(150, w);
    const level = p.level, xp = p.xp;
    p.x += 900; p.invuln = 0;
    p.hurt(p.maxHp + 10, p.x + 5, p.y, w);
    expect(p.dead).toBe(true);
    w.respawnPlayer();
    expect(p.dead).toBe(false);
    expect(p.hp).toBe(p.maxHp);
    expect([p.x, p.y]).toEqual([home.x, home.y]);
    expect([p.level, p.xp]).toEqual([level, xp]);
    expect(w.checkpointName).toBe('Route des âmes');
  });
});

describe('Crâ', () => {
  const cra = GAME_DATA.classes.cra;
  const archer = (seed = 42) => new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed, classId: 'cra' });
  it('6 sorts officiels, Pas Chassé sur Espace, Flèche Cinglante au clic droit (2 PA), coup de poing sans arme', () => {
    expect(cra.bar).toHaveLength(6);
    expect(cra.basic).toBeUndefined();
    expect(cra.favorite).toBe('cinglante');
    expect(cra.spells.cinglante.pa).toBe(2);
    for (const id of [...cra.bar, cra.mobility, cra.favorite]) {
      expect(cra.spells[id]).toBeDefined();
      expect(readFileSync(new URL(`../public/assets/ui/sorts/sort_${cra.spells[id].icon}.png`, import.meta.url)).length).toBeGreaterThan(100);
    }
  });
  it('Flèche Cinglante tire une flèche qui touche un monstre à distance', () => {
    const w = archer(), p = w.player;
    expect(p.autoAttack).toBe('attaque');
    const m = w.spawnMonster('epouvanteur', p.x + 300, p.y);
    m.state = 'chase';
    press(w, 'cinglante', { x: m.x, y: m.y });
    w.step(STEP, NO_INPUT);
    for (let i = 0; i < 12 && !w.projectiles.length; i++) w.step(STEP, NO_INPUT);
    expect(w.projectiles.length).toBe(1);
    idle(w, 0.6);
    expect(m.hp).toBeLessThan(m.maxHp);
    expect(w.projectiles.length).toBe(0);
  });
  it('Flèche Explosive touche tout le groupe autour du point d\'impact', () => {
    const w = archer(), p = w.player;
    const ms = [0, 40, -40].map(dy => { const m = w.spawnMonster('epouvanteur', p.x + 300, p.y + dy); m.state = 'chase'; return m; });
    press(w, 'explosive', { x: p.x + 300, y: p.y });
    idle(w, 1);
    for (const m of ms) expect(m.hp).toBeLessThan(m.maxHp);
  });
  it('Flèche d\'Abolition rend des PV (vol de vie)', () => {
    const w = archer(), p = w.player;
    const m = w.spawnMonster('epouvanteur', p.x + 200, p.y);
    m.state = 'chase';
    p.hp = 50;
    press(w, 'abolition', { x: m.x, y: m.y });
    idle(w, 0.4);
    expect(p.hp).toBeGreaterThan(50);
  });
});

describe('caractéristiques (choix 10C + 10D)', () => {
  it('Résistance fixe puis % Résistance réduisent les dommages reçus de leur élément', () => {
    const w = arena(), p = w.player;
    p.invuln = 0; let hp = p.hp; p.hurt(40, p.x + 10, p.y, w, 'terre'); const plain = hp - p.hp;
    p.addMod('redTerre', 10, 999); p.addMod('resTerre', 50, 999);
    p.invuln = 0; hp = p.hp; p.hurt(40, p.x + 10, p.y, w, 'terre');
    expect(plain).toBe(40);
    expect(hp - p.hp).toBe(15);   // (40 - 10) × 50 %
    p.invuln = 0; hp = p.hp; p.hurt(40, p.x + 10, p.y, w, 'feu');
    expect(hp - p.hp).toBe(40);
  });

  it('l\'Esquive PM officielle du monstre résiste au retrait de PM (Flèche Cinglante)', () => {
    const cra = GAME_DATA.classes.cra;
    const shot = (esquive: number) => {
      const w = new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed: 9, classId: 'cra' }), p = w.player;
      const m = w.spawnMonster('epouvanteur', p.x + 120, p.y);
      m.state = 'chase';
      (m as { def: typeof m.def }).def = { ...m.def, caracs: { ...m.def.caracs, esquivePM: esquive } };
      press(w, 'cinglante', { x: m.x, y: m.y });
      idle(w, 0.6);
      return w.drainEvents().filter(e => e.k === 'status').map(e => (e as { text: string }).text);
    };
    expect(cra.spells.cinglante.pmLoss).toBe(2);
    expect(shot(0)).toContain('-2 PM');
    expect(shot(1000)).toContain('Esquive');
  });

  it('le Tacle d\'un monstre au contact ralentit le joueur qui s\'éloigne, la Fuite y résiste', () => {
    const run = (fuite: number) => {
      const w = arena(), p = w.player;
      if (fuite) p.addMod('fuite', fuite, 999);
      const m = w.spawnMonster('bouftou', p.x - p.radius - 20, p.y);
      m.state = 'chase'; m.stun = 99;
      (m as { def: typeof m.def }).def = { ...m.def, caracs: { ...m.def.caracs, tacle: 40 } };
      const x = p.x;
      for (let i = 0; i < 6; i++) w.step(STEP, { ...NO_INPUT, move: { x: 1, y: 0 } });
      return p.x - x;
    };
    const slow = run(0), free = run(1000);
    expect(slow).toBeLessThan(free * 0.8);
  });

  it('les objets officiels portent les nouvelles caractéristiques (Tacle, Fuite, Initiative…)', () => {
    const seen = new Set(Object.values(ITEMS.equipment).flatMap(d => Object.keys(d.stats)));
    for (const k of ['tacle', 'fuite', 'initiative', 'portee', 'invocations']) expect(seen.has(k), k).toBe(true);
  });
});
