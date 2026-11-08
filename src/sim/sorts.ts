import sorts from '../data/sorts.json';
import type { Element } from './defs';

/** Catalogue officiel des sorts de classe (Dofus 3.7, tools/extraction/class_spells.py) : 22 paires sort / variante
 *  par classe, triées par niveau d'obtention. Un grade = une ligne de spelllevels. */
export interface SortGrade {
  /** Niveau du personnage requis, coût en PA, portée en cases [min, max], relance en tours, lancers par tour / par cible (0 = sans limite). */
  niv: number; pa: number; po: [number, number]; relance: number; parTour: number; parCible: number;
  /** Premier effet de dommages : [min, max], élément, vol de vie. */
  dmg?: [number, number]; element?: Element; vol?: boolean;
}
export interface SortOfficiel { id: number; name: string; icon: number; desc: string; grades: SortGrade[] }
export type PaireSorts = [SortOfficiel, SortOfficiel];

export const SORTS = sorts as unknown as Record<string, PaireSorts[]>;

/** Décisions de Mathis (maquette Sorts, 2026-11-06) : niveaux officiels exacts (1A), sauf le sort de déplacement
 *  (Bond, Pas Chassé) donné dès le niveau 1 pour le tutoriel (3A). */
export function niveauRequis(s: SortOfficiel, mobilite?: number, niveau1: number[] = []): number {
  return s.id === mobilite || niveau1.includes(s.id) ? 1 : s.grades[0].niv;
}
/** Grade atteint au niveau du personnage (les grades montent seuls aux niveaux officiels). */
export function gradeAuNiveau(s: SortOfficiel, level: number): SortGrade {
  let g = s.grades[0];
  for (const x of s.grades) if (level >= x.niv) g = x;
  return g;
}
/** Dommages moyens d'un grade (pour mettre à l'échelle les dommages du sort en jeu). */
export function dmgMoyen(g: SortGrade): number { return g.dmg ? (g.dmg[0] + g.dmg[1]) / 2 : 0; }
