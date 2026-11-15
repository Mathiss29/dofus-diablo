/** Hôtel de Vente (maquette « HDV : 1D 2A+2B+2C+2D 3A-3E 4A+4B+4C 5A-5D 6A+6B 7C 8 9A », Mathis 2026-11-15).
 *  Règles communes au jeu et au serveur (serveur/hdv.mjs, qui lit ce module dans partie/sim.mjs) :
 *  - 1D : tout se fait de partout, par un onglet du menu ; 7C : un seul HDV pour tous, Hardcore compris ;
 *  - 3A-3E : tout se vend (ressources, consommables, runes, équipement de toute rareté, familiers, apparats gagnés en jeu),
 *    jamais les Dofus, la Pépite ni les apparats payés en Ogrines ; « En ligne : » 3B + « Arène : » 17A : les âmes capturées aussi ;
 *  - 4A : l'équipement seulement s'il a été vu par le serveur (signé quand il apparaît dans une partie du serveur) ;
 *    4C : les ressources du solo dans une limite par jour ;
 *  - 5A : taxe de 2 % à la mise en vente, perdue même si rien ne se vend ; 5B : 16 annonces par perso, 7 jours, puis retour
 *    au coffre du compte ; 5C : alerte si le prix s'écarte du prix moyen ; 5D : plus d'annonces avec l'abonnement ;
 *  - 6A : l'achat va dans le sac (le coffre du compte si le sac est plein) ; 6B : les kamas d'une vente arrivent même hors ligne. */
import recoltes from '../data/recoltes.json';
import consommables from '../data/consommables.json';
import { BOUTIQUE_OGRINES } from './boutiqueOgrines';
import { sourceApparat } from './apparats';
import { COFFRE } from './coffre';
import { RUNES } from './forgemagie';
import { extraBase, PEPITE, RARITIES, type Item, type ItemDef, type ItemsData, type Rarity, type Stat } from './items';
import type { Player } from './player';
import type { World } from './world';

export const HDV = {
  /** 5A : taxe de mise en vente (part du prix demandé). */
  taxe: 0.02,
  /** 5B : annonces par perso et durée d'une annonce (jours) ; 5D : annonces en plus par palier d'abonnement (Aventurier, Héros, Légende). */
  annonces: 16, abonnement: [4, 8, 16], jours: 7,
  /** 2B : lots des ressources, consommables et runes. */
  lots: [1, 10, 100] as const,
  /** 4C : unités de ressources que le solo peut mettre en vente par jour et par compte. */
  soloJour: 500,
  /** 5C : alerte sous un quart ou au-delà de 4 fois le prix moyen. */
  garde: [0.25, 4] as const,
  /** Prix le plus haut d'une annonce (kamas). */
  prixMax: 1_000_000_000,
  /** 2C : jours de la courbe de prix ; prix moyen sur ces jours. */
  courbe: 7,
};

export type TypeVente = 'equipement' | 'familier' | 'ressource' | 'consommable' | 'rune' | 'apparat' | 'ame';
export const TYPES_VENTE: { k: TypeVente; nom: string }[] = [
  { k: 'equipement', nom: 'Équipement' }, { k: 'ressource', nom: 'Ressources' }, { k: 'consommable', nom: 'Consommables' },
  { k: 'rune', nom: 'Runes' }, { k: 'familier', nom: 'Familiers' }, { k: 'apparat', nom: 'Apparats' }, { k: 'ame', nom: 'Âmes' },
];
/** Ce qui part en vente : un objet du sac (équipement, familier), n unités d'une ressource, un apparat gagné, ou une âme capturée
 *  (id de sa ressource officielle « Âme capturée » ; elle quitte le carnet du vendeur et rejoint celui de l'acheteur). */
export type ObjetHdv = { k: 'objet'; item: Item } | { k: 'ressource'; id: string; n: number } | { k: 'apparat'; id: string } | { k: 'ame'; id: string };
/** 4C : une âme du solo compte pour autant d'unités dans la limite du jour. */
export const QUOTA_AME = 25;

const R = recoltes as unknown as { metiers: Record<string, { nom: string }>; ressources: Record<string, { metier: string }> };
const C = consommables as unknown as Record<string, Record<string, unknown>>;
const CONSOS = new Set(['repas', 'elixirs', 'boissons', 'parchemins'].flatMap(k => Object.keys(C[k] ?? {})));
/** Catégories des ressources (cases à cocher, comme Sanstour) : par métier de récolte, butin de monstre, le reste. */
export const CATEGORIES_RESSOURCES: { k: string; nom: string }[] = [
  ...Object.entries(R.metiers).map(([k, m]) => ({ k, nom: m.nom })), { k: 'eau', nom: 'Sans métier' }, { k: 'butin', nom: 'Butin de monstre' }, { k: 'autre', nom: 'Autres' },
];
let butin: Set<string> | null = null, butinDe: ItemsData | null = null;
const deMonstre = (id: string, items: ItemsData) => {
  if (butinDe !== items) { butinDe = items; butin = new Set(Object.values(items.drops ?? {}).flatMap(l => l.map(d => d.item))); }
  return butin!.has(id);
};

/** Apparats payés en Ogrines (boutique, apparats du mois des abonnés) : jamais à l'HDV (3D). */
const OGRINES = new Set<string>([...Object.values(BOUTIQUE_OGRINES.articles).flatMap(a => a.apparats ?? []), ...BOUTIQUE_OGRINES.abonnement.apparatsDuMois]);

/** Type de vente d'un objet (icônes de l'onglet Achat). */
export function typeVente(o: ObjetHdv, items: ItemsData): TypeVente {
  if (o.k === 'apparat') return 'apparat';
  if (o.k === 'ame') return 'ame';
  if (o.k === 'objet') return items.equipment[o.item.id]?.familier ? 'familier' : 'equipement';
  if (RUNES[o.id]) return 'rune';
  if (CONSOS.has(o.id)) return 'consommable';
  return 'ressource';
}
/** Catégorie dans son type : emplacement de l'équipement, métier ou origine d'une ressource. */
export function categorieHdv(o: ObjetHdv, items: ItemsData): string {
  if (o.k === 'apparat') return sourceApparat(o.id)?.k ?? 'autre';
  if (o.k === 'ame') return 'ame';
  if (o.k === 'objet') return items.equipment[o.item.id]?.slot ?? 'autre';
  const t = typeVente(o, items);
  if (t === 'rune') return String(RUNES[o.id]?.stat ?? 'autre');
  if (t === 'consommable') return ['repas', 'elixirs', 'boissons', 'parchemins'].find(k => C[k]?.[o.id] != null) ?? 'autre';
  const r = R.ressources[o.id];
  if (r) return r.metier || 'eau';
  return deMonstre(o.id, items) ? 'butin' : 'autre';
}
/** Clé d'un objet pour les prix (courbe, moyenne, favoris) : un équipement par rareté, une ressource, un apparat. */
export function cleHdv(o: ObjetHdv): string {
  return o.k === 'objet' ? `o:${o.item.id}:${o.item.rarity}` : o.k === 'ressource' ? `r:${o.id}` : o.k === 'ame' ? `m:${o.id}` : `a:${o.id}`;
}
/** Quantité vendue (les prix se comparent à l'unité). */
export const quantiteHdv = (o: ObjetHdv) => (o.k === 'ressource' ? o.n : 1);
export function niveauHdv(o: ObjetHdv, items: ItemsData): number {
  if (o.k === 'objet') { const d = items.equipment[o.item.id]; return d?.familier ? o.item.niv ?? 1 : d?.level ?? 1; }
  if (o.k === 'ressource' || o.k === 'ame') return items.resources[o.id]?.level ?? 1;
  return 1;
}
export function nomHdv(o: ObjetHdv, items: ItemsData, apparats?: Record<string, { nom?: string; name?: string }>): string {
  if (o.k === 'objet') { const d = items.equipment[o.item.id]; return d?.familier?.nom ?? d?.name ?? o.item.id; }
  if (o.k === 'ressource' || o.k === 'ame') return items.resources[o.id]?.name ?? o.id;
  const a = apparats?.[o.id]; return a?.nom ?? a?.name ?? items.equipment[o.id]?.name ?? `Apparat ${o.id}`;
}
export const rareteHdv = (o: ObjetHdv): Rarity | '' => (o.k === 'objet' ? o.item.rarity : '');

/** 4A : jets plausibles pour cet objet (jets officiels, lignes de rareté, forgemagie, chef-d'œuvre : large marge). */
export function jetsPlausibles(it: Item, def: ItemDef): boolean {
  if (!RARITIES.includes(it.rarity) || !it.stats || typeof it.stats !== 'object') return false;
  for (const [k, v] of Object.entries(it.stats) as [Stat, number][]) {
    if (!Number.isFinite(v)) return false;
    const off = def.stats[k]?.[1] ?? 0, plafond = Math.max(off, extraBase(k, def.level));
    if (v > Math.ceil(plafond * 1.6) + 10) return false;
  }
  return true;
}

/** Peut-on mettre cet objet en vente ? null si oui, sinon la raison (montrée au joueur). La signature (4A) est vérifiée
 *  par le serveur, pas ici. */
export function refusHdv(o: ObjetHdv, items: ItemsData): string | null {
  if (o.k === 'ressource') {
    if (!Number.isInteger(o.n) || !HDV.lots.includes(o.n as 1 | 10 | 100)) return 'lot';
    if (o.id === PEPITE) return 'pepite';
    if (!items.resources[o.id] || items.resources[o.id].ame) return 'inconnu';   // une âme se vend comme âme
    return null;
  }
  if (o.k === 'ame') return items.resources[o.id]?.ame ? null : 'inconnu';
  if (o.k === 'apparat') {
    const s = sourceApparat(o.id);
    if (!s || s.k === 'boutique' || OGRINES.has(o.id)) return 'ogrines';
    return null;
  }
  const d = items.equipment[o.item.id];
  if (!d || d.horsJeu) return 'inconnu';
  if (!jetsPlausibles(o.item, d)) return 'jets';
  return null;
}

export const taxeHdv = (prix: number) => Math.max(1, Math.ceil(prix * HDV.taxe));
/** 5B + 5D : annonces au plus pour un perso, selon le rang d'abonnement (0 sans abonnement). */
export const annoncesMax = (rang: number) => HDV.annonces + (rang > 0 ? HDV.abonnement[Math.min(rang, 3) - 1] : 0);
/** 5C : le prix (à l'unité) s'écarte-t-il du prix moyen ? 'bas', 'haut' ou null. */
export function alertePrix(unite: number, moyenne: number | null | undefined): 'bas' | 'haut' | null {
  if (!moyenne || moyenne <= 0) return null;
  return unite < moyenne * HDV.garde[0] ? 'bas' : unite > moyenne * HDV.garde[1] ? 'haut' : null;
}

// --- Gestes sur le perso (le jeu en solo, le serveur dans ses parties) ------------------------------------------------
/** Retire l'objet mis en vente du perso ; rend l'objet retiré (l'objet du sac pour un équipement) ou null s'il n'y est pas. */
export function retirerHdv(p: Player, o: ObjetHdv): ObjetHdv | null {
  if (o.k === 'ressource') {
    if ((p.resources[o.id] ?? 0) < o.n) return null;
    p.resources[o.id] -= o.n; if (!p.resources[o.id]) delete p.resources[o.id];
    return { ...o };
  }
  if (o.k === 'ame') {
    const i = p.ames.indexOf(p.items?.resources[o.id]?.ame ?? '');
    if (i < 0) return null;
    p.ames.splice(i, 1);
    return { ...o };
  }
  if (o.k === 'apparat') {
    const i = p.apparats.indexOf(o.id);
    if (i < 0) return null;
    p.apparats.splice(i, 1);
    for (const k of Object.keys(p.apparat) as (keyof Player['apparat'])[]) if (p.apparat[k] === o.id) delete p.apparat[k];
    return { ...o };
  }
  const i = p.bag.findIndex(it => it.uid === o.item.uid);
  if (i < 0) return null;
  const [it] = p.bag.splice(i, 1);
  return { k: 'objet', item: it };
}

/** Remet un objet au perso (achat, annonce revenue). 6A : le sac d'abord (le coffre du compte s'il est plein) ; 5B (retour) :
 *  le coffre du compte d'abord. Rend où il est allé, ou null s'il n'y a plus de place (il reste en attente sur le serveur).
 *  sansCoffre : partie du serveur, où le coffre du compte n'est pas (le sac seulement). */
export function donnerHdv(w: World, p: Player, o: ObjetHdv, coffreDabord = false, sansCoffre = false): 'sac' | 'coffre' | null {
  if (o.k === 'ressource') { p.resources[o.id] = (p.resources[o.id] ?? 0) + o.n; return 'sac'; }
  if (o.k === 'apparat') { if (!p.apparats.includes(o.id)) p.apparats.push(o.id); return 'sac'; }
  if (o.k === 'ame') { const t = w.opts.items?.resources[o.id]?.ame; if (t && !p.ames.includes(t)) p.ames.push(t); return 'sac'; }
  const it: Item = { ...o.item, uid: w.newUid() };
  delete it.cadenas;
  const onglet = p === w.players[0] && !sansCoffre ? w.coffre.onglets.find(l => l.length < COFFRE.places) : undefined;
  const sac = p.bag.length < p.tailleSac;
  const ou = coffreDabord ? (onglet ? 'coffre' : sac ? 'sac' : null) : (sac ? 'sac' : onglet ? 'coffre' : null);
  if (ou === 'sac') p.bag.push(it); else if (ou === 'coffre') onglet!.push(it); else return null;
  if (w.opts.items?.equipment[it.id]?.familier) w.commeJoueur(p, () => w.noterFamilier(it));
  return ou;
}

/** Relit un objet reçu (corps d'une requête, colis du serveur) : null s'il est mal formé. */
export function relireObjetHdv(x: unknown): ObjetHdv | null {
  const o = x as Partial<ObjetHdv> & Record<string, unknown> | null;
  if (!o || typeof o !== 'object') return null;
  if (o.k === 'ressource' && typeof o.id === 'string' && /^\d{1,7}$/.test(o.id) && Number.isInteger(o.n) && (o.n as number) > 0 && (o.n as number) <= 100) return { k: 'ressource', id: o.id, n: o.n as number };
  if ((o.k === 'apparat' || o.k === 'ame') && typeof o.id === 'string' && /^\d{1,7}$/.test(o.id)) return { k: o.k, id: o.id };
  const it = o.item as Item | undefined;
  if (o.k === 'objet' && it && typeof it === 'object' && typeof it.id === 'string' && /^\d{1,7}$/.test(it.id) && RARITIES.includes(it.rarity)
    && it.stats && typeof it.stats === 'object' && Array.isArray(it.extra) && JSON.stringify(it).length < 4000) return { k: 'objet', item: it };
  return null;
}

/** Gestes de l'HDV sur un perso qui joue dans une partie du serveur (serveur/hdv.mjs) : nommés plutôt que des fonctions, pour
 *  passer d'un fil Node à l'autre (« En ligne : » 7B, une partie par fil). Rejoué pour ce joueur (w.commeJoueur). */
export type OpHdv =
  | { op: 'objet'; uid: number }
  | { op: 'vendre'; objet: ObjetHdv; taxe: number }
  | { op: 'acheter'; objet: ObjetHdv; prix: number }
  | { op: 'donner'; objet: ObjetHdv }
  | { op: 'colis'; objet: ObjetHdv | null; kamas: number };
export function opHdv(w: World, j: Player, o: OpHdv): unknown {
  switch (o.op) {
    case 'objet': return j.bag.find(it => it.uid === o.uid) ?? null;
    case 'vendre': {
      if (j.kamas < o.taxe) return { erreur: 'kamas' };
      const r = retirerHdv(j, o.objet);
      if (!r) return { erreur: 'absent' };
      j.kamas -= o.taxe; return { objet: r };
    }
    case 'acheter':
      if (j.kamas < o.prix) return 'kamas';
      if (o.objet.k === 'objet' && j.bag.length >= j.tailleSac) return 'place';   // le coffre du compte n'est pas dans la partie
      j.kamas -= o.prix; donnerHdv(w, j, o.objet, false, true); return null;
    case 'donner': return donnerHdv(w, j, o.objet, false, true) !== 'sac' ? 'place' : null;
    case 'colis':
      if (o.objet && donnerHdv(w, j, o.objet, false, true) !== 'sac') return false;
      j.kamas += o.kamas; return true;
  }
  return null;
}
