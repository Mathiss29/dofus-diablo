// Point d'entrée de la simulation pour le serveur multijoueur (maquette « Vrai multi : » 1A : le serveur fait la partie).
// serveur/construire-sim.mjs en fait un seul fichier (esbuild) que le serveur Node importe ; rien ici ne touche au navigateur.
export { World, EVENEMENTS_PERSONNELS } from './world';
export { WorldGrid, type WorldData } from './gridmap';
export { GAME_DATA, ITEMS } from './data';
export { NO_INPUT, type PlayerInput } from './input';
export { COOP, Emetteur, entreeInvite, classeDe, garderUneFois } from './miroir';
export { exporterJoueur, restaurerJoueur } from './sauvegarde';
import QUETES_JSON from '../data/quetes.json';
import type { QuetesData } from './quests';
/** Quêtes et PNJ (monde ouvert tenu par le serveur, étape 4). */
export const QUETES = QUETES_JSON as unknown as QuetesData;
