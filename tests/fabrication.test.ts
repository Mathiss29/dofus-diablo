import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA, ITEMS } from '../src/sim/data';
import { icons as ICON_FRAMES } from '../src/data/icones_objets.json';
import { GridMap, type MapData } from '../src/sim/gridmap';
import { METIERS_FAB, chanceRare } from '../src/sim/metiers';
import { World } from '../src/sim/world';

const carte = JSON.parse(readFileSync(new URL('../public/assets/cartes/5_-27/carte.json', import.meta.url), 'utf8')) as MapData;
const arena = (test = true, seed = 5) => {
  const w = new World({ data: GAME_DATA, zone: 'champs-astrub', map: new GridMap(carte), seed, classId: 'iop', items: ITEMS, ...(test ? { test: {} as never } : {}) });
  w.player.bag.length = 0; return w;
};
const R = ITEMS.recipes!;
/** Une recette d'équipement du métier, la plus basse. */
const recette = (m: string) => R.map((r, i) => ({ r, i })).filter(x => x.r.metier === m && ITEMS.equipment[x.r.result]).sort((a, b) => a.r.level - b.r.level)[0];
const remplir = (w: World, i: number, n: number) => { for (const [id, q] of R[i].ingredients) w.player.resources[id] = q * n; };

describe('métiers de fabrication (version 0.3 : 9A 10A+10B)', () => {
  it('9A : les 6 métiers, des recettes officielles d\'équipement jusqu\'au niveau 40, ingrédients et icônes présents', () => {
    for (const m of METIERS_FAB) {
      expect(ITEMS.metiers![m], m).toBeDefined();
      expect(readFileSync(new URL(`../public/assets/ui/metier_${m}.png`, import.meta.url)).length).toBeGreaterThan(500);
      const l = R.filter(r => r.metier === m);
      expect(l.length, m).toBeGreaterThan(5);
      for (const r of l) {
        expect(ITEMS.equipment[r.result] ?? (ITEMS.resources[r.result] as { trophee?: boolean } | undefined)?.trophee, r.result).toBeTruthy();
        expect(r.level).toBeLessThanOrEqual(60);   // 0.4 suite 2A : recettes jusqu'au 60
        for (const [id] of r.ingredients) expect(ITEMS.resources[id], `${r.result} ${id}`).toBeDefined();
      }
    }
    for (const r of R) for (const [id] of r.ingredients) expect(ICON_FRAMES[String(ITEMS.resources[id].icon) as keyof typeof ICON_FRAMES], id).toBeDefined();
  });

  it('hors partie de test aussi (0.3 sortie) : fabrication d\'équipement', () => {
    const w = arena(false), { i } = recette('cordonnier');
    remplir(w, i, 1);
    expect(w.craftMax(i)).toBe(1);
    expect(w.craft(i)).toBe(1);
  });

  it('10A : un objet par recette dans le sac, Commun ou Rare (jamais plus, sans pouvoir), plus souvent Rare au haut niveau du métier', () => {
    const { i, r } = recette('bijoutier');
    const tirer = (niveau: number) => {
      const w = arena(true, 11), p = w.player;
      p.metiers.bijoutier = { level: niveau, xp: 0 };
      remplir(w, i, 60);
      expect(w.craft(i, 60)).toBe(60);
      expect(p.bag).toHaveLength(60);
      for (const it of p.bag) { expect(it.id).toBe(r.result); expect(['commun', 'rare']).toContain(it.rarity); expect(it.legendary).toBeUndefined(); }
      expect(p.resources[r.ingredients[0][0]]).toBeUndefined();
      if (niveau < 200) expect(p.metiers.bijoutier.level * 1e6 + p.metiers.bijoutier.xp).toBeGreaterThan(niveau * 1e6);
      return p.bag.filter(x => x.rarity === 'rare').length;
    };
    expect(chanceRare(1)).toBeCloseTo(0.1); expect(chanceRare(200)).toBeCloseTo(0.5);
    expect(tirer(200)).toBeGreaterThan(tirer(Math.max(1, r.level)));
  });

  it('10B : un ingrédient rare de boss ou d\'élite garantit Rare (un par objet)', () => {
    const w = arena(), p = w.player, { i } = recette('tailleur');
    const rares = [...w.ingredientsRares];
    expect(rares).toContain('16525');                  // Crâne de Kardorim (boss)
    expect(rares).not.toContain('385');                // Bave de Bouftou : aussi lâchée par les Bouftous
    remplir(w, i, 5); p.resources['16525'] = 3;
    expect(w.craftMax(i, '16525')).toBe(3);
    expect(w.craftMax(i, '385')).toBe(0);
    expect(w.craft(i, 5, '16525')).toBe(3);
    expect(p.bag.map(x => x.rarity)).toEqual(['rare', 'rare', 'rare']);
    expect(p.resources['16525']).toBeUndefined();
  });

  it('le sac plein limite la série', () => {
    const w = arena(), p = w.player, { i } = recette('forgeron');
    remplir(w, i, 10);
    const id = Object.entries(ITEMS.equipment).find(([, x]) => !x.familier)![0];
    while (p.bag.length < p.tailleSac - 2) p.bag.push({ uid: w.newUid(), id, rarity: 'commun', stats: {}, extra: [] });
    expect(w.craft(i, 10)).toBe(2);
    expect(w.craftMax(i)).toBe(0);
  });
});
