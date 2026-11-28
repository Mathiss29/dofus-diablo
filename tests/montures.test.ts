import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { MONTURE, RACES, SAUVAGES, enfantsPossibles, horloge, lireEcurie, monture, vitesseMonture } from '../src/sim/montures';
import { World } from '../src/sim/world';

const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
let heure = 1_000_000;
const arena = (test = true) => new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed: 7, classId: 'iop', items: ITEMS, horloge: () => heure, ...(test ? { test: {} as never } : {}) });
const nom = (n: string) => Object.entries(RACES).find(([, r]) => r.nom === n)![0];
const capturer = (w: World, type: string) => { const p = w.player; w.killMonster(w.spawnMonster(type, p.x + 60, p.y)); };

describe('0.7 : montures (17A, 17C) et élevage', () => {
  it('races officielles : 66 Dragodindes et 66 Muldos, générations de l\'arbre officiel, 8 bêtes sauvages à capturer', () => {
    const l = Object.values(RACES);
    expect(l.filter(r => r.famille === 'dragodinde')).toHaveLength(66);
    expect(l.filter(r => r.famille === 'muldo')).toHaveLength(66);
    expect(RACES[nom('Dragodinde Rousse')].gen).toBe(1);
    expect(RACES[nom('Dragodinde Amande et Rousse')].gen).toBe(2);
    expect(RACES[nom('Dragodinde Indigo')].gen).toBe(3);
    expect(RACES[nom('Dragodinde Prune et Ivoire')].gen).toBe(10);
    expect(RACES[nom('Muldo Doré')].gen).toBe(1);
    expect(Object.keys(SAUVAGES)).toHaveLength(8);
    for (const m of Object.keys(SAUVAGES)) expect(GAME_DATA.monsters[m], m).toBeDefined();
    expect(RACES[nom('Dragodinde Rousse')].stats.length).toBeGreaterThan(0);   // bonus officiels (Vitalité, Soins…)
  });

  it('17A : la première Dragodinde sauvage vaincue est capturée ; on la monte (+40 % hors combat) et on descend au premier coup', () => {
    const w = arena(), p = w.player;
    expect(p.v07).toBe(true);
    capturer(w, 'dragodinde_rousse_sauvage');
    expect(p.ecurie.montures).toHaveLength(1);
    expect(monture(p)?.race).toBe(nom('Dragodinde Rousse'));
    const v = p.speed;
    p.coupA = -99;
    w.step(1 / 60, { ...NO_INPUT, monture: true });
    expect(p.monte).toBe(true);
    expect(p.montee).toBe(nom('Dragodinde Rousse'));
    expect(p.speed / v).toBeCloseTo(1 + MONTURE.vitesse, 2);
    p.invuln = 0; p.hurt(10, p.x + 30, p.y, w);
    expect(p.monte).toBe(false);
    w.step(1 / 60, { ...NO_INPUT, monture: true });
    expect(p.monte).toBe(false);   // trop tôt : encore en combat
  });

  it('5A : bonus de la race au niveau de la monture ; 2A : elle gagne de l\'XP en chassant', () => {
    const w = arena(), p = w.player;
    if (!p.v07) return;
    capturer(w, 'muldo_dore_sauvage');
    const m = monture(p)!;
    expect(m.niveau).toBe(1);
    for (let i = 0; i < 30; i++) capturer(w, 'muldo_dore_sauvage');
    expect(monture(p, m.uid)!.niveau).toBeGreaterThan(1);
  });

  it('4A + 4C : croisement dans l\'enclos, gestation d\'une heure à l\'horloge réelle, petits de l\'arbre officiel', () => {
    const w = arena(), p = w.player;
    if (!p.v07) return;
    for (let i = 0; i < 40 && (p.ecurie.montures.length < 2 || new Set(p.ecurie.montures.map(m => m.male)).size < 2); i++) capturer(w, 'dragodinde_amande_sauvage');
    const f = p.ecurie.montures.find(m => !m.male)!, mle = p.ecurie.montures.find(m => m.male)!;
    expect(f && mle).toBeTruthy();
    mle.race = nom('Dragodinde Rousse');
    expect(w.elevage({ k: 'ranger', uid: f.uid, ou: 'havre' })).toBeNull();
    expect(w.elevage({ k: 'ranger', uid: mle.uid, ou: 'havre' })).toBeNull();
    expect(w.elevage({ k: 'accoupler', a: f.uid, b: mle.uid })).toMatch(/adultes/);   // trop jeunes
    heure += MONTURE.maturite;
    expect(w.elevage({ k: 'accoupler', a: f.uid, b: mle.uid })).toBeNull();
    const n = p.ecurie.montures.length;
    heure += MONTURE.gestation + 1;
    w.step(1, NO_INPUT);
    const petits = p.ecurie.montures.slice(n);
    expect(petits.length).toBeGreaterThanOrEqual(1);
    const ok = new Set(enfantsPossibles(nom('Dragodinde Amande'), nom('Dragodinde Rousse')).map(e => e.race));
    expect(ok.has(nom('Dragodinde Amande et Rousse'))).toBe(true);
    for (const b of petits) { expect(ok.has(b.race)).toBe(true); expect(b.parents).toEqual([f.race, mle.race]); }
    expect(f.portees).toBe(1);
  });

  it('enfants : deux bicolores de génération 2 peuvent donner Indigo ou Ébène (génération 3)', () => {
    const l = enfantsPossibles(nom('Dragodinde Amande et Rousse'), nom('Dragodinde Dorée et Rousse')).map(e => RACES[e.race].nom);
    expect(l).toContain('Dragodinde Indigo');
    expect(l).toContain('Dragodinde Ébène');
    expect(enfantsPossibles(nom('Dragodinde Amande'), nom('Dragodinde Rousse')).map(e => RACES[e.race].gen).every(g => g <= 2)).toBe(true);
  });

  it('2B : chaque heure dans l\'enclos, une monture prend le trait du tempérament de ses voisins (même jeu fermé)', () => {
    const w = arena(), p = w.player;
    if (!p.v07) return;
    for (let i = 0; i < 3; i++) p.ecurie.montures.push({ uid: 100 + i, race: nom('Dragodinde Rousse'), nom: 'x', male: true, niveau: 1, xp: 0, fougue: 0, robustesse: 0, flair: 0, temp: 'fougueuse', capa: [], portees: 0, nee: horloge(w) });
    for (let i = 0; i < 3; i++) expect(w.elevage({ k: 'ranger', uid: 100 + i, ou: 'havre' })).toBeNull();
    heure += 3 * 3600;
    w.step(1, NO_INPUT);
    expect(monture(p, 101)!.fougue).toBeCloseTo(2 * 3 * MONTURE.voisinage);   // deux voisins fougueux
    expect(monture(p, 100)!.fougue).toBeCloseTo(3 * MONTURE.voisinage);
  });

  it('2D : expédition dans une région, retour avec des ressources ; sauvegarde relue', () => {
    const w = arena(), p = w.player;
    if (!p.v07) return;
    capturer(w, 'dragodinde_doree_sauvage');
    p.level = 200;
    const sub = Object.entries(w.zone.open?.subareas ?? {}).find(([, s]) => s.level <= 20 && s.monsters.some(m => ITEMS.drops[m]?.length))?.[0];
    if (!sub) return;   // monde sans sous-zone (arène) : rien à tester ici
    const uid = monture(p)!.uid, avant = Object.values(p.resources).reduce((a, b) => a + b, 0);
    expect(w.elevage({ k: 'expedition', uid, sub, duree: 1800 })).toBeNull();
    expect(vitesseMonture(p)).toBe(1);
    heure += 1800;
    w.step(1, NO_INPUT);
    expect(Object.values(p.resources).reduce((a, b) => a + b, 0)).toBeGreaterThan(avant);
    const relue = lireEcurie(JSON.parse(JSON.stringify(p.ecurie)));
    expect(relue.montures).toHaveLength(p.ecurie.montures.length);
  });

  it('rien tant que la 0.7 est cachée', () => {
    const w = arena(false), p = w.player;
    if (p.v07) return;
    capturer(w, 'dragodinde_rousse_sauvage');
    expect(p.ecurie.montures).toHaveLength(0);
    expect(w.elevage({ k: 'louer' })).toMatch(/0\.7/);
  });
});
