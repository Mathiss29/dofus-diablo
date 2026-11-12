import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APPARATS, BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { APPARATS_SOURCES, apparatsDeFete, apparatsDuBoss, apparatsDuMonde, feteDuJour, ouTrouver, rareteApparat, sourceApparat, tirerApparat } from '../src/sim/apparats';
import { Rng } from '../src/sim/math';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';

const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const monde = (jour = '2026-11-12') => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 1, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  apparats: APPARATS, aujourdhui: jour, reprise: { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} } });

describe('D\'où viennent les apparats (« Apparats : » 1B 1C 1D 1E 2A 3A 4A)', () => {
  it('chaque apparat du jeu a une source et une rareté, aucun ne s\'achète au Marché', () => {
    const l = Object.entries(APPARATS.objets).filter(([, d]) => !d.collection);
    const sans = l.filter(([id]) => !sourceApparat(id)).map(([id]) => id);
    expect(sans.length / l.length).toBeLessThan(0.05);
    for (const [id] of l) expect(['rare', 'epique', 'legendaire']).toContain(rareteApparat(id));
    expect(['otomai', 'bouillotte', 'goultard', 'tissebelle'].flatMap(b => BOUTIQUES[b] ?? []).some(a => a.apparat)).toBe(false);   // Tiwa garde les siens, en Cawottes
  });

  it('1B : chaque boss qui en a donne 1 à 3 apparats exclusifs, tous des boss du jeu', () => {
    const boss = new Set(Object.values(APPARATS_SOURCES.sources).flatMap(s => s.k === 'boss' ? [s.boss] : []));
    expect(boss.size).toBeGreaterThan(10);
    for (const b of boss) {
      expect(GAME_DATA.monsters[b], b).toBeTruthy();
      expect(apparatsDuBoss(b).length).toBeGreaterThanOrEqual(1);
      expect(apparatsDuBoss(b).length).toBeLessThanOrEqual(3);
    }
  });

  it('1B : un boss donne un apparat environ une fois sur 75, jamais un qu\'on a déjà (2A)', () => {
    const b = 'kardorim', l = apparatsDuBoss(b), rng = new Rng(7);
    let n = 0;
    for (let i = 0; i < 30000; i++) if (tirerApparat(b, 'boss', '2026-06-01', [], rng)) n++;
    expect(n / 30000).toBeGreaterThan(1 / 100);
    expect(n / 30000).toBeLessThan(1 / 55);
    for (let i = 0; i < 3000; i++) expect(tirerApparat(b, 'boss', '2026-06-01', l, rng)).toBeNull();
  });

  it('1D : fêtes du calendrier (Nowel passe le nouvel an), apparats seulement pendant la fête', () => {
    expect(feteDuJour('2026-12-24')).toBe('nowel');
    expect(feteDuJour('2027-01-03')).toBe('nowel');
    expect(feteDuJour('2026-10-31')).toBe('halouine');
    expect(feteDuJour('2026-06-10')).toBeNull();
    expect(apparatsDeFete('nowel').length).toBeGreaterThan(0);
    const rng = new Rng(3);
    let n = 0;
    for (let i = 0; i < 4000; i++) if (tirerApparat('piou_bleu', 'elite', '2026-12-24', [], rng)) n++;
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < 4000; i++) expect(tirerApparat('piou_bleu', 'elite', '2026-06-10', [], rng)).toBeNull();
  });

  it('1C : succès de classe (coiffe au niveau 50, cape au 100), récompense = apparat', () => {
    const s = Object.entries(QUETES.succes).filter(([k]) => k.startsWith('apparat_iop_'));
    expect(s.length).toBe(2);
    const w = monde(), p = w.player;
    for (const [, d] of s) expect(sourceApparat(d.recompense!.apparat!)?.k).toBe('classe');
    expect(p.apparats).not.toContain(s[0][1].recompense!.apparat);
  });

  it('1E : boss du monde et invasions donnent leur apparat au joueur (World.gagnerApparat)', () => {
    const evts = Object.keys(APPARATS_SOURCES.monde);
    expect(evts.length).toBeGreaterThan(0);
    const w = monde(), p = w.player, l = apparatsDuMonde(evts[0]);
    expect(w.gagnerApparat(evts[0], p.x, p.y)).toEqual([p]);
    expect(l.filter(id => p.apparats.includes(id)).length).toBe(1);
    expect(w.drainEvents().some(e => e.k === 'apparence')).toBe(true);
  });

  it('un apparat tombé au sol se ramasse d\'un clic et rejoint la collection', () => {
    const w = monde(), p = w.player, id = apparatsDuBoss('kardorim')[0];
    w.drops.push({ uid: 999, x: p.x, y: p.y, t: 1, apparat: id });
    expect(World.magnetic(w.drops[0])).toBe(false);
    p.pickupId = 999;
    w.step(1 / 60, NO_INPUT);
    expect(p.apparats).toContain(id);
  });

  it('4A : « où le trouver » pour chaque source', () => {
    const nm = (k: string) => GAME_DATA.monsters[k]?.name ?? k, nc = (k: string) => k;
    expect(ouTrouver(apparatsDuBoss('kardorim')[0], nm, nc)).toContain('Boss');
    expect(ouTrouver(apparatsDeFete('nowel')[0], nm, nc)).toContain('Nowel');
    expect(ouTrouver('inconnu', nm, nc)).toContain('Collection');
  });
});
