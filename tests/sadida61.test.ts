import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { SORTS } from '../src/sim/sorts';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { NO_INPUT, type PlayerInput } from '../src/sim/input';
import { World } from '../src/sim/world';
import { PC_PAR_ID } from '../src/sim/pouvoirsClasse';
import type { EquipSlot } from '../src/sim/items';
import { arbresDe, planter } from '../src/sim/sadida';

const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
const STEP = 1 / 60;
const monde = (test = true) => {
  const w = new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed: 5, items: ITEMS, classId: 'sadida', ...(test ? { test: {} as never } : {}) });
  w.waveDelay = 1e9; w.player.fixerNiveau(90, null); idle(w, 0.2); return w;
};
const idle = (w: World, s: number) => { for (let i = 0; i < s * 60; i++) w.step(STEP, NO_INPUT); };
const lancer = (w: World, id: PlayerInput['pressed'], aim: { x: number; y: number }) => { w.player.pa = 99; w.step(STEP, { ...NO_INPUT, aim, pressed: id }); idle(w, 0.5); };
const cible = (w: World, x: number, y: number) => { const m = w.spawnMonster('bouftou', x, y); m.state = 'chase'; m.hp = m.maxHp = 50000; m.stun = 999; return m; };
const porter = (w: World, id: string, value: number) => {
  const c = PC_PAR_ID[id], [iid] = Object.entries(ITEMS.equipment).find(([, d]) => d.slot === c.slot && !d.familier && d.level <= 20)!;
  w.player.equipment[(c.slot === 'anneau' ? 'anneau1' : c.slot) as EquipSlot] = { uid: w.newUid(), id: iid, rarity: 'legendaire', stats: {}, extra: [], legendary: { id, value } };
  w.player.recompute();
};
const NOUVEAUX = ['arbre_de_vie', 'la_gonflable', 'tremblement', 'inoculation', 'don_naturel', 'la_surpuissante'];

describe('Sorts 61-90 du Sadida (« Sorts sadi : 1A 2A 3A 4A 5A 6A 7A-7H 8A 9A »)', () => {
  it('les 6 sorts officiels du niveau 61 à 90 sont joués, cachés hors partie de test (9A)', () => {
    const C = GAME_DATA.classes.sadida;
    const officiels = SORTS[C.sorts].flatMap(p => p).filter(s => s.grades[0].niv > 60 && s.grades[0].niv <= 90).map(s => s.id);
    expect(officiels).toHaveLength(6);
    for (const id of officiels) expect(Object.values(C.spells).map(d => d.dofusId)).toContain(id);
    const pub = monde(false), test = monde(true);
    for (const k of NOUVEAUX) { expect(C.spells[k].v06, k).toBe(true); expect(pub.player.knows(k), k).toBe(false); expect(test.player.knows(k), k).toBe(true); }
  });

  it('1A Arbre de Vie : Feuillu tout de suite, PV triplés, un seul, soigne les alliés près des Feuillus toutes les 3 s', () => {
    const w = monde(), p = w.player;
    const a = planter(p, p.x + 200, p.y, w)!;
    lancer(w, 'arbre_de_vie', { x: p.x + 80, y: p.y + 40 });
    const v = arbresDe(p, w).find(b => b.sadi!.vie)!;
    expect(v.sadi!.feuillu).toBe(true);
    expect(Math.abs(v.maxHp - a.maxHp * 3)).toBeLessThanOrEqual(2);
    p.hp = p.maxHp / 2; const h = p.hp;
    idle(w, 3.2);
    expect(p.hp).toBeGreaterThan(h);
    p.cd = {}; lancer(w, 'arbre_de_vie', { x: p.x - 80, y: p.y + 40 });
    expect(arbresDe(p, w).filter(b => b.sadi!.vie)).toHaveLength(1);
  });

  it('3A Tremblement : part du Feuillu visé, frappe en cercle de 3 cases et attire vers lui', () => {
    const w = monde(), p = w.player;
    const f = planter(p, p.x + 250, p.y, w, true)!, m = cible(w, f.x + 110, f.y), h = m.hp, d0 = m.x - f.x;
    m.stun = 0; m.state = 'idle';
    lancer(w, 'tremblement', { x: f.x, y: f.y });
    expect(m.hp).toBeLessThan(h);
    expect(m.x - f.x).toBeLessThan(d0);
  });

  it('4A Inoculation : plus forte par Infecté, consomme les Infections autour de la cible ; Vaccin (U) les prolonge', () => {
    const w = monde(), p = w.player, a = cible(w, p.x + 120, p.y), b = cible(w, p.x + 150, p.y + 20);
    a.infecteT = b.infecteT = 3;
    lancer(w, 'inoculation', { x: a.x, y: a.y });
    expect(a.hp).toBeLessThan(50000);
    expect(a.infecteT).toBe(0); expect(b.infecteT).toBe(0);
    porter(w, 'pc-sadida-U', 4);
    a.infecteT = b.infecteT = 3; p.cd = {}; p.casts = {};
    lancer(w, 'inoculation', { x: a.x, y: a.y });
    expect(a.infecteT).toBeGreaterThan(5);
  });

  it('5A Don Naturel : sacrifie la Poupée, partage les dommages avec les autres Poupées ; Don de la forêt (W) rend une charge d\'Arbre', () => {
    const w = monde(), p = w.player; porter(w, 'pc-sadida-W', 30);
    planter(p, p.x + 100, p.y, w); planter(p, p.x - 100, p.y, w);
    lancer(w, 'la_folle', { x: p.x + 100, y: p.y }); lancer(w, 'la_bloqueuse', { x: p.x - 100, y: p.y });
    const fol = w.betes.find(b => !b.dead && b.base === 'sadi_folle')!;
    expect(fol).toBeTruthy();
    lancer(w, 'arbre', { x: p.x, y: p.y + 120 });
    expect(p.charges('arbre').n).toBe(2);
    fol.x = p.x + 60; fol.y = p.y;
    lancer(w, 'don_naturel', { x: fol.x, y: fol.y });
    expect(fol.dead).toBe(true);
    expect(p.donT).toBeGreaterThan(0);
    expect(p.charges('arbre').n).toBe(3);
    p.invuln = 0; const h = p.hp, bl = w.betes.find(b => !b.dead && b.base === 'sadi_bloqueuse')!, hb = bl.hp;
    p.hurt(100, p.x + 30, p.y, w);
    expect(bl.hp).toBeLessThan(hb);
    expect(h - p.hp).toBeLessThan(100);
  });

  it('2A Gonflable : soigne un allié sous 70 % et repousse le monstre collé au Sadida', () => {
    const w = monde(), p = w.player;
    planter(p, p.x + 100, p.y, w);
    lancer(w, 'la_gonflable', { x: p.x + 100, y: p.y });
    expect(w.betes.some(b => !b.dead && b.base === 'sadi_gonflable')).toBe(true);
    p.hp = p.maxHp * 0.5; const h = p.hp;
    const m = cible(w, p.x + 40, p.y); m.stun = 0; m.state = 'idle';
    idle(w, 0.5);
    expect(p.hp).toBeGreaterThan(h);
    expect(m.hp).toBeLessThan(50000);
  });

  it('6A Surpuissante : appelle La Fourbe, qui part avec elle', () => {
    const w = monde(), p = w.player;
    planter(p, p.x + 100, p.y, w);
    lancer(w, 'la_surpuissante', { x: p.x + 100, y: p.y });
    idle(w, 1);
    const s = w.betes.find(b => !b.dead && b.base === 'sadi_surpuissante')!, f = w.betes.find(b => !b.dead && b.base === 'sadi_fourbe')!;
    expect(s).toBeTruthy(); expect(f).toBeTruthy();
    s.mourir(w);
    expect(f.dead).toBe(true);
  });

  it('7A-7H : 8 pouvoirs de plus, un par emplacement (3 par emplacement en tout)', () => {
    for (const l of 'QRSTUVWX') expect(PC_PAR_ID[`pc-sadida-${l}`], l).toBeDefined();
  });
});
