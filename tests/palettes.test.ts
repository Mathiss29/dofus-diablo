import { describe, expect, it } from 'vitest';
import { DOFUS } from '../src/sim/dofus';
import { relireCoffre } from '../src/sim/coffre';
import { MES_PALETTES_MAX, PALETTES_PERSO, PALETTE_PAR_ID, codeCouleurs, lireCodeCouleurs, paletteAuHasard, paletteFermee, paletteOuverte } from '../src/sim/palettes';

describe('palettes des persos (« Palettes : 1A 2A+2B+2C 3B+3C 4A+4B+4C+4D »)', () => {
  it('24 palettes en 4 familles, ids uniques, 5 couleurs valides, Dofus officiels', () => {
    expect(PALETTES_PERSO.familles.map(f => f.id)).toEqual(['classiques', 'dofus', 'nations', 'enfers']);
    const toutes = PALETTES_PERSO.familles.flatMap(f => f.palettes);
    expect(toutes.length).toBe(24);
    expect(new Set(toutes.map(p => p.id)).size).toBe(24);
    for (const p of toutes) {
      expect(p.c.length, p.id).toBe(5);
      for (const c of p.c) expect(Number.isInteger(c) && c >= 0 && c <= 0xffffff, p.id).toBe(true);
      if (p.dofus) expect(DOFUS[p.dofus]?.nom, p.id).toContain(p.nom);
    }
    expect(PALETTES_PERSO.familles.find(f => f.id === 'dofus')!.palettes.every(p => p.dofus)).toBe(true);
    expect(PALETTES_PERSO.familles.find(f => f.id === 'enfers')!.palettes.every(p => p.enfers)).toBe(true);
    expect(PALETTES_PERSO.teints.length).toBeGreaterThanOrEqual(8);
  });

  it('Classiques et Nations ouvertes ; Dofus ouverte par le Dofus trouvé ou l\'achat ; Enfers par l\'achat', () => {
    const vide = relireCoffre(null);
    expect(paletteOuverte(PALETTE_PAR_ID.bonta, vide, [])).toBe(true);
    expect(paletteFermee(PALETTE_PAR_ID.emeraude)).toBe(true);
    expect(paletteOuverte(PALETTE_PAR_ID.emeraude, vide, [])).toBe(false);
    expect(paletteOuverte(PALETTE_PAR_ID.emeraude, vide, ['737'])).toBe(true);
    expect(paletteOuverte(PALETTE_PAR_ID.sang, vide, ['737'])).toBe(false);
    expect(paletteOuverte(PALETTE_PAR_ID.sang, { palettes: ['sang'] }, [])).toBe(true);
  });

  it('le coffre garde les palettes achetées et 8 mélanges au plus, sans rien d\'abîmé', () => {
    const m = [1, 2, 3, 4, 5, 6];
    const c = relireCoffre({ onglets: [], palettes: ['sang', 'inconnue', 'sang'], mesPalettes: [m, [1, 2], [1, 2, 3, 4, 5, 0x1000000], ...Array(10).fill(m)] });
    expect(c.palettes).toEqual(['sang']);
    expect(c.mesPalettes!.length).toBe(MES_PALETTES_MAX);
    expect(c.mesPalettes![0]).toEqual(m);
    expect(relireCoffre({ onglets: [] }).mesPalettes).toBeUndefined();
  });

  it('code couleur : aller-retour, 5 couleurs gardent la peau, code abîmé refusé', () => {
    const c = [0xe8a46c, 0xf2d36b, 0xffffff, 0xc9a227, 0x8a5a12, 0xf5e6b0];
    expect(codeCouleurs(c)).toBe('e8a46c-f2d36b-ffffff-c9a227-8a5a12-f5e6b0');
    expect(lireCodeCouleurs(codeCouleurs(c), 0)).toEqual(c);
    expect(lireCodeCouleurs(' #F2D36B #FFFFFF #C9A227 #8A5A12 #F5E6B0 ', 7)).toEqual([7, ...c.slice(1)]);
    expect(lireCodeCouleurs('f2d36b-ffffff', 0)).toBeNull();
    expect(lireCodeCouleurs('bonjour', 0)).toBeNull();
    expect(lireCodeCouleurs('e8a46c-f2d36b-ffffff-c9a227-8a5a12-zzzzzz', 0)).toBeNull();
  });

  it('bouton dé : 6 couleurs valides, la peau ne change pas, même graine = même tirage', () => {
    const graine = (s: number) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    for (let i = 1; i < 50; i++) {
      const c = paletteAuHasard(0x123456, graine(i));
      expect(c.length).toBe(6);
      expect(c[0]).toBe(0x123456);
      for (const x of c) expect(Number.isInteger(x) && x >= 0 && x <= 0xffffff).toBe(true);
    }
    expect(paletteAuHasard(1, graine(9))).toEqual(paletteAuHasard(1, graine(9)));
  });
});

describe('palettes en jeu : achat chez Tissebelle et « Mes palettes » du compte', () => {
  it('une palette fermée s\'achète une fois ; une ouverte ne s\'achète pas ; 8 mélanges au plus', async () => {
    const { readFileSync } = await import('node:fs');
    const { BOUTIQUES, GAME_DATA, ITEMS, QUETES } = await import('../src/sim/data');
    const { WorldGrid } = await import('../src/sim/gridmap');
    const { PEPITE } = await import('../src/sim/items');
    const { World } = await import('../src/sim/world');
    const c = relireCoffre(null);
    const w = new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(JSON.parse(readFileSync('public/assets/mondes/astrub/monde.json', 'utf8'))), seed: 1, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
      reprise: { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} }, coffre: c });
    w.player.resources[PEPITE] = PALETTES_PERSO.prix * 2 - 1;
    expect(w.acheterPalette('bonta')).toBe(false);   // déjà ouverte
    expect(w.acheterPalette('inconnue')).toBe(false);
    expect(w.acheterPalette('sang')).toBe(true);
    expect(w.acheterPalette('sang')).toBe(false);
    expect(w.acheterPalette('neant')).toBe(false);   // plus assez de Pépites
    w.player.dofus.push('737');
    w.player.resources[PEPITE] = 1000;
    expect(w.acheterPalette('emeraude')).toBe(false); // le Dofus l'ouvre déjà
    expect(c.palettes).toEqual(['sang']);
    for (let i = 0; i < MES_PALETTES_MAX; i++) expect(w.garderMaPalette([i, 1, 2, 3, 4, 5])).toBe(true);
    expect(w.garderMaPalette([9, 1, 2, 3, 4, 5])).toBe(false);
    expect(w.garderMaPalette([1, 2, 3])).toBe(false);
    expect(w.retirerMaPalette(0)).toBe(true);
    expect(c.mesPalettes![0][0]).toBe(1);
    expect(relireCoffre(JSON.parse(JSON.stringify(c))).mesPalettes!.length).toBe(MES_PALETTES_MAX - 1);
  });
});
