import type { EtatJoueur } from '../sim/sauvegarde';

/** Un personnage sauvegardé (choix 16B : 3 emplacements, sauvegarde automatique dans le navigateur). */
export interface Perso {
  nom: string;
  classe: string;
  sexe: 'm' | 'f';
  /** Mode Hardcore (choix 10D) : la mort efface le personnage. */
  hardcore: boolean;
  cree: number;
  /** Dernière partie (horodatage) et temps de jeu total, en secondes. */
  maj: number;
  temps: number;
  /** Sous-zone où il s'est arrêté (affichage), et sous-zones déjà vues (bandeau de zone 2C). */
  lieu: string;
  zones: string[];
  etat?: EtatJoueur;
}

export const EMPLACEMENTS = 3;
const CLE = 'diablofus.persos';
const CLE_DERNIER = 'diablofus.dernier';

export function lirePersos(): (Perso | null)[] {
  let l: (Perso | null)[] = [];
  try { l = JSON.parse(localStorage.getItem(CLE) ?? '[]'); } catch { /* stockage indisponible ou abîmé */ }
  return Array.from({ length: EMPLACEMENTS }, (_, i) => (l[i] && typeof l[i] === 'object' ? l[i] : null));
}
function ecrire(l: (Perso | null)[]) {
  try { localStorage.setItem(CLE, JSON.stringify(l)); } catch { /* navigateur sans stockage : la partie ne sera pas gardée */ }
}
export function sauverPerso(i: number, p: Perso) { const l = lirePersos(); l[i] = p; ecrire(l); dernier(i); }
export function supprimerPerso(i: number) {
  const l = lirePersos(); l[i] = null; ecrire(l);
  if (dernier() === i) try { localStorage.removeItem(CLE_DERNIER); } catch { /* rien */ }
}
/** Emplacement de la dernière partie (bouton « Continuer »), ou le modifie. */
export function dernier(i?: number): number | null {
  try {
    if (i != null) localStorage.setItem(CLE_DERNIER, String(i));
    const n = Number(localStorage.getItem(CLE_DERNIER));
    return localStorage.getItem(CLE_DERNIER) != null && lirePersos()[n] ? n : null;
  } catch { return null; }
}
/** Nom valide : 3 à 16 lettres (accents, tiret et espace permis au milieu). */
export function nomValide(nom: string): boolean { return /^[\p{L}][\p{L}' -]{1,14}[\p{L}]$/u.test(nom.trim()); }
export function dureeTexte(s: number): string {
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}
