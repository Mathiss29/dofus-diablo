import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APPARATS, BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import type { EtatQuetes } from '../src/sim/quests';
import type { SimEvent } from '../src/sim/events';
import { WOBOT } from '../src/sim/arene';
import { World } from '../src/sim/world';

const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const vide: EtatQuetes = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = () => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 9, items: ITEMS, quetes: QUETES,
  boutiques: BOUTIQUES, apparats: APPARATS, reprise: vide, aujourdhui: '2026-11-10', test: {} as never });
/** Avance de s secondes, joueur increvable ; `garder` le repose à cet endroit à chaque pas (il reste loin du Wobot). */
function avancer(w: World, s: number, ev: SimEvent[] = [], garder?: { x: number; y: number }) {
  for (let t = 0; t < s; t += 0.05) {
    for (const p of w.players) { p.invuln = 1e9; p.hp = p.maxHp; if (garder) { p.x = garder.x; p.y = garder.y; p.kx = p.ky = 0; } }
    w.step(0.05, NO_INPUT); ev.push(...w.drainEvents());
  }
  return ev;
}
function jusquAuBoss(w: World, ev: SimEvent[]) {
  expect(w.allerArene('arene_terrier')).toBe(true);
  for (let i = 0; i < 400 && !w.arene?.boss; i++) {
    avancer(w, 0.25, ev);
    if (w.arene) for (const m of w.monsters) if (m.arene && !m.def.boss && !m.dead) { m.dead = true; m.t = 0; }
  }
  for (const m of w.monsters) if (m.arene && !m.def.boss && !m.dead) { m.dead = true; m.t = 0; }
  return w.arene!;
}
/** Un point libre de l'arène à d px du Wobot. */
function loinDe(w: World, x: number, y: number, d: number) {
  const wg = w.worldGrid!, libres = wg.freeByMap.get('arene_terrier')!;
  for (let a = 0; a < Math.PI * 2; a += 0.2) { const q = { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d }; if (wg.walkable(q.x, q.y)) return q; }
  return wg.nearestFree(x + d, y, libres);
}

describe('Wa Wobot (« Wabbits : 10A 10B 10C 10D »)', () => {
  it('10A : Mékattwaction attire le joueur et pose un Tamponneur, qui devient une garde s’il n’est pas cassé', () => {
    const w = monde(), p = w.player, ev: SimEvent[] = [];
    const a = jusquAuBoss(w, ev), b = a.boss!;
    expect(b.type).toBe('wa_wobot');
    const q = loinDe(w, b.x, b.y, 7 * 48);
    p.x = q.x; p.y = q.y;
    for (let i = 0; i < 200 && !a.tampons.length; i++) avancer(w, 0.05, ev);
    expect(ev.some(e => e.k === 'wobot' && e.quoi === 'tampon')).toBe(true);
    const T = a.tampons[0];
    expect(T.type).toBe('wobot_tamponneur');
    expect(T.twansT).toBeGreaterThan(0);
    avancer(w, 1, ev);
    expect(Math.hypot(p.x - b.x, p.y - b.y), 'attiré vers le Wobot').toBeLessThan(Math.hypot(q.x - b.x, q.y - b.y) - 48);
    const gardes = () => w.monsters.filter(m => m.type === 'black_wo_wabbit' && m.arene && !m.dead).length, avant = gardes();
    avancer(w, WOBOT.delai + 0.2, ev);
    expect(T.dead).toBe(true);
    expect(ev.some(e => e.k === 'wobot' && e.quoi === 'twansmute')).toBe(true);
    expect(gardes()).toBeGreaterThan(avant);
  });

  it('10B : Mékawapace se brise si on tape fort, sinon elle durcit', () => {
    const w = monde(), ev: SimEvent[] = [];
    const a = jusquAuBoss(w, ev), b = a.boss!, K = WOBOT.carapace;
    for (let i = 0; i < 400 && !b.carapace; i++) avancer(w, 0.05, ev);
    expect(b.carapace).toBe(1);
    expect(b.subis).toBe(K.subis);
    b.hp -= Math.ceil(b.maxHp * K.part) + 1;
    avancer(w, 0.1, ev);
    expect(ev.some(e => e.k === 'wobot' && e.quoi === 'brisee')).toBe(true);
    expect(b.carapace).toBe(0);
    expect(b.subis).toBe(K.brise);
    // la suivante, on ne la touche pas : elle durcit
    for (let i = 0; i < 600 && !b.carapace; i++) avancer(w, 0.05, ev);
    expect(b.carapace).toBe(1);
    b.hp = Math.max(b.hp, b.maxHp * 0.7);
    avancer(w, K.duree + 0.2, ev);
    expect(ev.some(e => e.k === 'wobot' && e.quoi === 'durcie')).toBe(true);
    expect(b.subis).toBe(K.durci);
  });

  it('10C : un joueur resté loin voit le Wobot prendre la place d’un Tamponneur, puis Wouste', () => {
    const w = monde(), p = w.player, ev: SimEvent[] = [];
    const a = jusquAuBoss(w, ev), b = a.boss!;
    const loin = loinDe(w, b.x, b.y, 13 * 48), T = w.spawnMonster('wobot_tamponneur', loin.x + 30, loin.y);
    T.arene = true; T.twansT = 60; a.tampons.push(T);
    const tx = T.x, ty = T.y;
    for (let i = 0; i < 160 && !ev.some(e => e.k === 'wobot' && e.quoi === 'substitution'); i++) avancer(w, 0.05, ev, loin);
    expect(ev.some(e => e.k === 'wobot' && e.quoi === 'substitution')).toBe(true);
    expect(Math.hypot(b.x - tx, b.y - ty)).toBeLessThan(60);
    avancer(w, WOBOT.woustePause + 0.1, ev, loin);
    expect(ev.some(e => e.k === 'slam')).toBe(true);
    expect(p.dead).toBe(false);
  });

  it('10D : le Wobot cassé, le Wa Wabbit en sort et s’enfuit pour de bon ; victoire normale', () => {
    const w = monde(), ev: SimEvent[] = [];
    const a = jusquAuBoss(w, ev), b = a.boss!;
    b.hp = 0; w.killMonster(b);
    avancer(w, 0.1, ev);
    const ep = ev.find(e => e.k === 'bossEpilogue');
    expect(ep && ep.k === 'bossEpilogue' && ep.name).toBe('Wa Wabbit');
    expect(ev.some(e => e.k === 'areneFin')).toBe(true);
    const m = a.epilogue!.m;
    expect(m.intouchable).toBe(true);
    avancer(w, 25, ev);
    expect(m.dead).toBe(true);
    expect(a.epilogue).toBeNull();
    expect(w.quetes!.donjons['Terrier du Wa Wabbit']?.v ?? 0).toBeGreaterThan(0);
  });
});
