import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WorldGrid, type WorldData } from '../src/sim/gridmap';

const W = JSON.parse(readFileSync(new URL('../public/assets/mondes/astrub/monde.json', import.meta.url), 'utf8')) as WorldData;
const wg = new WorldGrid(W) as unknown as WorldGrid & { neighbors(c: number): number[]; cols: number; mov: Uint8Array };
/** Case [rang, colonne] d'une carte « x_y » dans la grille du continent. */
const cas = (tag: string, r: number, k: number) => { const [x, y] = tag.split('_').map(Number); return ((y - W.origin![1]) * 40 + r) * wg.cols + (x - W.origin![0]) * 14 + k; };
/** Chemin de a à b sans sortir d'un rayon de n cases (pas de grand détour par une autre rue). */
const proche = (a: number, b: number, n: number) => {
  const ra = Math.floor(a / wg.cols), ka = a % wg.cols, vu = new Set([a]), file = [a];
  while (file.length) { const c = file.shift()!; if (c === b) return true;
    for (const v of wg.neighbors(c)) if (!vu.has(v) && Math.abs(Math.floor(v / wg.cols) - ra) <= n && Math.abs(v % wg.cols - ka) <= n) { vu.add(v); file.push(v); } }
  return false;
};

describe('passages de la Cité d\'Astrub', () => {
  it('on descend de [5,-17] à [5,-16] par la porte du rempart (cases des deux cartes décalées au raccord, retour de Mathis 2026-11-10)', () => {
    expect(wg.mov[cas('5_-17', 38, 11)]).toBe(1);
    expect(proche(cas('5_-17', 34, 11), cas('5_-16', 4, 7), 12)).toBe(true);
  });
});
