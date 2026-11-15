import { describe, expect, it } from 'vitest';
import { QUETES } from '../src/sim/data';
import { categorieAffichee, rangerSucces, rangOrdre, passeFiltre } from '../src/render/succesRangement';

const liste = Object.entries(QUETES.succes);
const entrees = rangerSucces(liste);
const parCat = (c: string) => entrees.filter(e => e.categorie === c);

describe('Rangement du menu des succès (« Succès : 1A … 9A »)', () => {
  it('chaque succès est dans une seule entrée, rien ne se perd', () => {
    const ids = entrees.flatMap(e => e.ids);
    expect(ids.length).toBe(liste.length);
    expect(new Set(ids).size).toBe(liste.length);
  });
  it('3A : un donjon et ses 4 défis forment une carte, Vaincu en premier', () => {
    const k = entrees.find(e => e.cle === 'donjon:Crypte de Kardorim')!;
    expect(k.genre).toBe('donjon');
    expect(k.nom).toBe('Crypte de Kardorim');
    expect(k.etiquettes).toEqual(['Vaincu', 'Duo', 'Blitzkrieg', 'Prudent', 'Sans potion']);
    expect(parCat('Donjons').length).toBeLessThan(25);
  });
  it('2A : les paliers d\'un métier forment une série croissante', () => {
    const p = entrees.find(e => e.genre === 'serie' && e.nom === 'Paysan')!;
    expect(p.etiquettes).toEqual(['10', '50', '100', '150', '200']);
    const niv = entrees.find(e => e.nom === 'Niveaux du personnage')!;
    expect(niv.ids.length).toBe(11);
    expect(parCat('Métiers').length).toBeLessThan(20);
  });
  it('4A : Garde-robe, Apparats, Dofus, Archimonstres et Ménagerie vont dans Collection', () => {
    expect(categorieAffichee(QUETES.succes.archis_10)).toBe('Collection');
    expect(parCat('Général').every(e => !['Garde-robe', 'Apparats de classe', 'Dofus'].includes(e.sous))).toBe(true);
    expect(parCat('Collection').some(e => e.sous === 'Apparats de classe' && e.nom === 'Iop' && e.ids.length === 2)).toBe(true);
  });
  it('5A : les zones d\'une région forment une carte', () => {
    const a = entrees.find(e => e.cle === 'zones:Astrub')!;
    expect(a.ids.length).toBeGreaterThanOrEqual(10);
    expect(a.region).toBe('Astrub');
  });
  it('bien moins de lignes qu\'avant', () => {
    expect(entrees.length).toBeLessThan(liste.length * 0.55);
  });
  it('7A/7B : ordre et filtres', () => {
    const rec = { fait: 1, total: 1, aRecuperer: 1, avancement: 1 }, fini = { fait: 1, total: 1, aRecuperer: 0, avancement: 1 };
    const cours = { fait: 0, total: 1, aRecuperer: 0, avancement: 0.5 }, neuf = { fait: 0, total: 1, aRecuperer: 0, avancement: 0 };
    expect([fini, neuf, cours, rec].sort((a, b) => rangOrdre(a) - rangOrdre(b))).toEqual([rec, cours, neuf, fini]);
    expect(passeFiltre(fini, 'tous', true)).toBe(false);
    expect(passeFiltre(rec, 'rec', true)).toBe(true);
    expect(passeFiltre(neuf, 'neuf', false)).toBe(true);
    expect(passeFiltre(cours, 'ok', false)).toBe(false);
  });
});
