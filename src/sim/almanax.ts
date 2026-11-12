import DATA from '../data/almanax.json';

/** L'Almanax (version 0.3, choix 15C) : chaque jour du calendrier officiel a son offrande et son bonus. On apporte l'offrande
 *  au Représentant des Temples : Pépites tout de suite, et le bonus du jour jusqu'à minuit (heure du PC).
 *  Les bonus officiels sont traduits en effets d'un ARPG (tools/contenu/almanax.py). */
export type EffetAlmanax = 'xp' | 'butin' | 'recolte' | 'gibier' | 'metier' | 'fabrication' | 'pepites';
export interface JourAlmanax { bonus: string; texte: string; effet: EffetAlmanax; offrande: string; n: number; officielle?: boolean }

export const ALMANAX = {
  /** Pépites de l'offrande (le double les jours « Pépites », dont le bonus officiel n'a pas d'équivalent). */
  pepites: 30,
  xp: 0.25,          // +25 % d'XP des monstres
  butin: 25,         // +25 de Prospection (+25 % de chances de butin)
  recolte: 1,        // +1 ressource par récolte
  gibier: 2,         // viandes lâchées ×2
  metier: 0.5,       // +50 % d'XP de métier
  fabrication: 0.1,  // +10 points de chance de Rare à la fabrication
  jours: DATA.jours as Record<string, JourAlmanax>,
};

/** Jour de l'Almanax d'une date « AAAA-MM-JJ » (ou null). */
export function jourAlmanax(date: string | undefined): JourAlmanax | null {
  return date ? ALMANAX.jours[date.slice(5, 10)] ?? null : null;
}

/** Ce que rapporte l'effet, en une ligne pour la fenêtre. */
export function effetTexte(e: EffetAlmanax): string {
  switch (e) {
    case 'xp': return `+${ALMANAX.xp * 100} % d'XP des monstres`;
    case 'butin': return `+${ALMANAX.butin} Prospection`;
    case 'recolte': return `+${ALMANAX.recolte} ressource à chaque récolte`;
    case 'gibier': return `Viandes lâchées ×${ALMANAX.gibier}`;
    case 'metier': return `+${ALMANAX.metier * 100} % d'XP de métier`;
    case 'fabrication': return `+${ALMANAX.fabrication * 100} % de chance de Rare en fabrication`;
    default: return `Pépites doublées (${ALMANAX.pepites * 2})`;
  }
}
