import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { SIEGE } from '../src/sim/siege07';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';

const AS = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const VIDE = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (test: boolean) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(AS), seed: 5, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  reprise: VIDE, sansGroupes: true, ...(test ? { test: {} as never } : {}) });
const pas = (w: World, s: number) => { for (let i = 0; i < 60 * s; i++) w.step(1 / 60, NO_INPUT); };
/** Le joueur sur la place, à côté de la plaque, qui clique dessus. */
const lancer = (w: World) => {
  const s = w.siege!, p = w.player;
  p.x = s.coeur.x - 60; p.y = s.coeur.y + 30;
  (p as unknown as { dest: { x: number; y: number } }).dest = { x: s.coeur.x, y: s.coeur.y };   // le clic sur la plaque
  pas(w, 0.1);
};

describe('Siège des Zoths (0.7 : 6A)', () => {
  it('la plaque et les passerelles sont marchables ; caché en partie publique', () => {
    const w = monde(true), s = w.siege!, wg = w.worldGrid!;
    expect(s).toBeTruthy();
    expect(wg.walkable(s.coeur.x, s.coeur.y)).toBe(true);
    expect(s.entrees.length).toBeGreaterThanOrEqual(3);
    for (const e of s.entrees) expect(wg.walkable(e.x, e.y)).toBe(true);
    expect(wg.mapAt(s.coeur.x, s.coeur.y)?.sub).toBe(468);
    const pub = monde(false);
    if (!pub.v07Ouvert) expect(pub.siege).toBeNull();
  });

  it('clic sur la plaque : les Zoths arrivent par vagues et usent la Pierre s’ils restent tranquilles', () => {
    const w = monde(true), s = w.siege!, p = w.player;
    p.level = 120; p.recompute();
    lancer(w);
    expect(s.enCours).toBe(true);
    expect(p.siege07.dernier).not.toBeNull();
    pas(w, 3);
    expect(s.vague).toBe(1);
    expect(w.monsters.filter(m => m.siege && !m.dead).length).toBeGreaterThanOrEqual(SIEGE.base);
    // le joueur s'éloigne (mais reste sur la place) et se laisse vivre : les Zoths montent sur la plaque
    p.x = s.coeur.x + 500; p.y = s.coeur.y; p.invuln = 999;
    for (let k = 0; k < 25; k++) { p.hp = p.maxHp; p.x = s.coeur.x + 500; p.y = s.coeur.y; pas(w, 1); }
    expect(s.pierre).toBeLessThan(SIEGE.pierre);
  });

  it('la Pierre tient 3 min : coffre pour le défenseur ; puis une heure d’attente', () => {
    const w = monde(true), s = w.siege!, p = w.player;
    p.level = 120; p.recompute();
    lancer(w);
    const fins: string[] = [];
    // le défenseur abat chaque Zoth qui arrive
    for (let t = 0; t < SIEGE.duree + 2; t++) {
      for (const m of w.monsters) if (m.siege && !m.dead && m.state !== 'spawn') w.killMonster(m);
      p.hp = p.maxHp; p.x = s.coeur.x - 60; p.y = s.coeur.y + 30;
      pas(w, 1);
      for (const e of w.drainEvents()) if (e.k === 'siegeFin') fins.push(e.coffre ?? 'rien');
    }
    expect(s.enCours).toBe(false);
    expect(fins).toEqual(['or']);
    expect(p.siege07.tenus).toBe(1);
    expect(p.siege07.or).toBe(1);
    // relancer tout de suite : refusé
    lancer(w);
    expect(s.enCours).toBe(false);
    expect(s.attente(p)).toBeGreaterThan(SIEGE.recharge - 300);
  });

  it('tous les défenseurs partis : le village tombe, pas de coffre', () => {
    const w = monde(true), s = w.siege!, p = w.player;
    lancer(w);
    const fins: (string | null)[] = [];
    p.x = s.coeur.x + SIEGE.place * 3; pas(w, 0.5);
    for (const e of w.drainEvents()) if (e.k === 'siegeFin') fins.push(e.coffre);
    expect(s.enCours).toBe(false);
    expect(fins).toEqual([null]);
  });
});
