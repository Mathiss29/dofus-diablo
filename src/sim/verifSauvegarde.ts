/** « En ligne : » 2C (Mathis 2026-11-15) : le perso joué seul tourne sur le PC et sa sauvegarde est envoyée au compte ; le serveur
 *  la compare à la précédente (XP à l'heure, kamas, objets impossibles, niveau qui saute). Un perso douteux n'est pas bloqué :
 *  il sort du Ladder (serveur/comptes.mjs, table douteux). Les règles sont larges exprès : elles visent les sauvegardes
 *  trafiquées, jamais un joueur rapide. Lu par le serveur dans partie/sim.mjs. */
import { jetsPlausibles } from './hdv';
import type { Item, ItemsData } from './items';

export const VERIF = {
  /** Niveaux montés librement d'une sauvegarde à l'autre (le début du jeu va vite). */
  niveauLibre: 20,
  /** Au-delà, au moins ce temps de jeu (s) par niveau gagné. */
  secondesParNiveau: 20,
  /** Kamas gagnés librement d'une sauvegarde à l'autre, puis par seconde de jeu et par niveau. */
  kamasLibres: 200_000, kamasParSeconde: 200, kamasParSecondeNiveau: 40,
  kamasMax: 2e9,
};

/** Ce que le serveur garde d'un perso (comptes.mjs, colonne donnees). */
export interface PersoVerifie { temps?: number; etat?: { level?: number; kamas?: number; bag?: Item[]; equipment?: Record<string, Item | undefined> } }

/** null si la sauvegarde est plausible, sinon la raison : 'niveau', 'temps', 'kamas' ou 'objets'.
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
  const dt = (apres.temps ?? 0) - (avant!.temps ?? 0);
  if (dt < -5) return 'temps';
  const t = Math.max(0, dt), La = a.level ?? 1;
  const gagnes = L - Math.max(La, VERIF.niveauLibre);
  if (gagnes > 0 && L - La > 0 && t < gagnes * VERIF.secondesParNiveau) return 'niveau';
  const dk = k - (a.kamas ?? 0);
  if (dk > VERIF.kamasLibres + Math.max(0, kamasRecus) + t * (VERIF.kamasParSeconde + VERIF.kamasParSecondeNiveau * L)) return 'kamas';
  return null;
}
