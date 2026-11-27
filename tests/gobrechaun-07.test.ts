import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { GOBRECHAUN, defGobrechaun } from '../src/sim/gobrechaun';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { World } from '../src/sim/world';

const AS = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const VIDE = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = () => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(AS), seed: 9, items: ITEMS, quetes: QUETES, boutiques: BOUTIQUES,
  reprise: VIDE, sansGroupes: true, test: {} as never });
const pas = (w: World, s: number) => { for (let i = 0; i < 60 * s; i++) w.step(1 / 60, NO_INPUT); };
const LABO = 'Laboratoire caché';

describe('Gobrechaun et Laboratoire caché (0.7 : 6C + 15A)', () => {
  it('le Gobrechaun détale, sème des kamas, et abattu donne la clé du Laboratoire', () => {
    const w = monde(), wg = w.worldGrid!, p = w.player;
    const c = wg.cellToWorld(wg.freeByMap.get('-55_4')![200]);
    const g = w.spawnMonster(GOBRECHAUN.monstre, c.x, c.y, defGobrechaun(GAME_DATA.monsters.gobrechaun)); g.gobrechaun = true;
    p.x = c.x + 150; p.y = c.y; p.invuln = 1e9;
    pas(w, 4);
    expect(g.dead).toBe(false);
    expect(Math.hypot(g.x - c.x, g.y - c.y)).toBeGreaterThan(50);
    expect(w.drops.some(d => d.kamas)).toBe(true);
    w.killMonster(g);
    expect(p.resources[GOBRECHAUN.cle]).toBe(1);
  });

  it('pas attrapé à temps : il disparaît sans clé', () => {
    const w = monde(), wg = w.worldGrid!, p = w.player;
    const c = wg.cellToWorld(wg.freeByMap.get('-55_4')![200]);
    const g = w.spawnMonster(GOBRECHAUN.monstre, c.x, c.y, defGobrechaun(GAME_DATA.monsters.gobrechaun)); g.gobrechaun = true;
    p.x = c.x + 150; p.y = c.y; p.invuln = 1e9;
    pas(w, GOBRECHAUN.fuite + 2);
    expect(g.dead).toBe(true);
    expect(p.resources[GOBRECHAUN.cle] ?? 0).toBe(0);
  });

  it('la clé ouvre le Laboratoire caché (porte des Plaines herbeuses) ; le Gobrechaun y est le boss', () => {
    const w = monde(), p = w.player;
    const dj = w.zone.open!.donjons!.find(d => d.nom === LABO)!, po = w.portes.find(x => x.nom === LABO)!;
    expect(dj.bossForce).toBe('gobrechaun');
    expect(dj.bossVague![0]).toBe('gobrechaun');
    expect(ITEMS.resources[GOBRECHAUN.cle]?.cle).toBe(LABO);
    expect(BOUTIQUES.goultard.some(a => a.id === GOBRECHAUN.cle)).toBe(false);   // pas vendue : seulement sur le lutin
    expect(w.worldGrid!.mapAt(...([po.ends[0].x, po.ends[0].y] as [number, number]))?.tag).toBe('-55_4');
    p.level = 120; p.recompute();
    expect(w.allerArene(dj.arene!.tag)).toBe(true);
    pas(w, 1);
    const a = w.arene!;
    a.boss = null;
    for (let k = 0; k < 8 && !w.arene!.boss; k++) {
      for (const m of w.monsters) if (m.arene && !m.dead && m !== a.boss) w.killMonster(m);
      a.arrivees = a.arrivees.filter(x => x.type === 'gobrechaun' || a.vague > a.total);
      p.hp = p.maxHp; pas(w, 4);
    }
    const b = w.arene!.boss as { type: string; def: { boss?: boolean } } | null;
    expect(b?.type).toBe('gobrechaun');
    expect(b?.def.boss).toBe(true);
  });
});
