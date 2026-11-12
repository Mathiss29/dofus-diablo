import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APPARATS, BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { sourceApparat } from '../src/sim/apparats';
import { raretes } from '../src/sim/butin';
import { AVANTAGES, BOUTIQUE_OGRINES, apparatDuMois, avantage, enVente, prixOgrines, texteAvantages, vitrine } from '../src/sim/boutiqueOgrines';
import { STYLE } from '../src/sim/style';
import { PEPITE } from '../src/sim/items';
import { BENEDICTION } from '../src/sim/magasin';
import { World } from '../src/sim/world';

const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const monde = (jour = '2026-11-12') => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 1, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  apparats: APPARATS, aujourdhui: jour, reprise: { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} } });
const A = BOUTIQUE_OGRINES.articles;

describe('Boutique Ogrines (« Apparats : » 9A 9B 9C 9E 13A 14A-14C 15A)', () => {
  it('9A + 15A : apparats de la boutique seulement, jamais de puissance ; prix 300 / 500 / 800, familier 600', () => {
    const ids = Object.values(A).flatMap(a => a.apparats ?? []);
    expect(ids.length).toBeGreaterThan(700);
    for (const id of ids) {
      expect(APPARATS.objets[id], id).toBeTruthy();
      expect(['boutique', 'fete']).toContain(sourceApparat(id)?.k);
      expect(ITEMS.equipment[id]?.familier?.stats?.length ?? 0).toBe(0);   // jamais de familier à bonus
    }
    const a = Object.entries(A).filter(([, x]) => x.apparats?.length === 1);
    expect(new Set(a.map(([, x]) => x.prix))).toEqual(new Set([300, 500, 800, 600]));
    // 17B : les apparats du mois ne se vendent pas
    const mois = BOUTIQUE_OGRINES.abonnement.apparatsDuMois;
    expect(mois.length).toBe(12);
    expect(mois.some(id => ids.includes(id))).toBe(false);
    expect(mois).toContain(apparatDuMois('2026-11'));
  });

  it('9B : un costume = coiffe + cape (+ familier), moins cher que les pièces, 1 500 au plus', () => {
    const c = Object.values(A).filter(x => x.cat === 'costume');
    expect(c.length).toBeGreaterThan(50);
    for (const x of c) {
      const slots = x.apparats!.map(id => APPARATS.objets[id].slot);
      expect(slots.slice(0, 2)).toEqual(['chapeau', 'cape']);
      const somme = x.apparats!.reduce((n, id) => n + A[`a${id}`].prix, 0);
      expect(x.prix).toBeLessThan(somme);
      expect(x.prix).toBeLessThanOrEqual(1500);
    }
  });

  it('9C + 9E : potions de nom et d\'apparence, styles en Ogrines (pas en Pépites)', () => {
    expect(A.vnom.service).toBe('nom');
    expect(A.vapparence.service).toBe('apparence');
    const st = Object.values(A).filter(x => x.cat === 'style');
    expect(st.length).toBeGreaterThanOrEqual(5);
    const w = monde(), p = w.player; p.resources[PEPITE] = 10_000;
    expect(w.acheterStyle('aureoles', 'arcane')).toBe(false);
    expect(w.recevoirAchats(['saureoles:arcane', 'a' + Object.values(A).find(x => x.cat === 'chapeau')!.apparats![0]])).toBe(2);
    expect(w.aLeStyle('aureoles', 'arcane')).toBe(true);
    expect(w.recevoirAchats(['saureoles:arcane'])).toBe(0);
  });

  it('14B + 14C : vitrine de la semaine (promo -30 %), articles de fête seulement pendant la fête', () => {
    const v = vitrine('2026-11-12');
    expect(v.avant.length).toBe(6);
    expect(vitrine('2026-11-15')).toEqual(v);   // même semaine (dimanche)
    expect(vitrine('2026-11-16')).not.toEqual(v);   // lundi suivant
    expect(prixOgrines(v.promo, '2026-11-12')).toBe(Math.round(A[v.promo].prix * 0.7 / 10) * 10);
    expect(prixOgrines(v.avant[1], '2026-11-12')).toBe(A[v.avant[1]].prix);
    const nowel = Object.keys(A).find(id => A[id].fete === 'nowel')!;
    expect(enVente(nowel, '2026-12-24')).toBe(true);
    expect(prixOgrines(nowel, '2026-06-10')).toBeNull();
  });
});

describe('Abonnements (« Apparats : » 16A 16D 17)', () => {
  it('16A : trois paliers 300 / 700 / 1 500, essai Héros 7 jours ; textes des avantages', () => {
    const P = BOUTIQUE_OGRINES.abonnement;
    expect([P.paliers.aventurier.prix, P.paliers.heros.prix, P.paliers.legende.prix]).toEqual([300, 700, 1500]);
    expect(P.essai).toEqual({ jours: 7, palier: 'heros' });
    expect(texteAvantages('legende').join(' ')).toContain('×1,25');
    expect(avantage(null, 'xp')).toBe(0);
    expect(avantage(null, 'familierXp')).toBe(1);
    expect(avantage('heros', 'xp')).toBe(AVANTAGES.xp[1]);
  });

  it('17A : styles offerts selon le palier, retirés quand il prend fin', () => {
    const w = monde(), p = w.player;
    expect(w.aLeStyle('ornements', 'aventurier')).toBe(false);
    w.reglerAbo(p, 'heros');
    expect(w.aLeStyle('ornements', 'aventurier')).toBe(true);
    expect(w.aLeStyle('aureoles', 'heros')).toBe(true);
    expect(w.aLeStyle('zaaps', 'legende')).toBe(false);
    expect(w.porterStyle('aureoles', 'heros')).toBe(true);
    w.reglerAbo(p, null);
    expect(p.style.aureoles).toBeUndefined();
    expect(STYLE.aureoles.find(d => d.id === 'heros')?.abo).toBe('heros');
  });

  it('17C : bénédictions offertes chaque jour (1 / 2 / 3), puis en Pépites', () => {
    const w = monde(), p = w.player; p.resources[PEPITE] = 100;
    w.reglerAbo(p, 'heros');
    expect(w.acheterBenediction('xp')).toBe(true);
    expect(w.acheterBenediction('butin')).toBe(true);
    expect(p.resources[PEPITE]).toBe(100);
    expect(w.acheterBenediction('metier')).toBe(true);
    expect(p.resources[PEPITE]).toBe(100 - BENEDICTION.prix);
  });

  it('17E + 17F + 17K : XP, Prospection et légendaires, récolte', () => {
    const w = monde(), p = w.player;
    const sans = w.contexteButin('piou_bleu', 'normal', 11);
    w.reglerAbo(p, 'legende');
    const avec = w.contexteButin('piou_bleu', 'normal', 11);
    expect(avec.prospection - sans.prospection).toBe(30);
    expect(avec.legendaire).toBe(1.25);
    expect(raretes('boss', 0, 1.25).legendaire).toBeGreaterThan(raretes('boss', 0).legendaire);
    expect(w.dureeRecolte()).toBeLessThan(monde().dureeRecolte());
  });

  it('17C : un contrat du jour de plus', () => {
    const w = monde(), q = w.quetes!;
    const avant = q.contrats().length;
    if (!avant) return;   // pas de tableau de contrats sur cette carte
    w.reglerAbo(w.player, 'aventurier');
    expect(q.contrats().length).toBe(avant + 1);
  });
});
