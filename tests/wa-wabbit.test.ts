import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APPARATS, BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import type { EtatQuetes } from '../src/sim/quests';
import { DOFUS_CAWOTTE, tenterDofusCawotte } from '../src/sim/guerre';
import type { SimEvent } from '../src/sim/events';
import type { Monster } from '../src/sim/monster';
import type { MonsterSpell } from '../src/sim/defs';
import { World } from '../src/sim/world';

const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const vide: EtatQuetes = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = (test = true) => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 5, items: ITEMS, quetes: QUETES,
  boutiques: BOUTIQUES, apparats: APPARATS, reprise: vide, aujourdhui: '2026-11-10', ...(test ? { test: {} as never } : {}) });
const CHATEAU = 'Château du Wa Wabbit', TERRIER = 'Terrier du Wa Wabbit';
function avancer(w: World, s: number, ev: SimEvent[] = []) {
  for (let t = 0; t < s; t += 0.05) { for (const p of w.players) { p.invuln = 1e9; p.hp = p.maxHp; } w.step(0.05, NO_INPUT); ev.push(...w.drainEvents()); }
  return ev;
}
/** Dans l'arène du Château, jusqu'à l'arrivée du Wa Wabbit (les vagues sont balayées). */
function jusquAuBoss(w: World, ev: SimEvent[]) {
  expect(w.allerArene('arene_chateau_ww')).toBe(true);
  for (let i = 0; i < 400 && !w.arene?.boss; i++) {
    avancer(w, 0.25, ev);
    if (w.arene) for (const m of w.monsters) if (m.arene && !m.def.boss && !m.dead) { m.dead = true; m.t = 0; }
  }
  return w.arene!;
}

describe('Wa Wabbit et Terrier (« Wabbits : 7C 8A 8B 9A 9B 9C 14A 14D »)', () => {
  it('9B + 9C : la porte du Terrier au resto de Waldo demande sa clé, que Tiwa Cawoteuw vend après le Château', () => {
    const w = monde(), p = w.player;
    const po = w.portes.find(x => x.nom === TERRIER)!;
    expect(po.ends.map(e => e.tag)).toEqual(['28_-12', 'terrier_1']);
    expect(po.cle).toBe('14465');
    p.v04 = true; p.resources['20446'] = 1000;
    expect(w.acheter('tiwa_cawoteuw', '14465')).toBe(false);
    w.quetes!.donjons[CHATEAU] = { v: 1, m: 0 };
    expect(w.acheter('tiwa_cawoteuw', '14465')).toBe(true);
    expect(monde(false).portes.some(x => x.nom === TERRIER)).toBe(false);
  });

  it('8A + 8B + 9A : Cawottes Woyales à 66 %, Awmuwe Woyale à 33 %, fuite dans le trou qui mène au Terrier la première fois', () => {
    const w = monde(), p = w.player, ev: SimEvent[] = [];
    const a = jusquAuBoss(w, ev), b = a.boss!;
    expect(b.type).toBe('wa_wabbit');
    expect(a.premiers.has(p.id)).toBe(true);
    b.hp = Math.floor(b.maxHp * 0.6);
    avancer(w, 1.5, ev);
    expect(b.intouchable).toBe(true);
    const caw = w.monsters.filter(m => m.type === 'cawotte_woyale' && !m.dead);
    expect(caw.length).toBe(3);
    for (const c of caw) expect(Math.hypot(c.x - b.x, c.y - b.y)).toBeLessThan(250);
    for (const c of caw) { c.dead = true; c.t = 0; }
    avancer(w, 0.2, ev);
    expect(b.intouchable).toBe(false);
    b.hp = Math.floor(b.maxHp * 0.3);
    avancer(w, 0.1, ev);
    expect(b.subis).toBeCloseTo(0.3);
    // à 0 PV : il s'enfuit (victoire, coffre), le trou reste ouvert
    b.hp = 0; b.dead = true; b.t = 0.6;
    avancer(w, 0.1, ev);
    expect(ev.some(e => e.k === 'bossFuite')).toBe(true);
    expect(ev.some(e => e.k === 'areneFin')).toBe(true);
    expect(a.trou).not.toBeNull();
    // il saute dans le trou : arrivée dans la première salle du Terrier, sans clé
    p.x = a.trou!.x; p.y = a.trou!.y;
    avancer(w, 2, ev);
    expect(w.worldGrid!.mapAt(p.x, p.y)?.tag).toBe('terrier_1');
  });

  it('9A : après une première victoire, le trou ne mène plus nulle part', () => {
    const w = monde(), ev: SimEvent[] = [];
    w.quetes!.donjons[CHATEAU] = { v: 1, m: 0 };
    const a = jusquAuBoss(w, ev);
    expect(a.premiers.size).toBe(0);
  });

  it('7C : un Tiwabbit Kiafin laissé en vie court donner l’alarme, et des gardes arrivent', () => {
    const w = monde(), ev: SimEvent[] = [];
    expect(w.allerArene('arene_chateau_ww')).toBe(true);
    let k: Monster | undefined;
    for (let i = 0; i < 60 && !k; i++) { avancer(w, 0.25, ev); k = w.monsters.find(m => m.type === 'tiwabbit_kiafin' && m.arene && !m.dead); }
    const a = w.arene!;
    expect(k, 'un Kiafin dans les vagues').toBeTruthy();
    for (const m of w.monsters) if (m !== k && m.arene && !m.dead) { m.dead = true; m.t = 0; }
    avancer(w, 40, ev);
    expect(ev.some(e => e.k === 'areneAlarme' && e.n === 0)).toBe(true);
    expect(ev.some(e => e.k === 'areneAlarme' && e.n === 4)).toBe(true);
    expect(a.alarmes).toBeGreaterThanOrEqual(1);
  });

  it('14A + 14D : le Dofus Cawotte tombe rarement, la malchance monte à chaque boss raté, et sa Sagesse Wabbit marche', () => {
    const w = monde(), p = w.player;
    expect(DOFUS_CAWOTTE.taux.wa_wabbit).toBe(0.002);
    expect(DOFUS_CAWOTTE.taux.wa_wobot).toBe(0.004);
    expect(tenterDofusCawotte(w, 'bouftou')).toBe(false);
    let n = 0;
    for (let i = 0; i < 20 && !p.dofus.includes(DOFUS_CAWOTTE.id); i++) { tenterDofusCawotte(w, 'wa_wabbit'); n++; }
    if (!p.dofus.includes(DOFUS_CAWOTTE.id)) expect(p.guerre.malchance).toBeCloseTo(n * DOFUS_CAWOTTE.hausse);
    p.guerre.malchance = 1;
    tenterDofusCawotte(w, 'wa_wobot');
    expect(p.dofus).toContain(DOFUS_CAWOTTE.id);
    expect(p.guerre.malchance).toBe(0);
    expect(tenterDofusCawotte(w, 'wa_wobot')).toBe(false);
    // Sagesse Wabbit : une tentative de retrait de PA donne +25 Esquive PA (2 fois au plus)
    expect(p.porteDofus('cawotte')).toBe(true);
    const m = w.spawnMonster('wabbit', p.x + 30, p.y), avant = p.stat('esquivePA');
    const S = { id: 1, name: 'Test', pa: 1, po: [1, 1], relance: 0, anim: 0, zone: 'P1', allies: true, effects: [{ k: 'dmg', element: 'terre', min: 1, max: 1 }, { k: 'pa', n: -1, dur: 1 }] } as unknown as MonsterSpell;
    p.invuln = 0;
    for (let i = 0; i < 3; i++) { p.invuln = 0; w.monsterSpellHits(m, S, p); }
    expect(p.stat('esquivePA')).toBe(avant + 50);
  });
});
