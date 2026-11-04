import type { Vec } from './iso';
import type { SkillId } from './defs';

/** Entrées d'un joueur pour un pas de simulation (clavier, manette ou réseau plus tard). */
export interface PlayerInput {
  /** Direction de déplacement dans le monde, normalisée ou nulle. */
  move: Vec;
  /** Point visé dans le monde (souris). */
  aim: Vec;
  /** Sort déclenché pendant cette frame. */
  pressed: SkillId | null;
  /** Clic gauche maintenu : enchaîne l'attaque. */
  holdAttack: boolean;
}

export const NO_INPUT: PlayerInput = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, pressed: null, holdAttack: false };
