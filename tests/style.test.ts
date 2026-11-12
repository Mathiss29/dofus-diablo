import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APPARATS, BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { PEPITE } from '../src/sim/items';
import { relireCoffre } from '../src/sim/coffre';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';
import { nomOrne, placesTenues, STYLE } from '../src/sim/style';
import { World } from '../src/sim/world';

const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const monde = (coffre?: ReturnType<typeof relireCoffre>) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 1, items: ITEMS, quetes: QUETES,
  boutiques: BOUTIQUES, apparats: APPARATS, coffre, reprise: { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} } });

describe('Nouveaux usages des Pépites (« Apparats : » 5B)', () => {
  it('auréoles, effets de Zaap et ornements : achetés pour le compte, portés par perso', () => {
    const w = monde(), p = w.player, a = STYLE.aureoles[0];
    expect(w.acheterStyle('aureoles', a.id)).toBe(false);   // pas de Pépites
    p.resources[PEPITE] = 1000;
    expect(w.acheterStyle('aureoles', a.id)).toBe(true);
    expect(p.resources[PEPITE]).toBe(1000 - a.prix);
    expect(p.style.aureoles).toBe(a.id);
    expect(w.acheterStyle('aureoles', a.id)).toBe(false);   // déjà au compte
    expect(w.porterStyle('zaaps', STYLE.zaaps[0].id)).toBe(false);   // pas acheté
    expect(w.porterStyle('aureoles', null)).toBe(true);
    expect(p.style.aureoles).toBeUndefined();
    // un autre perso du compte : le style est là, à porter
    const w2 = monde(relireCoffre(JSON.parse(JSON.stringify(w.coffre))));
    expect(w2.porterStyle('aureoles', a.id)).toBe(true);
    expect(nomOrne('Mathis', 'etoile')).toBe('✦ Mathis ✦');
  });

  it('tenues enregistrées : une place offerte, d\'autres en Pépites ; elles gardent apparats et couleurs', () => {
    const w = monde(), p = w.player, id = Object.keys(APPARATS.objets).find(k => APPARATS.objets[k].slot === 'chapeau' && !APPARATS.objets[k].collection)!;
    w.ajouterApparat(id); w.porterApparat('chapeau', id);
    expect(placesTenues(p.placesTenue)).toBe(1);
    expect(w.enregistrerTenue(0, 'Chasse', [1, 2, 3])).toBe(true);
    expect(w.enregistrerTenue(1, 'Ville')).toBe(false);   // une seule place
    p.resources[PEPITE] = STYLE.tenues.prix[0];
    expect(w.acheterPlaceTenue()).toBe(true);
    expect(w.enregistrerTenue(1, 'Ville')).toBe(true);
    w.porterApparat('chapeau', null);
    expect(w.mettreTenue(0)).toEqual({ couleurs: [1, 2, 3] });
    expect(p.apparat.chapeau).toBe(id);
    const w2 = monde(); restaurerJoueur(w2, JSON.parse(JSON.stringify(exporterJoueur(w))));
    expect(w2.player.tenues.map(t => t.nom)).toEqual(['Chasse', 'Ville']);
    expect(w2.player.placesTenue).toBe(1);
  });
});
