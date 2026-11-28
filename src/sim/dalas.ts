import V07 from '../data/v07.json';
import type { Element } from './defs';
import type { World } from './world';

/** Dalas élémentaires de Pandala (0.7, « 0.7 : » 13C) : à Akwadala tout le monde fait +20 % en Eau, à Terrdala en Terre,
 *  à Plantala en Air (joueurs comme monstres). Lu au point du coup : la sous-zone de la carte où il se trouve. */
export const DALAS = V07.dalas as Record<string, { nom: string; element: Element }>;
export const BONUS_DALA = V07.bonusDala;

/** Dala du point (x, y), ou null hors de Pandala (et toujours null tant que la 0.7 est cachée). */
export function dalaEn(w: World, x: number, y: number): { nom: string; element: Element } | null {
  if (!w.v07Ouvert || !w.zone.open) return null;
  const s = w.worldGrid?.mapAt(x, y)?.sub;
  return s != null ? DALAS[String(s)] ?? null : null;
}
/** Multiplicateur d'un coup d'élément el porté en (x, y). */
export function facteurDala(w: World, x: number, y: number, el: string): number {
  const d = dalaEn(w, x, y);
  return d && d.element === el ? 1 + BONUS_DALA : 1;
}
const NOMS: Record<string, string> = { eau: 'Eau', terre: 'Terre', air: 'Air', feu: 'Feu', neutre: 'Neutre' };
/** Chaque pas : le joueur qui entre dans un dala le voit annoncé une fois. */
export function dalasPas(w: World) {
  if (!w.v07Ouvert) return;
  for (const p of w.players) {
    const d = dalaEn(w, p.x, p.y), nom = d?.nom ?? '';
    if (nom === p.dala) continue;
    p.dala = nom;
    if (d) w.emit({ k: 'status', x: p.x, y: p.y - 90, text: `${d.nom} : +${Math.round(BONUS_DALA * 100)} % ${NOMS[d.element] ?? d.element} pour tous`, color: '#7fd8ff' });
  }
}
