import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import type { EtatQuetes } from '../src/sim/quests';
import { World } from '../src/sim/world';
import { LOOKS } from '../src/render/looks';

const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const vide: EtatQuetes = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (test: boolean) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 3, items: ITEMS, quetes: QUETES,
  boutiques: BOUTIQUES, reprise: vide, aujourdhui: '2026-11-10', ...(test ? { test: {} as never } : {}) });
const subs = GAME_DATA.zones.astrub.open!.subareas;

describe('île des Wabbits (« 0.4 suite : 10A », Wabbits : 1B 2A+2B)', () => {
  it('les 4 sous-zones officielles, en partie de test, avec leurs monstres officiels dessinés', () => {
    for (const s of ['161', '162', '163', '164']) {
      expect(subs[s].essai, s).toBe(true);
      expect(subs[s].region).toBe('Île des Wabbits');
      expect(subs[s].monsters.length, s).toBeGreaterThan(0);
      for (const m of subs[s].monsters) expect(LOOKS[GAME_DATA.monsters[m].look ?? m], m).toBeTruthy();
    }
    expect(subs['163'].monsters).toEqual(['wabbit_squelette', 'black_wabbit_squelette']);
    expect(astrub.maps.filter(m => !m.inside && [161, 162, 163, 164].includes(m.sub)).length).toBe(58);
  });
  it('1B : l’île et ses trois îlots se tiennent à pied par les passerelles, du bateau au Château', () => {
    const wg = new WorldGrid(astrub); wg.ouvrirEssai();
    const depart = wg.cellOf('24_-2', 318);
    const vu = new Set([depart]), file = [depart];
    while (file.length) {
      const c = file.pop()!, r = Math.floor(c / wg.cols), k = c % wg.cols, o = r % 2;
      for (const n of [c - 2 * wg.cols, c + 2 * wg.cols, c - 1, c + 1, (r - 1) * wg.cols + k - 1 + o, (r - 1) * wg.cols + k + o, (r + 1) * wg.cols + k - 1 + o, (r + 1) * wg.cols + k + o])
        if (n >= 0 && wg.mov[n] && !vu.has(n)) { vu.add(n); file.push(n); }
    }
    const tags = new Set([...vu].map(c => wg.mapOfCell(c)?.tag));
    for (const t of ['25_-4', '24_-13', '21_-12', '27_-12', 'pont_wabbits_0']) expect(tags.has(t), t).toBe(true);
    for (const t of tags) expect(t, 'jamais hors carte').toBeTruthy();
  });
  it('2A + 2B : le bateau du Port de Madrestam, le Zaap de l’île et la porte du Château (clef chez Goultard), ouvert à tous depuis la 0.4', () => {
    const w = monde(true);
    const bateau = w.portes.find(p => p.nom === 'Bateau du Capitaine Lily')!;
    expect(bateau.ends.map(e => e.tag)).toEqual(['9_-2', '24_-2']);
    const chateau = w.portes.find(p => p.nom === 'Château du Wa Wabbit')!;
    expect(chateau.ends.map(e => e.tag)).toEqual(['24_-13', 'chateau_ww_1']);
    expect(chateau.cle).toBe('14464');
    expect(ITEMS.resources['14464'].cle).toBe('Château du Wa Wabbit');
    expect(w.zone.open!.checkpoints.some(c => c.name === 'Zaap Île de la Cawotte')).toBe(true);
    const hors = monde(false);
    expect(hors.portes.some(p => p.nom === 'Bateau du Capitaine Lily')).toBe(true);   // 0.4 publique (2026-11-11)
  });
});
