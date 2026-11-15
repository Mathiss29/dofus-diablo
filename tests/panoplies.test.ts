import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/sim/data';
import { bonusPalier, ficheHtml, lignesBonus, nbActives, palierSuivant, paliersGagnes, panosPortees } from '../src/render/panoplieVue';

// « Panoplies : 1A 2A 3A 4A 5A 6A 7A » : fiche des panoplies de l'inventaire
const AV = ITEMS.sets['5'];   // Panoplie du Jeune Aventurier (6 pièces)

describe('panoplies de l\'inventaire', () => {
  it('palier actif et palier suivant', () => {
    expect(bonusPalier(AV, 1)).toEqual({});
    expect(bonusPalier(AV, 3)).toEqual(AV.bonus['2']);
    expect(palierSuivant(AV, 1)).toBe(2);
    expect(palierSuivant(AV, 3)).toBe(4);
    expect(palierSuivant(AV, AV.items.length)).toBeNull();
  });
  it('les 5 dommages élémentaires égaux tiennent en une ligne (4A)', () => {
    const l = lignesBonus(bonusPalier(AV, 4));
    expect(l.filter(x => x.cle.startsWith('dommages'))).toEqual([{ cle: 'dommages5', v: 2, texte: 'Dommages (5 éléments)', icone: 'tx_damage' }]);
    expect(l.find(x => x.cle === 'force')?.icone).toBe('tx_strength');
    expect(lignesBonus({ dommagesFeu: 3, dommagesEau: 2 }).map(x => x.cle)).toEqual(['dommagesFeu', 'dommagesEau']);
  });
  it('une pièce seule est listée mais pas comptée (6A)', () => {
    const c = { '5': 3, '150': 1 };
    expect(panosPortees(c, ITEMS).map(([id]) => id)).toEqual(['5', '150']);
    expect(nbActives(c)).toBe(1);
  });
  it('palier gagné en équipant (7A)', () => {
    expect(paliersGagnes({ '5': 2 }, { '5': 3 }, ITEMS)).toEqual([['5', 3]]);
    expect(paliersGagnes({}, { '5': 1 }, ITEMS)).toEqual([]);
    expect(paliersGagnes({ '5': 3 }, { '5': 2 }, ITEMS)).toEqual([]);
  });
  it('fiche : pièces portées en couleur, manquantes grisées, palier suivant', () => {
    const portes = new Set(AV.items.slice(0, 3).map(String));
    const h = ficheHtml('5', 3, portes, ITEMS);
    expect(h.match(/class="ppc "/g)?.length).toBe(3);
    expect(h.match(/class="ppc off"/g)?.length).toBe(AV.items.length - 3);
    expect(h).toContain('Bonus actifs · 3 pièces');
    expect(h).toContain('Avec 4 pièces');
  });
});
