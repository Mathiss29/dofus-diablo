import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';

const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const vide = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = () => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 3, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  reprise: vide, aujourdhui: '2026-11-08' });

describe('Le tour du monde (maquette Tour)', () => {
  it('Metag Robill devant la Grange propose le chapitre 1 au niveau 15, pas les chapitres à venir', () => {
    const w = monde(), Q = w.quetes!, p = w.player;
    expect(Q.pnj('metag')?.tag).toBe('7_-24');
    p.level = 5; expect(Q.aDonner('metag')).toBeNull();
    p.level = 15; expect(Q.aDonnerTous('metag')).toEqual(['tdm_1']);
    Q.finies.add('tdm_1'); Q.finies.add('tdm_2'); p.level = 60;
    expect(Q.aDonnerTous('metag')).toEqual([]);   // chapitre 3 « bientôt » (Amakna)
  });
  it('une victoire d\'avant la quête compte (5A) ; le chapitre rendu donne les ressources des boss et la clé de la Cour (6B)', () => {
    const w = monde(), Q = w.quetes!, p = w.player;
    p.level = 20;
    Q.donjons['Crypte de Kardorim'] = { v: 1, m: 0 };
    Q.prendre('tdm_1');
    w.step(1 / 60, NO_INPUT);
    expect(Q.enCours.find(c => c.id === 'tdm_1')!.compte).toEqual([1, 0, 0]);
    Q.donjons['Grange du Tournesol Affamé'] = { v: 2, m: 0 }; Q.donjons['Château Ensablé'] = { v: 1, m: 3 };
    w.step(1 / 60, NO_INPUT);
    expect(Q.aRendre('metag')).toBe('tdm_1');
    const n = Q.pnj('metag')!; p.x = n.x + 30; p.y = n.y; Q.cliquer('metag');
    for (let i = 0; i < 30 && !Q.dialogue; i++) w.step(1 / 60, NO_INPUT);
    expect(Q.finies.has('tdm_1')).toBe(true);
    expect(p.resources['1568']).toBe(1);
    expect(p.resources['8682']).toBe(1);
    expect(Q.aDonner('metag')).toBeNull();   // chapitre 2 : niveau 25
    p.level = 25; expect(Q.aDonner('metag')).toBe('tdm_2');
  });
  it('la flèche de la quête mène à l\'entrée du prochain donjon (8A)', () => {
    const w = monde(), Q = w.quetes!;
    Q.donjons['Crypte de Kardorim'] = { v: 1, m: 0 }; Q.donjons['Grange du Tournesol Affamé'] = { v: 1, m: 0 };
    Q.prendre('tdm_1'); w.step(1 / 60, NO_INPUT);
    const po = w.entreeDonjon('Château Ensablé')!.ends[0];
    expect(Q.cible()).toEqual({ x: po.x, y: po.y });
  });
  it('carnet de route (8B) : premier passage avec la date et le temps jusqu\'au boss', () => {
    const w = monde(), Q = w.quetes!, p = w.player;
    expect(Q.carnet()).toHaveLength(30);
    p.resources['1568'] = 1; w.entrerDonjon('Cour du Bouftou Royal');
    for (let i = 0; i < 600; i++) w.step(1 / 60, NO_INPUT);
    w.emit({ k: 'kill', x: p.x, y: p.y, radius: 1, monster: w.bossDuDonjon('Cour du Bouftou Royal')! });
    const page = Q.carnet().find(x => x.donjon === 'Cour du Bouftou Royal')!;
    expect(page.premier?.d).toBe('2026-11-08');
    expect(page.premier?.t).toBeGreaterThanOrEqual(8);
    expect(Q.carnet().find(x => x.donjon === 'Grotte du Bworker')).toMatchObject({ bientot: true, premier: null });
    expect(Q.titre).toBeNull();
  });
});
