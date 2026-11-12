import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { briser, chanceRune, dmgArme, etatFM, exoPossible, forger, lignesRelancables, orbeConvient, POTIONS, regenerer, relancerLigne, RUNES } from '../src/sim/forgemagie';
import type { Item } from '../src/sim/items';
import { Rng } from '../src/sim/math';
import { World } from '../src/sim/world';

/** Maquette « Forgemagie v2 » (Mathis 2026-11-12) : 1A+1B+1D+1E 2B 3B 4A 5B+5C 6A 7A+7B 8B 9A+9B+9C. */
const COIFFE = ITEMS.equipment['2411'];   // Coiffe du Bouftou, niveau 20 : Force et Intelligence 16 à 20
const coiffe = (o: Partial<Item> = {}): Item => ({ uid: 1, id: '2411', rarity: 'epique', stats: { force: 18, intelligence: 18 }, extra: [], ...o });
const CELERITAS = '990001', CHRONOS = '990002', GA_PA = '1557', FO = '1519';
const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const monde = () => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 1, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  reprise: { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} } });

describe('forgemagie v2', () => {
  it('8B : exo dès Épique, mais PA, PM, Portée et runes maison seulement sur un Légendaire ou un Mythique', () => {
    expect(exoPossible(COIFFE, coiffe(), 'sagesse')).toBe(true);
    expect(exoPossible(COIFFE, coiffe({ rarity: 'rare' }), 'sagesse')).toBe(false);
    expect(exoPossible(COIFFE, coiffe(), 'pa')).toBe(false);
    expect(exoPossible(COIFFE, coiffe({ rarity: 'legendaire' }), 'pa')).toBe(true);
    expect('refus' in chanceRune(COIFFE, coiffe(), GA_PA)).toBe(true);
    expect('refus' in chanceRune(COIFFE, coiffe(), CELERITAS)).toBe(true);
    expect('refus' in chanceRune(COIFFE, coiffe({ rarity: 'mythique' }), CELERITAS)).toBe(false);
  });

  it('5B : runes maison Céléritas et Chronos sur une ligne déjà présente, jamais rendues par le brisage', () => {
    expect(RUNES[CELERITAS]).toMatchObject({ stat: 'vitesse', val: 1, maison: true });
    expect(RUNES[CHRONOS]).toMatchObject({ stat: 'reductionRecharges', val: 1, maison: true });
    expect(ITEMS.resources[CELERITAS]?.rune).toBe(true);
    const it = coiffe({ rarity: 'rare', stats: { force: 18, vitesse: 2 }, extra: ['vitesse'] });
    expect('refus' in chanceRune(COIFFE, it, CELERITAS)).toBe(false);
    for (let i = 0; i < 50; i++) expect(Object.keys(briser(new Rng(i), COIFFE, { ...it, stats: { vitesse: 3 } }))).not.toContain(CELERITAS);
  });

  it('1A+1D+1E : exo et over repérés, runes posées comptées, over signalé au passage du max', () => {
    expect(etatFM(COIFFE, coiffe({ stats: { force: 22, intelligence: 18, sagesse: 3 }, exo: 'sagesse' }))).toEqual({ exo: true, over: ['force'] });
    expect(etatFM(COIFFE, coiffe())).toEqual({ exo: false, over: [] });
    const it = coiffe({ stats: { force: 20, intelligence: 18 }, puits: 50 });   // le puits couvre la rune : elle passe
    const r = forger(new Rng(1), COIFFE, it, FO)!;
    expect(r.issue).toBe('puits'); expect(r.over).toBe(true); expect(it.fm).toBe(1);
  });

  it('7A : l\'Orbe régénérant relance les jets dans la rareté et garde les pouvoirs ; niveau d\'objet limité', () => {
    const it = coiffe({ stats: { force: 2, intelligence: 2, sagesse: 4 }, exo: 'sagesse', puits: 3, legendary: { id: 'vampire', value: 3 } });
    regenerer(new Rng(3), COIFFE, it, '2411');
    expect(it.stats.force).toBeGreaterThanOrEqual(18); expect(it.stats.intelligence).toBeGreaterThanOrEqual(18);   // Épique : moitié haute
    expect(it.exo).toBeUndefined(); expect(it.puits).toBeUndefined(); expect(it.legendary?.id).toBe('vampire');
    expect(orbeConvient(COIFFE, 60)).toBe(true);
    expect(orbeConvient({ ...COIFFE, level: 100 }, 60)).toBe(false);
    for (const id of ['17272', '17273', '17274', '17275']) expect(ITEMS.resources[id]?.orbe).toBeGreaterThan(0);
  });

  it('7B : Malek relance une ligne, garde le meilleur des deux jets, jamais moins qu\'avant', () => {
    const it = coiffe({ stats: { force: 16, intelligence: 20 } });
    expect(lignesRelancables(COIFFE, it)).toEqual(['force']);
    const r = relancerLigne(new Rng(5), COIFFE, it, 'force')!;
    expect(r.apres).toBe(Math.max(16, ...r.jets)); expect(it.relances).toBe(1);
    expect(relancerLigne(new Rng(5), COIFFE, it, 'intelligence')).toBeNull();
  });

  it('6A : potions officielles, dommages neutres de l\'arme dans l\'élément, avec la perte', () => {
    expect(POTIONS['1345']).toEqual({ element: 'feu', perte: 0.05 });
    expect(POTIONS['1333']).toEqual({ element: 'feu', perte: 0.15 });
    const [id, arme] = Object.entries(ITEMS.equipment).find(([, d]) => d.weapon?.dmg.length === 1 && d.weapon.dmg[0].element === 'neutre' && d.weapon.dmg[0].max >= 20)!;
    const d = dmgArme(arme, { uid: 1, id, rarity: 'rare', stats: {}, extra: [], potion: '1345' })[0];
    expect(d.element).toBe('feu'); expect(d.max).toBe(Math.round(arme.weapon!.dmg[0].max * 0.95));
    // recettes officielles : potions à l'Alchimiste, orbes au Mineur
    expect(ITEMS.recipes!.find(r => r.result === '1345')).toMatchObject({ metier: 'alchimiste', level: 80 });
    expect(ITEMS.recipes!.find(r => r.result === '17272')).toMatchObject({ metier: 'mineur', ingredients: [['14635', 10]] });
  });

  it('dans la partie : relance payée en kamas, potion posée, Orbe utilisé', () => {
    const w = monde(), p = w.player;
    const [id] = Object.entries(ITEMS.equipment).find(([, d]) => d.level <= 40 && d.weapon?.dmg.some(x => x.element === 'neutre'))!;
    const arme: Item = { uid: 900, id, rarity: 'rare', stats: {}, extra: [] };
    p.bag.push(arme, coiffe({ uid: 901, stats: { force: 16, intelligence: 16 } }));
    p.kamas = 10_000; p.resources['1338'] = 1; p.resources['17272'] = 1;
    expect(w.poserPotionFM(900, '1338')).toBe(true);
    expect(arme.potion).toBe('1338'); expect(p.resources['1338']).toBeUndefined();
    expect(w.relancerLigneFM(901, 'force')).toBe(true);
    expect(p.kamas).toBe(10_000 - 20 * 25);
    expect(w.utiliserOrbe(901, '17272')).toBe(true);
    const ev = w.drainEvents().map(e => e.k);
    expect(ev).toEqual(expect.arrayContaining(['fmPotion', 'fmRelance', 'fmOrbe']));
  });

  it('2B : l\'établi de forgemagie est au Havre-Sac', () => {
    expect(GAME_DATA.zones.havresac?.open?.etablis?.[0]).toMatchObject({ nom: 'Atelier des forgemages' });
  });
});
