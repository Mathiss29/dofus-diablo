import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import type { EquipSlot } from '../src/sim/items';
import { POUVOIRS } from '../src/sim/pouvoirs';
import { BOSS_PREFERES, PC_PAR_ID, POUVOIRS_CLASSE } from '../src/sim/pouvoirsClasse';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { NO_INPUT, type PlayerInput } from '../src/sim/input';
import { CASE } from '../src/sim/monster';
import { World } from '../src/sim/world';
import { apercuSort } from '../src/sim/apercu';

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

  it('Prélude au Fer, Désarmé : se lance sur la Lance (aperçu, effet et bonus autour d\'elle, pas autour du joueur)', () => {
    const w = fl(), p = w.player;
    niveau(p, 60);
    const q = w.ajouterJoueur('iop'), L = { x: p.x + 220, y: p.y };
    p.lance = { ...L, t: 1 }; q.x = L.x + 20; q.y = L.y;
    const ap = apercuSort(w, 'prelude_fer', L);
    expect(ap?.zone).toMatchObject({ kind: 'circle', x: L.x, y: L.y });
    w.drainEvents();
    press(w, 'prelude_fer'); idle(w, 0.3);
    expect(q.mods.some(m => m.src === 'prelude')).toBe(true);
    expect(p.mods.some(m => m.src === 'prelude')).toBe(false);   // le joueur est loin de sa Lance
    const fx = w.drainEvents().find(e => e.k === 'spell' && e.id === 'prelude_fer') as { x: number; y: number } | undefined;
    expect(fx?.x).toBeCloseTo(L.x);
  });

  it('Armé, les sorts « que sur la Lance » se visent où tu veux, dans leur portée officielle (Prélude au Fer : 2 cases)', () => {
    const w = fl(), p = w.player;
    niveau(p, 60);
    const q = w.ajouterJoueur('iop'); q.x = p.x + 100; q.y = p.y;
    const ap = apercuSort(w, 'prelude_fer', { x: p.x + 100, y: p.y });
    expect(ap?.zone).toMatchObject({ kind: 'circle', x: p.x + 100, y: p.y });
    expect(apercuSort(w, 'effondrement', { x: p.x + 100, y: p.y })?.zone).toMatchObject({ kind: 'circle', x: p.x + 100 });
    press(w, 'prelude_fer', { x: p.x + 100, y: p.y }); idle(w, 0.3);
    expect(q.mods.some(m => m.src === 'prelude')).toBe(true);
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

describe('Légendaires du Forgelance (« Légendaires forgelance : 1A 2A 3B 4A-4P 5A 6A »)', () => {
  const flTest = () => { const w = new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed: 7, classId: 'forgelance', items: ITEMS, test: {} as never }); w.waveDelay = 1e9; w.test!.invincible = false; return w; };
  const porter = (w: World, id: string, value: number) => {
    const c = PC_PAR_ID[id], [iid] = Object.entries(ITEMS.equipment).find(([, d]) => d.slot === c.slot && !d.familier && d.level <= 20)!;
    w.player.equipment[(c.slot === 'anneau' ? 'anneau1' : c.slot) as EquipSlot] = { uid: w.newUid(), id: iid, rarity: 'legendaire', stats: {}, extra: [], legendary: { id, value } };
    w.player.recompute();
  };

  it('40 officiels (Panoplie de l\'Héritage), 7 lances, Lance enracinée et 16 inventés, un boss préféré pour chacun des 10 inventés choisis', () => {
    expect(POUVOIRS.forgelance).toHaveLength(40);
    const l = POUVOIRS_CLASSE.filter(p => p.classe === 'forgelance');
    expect(l).toHaveLength(24);
    const w = flTest(); niveau(w.player, 60);
    for (const p of l) expect(w.player.etatPouvoir(p.id).actif, p.id).toBe(true);
    expect(Object.values(BOSS_PREFERES).flat().filter(id => id.startsWith('pc-forgelance-'))).toHaveLength(10);
  });

  it('les lances se déclenchent à la reprise : 2 fois, puis 12 s d\'attente (Sigel, Muspel, Mani)', () => {
    const w = flTest(), p = w.player;
    porter(w, 'pc-forgelance-sigel', 40); porter(w, 'pc-forgelance-muspel', 1.5); porter(w, 'pc-forgelance-mani', 3);
    const reprise = () => { p.lance = { x: p.x + 200, y: p.y, t: 1 }; p.rappelerLance(w); };
    p.cd.trident = 5;
    reprise();
    expect(p.mods.filter(m => m.src === 'sigel' && m.k === 'puissance')[0]?.n).toBe(40);
    expect(p.cd.trident).toBeCloseTo(3.5);
    p.slow(2, 0.5); expect(p.slowT).toBe(0);   // Mani : insensible
    reprise(); reprise();
    expect(p.mods.filter(m => m.src === 'sigel' && m.k === 'puissance')).toHaveLength(2);   // la 3e attend
    idle(w, 12.1); reprise();
    expect(p.lancesA['sigel']).toHaveLength(1);
  });

  it('Garde de fer : Armé, la Garde monte (−25 %) ; Lance jumelle à la pose', () => {
    const w = flTest(), p = w.player;
    const coup = () => { const h = p.hp; p.invuln = 0; p.shield = 0; p.hurt(100, p.x + 20, p.y, w); return h - p.hp; };
    const base = coup(); p.hp = p.maxHp;
    porter(w, 'pc-forgelance-E', 25);
    expect(coup()).toBeLessThan(base);
    porter(w, 'pc-forgelance-B', 50); p.planterLance(p.x + 150, p.y, w);
    expect(p.jumelleT).toBe(4);
  });

  it('Tourbillon abyssal frappe au fil du temps ; Talon d\'acier remet les recharges à zéro quand il tue', () => {
    const w = flTest(), p = w.player; porter(w, 'pc-forgelance-A', 20);
    const m = mannequin(w, p.x + 150, p.y);
    press(w, 'trident', { x: m.x, y: m.y }); idle(w, 0.6);
    const apres = m.hp; idle(w, 1.5);
    expect(m.hp).toBeLessThan(apres);
    porter(w, 'pc-forgelance-L', 2);
    p.cd.charge_heroique = 6; p.cd.talon_argile = 6; p.aTue('talon_argile', w);
    expect(p.cd.charge_heroique).toBe(0);
  });

  it('Enclume : un monstre repoussé contre la Lance prend la poussée multipliée', () => {
    const essai = (k: number) => {
      const w = flTest(), p = w.player, m = mannequin(w, p.x + 60, p.y);
      const h = m.hp;
      w.hitCircle(m.x, m.y, 10, { dmg: 0.01, knock: 684, pushDmg: true, enclume: k ? { x: m.x + 40, y: m.y, k } : undefined }, 0, 0);
      return h - m.hp;
    };
    expect(essai(3)).toBeGreaterThan(essai(0));
  });
});
