import { ISO, type Vec } from './iso';
import type { Rng } from './math';

/** Données d'une carte Dofus 3 exportée par tools/extraction/map_export.py. */
export interface MapData {
  id: number;
  grid: { w: number; h: number; ox: number; oy: number };
  /** 560 caractères, '1' = case marchable. */
  mov: string;
  sol: { x: number; y: number; w: number; h: number };
  decor: { f: string; x: number; y: number; c: number; o: number }[];
}

const COLS = 14, ROWS = 40;

/** Une carte Dofus : grille de 14 x 40 losanges, repère « carte » = pixels Dofus 1x.
 *  Fait le lien entre le monde du jeu (iso) et les cases de Dofus. Aucun affichage ici. */
export class GridMap {
  /** Échelle carte -> écran du jeu. */
  static readonly S = 1.1;
  /** Décalage vertical écran (hérité du proto : centre de l'ancienne arène de 1100). */
  static readonly OFFSET_Y = 550;
  readonly C: Vec;
  readonly free: number[] = [];

  constructor(readonly data: MapData) {
    const g = data.grid;
    this.C = { x: g.ox + 14.5 * g.w / 2, y: g.oy + (ROWS * g.h / 2 + g.h / 2) / 2 };
    for (let c = 0; c < COLS * ROWS; c++) if (data.mov[c] === '1') this.free.push(c);
  }
  /** Carte -> écran du jeu. */
  toScreen(mx: number, my: number): Vec {
    return { x: GridMap.S * (mx - this.C.x), y: GridMap.S * (my - this.C.y) + GridMap.OFFSET_Y };
  }
  fromScreen(sx: number, sy: number): Vec {
    return { x: sx / GridMap.S + this.C.x, y: (sy - GridMap.OFFSET_Y) / GridMap.S + this.C.y };
  }
  cellCenter(c: number): Vec {
    const g = this.data.grid, r = Math.floor(c / COLS), k = c % COLS;
    return { x: g.ox + g.w / 2 + k * g.w + (r % 2) * g.w / 2, y: g.oy + g.h / 2 + r * g.h / 2 };
  }
  /** Case Dofus sous un point carte, -1 hors grille. */
  cellAt(mx: number, my: number): number {
    const g = this.data.grid, px = mx - g.ox, py = my - g.oy;
    const r0 = Math.round((py - g.h / 2) / (g.h / 2));
    for (let r = r0 - 1; r <= r0 + 1; r++) {
      if (r < 0 || r >= ROWS) continue;
      const k0 = Math.round((px - g.w / 2 - (r % 2) * g.w / 2) / g.w);
      for (let k = k0 - 1; k <= k0 + 1; k++) {
        if (k < 0 || k >= COLS) continue;
        const cx = g.w / 2 + k * g.w + (r % 2) * g.w / 2, cy = g.h / 2 + r * g.h / 2;
        if (Math.abs(px - cx) / (g.w / 2) + Math.abs(py - cy) / (g.h / 2) <= 1) return r * COLS + k;
      }
    }
    return -1;
  }
  /** Point du monde du jeu -> marchable ? */
  walkable(wx: number, wy: number): boolean {
    const s = ISO.toScreen(wx, wy), m = this.fromScreen(s.x, s.y), c = this.cellAt(m.x, m.y);
    return c >= 0 && this.data.mov[c] === '1';
  }
  cellToWorld(c: number): Vec {
    const m = this.cellCenter(c), s = this.toScreen(m.x, m.y);
    return ISO.toWorld(s.x, s.y);
  }
  randomFree(rng: Rng): Vec { return this.cellToWorld(rng.pick(this.free)); }
  nearestFree(wx: number, wy: number): Vec {
    let best = this.cellToWorld(this.free[0]), bd = Infinity;
    for (const c of this.free) {
      const p = this.cellToWorld(c), d = (p.x - wx) ** 2 + (p.y - wy) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
}
