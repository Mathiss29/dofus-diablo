import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { NO_INPUT, type PlayerInput } from '../src/sim/input';
import { World } from '../src/sim/world';
import { doubleDe, invisible, invisiblePour } from '../src/sim/sram';

const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
const STEP = 1 / 60;
const sram = (seed = 7) => { const w = new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed, items: ITEMS, classId: 'sram', test: {} as never }); w.waveDelay = 1e9; return w; };
const idle = (w: World, s: number) => { for (let i = 0; i < s * 60; i++) w.step(STEP, NO_INPUT); };
const press = (w: World, pressed: PlayerInput['pressed'], aim: { x: number; y: number }) => { w.player.pa = 99; w.player.cd = {}; w.player.casts = {}; w.step(STEP, { ...NO_INPUT, aim, pressed }); };
const niveau = (p: World['player'], n: number) => { p.level = n; p.recompute(); p.learnSpells(null); p.pa = p.paMax; };
/** Monstre en chasse, increvable, figé ou non. */
const cible = (w: World, x: number, y: number, hp = 50000, fige = true) => { const m = w.spawnMonster('bouftou', x, y); m.state = 'chase'; m.hp = m.maxHp = hp; if (fige) m.stun = 999; return m; };

describe('Sram (« Classes : 5A 6A+6C 7A+7B 8A 9A », « Sram : 1A 2A 3A 4A 5A … 9A »)', () => {
  it('niveau 1 : Sournoiserie au clic droit, pas sur Espace, Piège Sournois et Invisibilité dès le départ (tutoriel)', () => {
    const w = sram(); idle(w, 0.2);
    const p = w.player;
    expect(p.cls.clicDroit).toBe('sournoiserie');
    expect(p.cls.mobility).toBe('pas_sram');
    expect(p.knows('piege_sournois')).toBe(true);
    expect(p.knows('invisibilite')).toBe(true);
    expect(p.knows('double')).toBe(false);
    expect(p.bar).toContain('truanderie');
    expect((QUETES.quetes.reponses.etapes as Record<string, unknown[]>).sram?.length).toBeGreaterThan(5);
  });

  it('7A : le piège s\'arme en 0,5 s et saute quand un monstre passe dessus ; Ruse +20', () => {
    const w = sram(); idle(w, 0.2);
    const p = w.player, x = p.x + 120, y = p.y;
    press(w, 'piege_sournois', { x, y }); idle(w, 0.5);
    expect(p.sram!.pieges).toHaveLength(1);
    const m = cible(w, x + 4, y), hp = m.hp;
    idle(w, 0.2);
    expect(p.sram!.pieges).toHaveLength(0);
    expect(m.hp).toBeLessThan(hp);
    expect(p.rage).toBe(p.cls.sram!.ruse.parPiege);
  });

  it('7A + 7B : 5 pièges au plus ; X les fait tous sauter', () => {
    const w = sram(); idle(w, 0.2);
    const p = w.player;
    for (let i = 0; i < 7; i++) { press(w, 'piege_sournois', { x: p.x + 60 + i * 40, y: p.y + 100 }); idle(w, 0.45); }
    expect(p.sram!.pieges).toHaveLength(5);
    const ms = [0, 1, 2].map(i => cible(w, p.x + 60 + (i + 2) * 40, p.y + 300));
    ms.forEach(m => { m.x = p.x + 60 + 2 * 40 + ms.indexOf(m) * 40; m.y = p.y + 100 + 30; });
    const hp = ms.map(m => m.hp);
    w.step(STEP, { ...NO_INPUT, coffre: true });
    expect(p.sram!.pieges).toHaveLength(0);
    expect(ms.some((m, i) => m.hp < hp[i])).toBe(true);
  });

  it('1A : Ruse pleine, le piège suivant est doublé (deux fois les dégâts) et vide la jauge', () => {
    const w = sram(); idle(w, 0.2);
    const p = w.player, x = p.x + 120, y = p.y;
    press(w, 'piege_sournois', { x, y }); idle(w, 0.8);
    const m1 = cible(w, x, y); const h1 = m1.hp; idle(w, 0.1);
    const d1 = h1 - m1.hp; m1.dead = true;
    p.rage = p.cls.rage.max; p.lastHitAt = p.age;   // (la jauge retombe 6 s après le dernier coup)
    press(w, 'piege_sournois', { x, y: y + 150 }); idle(w, 0.8);
    expect(p.rage).toBe(0);
    expect(p.sram!.pieges[0].double).toBe(true);
    const m2 = cible(w, x, y + 150); const h2 = m2.hp; idle(w, 0.1);
    expect(h2 - m2.hp).toBeGreaterThan(d1 * 1.5);
  });

  it('6A + 6C : invisible, les monstres perdent ta trace ; un boss te retrouve au bout d\'1 s ; frapper te montre', () => {
    const w = sram(); idle(w, 0.2);
    const p = w.player, m = cible(w, p.x + 100, p.y, 50000, false);
    expect(w.cibleDe(m)).toBe(p);
    press(w, 'invisibilite', { x: p.x, y: p.y }); idle(w, 0.4);
    expect(invisible(p)).toBe(true);
    expect(w.cibleDe(m)).not.toBe(p);
    expect(w.cibleDe(m).dead).toBe(true);   // il abandonne la poursuite
    const boss = { def: { boss: true } } as never;
    expect(invisiblePour(p, boss, w)).toBe(true);
    idle(w, 1);
    expect(invisiblePour(p, boss, w)).toBe(false);
    const m2 = cible(w, p.x + 60, p.y);
    press(w, 'truanderie', { x: m2.x, y: m2.y }); idle(w, 0.3);
    expect(invisible(p)).toBe(false);   // montré 0,5 s
    idle(w, 0.5);
    expect(invisible(p)).toBe(true);
    idle(w, 3);
    expect(p.sram!.invisT).toBe(0);
  });

  it('6C : achever un monstre pendant l\'Invisibilité la recharge ; Ruse +25', () => {
    const w = sram(); idle(w, 0.2);
    const p = w.player;
    w.step(STEP, { ...NO_INPUT, aim: { x: p.x, y: p.y }, pressed: 'invisibilite' }); idle(w, 0.4);
    expect(p.cd.invisibilite).toBeGreaterThan(0);
    const m = cible(w, p.x + 60, p.y, 10);
    w.killMonster(m);
    expect(p.cd.invisibilite).toBe(0);
    expect(p.rage).toBe(p.cls.sram!.ruse.parAcheve);
  });

  it('5A : Truanderie vole de la Puissance : tu frappes plus fort, le monstre moins', () => {
    const w = sram(); idle(w, 0.2);
    const p = w.player, m = cible(w, p.x + 80, p.y);
    const avant = p.damage(100, 'feu');
    press(w, 'truanderie', { x: m.x, y: m.y }); idle(w, 0.4);
    expect(p.damage(100, 'feu')).toBeGreaterThan(avant);
    expect(m.furyPct).toBeLessThan(0);
    idle(w, 3.2);
    expect(p.damage(100, 'feu')).toBeCloseTo(avant, 0);
  });

  it('2A : Arsenic empoisonne 3 s et retire de la Portée', () => {
    const w = sram(); idle(w, 0.2);
    const p = w.player, m = cible(w, p.x + 100, p.y);
    press(w, 'arsenic', { x: m.x, y: m.y }); idle(w, 0.3);
    expect(m.poisonT).toBeGreaterThan(2);
    expect(m.poMalus).toBe(2);
    const hp = m.hp; idle(w, 1);
    expect(m.hp).toBeLessThan(hp);
  });

  it('8A : le Double attire les monstres ; à sa mort tu prends sa place et tu cours plus vite', () => {
    const w = sram(); idle(w, 0.2);
    const p = w.player; niveau(p, 10);
    const m = cible(w, p.x + 200, p.y, 50000, false);
    press(w, 'double', { x: p.x + 48, y: p.y }); idle(w, 0.6);
    const b = doubleDe(p, w)!;
    expect(b).toBeTruthy();
    expect(w.cibleDe(m)).toBe(b);
    const pos = { x: b.x, y: b.y }, v = p.speed;
    b.mourir(w); idle(w, 0.05);
    expect(Math.hypot(p.x - pos.x, p.y - pos.y)).toBeLessThan(2);
    expect(p.speed).toBeGreaterThan(v);
  });

  it('3A : Peur en deux temps : le monstre, puis la case (le premier lancer est rendu)', () => {
    const w = sram(); idle(w, 0.2);
    const p = w.player; niveau(p, 60);
    const m = cible(w, p.x + 150, p.y); m.stun = 0; m.state = 'idle'; (m as { def: unknown }).def = { ...m.def, speed: 0 };
    p.pa = p.paMax;
    const pa = p.pa;
    w.step(STEP, { ...NO_INPUT, aim: { x: m.x, y: m.y }, pressed: 'peur' }); idle(w, 0.45);
    expect(p.sram!.peur).toBe(m.id);
    expect(p.pa).toBeGreaterThanOrEqual(pa - 0.01);
    const x0 = m.x, y0 = m.y;
    press(w, 'peur', { x: m.x, y: m.y + 200 }); idle(w, 1);
    expect(p.sram!.peur).toBe(null);
    expect(Math.hypot(m.x - x0, m.y - y0)).toBeGreaterThan(80);
  });
  it('sorts 61-120 : cachés sans la 0.6 / 0.7, appris au niveau 120 avec elles', () => {
    const w = sram(); idle(w, 0.2);
    const p = w.player; niveau(p, 120);
    p.v06 = false; p.v07 = false;
    expect(p.knows('piege_mortel')).toBe(false);
    p.v06 = true; p.v07 = true; niveau(p, 120);
    for (const k of ['piege_derive', 'piege_scelerat', 'chakra', 'piege_mortel', 'fourvoiement', 'derobade']) expect(p.knows(k), k).toBe(true);
    p.variants = Array(22).fill(1); niveau(p, 120);
    for (const k of ['chausse_trappe', 'coupe_gorge', 'toxines', 'poisse', 'brume', 'comploteur']) expect(p.knows(k), k).toBe(true);
  });

  it('Piège Mortel : bien plus fort sous la moitié des PV', () => {
    const w = sram(); idle(w, 0.2);
    const p = w.player; p.v06 = true; niveau(p, 90);
    const x = p.x + 120, y = p.y;
    press(w, 'piege_mortel', { x, y }); idle(w, 0.8);
    const a = cible(w, x, y); const ha = a.hp; idle(w, 0.1); const da = ha - a.hp; a.dead = true;
    press(w, 'piege_mortel', { x, y: y + 150 }); idle(w, 0.8);
    const b = cible(w, x, y + 150); b.hp = b.maxHp * 0.3; const hb = b.hp; idle(w, 0.1);
    expect(hb - b.hp).toBeGreaterThan(da * 1.3);
  });

  it('Concentration de Chakra : un piège sur la cible marquée te soigne', () => {
    const w = sram(); idle(w, 0.2);
    const p = w.player; p.v06 = true; niveau(p, 90);
    const x = p.x + 120, y = p.y;
    press(w, 'piege_sournois', { x, y }); idle(w, 0.6);
    const m = cible(w, x + 200, y);
    press(w, 'chakra', { x: m.x, y: m.y }); idle(w, 0.3);
    expect(p.sram!.chakra.some(c => c.mid === m.id)).toBe(true);
    p.hp = p.maxHp / 2; const hp = p.hp;
    m.x = x; m.y = y; idle(w, 0.2);
    expect(p.hp).toBeGreaterThan(hp);
  });

  it('Chausse-trappe : plus fort après des pièges sautés, le compte repart à zéro', () => {
    const w = sram(); idle(w, 0.2);
    const p = w.player; p.v07 = true; p.variants = Array(22).fill(1); niveau(p, 120);
    Object.defineProperty(p, 'critChance', { get: () => 0 });
    const m = cible(w, p.x + 100, p.y);
    const h0 = m.hp; press(w, 'chausse_trappe', { x: m.x, y: m.y }); idle(w, 0.4); const d0 = h0 - m.hp;
    p.sram!.sautes = 5;
    const h1 = m.hp; press(w, 'chausse_trappe', { x: m.x, y: m.y }); idle(w, 0.4); const d1 = h1 - m.hp;
    expect(d1).toBeGreaterThan(d0 * 1.4);
    expect(p.sram!.sautes).toBe(0);
  });

  it('Brume : invisible dans la zone, Comploteur explose à sa mort', () => {
    const w = sram(); idle(w, 0.2);
    const p = w.player; p.v07 = true; p.variants = Array(22).fill(1); niveau(p, 120);
    press(w, 'brume', { x: p.x, y: p.y }); idle(w, 0.3);
    expect(invisible(p)).toBe(true);
    idle(w, 4);
    const m = cible(w, p.x + 90, p.y);
    press(w, 'comploteur', { x: p.x + 60, y: p.y }); idle(w, 0.6);
    const b = doubleDe(p, w)!; expect(b).toBeTruthy();
    m.x = b.x + 20; m.y = b.y; const hp = m.hp;
    b.mourir(w); idle(w, 0.05);
    expect(m.hp).toBeLessThan(hp);
  });
});
