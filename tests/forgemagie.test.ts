import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { briser, chanceRune, coutKamas, forger, fusionVers, plafond, POIDS, RUNES } from '../src/sim/forgemagie';
import type { Item } from '../src/sim/items';
import { Rng } from '../src/sim/math';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';
import { World } from '../src/sim/world';

const COIFFE = ITEMS.equipment['2411'];   // Coiffe du Bouftou, niveau 20 : Force et Intelligence 16 à 20
const coiffe = (o: Partial<Item> = {}): Item => ({ uid: 1, id: '2411', rarity: 'epique', stats: { force: 18, intelligence: 18 }, extra: [], ...o });
const FO = '1519', PA_FO = '1545', RA_FO = '1551', GA_PA = '1557';
const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const monde = () => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 1, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  reprise: { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} } });

describe('forgemagie (maquette « Forgemagie »)', () => {
  it('runes et poids officiels de Dofus 3 (valeur × effectPowerRate), rangées comme ressources avec leur icône', () => {
    expect(Object.keys(RUNES).length).toBeGreaterThanOrEqual(90);
    expect(RUNES[FO]).toMatchObject({ stat: 'force', val: 1, poids: 1 });
    expect(RUNES[RA_FO]).toMatchObject({ stat: 'force', val: 10, poids: 10 });
    expect(RUNES[GA_PA]).toMatchObject({ stat: 'pa', val: 1, poids: 100 });
    expect(POIDS.vitalite).toBeCloseTo(0.2); expect(POIDS.sagesse).toBe(3); expect(POIDS.pm).toBe(90);
    for (const id of Object.keys(RUNES)) expect(ITEMS.resources[id]?.rune, id).toBe(true);
  });

  it('brisage officiel (7A) × bonus de rareté (7B)', () => {
    const am = ITEMS.equipment['2425'];   // Amulette du Bouftou niveau 20
    const it: Item = { uid: 2, id: '2425', rarity: 'commun', stats: { force: 13 }, extra: [] };
    // 3 × 13 × 1 × 20 ÷ 200 + 1 = 4,9 : une Pa Fo, une Fo, et 90 % de chances d'une 2e Fo
    let fo2 = 0;
    for (let i = 0; i < 2000; i++) { const g = briser(new Rng(i), am, it); expect(g[PA_FO]).toBe(1); if (g[FO] === 2) fo2++; else expect(g[FO]).toBe(1); }
    expect(fo2 / 2000).toBeCloseTo(0.9, 1);
    const ep = briser(new Rng(1), am, { ...it, rarity: 'epique' });   // 9,8 de poids : 3 Pa Fo + 0,8
    expect(ep[PA_FO]).toBe(3);
  });

  it('3B : un Commun ne dépasse pas le jet max officiel, un Épique monte jusqu\'à +20 %', () => {
    expect(plafond(COIFFE, coiffe({ rarity: 'commun' }), 'force')).toBe(20);
    expect(plafond(COIFFE, coiffe({ rarity: 'epique' }), 'force')).toBe(24);
    expect(chanceRune(COIFFE, coiffe({ rarity: 'commun', stats: { force: 20, intelligence: 18 } }), FO)).toEqual({ refus: 'plafond' });
    const sous = chanceRune(COIFFE, coiffe(), FO), dessus = chanceRune(COIFFE, coiffe({ stats: { force: 21, intelligence: 18 } }), FO);
    if ('refus' in sous || 'refus' in dessus) throw new Error('refusée');
    expect(sous.p).toBeGreaterThan(dessus.p);
  });

  it('4B : une seule ligne ajoutée, sur un Légendaire ou un Mythique (Ga Pa à 3 %)', () => {
    expect(chanceRune(COIFFE, coiffe(), GA_PA)).toEqual({ refus: 'exo' });
    const leg = coiffe({ rarity: 'legendaire' }), c = chanceRune(COIFFE, leg, GA_PA);
    expect(c).toEqual({ p: 0.03, certain: false });
    leg.puits = 100;   // le puits couvre la rune : elle passe
    const r = forger(new Rng(1), COIFFE, leg, GA_PA)!;
    expect(r.issue).toBe('puits'); expect(leg.stats.pa).toBe(1); expect(leg.exo).toBe('pa'); expect(leg.puits).toBeUndefined();
    expect(chanceRune(COIFFE, leg, '7438')).toEqual({ refus: 'exo' });   // Rune Po : déjà une ligne ajoutée
    expect(chanceRune(COIFFE, leg, GA_PA)).toEqual({ refus: 'plafond' });   // l'exo PA s'arrête à +1
  });

  it('2A : critique, neutre et échec officiels ; le poids perdu nourrit le puits', () => {
    const vus = new Set<string>(); const rng = new Rng(3);
    for (let i = 0; i < 300; i++) {
      const it = coiffe({ stats: { force: 17, intelligence: 18, vitalite: 20 }, extra: ['vitalite'] });
      const avant = { ...it.stats }, r = forger(rng, COIFFE, it, PA_FO)!;
      vus.add(r.issue);
      if (r.issue === 'echec') { expect(it.stats.force).toBe(17); expect(it.puits).toBeGreaterThanOrEqual(3); expect(r.pertes.length).toBeGreaterThan(0); }
      else expect(it.stats.force).toBe(20);
      if (r.issue === 'critique') expect(it.stats.intelligence).toBe(avant.intelligence);
      for (const [s, n] of r.pertes) expect(it.stats[s] ?? 0).toBe((avant[s] ?? 0) - n);
    }
    expect([...vus].sort()).toEqual(['critique', 'echec', 'neutre']);
  });

  it('9B + 8D : chaque essai coûte des kamas, plus la commission en mode « viser »', () => {
    expect(coutKamas(COIFFE, FO)).toBe(10);   // 20 × 1 × 0,5
    expect(coutKamas(COIFFE, FO, true)).toBe(15);
    expect(coutKamas(COIFFE, GA_PA)).toBe(1000);
  });

  it('en jeu : forgemager, briser, fusionner, viser ; la sauvegarde garde le puits et l\'exo', () => {
    const w = monde(), p = w.player;
    const it = coiffe({ uid: 900, rarity: 'legendaire' }); p.bag.push(it);
    p.resources[FO] = 9; p.kamas = 1000;
    expect(fusionVers(FO)).toBe(PA_FO);
    expect(w.fusionner(FO, true)).toBe(3);
    expect(p.resources[FO]).toBeUndefined(); expect(p.resources[PA_FO]).toBe(3);
    expect(w.forgemager(900, PA_FO)).toBe(true);
    expect(p.kamas).toBe(970); expect(p.resources[PA_FO]).toBe(2);
    p.resources[FO] = 30;
    w.viserForge(900, 'force', 22);
    expect(p.kamas).toBeLessThan(970);
    it.puits = 4.5; it.exo = 'pa'; it.stats.pa = 1;
    const s = JSON.parse(JSON.stringify(exporterJoueur(w)));
    const w2 = monde(); restaurerJoueur(w2, s);
    expect(w2.player.bag.find(b => b.id === '2411')).toMatchObject({ puits: 4.5, exo: 'pa' });
    const am: Item = { uid: 901, id: '2425', rarity: 'rare', stats: { force: 13, vitalite: 12 }, extra: [] }; p.bag.push(am);
    expect(w.briserObjet(901)).toBe(true);
    expect(p.bag.find(b => b.uid === 901)).toBeUndefined();
    expect(p.resources[PA_FO]).toBeGreaterThan(0);
  });
});
