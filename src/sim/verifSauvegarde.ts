/** « En ligne : » 2C (Mathis 2026-11-15) : le perso joué seul tourne sur le PC et sa sauvegarde est envoyée au compte ; le serveur
 *  la compare à la précédente (XP à l'heure, kamas, objets impossibles, niveau qui saute). Un perso douteux n'est pas bloqué :
 *  il sort du Ladder (serveur/comptes.mjs, table douteux). Les règles sont larges exprès : elles visent les sauvegardes
 *  trafiquées, jamais un joueur rapide. Lu par le serveur dans partie/sim.mjs. */
import { jetsPlausibles } from './hdv';
import type { Item, ItemsData } from './items';

export const VERIF = {
  /** Niveaux montés librement d'une sauvegarde à l'autre (un boss ou une zone haute en donnent plusieurs d'un coup). */
  niveauLibre: 20,
  /** Au-delà, au moins ce temps de jeu (s) par niveau gagné. */
  secondesParNiveau: 20,
  /** Version des règles : un perso mis à l'écart par des règles plus anciennes est rendu au Ladder (serveur/comptes.mjs). */
  regles: 2,
  /** Kamas gagnés librement d'une sauvegarde à l'autre, puis par seconde de jeu et par niveau. */
  kamasLibres: 200_000, kamasParSeconde: 200, kamasParSecondeNiveau: 40,
  kamasMax: 2e9,
};

/** Ce que le serveur garde d'un perso (comptes.mjs, colonne donnees). */
export interface PersoVerifie { temps?: number; etat?: { level?: number; kamas?: number; bag?: Item[]; equipment?: Record<string, Item | undefined> } }

/** null si la sauvegarde est plausible, sinon la raison : 'niveau', 'kamas' ou 'objets'.
 *  Un temps de jeu qui recule n'est pas une raison : la copie du PC peut être un peu en retard sur celle d'une partie du serveur.
 *  kamasRecus : kamas venus d'ailleurs depuis la sauvegarde d'avant (ventes de l'HDV encaissées). */
export function verifierSauvegarde(avant: PersoVerifie | null, apres: PersoVerifie, items: ItemsData, kamasRecus = 0): string | null {
  const e = apres.etat;
  if (!e) return null;
  const L = e.level ?? 1, k = e.kamas ?? 0;
  if (!Number.isInteger(L) || L < 1 || L > 200) return 'niveau';
  if (!Number.isFinite(k) || k < 0 || k > VERIF.kamasMax) return 'kamas';
  for (const it of [...(Array.isArray(e.bag) ? e.bag : []), ...Object.values(e.equipment ?? {})]) {
    const def = it && items.equipment[it.id];
    if (def && !jetsPlausibles(it!, def)) return 'objets';
  }
  const a = avant?.etat;
  if (!a) return null;
  const t = Math.max(0, (apres.temps ?? 0) - (avant!.temps ?? 0)), La = a.level ?? 1;
  // 20 niveaux par sauvegarde sont libres ; au-delà, du temps de jeu depuis la sauvegarde d'avant, et en tout depuis le niveau 20
  const gagnes = L - La - VERIF.niveauLibre;
  if (gagnes > 0 && t < gagnes * VERIF.secondesParNiveau) return 'niveau';
  if (L - La > 0 && (apres.temps ?? 0) < (L - VERIF.niveauLibre) * VERIF.secondesParNiveau) return 'niveau';
  const dk = k - (a.kamas ?? 0);
  if (dk > VERIF.kamasLibres + Math.max(0, kamasRecus) + t * (VERIF.kamasParSeconde + VERIF.kamasParSecondeNiveau * L)) return 'kamas';
  return null;
}
