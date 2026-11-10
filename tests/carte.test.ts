import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';
import { aDecouvrir, cleLieu, drapeauxPropres, famille, MAX_DRAPEAUX, SIGNAL_DUREE } from '../src/sim/carte';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';

const lire = (f: string) => JSON.parse(readFileSync(new URL(`../public/assets/mondes/${f}`, import.meta.url), 'utf8'));
const incarnam = lire('incarnam/monde.json') as WorldData;
const carte = JSON.parse(readFileSync(new URL('../src/data/carte.json', import.meta.url), 'utf8'));
const nouveau = () => new World({ data: GAME_DATA, zone: 'incarnam', map: new WorldGrid(incarnam), seed: 4, items: ITEMS, quetes: QUETES,
  reprise: { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} } });
const aller = (w: World, tag: string) => {
  const wg = w.worldGrid!, q = wg.cellToWorld(wg.freeByMap.get(tag)![10]);
  w.player.x = q.x; w.player.y = q.y; w.step(0.05, NO_INPUT);
};

describe('Carte du monde (« Carte : » et « Carte suite : »)', () => {
  it('5A : les repères sans objet sont retirés, les autres rangés par famille', () => {
    expect(famille({ t: '', n: 'Hôtel de vente des ressources', g: 0, c: 2 })).toBeNull();
    expect(famille({ t: '', n: 'Hall de guilde', g: 0, c: 4 })).toBeNull();
    expect(famille({ t: '', n: 'Zaap', g: 0, c: 9 })).toBe('zaap');
    expect(famille({ t: '', n: 'Banque', g: 0, c: 4 })).toBe('service');
    expect(famille({ t: '', n: 'Donjon des Larves', g: 0, c: 6 })).toBe('donjon');
  });

  it('6A + 17A : la carte où l\'on passe et ses voisines sortent du brouillard ; un lieu se découvre en passant (XP + bandeau)', () => {
    const w = nouveau(), p = w.player, wg = w.worldGrid!;
    const r = incarnam.reperes!.find(x => aDecouvrir(x) && wg.mapByTag(x.t) && !wg.mapByTag(x.t)!.inside && wg.freeByMap.get(x.t)?.length);
    expect(r).toBeTruthy();
    w.drainEvents();
    const xp = p.xp + p.level * 1e9;
    aller(w, r!.t);
    const [x, y] = r!.t.split('_').map(Number);
    for (const t of [`${x}_${y}`, `${x + 1}_${y}`, `${x - 1}_${y - 1}`]) expect(p.exploreSet('incarnam').has(t)).toBe(true);
    expect(p.lieuxVus).toContain(cleLieu('incarnam', r!));
    expect(w.drainEvents().some(e => e.k === 'lieuDecouvert')).toBe(true);
    expect(p.xp + p.level * 1e9).toBeGreaterThan(xp);
    // une seule fois
    aller(w, r!.t);
    expect(p.lieuxVus.filter(k => k === cleLieu('incarnam', r!))).toHaveLength(1);
  });

  it('9A + 14B : drapeaux (5 au plus) et signal reçus par l\'entrée du joueur, le signal s\'éteint', () => {
    const w = nouveau(), p = w.player;
    const d = Array.from({ length: 8 }, (_, i) => ({ zone: 'incarnam', x: i, y: -3, note: 'x'.repeat(80) }));
    w.step(0.05, { ...NO_INPUT, carte: { drapeaux: d, signal: { x: p.x, y: p.y } } });
    expect(p.drapeaux).toHaveLength(MAX_DRAPEAUX);
    expect(p.drapeaux[0].note!.length).toBeLessThanOrEqual(40);
    expect(p.signal).toBeTruthy();
    expect(w.drainEvents().some(e => e.k === 'signal')).toBe(true);
    for (let t = 0; t < SIGNAL_DUREE + 1; t += 0.5) w.step(0.5, NO_INPUT);
    expect(p.signal).toBeNull();
    expect(drapeauxPropres([{ zone: 3 }, null, { zone: 'a', x: 1, y: NaN }])).toEqual([]);
  });

  it('15A : la tombe disparaît quand on repasse dessus', () => {
    const w = nouveau(), p = w.player;
    p.tombe = { zone: 'incarnam', x: p.x + 5000, y: p.y };
    w.step(0.05, NO_INPUT);
    expect(p.tombe).toBeTruthy();
    p.tombe = { zone: 'incarnam', x: p.x + 50, y: p.y };
    w.step(0.05, NO_INPUT);
    expect(p.tombe).toBeNull();
  });

  it('6D : succès Cartographe d\'Incarnam à 90 % des cartes du dehors', () => {
    const w = nouveau(), Q = w.quetes!, o = QUETES.succes.cartographe_incarnam.objectifs[0];
    expect(Q.progres(o)[0]).toBeLessThan(Q.progres(o)[1]);
    const p = w.player;
    for (const t of (o as { cartes: string[] }).cartes) if (!p.exploreSet('incarnam').has(t)) { p.exploreSet('incarnam').add(t); (p.explore.incarnam ??= []).push(t); }
    w.step(0.05, NO_INPUT);
    expect(Q.succes.has('cartographe_incarnam')).toBe(true);
    // Amakna reste caché hors partie de test
    expect(Q.visible('cartographe_amakna')).toBe(false);
  });

  it('brouillard, lieux, drapeaux et tombe gardés dans la sauvegarde', () => {
    const a = nouveau();
    aller(a, '0_-2');
    a.player.drapeaux = [{ zone: 'incarnam', x: 1.5, y: -2.5, note: 'ici' }];
    a.player.tombe = { zone: 'incarnam', x: 10, y: 20 };
    const b = nouveau();
    restaurerJoueur(b, JSON.parse(JSON.stringify(exporterJoueur(a))));
    expect([...b.player.exploreSet('incarnam')].sort()).toEqual([...a.player.exploreSet('incarnam')].sort());
    expect(b.player.drapeaux).toEqual(a.player.drapeaux);
    expect(b.player.tombe).toEqual(a.player.tombe);
  });

  it('données : carte peinte, régions de la feuille de route et plans des intérieurs', () => {
    expect(carte.peintes['1'].nom).toBe('Monde des Douze');
    expect(carte.regions[0].lab).toBe('Astrub');
    expect(carte.regions.some((r: { ver: string }) => r.ver === '0.10')).toBe(true);
    const plan = lire('astrub/plan.json');
    expect(plan.carte.cw).toBeGreaterThan(100);
    expect(plan.plans.egout.length).toBeGreaterThan(10);
  });
});
