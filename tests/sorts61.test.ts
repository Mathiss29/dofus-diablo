import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { NO_INPUT, type PlayerInput } from '../src/sim/input';
import { World } from '../src/sim/world';
import { SORTS } from '../src/sim/sorts';

const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
const STEP = 1 / 60;
const monde = (classId: string, test = true, niveau = 90) => {
  const w = new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed: 5, items: ITEMS, classId, ...(test ? { test: {} as never } : {}) });
  w.waveDelay = 1e9; w.player.fixerNiveau(niveau, null); return w;
};
const idle = (w: World, s: number) => { for (let i = 0; i < s * 60; i++) w.step(STEP, NO_INPUT); };
const lancer = (w: World, id: PlayerInput['pressed'], aim: { x: number; y: number }) => { w.player.pa = 99; w.step(STEP, { ...NO_INPUT, aim, pressed: id }); idle(w, 0.6); };
const monstre = (w: World, dx: number) => { const m = w.spawnMonster('bouftou', w.player.x + dx, w.player.y); m.state = 'idle'; m.maxHp = m.hp = 1e6; return m; };

const NOUVEAUX: Record<string, string[]> = {
  iop: ['friction', 'precipitation', 'epee_destin', 'emprise'],
  cra: ['tir_repli', 'punitive', 'expiation', 'perforante', 'devorante', 'acuite'],
  osamodas: ['ventritofu', 'bouflourd', 'crapipaud', 'dragonnet', 'esprit_glouton'],
  sacrieur: ['sacrifice', 'bain_sang', 'hecatombe', 'libation', 'berserk', 'punition'],
};

describe('Sorts 61-90 du Iop, du Crâ, de l\'Osamodas et du Sacrieur (0.6, ligne « 0.6 : 7A+7C »)', () => {
  it('chaque sort officiel du niveau 61 à 90 de ces 4 classes a sa fiche jouable, cachée hors partie de test', () => {
    for (const [cls, keys] of Object.entries(NOUVEAUX)) {
      const C = GAME_DATA.classes[cls];
      const officiels = SORTS[C.sorts].flatMap(p => p).filter(s => s.grades[0].niv > 60 && s.grades[0].niv <= 90).map(s => s.id);
      const joues = Object.values(C.spells).map(d => d.dofusId);
      for (const id of officiels) expect(joues, `${cls} ${id}`).toContain(id);
      for (const k of keys) expect(C.spells[k].v06, k).toBe(true);
      const pub = monde(cls, false), test = monde(cls, true);
      for (const k of keys) { expect(pub.player.knows(k), k).toBe(false); expect(test.player.knows(k), k).toBe(true); }
    }
  });

  it('Iop : Emprise fige l\'ennemi et le rend intouchable 3 s ; Épée du Destin frappe plus fort si on attend', () => {
    const w = monde('iop'), p = w.player, m = monstre(w, 60);
    lancer(w, 'emprise', { x: m.x, y: m.y });
    expect(m.intouchable).toBe(true); expect(m.stun).toBeGreaterThan(1.5);
    idle(w, 3);
    expect(m.intouchable).toBe(false);
    p.e61!.destinA = p.age;   // vient d'être lancée
    const m2 = monstre(w, 150), a = m2.hp;
    lancer(w, 'epee_destin', { x: m2.x, y: m2.y }); const tot = a - m2.hp;
    p.e61!.destinA = -99; p.cd.epee_destin = 0;
    const b = m2.hp; lancer(w, 'epee_destin', { x: m2.x, y: m2.y });
    expect(b - m2.hp).toBeGreaterThan(tot * 1.5);
  });

  it('Iop : Friction tire l\'ennemi visé vers son agresseur', () => {
    const w = monde('iop'), p = w.player, m = monstre(w, 180);
    const d0 = Math.hypot(m.x - p.x, m.y - p.y);
    lancer(w, 'friction', { x: m.x, y: m.y }); idle(w, 2);
    expect(Math.hypot(m.x - p.x, m.y - p.y)).toBeLessThan(d0 - 40);
  });

  it('Crâ : Flèche Dévorante cumule sur le même ennemi, l\'ancienne cible prend un dernier coup quand on change', () => {
    const w = monde('cra'), p = w.player, m = monstre(w, 100), n = monstre(w, -100);
    lancer(w, 'devorante', { x: m.x, y: m.y }); p.casts.devorante = []; lancer(w, 'devorante', { x: m.x, y: m.y });
    expect(p.e61!.dev).toMatchObject({ mid: m.id, n: 2 });
    const avant = m.hp; p.casts.devorante = [];
    lancer(w, 'devorante', { x: n.x, y: n.y });
    expect(m.hp).toBeLessThan(avant);
    expect(p.e61!.dev).toMatchObject({ mid: n.id, n: 1 });
  });

  it('Crâ : Acuité Absolue enlève la ligne de vue et donne du Critique pendant 12 s', () => {
    const w = monde('cra'), p = w.player, c0 = p.critChance;
    lancer(w, 'acuite', { x: p.x + 50, y: p.y });
    expect(p.demandeVue('punitive')).toBe(false);
    expect(p.critChance).toBeCloseTo(c0 + 0.1);
    idle(w, 12.5);
    expect(p.demandeVue('punitive')).toBe(true);
  });

  it('Osamodas : Esprit Glouton invoque le Gobgob, la recharge ne part qu\'à sa mort', () => {
    const w = monde('osamodas'), p = w.player;
    lancer(w, 'esprit_glouton', { x: p.x + 60, y: p.y });
    const g = w.betes.find(b => b.base === 'gobgob_glouton' && !b.dead)!;
    expect(g).toBeTruthy();
    expect(p.cd.esprit_glouton).toBeGreaterThan(30);
    g.mourir(w); idle(w, 0.1);
    expect(p.cd.esprit_glouton).toBeLessThanOrEqual(6);
    lancer(w, 'ventritofu', { x: p.x + 60, y: p.y });
    expect(w.betes.some(b => b.base === 'ventritofu' && !b.dead)).toBe(true);
  });

  it('Sacrieur : Berserk sacrifie des PV, renforce et finit sous Souffrance 6 ; Libation retire les malus puis soigne', () => {
    const w = monde('sacrieur'), p = w.player;
    p.hp = p.maxHp;
    const base = p.damage(100, 'terre');
    lancer(w, 'berserk', { x: p.x, y: p.y });
    expect(p.hp).toBeLessThan(p.maxHp * 0.35);
    expect(p.e61!.berserk).toBeTruthy();
    expect(p.damage(100, 'terre')).toBeGreaterThan(base * 1.2);
    p.hp = p.maxHp; idle(w, 4);   // soigné : sous Souffrance 6, Berserk prend fin
    expect(p.e61!.berserk).toBeNull();
    p.hp = p.maxHp; p.slow(5, 0.5); p.addMod('puissance', -40, 10, 'malus');
    lancer(w, 'libation', { x: p.x, y: p.y });
    expect(p.slowT).toBe(0); expect(p.mods.some(x => x.src === 'malus')).toBe(false);
    const apres = p.hp; idle(w, 5);
    expect(p.hp).toBeGreaterThan(apres);
  });

  it('Sacrieur : Sacrifice encaisse à la place d\'un allié proche ; Punition frappe plus fort quand on a perdu des PV', () => {
    const w = monde('sacrieur'), p = w.player, q = w.ajouterJoueur('iop');
    q.x = p.x + 60; q.y = p.y; idle(w, 0.1);
    lancer(w, 'sacrifice', { x: p.x, y: p.y });
    const hq = q.hp, hp = p.hp;
    q.hurt(50, q.x + 30, q.y, w);
    expect(q.hp).toBe(hq); expect(p.hp).toBeLessThan(hp);
    const m = monstre(w, 50); m.stun = 99;
    p.hp = p.maxHp; let a = m.hp; lancer(w, 'punition', { x: m.x, y: m.y }); const plein = a - m.hp;
    p.cd.punition = 0; p.hp = Math.round(p.maxHp * 0.3); idle(w, 5); a = m.hp;   // Souffrance retombée à 7 : on compare la part Neutre
    lancer(w, 'punition', { x: m.x, y: m.y });
    expect(a - m.hp).toBeGreaterThan(plein * 1.5);
  });
});
