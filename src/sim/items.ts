import type { Rng } from './math';

/** Caractéristiques du perso (noms Dofus). Les élémentaires boostent les sorts de leur élément :
 *  terre = force, feu = intelligence, eau = chance, air = agilité (comme dans Dofus : +1 % par point). */
export const STATS = ['vitalite', 'sagesse', 'force', 'intelligence', 'chance', 'agilite', 'puissance', 'dommages', 'critique', 'soins',
  'pa', 'pm', 'prospection', 'vitesse', 'dommagesTerre', 'dommagesFeu', 'dommagesEau', 'dommagesAir', 'dommagesNeutre',
  // choix 10C : toutes les autres caractéristiques de Dofus (rôles en temps réel dans src/sim/caracs.ts)
  'portee', 'initiative', 'resTerre', 'resFeu', 'resEau', 'resAir', 'resNeutre', 'redTerre', 'redFeu', 'redEau', 'redAir', 'redNeutre',
  'tacle', 'fuite', 'esquivePA', 'esquivePM', 'retraitPA', 'retraitPM', 'dommagesPoussee', 'resPoussee', 'dommagesCritiques', 'resCritiques',
  'invocations', 'pods'] as const;
export type Stat = typeof STATS[number];
export type Stats = Partial<Record<Stat, number>>;
/** Les 6 caractéristiques où l'on place ses 5 points par niveau (choix 6C). */
export const BASE_STATS: Stat[] = ['vitalite', 'sagesse', 'force', 'intelligence', 'chance', 'agilite'];

export const STAT_NAMES: Record<Stat, string> = {
  vitalite: 'Vitalité', sagesse: 'Sagesse', force: 'Force', intelligence: 'Intelligence', chance: 'Chance', agilite: 'Agilité',
  puissance: 'Puissance', dommages: 'Dommages', critique: '% Critique', soins: 'Soins', pa: 'PA', pm: 'PM', prospection: 'Prospection', vitesse: '% Vitesse d\'attaque',
  dommagesTerre: 'Dommages Terre', dommagesFeu: 'Dommages Feu', dommagesEau: 'Dommages Eau', dommagesAir: 'Dommages Air', dommagesNeutre: 'Dommages Neutre',
  portee: 'Portée', initiative: 'Initiative',
  resTerre: '% Résistance Terre', resFeu: '% Résistance Feu', resEau: '% Résistance Eau', resAir: '% Résistance Air', resNeutre: '% Résistance Neutre',
  redTerre: 'Résistance Terre', redFeu: 'Résistance Feu', redEau: 'Résistance Eau', redAir: 'Résistance Air', redNeutre: 'Résistance Neutre',
  tacle: 'Tacle', fuite: 'Fuite', esquivePA: 'Esquive PA', esquivePM: 'Esquive PM', retraitPA: 'Retrait PA', retraitPM: 'Retrait PM',
  dommagesPoussee: 'Dommages Poussée', resPoussee: 'Résistance Poussée', dommagesCritiques: 'Dommages Critiques', resCritiques: 'Résistance Critiques',
  invocations: 'Invocations', pods: 'Pods',
};

export type Slot = 'amulette' | 'anneau' | 'ceinture' | 'bottes' | 'chapeau' | 'cape' | 'bouclier' | 'arme';
/** Emplacements portés : deux anneaux. */
export type EquipSlot = Exclude<Slot, 'anneau'> | 'anneau1' | 'anneau2';
export const EQUIP_SLOTS: EquipSlot[] = ['chapeau', 'cape', 'amulette', 'anneau1', 'anneau2', 'ceinture', 'bottes', 'arme', 'bouclier'];

/** Objet officiel de Dofus (src/data/items.json, fait par tools/extraction/items_export.py). */
export interface ItemDef {
  name: string; slot: Slot; level: number; icon: number;
  /** Lignes de caractéristiques [min, max]. */
  stats: Partial<Record<Stat, [number, number]>>;
  weapon?: { type: string; dmg: { element: string; min: number; max: number }[] };
  set?: number;
  /** Effet officiel « Arme de chasse » (795) : fait tomber les viandes (métier Chasseur, choix 6A). */
  chasse?: boolean;
}
/** Panoplie : bonus[n] s'applique avec n + 1 objets portés. */
export interface SetDef { name: string; items: number[]; bonus: Record<string, Stats> }
/** soin : la ressource se mange et rend ce nombre de PV (effet officiel 110, ex. Bouillon de Chair +11 PV). */
export interface ResourceDef { name: string; icon: number; level: number; soin?: number }
/** Butin d'un monstre ; metier = critère officiel « Pj>41,N » (Chasseur au-dessus du niveau N), chasse = « CU>0 » (arme de chasse). */
export interface DropDef { item: string; chance: number; metier?: { id: number; min: number }; chasse?: boolean }
/** Recette officielle d'un métier (recipesdataroot). */
export interface RecipeDef { result: string; metier: string; level: number; ingredients: [string, number][] }
export interface MetierDef { id: number; name: string; icon: number }
export interface ItemsData {
  equipment: Record<string, ItemDef>;
  sets: Record<string, SetDef>;
  resources: Record<string, ResourceDef>;
  /** Butin officiel de chaque monstre du jeu (chance en %). */
  drops: Record<string, DropDef[]>;
  recipes?: RecipeDef[];
  metiers?: Record<string, MetierDef>;
}

/** Métiers : niveau 1 à 200 comme dans Dofus. La courbe d'XP et les gains ne sont pas dans les données du jeu :
 *  ce sont les nôtres (XP pour passer au niveau suivant = 20 × niveau). */
export const METIER_MAX = 200;
export const metierXpNeeded = (level: number) => 20 * level;
/** XP de métier : une viande ramassée, et une recette faite (par ingrédient). */
export const METIER_XP = { viande: 5, parIngredient: 10 };

/** Raretés (choix du 2026-11-04) ; la panoplie reste une étiquette à part. */
export const RARITIES = ['commun', 'magique', 'rare', 'legendaire'] as const;
export type Rarity = typeof RARITIES[number];
export const RARITY_NAMES: Record<Rarity, string> = { commun: 'Commun', magique: 'Magique', rare: 'Rare', legendaire: 'Légendaire' };
export const RARITY_COLORS: Record<Rarity, string> = { commun: '#e8e2d4', magique: '#6fb2e8', rare: '#f2d36b', legendaire: '#f08a2c' };

/** Effets légendaires : du confort plutôt que de gros dégâts, et leur puissance suit le niveau de l'objet
 *  (40 % au niveau 10, 100 % au niveau 50), pour que les légendaires de bas niveau restent raisonnables. */
export const LEGENDARY = {
  rage: { name: 'Colère contenue', text: (v: number) => `La jauge de classe se remplit ${v} % plus vite`, max: 50 },
  potion: { name: 'Gourde sans fond', text: (v: number) => `Les potions soignent ${v} % de plus`, max: 40 },
  mobilite: { name: 'Pied léger', text: (v: number) => `Les PM se rechargent ${v} % plus vite`, max: 40 },
  vampire: { name: 'Soif de sang', text: (v: number) => `Chaque monstre vaincu rend ${v} PV de plus`, max: 12 },
} as const;
export type LegendaryId = keyof typeof LEGENDARY;
export const legendaryPower = (level: number) => Math.min(1, Math.max(0.4, 0.4 + (level - 10) * 0.015));

/** Un objet tiré : ses jets réels, sa rareté, et éventuellement un effet légendaire. */
export interface Item {
  uid: number; id: string; rarity: Rarity;
  stats: Stats;
  /** Lignes ajoutées par la rareté (affichées en couleur dans la fiche). */
  extra: Stat[];
  legendary?: { id: LegendaryId; value: number };
}

/** Tirage de la rareté : le niveau du monstre et la Prospection rendent les bons objets un peu plus fréquents. */
export function rollRarity(rng: Rng, boss: boolean, prospection = 0): Rarity {
  const p = 1 + prospection / 200, r = rng.next() * 100;
  const leg = (boss ? 4 : 0.6) * p, rare = (boss ? 22 : 6) * p, mag = (boss ? 45 : 24) * p;
  return r < leg ? 'legendaire' : r < leg + rare ? 'rare' : r < leg + rare + mag ? 'magique' : 'commun';
}

/** Tire les jets d'un objet officiel selon sa rareté :
 *  commun = jets dans la moitié basse ; magique = jets complets + 1 ligne ; rare = moitié haute + 2 lignes ;
 *  légendaire = jets hauts + 2 lignes + un effet légendaire. Les malus de l'objet officiel sont gardés tels quels. */
export function rollItem(id: string, def: ItemDef, rarity: Rarity, rng: Rng, uid: number): Item {
  const lo = { commun: 0, magique: 0, rare: 0.5, legendaire: 0.7 }[rarity], hi = { commun: 0.5, magique: 1, rare: 1, legendaire: 1 }[rarity];
  const stats: Stats = {};
  for (const [k, [a, b]] of Object.entries(def.stats) as [Stat, [number, number]][]) {
    if (a < 0) { stats[k] = a; continue; }
    stats[k] = Math.round(a + (b - a) * (lo + (hi - lo) * rng.next()));
  }
  const extra: Stat[] = [];
  const n = { commun: 0, magique: 1, rare: 2, legendaire: 2 }[rarity];
  const pool: Stat[] = ['vitalite', 'force', 'intelligence', 'chance', 'agilite', 'sagesse', 'critique', 'prospection', 'vitesse'];
  for (let i = 0; i < n; i++) {
    const free = pool.filter(s => stats[s] === undefined);
    if (!free.length) break;
    const s = rng.pick(free), base = s === 'critique' || s === 'vitesse' ? 2 + def.level / 20 : s === 'vitalite' ? 4 + def.level : 2 + def.level / 2;
    stats[s] = Math.max(1, Math.round(base * rng.range(0.6, 1)));
    extra.push(s);
  }
  const it: Item = { uid, id, rarity, stats, extra };
  if (rarity === 'legendaire') {
    const l = rng.pick(Object.keys(LEGENDARY) as LegendaryId[]);
    it.legendary = { id: l, value: Math.round(LEGENDARY[l].max * legendaryPower(def.level)) };
  }
  return it;
}

/** Valeur de vente au recycleur (des runes pour la forgemagie, plus tard). */
export const recycleValue = (def: ItemDef, it: Item) => Math.max(1, Math.round(def.level * (1 + RARITIES.indexOf(it.rarity))));
