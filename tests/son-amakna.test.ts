import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MANIFESTE, sonDuLieu } from '../src/render/son';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { World } from '../src/sim/world';

const AS = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;

describe('musiques, ambiances et sons des donjons d’Amakna (« 0.4 suite : 13A + 13B + 13C »)', () => {
  it('13A + 13B : chaque sous-zone d’Amakna a sa musique officielle et son ambiance, plus inquiétante la nuit au Cimetière', () => {
    const subs = Object.entries(GAME_DATA.zones.astrub.open!.subareas).filter(([, s]) => s.essai).map(([id]) => +id);
    expect(subs.length).toBeGreaterThan(20);
    for (const s of subs) {
      const l = sonDuLieu(MANIFESTE, s, false, null);
      expect(l, `sous-zone ${s}`).not.toBeNull();
      expect(l!.fond.every(f => MANIFESTE.ambiances[f])).toBe(true);
    }
    expect(sonDuLieu(MANIFESTE, 10, false, null)!.musique).toBe('amakna_village');
    expect(sonDuLieu(MANIFESTE, 6, true, null)!.fond).toContain('cimetiere_nuit');
    expect(sonDuLieu(MANIFESTE, 6, false, null)!.fond).not.toContain('cimetiere_nuit');
    // Astrub garde sa musique
    expect(sonDuLieu(MANIFESTE, 95, false, null)).toBeNull();
  });
  it('13C : chaque donjon d’Amakna a la musique des salles du thème de son boss, et les sons des grilles, vagues et boss existent', () => {
    const w = new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(AS), seed: 1, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES, test: {} as never });
    let n = 0;
    for (const d of w.zone.open!.donjons!) {
      const b = d.bossVague?.find(x => GAME_DATA.monsters[x]?.boss) ?? w.bossDuDonjon(d.nom), m = b ? MANIFESTE.boss?.[b] : undefined;
      if (!m) continue;
      n++;
      expect(sonDuLieu(MANIFESTE, undefined, false, m)!.musique, d.nom).toMatch(/^donjon_/);
    }
    expect(n).toBeGreaterThan(8);
    for (const k of ['fermeture', 'ouverture', 'boss', 'vague', 'portail', 'porte', 'salleVide']) expect(MANIFESTE.donjon?.[k], k).toBeTruthy();
  });
});
