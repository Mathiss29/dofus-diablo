import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import type { EquipSlot } from '../src/sim/items';
import { POUVOIRS } from '../src/sim/pouvoirs';
import { PC_PAR_ID, POUVOIRS_CLASSE } from '../src/sim/pouvoirsClasse';
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

describe('Légendaires du Sacrieur (14A 14B 15A 15B 15E, avec les jets des légendaires de classe)', () => {
  const sacriTest = () => { const w = new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed: 7, classId: 'sacrieur', items: ITEMS, test: {} as never }); w.waveDelay = 1e9; w.test!.invincible = false; return w; };
  const porter = (w: World, id: string, value: number) => {
    const c = PC_PAR_ID[id], [iid] = Object.entries(ITEMS.equipment).find(([, d]) => d.slot === c.slot && !d.familier && d.level <= 20)!;
    w.player.equipment[(c.slot === 'anneau' ? 'anneau1' : c.slot) as EquipSlot] = { uid: w.newUid(), id: iid, rarity: 'legendaire', stats: {}, extra: [], legendary: { id, value } };
    w.player.recompute();
  };

  it('les 40 pouvoirs officiels de la Panoplie Exsangue et 9 pouvoirs inventés, actifs pour le Sacrieur', () => {
    expect(POUVOIRS.sacrieur).toHaveLength(40);
    const l = POUVOIRS_CLASSE.filter(p => p.classe === 'sacrieur');
    expect(l.map(p => p.nom)).toEqual(['Soif de sang', 'Frénésie', 'Coups qui saignent', 'Dernier souffle', 'Châtiment Forcé', 'Châtiment Agile', 'Châtiment Osé', 'Châtiment Spirituel', 'Châtiment Vitalesque']);
    const w = sacriTest();
    for (const p of l) expect(w.player.etatPouvoir(p.id).actif, p.id).toBe(true);
  });

  it('Soif de sang rend des PV à chaque monstre tué, sans repasser sous Souffrance 6', () => {
    const w = sacriTest(), p = w.player; porter(w, 'pc-sacrieur-A', 4);
    const sans = sacriTest(), q = sans.player; q.hp = Math.round(q.maxHp * 0.2);
    const m0 = sans.spawnMonster('bouftou', q.x + 200, q.y); m0.hp = 0; sans.killMonster(m0);
    p.hp = Math.round(p.maxHp * 0.2);
    const m = w.spawnMonster('bouftou', p.x + 200, p.y); m.hp = 0; w.killMonster(m);
    expect(p.hp - q.hp).toBe(Math.round(p.maxHp * 0.04));
    p.hp = Math.round(p.maxHp * 0.44); const m2 = w.spawnMonster('bouftou', p.x + 200, p.y); m2.hp = 0; w.killMonster(m2);
    expect(p.souffranceBrute).toBeGreaterThanOrEqual(6);
  });

  it('Dernier souffle sauve à 1 PV à Souffrance 10, une fois par minute', () => {
    const w = sacriTest(), p = w.player; porter(w, 'pc-sacrieur-D', 1.5);
    p.hp = 2; p.invuln = 0; idle(w, 0.05); p.invuln = 0;
    p.hurt(500, p.x + 30, p.y, w);
    expect(p.dead).toBe(false); expect(p.hp).toBe(1); expect(p.invuln).toBeGreaterThanOrEqual(1.5);
    p.invuln = 0; p.hurt(500, p.x + 30, p.y, w);
    expect(p.dead).toBe(true);
  });

  it('Châtiments : chaque coup reçu donne la caractéristique (5 cumuls), la Vitalité monte les PV max puis redescend', () => {
    const w = sacriTest(), p = w.player; porter(w, 'pc-sacrieur-E', 15); porter(w, 'pc-sacrieur-F', 12);
    const f0 = p.stat('force');
    for (let i = 0; i < 7; i++) { p.invuln = 0; p.hurt(5, p.x + 30, p.y, w); }
    expect(p.stat('force') - f0).toBe(75);
    expect(p.stat('agilite')).toBeGreaterThanOrEqual(12);
    const w2 = sacriTest(), p2 = w2.player; porter(w2, 'pc-sacrieur-I', 30); const hp0 = p2.maxHp;
    p2.invuln = 0; p2.hurt(5, p2.x + 30, p2.y, w2);
    expect(p2.maxHp).toBe(hp0 + 30);
    idle(w2, 6.5);
    expect(p2.maxHp).toBe(hp0);
  });

  it('Coups qui saignent : à Souffrance 6+, un vol de vie fait saigner 2 s', () => {
    const w = sacriTest(), p = w.player; porter(w, 'pc-sacrieur-C', 50);
    const m = w.spawnMonster('bouftou', p.x + 60, p.y); m.state = 'idle'; m.hp = m.maxHp = 1e5;
    p.hp = Math.round(p.maxHp * 0.3); idle(w, 0.05);
    w.player.pa = p.paMax; press(w, 'hemorragie', { x: m.x, y: m.y }); idle(w, 0.4);
    expect(m.saigneT).toBeGreaterThan(0);
    const h = m.hp; idle(w, 2.2);
    expect(m.hp).toBeLessThan(h);
    expect(m.saigneT).toBeLessThanOrEqual(0);
  });

  it('Frénésie : à Souffrance 8+, les coups de poing accélèrent les attaques (+5 cumuls)', () => {
    const w = sacriTest(), p = w.player; porter(w, 'pc-sacrieur-B', 5);
    const m = w.spawnMonster('bouftou', p.x + 50, p.y); m.state = 'idle'; m.hp = m.maxHp = 1e5;
    p.hp = Math.round(p.maxHp * 0.15);
    for (let i = 0; i < 40; i++) w.step(STEP, { ...NO_INPUT, aim: { x: m.x, y: m.y }, holdAttack: true });
    expect(p.stat('vitesse')).toBeGreaterThanOrEqual(5);
  });
});
