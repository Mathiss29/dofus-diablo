import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES, RECOLTES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { PEPITE } from '../src/sim/items';
import { COMMANDES } from '../src/sim/commandes';
import type { EtatQuetes } from '../src/sim/quests';
import { World } from '../src/sim/world';

const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const vide: EtatQuetes = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const grille = new WorldGrid(astrub);
const monde = (jour = '2026-11-13') => new World({ data: GAME_DATA, zone: 'astrub', map: grille, seed: 3, items: ITEMS, quetes: QUETES, recoltes: RECOLTES,
  boutiques: BOUTIQUES, reprise: vide, aujourdhui: jour });
function parler(w: World, pnj: string) {
  const Q = w.quetes!, n = Q.pnj(pnj)!, p = w.player;
  Q.dialogue = null; p.x = n.x + 30; p.y = n.y; Q.cliquer(pnj);
  for (let i = 0; i < 30 && !Q.dialogue; i++) w.step(1 / 60, NO_INPUT);
}

describe('« Métiers : » commandes des artisans (8A + 8B)', () => {
  it('8A : le tableau du Bastion propose 3 commandes par jour, une par métier, faisables au niveau du perso, les mêmes toute la journée', () => {
    const w = monde(), Q = w.quetes!, p = w.player;
    p.metiers.alchimiste = { level: 30, xp: 0 }; p.metiers.paysan = { level: 20, xp: 0 };
    const l = Q.commandes('crieur');
    expect(l).toHaveLength(COMMANDES.parJour.atelier);
    const metiers = l.map(id => id.split(':')[5]);
    expect(new Set(metiers).size).toBe(l.length);
    for (const id of l) {
      const q = Q.def(id), [, , , objet, , m, niv] = id.split(':');
      expect(ITEMS.resources[objet]).toBeDefined();
      expect(Number(niv)).toBeLessThanOrEqual(Math.max(1, p.metierLevel(m)));
      expect(q.rendre).toBe('crieur');
      expect(q.recompense.kamas).toBeGreaterThan(0); expect(q.recompense.pepites).toBeGreaterThan(0); expect(q.recompense.metier?.[0]).toBe(m);
    }
    p.metiers.alchimiste.level = 60;   // monter de niveau ne change pas les commandes du jour
    expect(Q.commandes('crieur')).toEqual(l);
    expect(monde('2026-11-14').quetes!.commandes('crieur')).not.toEqual(l);
  });
  it('8B : Hazel Ementaire (Astrub) commande des ressources récoltées autour d\'elle ; on les rend, elle les prend', () => {
    const w = monde(), Q = w.quetes!, p = w.player;
    const l = Q.commandes('hazel');
    expect(l).toHaveLength(COMMANDES.parJour.ville);
    const id = l[0], q = Q.def(id);
    const liv = (q.etapes as { objectifs: { t: string; objet: string; n: number }[] }[])[0].objectifs[0];
    expect(liv.t).toBe('livrer');
    expect(RECOLTES.ressources[liv.objet]?.metier).toBeTruthy();
    // dialogue : « Des commandes ? », puis accepter
    parler(w, 'hazel');
    const r = Q.dialogue!.reponses.findIndex(x => x.a === 'commandes');
    expect(r).toBeGreaterThanOrEqual(0);
    Q.repondre(r);
    Q.repondre(Q.dialogue!.reponses.findIndex(x => x.a === 'voir' && x.quete === id));
    Q.repondre(Q.dialogue!.reponses.findIndex(x => x.a === 'accepter'));
    expect(Q.enCours.some(c => c.id === id)).toBe(true);
    // pas assez dans le sac : rien ne se passe
    p.resources[liv.objet] = liv.n - 1;
    w.step(1 / 60, NO_INPUT);
    parler(w, 'hazel');
    expect(Q.finies.has(id)).toBe(false);
    // assez : la quête attend d'être rendue, Hazel prend les objets et paie
    p.resources[liv.objet] = liv.n + 2;
    const k0 = p.kamas, pep0 = p.resources[PEPITE] ?? 0, m = id.split(':')[5], xp0 = p.metiers[m]?.xp ?? 0, lv0 = p.metierLevel(m);
    w.step(1 / 60, NO_INPUT);
    parler(w, 'hazel');
    expect(Q.finies.has(id)).toBe(true);
    expect(p.resources[liv.objet]).toBe(2);
    expect(p.kamas).toBeGreaterThan(k0);
    expect(p.resources[PEPITE]).toBeGreaterThan(pep0);
    expect(p.metierLevel(m) > lv0 || (p.metiers[m]?.xp ?? 0) > xp0).toBe(true);
    expect(Q.commandesLibres('hazel')).not.toContain(id);
  });
});
