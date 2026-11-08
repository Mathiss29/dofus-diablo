import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA } from '../src/sim/data';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { NO_INPUT, type PlayerInput } from '../src/sim/input';
import { World } from '../src/sim/world';
import { BETES } from '../src/sim/bete';

const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
const STEP = 1 / 60;
const osa = (seed = 7) => { const w = new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed, classId: 'osamodas' }); w.waveDelay = 1e9; return w; };
const press = (w: World, pressed: PlayerInput['pressed'], aim = { x: w.player.x + 80, y: w.player.y }) => w.step(STEP, { ...NO_INPUT, aim, pressed });
const idle = (w: World, s: number) => { for (let i = 0; i < s * 60; i++) w.step(STEP, NO_INPUT); };
const niveau = (p: World['player'], n: number) => { p.level = n; p.recompute(); p.learnSpells(null); };

describe('Osamodas (maquette Osamodas, 2026-11-08)', () => {
  it('niveau 1 : 4 sorts de vol de vie, Cri du Corbac au clic droit, Tofu sur A, Saute-granouille sur Espace (1A 3A 6A)', () => {
    const p = osa().player;
    expect(p.bar[6]).toBe('cri_corbac');
    expect(p.bar.slice(0, 3)).toEqual(['pics_prespic', 'dents_piranya', 'cri_ours']);
    expect(p.bar[7]).toBe('saute_granouille');
    expect(p.bar[8]).toBe('tofu');
    expect(p.knows('bouftou')).toBe(false);
    for (const id of p.bar.filter(Boolean)) expect(readFileSync(new URL(`../public/assets/ui/sorts/sort_${p.cls.spells[id!].icon}.png`, import.meta.url)).length).toBeGreaterThan(100);
  });

  it('les bêtes arrivent à leur niveau officiel, sur la barre d\'invocations', () => {
    const p = osa().player;
    niveau(p, 25);
    expect(p.bar.slice(8, 12)).toEqual(['tofu', 'bouftou', 'crapipou', 'dragoune']);
  });

  it('le Tofu apparaît, suit l\'Osamodas et frappe un monstre en chasse avec ses vrais sorts', () => {
    const w = osa(), p = w.player;
    press(w, 'tofu'); idle(w, 0.8);
    expect(w.betes).toHaveLength(1);
    const b = w.betes[0];
    expect(b.def.name).toBe('Tofu');
    expect(b.maxHp).toBe(Math.round(p.maxHp * 0.5));
    const m = w.spawnMonster('bouftou', p.x + 120, p.y);
    m.state = 'chase'; m.mannequin = true; m.poseTest = true;
    const hp = m.hp;
    idle(w, 4);
    expect(w.drainEvents().some(e => e.k === 'hit' && e.target === 'monster')).toBe(true);
    expect(m.hp < hp || p.rage > 0).toBe(true);
  });

  it('une seule Invocation de base (2A) : la nouvelle bête remplace l\'ancienne', () => {
    const w = osa(), p = w.player;
    niveau(p, 15);
    press(w, 'tofu'); idle(w, 0.8);
    p.pa = p.paMax;
    press(w, 'bouftou'); idle(w, 0.8);
    expect(w.betes.filter(b => !b.dead).map(b => b.def.name)).toEqual(['Bouftou']);
  });

  it('Éveil (8C, 5A) : jauge pleine, rappuyer sur la touche fait monter la bête d\'un rang pendant 12 s', () => {
    const w = osa(), p = w.player;
    press(w, 'tofu'); idle(w, 0.8);
    p.rage = p.cls.rage.max; p.lastHitAt = p.age;   // jauge pleine, en plein combat
    press(w, 'tofu'); idle(w, 0.1);
    const b = w.betes[0];
    expect(b.def.name).toBe(BETES.ventritofu.name);
    expect(p.rage).toBe(0);
    idle(w, 12.5);
    expect(b.def.name).toBe('Tofu');
  });

  it('les monstres frappent aussi les bêtes (8A)', () => {
    const w = osa(), p = w.player;
    press(w, 'tofu'); idle(w, 0.8);
    const b = w.betes[0];
    const m = w.spawnMonster('bouftou', b.x + 40, b.y);
    m.state = 'chase'; m.agresseur = b.id;
    expect(w.cibleDe(m)).toBe(b);
    p.x += 2000;
    expect(w.cibleDe(m)).toBe(b);
  });

  it('Laisse Spirituelle dompte un monstre affaibli (15A), qui s\'enfuit au bout de 20 s', () => {
    const w = osa(), p = w.player;
    niveau(p, 65);
    p.bar[0] = 'laisse_spirituelle';
    const m = w.spawnMonster('bouftou', p.x + 80, p.y);
    m.state = 'chase'; m.hp = Math.floor(m.maxHp * 0.1);
    press(w, 'laisse_spirituelle', { x: m.x, y: m.y }); idle(w, 0.6);
    const b = w.betes.find(q => q.dompteT > 0);
    expect(b?.def.name).toBe(m.def.name);
    idle(w, 21);
    expect(w.betes.some(q => q.dompteT > 0)).toBe(false);
  });
});

describe('Osamodas : familier de la meute (15F)', () => {
  it('le familier porté mord les monstres en combat près de l\'Osamodas, dans l\'élément de son bonus', () => {
    const w = osa(), p = w.player;
    p.equipment.familier = { uid: 1, id: 'test', rarity: 'commun', stats: { force: 10 }, extra: [] } as unknown as NonNullable<typeof p.equipment.familier>;
    const m = w.spawnMonster('bouftou', p.x + 90, p.y);
    m.state = 'chase'; m.mannequin = true; m.poseTest = true;
    idle(w, 3);
    const coups = w.drainEvents().filter(e => e.k === 'hit' && e.target === 'monster' && e.id === m.id);
    expect(coups.length).toBeGreaterThan(0);
    expect(coups.every(e => e.k === 'hit' && e.element === 'terre')).toBe(true);
  });
});

describe('Osamodas : place des bêtes', () => {
  it('les bêtes suivent à distance, sans marcher sur l\'Osamodas ni l\'une sur l\'autre', () => {
    const w = osa(), p = w.player;
    niveau(p, 15);
    press(w, 'tofu'); idle(w, 0.8);
    w.betes[0].x = p.x; w.betes[0].y = p.y;   // posée dans ses pieds
    idle(w, 2);
    for (const b of w.betes) expect(Math.hypot(b.x - p.x, b.y - p.y)).toBeGreaterThan(p.radius + b.radius);
    // l'Osamodas recule sur sa bête et s'arrête : elle se pousse
    const b = w.betes[0];
    for (let i = 0; i < 90; i++) w.step(STEP, { ...NO_INPUT, dest: { x: b.x, y: b.y } });
    idle(w, 1.5);
    expect(Math.hypot(b.x - p.x, b.y - p.y)).toBeGreaterThan(p.radius + b.radius);
  });
});

describe('Osa nerf (2026-11-08) : un seul instinct à la fois', () => {
  it('Cri de l\'Ours remplace le bonus des Dents du Piranya, le PM du Corbac reste', () => {
    const w = osa(), p = w.player;
    const m = w.spawnMonster('bouftou', p.x + 60, p.y); m.state = 'chase'; m.mannequin = true; m.poseTest = true;
    const at = { x: m.x, y: m.y };
    p.pa = p.paMax; press(w, 'cri_corbac', at); idle(w, 0.6);
    p.pa = p.paMax; press(w, 'dents_piranya', at); idle(w, 0.6);
    expect(p.mods.some(x => x.src === 'dents_piranya')).toBe(true);
    p.pa = p.paMax; press(w, 'cri_ours', at); idle(w, 0.6);
    expect(p.mods.map(x => x.src).filter(s => s !== undefined && s !== 'cri_corbac')).toEqual(['cri_ours']);
    expect(p.mods.some(x => x.src === 'cri_corbac')).toBe(true);
    expect(p.cls.spells.cri_ours.lifesteal).toBe(0.25);
  });
});
