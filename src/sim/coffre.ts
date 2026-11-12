import type { Item } from './items';

/** Coffre partagé (version 0.3, choix 12A+12B+12D) : un coffre au Havre-Sac, partagé par tous les persos du compte (12A), que la
 *  Banque d'Astrub ouvre aussi (12B). Les persos Hardcore ont le leur, à part (12D, comme Diablo 4). Il garde des équipements,
 *  en 5 onglets. L'affichage le range dans le navigateur (une clé par sorte de coffre) et le passe au monde (opts.coffre). */
export const COFFRE = { onglets: 5, places: 60, /** onglets achetés au Marché (Magasin 6C) en plus des 5 */ max: 8, /** emplacements de perso achetés */ emplacementsMax: 2 };

export interface Coffre {
  /** Un tableau d'objets par onglet (au plus COFFRE.places chacun). */
  onglets: Item[][];
  /** Noms des onglets choisis par le joueur (vide : « Onglet n »). */
  noms?: string[];
  /** Emplacements de perso achetés au Marché (Magasin 6C), gardés avec le coffre du compte pour suivre le compte en ligne. */
  emplacementsEnPlus?: number;
  /** Thèmes du Havre-Sac achetés au Marché (Magasin 6B, ids de havresac_themes.json) et thème posé ; teintures achetées (6E). Tout le compte. */
  themes?: number[];
  theme?: number;
  teintures?: string[];
  /** « Familiers : » 7A : Ménagerie du compte, familier -> plus haut niveau atteint. Chaque perso du compte peut en sortir un exemplaire. */
  familiers?: Record<string, number>;
}

export const coffreVide = (): Coffre => ({ onglets: Array.from({ length: COFFRE.onglets }, () => []) });

/** Relit un coffre sauvegardé (abîmé ou absent : coffre vide), sans perdre d'objet. */
export function relireCoffre(c: unknown): Coffre {
  const r = coffreVide(), o = c as Partial<Coffre> | null;
  if (!o || !Array.isArray(o.onglets)) return r;
  o.onglets.slice(0, COFFRE.max).forEach((l, i) => {
    if (Array.isArray(l)) r.onglets[i] = l.filter(it => it && typeof it.id === 'string' && typeof it.rarity === 'string');
  });
  const e = Math.floor(Number(o.emplacementsEnPlus) || 0);
  if (e > 0) r.emplacementsEnPlus = Math.min(COFFRE.emplacementsMax, e);
  const ids = (l: unknown) => Array.isArray(l) ? [...new Set(l.filter(x => Number.isInteger(x) && x > 0 && x < 1000) as number[])] : [];
  if (ids(o.themes).length) r.themes = ids(o.themes);
  if (Number.isInteger(o.theme) && o.theme! > 0) r.theme = o.theme;
  if (Array.isArray(o.teintures)) { const t = [...new Set(o.teintures.filter(x => typeof x === 'string' && /^[a-z]{2,20}$/.test(x)))]; if (t.length) r.teintures = t; }
  if (o.familiers && typeof o.familiers === 'object') {
    const f = Object.entries(o.familiers).filter(([k, n]) => /^\d{1,6}$/.test(k) && Number.isInteger(n) && n >= 1 && n <= 100);
    if (f.length) r.familiers = Object.fromEntries(f);
  }
  if (Array.isArray(o.noms)) r.noms = o.noms.slice(0, COFFRE.max).map(n => String(n ?? '').slice(0, 20));
  return r;
}
