import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA } from '../src/sim/data';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { NO_INPUT, type PlayerInput } from '../src/sim/input';
import { World } from '../src/sim/world';

const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
const STEP = 1 / 60;
const sacri = (seed = 7) => { const w = new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed, classId: 'sacrieur' }); w.waveDelay = 1e9; return w; };
const press = (w: World, pressed: PlayerInput['pressed'], aim = { x: w.player.x + 80, y: w.player.y }) => w.step(STEP, { ...NO_INPUT, aim, pressed });
const idle = (w: World, s: number) => { for (let i = 0; i < s * 60; i++) w.step(STEP, NO_INPUT); };
const niveau = (p: World['player'], n: number) => { p.level = n; p.recompute(); p.learnSpells(null); };
const mannequin = (w: World, x: number, y: number) => { const m = w.spawnMonster('bouftou', x, y); m.mannequin = true; m.poseTest = true; m.state = 'idle'; return m; };

describe('Sacrieur (maquette Sacrieur, 2026-11-08)', () => {
  it('niveau 1 : les 4 vols de vie officiels, Absorption au clic droit, Ravage sur Espace (5A 6A)', () => {
    const p = sacri().player;
    expect(p.bar[6]).toBe('absorption');
    expect(p.bar.slice(0, 3)).toEqual(['hemorragie', 'supplice', 'stase']);
    expect(p.bar[7]).toBe('ravage');
    expect(p.knows('attirance')).toBe(false);
    for (const id of Object.keys(p.cls.spells)) expect(readFileSync(new URL(`../public/assets/ui/sorts/sort_${p.cls.spells[id].icon}.png`, import.meta.url)).length).toBeGreaterThan(100);
  });

  it('les sorts arrivent à leur niveau officiel ; l\'Épée Vorace va sur la barre normale, pas sur A Z R T', () => {
    const p = sacri().player;
    niveau(p, 60);
    for (const k of ['attirance', 'mutilation', 'epee_vorace', 'assaut', 'transposition', 'condensation', 'hostilite', 'couronne', 'transfusion', 'dissolution', 'desolation']) expect(p.knows(k)).toBe(true);
    expect(p.bar.slice(8)).toEqual([null, null, null, null]);
  });

  it('Souffrance officielle : un palier par tranche de 10 % de PV perdus, dommages subis et dommages finaux (1A)', () => {
    const p = sacri().player;
    expect(p.souffrance).toBe(0);
    const d0 = p.damage(100, 'terre');
    p.hp = Math.round(p.maxHp * 0.95); p.souffT = 0; p.souffPic = 0;
    expect(p.souffranceBrute).toBe(1);
    p.hp = Math.round(p.maxHp * 0.05);
    expect(p.souffranceBrute).toBe(10);
    p.souffPic = 10;
    expect(p.damage(100, 'terre') / d0).toBeCloseTo(1.3, 2);
  });

  it('les dommages reçus baissent avec la Souffrance (−30 % au palier 10)', () => {
    const w = sacri(), p = w.player;
    p.invuln = 0; const h0 = p.hp; p.hurt(100, p.x + 30, p.y, w); const plein = h0 - p.hp;
    p.hp = Math.round(p.maxHp * 0.06); p.souffPic = 10; p.souffT = 9; p.invuln = 0;
    const h1 = p.hp; p.hurt(100, p.x + 30, p.y, w);
    expect((h1 - p.hp) / plein).toBeLessThan(0.75);
  });

  it('mémoire de la douleur (3B) : après un soin, le palier tient 3 s puis redescend', () => {
    const w = sacri(), p = w.player;
    p.hp = Math.round(p.maxHp * 0.25); idle(w, 0.1);
    expect(p.souffrance).toBe(8);
    p.hp = p.maxHp; idle(w, 1);
    expect(p.souffrance).toBe(8);
    idle(w, 2.5);
    expect(p.souffrance).toBe(0);
  });

  it('Mutilation sacrifie des PV sans jamais tuer (2A), relancée elle donne la Coagulation', () => {
    const w = sacri(), p = w.player;
    niveau(p, 10);
    p.hp = 3; press(w, 'mutilation'); idle(w, 0.6);
    expect(p.hp).toBeGreaterThanOrEqual(1);
    expect(p.dead).toBe(false);
    expect(p.stat('puissance')).toBeGreaterThanOrEqual(50);
    p.hp = p.maxHp; idle(w, 3.5);
    expect(p.mutil?.n).toBe(2);
    p.pa = p.paMax; press(w, 'mutilation'); idle(w, 0.6);
    expect(p.mutil).toBeNull();
    expect(p.shield).toBeGreaterThan(0);
  });

  it('Attirance tire le monstre au contact, Transposition échange les places', () => {
    const w = sacri(), p = w.player;
    niveau(p, 30);
    const m = w.spawnMonster('bouftou', p.x + 280, p.y); m.state = 'idle'; const d0 = Math.hypot(m.x - p.x, m.y - p.y);
    press(w, 'attirance', { x: m.x, y: m.y }); idle(w, 0.5);
    expect(Math.hypot(m.x - p.x, m.y - p.y)).toBeLessThan(d0 - 150);
    m.hp = 0; m.dead = true;
    const m2 = mannequin(w, p.x - 200, p.y), avant = { x: p.x, y: p.y }, cible = { x: m2.x, y: m2.y };
    p.pa = p.paMax; press(w, 'transposition', cible); idle(w, 0.6);
    expect(Math.hypot(p.x - cible.x, p.y - cible.y)).toBeLessThan(24);
    expect(Math.hypot(m2.x - avant.x, m2.y - avant.y)).toBeLessThan(40);
  });

  it('Épée Vorace : une alliée avec son squelette officiel, la nouvelle remplace l\'ancienne', () => {
    const w = sacri(), p = w.player;
    niveau(p, 15);
    press(w, 'epee_vorace'); idle(w, 0.8);
    expect(w.betes.filter(b => !b.dead).map(b => b.def.name)).toEqual(['Épée Vorace']);
    expect(w.betes[0].look).toBe('sacri_epee_vorace');
  });

  it('Couronne d\'Épines renvoie les coups de mêlée', () => {
    const w = sacri(), p = w.player;
    niveau(p, 45);
    press(w, 'couronne'); idle(w, 0.6);
    const m = mannequin(w, p.x + 40, p.y), hp = m.hp;
    p.invuln = 0; p.hurt(30, m.x, m.y, w);
    expect(m.hp).toBeLessThan(hp);
  });

  it('jouable seulement dans la partie de test (12A) et dans le tutoriel du Temple (13A)', () => {
    const src = readFileSync(new URL('../src/render/accueil.ts', import.meta.url), 'utf8');
    expect(src).toMatch(/EN_ESSAI = new Set\(\[[^\]]*'sacrieur'/);
    const q = JSON.parse(readFileSync(new URL('../src/data/quetes.json', import.meta.url), 'utf8'));
    expect(JSON.stringify(q)).toContain('jeune Sacrieur');
  });
});
