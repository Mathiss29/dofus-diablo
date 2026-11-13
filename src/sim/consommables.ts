import DATA from '../data/consommables.json';
import { STAT_NAMES, type Stat } from './items';

/** Consommables qui comptent (maquette « Des métiers qui servent vraiment », ligne « Métiers : » 4A+4B+4C+5A, 2026-11-13).
 *  - 4A : la potion de la touche E soigne plus selon le niveau d'Alchimiste ; boissons de résistance (5 s d'un élément à +30 %)
 *    sur leur propre touche ;
 *  - 4B : repas de 30 minutes (Paysan, Pêcheur, Chasseur), un bonus de caractéristique, un repas à la fois ;
 *  - 4C : élixirs de 30 minutes (Alchimiste), un bonus de combat, un élixir à la fois, cumulable avec un repas ;
 *  - 5A : parchemins de caractéristique officiels fabriqués par l'Alchimiste avec les variantes rares des plantes (Trèfle Agare…),
 *    +1 point permanent, 100 au plus par caractéristique (comme Dofus).
 *  Les bénédictions de 30 minutes du Marché (XP, butin, métier) restent à part : rien ici ne les recopie. */

export interface BonusConso { stat: Stat; n: number }
export type SorteConso = 'repas' | 'elixir' | 'boisson' | 'parchemin';

export const CONSO = {
  /** Repas et élixirs : durée (s). */
  duree: 1800,
  /** Boissons de résistance : bonus (%), durée (s), recharge commune (s). */
  boisson: { bonus: 30, duree: 5, recharge: 20 },
  /** Points de parchemin au plus par caractéristique (officiel). */
  parcheminMax: 100,
  /** Potion de la touche E : +0,25 % de soin par niveau d'Alchimiste (+50 % au niveau 200). */
  potionParNiveau: 0.0025,
  /** Variante rare d'une plante : chance à chaque récolte, et sur une ressource dorée. */
  rare: { chance: 0.03, dore: 0.5 },
};

export const REPAS = DATA.repas as Record<string, BonusConso>;
export const ELIXIRS = DATA.elixirs as Record<string, BonusConso>;
export const BOISSONS = DATA.boissons as Record<string, 'feu' | 'eau' | 'air' | 'terre' | 'neutre'>;
export const PARCHEMINS = DATA.parchemins as Record<string, Stat>;
/** Plante de l'Alchimiste -> sa variante rare. */
export const RARES_RECOLTE = DATA.rares as Record<string, string>;

/** Résistance (en %) donnée par une boisson de cet élément. */
export const RES_BOISSON: Record<string, Stat> = { feu: 'resFeu', eau: 'resEau', air: 'resAir', terre: 'resTerre', neutre: 'resNeutre' };
const ELEMENT: Record<string, string> = { feu: 'Feu', eau: 'Eau', air: 'Air', terre: 'Terre', neutre: 'Neutre' };

export function sorteConso(id: string): SorteConso | null {
  return REPAS[id] ? 'repas' : ELIXIRS[id] ? 'elixir' : BOISSONS[id] ? 'boisson' : PARCHEMINS[id] ? 'parchemin' : null;
}
/** Bonus d'un repas ou d'un élixir : « +40 Force », « +3 % Critique ». */
export function texteBonus(b: BonusConso): string {
  return `+${b.n} ${STAT_NAMES[b.stat] ?? b.stat}`;
}
/** Ce que fait un consommable, en une ligne (infobulles, fenêtre Artisanat). */
export function texteConso(id: string): string {
  const s = sorteConso(id);
  if (s === 'repas') return `${texteBonus(REPAS[id])} pendant 30 min (un repas à la fois)`;
  if (s === 'elixir') return `${texteBonus(ELIXIRS[id])} pendant 30 min (un élixir à la fois)`;
  if (s === 'boisson') return `+${CONSO.boisson.bonus} % Résistance ${ELEMENT[BOISSONS[id]]} pendant ${CONSO.boisson.duree} s`;
  if (s === 'parchemin') return `+1 ${STAT_NAMES[PARCHEMINS[id]]} pour toujours (${CONSO.parcheminMax} au plus)`;
  return '';
}
/** Nom court de la sorte, pour l'infobulle du sac. */
export const NOM_SORTE: Record<SorteConso, string> = { repas: 'Repas', elixir: 'Élixir', boisson: 'Boisson de résistance', parchemin: 'Parchemin de caractéristique' };
