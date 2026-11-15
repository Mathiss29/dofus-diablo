import type { World } from './world';
import type { Player } from './player';
import type { Val } from './miroir';

/** « En ligne : » 4B (2026-11-15) : dans une partie à plusieurs, chaque joueur a accès à toutes ses fenêtres. Chez l'invité, le monde
 *  n'est qu'un miroir : un geste de fenêtre (équiper, forgemager, fabriquer, nourrir son familier…) y est joué tout de suite pour la
 *  réponse à l'écran, et part aussi en « ordre » vers celui qui fait la partie (serveur ou hôte), qui le rejoue pour ce joueur. Son
 *  sac revient par l'instantané et remplace ce que le miroir avait deviné (un jet de forgemagie peut donc changer une fois).
 *  Seuls les gestes listés ici passent ; leurs arguments sont des nombres, des textes ou de petites listes.
 *  Le Bastion et le Havre-Sac se jouent sur son PC : le coffre du compte et les achats d'Ogrines n'en font pas partie. */
export const ORDRES_MONDE: ReadonlySet<string> = new Set([
  // forgemagie, runes, orbes, Codex
  'forgemager', 'relancerLigneFM', 'utiliserOrbe', 'poserPotionFM', 'confierCommande', 'retirerCommande', 'fusionner', 'imprimerCodex', 'signer', 'sertir', 'percer', 'oeuvrer',
  // sac : cadenas, briser, consommables, rappel, déguisements
  'cadenas', 'briserObjet', 'briserChoix', 'utiliser', 'rappel', 'boire',
  // artisanat (atelier ou partout)
  'lancerFabrication', 'fabriquerIdole',
  // apparence, tenues, familiers, Ménagerie, styles
  'porterApparat', 'enregistrerTenue', 'mettreTenue', 'supprimerTenue', 'acheterPlaceTenue', 'nourrirFamilier', 'donnerFamilier', 'sortirDeLaMenagerie', 'prendreFamilierDeDepart',
  'porterStyle', 'garderMaPalette', 'retirerMaPalette',
  // caractéristiques, âmes, idoles, Almanax, coffre de l'Enutrof
  'reinitialiserCaracs', 'invoquerAmes', 'relacherAme', 'prendreAmeDeLaSemaine', 'basculerIdole', 'enregistrerJeuIdoles', 'chargerJeuIdoles', 'offrirAlmanax', 'donnerAuCoffre', 'donnerToutAuCoffre',
  // marchands (kamas et Pépites du perso)
  'acheter', 'acheterEtal', 'acheterSacDuJour', 'acheterBenediction', 'acheterPlacesSac', 'acheterPrereglage', 'acheterFamilier',
]);
export const ORDRES_JOUEUR: ReadonlySet<string> = new Set([
  'equip', 'unequip', 'assign', 'setVariant', 'spendPoint', 'reinitialiserPoints', 'enregistrerPrereglage', 'mettrePrereglage', 'porterDofus', 'retirerDofus',
]);

/** Un ordre : sur le monde ('w') ou sur le perso ('p'), le nom du geste et ses arguments. */
export interface Ordre { c: 'w' | 'p'; f: string; a: Val[] }

/** Argument acceptable : nombre, texte court, booléen, null, ou petite liste / petit objet de ceux-là. */
function argPropre(v: unknown, prof = 0): boolean {
  if (v === null || typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string') return v.length <= 200;
  if (prof > 2 || typeof v !== 'object') return false;
  if (Array.isArray(v)) return v.length <= 200 && v.every(x => argPropre(x, prof + 1));
  const e = Object.entries(v as object);
  return e.length <= 20 && e.every(([k, x]) => k.length <= 40 && argPropre(x, prof + 1));
}
/** Ordre reçu du réseau, vérifié ; null s'il n'est pas permis. */
export function ordreValide(d: unknown): Ordre | null {
  if (!d || typeof d !== 'object') return null;
  const { c, f, a } = d as Record<string, unknown>;
  if ((c !== 'w' && c !== 'p') || typeof f !== 'string' || !Array.isArray(a) || a.length > 6) return null;
  if (!(c === 'w' ? ORDRES_MONDE : ORDRES_JOUEUR).has(f) || !a.every(x => argPropre(x))) return null;
  return { c, f, a: a as Val[] };
}
/** Rejoue un ordre pour ce joueur dans la partie (serveur ou hôte). Un geste qui plante est ignoré. */
export function jouerOrdre(w: World, q: Player, o: Ordre): boolean {
  try {
    w.commeJoueur(q, () => {
      const cible = (o.c === 'w' ? w : q) as unknown as Record<string, (...a: unknown[]) => unknown>;
      if (typeof cible[o.f] === 'function') cible[o.f](...o.a);
    });
    return true;
  } catch (e) { console.warn('ordre', o.f, (e as Error).message); return false; }
}
