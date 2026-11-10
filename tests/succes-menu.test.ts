import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APPARATS, BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';

const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const monde = (test = false) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 3, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  apparats: APPARATS, test, reprise: { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} } });

describe('Menu des succès (« Succès : »)', () => {
  it('les succès sont rangés dans les catégories officielles, avec une icône officielle', () => {
    const cats = new Set(['Général', 'Exploration', 'Donjons', 'Monstres', 'Quêtes', 'Métiers', 'Élevage', 'Événements']);
    for (const [id, s] of Object.entries(QUETES.succes)) {
      expect(cats.has(s.categorie), id).toBe(true);
      if (s.icone) expect(readFileSync(new URL(`../public/assets/ui/succes/a_${s.icone}.webp`, import.meta.url)).length, id).toBeGreaterThan(0);
    }
    for (const r of ['duo', 'chrono', 'prudent', 'sansPotion']) expect(QUETES.succes[`defi_${r}_kardorim`]).toBeTruthy();
  });

  it('la récompense attend dans la fenêtre, se récupère une fois ; « Tout récupérer » prend le reste', () => {
    const w = monde(), q = w.quetes!, p = w.player;
    p.metiers.chasseur.level = 10;
    w.emit({ k: 'metierLevel', metier: 'chasseur', level: 10 }); w.step(0.05, NO_INPUT);
    expect(q.succes.has('metier_tous_10')).toBe(true);
    expect(q.aRecuperer('metier_tous_10')).toBe(true);
    const xp = p.xp + p.level * 1e9;
    expect(q.recuperer('metier_tous_10')).toBe(true);
    expect(p.xp + p.level * 1e9).toBeGreaterThan(xp);
    expect(q.recuperer('metier_tous_10')).toBe(false);
    const reste = q.nbARecuperer;
    expect(q.recupererTout()).toBe(reste);
    expect(q.nbARecuperer).toBe(0);
    expect(q.exporter().points).toBe(q.points);
  });

  it('épingles (3 au plus), succès de la partie de test cachés ailleurs', () => {
    const w = monde(), q = w.quetes!;
    for (const id of ['niveau_20', 'niveau_40', 'niveau_60', 'niveau_80']) q.epingler(id);
    expect(q.epingles).toEqual(['niveau_40', 'niveau_60', 'niveau_80']);
    const cache = Object.keys(QUETES.succes).find(k => QUETES.succes[k].test)!;
    expect(q.visible(cache)).toBe(false);
    expect(monde(true).quetes!.visible(cache)).toBe(true);
  });
});
