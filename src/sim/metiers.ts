import type { ZoneDef } from './defs';
import { METIER_MAX, type ItemsData, type RecipeDef } from './items';
import type { RecoltesData } from './recolte';

/** Poste d'un atelier (maquette Métiers UI 3A) : une machine officielle de la carte (four, scie, enclume, plan de travail…)
 *  qu'on clique pour ouvrir la fenêtre Artisanat. Sans machine dessinée, un seul poste au milieu de la première carte
 *  de l'atelier (picto seul). */
export interface Poste {
  id: number; atelier: string; metiers: string[]; tag: string; x: number; y: number;
  /** Dessin officiel de la machine (déjà posé avec le décor) et son décalage en pixels Dofus : affichage seulement. */
  gfx?: number; dessin?: { x: number; y: number };
  /** Coffre partagé (0.3, 12A+12B) au lieu d'une machine : le clic ouvre le coffre. */
  coffre?: boolean;
  /** Forgemagie v2 2B : établi de forgemagie, le clic ouvre la forgemagie. */
  forge?: boolean;
}

export const FABRICATION = {
  /** 5B : une seule barre d'une seconde pour toute la série. */
  duree: 1,
  /** Distance (px monde) à laquelle on utilise une machine (elle est souvent sur une case bloquante). */
  portee: 130,
};

/** Version 0.3 (choix 9A) : les 6 métiers de fabrication d'équipement, recettes officielles jusqu'au niveau 40. */
export const METIERS_FAB = ['bijoutier', 'cordonnier', 'tailleur', 'forgeron', 'sculpteur', 'faconneur'];
/** 10A : un objet fabriqué sort Rare avec 10 % de chance au niveau 1 du métier, 50 % au niveau maximum ; Commun sinon (jamais plus, 11E). */
export const CHANCE_RARE = { min: 0.1, max: 0.5 };
export const chanceRare = (niveau: number) =>
  CHANCE_RARE.min + (CHANCE_RARE.max - CHANCE_RARE.min) * Math.min(1, Math.max(0, (niveau - 1) / (METIER_MAX - 1)));
/** 10B : ingrédients rares (Rare garanti, un par objet) : ressources que seuls des boss ou des élites lâchent (pas les objets
 *  d'événement à 100 %). */
export function ingredientsRares(items: ItemsData, monstres: Record<string, { boss?: boolean; elite?: boolean }>): Set<string> {
  const grands = new Set<string>(), communs = new Set<string>();
  for (const [m, l] of Object.entries(items.drops)) for (const d of l) {
    if (!items.resources[d.item] || d.chance >= 100) continue;
    (monstres[m]?.boss || monstres[m]?.elite ? grands : communs).add(d.item);
  }
  return new Set([...grands].filter(id => !communs.has(id)));
}

/** Recettes d'un métier (avec leur index dans items.recipes), par niveau. */
export function recettesDe(items: ItemsData, metier: string): { r: RecipeDef; i: number }[] {
  return (items.recipes ?? []).map((r, i) => ({ r, i })).filter(x => x.r.metier === metier).sort((a, b) => a.r.level - b.r.level);
}

/** Prochain palier d'un métier : le plus petit niveau de recette au-dessus du niveau actuel, et ses recettes (2B). */
export function prochainPalier(items: ItemsData, metier: string, niveau: number): { niveau: number; recettes: RecipeDef[] } | null {
  const l = recettesDe(items, metier).map(x => x.r).filter(r => r.level > niveau);
  if (!l.length) return null;
  const n = l[0].level;
  return { niveau: n, recettes: l.filter(r => r.level === n) };
}

/** Recettes débloquées pile à ce niveau (bannière de palier, 10C). */
export const recettesAuNiveau = (items: ItemsData, metier: string, niveau: number) => recettesDe(items, metier).map(x => x.r).filter(r => r.level === niveau);

/** 10C : bannière seulement aux paliers (10, 20, 30…) ; une ligne dans le fil sinon. */
export const estPalier = (niveau: number) => niveau % 10 === 0;

/** Recettes qui utilisent une ressource (12A clic droit, 12B « Sert à »). */
export const recettesAvec = (items: ItemsData, id: string) => (items.recipes ?? []).filter(r => r.ingredients.some(([x]) => x === id));

/** « Où le trouver » (8B) : d'où vient une ressource, dans les données du jeu. */
export interface Source {
  /** Ressource à récolter : métier et niveau requis. */
  recolte?: { metier: string; niveau: number };
  /** Monstres qui la lâchent (nom, chance en %, sous-zones ou donjons où on les croise ; chasse = arme de chasse requise). */
  monstres: { cle: string; nom: string; chance: number; lieux: string[]; chasse: boolean }[];
  /** Recette qui la fabrique. */
  recette?: RecipeDef;
  /** Boutique d'un PNJ (clé de boutique.json) qui la vend. */
  boutique?: string;
}

/** Monstre -> lieux (noms de sous-zones et de donjons) d'un monde. */
function lieuxDesMonstres(open: NonNullable<ZoneDef['open']>): Map<string, string[]> {
  const L = new Map<string, string[]>();
  const add = (m: string, n: string) => { const l = L.get(m) ?? []; if (!l.includes(n)) l.push(n); L.set(m, l); };
  for (const sa of Object.values(open.subareas)) {
    for (const m of sa.monsters) add(m, sa.name);
    if (sa.elite) add(sa.elite, sa.name);
  }
  for (const d of open.donjons ?? []) for (const groupes of Object.values(d.salles)) for (const g of groupes) for (const m of g) add(m, d.nom);
  return L;
}

export function sourcesDe(id: string, items: ItemsData, ctx: {
  monsterName: (k: string) => string | undefined; zones: ZoneDef[]; recoltes?: RecoltesData; boutiques?: Record<string, { id: string }[]>;
}): Source {
  const lieux = new Map<string, string[]>();
  for (const z of ctx.zones) if (z.open) for (const [m, l] of lieuxDesMonstres(z.open)) lieux.set(m, [...new Set([...(lieux.get(m) ?? []), ...l])]);
  const monstres: Source['monstres'] = [];
  for (const [cle, l] of Object.entries(items.drops)) {
    const d = l.find(x => x.item === id), nom = d && ctx.monsterName(cle);
    if (d && nom && lieux.has(cle)) monstres.push({ cle, nom, chance: d.chance, lieux: lieux.get(cle)!, chasse: !!d.chasse });
  }
  monstres.sort((a, b) => b.chance - a.chance);
  const rc = ctx.recoltes?.ressources[id];
  return {
    recolte: rc ? { metier: rc.metier, niveau: rc.niveau } : undefined,
    monstres,
    recette: (items.recipes ?? []).find(r => r.result === id),
    boutique: Object.entries(ctx.boutiques ?? {}).find(([, l]) => Array.isArray(l) && l.some(a => a.id === id))?.[0],
  };
}
