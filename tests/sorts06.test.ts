import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { NO_INPUT, type PlayerInput } from '../src/sim/input';
import { World } from '../src/sim/world';
import { SORTS } from '../src/sim/sorts';
import { valeurMax } from '../src/sim/ecaflip';

const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
const STEP = 1 / 60;
const monde = (classId: string, test = true, seed = 7) => {
  const w = new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed, items: ITEMS, classId, ...(test ? { test: {} as never } : {}) });
  w.waveDelay = 1e9; return w;
};
const niveau = (p: World['player'], n: number) => { p.level = n; p.recompute(); p.learnSpells(null); p.pa = p.paMax; };
const idle = (w: World, s: number) => { for (let i = 0; i < s * 60; i++) w.step(STEP, NO_INPUT); };
const press = (w: World, pressed: PlayerInput['pressed'], aim: { x: number; y: number }) => { w.player.pa = 99; w.step(STEP, { ...NO_INPUT, aim, pressed }); };
const bouftou = (w: World, x: number, y: number) => { const m = w.spawnMonster('bouftou', x, y); m.state = 'chase'; m.hp = m.maxHp = 5000; return m; };

const NOUVEAUX: Record<string, string[]> = {
  forgelance: ['terre_milieu', 'chevalerie', 'jormun', 'poincon', 'noa', 'eclipse'],
  eniripsa: ['chapardage', 'fleuri', 'pinceau', 'cryotherapie'],
  enutrof: ['pelle_anciens', 'peremption', 'corruption', 'retraite'],
  ecaflip: ['esprit_felin', 'odorat', 'coussinets', 'seconde_chance', 'felintion', 'bluff'],
};

describe('Sorts 61-90 (0.6, 7A+7C) : Forgelance, Eniripsa, Enutrof, Écaflip', () => {
  it('chaque sort officiel 61-90 de ces classes est jouable (les 6 de chaque classe)', () => {
    for (const cl of Object.keys(NOUVEAUX)) {
      const C = GAME_DATA.classes[cl], jouables = new Set(Object.values(C.spells).map(d => d.dofusId));
      const officiels = SORTS[C.sorts].map(p => p[0]).filter(s => s.grades[0].niv > 60 && s.grades[0].niv <= 90);
      expect(officiels.length, cl).toBe(6);
      for (const s of officiels) expect(jouables.has(s.id), `${cl} : ${s.name}`).toBe(true);
    }
  });

  it('cachés hors partie de test (V06_PUBLIC faux), appris à leur niveau officiel en partie de test', () => {
    for (const [cl, ids] of Object.entries(NOUVEAUX)) {
      const pub = monde(cl, false), t = monde(cl, true);
      niveau(pub.player, 90); niveau(t.player, 90);
      for (const id of ids) {
        expect(pub.player.knows(id), `${cl} ${id} public`).toBe(false);
        expect(t.player.knows(id), `${cl} ${id} test`).toBe(true);
      }
      niveau(t.player, 64);
      expect(ids.some(id => t.player.knows(id))).toBe(false);
    }
  });

  it('Forgelance : Terre du Milieu donne de la Puissance par ennemi touché ; Jormun frappe jusqu\'à la Lance et la rappelle', () => {
    const w = monde('forgelance'); idle(w, 0.2);
    const p = w.player; niveau(p, 90);
    bouftou(w, p.x + 40, p.y); bouftou(w, p.x - 40, p.y);
    press(w, 'terre_milieu', { x: p.x, y: p.y }); idle(w, 0.5);
    expect(p.mods.find(m => m.src === 'terre_milieu')?.n).toBe(16);
    p.planterLance(p.x + 200, p.y, w);
    const m = bouftou(w, p.x + 100, p.y), hp = m.hp;
    p.cd.jormun = 0; press(w, 'jormun', { x: p.x + 200, y: p.y }); idle(w, 0.5);
    expect(m.hp).toBeLessThan(hp);
    expect(p.lance).toBeNull();
  });

  it('Forgelance : Poinçon immobilise les ennemis près de la Lance ; Noa déclenche un second coup au choc', () => {
    const w = monde('forgelance'); idle(w, 0.2);
    const p = w.player; niveau(p, 90);
    const m = bouftou(w, p.x + 100, p.y);
    press(w, 'poincon', { x: p.x + 90, y: p.y }); idle(w, 0.3);
    expect(p.lance).not.toBeNull();
    expect(m.e06?.racine).toBeDefined();
    expect(m.haste).toBeLessThan(0.1);
    const n = bouftou(w, p.x - 150, p.y);
    n.e06 = { noa: { t: 5, dmg: 77, de: p.id } };
    const hp = n.hp;
    (w as unknown as { pushDamage: (m: unknown, a: number, d: number) => boolean }).pushDamage(n, Math.PI, 2000);
    expect(hp - n.hp).toBeGreaterThanOrEqual(77);
    expect(n.e06?.noa).toBeUndefined();
  });

  it('Eniripsa : Mot Fleuri soigne les alliés autour de l\'ennemi fleuri ; Pinceau Tribal sur soi fait éclater les Peintures', () => {
    const w = monde('eniripsa'); idle(w, 0.2);
    const p = w.player; niveau(p, 90);
    const m = bouftou(w, p.x + 60, p.y); m.mannequin = true;   // ne frappe pas
    press(w, 'fleuri', { x: m.x, y: m.y }); idle(w, 0.4);
    expect(m.e06?.fleur).toBeDefined();
    p.hp = p.maxHp / 2; const avant = p.hp;
    idle(w, 1.5);
    expect(p.hp).toBeGreaterThan(avant);
    const a = bouftou(w, p.x + 150, p.y + 60), b = bouftou(w, p.x + 150, p.y - 60);
    a.e06 = { tribal: { t: 9, de: p.id } }; b.e06 = { tribal: { t: 9, de: p.id } };
    const ha = a.hp, hb = b.hp;
    press(w, 'pinceau', { x: p.x, y: p.y }); idle(w, 0.4);
    expect(a.hp).toBeLessThan(ha); expect(b.hp).toBeLessThan(hb);
    expect(a.e06?.tribal).toBeUndefined();
  });

  it('Eniripsa : la Cryothérapie éclate quand l\'ennemi meurt', () => {
    const w = monde('eniripsa'); idle(w, 0.2);
    const p = w.player; niveau(p, 90);
    const m = bouftou(w, p.x + 80, p.y), voisin = bouftou(w, p.x + 120, p.y);
    press(w, 'cryotherapie', { x: m.x, y: m.y }); idle(w, 0.4);
    expect(m.e06?.cryo).toBeDefined();
    const hv = voisin.hp;
    w.killMonster(m);
    expect(voisin.hp).toBeLessThan(hv);
  });

  it('Enutrof : Corruption rend un ennemi intouchable et pacifiste 3 s ; Retraite Anticipée immobilise et vide les PM du lanceur', () => {
    const w = monde('enutrof'); idle(w, 0.2);
    const p = w.player; niveau(p, 90);
    const m = bouftou(w, p.x + 200, p.y);
    press(w, 'corruption', { x: m.x, y: m.y }); idle(w, 0.4);
    expect(m.intouchable).toBe(true);
    idle(w, 3);
    expect(m.intouchable).toBe(false);
    const n = bouftou(w, p.x + 60, p.y);
    press(w, 'retraite', { x: p.x, y: p.y }); idle(w, 0.4);
    expect(n.e06?.racine).toBeDefined();
    expect(p.pm).toBeLessThan(1);
  });

  it('Écaflip : palier 2 du Poker (Rois au 75), Coussinets pioche un Roi de Pique, Bluff frappe et joue la Main', () => {
    const w = monde('ecaflip'); idle(w, 0.2);
    const p = w.player; niveau(p, 75);
    expect(valeurMax(p)).toBe(2);
    const pub = monde('ecaflip', false); niveau(pub.player, 75);
    expect(valeurMax(pub.player)).toBe(1);
    const m = bouftou(w, p.x + 120, p.y);
    p.ecaMain = [];
    press(w, 'coussinets', { x: m.x, y: m.y }); idle(w, 0.4);
    expect(p.ecaMain).toEqual([{ c: 0, v: 2 }]);
    niveau(p, 90);
    p.ecaMain = [{ c: 0, v: 0 }, { c: 2, v: 1 }];
    const hp = m.hp;
    press(w, 'bluff', { x: m.x, y: m.y }); idle(w, 0.4);
    expect(m.hp).toBeLessThan(hp);
    expect(p.ecaMain.length).toBe(0);
    expect(p.mods.filter(x => x.src === 'table').length).toBeGreaterThanOrEqual(2);
  });

  it('Écaflip : Seconde Chance protège et rend la Main ; Esprit Félin fait passer la cible ou soi de l\'autre côté', () => {
    const w = monde('ecaflip'); idle(w, 0.2);
    const p = w.player; niveau(p, 90);
    p.ecaMain = [{ c: 1, v: 0 }];
    press(w, 'seconde_chance', { x: p.x, y: p.y }); idle(w, 0.3);
    expect(p.subis).toBeLessThan(1);
    expect(p.ecaMain).toEqual([{ c: 1, v: 0 }]);
    expect(p.mods.some(x => x.src === 'table')).toBe(true);
    const m = bouftou(w, p.x + 50, p.y), x0 = p.x, mx0 = m.x;
    p.ecaPF = 1; p.ecaPFT = 9;   // Pile : la cible passe derrière le lanceur
    press(w, 'esprit_felin', { x: m.x, y: m.y }); idle(w, 0.3);
    expect(Math.sign(m.x - p.x)).not.toBe(Math.sign(mx0 - x0));
  });
});
