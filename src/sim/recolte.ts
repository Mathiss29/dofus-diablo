import type { Rng } from './math';

/** Métiers de récolte (0.2b, maquette Métiers : 5A récolte au clic de 1,2 s qu'on peut interrompre, 6A repousse en 60 s,
 *  6C ressource dorée qui donne ×5, quantité qui monte avec le niveau du métier). Données : src/data/recoltes.json
 *  (tools/contenu/recoltes.py : emplacements officiels des cartes, ressources officielles des sous-zones). */
/** metier vide : sans métier (puits, compétence « Puiser »). portee : portée officielle de la compétence en cases (pêche : 10), 1 si absente. */
export interface RecolteRes { nom: string; metier: string; niveau: number; anim: string; icone: number; niveauObjet: number; portee?: number }
export interface RecoltesData {
  metiers: Record<string, { id: number; nom: string }>;
  ressources: Record<string, RecolteRes>;
  /** Par monde (dossier de public/assets/mondes) : [tag de carte, case Dofus, id de la ressource, gfx, décalage x, y du dessin, miroir]. */
  [monde: string]: unknown;
}
/** Une ressource posée dans le monde. repousse > 0 : déjà récoltée, elle repousse. */
export interface Recolte { id: number; tag: string; x: number; y: number; item: string; dore: boolean; repousse: number;
  /** Dessin officiel (élément interactif de la carte) : son gfx, son décalage en pixels Dofus, en miroir ou non. Affichage seulement. */
  gfx?: number; dessin?: { x: number; y: number }; miroir?: boolean }

export const RECOLTE = {
  /** Durée du geste (s), portée (px monde) à laquelle on récolte, délai de repousse (s). */
  duree: 1.2, portee: 110, repousse: 60,
  /** Chance qu'une ressource repousse dorée, et son multiplicateur. */
  dore: 0.05, multDore: 5,
  /** 13C : une élite fait briller jusqu'à 3 ressources prêtes dans ce rayon (px) ; tant qu'elle vit, une ressource de sa carte repousse dorée 1 fois sur 3. */
  rayonElite: 700, doreesElite: 3, doreElite: 0.33,
  /** Portée en plus par case de portée officielle au-delà de 1 (px monde) : la pêche (10 cases) se fait depuis la rive. */
  parCase: 48,
};
/** Portée (px monde) d'une ressource : les bancs de poissons sont au milieu de l'eau, à 130-440 px de la rive la plus proche. */
export const porteeRecolte = (r: RecolteRes | undefined) => RECOLTE.portee + Math.max(0, (r?.portee ?? 1) - 1) * RECOLTE.parCase;
/** Quantité récoltée : 1 au niveau de la ressource, puis une de plus tous les 20 niveaux de métier au-dessus (tirée de 1 à ce maximum). */
export function quantite(rng: Rng, niveauMetier: number, niveauRes: number, dore: boolean) {
  const max = 1 + Math.floor(Math.max(0, niveauMetier - niveauRes) / 20);
  return (1 + Math.floor(rng.next() * max)) * (dore ? RECOLTE.multDore : 1);
}
/** XP de métier d'une récolte : selon le niveau de la ressource (×2 pour une dorée). */
export const xpRecolte = (niveauRes: number, dore: boolean) => (5 + niveauRes) * (dore ? 2 : 1);
