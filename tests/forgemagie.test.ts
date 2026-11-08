import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { apercuBrisage, briser, chanceRune, coutKamas, estimerCommande, executerCommande, forger, fusionVers, plafond, POIDS, RUNES, SIGNATURE } from '../src/sim/forgemagie';
import type { Item } from '../src/sim/items';
import { NO_INPUT } from '../src/sim/input';
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

  it('9B + 8D : chaque essai coûte des kamas, plus la commission de Malek', () => {
    expect(coutKamas(COIFFE, FO)).toBe(10);   // 20 × 1 × 0,5
    expect(coutKamas(COIFFE, FO, true)).toBe(15);
    expect(coutKamas(COIFFE, GA_PA)).toBe(1000);
  });

  it('en jeu : forgemager, briser, fusionner ; la sauvegarde garde le puits et l\'exo', () => {
    const w = monde(), p = w.player;
    const it = coiffe({ uid: 900, rarity: 'legendaire' }); p.bag.push(it);
    p.resources[FO] = 9; p.kamas = 1000;
    expect(fusionVers(FO)).toBe(PA_FO);
    expect(w.fusionner(FO, true)).toBe(3);
    expect(p.resources[FO]).toBeUndefined(); expect(p.resources[PA_FO]).toBe(3);
    expect(w.forgemager(900, PA_FO)).toBe(true);
    expect(p.kamas).toBe(970); expect(p.resources[PA_FO]).toBe(2);
    it.puits = 4.5; it.exo = 'pa'; it.stats.pa = 1;
    const s = JSON.parse(JSON.stringify(exporterJoueur(w)));
    const w2 = monde(); restaurerJoueur(w2, s);
    expect(w2.player.bag.find(b => b.id === '2411')).toMatchObject({ puits: 4.5, exo: 'pa' });
    const am: Item = { uid: 901, id: '2425', rarity: 'rare', stats: { force: 13, vitalite: 12 }, extra: [] }; p.bag.push(am);
    expect(w.briserObjet(901)).toBe(true);
    expect(p.bag.find(b => b.uid === 901)).toBeUndefined();
    expect(p.resources[PA_FO]).toBeGreaterThan(0);
  });

  it('Forgemagie UI 9A-9D : Malek vise la ligne la plus en retard, respecte budget et planchers, et estime sans rien toucher', () => {
    const it = coiffe({ stats: { force: 16, intelligence: 16 } }), stock = { [FO]: 40, '1522': 40 };   // 1522 : Rune Ine
    expect(ITEMS.resources['1522']).toMatchObject({ rune: true }); expect(RUNES['1522'].stat).toBe('intelligence');
    const avant = JSON.stringify(it), st0 = JSON.stringify(stock);
    const E = estimerCommande(new Rng(5), COIFFE, it, stock, 10000, { objectifs: { force: 20, intelligence: 20 }, planchers: {}, budget: 10000 }, 100);
    expect(JSON.stringify(it)).toBe(avant); expect(JSON.stringify(stock)).toBe(st0);   // simulé sur des copies
    expect(E.reussite).toBeGreaterThan(0.1); expect(E.reussite).toBeLessThan(1); expect(E.kamas).toBeGreaterThan(0);
    // budget : jamais dépassé (commission comprise)
    const r = executerCommande(new Rng(2), COIFFE, coiffe({ stats: { force: 16, intelligence: 16 } }), { [FO]: 40 }, 10000, { objectifs: { force: 24 }, planchers: {}, budget: 50 });
    expect(r.kamas).toBeLessThanOrEqual(50); expect(r.fin).toBe('budget'); expect(r.essais).toBe(3);   // 15 kamas l'essai
    // plancher : Malek s'arrête dès que la ligne protégée passe dessous
    for (let i = 0; i < 30; i++) {
      const o = coiffe({ stats: { force: 16, intelligence: 18 } }), q = executerCommande(new Rng(i), COIFFE, o, { [FO]: 40 }, 10000, { objectifs: { force: 24 }, planchers: { intelligence: 17 }, budget: 10000 });
      if (q.fin === 'plancher') expect(o.stats.intelligence ?? 0).toBeLessThan(17);
      else expect(o.stats.intelligence ?? 0).toBeGreaterThanOrEqual(17);
    }
  });

  it('Forgemagie UI 9E : l\'objet est confié, revient après le temps de travail, et la commande survit à la sauvegarde', () => {
    const w = monde(), p = w.player;
    p.bag.push(coiffe({ uid: 910, stats: { force: 16, intelligence: 16 } })); p.resources[FO] = 20; p.kamas = 1000;
    expect(w.estimerCommande(910, { objectifs: { force: 20 }, planchers: {}, budget: 500 })!.reussite).toBeGreaterThan(0);
    expect(w.confierCommande(910, { objectifs: { force: 20 }, planchers: {}, budget: 500 })).toBe(true);
    const c = p.commandeFM!;
    expect(p.bag.some(b => b.uid === 910)).toBe(false);
    expect(p.kamas).toBe(1000 - c.rapport.kamas); expect(p.resources[FO] ?? 0).toBe(20 - c.rapport.essais);
    expect(c.total).toBeGreaterThanOrEqual(30);
    expect(w.confierCommande(910, { objectifs: { force: 20 }, planchers: {}, budget: 500 })).toBe(false);   // une à la fois
    expect(w.retirerCommande()).toBeNull();   // pas encore prête
    const s = JSON.parse(JSON.stringify(exporterJoueur(w)));
    const w2 = monde(); restaurerJoueur(w2, s);
    expect(w2.player.commandeFM?.item.id).toBe('2411');
    const ev: string[] = [];
    for (let t = 0; t < c.total + 1; t += 0.5) { w.step(0.5, NO_INPUT); for (const e of w.drainEvents()) if (e.k === 'commande') ev.push(e.etat); }
    expect(ev).toEqual(['confiee', 'prete']);
    expect(w.retirerCommande()!.item.id).toBe('2411');
    expect(p.bag.some(b => b.id === '2411')).toBe(true); expect(p.commandeFM).toBeNull();
  });

  it('6A : la Rune de Signature officielle grave le nom (achetée à Malek si le sac n\'en a pas) ; 8A : le Concasseur brise un choix', () => {
    expect(ITEMS.resources[SIGNATURE.rune]).toMatchObject({ name: 'Rune de Signature', signature: true });
    const w = monde(), p = w.player;
    p.bag.push(coiffe({ uid: 920 }), coiffe({ uid: 921 }), coiffe({ uid: 922, cadenas: true })); p.kamas = SIGNATURE.kamas;
    expect(w.signer(920, 'Mathis')).toBe(true);
    expect(p.kamas).toBe(0); expect(p.bag.find(b => b.uid === 920)!.signe).toBe('Mathis');
    expect(w.signer(920, 'Autre')).toBe(false);   // déjà signé
    p.resources[SIGNATURE.rune] = 1;
    expect(w.signer(921, 'Mathis')).toBe(true); expect(p.resources[SIGNATURE.rune]).toBeUndefined();
    const ap = apercuBrisage(COIFFE, p.bag.find(b => b.uid === 921)!);
    expect(Object.values(ap).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    expect(w.briserChoix([921, 922])).toBe(1);   // l'objet sous cadenas reste
    expect(p.bag.map(b => b.uid).sort()).toEqual([920, 922]);
    for (const [id, n] of Object.entries(ap)) expect(p.resources[id]).toBeGreaterThanOrEqual(n);
  });
});
