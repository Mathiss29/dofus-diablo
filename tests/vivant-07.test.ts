import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APPARATS, BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { BOSS_MONDE, VIVANT, bossDuCreneau, candidatsInvasion, invasionDe, nouvellesDuMonde } from '../src/sim/mondeVivant';
import { REGLAGES_TEST } from '../src/sim/outilsTest';
import type { EtatQuetes } from '../src/sim/quests';
import { World } from '../src/sim/world';

const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const vide: EtatQuetes = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const paris = (j: number, h: number, m = 0) => Date.UTC(2026, 10, j, h, m) / 1000;
const P = VIVANT.boss.periode;
const V07 = ['boufmouth_legendaire', 'mega_guerrier_zoth', 'mega_momie_koalak'];
const OTOMAI = [454, 457];
function monde(s: { t: number }, test: boolean) {
  return new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 7, items: ITEMS, quetes: QUETES,
    boutiques: BOUTIQUES, apparats: APPARATS, reprise: vide, aujourdhui: '2026-11-28', horloge: () => s.t,
    ...(test ? { test: { ...REGLAGES_TEST } } : {}) });
}
function avancer(w: World, sec: number, s: { t: number }) {
  for (let t = 0; t < sec; t += 0.05) { w.player.invuln = 1e9; s.t += 0.05; w.step(0.05, NO_INPUT); w.drainEvents(); }
}

describe('0.7 (10B) : boss du monde de la tranche 90-120', () => {
  it('Boufmouth légendaire, Méga Guerrier Zoth et Méga Momie Koalak : monstres, carte et sous-zone de la 0.7', () => {
    for (const cle of V07) {
      const d = BOSS_MONDE[cle];
      expect(d?.v07, cle).toBe(true);
      for (const m of [...d.monstres, ...d.renforts]) expect(GAME_DATA.monsters[m], m).toBeTruthy();
      expect(astrub.maps.find(m => m.tag === d.carte)?.sub, d.carte).toBe(d.sousZone);
      expect(GAME_DATA.zones.astrub.open!.subareas[String(d.sousZone)]?.v07, cle).toBe(true);
    }
    expect(GAME_DATA.monsters.mega_guerrier_zoth.hp).toBeGreaterThan(GAME_DATA.monsters.guerrier_zoth.hp);
    expect(ITEMS.drops.mega_momie_koalak.length).toBe(ITEMS.drops.momie_koalak.length);
  });

  it('dans la rotation seulement quand la 0.7 est visible', () => {
    const vus = (v07: boolean) => { const S = new Set<string>(); for (let c = 0; c < 400; c++) S.add(bossDuCreneau(c + Math.floor(paris(1, 0) / P), true, v07)); return S; };
    const pub = vus(false), test = vus(true);
    for (const cle of V07) { expect(pub.has(cle)).toBe(false); expect(test.has(cle), cle).toBe(true); }
  });

  it('en partie de test, le Méga Guerrier Zoth apparaît au Village des Zoths au niveau 120', () => {
    let debut = 0;
    for (let c = Math.floor(paris(28, 3) / P); !debut; c++) if (bossDuCreneau(c, true, true) === 'mega_guerrier_zoth') debut = c * P;
    const s = { t: debut + 5 }, w = monde(s, true);
    avancer(w, 0.2, s);
    const b = w.vivant!.boss!;
    expect(b.cle).toBe('mega_guerrier_zoth');
    const p = w.player, f = w.map.nearestFree(b.centre.x + 200, b.centre.y);
    p.x = f.x; p.y = f.y;
    avancer(w, 0.3, s);
    const m = w.monsters.find(x => x.bossMonde === 'mega_guerrier_zoth')!;
    expect(m).toBeTruthy();
    expect(m.def.level).toBe(120);
  });
});

describe('0.7 (10C) : invasion d\'Otomaï', () => {
  it('jamais dans une région fermée en public', () => {
    const pub = candidatsInvasion(GAME_DATA, true, false);
    for (const s of OTOMAI) expect(pub).not.toContain(s);
    for (let h = 0; h < 72; h++) expect(invasionDe(paris(28, 0) + h * 3600 + 60, pub)?.venue).not.toBe('otomai');
    expect(nouvellesDuMonde(GAME_DATA, paris(28, 11, 5), true, false).invasion).not.toMatch(/Otomaï/);
  });

  it('à 11 h, 16 h et 21 h quand la 0.7 est visible, dans les Plaines herbeuses ou la Tourbière sans fond', () => {
    const c = candidatsInvasion(GAME_DATA, true, true);
    for (const s of OTOMAI) expect(c).toContain(s);
    for (let j = 28; j < 31; j++) for (let h = 0; h < 24; h++) {
      const i = invasionDe(paris(j, h, 5), c)!;
      expect(i.venue === 'otomai', `${j} ${h}`).toBe(VIVANT.invasion.otomai.heures.includes(h));
      if (i.venue === 'otomai') expect(OTOMAI).toContain(i.sub);
    }
    expect(nouvellesDuMonde(GAME_DATA, paris(28, 16, 5), true, true).invasion).toMatch(/venue d'Otomaï/);
  });

  it('les groupes envahis sont des Zoths et des Tourbassingues', () => {
    const s = { t: paris(28, 21, 5) }, w = monde(s, true);
    avancer(w, 0.1, s);
    const inv = w.vivant!.invasion!;
    expect(inv.venue).toBe('otomai');
    expect(w.vivant!.envahisseurs()).toEqual(VIVANT.invasion.otomai.envahisseurs);
  });
});

describe('0.7 (10D) : tableaux de contrats', () => {
  it('Otomaï et Pandala ont leur tableau ; les sous-zones 0.7 ont leurs titres', () => {
    const Q = QUETES as unknown as { pnj: Record<string, { contrats?: number[]; v07?: boolean }>; contrats: { titres: Record<string, unknown[]> } };
    expect(Q.pnj.tableau_otomai.v07).toBe(true); expect(Q.pnj.tableau_pandala.v07).toBe(true);
    const sz = GAME_DATA.zones.astrub.open!.subareas;
    for (const [k, s] of Object.entries(sz)) if (s.v07 && s.monsters.length) {
      expect(Q.contrats.titres[k]?.length, s.name).toBe(3);
      expect(Object.values(Q.pnj).some(p => Array.isArray(p.contrats) && p.contrats.includes(Number(k))), s.name).toBe(true);
    }
  });
});
