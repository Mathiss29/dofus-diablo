/** Le magasin du Bastion (maquette « Magasin : » 2026-11-12, 2A-2D 3A+3B 4C) : ce qui change chaque jour, tiré de la date
 *  (heure du PC), le même pour tous les joueurs de la partie. Aucun hasard de la partie : un tirage seedé par la date. */
import { hache, semaine } from './contrats';

export const MAGASIN = {
  /** 3A : six offres à minuit, dont deux à -30 % */
  offres: 6, remises: 2, remise: 0.3,
  /** 3B : la pièce de la semaine vaut deux fois le prix de son emplacement ; une apparence sur 8 n'est vendue que comme pièce */
  piece: 2, reserve: 8,
  /** 4C : un sac à rareté garantie par jour, payé en Pépites */
  sac: { rare: 40, epique: 120 } as Record<'rare' | 'epique', number>,
  /** 2D : Maj + clic achète par 10 */
  lot: 10,
};
/** 6C : le confort, payé en Pépites (places de sac par 20, 4e et 5e préréglage). Le prix monte à chaque achat. */
export const CONFORT = {
  sac: { pas: 20, prix: [150, 300, 450, 600] },
  prereglage: { prix: [200, 300] },
};
/** 6D : bénédictions de 30 minutes (bonus du calendrier officiel), une à la fois, payées en Pépites. */
export type Benediction = 'xp' | 'butin' | 'metier';
export const BENEDICTIONS: Record<Benediction, { nom: string; bonus: number; texte: string }> = {
  xp: { nom: 'Bénédiction de la Sagesse', bonus: 0.25, texte: '+25 % d\'XP des monstres' },
  butin: { nom: 'Bénédiction de la Fortune', bonus: 0.25, texte: '+25 % de butin (Prospection)' },
  metier: { nom: 'Bénédiction de l\'Artisan', bonus: 0.5, texte: '+50 % d\'XP de métier' },
};
export const BENEDICTION = { duree: 1800, prix: 30 };
/** Marchands du Marché couvert : ils ouvrent la même fenêtre, chacun sur son onglet (13A-13D). */
export const MARCHE = ['otomai', 'bouillotte', 'goultard', 'tissebelle'];

export type Article = { id: string; prix: number; monnaie?: string; v03?: boolean; v04?: boolean; apparat?: boolean; apres?: string };
export interface Offre { k: 'objet' | 'apparat'; id: string; /** boutique d'origine (objet) */ boutique?: string; prix: number; /** « kamas » ou id de la monnaie */ monnaie: string; remise: boolean; /** prix avant la remise */ avant?: number }
export interface CtxMagasin { boutiques: Record<string, Article[]>; apparats?: { objets: Record<string, { slot: string; collection?: boolean }>; prix: Record<string, number> }; v03: boolean; v04: boolean }

/** Petit tirage reproductible (mulberry32) */
function tirage(graine: string) {
  let a = hache(graine);
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function piocher<T>(l: T[], n: number, r: () => number): T[] {
  const c = [...l], o: T[] = [];
  while (o.length < n && c.length) o.push(c.splice(Math.floor(r() * c.length), 1)[0]);
  return o;
}
/** Apparence réservée à la pièce de la semaine (jamais dans le catalogue de Tissebelle). */
export const reserveePiece = (id: string) => hache(`piece:${id}`) % MAGASIN.reserve === 0;
const PEPITE = '14635';

/** L'étal du jour (3A) : trois choses utiles (kamas) et trois apparences (Pépites), deux d'entre elles à -30 %. */
export function etalDuJour(jour: string, ctx: CtxMagasin): Offre[] {
  const r = tirage(`etal:${jour}`), vu = new Set<string>();
  const utiles: Offre[] = [];
  for (const b of ['otomai', 'bouillotte', 'goultard']) for (const a of ctx.boutiques[b] ?? []) {
    if ((a.v03 && !ctx.v03) || (a.v04 && !ctx.v04) || a.apres || a.apparat || vu.has(a.id)) continue;
    vu.add(a.id); utiles.push({ k: 'objet', id: a.id, boutique: b, prix: a.prix, monnaie: a.monnaie ?? PEPITE, remise: false });
  }
  const A = ctx.apparats, apps: Offre[] = A ? Object.entries(A.objets).filter(([id, d]) => !d.collection && !reserveePiece(id) && A.prix[d.slot] != null)
    .map(([id, d]) => ({ k: 'apparat' as const, id, prix: A.prix[d.slot], monnaie: PEPITE, remise: false })) : [];
  const l = [...piocher(utiles, MAGASIN.offres / 2, r), ...piocher(apps, MAGASIN.offres / 2, r)];
  for (const o of piocher(l, MAGASIN.remises, r)) { o.remise = true; o.avant = o.prix; o.prix = Math.max(1, Math.round(o.prix * (1 - MAGASIN.remise))); }
  return l;
}
/** La pièce de la semaine (3B) : une apparence réservée, sept jours, change le lundi. */
export function pieceDeLaSemaine(jour: string, ctx: CtxMagasin): Offre | null {
  const A = ctx.apparats; if (!A) return null;
  const l = Object.entries(A.objets).filter(([id, d]) => !d.collection && reserveePiece(id) && A.prix[d.slot] != null).sort((a, b) => +a[0] - +b[0]);
  if (!l.length) return null;
  const [id, d] = l[hache(`semaine:${semaine(jour) || jour}`) % l.length];
  return { k: 'apparat', id, prix: A.prix[d.slot] * MAGASIN.piece, monnaie: PEPITE, remise: false };
}
/** Achats du jour d'un joueur (offres de l'étal prises, sac du jour pris), remis à zéro quand le jour change. */
export interface AchatsDuJour { jour: string; etal: number[]; sac: boolean }
export function achatsDuJour(a: AchatsDuJour | null, jour: string): AchatsDuJour {
  return a && a.jour === jour ? a : { jour, etal: [], sac: false };
}
