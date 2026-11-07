import PLACEMENTS from '../data/placements.json';
import { MAP_COLS, MAP_ROWS, type WorldGrid } from './gridmap';
import type { Vec } from './iso';

/** Maquette « Monstres » (Mathis, 2026-11-07) : 1A+1C 2A 3A 4A+4D 5B 6A 7A.
 *  Où se posent les groupes de monstres d'une carte : des points posés à la main (src/data/placements.json, éditeur F1)
 *  ou, à défaut, une proposition automatique qui laisse libres les passages (1C). */

/** Un point où un groupe peut se poser. c = case Dofus 0-559 de la carte. */
export interface PointGroupe { c: number; /** 4A : taille du groupe [min, max] */ n?: [number, number]; /** 4D : repaire de l'élite */ r?: 1 }
/** Une carte : g groupes (6A : 0 à 4), qui se posent sur des points libres parmi p (5B : il peut y avoir plus de points que de groupes). */
export interface PlacementCarte { g: number; p: PointGroupe[] }

export const PLACEMENT = PLACEMENTS as unknown as {
  elite: { repaire: number; hasard: number };
  auto: { pointsEnPlus: number; ecartPassage: number; ecartLieu: number; ecartBord: number; ecartPoints: number };
  cartes: Record<string, Record<string, PlacementCarte>>;
};
export const MAX_GROUPES = 4;

/** Placement posé à la main pour cette carte (absent : automatique). */
export function placementPose(monde: string, tag: string): PlacementCarte | undefined {
  return PLACEMENT.cartes[monde]?.[tag];
}

/** Case 0-559 de la carte pour une case de la grande grille (-1 si elle n'est pas sur cette carte). */
export function caseLocale(wg: WorldGrid, tag: string, c: number): number {
  const m = wg.mapByTag(tag);
  return m && c >= 0 ? locale(wg, m.x, m.y)(c) : -1;
}
/** Conversion grande grille -> case 0-559 pour la carte [x, y] (-1 hors de la carte). */
function locale(wg: WorldGrid, x: number, y: number) {
  const [X0, Y0] = wg.world.origin, r0 = (y - Y0) * MAP_ROWS, k0 = (x - X0) * MAP_COLS, C = wg.cols;
  return (c: number) => { const r = Math.floor(c / C) - r0, k = c % C - k0; return r < 0 || r >= MAP_ROWS || k < 0 || k >= MAP_COLS ? -1 : r * MAP_COLS + k; };
}

/** Ce que le placement automatique doit laisser libre sur une carte. */
export interface AnalyseCarte {
  /** Cases de passage (grande grille) : plus courts chemins entre les sorties, portes, PNJ, Zaap et ateliers. */
  passages: number[];
  /** Lieux à ne pas encombrer (portes, PNJ, Zaap, ateliers) et sorties vers les cartes voisines, en cases de la grande grille. */
  lieux: number[]; sorties: number[];
  /** Pas de case entre chaque case libre et le passage le plus proche. */
  distPassage: Map<number, number>;
  distLieu: Map<number, number>;
  distBord: Map<number, number>;
}

/** Parcours en largeur sur les cases libres de la carte depuis plusieurs départs : nombre de pas jusqu'au plus proche. */
function parcours(vois: Map<number, number[]>, departs: number[]): Map<number, number> {
  const d = new Map<number, number>(), file: number[] = [];
  for (const c of departs) if (vois.has(c) && !d.has(c)) { d.set(c, 0); file.push(c); }
  for (let i = 0; i < file.length; i++) {
    const c = file[i], n = d.get(c)! + 1;
    for (const v of vois.get(c)!) if (!d.has(v)) { d.set(v, n); file.push(v); }
  }
  return d;
}

/** Analyse d'une carte (1C) : ses sorties vers les voisines, ses lieux, et les passages qui les relient. */
export function analyserCarte(wg: WorldGrid, tag: string, lieuxMonde: Vec[]): AnalyseCarte {
  const libresL = wg.freeByMap.get(tag) ?? [], libres = new Set(libresL);
  const vois = new Map(libresL.map(c => [c, wg.neighbors(c).filter(v => libres.has(v))]));
  // Sorties : cases du bord qui touchent une case libre d'une autre carte, regroupées en morceaux d'un seul tenant (un par passage)
  const m = wg.mapByTag(tag)!, loc = locale(wg, m.x, m.y);
  const mov = wg.data.mov, auBord = (c: number) => { const l = loc(c), r = Math.floor(l / MAP_COLS), k = l % MAP_COLS; return r < 2 || r >= MAP_ROWS - 2 || k === 0 || k === MAP_COLS - 1; };
  const bord = libresL.filter(c => auBord(c) && wg.neighbors(c).some(v => !libres.has(v) && mov[v] === '1' && loc(v) < 0));
  const vus = new Set<number>(), sorties: number[] = [];
  const surBord = new Set(bord);
  for (const c of bord) {
    if (vus.has(c)) continue;
    const morceau = [c]; vus.add(c);
    for (let i = 0; i < morceau.length; i++) for (const v of vois.get(morceau[i])!) if (surBord.has(v) && !vus.has(v)) { vus.add(v); morceau.push(v); }
    morceau.sort((a, b) => a - b);
    sorties.push(morceau[Math.floor(morceau.length / 2)]);
  }
  const lieux: number[] = [];
  for (const q of lieuxMonde) {
    const c = wg.cellAtWorld(q.x, q.y);
    if (libres.has(c)) { lieux.push(c); continue; }
    const f = wg.nearestFreeNear(q, 3), cf = f ? wg.cellAtWorld(f.x, f.y) : -1;
    if (libres.has(cf)) lieux.push(cf);
  }
  // Passages : le plus court chemin entre chaque paire de nœuds (sorties et lieux)
  const noeuds = [...new Set([...sorties, ...lieux])], dist = noeuds.map(n => parcours(vois, [n]));
  const passage = new Set<number>();
  for (let i = 0; i < noeuds.length; i++) for (let j = i + 1; j < noeuds.length; j++) {
    const da = dist[i]; let c = noeuds[j];
    if (!da.has(c)) continue;
    passage.add(c);
    while (da.get(c)! > 0) {
      const n = da.get(c)! - 1, suiv = vois.get(c)!.filter(v => da.get(v) === n).sort((a, b) => a - b)[0];
      if (suiv == null) break;
      c = suiv; passage.add(c);
    }
  }
  const passages = [...passage].sort((a, b) => a - b);
  return { passages, lieux, sorties, distPassage: parcours(vois, passages), distLieu: parcours(vois, lieux), distBord: parcours(vois, sorties) };
}

/** 1C + 3A : proposition automatique pour une carte, toujours la même (aucun hasard) : les coins les plus dégagés,
 *  loin des passages, des lieux et des entrées de carte, bien écartés les uns des autres. */
export function proposerPlacement(wg: WorldGrid, tag: string, groupes: number, a: AnalyseCarte): PlacementCarte {
  const A = PLACEMENT.auto, libresL = wg.freeByMap.get(tag) ?? [], C = wg.cols;
  const voulu = groupes > 0 ? groupes + A.pointsEnPlus : 0;
  if (!voulu || !libresL.length) return { g: groupes, p: [] };
  const mov = wg.data.mov, ouvert = (c: number) => { let n = 0; for (let dr = -6; dr <= 6; dr++) for (let dk = -3; dk <= 3; dk++) if (mov.charCodeAt(c + dr * C + dk) === 49) n++; return n; };
  const loin = (d: Map<number, number>, c: number) => d.size ? d.get(c) ?? 99 : 99;
  // un groupe s'étale sur 150 px autour de son point : rien à moins de 420 px d'un PNJ, d'une porte ou du Zaap
  const pos = new Map(libresL.map(c => [c, wg.cellToWorld(c)])), lieuxW = a.lieux.map(c => wg.cellToWorld(c)), dLieu = (c: number) => { const q = pos.get(c)!; return Math.min(9999, ...lieuxW.map(l => Math.hypot(l.x - q.x, l.y - q.y))); };
  // sur une toute petite carte (salle du Temple), on garde les cases les plus éloignées des PNJ et des portes (400 px, ou 80 % du plus loin possible)
  const dl0 = new Map(libresL.map(c => [c, dLieu(c)])), seuil = Math.min(400, 0.8 * Math.max(...dl0.values()));
  const notes = libresL.filter(c => dl0.get(c)! >= seuil).map(c => {
    const dw = dl0.get(c)!;
    const dp = loin(a.distPassage, c), dl = loin(a.distLieu, c), db = loin(a.distBord, c);
    const genant = (dw < 420 ? 3 : 0) + (dp < A.ecartPassage ? 1 : 0) + (dl < A.ecartLieu ? 1 : 0) + (db < A.ecartBord ? 1 : 0);
    return { c, genant, note: ouvert(c) + 4 * Math.min(dp, 8) + 2 * Math.min(dl, 10) };
  }).sort((x, y) => x.genant - y.genant || y.note - x.note || x.c - y.c);
  const pris: number[] = [];
  // on assouplit l'écart entre les points tant qu'il en manque (petite carte, clairière étroite)
  for (let ecart = A.ecartPoints; ecart >= 2 && pris.length < voulu; ecart = Math.floor(ecart * 0.7)) {
    for (const x of notes) {
      if (pris.length >= voulu) break;
      if (pris.includes(x.c)) continue;
      const pa = pos.get(x.c)!;
      if (pris.every(o => { const pb = pos.get(o)!; return Math.hypot(pa.x - pb.x, pa.y - pb.y) >= ecart * 48; })) pris.push(x.c);
    }
  }
  const m = wg.mapByTag(tag)!, loc = locale(wg, m.x, m.y);
  return { g: groupes, p: pris.map(c => ({ c: loc(c) })) };
}

/** Nettoie un placement venu de l'éditeur ou du fichier : cases de la carte, tailles cohérentes, 0 à 4 groupes. */
export function placementValide(pl: PlacementCarte): PlacementCarte {
  const p = (pl.p ?? []).filter(x => Number.isInteger(x.c) && x.c >= 0 && x.c < MAP_COLS * MAP_ROWS).map(x => {
    const o: PointGroupe = { c: x.c };
    if (x.n) { const a = Math.max(1, Math.min(10, Math.round(x.n[0]))), b = Math.max(a, Math.min(10, Math.round(x.n[1]))); o.n = [a, b]; }
    if (x.r) o.r = 1;
    return o;
  });
  return { g: Math.max(0, Math.min(MAX_GROUPES, Math.round(pl.g ?? 0))), p };
}
