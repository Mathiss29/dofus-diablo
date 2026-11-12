import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APPARATS, BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';
import { World } from '../src/sim/world';
import { objetsPortes } from '../src/render/squelette';

const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const monde = () => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 1, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  apparats: APPARATS, reprise: { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} } });
const EQ = JSON.parse(readFileSync(new URL('../public/assets/sprites/squelette/equipement.json', import.meta.url), 'utf8')) as { objets: Record<string, number> };

describe('apparat et objets visibles (Apparence 4A 4B 5A)', () => {
  it('coiffes et capes d\'apparat officielles, chacune avec son dessin porté', () => {
    const l = Object.entries(APPARATS.objets).filter(([, d]) => d.slot !== 'familier' && !d.collection);   // familiers d'apparat : tests/familiers.test.ts
    expect(l.length).toBeGreaterThan(600);
    for (const [id, d] of l) { expect(['chapeau', 'cape']).toContain(d.slot); expect(EQ.objets[id], d.name).toBeTruthy(); }
  });

  it('coiffes, capes et boucliers du jeu : la plupart ont leur dessin', () => {
    const vis = Object.entries(ITEMS.equipment).filter(([, d]) => d.slot === 'chapeau' || d.slot === 'cape' || d.slot === 'bouclier');
    const faits = vis.filter(([id]) => EQ.objets[id]);
    expect(faits.length / vis.length).toBeGreaterThan(0.6);
  });

  it('gagné une seule fois ; porté par-dessus l\'objet, ou objet caché ; gardé dans la sauvegarde', () => {
    const w = monde(), p = w.player, id = Object.keys(APPARATS.objets).find(k => APPARATS.objets[k].slot === 'chapeau' && !APPARATS.objets[k].collection)!;
    expect(w.ajouterApparat(id)).toBe(true);
    expect(w.ajouterApparat(id)).toBe(false);   // déjà à lui (2A)
    expect(w.porterApparat('cape', id)).toBe(false);   // pas le bon emplacement
    const coiffe = Object.keys(EQ.objets).find(k => ITEMS.equipment[k]?.slot === 'chapeau')!;
    p.equipment.chapeau = { uid: 1, id: coiffe, rarity: 'commun', stats: {}, extra: [] };
    expect(objetsPortes(p.equipment, p.apparat)).toEqual([coiffe]);
    expect(w.porterApparat('chapeau', id)).toBe(true);
    expect(objetsPortes(p.equipment, p.apparat)).toEqual([id]);
    expect(w.porterApparat('chapeau', '0')).toBe(true);
    expect(objetsPortes(p.equipment, p.apparat)).toEqual([]);
    w.porterApparat('chapeau', id);
    const e = exporterJoueur(w), w2 = monde();
    restaurerJoueur(w2, e);
    expect(w2.player.apparats).toEqual([id]);
    expect(w2.player.apparat.chapeau).toBe(id);
  });
});
