import type { WorldGrid } from './gridmap';

/** Trajet de la flèche des quêtes (maquette « Flèche des quêtes » 1A, 2026-11-08) : au lieu de viser le but à vol d'oiseau,
 *  on suit les cartes du monde. Deux cartes voisines sont reliées quand leurs cases marchables se touchent vraiment (pas à
 *  travers le vide d'Incarnam) ; les portes relient les intérieurs, les Zaaps et les portails mènent plus loin. */

export type GenreLien = 'chemin' | 'porte' | 'zaap' | 'portail';
export interface Pt { x: number; y: number }
/** Un lien d'une carte vers une autre (ou vers une autre zone : « zone:astrub »). `de` = où le prendre, `a` = où il mène. */
export interface Lien { vers: string; genre: GenreLien; de: Pt; a?: Pt; cout: number; nom?: string }

/** Liens à pied entre cartes du dehors, calculés une fois par monde. */
export function liensAPied(wg: WorldGrid): Map<string, Lien[]> {
  // carte de chaque case libre (table creuse : la grille du continent est presque vide)
  const maps = wg.world.maps, carte = new Map<number, number>(), idx = (c: number) => carte.get(c) ?? -1;
  maps.forEach((m, i) => { for (const c of wg.freeByMap.get(m.tag) ?? []) carte.set(c, i); });
  // pour chaque paire de cartes voisines du dehors : les cases de passage (côté départ)
  const passages = new Map<string, number[]>();
  for (const c of wg.free) {
    const a = idx(c); if (a < 0 || maps[a].inside) continue;
    for (const n of wg.neighbors(c)) {
      const b = idx(n); if (b < 0 || b === a || maps[b].inside) continue;
      const k = `${a}>${b}`, l = passages.get(k);
      if (l) { if (l[l.length - 1] !== c) l.push(c); } else passages.set(k, [c]);
    }
  }
  const out = new Map<string, Lien[]>();
  for (const [k, cases] of passages) {
    const [a, b] = k.split('>').map(Number);
    // le milieu du passage, et la case d'en face la plus proche
    const c = cases[Math.floor(cases.length / 2)], de = wg.cellToWorld(c);
    const en = wg.neighbors(c).find(n => idx(n) === b);
    const a2 = en != null ? wg.cellToWorld(en) : de;
    const l = out.get(maps[a].tag) ?? []; l.push({ vers: maps[b].tag, genre: 'chemin', de, a: a2, cout: 1 }); out.set(maps[a].tag, l);
  }
  return out;
}

/** Plus court trajet (en cartes) d'une carte à une autre, ou à une autre zone. Null si on ne peut pas y aller. */
export function plusCourt(depart: string, but: string, liens: (tag: string) => Lien[]): Lien[] | null {
  if (depart === but) return [];
  const dist = new Map<string, number>([[depart, 0]]), prec = new Map<string, Lien & { depuis: string }>(), faits = new Set<string>();
  const file: [number, string][] = [[0, depart]];
  while (file.length) {
    let im = 0; for (let i = 1; i < file.length; i++) if (file[i][0] < file[im][0]) im = i;
    const [d, t] = file.splice(im, 1)[0];
    if (faits.has(t)) continue; faits.add(t);
    if (t === but) break;
    if (t.startsWith('zone:')) continue;
    for (const l of liens(t)) {
      const nd = d + l.cout;
      if (nd < (dist.get(l.vers) ?? Infinity)) { dist.set(l.vers, nd); prec.set(l.vers, { ...l, depuis: t }); file.push([nd, l.vers]); }
    }
  }
  if (!prec.has(but)) return null;
  const chemin: Lien[] = [];
  for (let t = but; t !== depart;) { const l = prec.get(t)!; chemin.unshift(l); t = l.depuis; }
  return chemin;
}
