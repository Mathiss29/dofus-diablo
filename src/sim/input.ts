import type { Vec } from './iso';
import type { SkillId } from './defs';
import type { CommandeTest } from './outilsTest';
import type { Drapeau } from './carte';

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
  /** « Métiers : » 4A : boire la boisson de résistance mise sur sa touche. */
  boisson?: boolean;
  /** « Métiers : » 6D : le clic sur la ressource est maintenu (enchaîner les récoltes de son métier). */
  recolteTenue?: boolean;
  /** Clic gauche sur le sol (maintenu : suit le curseur) : le perso y va par le plus court chemin. */
  dest?: Vec | null;
  /** Clic sur un objet au sol (Rare et plus) : aller le ramasser. */
  pickup?: number | null;
  /** Clic gauche sur un monstre : le perso s'approche à portée et lance son auto-attaque. */
  target?: number | null;
  /** Monstre sous le curseur quand le sort est lancé, et option « s'approcher avant de lancer » (Réglages, choix 5B). */
  castOn?: number | null;
  approach?: boolean;
  /** Clic sur une ressource à récolter (id de world.recoltes) : le perso y va et la récolte. */
  recolte?: number | null;
  /** Clic sur un poste d'atelier (id de world.postes, Métiers UI 3A) : le perso y va et ouvre l'Artisanat. */
  atelier?: number | null;
  /** Clic sur un PNJ (clé de quetes.json) : le perso y va et lui parle. */
  talk?: string | null;
  /** Réponse au dialogue ouvert (index du cadre vert, -1 = fermer). */
  reponse?: number | null;
  /** Touche H (maquette Hub 2A) : entrer dans le Havre-Sac (1,5 s d'incantation) ou en ressortir. */
  havreSac?: boolean;
  /** Enutrof : touche du coffre (X par défaut) : ouvre le coffre au trésor. */
  coffre?: boolean;
  /** Zaap du Havre-Sac (2C) : -1 = ressortir là où l'on était, sinon l'index du Zaap découvert (player.zaaps). */
  zaap?: number | null;
  /** Clic sur un Zaap du monde (maquette « Zaap : » 1A) : son nom ; le perso y va et la fenêtre s'ouvre en arrivant. */
  versZaap?: string | null;
  /** Clic sur un portail dessiné (PorteDef.dessin) : son nom ; le perso y va et passe en arrivant (seul moyen de le prendre). */
  versPortail?: string | null;
  /** Alt + clic sur un monstre (maquette Osamodas 7C) : toute la meute de l'Osamodas l'attaque. */
  meute?: number | null;
  /** Carte du monde (« Carte : » 9A, « Carte suite : » 14A-C) : drapeaux du joueur (liste entière), signal Alt + clic. */
  carte?: { drapeaux?: Drapeau[] | null; signal?: Vec | null } | null;
  /** Partie de test : ordres du panneau F1 (absent dans une vraie partie). */
  test?: CommandeTest[] | null;
}

export const NO_INPUT: PlayerInput = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, pressed: null, holdAttack: false };
