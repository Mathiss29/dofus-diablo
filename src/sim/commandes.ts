import { hache, suite } from './contrats';
import type { QueteDef } from './quests';

/** Commandes des artisans (maquette « Des métiers qui servent vraiment », ligne « Métiers : » 8A + 8B, 2026-11-13).
 *  - 8A : au Bastion des Douze, le tableau des commandes (le Héraut d'Ecaflip) propose 3 commandes par jour, une par métier, d'objets
 *    qu'on fabrique : plats, potions, alliages, planches, clés… Elles rendent des kamas, de l'XP de métier et des Pépites.
 *  - 8B : les PNJ des villes (Hazel Ementaire à Astrub, le Bailli au Château d'Amakna) commandent les ressources récoltées autour d'eux.
 *  Comme les contrats du jour : tirées de la date (pas de Math.random), gardées pour la journée, et tout ce qu'il faut savoir d'une
 *  commande est dans son id « cmd:<jour>:<pnj>:<objet>:<quantité>:<métier>:<niveau> ». La quête se rend au PNJ, qui prend les objets. */

export type SorteCommandes = 'atelier' | 'ville';
export const COMMANDES = {
  /** Commandes par jour : tableau du Bastion (8A), PNJ d'une ville (8B). */
  parJour: { atelier: 3, ville: 2 } as Record<SorteCommandes, number>,
  /** Rayon (en cartes) des ressources « locales » d'un PNJ de ville. */
  rayon: 6,
};

/** Ce qu'il faut savoir pour tirer les commandes du jour. */
export interface CtxCommandes {
  /** Recettes dont le résultat va dans le sac (ni équipement ni trophée). */
  recettes: { result: string; metier: string; level: number; ingredients: [string, number][] }[];
  /** Niveau de chaque métier du perso. */
  niveaux: Record<string, number>;
  /** 8B : ressources récoltées près du PNJ (id, métier, niveau). */
  locales?: { id: string; metier: string; niveau: number }[];
}

/** Les commandes du jour d'un PNJ. */
export function tirerCommandes(jour: string, pnj: string, sorte: SorteCommandes, ctx: CtxCommandes): string[] {
  const r = suite(hache(`${jour}:cmd:${pnj}`)), out: string[] = [];
  const nv = (m: string) => Math.max(1, ctx.niveaux[m] ?? 0);
  if (sorte === 'atelier') {
    // une commande par métier : les recettes faisables à son niveau, les plus hautes d'abord
    const parMetier = new Map<string, CtxCommandes['recettes']>();
    for (const x of ctx.recettes) if (x.level <= nv(x.metier)) parMetier.set(x.metier, [...(parMetier.get(x.metier) ?? []), x]);
    const metiers = [...parMetier.keys()].sort();
    for (let i = 0; i < COMMANDES.parJour.atelier && metiers.length; i++) {
      const m = metiers.splice(Math.floor(r() * metiers.length), 1)[0];
      const l = parMetier.get(m)!.sort((a, b) => b.level - a.level || a.result.localeCompare(b.result)).slice(0, 4);
      const x = l[Math.floor(r() * l.length)], q = x.ingredients.reduce((s, [, n]) => s + n, 0);
      const n = Math.max(1, Math.min(6, Math.round(16 / Math.max(1, q))));
      out.push(`cmd:${jour}:${pnj}:${x.result}:${n}:${m}:${x.level}`);
    }
  } else {
    const l = (ctx.locales ?? []).filter(x => x.niveau <= nv(x.metier)).sort((a, b) => b.niveau - a.niveau || a.id.localeCompare(b.id));
    const pris = new Set<string>();
    for (let i = 0; i < COMMANDES.parJour.ville && l.length; i++) {
      const libres = l.filter(x => !pris.has(x.id)), c = libres.length ? libres : l;
      const x = c[Math.floor(r() * Math.min(c.length, 5))]; pris.add(x.id);
      out.push(`cmd:${jour}:${pnj}:${x.id}:${10 + 5 * Math.floor(r() * 3)}:${x.metier}:${x.niveau}`);
    }
  }
  return out;
}

/** Récompense d'une commande (selon le niveau, la quantité et les ingrédients). */
export function recompenseCommande(sorte: SorteCommandes, n: number, niveau: number, ingredients: number) {
  if (sorte === 'atelier') return { kamas: Math.round(n * ingredients * (8 + niveau)), xp: 20 * n * ingredients, pepites: 3 + Math.floor(niveau / 10) };
  return { kamas: Math.round(n * (4 + niveau) * 2), xp: n * (5 + niveau), pepites: 2 + Math.floor(niveau / 20) };
}

/** La commande d'un id (null si l'id n'en est pas une ou que l'objet n'existe plus). */
export function commande(id: string, ctx: {
  nomObjet: (id: string) => string | undefined; nomMetier: (m: string) => string; nomPnj: (p: string) => string;
  sorte: (pnj: string) => SorteCommandes | undefined; ingredients: (objet: string) => number;
}): QueteDef | null {
  const [k, jour, pnj, objet, sn, metier, sl] = id.split(':'), n = Number(sn), niveau = Number(sl), sorte = ctx.sorte(pnj), nom = ctx.nomObjet(objet);
  if (k !== 'cmd' || !sorte || !nom || !(n > 0) || !(niveau > 0)) return null;
  const r = recompenseCommande(sorte, n, niveau, ctx.ingredients(objet));
  const texte = sorte === 'atelier'
    ? `Un client du Bastion attend ${n} × ${nom}. Fabrique-les (${ctx.nomMetier(metier)}, niveau ${niveau}) et rapporte-les au tableau avant minuit.`
    : `${ctx.nomPnj(pnj)} a besoin de ${n} × ${nom}, récolté${n > 1 ? 's' : ''} dans les environs (${ctx.nomMetier(metier)}, niveau ${niveau}).`;
  return { nom: `Commande : ${n} × ${nom}`, type: 'prime', pnj, rendre: pnj, niveau, serie: 'Commande du jour', contrat: jour, texte,
    etapes: [{ nom: 'Commande', objectifs: [{ t: 'livrer', objet, n, texte: `Apporter ${n} × ${nom}` }] }],
    recompense: { kamas: r.kamas, pepites: r.pepites, metier: [metier, r.xp] },
    merci: sorte === 'atelier' ? 'Parfait, le client sera ravi. Voici ton dû.' : 'Exactement ce qu\'il me fallait. Merci !' };
}
