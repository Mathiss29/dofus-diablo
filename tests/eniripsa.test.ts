import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import type { EquipSlot, Item } from '../src/sim/items';
import { POUVOIRS } from '../src/sim/pouvoirs';
import { BOSS_PREFERES, PC_PAR_ID, POUVOIRS_CLASSE } from '../src/sim/pouvoirsClasse';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { NO_INPUT, type PlayerInput } from '../src/sim/input';
import { World } from '../src/sim/world';
import { soignerAllie } from '../src/sim/eniripsa';

const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
const STEP = 1 / 60;
const eni = (seed = 7) => { const w = new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed, classId: 'eniripsa' }); w.waveDelay = 1e9; return w; };
const press = (w: World, pressed: PlayerInput['pressed'], aim: { x: number; y: number }) => w.step(STEP, { ...NO_INPUT, aim, pressed });
const idle = (w: World, s: number) => { for (let i = 0; i < s * 60; i++) w.step(STEP, NO_INPUT); };
const niveau = (p: World['player'], n: number) => { p.level = n; p.recompute(); p.learnSpells(null); p.pa = p.paMax; };
const mannequin = (w: World, x: number, y: number) => { const m = w.spawnMonster('bouftou', x, y); m.mannequin = true; m.poseTest = true; m.state = 'idle'; return m; };
/** Un allié Iop posé à dx du premier joueur, blessé. */
const allie = (w: World, dx = 100) => {
  const p = w.player, q = w.ajouterJoueur('iop');
  q.x = p.x + dx; q.y = p.y; q.hp = Math.round(q.maxHp / 3);
  return q;
};

describe('Eniripsa (maquette Eniripsa, « 1A 2A 3A+3C+3D 4B … »)', () => {
  it('niveau 1 : Mot Espiègle en premier, Mot Tapageur au clic droit, Mot d\'Envol sur Espace (8A 9A) ; 16 sorts au niveau 60', () => {
    const p = eni().player;
    expect(p.bar[0]).toBe('espiegle');
    expect(p.bar[6]).toBe('tapageur');
    expect(p.bar[7]).toBe('envol');
    expect(p.cls.rage.name).toBe('Éloquence');
    for (const id of Object.keys(p.cls.spells)) expect(readFileSync(new URL(`../public/assets/ui/sorts/sort_${p.cls.spells[id].icon}.png`, import.meta.url)).length).toBeGreaterThan(100);
    niveau(p, 60);
    expect(Object.keys(p.cls.spells).filter(k => p.knows(k)).length).toBeGreaterThanOrEqual(16);
  });

  it('1A : Mot Tapageur soigne l\'allié et blesse l\'ennemi dans la même zone ; sur soi, 60 % du soin (4B)', () => {
    const w = eni(), p = w.player, q = allie(w);
    const m = mannequin(w, q.x, q.y + 30);
    p.hp = Math.round(p.maxHp / 3);
    p.x = q.x - 40;   // le lanceur est dans la zone aussi
    const hq = q.hp, hp = p.hp, hm = m.hp;
    w.drainEvents();
    press(w, 'tapageur', { x: q.x, y: q.y }); idle(w, 0.5);
    expect(q.hp).toBeGreaterThan(hq);
    expect(m.hp).toBeLessThan(hm);
    const soinSoi = p.hp - hp, soinAllie = q.hp - hq;
    expect(soinSoi / soinAllie).toBeCloseTo(0.6, 1);
    expect(w.drainEvents().some(e => e.k === 'filSoin')).toBe(true);   // 12C : fil de soin vu de tous
  });

  it('2A : Éloquence pleine, le Mot suivant gagne 2 cases de zone', () => {
    const touche = (plein: boolean) => {
      const w = eni(), p = w.player, c = { x: p.x + 150, y: p.y };
      const m = mannequin(w, c.x + 200, c.y);
      if (plein) { p.rage = p.cls.rage.max; p.lastHitAt = p.age; }
      const h = m.hp;
      press(w, 'tapageur', c); idle(w, 0.5);
      return m.hp < h;
    };
    expect(touche(false)).toBe(false);
    expect(touche(true)).toBe(true);
  });

  it('5A : un seul Encouragement à la fois sur l\'allié ; 5B : sur une case libre, une Fée file soigner le plus blessé', () => {
    const w = eni(), p = w.player, q = allie(w);
    niveau(p, 60);
    press(w, 'stimulant', { x: q.x, y: q.y }); idle(w, 0.4);
    expect(q.encourage?.k).toBe('stimulant');
    p.pa = p.paMax;
    press(w, 'vivifiant', { x: q.x, y: q.y }); idle(w, 0.4);
    expect(q.encourage?.k).toBe('vivifiant');
    expect(q.mods.filter(m => m.src === 'encourage')).toHaveLength(1);
    // la Fée : posée loin de tout le monde, elle rejoint l'allié blessé
    const w2 = eni(), p2 = w2.player, q2 = allie(w2, 160), h = q2.hp;
    niveau(p2, 60);
    press(w2, 'stimulant', { x: p2.x, y: p2.y - 150 }); idle(w2, 0.2);
    expect(w2.betes.some(b => b.luciole?.kind === 'fee')).toBe(true);
    idle(w2, 3);
    expect(q2.hp).toBeGreaterThan(h);
    expect(w2.betes.some(b => b.luciole && !b.dead)).toBe(false);
  });

  it('6A : une Moquerie ralentit l\'ennemi visé', () => {
    const w = eni(), p = w.player;
    niveau(p, 60);
    const m = mannequin(w, p.x + 150, p.y);
    press(w, 'accablant', { x: m.x, y: m.y }); idle(w, 0.4);
    expect(m.haste).toBeLessThan(1);
    expect(m.moqueT).toBeGreaterThan(0);
  });

  it('10B : Mot de Reconstitution relève à distance un allié à terre (recharge 60 s), qui devient insoignable', () => {
    const w = eni(), p = w.player, q = allie(w, 200);
    expect(p.knows('reconstitution')).toBe(true);   // dès le niveau 1, comme le Mot d'Envol
    q.dead = true; q.hp = 0;
    press(w, 'reconstitution', { x: q.x, y: q.y }); idle(w, 0.5);
    expect(q.dead).toBe(false);
    expect(q.hp).toBeGreaterThan(0);
    expect(q.insoignableT).toBeGreaterThan(0);
    expect(p.cdMax.reconstitution).toBe(60);
    const h = q.hp; q.hp = Math.min(h, q.maxHp - 50);
    const h2 = q.hp;
    p.cd.tapageur = 0; p.pa = p.paMax;
    press(w, 'tapageur', { x: q.x, y: q.y }); idle(w, 0.5);
    expect(q.hp).toBe(h2);   // Insoignable
  });

  it('9A : Mot d\'Envol sur un allié échange les places', () => {
    const w = eni(), p = w.player, q = allie(w, 120);
    const sx = p.x, sy = p.y, qx = q.x, qy = q.y;
    press(w, 'envol', { x: qx, y: qy }); idle(w, 0.5);
    expect(Math.hypot(p.x - qx, p.y - qy)).toBeLessThan(5);
    expect(Math.hypot(q.x - sx, q.y - sy)).toBeLessThan(5);
  });

  it('11A : soigner un allié attire les monstres qui le chassent', () => {
    const w = eni(3), p = w.player, q = allie(w, 200);
    let vise = 0;
    for (let i = 0; i < 6; i++) { const m = w.spawnMonster('bouftou', q.x + 40, q.y + (i - 3) * 30); m.state = 'chase'; }
    press(w, 'tapageur', { x: q.x, y: q.y }); idle(w, 0.3);
    for (const m of w.monsters) if (m.viseId === p.id) vise++;
    expect(vise).toBeGreaterThan(0);
  });

  it('7A : le Lapino est invoqué hors du compte des invocations', () => {
    const w = eni(), p = w.player;
    niveau(p, 60);
    press(w, 'amitie', { x: p.x + 100, y: p.y }); idle(w, 0.5);
    const b = w.betes.find(o => o.base === 'lapino');
    expect(b).toBeDefined();
    expect(b!.horsCompte).toBe(true);
  });
});

/** Porte un Légendaire de cet emplacement avec ce pouvoir de classe. */
const porter = (w: World, id: string, value: number) => {
  const c = PC_PAR_ID[id], [iid] = Object.entries(ITEMS.equipment).find(([, d]) => d.slot === c.slot && !d.familier && d.level <= 20)!;
  const it: Item = { uid: w.newUid(), id: iid, rarity: 'legendaire', stats: {}, extra: [], legendary: { id, value } };
  w.player.equipment[(c.slot === 'anneau' ? 'anneau1' : c.slot) as EquipSlot] = it;
  w.player.recompute();
};
const eniItems = (seed = 7) => { const w = new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed, classId: 'eniripsa', items: ITEMS }); w.waveDelay = 1e9; return w; };

describe('Légendaires de l\'Eniripsa (« Légendaires eni : 1A 2C-2P 3A 4A 5A »)', () => {
  it('1A : les 40 officiels de la Panoplie Altruiste ; 2 : 16 pouvoirs à nous, deux par emplacement ; 4A : boss préférés', () => {
    expect(POUVOIRS.eniripsa).toHaveLength(40);
    expect(POUVOIRS.eniripsa.filter(p => p.effet === 'crit').length).toBeGreaterThan(0);
    const l = POUVOIRS_CLASSE.filter(p => p.classe === 'eniripsa');
    expect(l).toHaveLength(16);
    for (const sl of ['chapeau', 'cape', 'amulette', 'anneau', 'ceinture', 'bottes', 'arme', 'bouclier']) expect(l.filter(p => p.slot === sl), sl).toHaveLength(2);
    expect(Object.values(BOSS_PREFERES).flat().filter(id => id.startsWith('pc-eniripsa-'))).toHaveLength(10);
  });

  it('3A : Dernier Mot ne renforce que le premier soin après le passage sous 20 %', () => {
    const w = eniItems(), p = w.player, q = allie(w);
    porter(w, 'pc-eniripsa-B', 70);
    q.hp = Math.round(q.maxHp * 0.1);
    w.drainEvents();
    soignerAllie(p, q, 1, w, { brut: true }); soignerAllie(p, q, 1, w, { brut: true });
    expect(w.drainEvents().filter(e => e.k === 'status' && e.text === 'Dernier Mot !')).toHaveLength(1);
    q.hp = q.maxHp; idle(w, 0.1); q.hp = Math.round(q.maxHp * 0.1);   // remonté puis retombé : de nouveau prêt
    soignerAllie(p, q, 1, w, { brut: true });
    expect(w.drainEvents().filter(e => e.k === 'status' && e.text === 'Dernier Mot !')).toHaveLength(1);
  });

  it('P : Seconde vie relève sans Insoignable, avec un bouclier', () => {
    const w = eniItems(), p = w.player, q = allie(w, 200);
    porter(w, 'pc-eniripsa-P', 20);
    q.dead = true; q.hp = 0;
    press(w, 'reconstitution', { x: q.x, y: q.y }); idle(w, 0.5);
    expect(q.dead).toBe(false);
    expect(q.insoignableT).toBe(0);
    expect(q.shield).toBe(Math.round(q.maxHp * 0.2));
  });

  it('E + K : Envol protecteur et Envol en série à l\'échange avec un allié', () => {
    const w = eniItems(), p = w.player, q = allie(w, 120);
    porter(w, 'pc-eniripsa-E', 12); porter(w, 'pc-eniripsa-K', 4);
    expect(p.pmMax).toBe(p.cls.pm.max + 1);
    p.pa = 1;
    press(w, 'envol', { x: q.x, y: q.y }); idle(w, 0.5);
    expect(q.shield).toBe(Math.round(q.maxHp * 0.12));
    expect(p.pa).toBeGreaterThanOrEqual(2);
  });

  it('C : Mot tourbillonnant attire au lieu de repousser', () => {
    const w = eniItems(), p = w.player, c = { x: p.x + 150, y: p.y };
    porter(w, 'pc-eniripsa-C', 15); niveau(p, 60);
    const m = w.spawnMonster('bouftou', c.x + 70, c.y); m.state = 'idle'; const d0 = Math.hypot(m.x - c.x, m.y - c.y);
    press(w, 'turbulent', c); idle(w, 0.8);
    expect(Math.hypot(m.x - c.x, m.y - c.y)).toBeLessThan(d0);
  });
});
