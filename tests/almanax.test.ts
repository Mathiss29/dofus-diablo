import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { PEPITE } from '../src/sim/items';
import { exporterJoueur, restaurerJoueur } from '../src/sim/sauvegarde';
import { ALMANAX, jourAlmanax } from '../src/sim/almanax';
import { World } from '../src/sim/world';

const AS = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const VIDE = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (aujourdhui: string, test = true) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(AS), seed: 2, items: ITEMS, quetes: QUETES,
  boutiques: BOUTIQUES, reprise: VIDE, aujourdhui, ...(test ? { test: {} as never } : {}) });
/** Premier jour de l'année avec cet effet. */
const jourAvec = (e: string) => `2026-${Object.entries(ALMANAX.jours).find(([, j]) => j.effet === e)![0]}`;

describe('Almanax (version 0.3 : 15C)', () => {
  it('366 jours du calendrier officiel ; chaque offrande est une ressource du jeu', () => {
    const l = Object.values(ALMANAX.jours);
    expect(l).toHaveLength(366);
    for (const j of l) { expect(ITEMS.resources[j.offrande], j.bonus).toBeDefined(); expect(j.n).toBeGreaterThan(0); }
    expect(jourAlmanax('2026-01-02')?.bonus).toBe("Économie d'ingrédients");
    expect(QUETES.pnj.temples.services?.some(s => s.service === 'almanax')).toBe(true);
  });

  it("l'offrande prend l'objet, donne des Pépites et le bonus du jour ; une seule par jour ; caché hors 0.3", () => {
    const d = jourAvec('xp'), w = monde(d), p = w.player, j = w.almanaxDuJour!;
    expect(w.offrirAlmanax()).toBe(false);   // pas l'offrande
    p.resources[j.offrande] = j.n;
    expect(w.offrirAlmanax()).toBe(true);
    expect(p.resources[j.offrande]).toBeUndefined();
    expect(p.resources[PEPITE]).toBe(ALMANAX.pepites);
    expect(w.almanax?.effet).toBe('xp');
    p.resources[j.offrande] = j.n;
    expect(w.offrirAlmanax()).toBe(false);
    // le lendemain : plus de bonus
    const v = monde(`2026-${Object.keys(ALMANAX.jours).find(k => `2026-${k}` > d)}`); restaurerJoueur(v, exporterJoueur(w));
    expect(v.player.almanaxJour).toBe(d);
    expect(v.almanax).toBeNull();
    // le même jour : gardé
    const u = monde(d); restaurerJoueur(u, exporterJoueur(w));
    expect(u.almanax?.effet).toBe('xp');
    expect(monde(d, false).almanaxDuJour).toBeNull();
  });

  it('bonus : XP des monstres, XP de métier, jour « Pépites »', () => {
    const gain = (date: string, offrir: boolean) => {
      const w = monde(date), p = w.player, j = w.almanaxDuJour!;
      if (offrir) { p.resources[j.offrande] = j.n; w.offrirAlmanax(); }
      const xp0 = p.xp; w.killMonster(w.spawnMonster('bouftou', p.x + 40, p.y));
      p.metiers.paysan = { level: 100, xp: 0 }; p.gainMetierXp('paysan', 100, w);
      return { xp: p.xp - xp0, metier: p.metiers.paysan.xp, pep: p.resources[PEPITE] ?? 0 };
    };
    const x = jourAvec('xp'), m = jourAvec('metier'), pe = jourAvec('pepites');
    expect(gain(x, true).xp).toBeGreaterThan(gain(x, false).xp);
    expect(gain(m, true).metier).toBe(150);
    expect(gain(m, false).metier).toBe(100);
    expect(gain(pe, true).pep).toBe(ALMANAX.pepites * 2);
  });
});
