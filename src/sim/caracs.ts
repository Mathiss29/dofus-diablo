/** Rôle en temps réel des caractéristiques de Dofus (choix 10C + 10D). Mêmes règles pour le joueur et les monstres. */

/** Tacle et Fuite : base Agilité / 10 plus les bonus, comme dans Dofus. */
export const tacleOf = (bonus: number, agilite: number) => bonus + agilite / 10;
/** Part de vitesse perdue au contact d'un tacleur (Dofus : chance de fuir = (Fuite + 2) / (Tacle + 2)). Jusqu'à 30 %. */
export const tackleSlow = (tacle: number, fuite: number) => (tacle <= 0 ? 0 : 0.3 * Math.max(0, 1 - (fuite + 2) / (tacle + 2)));
/** La Fuite réduit aussi les ralentissements subis (retraits de PM) : 50 de Fuite = moitié moins. */
export const fuiteFactor = (fuite: number) => 50 / (50 + Math.max(0, fuite));
/** Retrait contre Esquive PA / PM (base Sagesse / 10 côté joueur) : chance que chaque point retiré passe. */
export const removalChance = (retrait: number, esquive: number) => Math.min(1, Math.max(0.1, (retrait + 1) / (esquive + 1)));
/** Initiative (Initiative + Force + Intelligence + Chance + Agilité, comme Dofus) : le premier coup porté
 *  à un monstre fait +1 % par 10 points, jusqu'à +50 %. */
export const initiativeBonus = (init: number) => Math.min(0.5, Math.max(0, init) / 1000);

// --- Maquette Caracs (2026-11-08) ---------------------------------------------------------------------------------
/** Coût officiel d'un point de caractéristique (Dofus 3, breedsdataroot, le même pour toutes les classes) :
 *  Vitalité 1, Sagesse 3, Force / Intelligence / Chance / Agilité 1 jusqu'à 100 points de base, puis 2, 3 et 4 par tranche de 100. */
export function coutPoint(k: string, base: number): number {
  if (k === 'vitalite') return 1;
  if (k === 'sagesse') return 3;
  return 1 + Math.min(3, Math.floor(Math.max(0, base) / 100));
}
/** Points dépensés pour atteindre `base` dans une caractéristique. */
export function coutTotal(k: string, base: number): number {
  let n = 0;
  for (let b = 0; b < base; b++) n += coutPoint(k, b);
  return n;
}
/** Combien de points de caractéristique on obtient avec `points` à dépenser, en partant de `base`. */
export function pointsAchetables(k: string, base: number, points: number): number {
  let n = 0;
  while (points >= coutPoint(k, base + n)) { points -= coutPoint(k, base + n); n++; }
  return n;
}
/** Chance : +1 Prospection par 10 points, comme Dofus (3A). */
export const prospectionDeChance = (chance: number) => Math.floor(Math.max(0, chance) / 10);
/** Soins reçus : base × (1 + Intelligence / 100) + Soins, comme la formule de soin de Dofus (3B + 3C). */
export const soinRecu = (base: number, intelligence: number, soins: number) => base * (1 + Math.max(0, intelligence) / 100) + Math.max(0, soins);
/** Agilité : +1 % de vitesse de course par 20 points, plafond +10 % (4C, idée à nous). */
export const vitesseAgilite = (agilite: number) => Math.min(0.1, Math.max(0, agilite) / 2000);
