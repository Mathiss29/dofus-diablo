import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { NO_INPUT, type PlayerInput } from '../src/sim/input';
import { World } from '../src/sim/world';
import { aboie, proieDe, roquetDe, subisOuginak } from '../src/sim/ouginak';

const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
const STEP = 1 / 60;
const oug = (seed = 7) => { const w = new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed, items: ITEMS, classId: 'ouginak', test: {} as never }); w.waveDelay = 1e9; return w; };
const idle = (w: World, s: number) => { for (let i = 0; i < s * 60; i++) w.step(STEP, NO_INPUT); };
const press = (w: World, pressed: PlayerInput['pressed'], aim: { x: number; y: number }) => { w.player.pa = 99; w.player.cd = {}; w.player.casts = {}; w.step(STEP, { ...NO_INPUT, aim, pressed }); };
const niveau = (p: World['player'], n: number) => { p.level = n; p.recompute(); p.learnSpells(null); p.pa = p.paMax; };
/** Monstre en chasse, increvable et figé sur place. */
const cible = (w: World, x: number, y: number, hp = 50000) => { const m = w.spawnMonster('bouftou', x, y); m.state = 'chase'; m.hp = m.maxHp = hp; m.stun = 999; return m; };

describe('Ouginak (« Classes : 14A+14C 15A+15B 16A+16B 17A », « Ouginak : 1A+1B 2A 3A+3B 4A 5A … 10A »)', () => {
  it('niveau 1 : Molosse au clic droit, bond sur Espace, Proie dès le départ pour le tutoriel', () => {
    const w = oug(); idle(w, 0.2);
    const p = w.player;
    expect(p.cls.clicDroit).toBe('molosse');
    expect(p.cls.mobility).toBe('bond_bete');
    expect(p.knows('proie')).toBe(true);
    expect(p.knows('lance_roquet')).toBe(false);
    expect(p.bar).toContain('os_a_moelle');
  });

  it('15B + 15A : le premier monstre frappé devient la Proie ; la frapper soigne de 15 % des dommages', () => {
    const w = oug(); idle(w, 0.2);
    const p = w.player, m = cible(w, p.x + 60, p.y);
    press(w, 'molosse', { x: m.x, y: m.y }); idle(w, 0.5);
    expect(proieDe(p, w)).toBe(m);
    expect(m.proieDe).toBe(p.id);
    p.hp = Math.round(p.maxHp / 2);
    const avant = p.hp, hm = m.hp;
    press(w, 'molosse', { x: m.x, y: m.y }); idle(w, 0.5);
    expect(p.hp).toBeGreaterThan(avant);
    expect(p.hp - avant).toBeLessThanOrEqual(Math.ceil((hm - m.hp) * 0.15) + 1);
  });

  it('14A + 14C + 2A : 3 crans de Rage = Forme Bestiale ; un cran perdu (5 s sans frapper) y met fin', () => {
    const w = oug(); idle(w, 0.2);
    const p = w.player, m = cible(w, p.x + 60, p.y);
    const s0 = subisOuginak(p);
    for (let i = 0; i < 3; i++) { press(w, i % 2 ? 'charogne' : 'molosse', { x: m.x, y: m.y }); idle(w, 0.5); }
    expect(p.rage).toBe(3);
    expect(p.ougBete).toBe(true);
    expect(subisOuginak(p)).toBeLessThan(s0);   // chaque cran protège
    const v = p.speed; p.ougBete = false; const v0 = p.speed; p.ougBete = true;
    expect(v).toBeGreaterThan(v0);   // la Bête court plus vite
    idle(w, 5.2);
    expect(p.rage).toBe(2);
    expect(p.ougBete).toBe(false);
  });

  it('Forme Bestiale : sorts offensifs ramenés à 2 cases (sauf Traque), Pelage Protecteur interdit', () => {
    const w = oug(); idle(w, 0.2);
    const p = w.player; niveau(p, 50);
    const loin = p.shot('os_a_moelle').range!;
    p.rage = 3; idle(w, 0.1);
    expect(p.ougBete).toBe(true);
    expect(p.shot('os_a_moelle').range!).toBeLessThan(loin);
    expect(p.shot('os_a_moelle').range!).toBeLessThanOrEqual(2 * 48 + 24);
    expect(p.shot('traque').range!).toBeGreaterThan(2 * 48 + 24);
    p.pa = 99;
    expect(p.canStart('pelage_protecteur')).toBe(false);
    p.rage = 0; idle(w, 0.05);
    expect(p.canStart('pelage_protecteur')).toBe(true);
  });

  it('3B : perdre 15 % des PV max en 3 s donne un cran de Rage ; Apaisement consomme tout et soigne', () => {
    const w = oug(); idle(w, 0.2);
    const p = w.player; niveau(p, 60);
    p.hurt(p.maxHp * 0.1, p.x + 30, p.y, w); p.invuln = 0;
    expect(p.rage).toBe(0);
    p.hurt(p.maxHp * 0.1, p.x + 30, p.y, w);
    expect(p.rage).toBe(1);
    p.rage = 3; idle(w, 0.05);
    const hp = p.hp;
    press(w, 'apaisement', { x: p.x, y: p.y }); idle(w, 0.5);
    expect(p.rage).toBe(0);
    expect(p.ougBete).toBe(false);
    expect(p.hp).toBeGreaterThan(hp);
  });

  it('Proie achevée : le sort Proie est rechargé ; Traque bondit au contact de la Proie', () => {
    const w = oug(); idle(w, 0.2);
    const p = w.player, m = cible(w, p.x + 250, p.y);
    press(w, 'proie', { x: m.x, y: m.y }); idle(w, 0.5);
    expect(m.proieDe).toBe(p.id);
    p.cd.proie = 2.5;
    press(w, 'traque', { x: m.x, y: m.y }); idle(w, 0.5);
    expect(Math.hypot(p.x - m.x, p.y - m.y)).toBeLessThan(80);   // bond au contact
    p.cd.proie = 2.5;
    w.killMonster(m);
    expect(p.cd.proie).toBe(0);
    expect(proieDe(p, w)).toBe(null);
  });

  it('16A + 16B : dès le Lance-roquet, le Roquet suit pour de bon et revient 10 s après sa chute', () => {
    const w = oug(); idle(w, 0.2);
    const p = w.player; niveau(p, 15); idle(w, 0.2);
    const r = roquetDe(p, w)!;
    expect(r).toBeTruthy();
    expect(r.horsCompte).toBe(true);
    r.mourir(w); idle(w, 1);
    expect(roquetDe(p, w)).toBe(null);
    idle(w, 9.5);
    expect(roquetDe(p, w)).toBeTruthy();
  });

  it('17A : Espace bondit jusqu\'à la Proie sous la souris', () => {
    const w = oug(); idle(w, 0.2);
    const p = w.player, m = cible(w, p.x + 300, p.y);
    press(w, 'proie', { x: m.x, y: m.y }); idle(w, 0.5);
    p.pm = p.pmMax;
    w.step(STEP, { ...NO_INPUT, aim: { x: m.x, y: m.y }, pressed: 'bond_bete' }); idle(w, 0.5);
    expect(Math.hypot(p.x - m.x, p.y - m.y)).toBeLessThan(80);
  });

  it('6A sorts 61-90 : Dogue, Panique, Aboiement, Limier, Flair, Appel de la Meute', () => {
    const w = oug(); idle(w, 0.2);
    const p = w.player; niveau(p, 90); idle(w, 0.2);
    for (const k of ['dogue', 'panique', 'aboiement', 'limier', 'flair', 'appel_meute']) expect(p.knows(k)).toBe(true);
    // Dogue : vol de vie au contact, la Proie ralentit
    const m = cible(w, p.x + 60, p.y);
    press(w, 'proie', { x: m.x, y: m.y }); idle(w, 0.5);
    p.hp = Math.round(p.maxHp / 2); const hp = p.hp;
    press(w, 'dogue', { x: m.x, y: m.y }); idle(w, 0.5);
    expect(p.hp).toBeGreaterThan(hp);
    expect(m.haste).toBeLessThan(1);
    // Limier : les ennemis autour de la Proie viennent à son contact
    const v = cible(w, m.x + 100, m.y + 10);
    const d0 = Math.hypot(v.x - m.x, v.y - m.y);
    press(w, 'limier', { x: m.x, y: m.y }); idle(w, 0.3);
    expect(Math.hypot(v.x - m.x, v.y - m.y)).toBeLessThan(d0 - 20);
    // Panique : repousse ce qui entoure la cible
    const d1 = Math.hypot(v.x - m.x, v.y - m.y);
    press(w, 'panique', { x: m.x, y: m.y }); idle(w, 0.6);
    expect(Math.hypot(v.x - m.x, v.y - m.y)).toBeGreaterThan(d1 + 20);
    // Appel de la Meute sur la Proie : érosion des PV max
    const mx = m.maxHp;
    press(w, 'appel_meute', { x: m.x, y: m.y }); idle(w, 0.3);
    expect(m.maxHp).toBeLessThan(mx);
  });

  it('Aboiement : inébranlable ; un coup au contact l\'arrête et donne un cran de Rage', () => {
    const w = oug(); idle(w, 0.2);
    const p = w.player; niveau(p, 90); p.rage = 0;
    press(w, 'aboiement', { x: p.x, y: p.y }); idle(w, 0.4);
    expect(aboie(p)).toBe(true);
    p.invuln = 0; p.kx = p.ky = 0;
    p.hurt(5, p.x + 30, p.y, w);
    expect(Math.hypot(p.kx, p.ky)).toBe(0);
    expect(aboie(p)).toBe(false);
    expect(p.rage).toBe(1);
  });

  it('Flair : demande une Proie et un cran de Rage, puis tu apparais à son contact', () => {
    const w = oug(); idle(w, 0.2);
    const p = w.player; niveau(p, 90); p.rage = 1;
    p.pa = 99;
    expect(p.canStart('flair')).toBe(false);   // pas de Proie
    const m = cible(w, p.x + 300, p.y);
    press(w, 'proie', { x: m.x, y: m.y }); idle(w, 0.4);
    p.rage = 0; p.pa = 99;
    expect(p.canStart('flair')).toBe(false);   // pas de Rage
    p.rage = 1;
    press(w, 'flair', { x: m.x, y: m.y }); idle(w, 0.4);
    expect(Math.hypot(p.x - m.x, p.y - m.y)).toBeLessThan(80);
    expect(p.rage).toBe(0);
  });
});
