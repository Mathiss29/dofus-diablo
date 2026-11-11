import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APPARATS, BOUTIQUES, GAME_DATA, ITEMS, QUETES } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import type { EtatQuetes } from '../src/sim/quests';
import type { SimEvent } from '../src/sim/events';
import { World } from '../src/sim/world';

const astrub = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const vide: EtatQuetes = { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} };
const monde = () => new World({ data: GAME_DATA, zone: 'astrub', map: new WorldGrid(astrub), seed: 4, items: ITEMS, quetes: QUETES,
  boutiques: BOUTIQUES, apparats: APPARATS, reprise: vide, aujourdhui: '2026-11-10', test: {} as never });
function avancer(w: World, s: number, ev: SimEvent[] = []) {
  for (let t = 0; t < s; t += 0.05) {
    for (const p of w.players) { p.invuln = 1e9; p.hp = p.maxHp; }
    w.step(0.05, NO_INPUT); ev.push(...w.drainEvents());
  }
  return ev;
}

describe('Village Kanniboul (« Kanniboul : » une seule salle, 2A 3A+3B 4A)', () => {
  it('une seule vraie salle (le trône au masque), porte à clé dans la Forêt des Masques', () => {
    const w = monde();
    expect(w.worldGrid!.mapByTag('arene_kanniboul')?.inside).toBe(1);
    const po = w.portes.find(p => p.nom === 'Village Kanniboul')!;
    expect(po.cle).toBe('11798');
    expect(po.ends[0].tag).toBe('29_9');
    expect(po.ends[1].tag).toBe('arene_kanniboul');
    expect(BOUTIQUES.goultard.some(a => a.id === '11798')).toBe(true);
  });
  it('3B : tant qu’un joueur de tambour joue, Kanniboul Ebil a +30 % de Dommages ; ils se taisent quand on les abat', () => {
    const w = monde(), ev: SimEvent[] = [];
    expect(w.allerArene('arene_kanniboul')).toBe(true);
    for (let i = 0; i < 400 && !w.arene?.boss; i++) {
      avancer(w, 0.25, ev);
      for (const m of w.monsters) if (m.arene && !m.def.boss && m.type !== 'kanniboul_tam' && !m.dead) { m.dead = true; m.t = 0; }
    }
    const a = w.arene!, b = a.boss!;
    expect(b.type).toBe('kanniboul_ebil');
    avancer(w, 2, ev);
    const tams = w.monsters.filter(m => m.arene && !m.dead && m.type === 'kanniboul_tam');
    expect(tams.length).toBe(2);
    expect(a.tambours).toBe(true);
    expect(b.furyPct).toBeGreaterThanOrEqual(30);
    expect(ev.some(e => e.k === 'status' && e.text === 'Les tambours battent !')).toBe(true);
    for (const t of tams) w.killMonster(t);
    avancer(w, 1, ev);
    expect(a.tambours).toBe(false);
    expect(ev.some(e => e.k === 'status' && e.text === 'Les tambours se taisent')).toBe(true);
    avancer(w, 1, ev);
    expect(b.furyPct).toBe(0);
  });
});
