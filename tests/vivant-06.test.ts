import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APPARATS, BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { BOSS_MONDE, VIVANT, bossDuCreneau, candidatsInvasion, invasionDe, nouvellesDuMonde, rendezVous } from '../src/sim/mondeVivant';
import { REGLAGES_TEST } from '../src/sim/outilsTest';
import type { EtatQuetes } from '../src/sim/quests';
import { World } from '../src/sim/world';

const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const vide: EtatQuetes = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const paris = (j: number, h: number, m = 0) => Date.UTC(2026, 10, j, h, m) / 1000;
const P = VIVANT.boss.periode;
const V06 = ['tyranne_la_terrible', 'mama_koalak', 'mega_craqueleur_des_plaines'];
const FRIGOST = [600, 601];
function monde(s: { t: number }, test: boolean) {
  return new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 7, items: ITEMS, quetes: QUETES,
    boutiques: BOUTIQUES, apparats: APPARATS, reprise: vide, aujourdhui: '2026-11-14', horloge: () => s.t,
    ...(test ? { test: { ...REGLAGES_TEST } } : {}) });
}
function avancer(w: World, sec: number, s: { t: number }) {
  for (let t = 0; t < sec; t += 0.05) { w.player.invuln = 1e9; s.t += 0.05; w.step(0.05, NO_INPUT); w.drainEvents(); }
}

describe('0.6 (9B) : un boss du monde par région', () => {
  it('les 3 boss de la 0.6 existent, avec leurs monstres officiels, leur carte et leur sous-zone 0.6', () => {
    for (const cle of V06) {
      const d = BOSS_MONDE[cle];
      expect(d?.v06, cle).toBe(true);
      for (const m of [...d.monstres, ...d.renforts]) expect(GAME_DATA.monsters[m], m).toBeTruthy();
      expect(astrub.maps.some(m => m.tag === d.carte), d.carte).toBe(true);
      expect(GAME_DATA.zones.astrub.open!.subareas[String(d.sousZone)]?.v06, cle).toBe(true);
    }
  });

  it('dans la rotation seulement quand la 0.6 est visible', () => {
    const vus = (v06: boolean) => { const S = new Set<string>(); for (let c = 0; c < 400; c++) S.add(bossDuCreneau(c + Math.floor(paris(1, 0) / P), v06)); return S; };
    const pub = vus(false), test = vus(true);
    for (const cle of V06) { expect(pub.has(cle)).toBe(false); expect(test.has(cle), cle).toBe(true); }
    expect(rendezVous(paris(14, 9)).suivant.cle).toBe(rendezVous(paris(14, 9), false).suivant.cle);
  });

  it('en partie de test, Tyranne la Terrible apparaît dans les Abraknydes au niveau 80', () => {
    let debut = 0;
    for (let c = Math.floor(paris(14, 3) / P); !debut; c++) if (bossDuCreneau(c, true) === 'tyranne_la_terrible') debut = c * P;
    const s = { t: debut + 5 }, w = monde(s, true);
    avancer(w, 0.2, s);
    const b = w.vivant!.boss!;
    expect(b.cle).toBe('tyranne_la_terrible');
    const p = w.player, f = w.map.nearestFree(b.centre.x + 200, b.centre.y);
    p.x = f.x; p.y = f.y;
    avancer(w, 0.3, s);
    const m = w.monsters.find(x => x.bossMonde === 'tyranne_la_terrible')!;
    expect(m).toBeTruthy();
    expect(m.def.level).toBe(80);
  });
});

describe('0.6 (9D) : invasion de Frigost dans la Bourgade', () => {
  it('jamais dans une région fermée en public', () => {
    const pub = candidatsInvasion(GAME_DATA, false);
    for (const s of FRIGOST) expect(pub).not.toContain(s);
    for (let h = 0; h < 72; h++) expect(invasionDe(paris(14, 0) + h * 3600 + 60, pub)?.frigost).toBeFalsy();
    expect(nouvellesDuMonde(GAME_DATA, paris(14, 13, 5), false).invasion).not.toMatch(/Frigost/);
  });

  it('à 13 h, 19 h et 22 h quand la 0.6 est visible, au Port de givre ou à la Bourgade', () => {
    const c = candidatsInvasion(GAME_DATA, true);
    for (const s of FRIGOST) expect(c).toContain(s);
    for (let j = 14; j < 18; j++) for (let h = 0; h < 24; h++) {
      const i = invasionDe(paris(j, h, 5), c)!;
      expect(!!i.frigost, `${j} ${h}`).toBe(VIVANT.invasion.frigost.heures.includes(h));
      if (i.frigost) expect(FRIGOST).toContain(i.sub);
    }
    expect(nouvellesDuMonde(GAME_DATA, paris(14, 13, 5), true).invasion).toMatch(/venue de Frigost/);
  });

  it('les groupes envahis sont des Rats Bougris et des Gélikans', () => {
    const s = { t: paris(14, 19, 5) }, w = monde(s, true);
    avancer(w, 0.1, s);
    const inv = w.vivant!.invasion!;
    expect(inv.frigost).toBe(true);
    expect(w.vivant!.envahisseurs()).toEqual(VIVANT.invasion.frigost.envahisseurs);
    const c = w.vivant!.centreSousZone(inv.sub), p = w.player;
    p.x = c.x; p.y = c.y;
    avancer(w, 0.5, s);
    const envahis = w.monsters.filter(m => m.envahi && !m.dead);
    expect(envahis.length).toBeGreaterThan(0);
    const L = VIVANT.invasion.frigost.envahisseurs, frig = envahis.filter(m => !m.def.elite && !m.def.archiDe);
    expect(frig.length).toBeGreaterThan(0);
    for (const m of frig) expect(L).toContain(m.type);
  });
});
