import type { Vec } from './iso';
import type { SkillId } from './defs';

/** Entrées d'un joueur pour un pas de simulation (clavier, manette ou réseau plus tard). */
export interface PlayerInput {
  /** Direction de déplacement dans le monde, normalisée ou nulle. */
  move: Vec;
  /** Point visé dans le monde (souris). */
  aim: Vec;
  /** Sort déclenché pendant cette frame ('attaque' ou l'identifiant d'un sort de la classe). */
  pressed: SkillId | null;
  /** Clic gauche maintenu : enchaîne l'attaque. */
  holdAttack: boolean;
  /** Boire une potion pendant cette frame. */
  potion?: boolean;
  /** Clic gauche sur le sol (maintenu : suit le curseur) : le perso y va par le plus court chemin. */
  dest?: Vec | null;
  /** Clic sur un objet au sol (Magique et plus) : aller le ramasser. */
  pickup?: number | null;
  /** Clic gauche sur un monstre : le perso s'approche à portée et lance son auto-attaque. */
  target?: number | null;
}

export const NO_INPUT: PlayerInput = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, pressed: null, holdAttack: false };
