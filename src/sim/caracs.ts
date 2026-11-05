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
