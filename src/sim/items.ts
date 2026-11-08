import type { Rng } from './math';
import { POUVOIR_PAR_ID, textePouvoir, tirerPouvoirs, type CtxPouvoirs } from './pouvoirs';

/** Caractéristiques du perso (noms Dofus). Les élémentaires boostent les sorts de leur élément :
 *  terre = force, feu = intelligence, eau = chance, air = agilité (comme dans Dofus : +1 % par point). */
export const STATS = ['vitalite', 'sagesse', 'force', 'intelligence', 'chance', 'agilite', 'puissance', 'dommages', 'critique', 'soins',
  'pa', 'pm', 'prospection', 'vitesse', 'dommagesTerre', 'dommagesFeu', 'dommagesEau', 'dommagesAir', 'dommagesNeutre',
  // choix 10C : toutes les autres caractéristiques de Dofus (rôles en temps réel dans src/sim/caracs.ts)
  'portee', 'initiative', 'resTerre', 'resFeu', 'resEau', 'resAir', 'resNeutre', 'redTerre', 'redFeu', 'redEau', 'redAir', 'redNeutre',
  'tacle', 'fuite', 'esquivePA', 'esquivePM', 'retraitPA', 'retraitPM', 'dommagesPoussee', 'resPoussee', 'dommagesCritiques', 'resCritiques',
  'invocations', 'pods',
  // maquette Recharges 7B : raccourcit toutes les recharges des sorts (plafond 25 %)
  'reductionRecharges'] as const;
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
  invocations: 'Invocations', pods: 'Pods', reductionRecharges: '% Réduction des recharges',
};
/** Plafond de la stat « % Réduction des recharges » (maquette Recharges 7B). */
export const REDUCTION_RECHARGES_MAX = 25;

export type Slot = 'amulette' | 'anneau' | 'ceinture' | 'bottes' | 'chapeau' | 'cape' | 'bouclier' | 'arme' | 'familier';
/** Emplacements portés : deux anneaux. */
export type EquipSlot = Exclude<Slot, 'anneau'> | 'anneau1' | 'anneau2';
export const EQUIP_SLOTS: EquipSlot[] = ['chapeau', 'cape', 'amulette', 'anneau1', 'anneau2', 'ceinture', 'bottes', 'arme', 'bouclier', 'familier'];

/** Objet officiel de Dofus (src/data/items.json, fait par tools/extraction/items_export.py). */
export interface ItemDef {
  name: string; slot: Slot; level: number; icon: number;
  /** Lignes de caractéristiques [min, max]. */
  stats: Partial<Record<Stat, [number, number]>>;
  weapon?: { type: string; dmg: { element: string; min: number; max: number }[] };
  set?: number;
  /** Effet officiel « Arme de chasse » (795) : fait tomber les viandes (métier Chasseur, choix 6A). */
  chasse?: boolean;
  /** Familier (maquette Familiers) : ses bonus grandissent avec son niveau, de 1 à 100. */
  familier?: FamilierDef;
}
/** Familier officiel (src/data/familiers.json, tools/extraction/familiers_export.py). */
export interface FamilierDef {
  nom: string; niveau: number; icon: number;
  /** Planche (assets/sprites/<planche>.json) et ses animations : repos (diagonales 1 et 5) puis course ou marche. */
  planche: string; anims: string[];
  /** [carac, valeur au niveau 0, gain par niveau] (evolutiveeffects). */
  stats?: [Stat, number, number][];
  /** 1A : monstres de sa famille qui peuvent le lâcher ; 1C : succès qui le donne. */
  monstres?: string[]; succes?: string;
  /** Familier d'apparat (5A) : change seulement l'apparence du familier porté. */
  apparat?: boolean;
  /** Prend les couleurs de son porteur (comme dans Dofus 3) ; `zones` = carte de ses zones de couleur (assets/sprites). */
  porteur?: boolean; zones?: string;
}
export const FAMILIER_MAX = 100;
/** Bonus d'un familier à ce niveau (officiel : valeur au niveau 0 + gain × niveau). */
export function familierStats(f: FamilierDef, niv: number): Stats {
  const st: Stats = {};
  for (const [k, base, par] of f.stats ?? []) { const v = Math.floor(base + par * niv); if (v > 0) st[k] = v; }
  return st;
}
/** Niveau d'un familier selon son XP totale (courbe officielle : XP totale par niveau). */
export function familierNiveau(xp: number, courbe: number[]): number {
  let n = 1;
  while (n < FAMILIER_MAX && n < courbe.length && xp >= courbe[n]) n++;
  return n;
}
/** XP de familier (2C) : en chassant (par monstre vaincu, selon son niveau) et en le nourrissant (objet ou ressource du sac).
 *  Ce ne sont pas des valeurs officielles : réglées pour un niveau 100 vers le niveau 60 du joueur en chassant seul. */
export const FAMILIER_XP = {
  chasse: (niveauMonstre: number, elite: boolean, boss: boolean) => niveauMonstre * 2 * (boss ? 10 : elite ? 3 : 1),
  objet: (niveau: number, r: Rarity) => niveau * 5 * PEPITE_RARETE[r],
  ressource: (niveau: number) => Math.max(1, niveau * 2),
};
/** Panoplie : bonus[n] s'applique avec n + 1 objets portés. */
export interface SetDef { name: string; items: number[]; bonus: Record<string, Stats> }
/** soin : la ressource se mange et rend ce nombre de PV (effet officiel 110, ex. Bouillon de Chair +11 PV).
 *  cle : clé officielle d'un donjon (son nom), demandée et prise à l'entrée (maquette 0.2, 5B).
 *  rappel : Potion de Rappel, renvoie au dernier Zaap. pepite : la monnaie d'Emp, le recycleur (objet officiel 14635). */
export interface ResourceDef { name: string; icon: number; level: number; soin?: number; cle?: string; rappel?: boolean; /** Pierre d'âme vide (0.3, 15B) : capture un archimonstre vaincu. */ pierreAme?: boolean; pepite?: boolean;
  /** Rune de forgemagie officielle (src/data/forgemagie.json). */
  rune?: boolean;
  /** Rune de Signature officielle (7508) : grave le nom du perso sur un objet (maquette Forgemagie UI 6A). */
  signature?: boolean }
/** Butin d'un monstre ; metier = critère officiel « Pj>41,N » (Chasseur au-dessus du niveau N), chasse = « CU>0 » (arme de chasse). */
export interface DropDef { item: string; chance: number; metier?: { id: number; min: number }; chasse?: boolean;
  /** Maquette « Drops » 6B : ne tombe que pendant une quête de Dofus (jamais chez nous) ou un événement (critères officiels). */
  cond?: 'quete' | 'evenement' }
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
/** Choix 12A : Commun, Rare, Épique, Légendaire, Mythique (les Dofus viendront à part). */
export const RARITIES = ['commun', 'rare', 'epique', 'legendaire', 'mythique'] as const;
export type Rarity = typeof RARITIES[number];
export const RARITY_NAMES: Record<Rarity, string> = { commun: 'Commun', rare: 'Rare', epique: 'Épique', legendaire: 'Légendaire', mythique: 'Mythique' };
export const RARITY_COLORS: Record<Rarity, string> = { commun: '#e8e2d4', rare: '#6fb2e8', epique: '#b77cf0', legendaire: '#f08a2c', mythique: '#ff4d4d' };

/** Effets légendaires : du confort plutôt que de gros dégâts, et leur puissance suit le niveau de l'objet
 *  (40 % au niveau 10, 100 % au niveau 50), pour que les légendaires de bas niveau restent raisonnables. */
export const LEGENDARY = {
  rage: { name: 'Colère contenue', text: (v: number) => `La jauge de classe se remplit ${v} % plus vite`, max: 50 },
  potion: { name: 'Gourde sans fond', text: (v: number) => `Les potions soignent ${v} % de plus`, max: 40 },
  mobilite: { name: 'Pied léger', text: (v: number) => `Les PM se rechargent ${v} % plus vite`, max: 40 },
  vampire: { name: 'Soif de sang', text: (v: number) => `Chaque monstre vaincu rend ${v} PV de plus`, max: 12 },
  // maquette Recharges 7A : dans l'esprit des bonus de sorts officiels (« -1 au délai de relance de Bond »)
  relance: { name: 'Relance éclair', text: (v: number, sort?: string) => `La recharge de ${sort ?? 'un sort'} dure ${String(v).replace('.', ',')} s de moins`, max: 2 },
} as const;
export type LegendaryId = keyof typeof LEGENDARY;
/** Effet légendaire tiré : un pouvoir maison (id de LEGENDARY ; sort = le sort visé par Relance éclair)
 *  ou, depuis la 0.3, un pouvoir officiel de classe (id de src/data/pouvoirs.json, ex. « iop-07 », value 0). */
export interface LegendaryFx { id: LegendaryId | string; value: number; sort?: string }
/** Pouvoir officiel de classe (0.3) ? */
export const estOfficiel = (l: LegendaryFx) => !!POUVOIR_PAR_ID[l.id];
/** Nom et texte d'un pouvoir pour l'infobulle (nomSort : nom du sort visé par Relance éclair). */
export function lignePouvoir(l: LegendaryFx, nomSort?: string, zone = false): { nom: string; texte: string } {
  const o = POUVOIR_PAR_ID[l.id];
  if (o) return { nom: o.sort, texte: textePouvoir(o, zone) };
  const m = LEGENDARY[l.id as LegendaryId];
  return m ? { nom: m.name, texte: m.text(l.value, nomSort) } : { nom: l.id, texte: '' };
}
export const legendaryPower = (level: number) => Math.min(1, Math.max(0.4, 0.4 + (level - 10) * 0.015));

/** Un objet tiré : ses jets réels, sa rareté, et éventuellement un effet légendaire. */
export interface Item {
  uid: number; id: string; rarity: Rarity;
  stats: Stats;
  /** Lignes ajoutées par la rareté (affichées en couleur dans la fiche). */
  extra: Stat[];
  legendary?: LegendaryFx;
  /** Mythique : un 2e effet légendaire. */
  legendary2?: LegendaryFx;
  /** Cadenas (maquette 0.2, 8C) : jamais recyclé, ni seul ni en lot. */
  cadenas?: boolean;
  /** Familier : son niveau (1 à 100) et son XP totale. */
  niv?: number; xpF?: number;
  /** Forgemagie (src/sim/forgemagie.ts) : le puits de l'objet (poids gardé de côté) et la ligne ajoutée (exo, 4B). */
  puits?: number; exo?: Stat;
  /** Signé à la Rune de Signature (Forgemagie UI 6A) : le nom du perso, montré dans l'infobulle. */
  signe?: string;
}

/** Jet maximum d'une ligne ajoutée par la rareté (aussi le max de forgemagie de ces lignes). */
export const extraBase = (s: Stat, level: number) =>
  s === 'critique' || s === 'vitesse' || s === 'reductionRecharges' ? 2 + level / 20 : s === 'vitalite' ? 4 + level : 2 + level / 2;

/** Tirage de la rareté : le niveau du monstre et la Prospection rendent les bons objets un peu plus fréquents. */
/** Tire les jets d'un objet officiel selon sa rareté :
 *  commun = jets dans la moitié basse ; rare = jets complets + 1 ligne ; épique = moitié haute + 2 lignes ;
 *  légendaire = jets hauts + 2 lignes + un effet légendaire ; mythique = jets parfaits + 2 lignes + deux effets légendaires.
 *  Les malus de l'objet officiel sont gardés tels quels. */
export function rollItem(id: string, def: ItemDef, rarity: Rarity, rng: Rng, uid: number, ctx: string[] | CtxPouvoirs = []): Item {
  if (def.familier) return { uid, id, rarity: 'commun', stats: familierStats(def.familier, 1), extra: [], niv: 1, xpF: 0 };   // pas de rareté ni de jet
  const lo = { commun: 0, rare: 0, epique: 0.5, legendaire: 0.7, mythique: 1 }[rarity], hi = { commun: 0.5, rare: 1, epique: 1, legendaire: 1, mythique: 1 }[rarity];
  const stats: Stats = {};
  for (const [k, [a, b]] of Object.entries(def.stats) as [Stat, [number, number]][]) {
    if (a < 0) { stats[k] = a; continue; }
    stats[k] = Math.round(a + (b - a) * (lo + (hi - lo) * rng.next()));
  }
  const extra: Stat[] = [];
  const n = { commun: 0, rare: 1, epique: 2, legendaire: 2, mythique: 2 }[rarity];
  const pool: Stat[] = ['vitalite', 'force', 'intelligence', 'chance', 'agilite', 'sagesse', 'critique', 'prospection', 'vitesse', 'reductionRecharges'];
  for (let i = 0; i < n; i++) {
    const free = pool.filter(s => stats[s] === undefined);
    if (!free.length) break;
    const s = rng.pick(free);
    stats[s] = Math.max(1, Math.round(extraBase(s, def.level) * (rarity === 'mythique' ? 1 : rng.range(0.6, 1))));
    extra.push(s);
  }
  const it: Item = { uid, id, rarity, stats, extra };
  if (rarity === 'legendaire' || rarity === 'mythique') {
    const sortsRecharge = Array.isArray(ctx) ? ctx : ctx.sortsRecharge;
    // Relance éclair seulement si la classe a des sorts à vraie recharge ; la valeur va par demi-seconde (0,5 à 2 s)
    const ids = (Object.keys(LEGENDARY) as LegendaryId[]).filter(k => k !== 'relance' || sortsRecharge.length);
    const fx = (k: LegendaryId): LegendaryFx => k === 'relance'
      ? { id: k, value: Math.max(0.5, Math.round(LEGENDARY[k].max * legendaryPower(def.level) * 2) / 2), sort: rng.pick(sortsRecharge) }
      : { id: k, value: Math.round(LEGENDARY[k].max * legendaryPower(def.level)) };
    const n = rarity === 'mythique' ? 2 : 1;
    if (!Array.isArray(ctx) && ctx.v03) {
      // 0.3 : pouvoirs officiels de la classe sur leur emplacement + pouvoirs maison « toutes classes » (3B)
      const pris = new Set<string>();
      const res = tirerPouvoirs(rng, ctx, def.slot, n).map(t => {
        if ('officiel' in t) return { id: t.officiel, value: 0 };
        const k = rng.pick(ids.filter(x => !pris.has(x))); pris.add(k); return fx(k);
      });
      it.legendary = res[0]; if (res[1]) it.legendary2 = res[1];
    } else {
      const l = rng.pick(ids);
      it.legendary = fx(l);
      if (n === 2) it.legendary2 = fx(rng.pick(ids.filter(k => k !== l)));
    }
  }
  return it;
}

/** Id officiel de la Pépite, la monnaie d'Emp (rangée avec les ressources du sac). */
export const PEPITE = '14635';
/** Pépites rendues par Emp pour un équipement (maquette 0.2, 8A) : selon le niveau et la rareté
 *  (un Commun niveau 20 rend 6 Pépites, un Épique niveau 20 en rend 41, un Légendaire niveau 50 plus de 300). */
export const PEPITE_RARETE: Record<Rarity, number> = { commun: 1, rare: 3, epique: 8, legendaire: 25, mythique: 60 };
export const recycleValue = (def: ItemDef, it: Item) => Math.round(def.level * PEPITE_RARETE[it.rarity] / 4) + 1;
/** Pépites pour une ressource (à l'unité) : une par tranche de 10 niveaux. */
export const recycleResource = (def: ResourceDef) => Math.max(1, Math.floor(def.level / 10));
