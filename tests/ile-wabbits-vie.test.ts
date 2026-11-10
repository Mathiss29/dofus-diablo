import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APPARATS, BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import type { EtatQuetes } from '../src/sim/quests';
import { World } from '../src/sim/world';
import { LOOKS } from '../src/render/looks';

const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const vide: EtatQuetes = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (nuit = false) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 3, items: ITEMS, quetes: QUETES,
  boutiques: BOUTIQUES, apparats: APPARATS, reprise: vide, aujourdhui: '2026-11-10', test: {} as never, nuit: () => nuit, groupesPartout: true });
const O = GAME_DATA.zones.astrub.open!;

describe('île des Wabbits vivante (« Wabbits : 2A 2C 2D 11B 11C 12A 12B »)', () => {
  it('2C : le bateau du Capitaine Lily coûte 500 kamas à l’aller, le retour est gratuit', () => {
    const w = monde(), p = w.player, po = w.portes.find(x => x.nom === 'Bateau du Capitaine Lily')!;
    expect(po.prix).toBe(500);
    const payer = (w as unknown as { payerTraversee(x: typeof po): boolean }).payerTraversee.bind(w);
    p.kamas = 300;
    expect(payer(po)).toBe(false);
    p.kamas = 800;
    expect(payer(po)).toBe(true);
    expect(p.kamas).toBe(300);
  });

  it('2D : la Potion Wabbit déguise 10 min ; les Wabbits ne remarquent pas le joueur, les squelettes si', () => {
    const w = monde(), p = w.player;
    p.resources['960'] = 1;
    expect(w.boire('960')).toBe(true);
    expect(p.resources['960']).toBeUndefined();
    expect(p.deguise).toBe(600);
    for (const m of w.monsters) { m.dead = true; m.t = 0; }
    const wab = w.spawnMonster('wabbit', p.x + 80, p.y), sq = w.spawnMonster('wabbit_squelette', p.x - 80, p.y);
    for (let i = 0; i < 20; i++) { p.invuln = 1e9; w.step(0.05, NO_INPUT); }
    expect(wab.state).toBe('idle');
    expect(sq.state).not.toBe('idle');
    p.deguise = 0.05;
    for (let i = 0; i < 20; i++) { p.invuln = 1e9; w.step(0.05, NO_INPUT); }
    expect(wab.state).not.toBe('idle');
  });

  it('12A : la nuit, les groupes de l’îlot des Tombeaux grossissent', () => {
    const taille = (nuit: boolean) => {
      const w = monde(nuit), g = (w as unknown as { groups: { sub: unknown; members: unknown[] }[] }).groups.filter(x => x.sub === O.subareas['163'] && x.members.length);
      return Math.max(...g.map(x => x.members.length));
    };
    expect(O.subareas['163'].nuit!.groupSize[0]).toBeGreaterThan(O.subareas['163'].groupSize[0]);
    expect(taille(true)).toBeGreaterThan(O.subareas['163'].groupSize[1]);
    expect(taille(false)).toBeLessThanOrEqual(O.subareas['163'].groupSize[1]);
  });

  it('2A + 2D + 11B + 12B : Lily (quête de la Potion, avis sur Nono), le Wabbit pacifique et ses répétables', () => {
    expect(QUETES.pnj.lily.carte).toBe('24_-2');
    expect(QUETES.quetes.wabbits_intrusion.recompense?.objets).toEqual([['960', 3]]);
    expect(QUETES.quetes.avis_nono.repetable).toBe('semaine');
    expect(['wabbits_tombeaux', 'wabbits_garde'].map(q => QUETES.quetes[q].repetable)).toEqual(['jour', 'jour']);
    expect(BOUTIQUES.lily.map(a => a.id)).toEqual(['960']);
    for (const k of ['nono_le_wobot', 'wabbit_gm']) { expect(GAME_DATA.monsters[k]?.elite, k).toBe(true); expect(LOOKS[k], k).toBeTruthy(); }
    expect(O.subareas['164'].elite).toBe('nono_le_wobot');
    expect(O.subareas['161'].rare?.monstre).toBe('wabbit_gm');
  });
});
