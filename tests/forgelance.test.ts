import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA } from '../src/sim/data';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { NO_INPUT, type PlayerInput } from '../src/sim/input';
import { CASE } from '../src/sim/monster';
import { World } from '../src/sim/world';

const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
const STEP = 1 / 60;
const fl = (seed = 7) => { const w = new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed, classId: 'forgelance' }); w.waveDelay = 1e9; return w; };
const press = (w: World, pressed: PlayerInput['pressed'], aim = { x: w.player.x + 120, y: w.player.y }) => w.step(STEP, { ...NO_INPUT, aim, pressed });
const idle = (w: World, s: number) => { for (let i = 0; i < s * 60; i++) w.step(STEP, NO_INPUT); };
const niveau = (p: World['player'], n: number) => { p.level = n; p.recompute(); p.learnSpells(null); };
const mannequin = (w: World, x: number, y: number) => { const m = w.spawnMonster('bouftou', x, y); m.mannequin = true; m.poseTest = true; m.state = 'idle'; return m; };
const libre = (w: World) => { const p = w.player; for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) if (w.walkable(p.x + Math.cos(a) * 150, p.y + Math.sin(a) * 150)) return { x: p.x + Math.cos(a) * 150, y: p.y + Math.sin(a) * 150 }; return { x: p.x + 150, y: p.y }; };

describe('Forgelance (maquette Forgelance, 2026-11-08)', () => {
  it('niveau 1 : les 4 sorts officiels, Épilogue au clic droit et Saut à la Lance sur Espace (7A 8B)', () => {
    const p = fl().player;
    expect(p.bar.slice(0, 4)).toEqual(['trident', 'effondrement', 'estoc_brulant', 'volee_airain']);
    expect(p.bar[6]).toBe('epilogue');
    expect(p.bar[7]).toBe('saut');
    expect(p.knows('charge_heroique')).toBe(false);
    for (const id of Object.keys(p.cls.spells)) expect(readFileSync(new URL(`../public/assets/ui/sorts/sort_${p.cls.spells[id].icon}.png`, import.meta.url)).length).toBeGreaterThan(100);
  });

  it('les 16 sorts du palier 1 arrivent à leur niveau officiel', () => {
    const p = fl().player;
    niveau(p, 60);
    for (const k of ['charge_heroique', 'lance_lac', 'lance_pierre', 'phalange', 'lance_incendie', 'javeline_myr', 'balestra', 'talon_argile', 'kyrja', 'muspel', 'prelude_fer']) expect(p.knows(k)).toBe(true);
  });

  it('Armé : Garde officielle, 15 % de dégâts en moins ; Désarmé, plus de Garde (2A)', () => {
    const w = fl(), p = w.player;
    expect(p.arme).toBe(true);
    p.invuln = 0; let h = p.hp; p.hurt(100, p.x + 30, p.y, w); const arme = h - p.hp;
    p.lance = { x: p.x + 300, y: p.y, t: 0 }; p.invuln = 0; h = p.hp; p.hurt(100, p.x + 30, p.y, w); const desarme = h - p.hp;
    expect(arme / desarme).toBeCloseTo(0.85, 1);
  });

  it('Épilogue plante la Lance, puis la rappelle : +30 Puissance 9 s (3A)', () => {
    const w = fl(), p = w.player, cible = libre(w);
    press(w, 'epilogue', cible); idle(w, 0.5);
    expect(p.lance).not.toBeNull();
    expect(p.arme).toBe(false);
    expect(p.autoAttack).toBe('attaque');   // Désarmé : coups de poing (9A)
    idle(w, 3);   // Épilogue : 1 lancer par tour officiel = 3 s
    press(w, 'epilogue', cible); idle(w, 0.5);
    expect(p.lance).toBeNull();
    expect(p.mods.find(m => m.src === 'reprise')?.n).toBe(30);
    expect(p.autoAttack).toBe('estoc');
  });

  it('Reprise de Volée : marcher sur la Lance la reprend, bonus doublé à pied (3B)', () => {
    const w = fl(), p = w.player;
    p.lance = { x: p.x + 10, y: p.y, t: 1 };
    idle(w, 0.1);
    expect(p.lance).toBeNull();
    expect(p.mods.find(m => m.src === 'reprise')?.n).toBe(60);
  });

  it('la Lance revient seule au-delà de 15 cases, sans bonus (4A)', () => {
    const w = fl(), p = w.player;
    p.lance = { x: p.x + 16 * CASE, y: p.y, t: 1 };
    idle(w, 0.1);
    expect(p.lance).toBeNull();
    expect(p.mods.some(m => m.src === 'reprise')).toBe(false);
  });

  it('Rappel tranchant : la Lance qui revient frappe ce qu\'elle traverse (1B)', () => {
    const w = fl(), p = w.player, m = mannequin(w, p.x + 150, p.y);
    p.lance = { x: p.x + 300, y: p.y, t: 1 };
    const h = m.hp;
    p.rappelerLance(w);
    expect(m.hp).toBeLessThan(h);
  });

  it('Désarmé, Effondrement part de la Lance où que l\'on vise (5A)', () => {
    const w = fl(), p = w.player;
    const L = { x: p.x + 200, y: p.y + 40 };
    p.lance = { ...L, t: 1 };
    const atterrit = p.landing('effondrement', { x: p.x - 100, y: p.y }, w);
    expect(atterrit).toEqual({ x: L.x, y: L.y });
  });

  it('Saut à la Lance : bondit jusqu\'à elle et la reprend à pied (8B)', () => {
    const w = fl(), p = w.player, c = libre(w);
    p.lance = { x: c.x, y: c.y, t: 1 };
    press(w, 'saut', { x: p.x, y: p.y + 200 }); idle(w, 0.6);
    expect(p.lance).toBeNull();
    expect(Math.hypot(p.x - c.x, p.y - c.y)).toBeLessThan(CASE * 1.5);
    expect(p.mods.find(m => m.src === 'reprise')?.n).toBe(60);
  });

  it('Phalange donne un bouclier aux autres joueurs de la zone (coop, 11A)', () => {
    const w = fl(), p = w.player;
    niveau(p, 25);
    const q = w.ajouterJoueur('iop');
    q.x = p.x + 40; q.y = p.y;
    press(w, 'phalange'); idle(w, 0.5);
    expect(p.shield).toBeGreaterThan(0);
    expect(q.shield).toBeGreaterThan(0);
  });

  it('chaque Forgelance a sa propre Lance en coop', () => {
    const w = fl(), p = w.player, q = w.ajouterJoueur('forgelance');
    p.lance = { x: p.x + 200, y: p.y, t: 1 };
    expect(q.lance).toBeNull();
    expect(q.arme).toBe(true);
  });
});

describe('Tutoriel Forgelance (16A)', () => {
  it('a sa trame au Temple Céleste, avec des sorts et une panoplie qui existent', () => {
    const Q = JSON.parse(readFileSync(new URL('../src/data/quetes.json', import.meta.url), 'utf8'));
    const et = Q.quetes.reponses.etapes.forgelance as { nom: string; objectifs: { sort?: string; objets?: string[] }[] }[];
    expect(et.map(e => e.nom)).toContain('Planter la Lance');
    const sp = GAME_DATA.classes.forgelance.spells;
    for (const e of et) for (const o of e.objectifs) if (o.sort) expect(sp[o.sort], o.sort).toBeTruthy();
  });
});
