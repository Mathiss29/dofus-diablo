import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { PEPITE } from '../src/sim/items';
import { ARCHI, World } from '../src/sim/world';

const AS = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const VIDE = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = () => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(AS), seed: 3, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES, reprise: VIDE });
const M = GAME_DATA.monsters;
const chapitres = Object.keys(QUETES.quetes).filter(k => /^moisson_\d+$/.test(k));

describe('quête du Dofus Ocre, « L\'éternelle moisson » (Archis 7A 9A 9C 10A 11A-11C)', () => {
  it('9A+9C : toutes les âmes du jeu (archimonstres et boss) en pages d\'environ 20, rendues à l\'Assistante d\'Otomaï', () => {
    const ames = chapitres.flatMap(k => QUETES.quetes[k].etapes as { objectifs: { t: string; monstres?: string[] }[] }[]).flatMap(e => e.objectifs).flatMap(o => o.monstres ?? []);
    const attendu = Object.keys(M).filter(k => M[k].ame);
    expect(new Set(ames).size).toBe(ames.length);
    expect(ames.sort()).toEqual(attendu.sort());
    expect(attendu.some(k => M[k].boss)).toBe(true);
    for (const k of chapitres) {
      const q = QUETES.quetes[k], o = (q.etapes as { objectifs: { monstres: string[] }[] }[])[0].objectifs[0];
      expect(o.monstres.length).toBeGreaterThanOrEqual(15); expect(o.monstres.length).toBeLessThanOrEqual(25);
      expect(q.rendre).toBe('assistante_otomai');
      expect(q.recompense.pepites).toBeGreaterThan(0); expect(q.recompense.sac).toBeTruthy();
    }
    expect(QUETES.quetes.moisson_1.pnj).toBe('otomai');
    // 10A : l'Ocre seulement à la toute fin, avec le Kralamoure (pas encore là)
    expect(QUETES.quetes.moisson_fin.bientot).toBe(true);
    expect(QUETES.quetes.moisson_fin.recompense.dofus).toBe('7754');
    expect(chapitres.some(k => QUETES.quetes[k].recompense.dofus)).toBe(false);
  });

  it('une page avance avec les âmes capturées (elles restent dans le sac) et paie XP, kamas, Pépites, pierres, sac ; titre aux pages clés', () => {
    const w = monde(), p = w.player, Q = w.quetes!;
    p.level = 60;
    Q.prendre('moisson_1');
    const o = (QUETES.quetes.moisson_1.etapes as { objectifs: { monstres: string[] }[] }[])[0].objectifs[0];
    p.ames = o.monstres.slice(0, 3);
    w.step(1 / 60, NO_INPUT);
    expect(Q.enCours.find(c => c.id === 'moisson_1')?.compte[0]).toBe(3);
    const kamas = p.kamas;
    p.ames = [...o.monstres];
    w.step(1 / 60, NO_INPUT);
    expect(Q.finies.has('moisson_1')).toBe(true);   // l'Assistante n'est pas à Astrub : validée sur place
    expect(p.kamas).toBeGreaterThan(kamas);
    expect(p.resources[PEPITE]).toBeGreaterThan(0);
    expect(p.resources[ARCHI.pierre]).toBe(3);
    const o2 = (QUETES.quetes.moisson_2.etapes as { objectifs: { monstres: string[] }[] }[])[0].objectifs[0];
    Q.prendre('moisson_2'); p.ames.push(...o2.monstres); w.step(1 / 60, NO_INPUT);
    expect(Q.titres).toContain('Chasseur assidu');
  });

  it('9C : un boss vaincu avec une pierre donne son âme officielle, une seule fois', () => {
    const w = monde(), p = w.player;
    p.resources[ARCHI.pierre] = 2;
    w.killMonster(w.spawnMonster('royal', p.x + 40, p.y));
    expect(p.ames).toContain('royal');
    expect(p.resources[M.royal.ame!]).toBe(1);
    w.killMonster(w.spawnMonster('royal', p.x + 40, p.y));
    expect(p.resources[ARCHI.pierre]).toBe(1);
  });
});
