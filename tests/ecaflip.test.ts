import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { NO_INPUT, type PlayerInput } from '../src/sim/input';
import { World } from '../src/sim/world';
import { PC_PAR_ID } from '../src/sim/pouvoirsClasse';
import type { EquipSlot, Item } from '../src/sim/items';
import { avantImpactEcaflip, evaluerMain, impactEcaflip, jouerMain, type Carte } from '../src/sim/ecaflip';

const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
const STEP = 1 / 60;
const eca = (seed = 7, test = false) => { const w = new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed, items: ITEMS, classId: 'ecaflip', ...(test ? { test: {} as never } : {}) }); w.waveDelay = 1e9; return w; };
/** Porte un Légendaire avec ce pouvoir de l'Écaflip (comme tests/pouvoirsClasse.test.ts). */
const porter = (w: World, id: string, value: number) => {
  const c = PC_PAR_ID[id], [iid] = Object.entries(ITEMS.equipment).find(([, d]) => d.slot === c.slot && !d.familier && d.level <= 20)!;
  const it: Item = { uid: w.newUid(), id: iid, rarity: 'legendaire', stats: {}, extra: [], legendary: { id, value } };
  const sl = (c.slot === 'anneau' ? 'anneau1' : c.slot) as EquipSlot, deja = w.player.equipment[sl];
  if (deja?.legendary?.id.startsWith('pc-ecaflip')) deja.legendary2 = { id, value };   // deux pouvoirs du même emplacement : sur la même pièce
  else w.player.equipment[sl] = it;
  w.player.recompute();
};
const idle = (w: World, s: number) => { for (let i = 0; i < s * 60; i++) w.step(STEP, NO_INPUT); };
const press = (w: World, pressed: PlayerInput['pressed'], aim: { x: number; y: number }) => w.step(STEP, { ...NO_INPUT, aim, pressed });
const P = GAME_DATA.classes.ecaflip.poker!;
const k = (c: number, v: number): Carte => ({ c, v });

describe('Écaflip (maquette Écaflip, « 1A 2A+2C 3A+3B 4A+4C 5A 6B … 15A+15C »)', () => {
  it('4A : les mains gagnantes du Poker d\'Ecaflip', () => {
    expect(evaluerMain([k(0, 0), k(1, 0), k(2, 0), k(3, 0)], P)).toMatchObject({ nom: 'Carré de Valets', pct: P.mains.carre[0], el: -1 });
    expect(evaluerMain([k(0, 0), k(1, 0), k(2, 1)], P)).toMatchObject({ nom: 'Paire', pct: P.mains.paire });
    expect(evaluerMain([k(0, 0), k(1, 0), k(2, 1), k(3, 1)], P)).toMatchObject({ nom: 'Double Paire' });
    expect(evaluerMain([k(2, 0), k(2, 1), k(2, 1), k(2, 0)], P)).toMatchObject({ nom: 'Couleur Cœur', el: 2 });
    expect(evaluerMain([k(1, 0), k(1, 1), k(1, 2), k(1, 3)], P)).toMatchObject({ nom: 'Suite Royale de Trèfle', pct: P.mains.suiteCouleur, el: 1 });
    expect(evaluerMain([k(0, 0), k(1, 1), k(2, 2), k(3, 3)], P)).toMatchObject({ nom: 'Suite Royale Couleurs', pct: P.mains.suiteCouleurs });
    expect(evaluerMain([k(0, 0), k(1, 1)], P)).toBeNull();
  });

  it('2A : chaque sort à carte pioche la sienne dans la Main, 4 au plus', () => {
    const w = eca(); idle(w, 0.2);
    const p = w.player, m = w.spawnMonster('bouftou', p.x + 90, p.y);
    p.pa = 99;
    press(w, 'reflexes', { x: m.x, y: m.y }); idle(w, 0.5);
    expect(p.ecaMain).toEqual([k(0, 0)]);
    p.ecaMain = [k(1, 0), k(1, 0), k(1, 0), k(1, 0)];
    p.pa = 99; press(w, 'reflexes', { x: m.x, y: m.y }); idle(w, 0.5);
    expect(p.ecaMain.length).toBe(4);
  });

  it('3A+3B : jouer la Main (touche X) pose la Table (bonus officiels, moitié à l\'allié proche) et donne la Main gagnante', () => {
    const w = eca(); idle(w, 0.2);
    const p = w.player, q = w.ajouterJoueur('iop');
    q.x = p.x + 60; q.y = p.y; idle(w, 0.1);
    p.ecaMain = [k(0, 0), k(1, 0), k(2, 0), k(3, 0)];
    w.step(STEP, { ...NO_INPUT, coffre: true });
    expect(p.ecaMain.length).toBe(0);
    expect(p.ecaGagnante?.nom).toBe('Carré de Valets');
    expect(p.stat('dommagesPoussee')).toBeGreaterThanOrEqual(P.table.valeurs[0][0]);
    expect(q.mods.find(m => m.src === 'table' && m.k === 'soins')?.n).toBe(Math.round(P.table.valeurs[2][0] * P.table.allies));
    idle(w, P.table.t + 0.5);
    expect(p.mods.some(m => m.src === 'table')).toBe(false);
    expect(p.ecaGagnante).toBeNull();
  });

  it('4A : la Main gagnante augmente les dommages de ses sorts, la Couleur seulement dans son élément', () => {
    const w = eca(); idle(w, 0.2);
    const p = w.player, S = p.cls.spells;
    p.ecaGagnante = { nom: 'Couleur Pique', pct: 30, el: 0, t: 9 };
    expect(avantImpactEcaflip(p, S.reflexes, w).mult).toBeCloseTo(1.3);
    expect(avantImpactEcaflip(p, S.topkaj, w).mult).toBeCloseTo(1);
  });

  it('Dames : +15 % par carte de leur couleur dans la Main, ces cartes sont jouées puis la Dame piochée', () => {
    const w = eca(); idle(w, 0.2);
    const p = w.player, d = p.cls.spells.jass;
    p.ecaMain = [k(0, 0), k(0, 0), k(2, 0)];
    expect(avantImpactEcaflip(p, d, w).mult).toBeCloseTo(1.3);
    impactEcaflip(p, 'jass', d, p.x + 60, p.y, 1, 30, w);
    expect(p.ecaMain).toEqual([k(2, 0), k(0, 1)]);
    expect(p.mods.filter(m => m.src === 'table').length).toBe(2);
  });

  it('5A : Pile ou Face tire un côté au hasard, puis relancer donne l\'autre', () => {
    const w = eca(); idle(w, 0.2);
    const p = w.player, d = p.cls.spells.pile_face;
    impactEcaflip(p, 'pile_face', d, p.x, p.y, 0, 10, w);
    const a = p.ecaPF;
    expect([1, 2]).toContain(a);
    impactEcaflip(p, 'pile_face', d, p.x, p.y, 0, 10, w);
    expect(p.ecaPF).toBe(3 - a);
  });

  it('Bonne Pioche : Main pleine, elle la joue d\'abord puis pioche ; PA remboursés', () => {
    const w = eca(); idle(w, 0.2);
    const p = w.player, d = p.cls.spells.bonne_pioche;
    p.ecaMain = [k(0, 0), k(1, 0), k(2, 0), k(3, 0)];
    p.pa = 2;
    impactEcaflip(p, 'bonne_pioche', d, p.x, p.y, 0, 0, w);
    expect(p.ecaGagnante?.nom).toBe('Carré de Valets');
    expect(p.ecaMain.length).toBe(1);
    expect(p.pa).toBe(2 + p.paCost('bonne_pioche'));
  });

  it('Griffe Invocatrice : Puissance tant que le Chaton vit', () => {
    const w = eca(); idle(w, 0.2);
    const p = w.player;
    const b = w.invoquer(p, 'chaton_enrage', 'griffe_invocatrice', p.x + 50, p.y)!;
    idle(w, 0.1);
    expect(p.stat('puissance')).toBeGreaterThanOrEqual(30);
    b.mourir(w); idle(w, 0.1);
    expect(p.mods.some(m => m.src === 'chaton')).toBe(false);
  });

  it('jouer une Main vide ne fait rien', () => {
    const w = eca(); idle(w, 0.2);
    expect(jouerMain(w.player, w)).toBe(false);
  });

  it('Légendaires éca : Main lourde, Tapis vert, Partage du pot, Double ou rien, Jackpot', () => {
    const w = eca(7, true); idle(w, 0.2);
    const p = w.player, q = w.ajouterJoueur('iop');
    q.x = p.x + 60; q.y = p.y; idle(w, 0.1);
    for (const [id, v] of [['pc-ecaflip-M', 30], ['pc-ecaflip-C', 5], ['pc-ecaflip-D', 100], ['pc-ecaflip-F', 50], ['pc-ecaflip-E', 3]] as const) porter(w, id, v);
    expect(p.pcv('pc-ecaflip-M')).toBe(30);
    p.ecaMain = [k(0, 0), k(0, 0)];
    expect(avantImpactEcaflip(p, p.cls.spells.jass, w).mult).toBeCloseTo(1.6);
    p.ecaMain = [k(0, 0), k(1, 0), k(2, 0), k(3, 0)];
    p.cd.reflexes = 5; p.pa = 0;
    jouerMain(p, w);
    expect(p.ecaGagnante?.pct).toBe(Math.round(P.mains.carre[0] * 1.5));
    expect(p.cd.reflexes).toBe(0); expect(p.pa).toBe(3);
    expect(p.mods.find(m => m.src === 'table')!.t).toBe(P.table.t + 5);
    expect(q.mods.find(m => m.src === 'table' && m.k === 'soins')?.n).toBe(P.table.valeurs[2][0]);
    const hp = p.hp; p.ecaMain = [k(0, 0), k(1, 1)];
    jouerMain(p, w);
    expect(p.hp).toBe(hp - Math.round(p.maxHp * 0.05));
  });

  it('Légendaires éca : Carte maîtresse, Pièce à deux faces, Neuvième vie, Pattes de velours', () => {
    const w = eca(7, true); idle(w, 0.2);
    const p = w.player;
    porter(w, 'pc-ecaflip-A', 100); porter(w, 'pc-ecaflip-G', 50); porter(w, 'pc-ecaflip-P', 25); porter(w, 'pc-ecaflip-K', 4);
    impactEcaflip(p, 'bonne_pioche', p.cls.spells.bonne_pioche, p.x, p.y, 0, 0, w);
    expect(p.ecaMain[0].v).toBe(3);
    impactEcaflip(p, 'pile_face', p.cls.spells.pile_face, p.x, p.y, 0, 10, w);
    expect(p.courseT).toBeGreaterThan(0);
    expect(p.mods.some(m => m.src === 'pile')).toBe(true);
    const pm = p.pmMax;
    expect(pm).toBe(p.cls.pm.max + p.stat('pm') + 1);
    p.hp = 5; p.invuln = 0; p.shield = 0;
    p.hurt(9999, p.x + 30, p.y, w);
    expect(p.dead).toBe(false);
    expect(p.hp).toBeGreaterThan(1);
  });
});
