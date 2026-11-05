import { ISO, type Vec } from './iso';
import type { Rng } from './math';

export interface Rect { x: number; y: number; w: number; h: number }
export interface DecorPlace { f: string; x: number; y: number; c: number; o: number }

/** Données d'une carte Dofus 3 exportée par tools/extraction/map_export.py. */
export interface MapData {
  id?: number;
  /** cols/rows : 14 x 40 pour une carte, plus pour un monde fait de plusieurs cartes. */
  grid: { w: number; h: number; ox: number; oy: number; cols?: number; rows?: number };
  /** Une lettre par case, '1' = case marchable. */
  mov: string;
  sol?: Rect;
  decor?: DecorPlace[];
}

/** Une carte Dofus dans un monde (tools/extraction/world_export.py). */
export interface WorldMapEntry { x: number; y: number; id: number; sub: number; tag: string; sol: Rect; decor: DecorPlace[] }
/** Plusieurs cartes Dofus voisines collées bord à bord en une seule grande grille. */
export interface WorldData extends MapData { origin: [number, number]; maps: WorldMapEntry[] }

/** Taille d'une carte Dofus en cases. */
export const MAP_COLS = 14, MAP_ROWS = 40;

/** Une carte Dofus : grille de 14 x 40 losanges, repère « carte » = pixels Dofus 1x.
 *  Fait le lien entre le monde du jeu (iso) et les cases de Dofus. Aucun affichage ici. */
export class GridMap {
  /** Échelle carte -> écran du jeu. */
  static readonly S = 1.1;
  /** Décalage vertical écran (hérité du proto : centre de l'ancienne arène de 1100). */
  static readonly OFFSET_Y = 550;
  readonly C: Vec;
  readonly free: number[] = [];
  readonly cols: number;
  readonly rows: number;

  constructor(readonly data: MapData) {
    const g = data.grid;
    this.cols = g.cols ?? MAP_COLS; this.rows = g.rows ?? MAP_ROWS;
    this.C = { x: g.ox + (this.cols + 0.5) * g.w / 2, y: g.oy + (this.rows * g.h / 2 + g.h / 2) / 2 };
    for (let c = 0; c < this.cols * this.rows; c++) if (data.mov[c] === '1') this.free.push(c);
  }
  /** Carte -> écran du jeu. */
  toScreen(mx: number, my: number): Vec {
    return { x: GridMap.S * (mx - this.C.x), y: GridMap.S * (my - this.C.y) + GridMap.OFFSET_Y };
  }
  fromScreen(sx: number, sy: number): Vec {
    return { x: sx / GridMap.S + this.C.x, y: (sy - GridMap.OFFSET_Y) / GridMap.S + this.C.y };
  }
  cellCenter(c: number): Vec {
    const g = this.data.grid, r = Math.floor(c / this.cols), k = c % this.cols;
    return { x: g.ox + g.w / 2 + k * g.w + (r % 2) * g.w / 2, y: g.oy + g.h / 2 + r * g.h / 2 };
  }
  /** Case Dofus sous un point carte, -1 hors grille. */
  cellAt(mx: number, my: number): number {
    const g = this.data.grid, px = mx - g.ox, py = my - g.oy, COLS = this.cols, ROWS = this.rows;
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
    const c = this.cellAtWorld(wx, wy);
    return c >= 0 && this.data.mov[c] === '1';
  }
  cellToWorld(c: number): Vec {
    const m = this.cellCenter(c), s = this.toScreen(m.x, m.y);
    return ISO.toWorld(s.x, s.y);
  }
  /** Case du monde du jeu (-1 hors grille). */
  cellAtWorld(wx: number, wy: number): number {
    const s = ISO.toScreen(wx, wy), m = this.fromScreen(s.x, s.y);
    return this.cellAt(m.x, m.y);
  }
  randomFree(rng: Rng, among: number[] = this.free): Vec { return this.cellToWorld(rng.pick(among)); }
  nearestFree(wx: number, wy: number, among: number[] = this.free): Vec {
    let best = this.cellToWorld(among[0]), bd = Infinity;
    for (const c of among) {
      const p = this.cellToWorld(c), d = (p.x - wx) ** 2 + (p.y - wy) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
}

/** Un monde : la grande grille + quelle carte Dofus (et quelle sous-zone) couvre chaque case. */
export class WorldGrid extends GridMap {
  private readonly byIndex = new Map<string, WorldMapEntry>();
  /** Cases marchables de chaque carte (par tag "x_y"). */
  readonly freeByMap = new Map<string, number[]>();

  constructor(readonly world: WorldData) {
    super(world);
    const [X0, Y0] = world.origin;
    for (const m of world.maps) { this.byIndex.set(`${m.x - X0},${m.y - Y0}`, m); this.freeByMap.set(m.tag, []); }
    for (const c of this.free) { const m = this.mapOfCell(c); if (m) this.freeByMap.get(m.tag)!.push(c); }
  }
  mapOfCell(c: number): WorldMapEntry | undefined {
    if (c < 0) return undefined;
    const r = Math.floor(c / this.cols), k = c % this.cols;
    return this.byIndex.get(`${Math.floor(k / MAP_COLS)},${Math.floor(r / MAP_ROWS)}`);
  }
  /** Carte Dofus sous un point du monde du jeu. */
  mapAt(wx: number, wy: number): WorldMapEntry | undefined { return this.mapOfCell(this.cellAtWorld(wx, wy)); }
  mapByCoords(x: number, y: number): WorldMapEntry | undefined { return this.world.maps.find(m => m.x === x && m.y === y); }
}
