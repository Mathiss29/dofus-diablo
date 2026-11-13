import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES, RECOLTES, THEMES_HAVRESAC } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World, type WorldOptions } from '../src/sim/world';
import { DECO, MEUBLES, PREFIXE_MEUBLE, RECETTES_MEUBLES, SPECIAUX, casesDe, meublesPossedes, raresDuTheme, sacVuValide } from '../src/sim/meubles';
import { coffreVide, relireCoffre } from '../src/sim/coffre';
import { BOUTIQUE_OGRINES } from '../src/sim/boutiqueOgrines';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';

const lire = (w: string) => JSON.parse(readFileSync(new URL(`../public/assets/mondes/${w}/monde.json`, import.meta.url), 'utf8')) as WorldData;
const HS = lire('havresac');
const VIDE = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (o: Partial<WorldOptions> = {}) => new World({ data: GAME_DATA, zone: 'havresac', map: new WorldGrid(HS), seed: 1, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  recoltes: RECOLTES, themesHavreSac: THEMES_HAVRESAC, reprise: VIDE, aujourdhui: '2026-11-13', test: {} as WorldOptions['test'], ...o });
const MERCENAIRE = 57;
/** Une case libre loin de l'arrivée où ce meuble passe. */
function caseLibre(w: World, id: number, depuis = 0): number {
  for (let c = depuis; c < 560; c++) if (!w.deco!.refus(id, c)) return c;
  throw new Error('aucune case');
}

describe('Havre-Sac complet (0.6 : 10A-E, 11B+11C, Métiers 9A)', () => {
  it('le catalogue officiel : 4 083 meubles des thèmes du Havre-Sac, un quart de rares, 3 recettes par thème', () => {
    const offi = Object.values(MEUBLES).filter(m => m.id > 0);
    expect(offi.length).toBeGreaterThan(4000);
    const rares = offi.filter(m => m.tier === 'rare').length;
    expect(rares / offi.length).toBeGreaterThan(0.15);
    expect(rares / offi.length).toBeLessThan(0.3);
    expect(RECETTES_MEUBLES.every(r => r.metier === 'bricoleur' || r.metier === 'sculpteur')).toBe(true);
    expect(ITEMS.recipes!.filter(r => r.result.startsWith(PREFIXE_MEUBLE)).length).toBe(RECETTES_MEUBLES.length);
    for (const r of RECETTES_MEUBLES) for (const [id] of r.ingredients) expect(RECOLTES.ressources[id]).toBeTruthy();
    expect(Object.values(SPECIAUX).map(s => MEUBLES[s.id].sorte)).toEqual(['potager', 'vitrine', 'mannequin']);
  });
  it('11C : chaque thème possédé donne ses meubles de base, pas ses rares', () => {
    const c = coffreVide(), p = meublesPossedes([MERCENAIRE], c);
    const base = Object.values(MEUBLES).filter(m => m.theme === MERCENAIRE && m.tier === 'base');
    expect(base.length).toBeGreaterThan(10);
    for (const m of base) expect(p.has(m.id)).toBe(true);
    for (const id of raresDuTheme(MERCENAIRE)) expect(p.has(id)).toBe(false);
    expect(Object.values(MEUBLES).some(m => m.theme === 2 && p.has(m.id))).toBe(false);   // thème Amakna pas acheté
  });
  it('casesDe : un meuble de 2 × 1 couvre deux cases voisines vers le haut ; tourné, l\'autre diagonale', () => {
    const m = Object.values(MEUBLES).find(x => x.l === 2 && x.h === 1)!;
    // case 300 = ligne 21 (impaire, décalée d'une demi-case), colonne 6 : en haut à droite 287, en haut à gauche 286
    expect(casesDe(m, 300)).toEqual([300, 287]);
    expect(casesDe(m, 300, true)).toEqual([300, 286]);
    expect(casesDe(m, 3)).toEqual([]);   // dépasse en haut de la carte
  });
  it('10A : poser un meuble ferme sa case, le ranger la rouvre ; on refuse de couper la pièce ou l\'allée de l\'arche', () => {
    const w = monde(), d = w.deco!;
    expect(d).toBeTruthy();
    expect(d.decorable).toBe(true);
    const id = Object.values(MEUBLES).find(m => m.theme === MERCENAIRE && m.tier === 'base' && m.couche === 1 && m.bloque && m.l === 1 && m.h === 1)!.id;
    const c = caseLibre(w, id, 200), g = w.worldGrid!.cellOf(d.tag, c);
    expect(w.worldGrid!.mov[g]).toBe(1);
    expect(d.poser(id, c)).toBe(true);
    expect(w.worldGrid!.mov[g]).toBe(0);
    expect(w.coffre.deco![String(MERCENAIRE)]).toEqual([{ m: id, c }]);
    expect(w.drainEvents().some(e => e.k === 'coffre')).toBe(true);
    expect(d.refus(id, c)).toBe('La place est prise');
    expect(d.refus(id, w.zone.open!.havreSac!.arrivee)).toBeTruthy();
    expect(d.ranger(c)).toBe(true);
    expect(w.worldGrid!.mov[g]).toBe(1);
    expect(w.coffre.deco).toEqual({});
    // un meuble pas possédé (rare) est refusé
    expect(d.refus(raresDuTheme(MERCENAIRE)[0], c)).toBe('Tu n\'as pas ce meuble');
  });
  it('10A : un tapis ne bloque pas, un bibelot se pose sur une table', () => {
    const w = monde(), d = w.deco!, M = Object.values(MEUBLES).filter(m => m.theme === MERCENAIRE && m.tier === 'base');
    const tapis = M.find(m => m.couche === 0)!, table = Object.values(MEUBLES).find(m => m.tier === 'base' && m.empilable && m.couche === 1 && m.l === 1 && m.h === 1 && meublesPossedes([MERCENAIRE], w.coffre).has(m.id));
    const c = caseLibre(w, tapis.id, 250);
    expect(d.poser(tapis.id, c)).toBe(true);
    expect(w.worldGrid!.mov[w.worldGrid!.cellOf(d.tag, c)]).toBe(1);
    if (table) {
      const bib = M.find(m => m.couche === 2)!, t = caseLibre(w, table.id, 320);
      expect(d.poser(table.id, t)).toBe(true);
      expect(d.refus(bib.id, t)).toBeNull();
      expect(d.poser(bib.id, t)).toBe(true);
      expect(d.refus(bib.id, t)).toBe('Il y a déjà un bibelot dessus');
      expect(d.ranger(t)).toBe(true);   // le bibelot part en premier
      expect(w.coffre.deco![String(MERCENAIRE)].some(p => p.m === table.id)).toBe(true);
    }
  });
  it('10C : le potager pousse une nuit, se récolte, repousse ; seulement les plantes déjà récoltées', () => {
    const w = monde(), d = w.deco!, P = SPECIAUX.potager.id, c = caseLibre(w, P, 220);
    expect(d.poser(P, c)).toBe(true);
    expect(d.plantables()).toEqual([]);
    w.player.recoltees.push('289', '303');   // Blé (paysan), Bois de Frêne (bûcheron : pas au potager)
    expect(d.plantables()).toEqual(['289']);
    expect(d.planter(c, '303')).toBe(false);
    expect(d.planter(c, '289')).toBe(true);
    expect(d.parcelle(c)).toEqual({ r: '289', pret: false });
    expect(d.recolter(c)).toBe(0);
    // le lendemain
    const w2 = monde({ coffre: w.coffre, aujourdhui: '2026-11-14' });
    w2.player.recoltees.push('289');
    expect(w2.deco!.parcelle(c)).toEqual({ r: '289', pret: true });
    const n = w2.deco!.recolter(c);
    expect(n).toBeGreaterThanOrEqual(DECO.recolte.base);
    expect(w2.player.resources['289']).toBe(n);
    expect(w2.deco!.parcelle(c)!.pret).toBe(false);
  });
  it('10B : la vitrine expose un trophée, un Dofus ou un familier du perso ; ranger le socle le vide', () => {
    const w = monde(), d = w.deco!, V = SPECIAUX.vitrine.id, c = caseLibre(w, V, 230);
    expect(d.poser(V, c)).toBe(true);
    w.player.dofus.push('7113');
    expect(d.exposables()).toContain('d:7113');
    expect(d.exposer(c, 'd:9999')).toBe(false);
    expect(d.exposer(c, 'd:7113')).toBe(true);
    expect(w.coffre.vitrine![`${MERCENAIRE}:${c}`]).toBe('d:7113');
    expect(w.postes.some(p => p.meuble?.sorte === 'vitrine' && p.meuble.c === c)).toBe(true);
    expect(d.ranger(c)).toBe(true);
    expect(w.coffre.vitrine?.[`${MERCENAIRE}:${c}`]).toBeUndefined();
    expect(w.postes.some(p => p.meuble)).toBe(false);
  });
  it('10D : un mannequin par préréglage, un clic met la tenue', () => {
    const w = monde(), d = w.deco!, M = SPECIAUX.mannequin.id, p = w.player;
    const c1 = caseLibre(w, M, 240);
    expect(d.poser(M, c1)).toBe(true);
    expect(d.mannequin(c1)).toBe(0);
    expect(d.changerTenue(c1)).toBe(false);   // préréglage vide
    p.enregistrerPrereglage(0, 'Combat');
    expect(d.changerTenue(c1)).toBe(true);
    const c2 = caseLibre(w, M, c1 + 3); d.poser(M, c2);
    expect(d.mannequin(c2)).toBe(1);
    d.poser(M, caseLibre(w, M, c2 + 3));
    expect(d.refus(M, caseLibre(w, SPECIAUX.vitrine.id, 400))).toBe('Un mannequin par préréglage');
  });
  it('la déco est gardée au coffre du compte et relue ; sans la 0.6, pas de déco', () => {
    const w = monde(), d = w.deco!, id = Object.values(MEUBLES).find(m => m.theme === MERCENAIRE && m.tier === 'base' && m.couche === 1)!.id, c = caseLibre(w, id, 200);
    d.poser(id, c);
    const r = relireCoffre(JSON.parse(JSON.stringify(w.coffre)));
    expect(r.deco).toEqual(w.coffre.deco);
    const w2 = monde({ coffre: r });
    expect(w2.worldGrid!.mov[w2.worldGrid!.cellOf(w2.deco!.tag, c)]).toBe(MEUBLES[id].bloque ? 0 : 1);
    expect(relireCoffre({ onglets: [], deco: { 57: [{ m: 999999999, c: 3 }, { m: id, c: 9999 }] } }).deco).toBeUndefined();
    expect(monde({ test: undefined }).deco).toBeNull();
  });
  it('10E : l\'invité voit le Havre-Sac de l\'hôte (thème et meubles) et ne peut pas le décorer', () => {
    const h = monde(), id = Object.values(MEUBLES).find(m => m.theme === MERCENAIRE && m.tier === 'base' && m.couche === 1 && m.bloque)!.id, c = caseLibre(h, id, 200);
    h.deco!.poser(id, c);
    const sac = sacVuValide(JSON.parse(JSON.stringify(h.deco!.sac)))!;
    expect(sac.poses).toEqual([{ m: id, c }]);
    const g = monde({ sacHote: sac });
    expect(g.deco!.decorable).toBe(false);
    expect(g.worldGrid!.mov[g.worldGrid!.cellOf(g.deco!.tag, c)]).toBe(0);
    expect(g.deco!.refus(id, c + 30)).toBe('Ce n\'est pas ton Havre-Sac');
    expect(sacVuValide({ theme: 'x' })).toBeNull();
  });
  it('11C : coffre de donjon et succès donnent des meubles rares au compte ; 11B : lot d\'un thème en Boutique d\'Ogrines', () => {
    const w = monde();
    const id = w.gagnerMeubleRare('succes:1');
    expect(MEUBLES[id!].tier).toBe('rare');
    expect(w.coffre.meubles).toEqual([id]);
    expect(w.drainEvents().some(e => e.k === 'meubleGagne')).toBe(true);
    expect(w.deco!.possedes().has(id!)).toBe(true);
    const art = Object.entries(BOUTIQUE_OGRINES.articles).find(([, a]) => a.meubles === MERCENAIRE)!;
    expect(art[1]).toMatchObject({ cat: 'meuble', prix: 400 });
    w.recevoirAchats([art[0]]);
    for (const r of raresDuTheme(MERCENAIRE)) expect(w.coffre.meubles).toContain(r);
  });
  it('9A : le Bricoleur fabrique un meuble du Havre-Sac, une seule fois, pour le compte', () => {
    const w = monde(), p = w.player, i = ITEMS.recipes!.findIndex(r => r.result.startsWith(PREFIXE_MEUBLE) && r.metier === 'bricoleur');
    const r = ITEMS.recipes![i];
    p.metiers.bricoleur = { level: 200, xp: 0 };
    for (const [id, q] of r.ingredients) p.resources[id] = q * 3;
    w.atelierIci = () => null as never;   // pas d'atelier : refus
    expect(w.craft(i)).toBe(0);
    w.atelierIci = (() => ({ nom: 'Établi', metiers: ['bricoleur'], cartes: [] })) as never;
    expect(w.craftMax(i)).toBe(1);
    expect(w.craft(i)).toBe(1);
    expect(w.coffre.meubles).toContain(Number(r.result.slice(PREFIXE_MEUBLE.length)));
    expect(w.craftMax(i)).toBe(0);
  });
  it('la récolte du monde retient les ressources récoltées (sauvegarde du perso)', () => {
    const w = monde();
    w.player.recoltees.push('289');
    const e = exporterJoueur(w), w2 = monde();
    restaurerJoueur(w2, e);
    expect(w2.player.recoltees).toEqual(['289']);
  });
});

it('NO_INPUT reste utilisable (import)', () => { expect(NO_INPUT).toBeTruthy(); });
