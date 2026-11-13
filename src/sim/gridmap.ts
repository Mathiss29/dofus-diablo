import { ISO, type Vec } from './iso';
import type { Rng } from './math';

export interface Rect { x: number; y: number; w: number; h: number }
/** Un élément de décor. c = case (profondeur), -1 = posé sur le sol. Lumières (halos, rayons) : b = mélange ('a' additif, 's' écran), k = intensité, z = réduction de l'image. */
export interface DecorPlace { f: string; x: number; y: number; c: number; o: number; b?: 'a' | 's'; k?: number; /** image réduite : le jeu l'agrandit d'autant */ z?: number;
  /** couche d'eau animée (sous les lumières) */ g?: number;
  /** lumière du soleil (reflet, rayon) : s'éteint la nuit */ j?: number;
  /** souplesse au vent (0 à 1) */ w?: number;
  /** eau qui glisse : direction x, y, amplitude (px), fréquence */ t?: [number, number, number, number];
  /** couleur qui va et vient : 0xRRGGBB, alpha, fréquence */ ca?: [number, number, number];
  /** décor partagé : numéro de la page d'atlas commune (decor_p<N>) */ p?: number;
  /** bâtiment (ou arbre) dont l'image fait partie, numéro unique dans le monde (tools/extraction/batiments.py) : il s'efface d'un bloc */ bt?: number;
  /** débord : le centre de l'image sort du cadre de sa carte, elle n'est montrée que quand le joueur est sur cette carte
   *  (méthode « façon Sanstour », batiments.py COURANTE=1) */ h?: number;
  /** original caché quand le joueur est sur l'une de ces cartes (leur débord en a déjà une copie) */ cc?: string[];
  /** 0.6 (« Arènes : » 10A) : mur du dédale n° lab du Labyrinthe du Dragon Cochon, affiché seulement pour le dédale tiré */ lab?: number;
  /** porte dessinée à part (gfx officiel de porte) : contour au survol (tools/extraction/portes_contour.py) */ po?: number }

/** Données d'une carte Dofus 3 exportée par tools/extraction/map_export.py. */
export interface MapData {
  id?: number;
  /** cols/rows : 14 x 40 pour une carte, plus pour un monde fait de plusieurs cartes. */
  grid: { w: number; h: number; ox: number; oy: number; cols?: number; rows?: number;
    /** Centre de la grille (repère carte) ; sans lui, le milieu de la grille. Un monde agrandi le garde : ses points ne bougent pas. */
    cx?: number; cy?: number };
  /** Une lettre par case, '1' = case marchable (une carte, ou un petit monde). */
  mov?: string;
  sol?: Rect;
  decor?: DecorPlace[];
}

/** Une carte Dofus dans un monde (tools/extraction/world_export.py). */
export interface WorldMapEntry {
  x: number; y: number; id: number; sub: number; tag: string; sol: Rect; fond?: Rect & { k?: number };
  /** Décor de la carte. Monde chargé par régions (0.6, 3B) : absent de monde.json, il arrive avec le fichier de sa région
   *  (`region_<r>.json`, lu par l'affichage) ; WorldGrid le met à [] en attendant. */
  decor: DecorPlace[];
  /** Région de la carte (0.6, 3B) : son décor est dans `region_<r>.json` (tools/extraction/regions_monde.py). */
  r?: string;
  /** Ce que la carte dessine au-delà de son cadre, posé en fondu sur les voisines (plus de coupure au raccord). */
  bord?: Rect;
  /** Contours officiels des portes au survol (boîtes de survol Dofus 3, tools/extraction/survols.py) : dessin de l'atlas, centre. */
  survols?: { f: string; x: number; y: number }[];
  /** Carte du rivage : couleur de la mer (0xRRGGBB) dans laquelle son bord du monde se fond, au lieu du fond bleu nuit. */
  mer?: number;
  /** Carte du rivage : terre ('1') ou mer ('0') par carrés de k px du monde dans son cadre (tools/extraction/mer.py). */
  rivage?: { k: number; w: number; h: number; d: string };
  /** Intérieur (maison, mine…) : rangé à part dans la grille, on y entre par une porte. */
  inside?: number;
  /** Carte de la version en essai (0.4 : Amakna) : dessinée, mais on n'y marche qu'en partie de test (WorldGrid.ouvrirEssai). */
  essai?: number;
  /** Carte de la 0.6 (régions 60-90) : on n'y marche que si la 0.6 est ouverte (V06_PUBLIC ou partie de test, WorldGrid.ouvrirV06). */
  v06?: number;
  /** Intérieur à ciel ouvert (Temple Céleste) : le ciel reste derrière. */
  ciel?: number;
  /** Décor partagé entre cartes (world_export.py PARTAGE=1) : pages d'atlas communes utilisées par cette carte. */
  pages?: number[];
  /** Décor rangé en bâtiments par tools/extraction/batiments.py. */
  batiments?: number;
  /** Carte plus grande qu'une carte Dofus (arène d'un donjon, tools/extraction/arenes.py) : nombre de places [largeur, hauteur]. */
  n?: [number, number];
  /** Couloir d'un donjon (tools/extraction/couloirs.py) : son sol déborde sur les salles qu'il relie et passe par-dessus. */
  dessus?: number;
  /** Cartes vues ensemble depuis l'intérieur (salles et couloirs d'un donjon en couloirs) : posé par le jeu, pas par l'export. */
  groupe?: string;
}
/** Plusieurs cartes Dofus voisines collées bord à bord en une seule grande grille. */
export interface WorldData extends MapData { origin: [number, number]; maps: WorldMapEntry[];
  /** Grand monde (Astrub + Amakna, grille du continent) : les cases marchables carte par carte, au lieu d'une chaîne
   *  pour toute la grille (presque toute vide). Clé = tag, valeur = 40·ny lignes de 14·nx lettres. */
  movCartes?: Record<string, string>; /** Ciel commun posé derrière tout le monde. */ sky?: string;
  /** Carte du monde (touche M) : carte.webp, coin haut-gauche (repère des sols) et échelle (tools/extraction/carte_monde.py). */
  carte?: { x: number; y: number; k: number };
  /** Points d'intérêt officiels (table hints) : carte, nom, icône, catégorie (tools/extraction/reperes.py). */
  reperes?: { t: string; n: string; g: number; c: number }[];
  /** Monde chargé par régions (0.6, 3B) : régions dont le décor est à part, dans `region_<clé>.json`. */
  regions?: string[] }

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
  /** Cases marchables : 1 = marchable (lu dans data.mov ou, pour un grand monde, dans movCartes). */
  readonly mov: Uint8Array;
  readonly cols: number;
  readonly rows: number;

  constructor(readonly data: MapData) {
    const g = data.grid;
    this.cols = g.cols ?? MAP_COLS; this.rows = g.rows ?? MAP_ROWS;
    this.C = { x: g.cx ?? g.ox + (this.cols + 0.5) * g.w / 2, y: g.cy ?? g.oy + (this.rows * g.h / 2 + g.h / 2) / 2 };
    this.mov = new Uint8Array(this.cols * this.rows);
    const w = data as Partial<WorldData>;
    if (w.movCartes && w.maps && w.origin) {   // grand monde : carte par carte (les cases libres restent dans l'ordre de la grille)
      for (const m of w.maps) if (!m.essai && !m.v06) for (const c of this.casesCarte(m)) this.mov[c] = 1;
      for (let c = 0; c < this.mov.length; c++) if (this.mov[c]) this.free.push(c);
    } else {
      const mov = data.mov ?? '';
      for (let c = 0; c < this.mov.length; c++) if (mov.charCodeAt(c) === 49) { this.mov[c] = 1; this.free.push(c); }
    }
  }
  /** Cases marchables d'une carte d'un grand monde (movCartes), en cases de la grille. */
  protected casesCarte(m: WorldMapEntry): number[] {
    const w = this.data as Partial<WorldData>, s = w.movCartes?.[m.tag], out: number[] = [];
    if (!s || !w.origin) return out;
    const W = (m.n?.[0] ?? 1) * MAP_COLS, c0 = (m.y - w.origin[1]) * MAP_ROWS * this.cols + (m.x - w.origin[0]) * MAP_COLS;
    for (let i = s.indexOf('1'); i >= 0; i = s.indexOf('1', i + 1)) out.push(c0 + Math.floor(i / W) * this.cols + i % W);
    return out;
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
    return c >= 0 && this.mov[c] === 1;
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
  /** Cases voisines (losanges qui se touchent par un côté ou un coin), marchables. */
  neighbors(c: number): number[] {
    const r = Math.floor(c / this.cols), k = c % this.cols, o = r % 2, out: number[] = [];
    const add = (rr: number, kk: number) => {
      if (rr < 0 || rr >= this.rows || kk < 0 || kk >= this.cols) return;
      const n = rr * this.cols + kk; if (this.mov[n] === 1) out.push(n);
    };
    add(r - 1, k - 1 + o); add(r - 1, k + o); add(r + 1, k - 1 + o); add(r + 1, k + o);   // côtés
    add(r - 2, k); add(r + 2, k); add(r, k - 1); add(r, k + 1);                             // coins
    return out;
  }
  /** Ligne droite marchable entre deux points du monde (échantillonnée tous les 8 px). */
  clearLine(a: Vec, b: Vec): boolean {
    const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d / 8);
    for (let i = 1; i < n; i++) if (!this.walkable(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n)) return false;
    return true;
  }
  /** Couloir marchable de demi-largeur `marge` entre deux points : la ligne du milieu et ses deux bords. */
  clearLineLarge(a: Vec, b: Vec, marge: number): boolean {
    if (!this.clearLine(a, b)) return false;
    if (marge <= 0) return true;
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / d * marge, ny = (b.x - a.x) / d * marge;
    return this.clearLine({ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny })
      && this.clearLine({ x: a.x - nx, y: a.y - ny }, { x: b.x - nx, y: b.y - ny });
  }
  /** Chemin (A*) entre deux points du monde, en points de passage lissés ; vide si inatteignable.
   *  Si l'arrivée est bloquée, on va à la case libre la plus proche. maxNodes borne le coût d'un clic lointain.
   *  marge : le lissage garde cette distance (px) avec le décor (les monstres ne frottent pas les coins). */
  findPath(from: Vec, to: Vec, maxNodes = 6000, marge = 0): Vec[] {
    if (this.clearLineLarge(from, to, marge) && this.walkable(to.x, to.y)) return [to];
    const start = this.cellAtWorld(from.x, from.y);
    let goal = this.cellAtWorld(to.x, to.y);
    if (start < 0) return [];
    if (goal < 0 || this.mov[goal] !== 1) {
      const f = this.nearestFreeNear(to, 6); if (!f) return []; goal = this.cellAtWorld(f.x, f.y); to = f;
    }
    const W = (c: number) => this.cellToWorld(c), gp = W(goal);
    const h = (c: number) => { const p = W(c); return Math.hypot(p.x - gp.x, p.y - gp.y); };
    const g = new Map<number, number>([[start, 0]]), came = new Map<number, number>();
    const open = new Heap(), closed = new Set<number>();
    open.push(h(start), start);
    let found = false, n = 0, best = start, bestH = h(start);
    while (open.size && n++ < maxNodes) {
      const c = open.pop();
      if (c === goal) { found = true; break; }
      if (closed.has(c)) continue;
      closed.add(c);
      const hc = h(c); if (hc < bestH) { bestH = hc; best = c; }
      const pc = W(c);
      for (const nb of this.neighbors(c)) {
        if (closed.has(nb)) continue;
        const pn = W(nb), ng = g.get(c)! + Math.hypot(pn.x - pc.x, pn.y - pc.y);
        if (ng < (g.get(nb) ?? Infinity)) { g.set(nb, ng); came.set(nb, c); open.push(ng + h(nb), nb); }
      }
    }
    // inatteignable (ou trop loin) : on va au plus près
    let c = found ? goal : best;
    const cells: number[] = [];
    while (c !== start && c !== undefined) { cells.push(c); c = came.get(c)!; }
    const pts = cells.reverse().map(W);
    if (found) pts[pts.length - 1] = to;
    // lissage : on saute les points visibles en ligne droite
    const out: Vec[] = []; let cur = from;
    for (let i = 0; i < pts.length; i++) {
      let j = i;
      while (j + 1 < pts.length && this.clearLineLarge(cur, pts[j + 1], marge)) j++;
      out.push(pts[j]); cur = pts[j]; i = j;
    }
    return out;
  }
  /** Case libre la plus proche d'un point, en cherchant dans un rayon de r cases. */
  nearestFreeNear(p: Vec, r: number): Vec | null {
    const c0 = this.cellAtWorld(p.x, p.y);
    if (c0 < 0) return null;
    const R = Math.floor(c0 / this.cols), K = c0 % this.cols;
    let best: Vec | null = null, bd = Infinity;
    for (let rr = R - 2 * r; rr <= R + 2 * r; rr++) for (let kk = K - r; kk <= K + r; kk++) {
      if (rr < 0 || rr >= this.rows || kk < 0 || kk >= this.cols) continue;
      const c = rr * this.cols + kk; if (this.mov[c] !== 1) continue;
      const q = this.cellToWorld(c), d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
      if (d < bd) { bd = d; best = q; }
    }
    return best;
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
    for (const m of world.maps) {
      m.decor ??= [];   // monde chargé par régions : le décor arrive plus tard (render/worldView.ts)
      const [nx, ny] = m.n ?? [1, 1];
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) this.byIndex.set(`${m.x - X0 + i},${m.y - Y0 + j}`, m);
      this.freeByMap.set(m.tag, []);
    }
    for (const c of this.free) { const m = this.mapOfCell(c); if (m) this.freeByMap.get(m.tag)!.push(c); }
  }
  /** Ouvre des cases à la marche (couloirs d'un donjon, partie de test). */
  /** Partie de test : les cartes en essai (0.4 : Amakna) deviennent marchables. */
  ouvrirEssai() { for (const m of this.world.maps) if (m.essai && !m.v06) this.ouvrir(this.casesCarte(m)); }
  /** 0.6 ouverte (V06_PUBLIC ou partie de test) : ses régions deviennent marchables. */
  ouvrirV06() { for (const m of this.world.maps) if (m.v06) this.ouvrir(this.casesCarte(m)); }
  ouvrir(cases: number[]) {
    for (const c of cases) {
      if (c < 0 || c >= this.mov.length || this.mov[c] === 1) continue;
      this.mov[c] = 1; this.free.push(c);   // le tableau est propre à cette grille : le monde.json chargé reste tel quel
      const m = this.mapOfCell(c); if (m) this.freeByMap.get(m.tag)!.push(c);
    }
  }
  /** Après avoir changé des cases de mov (meubles du Havre-Sac, 0.6) : les listes de cases libres suivent. */
  refaireLibres() {
    this.free.length = 0;
    for (const l of this.freeByMap.values()) l.length = 0;
    for (let c = 0; c < this.mov.length; c++) if (this.mov[c]) { this.free.push(c); const m = this.mapOfCell(c); if (m) this.freeByMap.get(m.tag)!.push(c); }
  }
  mapOfCell(c: number): WorldMapEntry | undefined {
    if (c < 0) return undefined;
    const r = Math.floor(c / this.cols), k = c % this.cols;
    return this.byIndex.get(`${Math.floor(k / MAP_COLS)},${Math.floor(r / MAP_ROWS)}`);
  }
  /** Carte Dofus sous un point du monde du jeu. */
  mapAt(wx: number, wy: number): WorldMapEntry | undefined { return this.mapOfCell(this.cellAtWorld(wx, wy)); }
  mapByCoords(x: number, y: number): WorldMapEntry | undefined { return this.world.maps.find(m => m.x === x && m.y === y); }
  mapByTag(tag: string): WorldMapEntry | undefined { return this.world.maps.find(m => m.tag === tag); }
  /** Case de la grande grille pour la case `c` de la carte `tag` (0-559 ; une carte de n×m cartes compte nx × 14 colonnes). */
  cellOf(tag: string, c: number): number {
    const m = this.mapByTag(tag);
    if (!m) throw new Error(`Carte absente du monde : ${tag}`);
    const W = (m.n?.[0] ?? 1) * MAP_COLS, [X0, Y0] = this.world.origin, r = Math.floor(c / W), k = c % W;
    return ((m.y - Y0) * MAP_ROWS + r) * this.cols + (m.x - X0) * MAP_COLS + k;
  }
  /** L'inverse de cellOf : carte et case (0-559) d'une case de la grande grille. */
  caseLocale(g: number): { tag: string; x: number; y: number; c: number } | null {
    const m = this.mapOfCell(g);
    if (!m) return null;
    const W = (m.n?.[0] ?? 1) * MAP_COLS, [X0, Y0] = this.world.origin;
    const r = Math.floor(g / this.cols) - (m.y - Y0) * MAP_ROWS, k = g % this.cols - (m.x - X0) * MAP_COLS;
    return { tag: m.tag, x: m.x, y: m.y, c: r * W + k };
  }
}

/** File de priorité (tas binaire) pour l'A*. */
class Heap {
  private k: number[] = []; private v: number[] = [];
  get size() { return this.k.length; }
  push(key: number, val: number) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= k[i]) break; [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p; }
  }
  pop(): number {
    const k = this.k, v = this.v, top = v[0], lk = k.pop()!, lv = v.pop()!;
    if (k.length) {
      k[0] = lk; v[0] = lv; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < k.length && k[l] < k[m]) m = l;
        if (r < k.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m;
      }
    }
    return top;
  }
}
