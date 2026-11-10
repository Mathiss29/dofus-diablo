import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_DATA } from '../src/sim/data';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';
import { NO_INPUT } from '../src/sim/input';
import { AGGRO, CASE, type Monster } from '../src/sim/monster';
import { World } from '../src/sim/world';

/** Maquette « Aggro » (Mathis, 2026-11-07) : 1B 2B 3A 4A+4B 5A 6A 7A 8A. */
const monde = JSON.parse(readFileSync(new URL('../public/assets/mondes/incarnam/monde.json', import.meta.url), 'utf8')) as WorldData;
const STEP = 1 / 60;
const newWorld = (seed = 3) => new World({ data: GAME_DATA, zone: 'incarnam', map: new WorldGrid(monde), seed, groupesPartout: true });
const run = (w: World, s: number) => { for (let i = 0; i < Math.round(s * 60); i++) w.step(STEP, NO_INPUT); };
const statuts = (w: World) => w.drainEvents().filter(e => e.k === 'status').map(e => (e as { text: string }).text);
/** Le joueur se pose à d cases du monstre, sur une case praticable (on cherche autour). */
function placer(w: World, m: Monster, d: number) {
  for (let a = 0; a < Math.PI * 2; a += 0.2) {
    const x = m.x + Math.cos(a) * d * CASE, y = m.y + Math.sin(a) * d * CASE;
    if (w.walkable(x, y)) { w.player.x = x; w.player.y = y; return; }
  }
  w.player.x = m.x + d * CASE; w.player.y = m.y;
}

describe('aggro des monstres', () => {
  it('1B : un monstre lâché à 20 cases reste en chasse ; perdu à plus de 25 cases pendant 4 s, il abandonne', () => {
    const w = newWorld(), m = w.monsters[0];
    m.state = 'chase';
    w.player.x = m.x + 20 * CASE; w.player.y = m.y;
    // on le tient à 20 cases du joueur : il poursuit sans abandonner, bien au-delà de l'ancienne laisse de 13 cases
    for (let i = 0; i < 60 * 3; i++) { w.player.x = m.x + 20 * CASE; w.player.y = m.y; w.step(STEP, NO_INPUT); }
    expect(m.state).not.toBe('return');
    expect(Math.hypot(m.x - m.homeX, m.y - m.homeY)).toBeGreaterThan(13 * CASE * 0.5);
    w.drainEvents();
    // le joueur file et reste à 40 cases (il court plus vite que le monstre, qui contourne maintenant le décor sans se coincer)
    const fuir = (s: number) => { for (let i = 0; i < Math.round(s * 60); i++) { w.player.x = m.x + 40 * CASE; w.player.y = m.y; w.step(STEP, NO_INPUT); } };
    fuir(AGGRO.perdu.duree - 1);
    expect(m.state).not.toBe('return');
    fuir(1.5);
    expect(m.state).toBe('return');
    expect(statuts(w)).toContain('Abandonne');   // 7A
  });

  it('2B : pas de soin en rentrant, puis 2 % par seconde après 5 s au calme', () => {
    const w = newWorld(), m = w.monsters[0];
    m.state = 'return'; m.hp = Math.round(m.maxHp / 2);
    m.x = m.homeX + 3 * CASE; m.y = m.homeY;
    if (!w.walkable(m.x, m.y)) { m.x = m.homeX; }
    w.player.x = m.x + 60 * CASE;
    const hp = m.hp;
    run(w, 0.5);
    expect(m.hp).toBe(hp);
    run(w, 6);
    expect(m.state).toBe('idle');
    expect(m.hp).toBeLessThan(m.maxHp);
    const avant = m.hp;
    run(w, 5);
    expect(m.hp).toBeGreaterThan(avant + m.maxHp * 0.05);
  });

  it('3A + 4A : un coup sur un monstre qui rentre le ramène avec tout son groupe', () => {
    const w = newWorld(), m = w.monsters[0];
    const mates = w.monsters.filter(o => o.group === m.group);
    for (const o of mates) o.state = 'return';
    placer(w, m, 1);
    w.hitCircle(m.x, m.y, 10, { dmg: 1, knock: 0 } as Parameters<World['hitCircle']>[3]);
    expect(mates.every(o => o.state === 'chase' || o.dead)).toBe(true);
    expect(statuts(w)).toContain('!');   // 7A
  });

  it('4A : toucher de loin un monstre qui attend réveille tout son groupe', () => {
    const w = newWorld(), m = w.monsters[0];
    const mates = w.monsters.filter(o => o.group === m.group);
    expect(mates.length).toBeGreaterThan(1);
    w.player.x = m.x + 60 * CASE; run(w, 1);   // fin de l'apparition
    placer(w, m, 12);
    w.hitCircle(m.x, m.y, 10, { dmg: 1, knock: 0 } as Parameters<World['hitCircle']>[3]);
    expect(mates.every(o => o.state === 'chase' || o.dead)).toBe(true);
  });

  it('4B : un groupe voisin qui voit le combat vient aider', () => {
    const w = newWorld(), [a, b] = [w.monsters[0], w.monsters.find(o => o.group !== w.monsters[0].group)!];
    b.x = b.homeX = a.x + 3 * CASE; b.y = b.homeY = a.y;
    w.player.x = a.x + 30 * CASE; w.player.y = a.y;
    w.aggroGroup(a);
    run(w, 0.3);
    expect(b.state).not.toBe('idle');
  });

  it('5A : loin du joueur, un monstre accélère jusqu\'à ×1,5', () => {
    const w = newWorld(), m = w.monsters[0];
    expect(m.rattrapage(2 * CASE)).toBe(1);
    expect(m.rattrapage(7 * CASE)).toBeCloseTo(1.25);
    expect(m.rattrapage(20 * CASE)).toBe(AGGRO.rattrapage.mult);
  });

  it('6A : Massacre, dès 5 monstres tués en série, +2 % d\'XP par monstre', () => {
    const w = newWorld(), cibles = w.monsters.filter(m => !m.def.boss).slice(0, 8);
    expect(cibles).toHaveLength(8);
    w.drainEvents();
    for (const m of cibles) w.killMonster(m);
    const ev = w.drainEvents().filter(e => e.k === 'massacre') as { n: number; bonus: number }[];
    expect(ev.map(e => e.n)).toEqual([5, 6, 7, 8]);
    expect(ev[0].bonus).toBe(10);
    run(w, AGGRO.massacre.fenetre + 0.5);
    expect(w.drainEvents().some(e => e.k === 'massacreFin')).toBe(true);
    expect(w.massacre.n).toBe(0);
  });

  it('8A : un boss garde sa laisse courte et repart à neuf', () => {
    const w = newWorld(), m = w.monsters[0];
    Object.defineProperty(m, 'def', { value: { ...m.def, boss: true } });
    m.state = 'chase'; m.hp = 1;
    w.player.x = m.x + 25 * CASE; w.player.y = m.y;   // 25 cases : un monstre normal poursuivrait encore
    run(w, 0.5);
    expect(m.state).toBe('idle');   // rentré (il était déjà chez lui)
    expect(m.hp).toBe(m.maxHp);
  });
});
