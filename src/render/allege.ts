// Maquette « Fluidité Thor : » (2026-11-25, ligne 1A+1B 2A+2B 3A+3B 4A+4B 5A+5B+5D 6A+6B 7A+7B 8B) : les allègements du
// mode console, chacun avec sa case dans Options › Affichage (1B : on coupe, on regarde le compteur).
// Sur PC, rien ne change : un allègement ne vaut qu'en mode console.
import { modeConsole, petitEcranConsole } from './console';

/** perso : images du perso deux fois moins fines (2A) ; prepa : préparées sans gêner (2B) ; sil : silhouettes rouges
 *  recalculées seulement si ça bouge, à moitié taille (3A+3B) ; halos : halos légers (4A+4B) ; lien : l'écran du bas ne
 *  reçoit que ce qui change (6A+6B). */
export type Allegement = 'algPerso' | 'algPrepa' | 'algSil' | 'algHalos' | 'algLien';
export const ALLEGEMENTS: [Allegement, string, string][] = [
  ['algPerso', 'Perso moins fin', 'Les images de ton perso sont dessinées deux fois moins fines : 4 fois moins de travail. Vaut au prochain lancement.'],
  ['algPrepa', 'Perso préparé sans gêner', 'Les images du perso sont préparées une par une, jamais pendant un combat.'],
  ['algSil', 'Silhouettes rouges légères', 'Les silhouettes des monstres cachés ne sont refaites que si quelque chose bouge, à moitié taille.'],
  ['algHalos', 'Halos légers', 'Ressources et portes : une teinte qui pulse à la place du contour brillant. Le PNJ visé garde son vrai halo.'],
  ['algLien', 'Écran du bas économe', 'L\'écran du bas ne reçoit que ce qui change.'],
];
type Choix = Partial<Record<Allegement, boolean>>;
let choix: Choix = {};
export function reglerAllegements(r: Choix) { choix = { algPerso: r.algPerso, algPrepa: r.algPrepa, algSil: r.algSil, algHalos: r.algHalos, algLien: r.algLien }; }
export const allege = (k: Allegement): boolean => choix[k] !== false && modeConsole();
/** Pour le rapport : « perso oui, préparation non… ». */
export function texteAllegements(): string {
  if (!modeConsole()) return 'hors mode console (aucun)';
  return ALLEGEMENTS.map(([k, nom]) => `${nom.toLowerCase()} ${choix[k] !== false ? 'oui' : 'non'}`).join(', ');
}
/** 2A : la finesse des images du perso se décide au chargement de la page (les planches en dépendent) : on lit le réglage
 *  directement dans le stockage, la scène n'existe pas encore. */
export function finessePerso(): 1 | 2 {
  try {
    if (typeof window === 'undefined' || !petitEcranConsole()) return 2;
    const r = JSON.parse(localStorage.getItem('diablofus.reglages') || '{}') as { algPerso?: boolean; modeConsole?: string };
    return r.algPerso === false || r.modeConsole === 'non' ? 2 : 1;
  } catch { return 2; }
}
