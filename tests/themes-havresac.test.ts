import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES, TEINTURES, THEMES_HAVRESAC } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { PEPITE } from '../src/sim/items';
import { coffreVide, relireCoffre, type Coffre } from '../src/sim/coffre';
import { themeChoisi, themesEnJeu, zoneAvecTheme } from '../src/sim/havresac';
import { World } from '../src/sim/world';
import type { SimEvent } from '../src/sim/events';

const lire = (w: string) => JSON.parse(readFileSync(new URL(`../public/assets/mondes/${w}/monde.json`, import.meta.url), 'utf8')) as WorldData;
const VIDE = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (zone: string, coffre: Coffre = coffreVide()) => {
  const z = zone === 'havresac' ? zoneAvecTheme(GAME_DATA.zones.havresac, themeChoisi(THEMES_HAVRESAC, coffre)).open!.world : zone;
  return new World({ data: GAME_DATA, zone, map: new WorldGrid(lire(z)), seed: 1, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES, reprise: VIDE,
    themesHavreSac: THEMES_HAVRESAC, teintures: TEINTURES, coffre });
};

describe('Thèmes du Havre-Sac (Magasin 6B)', () => {
  it('46 thèmes officiels en plus de Mercenaire, chacun son monde, ses cases d\'arrivée et d\'arche marchables', () => {
    const l = themesEnJeu(THEMES_HAVRESAC);
    expect(l.length).toBe(47);
    for (const t of l) {
      const m = lire(t.monde!), wg = new WorldGrid(m), tag = m.maps[0].tag;
      expect(m.maps[0].id, t.nom).toBe(t.carte);
      const a = wg.cellToWorld(wg.cellOf(tag, t.arrivee!));
      expect(wg.walkable(a.x, a.y), `${t.nom} : arrivée`).toBe(true);
      expect(existsSync(new URL(`../public/assets/ui/havresac/${t.id}.webp`, import.meta.url)), `${t.nom} : vignette`).toBe(true);
    }
  });
  it('Mercenaire offert ; un thème acheté en Pépites (pour le compte) se pose, et le Havre-Sac prend son monde et ses cases', () => {
    const c = coffreVide(), w = monde('astrub', c), p = w.player;
    expect(themeChoisi(THEMES_HAVRESAC, c).id).toBe(57);
    p.resources[PEPITE] = THEMES_HAVRESAC.prix - 1;
    expect(w.acheterTheme(9)).toBe(false);
    p.resources[PEPITE] = THEMES_HAVRESAC.prix;
    expect(w.acheterTheme(9)).toBe(true);
    expect(p.resources[PEPITE] ?? 0).toBe(0);
    expect(c).toMatchObject({ themes: [9], theme: 9 });
    expect(w.acheterTheme(9)).toBe(false);   // déjà au compte
    expect(w.acheterTheme(8)).toBe(false);   // Spectacle : pas de carte dans le jeu
    expect(w.poserTheme(57)).toBe(true);     // Mercenaire, toujours là
    expect(w.poserTheme(12)).toBe(false);    // pas acheté
    // relu (sauvegarde du compte) : rien de perdu
    const r = relireCoffre(JSON.parse(JSON.stringify({ ...c, theme: 9 })));
    expect(r).toMatchObject({ themes: [9], theme: 9 });
    const h = monde('havresac', r), t = THEMES_HAVRESAC.themes.find(x => x.id === 9)!;
    expect(h.zone.open!.world).toBe('havresac_9');
    expect(h.zone.open!.havreSac).toMatchObject({ arrivee: t.arrivee, arche: t.arche, theme: 9 });
    expect(h.walkable(h.player.x, h.player.y)).toBe(true);
    expect(h.poutch).not.toBeNull();
    expect(h.zaapRefuge()?.name).toBe('Zaap du Havre-Sac');
  });
  it('changer de thème dans le Havre-Sac y ramène avec le nouveau décor', () => {
    const c: Coffre = { ...coffreVide(), themes: [3] }, w = monde('havresac', c);
    w.drainEvents();
    expect(w.poserTheme(3)).toBe(true);
    const ev = w.drainEvents() as SimEvent[];
    expect(ev.some(e => e.k === 'changeZone' && e.zone === 'havresac')).toBe(true);
  });
});

describe('Teintures (Magasin 6E)', () => {
  it('19 classes, couleurs officielles (Iop = couleurs de création du Iop), achetées une fois pour le compte', () => {
    expect(TEINTURES.teintures.length).toBe(19);
    expect(TEINTURES.teintures.every(t => t.c.length === 5)).toBe(true);
    const c = coffreVide(), w = monde('astrub', c), p = w.player;
    p.resources[PEPITE] = TEINTURES.prix * 2;
    expect(w.acheterTeinture('iop')).toBe(true);
    expect(w.acheterTeinture('iop')).toBe(false);
    expect(w.acheterTeinture('inconnue')).toBe(false);
    expect(c.teintures).toEqual(['iop']);
    expect(relireCoffre(JSON.parse(JSON.stringify(c))).teintures).toEqual(['iop']);
  });
});
