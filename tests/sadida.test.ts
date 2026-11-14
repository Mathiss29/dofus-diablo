import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { NO_INPUT, type PlayerInput } from '../src/sim/input';
import { World } from '../src/sim/world';
import { PC_PAR_ID, POUVOIRS_CLASSE } from '../src/sim/pouvoirsClasse';
import { EN_JEU, POUVOIRS } from '../src/sim/pouvoirs';
import type { EquipSlot } from '../src/sim/items';
import { arbresDe, foretDuGroupe, planter, rendreFeuillu } from '../src/sim/sadida';

const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
const STEP = 1 / 60;
const sadi = (seed = 7) => { const w = new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed, items: ITEMS, classId: 'sadida', test: {} as never }); w.waveDelay = 1e9; return w; };
const idle = (w: World, s: number) => { for (let i = 0; i < s * 60; i++) w.step(STEP, NO_INPUT); };
const press = (w: World, pressed: PlayerInput['pressed'], aim: { x: number; y: number }) => { w.player.pa = 99; w.step(STEP, { ...NO_INPUT, aim, pressed }); };
const niveau = (p: World['player'], n: number) => { p.level = n; p.recompute(); p.learnSpells(null); p.pa = p.paMax; };
/** Monstre en chasse, increvable et figé sur place. */
const cible = (w: World, x: number, y: number) => { const m = w.spawnMonster('bouftou', x, y); m.state = 'chase'; m.hp = m.maxHp = 50000; m.stun = 999; return m; };
const porter = (w: World, id: string, value: number) => {
  const c = PC_PAR_ID[id], [iid] = Object.entries(ITEMS.equipment).find(([, d]) => d.slot === c.slot && !d.familier && d.level <= 20)!;
  w.player.equipment[(c.slot === 'anneau' ? 'anneau1' : c.slot) as EquipSlot] = { uid: w.newUid(), id: iid, rarity: 'legendaire', stats: {}, extra: [], legendary: { id, value } };
  w.player.recompute();
};

describe('Sadida (maquette Sadida, « 1A 2A+2B 3A+3B 4A 5A 6A+6B 7A 8A+8B 9A 10A 11A 12A 13A 14B 15A 16A 17B », 17D en légendaire)', () => {
  it('niveau 1 : Arbre dès le départ (3A), Ronce au clic droit (11A), Passage racinaire sur Espace (10A)', () => {
    const w = sadi(); idle(w, 0.2);
    const p = w.player;
    expect(p.knows('arbre')).toBe(true);
    expect(p.cls.clicDroit).toBe('ronce');
    expect(p.cls.mobility).toBe('passage');
    expect(p.bar).toContain('larme');
  });

  it('1A : un sort sur un Infecté touche tous les Infectés, 3 propagations au plus par fenêtre de 3 s, sans critique', () => {
    const w = sadi(); idle(w, 0.2);
    const p = w.player, a = cible(w, p.x + 120, p.y), b = cible(w, p.x - 200, p.y + 100);
    press(w, 'ronce', { x: a.x, y: a.y }); idle(w, 0.4);
    expect(a.infecteT).toBeGreaterThan(0);
    expect(b.infecteT).toBe(0);
    press(w, 'ronce', { x: b.x, y: b.y }); idle(w, 0.4);
    expect(b.infecteT).toBeGreaterThan(0);
    const hb = b.hp;
    Object.defineProperty(p, 'critChance', { value: 1 });   // tout coup direct est critique
    press(w, 'buisson_ardent', { x: a.x, y: a.y }); idle(w, 0.4);
    expect(b.hp).toBeLessThan(hb);   // copie sur l'autre Infecté
    const coups = (): number[] => { const l: number[] = []; for (const e of w.drainEvents()) if (e.k === 'hit' && e.target === 'monster' && e.id === b.id) l.push(e.crit ? 1 : 0); return l; };
    w.drainEvents();
    p.cd = {}; press(w, 'cigue', { x: a.x, y: a.y }); idle(w, 0.4);
    expect(coups()).toEqual([0]);   // la copie n'est jamais critique
    p.cd = {}; press(w, 'larme', { x: a.x, y: a.y }); idle(w, 0.4);   // 3e propagation
    const hb2 = b.hp; p.cd = {};
    press(w, 'buisson_ardent', { x: a.x, y: a.y }); idle(w, 0.4);   // 4e : plus de propagation avant la fin de la fenêtre
    expect(b.hp).toBe(hb2);
  });

  it('2A+3A+3B+14B : Arbre à 3 charges (une toutes les 4 s), Feuillu au bout de 3 s (PV doublés), 6 au plus pour tout le groupe', () => {
    const w = sadi(); idle(w, 0.2);
    const p = w.player;
    expect(p.chargesMax('arbre')).toBe(3);
    for (let i = 0; i < 4; i++) { press(w, 'arbre', { x: p.x + 60 + i * 50, y: p.y + 80 }); idle(w, 0.4); }
    expect(arbresDe(p, w)).toHaveLength(3);   // la 4e charge n'est pas revenue
    expect(p.charges('arbre').prochaine).toBeGreaterThan(2);
    const a = arbresDe(p, w)[0], pv = a.maxHp;
    expect(a.sadi!.feuillu).toBe(false);
    idle(w, 3.1);
    expect(a.sadi!.feuillu).toBe(true);
    expect(a.maxHp).toBe(pv * 2);
    // 14B : un second Sadida du groupe ; le 7e Arbre fait partir le plus ancien
    const q = w.ajouterJoueur('sadida');
    for (let i = 0; i < 3; i++) planter(q, p.x - 100, p.y + i * 50, w);
    expect(foretDuGroupe(w)).toHaveLength(6);
    planter(q, p.x - 150, p.y, w);
    expect(foretDuGroupe(w)).toHaveLength(6);
    expect(arbresDe(q, w)).toHaveLength(3);   // le sien d'abord
  });

  it('2A : Larme rend l\'Arbre Feuillu tout de suite ; un sort sur un Feuillu frappe le cercle de 2 cases (relais)', () => {
    const w = sadi(); idle(w, 0.2);
    const p = w.player, a = planter(p, p.x + 150, p.y, w)!;
    idle(w, 0.5);
    press(w, 'larme', { x: a.x, y: a.y }); idle(w, 0.4);
    expect(a.sadi!.feuillu).toBe(true);
    const m1 = cible(w, a.x + 70, a.y), m2 = cible(w, a.x, a.y - 80), h1 = m1.hp, h2 = m2.hp;
    p.cd = {}; press(w, 'ronce', { x: a.x, y: a.y }); idle(w, 0.4);
    expect(m1.hp).toBeLessThan(h1); expect(m2.hp).toBeLessThan(h2);
    expect(m1.infecteT).toBeGreaterThan(0); expect(m2.infecteT).toBeGreaterThan(0);
  });

  it('4A : un Arbre est un obstacle, les monstres ne le traversent pas', () => {
    const w = sadi(); idle(w, 0.2);
    const p = w.player, a = planter(p, p.x + 150, p.y, w)!;
    idle(w, 0.5);
    const m = w.spawnMonster('bouftou', a.x + 2, a.y); m.state = 'chase'; m.hp = m.maxHp = 50000;
    idle(w, 0.1);
    expect(Math.hypot(m.x - a.x, m.y - a.y)).toBeGreaterThanOrEqual(m.radius + a.radius - 1);
  });

  it('5A : une Poupée naît de l\'Arbre le plus proche et redevient Arbre (Feuillu si elle venait d\'un Feuillu) à sa mort', () => {
    const w = sadi(); idle(w, 0.2);
    const p = w.player; niveau(p, 60);
    const a = planter(p, p.x + 150, p.y, w)!; rendreFeuillu(a, w);
    planter(p, p.x - 150, p.y, w);
    press(w, 'la_folle', { x: a.x + 10, y: a.y }); idle(w, 0.6);
    const f = w.betes.find(b => !b.dead && b.base === 'sadi_folle')!;
    expect(f).toBeDefined();
    expect(Math.hypot(f.x - a.x, f.y - a.y)).toBeLessThan(48);   // née sur l'Arbre (puis elle part se battre)
    expect(a.dead).toBe(true);
    expect(arbresDe(p, w)).toHaveLength(1);
    f.mourir(w);
    const n = arbresDe(p, w).find(b => Math.hypot(b.x - f.x, b.y - f.y) < 2)!;
    expect(n.sadi!.feuillu).toBe(true);
    // Puissance Sylvestre : il faut un Feuillu ; le Groute ne bouge pas
    p.cd = {}; press(w, 'puissance_sylvestre', { x: n.x, y: n.y }); idle(w, 0.6);
    const g = w.betes.find(b => !b.dead && b.base === 'sadi_groute')!;
    cible(w, g.x + 300, g.y);
    const x0 = g.x; idle(w, 1);
    expect(g.x).toBe(x0);
  });

  it('6B : X rallie les Poupées sur l\'ennemi sous la souris', () => {
    const w = sadi(); idle(w, 0.2);
    const p = w.player; niveau(p, 60);
    planter(p, p.x + 80, p.y, w);
    press(w, 'la_folle', { x: p.x + 80, y: p.y }); idle(w, 0.6);
    const m = cible(w, p.x + 250, p.y), autre = cible(w, p.x - 150, p.y);
    w.step(STEP, { ...NO_INPUT, coffre: true, aim: { x: m.x, y: m.y } });
    expect(p.sadiCible).toBe(m.id);
    w.cibleMeute = autre.id;
    idle(w, 3);
    expect(m.infecteT + m.poisonT).toBeGreaterThan(0);   // la Folle a frappé la cible du ralliement
  });

  it('7A : poison continu (Sève Paralysante) étalé sur 3 s ; Sève : plus d\'évitement des retraits de PM', () => {
    const w = sadi(); idle(w, 0.2);
    const p = w.player; niveau(p, 60);
    const m = cible(w, p.x + 120, p.y), h0 = m.hp;
    press(w, 'seve_paralysante', { x: m.x, y: m.y }); idle(w, 0.3);
    const h1 = m.hp;
    expect(m.poisonT).toBeGreaterThan(2);
    expect(m.seveT).toBeGreaterThan(0);
    idle(w, 1.5);
    expect(m.hp).toBeLessThan(h1);
    idle(w, 2);
    expect(m.poisonT).toBeLessThanOrEqual(0);
    expect(h0 - m.hp).toBeGreaterThan(5);
  });

  it('8B : les retraits de PM laissent des ronces au sol', () => {
    const w = sadi(); idle(w, 0.2);
    const p = w.player; niveau(p, 60);
    const m = cible(w, p.x + 120, p.y);
    m.seveT = 9;
    press(w, 'buisson_ardent', { x: m.x, y: m.y }); idle(w, 0.3);
    expect(m.ronceT).toBeGreaterThan(0);
  });

  it('9A : Larme sans ennemi soigne le Sadida en solo', () => {
    const w = sadi(); idle(w, 0.2);
    const p = w.player; p.hp = p.maxHp / 2; const h = p.hp;
    press(w, 'larme', { x: p.x + 100, y: p.y }); idle(w, 0.4);
    expect(p.hp).toBeGreaterThan(h);
  });

  it('10A : Passage racinaire vers un Arbre : le Sadida prend sa place et l\'Arbre la sienne', () => {
    const w = sadi(); idle(w, 0.2);
    const p = w.player, a = planter(p, p.x + 300, p.y, w)!, x0 = p.x, y0 = p.y, ax = a.x;
    idle(w, 0.2);
    p.pm = p.pmMax;
    press(w, 'passage', { x: a.x, y: a.y }); idle(w, 0.5);
    expect(Math.hypot(a.x - x0, a.y - y0)).toBeLessThan(2);
    expect(Math.abs(p.x - ax)).toBeLessThan(5);
  });

  it('2B : sans monstre à 15 cases pendant 20 s, les Arbres retournent sous terre', () => {
    const w = sadi(); idle(w, 0.2);
    for (const m of w.monsters) m.dead = true;
    const p = w.player;
    planter(p, p.x + 100, p.y, w);
    idle(w, 19);
    expect(arbresDe(p, w)).toHaveLength(1);
    idle(w, 1.5);
    expect(arbresDe(p, w)).toHaveLength(0);
  });

  it('17D Racines vengeresses : un Arbre qui meurt Infecte et frappe les ennemis à 2 cases', () => {
    const w = sadi(); idle(w, 0.2);
    const p = w.player; porter(w, 'pc-sadida-A', 80);
    const a = planter(p, p.x + 200, p.y, w)!, m = cible(w, a.x + 60, a.y), h = m.hp;
    idle(w, 0.5);
    a.hurt(1e6, m.x, m.y, w);
    expect(m.infecteT).toBeGreaterThan(0);
    expect(m.hp).toBeLessThan(h);
  });

  it('17B : succès « Forêt Hantée » (6 Feuillus et 10 Infectés en même temps)', () => {
    expect(QUETES.succes.foret_hantee.objectifs[0]).toMatchObject({ compteur: 'foretHantee', n: 1 });
    const w = sadi(); idle(w, 0.2);
    const p = w.player;
    for (let i = 0; i < 6; i++) planter(p, p.x - 200 + i * 60, p.y - 150, w, true);
    const ms = Array.from({ length: 10 }, (_, i) => cible(w, p.x - 200 + i * 40, p.y + 120));
    for (const m of ms) m.infecteT = 3;
    w.quetes && (w.quetes.compteurs.foretHantee = 0);
    press(w, 'ronce', { x: ms[0].x, y: ms[0].y }); idle(w, 0.4);
    if (w.quetes) expect(w.quetes.compteurs.foretHantee).toBe(1);
  });

  it('Légendaires sadi 1A : les 40 pouvoirs officiels de la Panoplie Sauvage, dont ceux des sorts déjà en jeu', () => {
    expect(POUVOIRS.sadida).toHaveLength(40);
    expect(POUVOIRS.sadida.filter(p => EN_JEU.sadida.includes(p.dofusId)).length).toBeGreaterThanOrEqual(15);
    expect(POUVOIRS_CLASSE.filter(p => p.classe === 'sadida')).toHaveLength(16);
  });

  it('Forêt dense (E) : une charge d\'Arbre de plus, Feuillu plus tôt ; Épidémie (C) : Infection plus longue', () => {
    const w = sadi(); idle(w, 0.2);
    const p = w.player; porter(w, 'pc-sadida-E', 1.5); porter(w, 'pc-sadida-C', 4);
    expect(p.chargesMax('arbre')).toBe(4);
    const a = planter(p, p.x + 200, p.y, w)!;
    idle(w, 2);
    expect(a.sadi!.feuillu).toBe(true);
    const m = cible(w, p.x + 120, p.y - 80);
    press(w, 'ronce', { x: m.x, y: m.y }); idle(w, 0.4);
    expect(m.infecteT).toBeGreaterThan(5);
  });

  it('Écorce épineuse (F) : un Arbre frappé renvoie des dommages et Infecte', () => {
    const w = sadi(); idle(w, 0.2);
    const p = w.player; porter(w, 'pc-sadida-F', 20);
    const a = planter(p, p.x + 200, p.y, w)!, m = cible(w, a.x + 40, a.y), h = m.hp;
    idle(w, 0.5);
    a.hurt(50, m.x, m.y, w);
    expect(m.hp).toBe(h - 10);
    expect(m.infecteT).toBeGreaterThan(0);
  });

  it('Buisson incendiaire (M) : le sol brûle et refrappe qui reste dedans', () => {
    const w = sadi(); idle(w, 0.2);
    const p = w.player; porter(w, 'pc-sadida-M', 40);
    const m = cible(w, p.x + 150, p.y);
    press(w, 'buisson_ardent', { x: m.x, y: m.y }); idle(w, 0.3);
    expect(w.zonesSol.some(z => z.id === 'pc-sadida-M')).toBe(true);
    const h = m.hp; idle(w, 1.2);
    expect(m.hp).toBeLessThan(h);
  });

  it('Poupée immortelle (P) : la Poupée sacrifiée renaît en Arbre Feuillu', () => {
    const w = sadi(); idle(w, 0.2);
    const p = w.player; niveau(p, 60); porter(w, 'pc-sadida-P', 40);
    cible(w, p.x + 400, p.y);
    const a = planter(p, p.x + 150, p.y, w)!;
    press(w, 'la_folle', { x: a.x, y: a.y }); idle(w, 0.4);
    const fol = w.betes.find(b => !b.dead && b.base === 'sadi_folle')!;
    expect(fol).toBeTruthy();
    fol.x = p.x + 150; fol.y = p.y;
    p.cd = {}; press(w, 'sacrifice_vaudou', { x: fol.x, y: fol.y }); idle(w, 0.3);
    expect(arbresDe(p, w).some(b => b.sadi!.feuillu)).toBe(true);
  });

  it('16A : trame du tutoriel au Temple Céleste, avec des sorts qui existent', () => {
    const et = (QUETES.quetes.reponses.etapes as unknown as Record<string, { nom: string; objectifs: { sort?: string }[] }[]>).sadida;
    expect(et).toHaveLength(10);
    expect(et[0].nom).toBe('Premiers pas'); expect(et[8].nom).toBe('Premières armes');
    for (const e of et) for (const o of e.objectifs) if (o.sort) expect(GAME_DATA.classes.sadida.spells[o.sort], o.sort).toBeTruthy();
  });
});
