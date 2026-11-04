import type { WavesDef } from './defs';
import type { Rng } from './math';

export interface WavePlan { monsters: string[]; boss: string | null; archi: string | null }

/** Compose la vague n d'une zone à partir de ses données (zones.json). */
export function planWave(w: number, def: WavesDef, rng: Rng): WavePlan {
  const list: string[] = [];
  const count = (c: { base: number; perWave: number; fromWave?: number }) =>
    w >= (c.fromWave ?? 1) ? Math.max(0, c.base + Math.floor(c.perWave * w)) : 0;
  let boss: string | null = null;
  if (def.bossEvery > 0 && w % def.bossEvery === 0) {
    boss = def.boss; list.push(boss);
    const n = count(def.escort);
    for (let i = 0; i < n; i++) list.push(def.escort.monsters[i % def.escort.monsters.length]);
  } else {
    for (const p of def.pack) { const n = count(p); for (let i = 0; i < n; i++) list.push(p.monster); }
  }
  // Archimonstre : rare, chance par palier de vague
  let chance = 0;
  for (const c of def.archimonstres.chance) if (w >= c.fromWave) chance = c.value;
  let archi: string | null = null;
  if (chance > 0 && rng.next() < chance) { archi = rng.pick(def.archimonstres.monsters); list.push(archi); }
  return { monsters: list, boss, archi };
}
