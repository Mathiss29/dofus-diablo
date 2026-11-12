import BUTIN from '../data/butin.json';
import type { GameData, MonsterDef, ZoneDef } from './defs';
import { niveauObjetsMax, type CtxPouvoirs } from './pouvoirs';
import { rollItem, type DropDef, type Item, type ItemsData, type Rarity } from './items';
import type { Rng } from './math';

/** Butin des monstres (maquette « Drops », Mathis 2026-11-07 : 5A+5C, 6B, 1A+1B+1C, 8B).
 *  Un seul calcul pour le jeu (World.dropLoot), le Bestiaire (B), la fiche « Où le trouver » et l'outil de test (F1) :
 *  ce qui est affiché est exactement ce qui est tiré. Réglages dans src/data/butin.json. */
export const REGLAGES_BUTIN = BUTIN;
export type Rang = 'normal' | 'elite' | 'boss';
export const rangDe = (d: Pick<MonsterDef, 'boss' | 'elite'>): Rang => d.boss ? 'boss' : d.elite ? 'elite' : 'normal';

/** Multiplicateur des chances de butin selon la Prospection (+1 % par point). */
export const coefProspection = (pros: number) => 1 + Math.max(0, pros) / BUTIN.prospection.chances;
/** Multiplicateur des raretés Rare et mieux selon la Prospection (+1 % par 2 points). */
export const coefRaretes = (pros: number) => 1 + Math.max(0, pros) / BUTIN.prospection.raretes;

/** Part d'objets Légendaires ou Mythiques parmi les objets tirés, réglée pour qu'un monstre de ce rang en lâche un
 *  sur « legendaireParMonstre » (5A), sans Prospection et sans compter les équipements de son butin officiel. */
export function partLegendaire(rang: Rang): number {
  const e = BUTIN.equipement[rang], cible = 1 / BUTIN.legendaireParMonstre[rang];
  const c = Math.min(1, e.chance);
  return c > 0 ? Math.min(1, (1 - Math.pow(1 - cible, 1 / e.tirages)) / c) : 0;
}

export type Raretes = Record<Rarity, number>;
/** Chances de chaque rareté pour un objet tiré (parts de 1, total 1). */
export function raretes(rang: Rang, pros = 0, coefLeg = 1): Raretes {
  const p = coefRaretes(pros), r = BUTIN.raretes[rang];
  const leg = Math.min(1, partLegendaire(rang) * p * coefLeg), myth = leg / BUTIN.mythiqueParLegendaire;
  const epique = Math.min(1 - leg, r.epique / 100 * p), rare = Math.min(1 - leg - epique, r.rare / 100 * p);
  return { mythique: myth, legendaire: leg - myth, epique, rare, commun: Math.max(0, 1 - leg - epique - rare) };
}
/** Tire une rareté (true = boss, false = monstre normal, pour les appels d'avant les rangs). */
export function rollRarity(rng: Rng, rang: Rang | boolean, pros = 0, coefLeg = 1): Rarity {
  const t = raretes(typeof rang === 'boolean' ? (rang ? 'boss' : 'normal') : rang, pros, coefLeg);
  let r = rng.next();
  for (const k of ['mythique', 'legendaire', 'epique', 'rare'] as const) { if (r < t[k]) return k; r -= t[k]; }
  return 'commun';
}

/** Chance réelle (part de 1) d'une ligne du butin officiel : chance de Dofus × coefficient de butin.json × Prospection. */
export function chanceLigne(d: DropDef, items: ItemsData, pros = 0, rang: Rang = 'normal'): number {
  const R = BUTIN.ressources;
  // les boss gardent les taux de Dofus : on en tue peu, et leurs ressources à 100 % sont des trophées
  const coef = items.equipment[d.item] ? BUTIN.equipementsOfficiels.coef : rang === 'boss' ? 1 : d.chance >= R.seuil ? R.communes : R.rares;
  return Math.min(1, d.chance / 100 * coef * coefProspection(pros));
}

/** Ce qu'il faut savoir du joueur et du monstre pour tirer ou afficher un butin. */
export interface CtxButin {
  type: string; rang: Rang; niveau: number; prospection: number; items: ItemsData;
  /** Familiers de la famille du monstre (id d'équipement). */
  familiers: string[];
  /** Équipements de la zone (poolOfficiel) et leur niveau, pour l'équipement aléatoire. */
  pool: { id: string; level: number }[];
  /** Pièces des panoplies du boss (panoDuBoss, 0.4 suite 1C) : la moitié de ses tirages y est prise. */
  panoBoss?: { id: string; level: number }[];
  /** Ceux de tout le jeu : pris quand la zone en a trop peu à ce niveau (Enfers, Havre-Sac, bas de niveau…). */
  poolSecours?: { id: string; level: number }[];
  /** Niveau du joueur dans ce métier (clé de ITEMS.metiers). */
  metierNiveau: (job: string) => number;
  armeChasse: boolean;
  /** Un événement est en cours : ses objets officiels peuvent tomber (6B ; aucun pour l'instant). */
  evenement?: boolean;
  /** Tirage des pouvoirs légendaires (classe, sorts connus ; anciens pouvoirs seuls si absent). */
  pouvoirs?: CtxPouvoirs;
  /** « Apparats : » 17F : chance de légendaire multipliée (abonnement Légende). */
  legendaire?: number;
}
/** État d'une ligne : tombe, ne tombe que pendant un événement ou une quête (6B), ou demande un métier qu'on n'a pas. */
export type EtatLigne = 'ok' | 'evenement' | 'quete' | 'metier';
export const metierDe = (d: DropDef, items: ItemsData) => d.metier ? Object.entries(items.metiers ?? {}).find(([, j]) => j.id === d.metier!.id)?.[0] : undefined;
/** Équipement d'une version pas encore sortie (26-40 : 0.3 ; 41-60 : 0.4) : ni tiré ni affiché avant (partie de test d'ici là). */
const avant03 = (d: DropDef, ctx: CtxButin) => (ctx.items.equipment[d.item]?.level ?? 0) > niveauObjetsMax(!!ctx.pouvoirs?.v03, ctx.pouvoirs?.v04);
export function etatLigne(d: DropDef, ctx: CtxButin): EtatLigne {
  if (d.cond === 'quete') return 'quete';   // nos quêtes sont les nôtres (règle Quêtes) : ces objets de quête de Dofus ne tombent pas
  if (d.cond === 'evenement' && !ctx.evenement) return 'evenement';
  if (d.metier) {
    const job = metierDe(d, ctx.items);
    if (!job || ctx.metierNiveau(job) < d.metier.min || (d.chasse && !ctx.armeChasse)) return 'metier';
  }
  return 'ok';
}
/** Équipements possibles pour l'équipement aléatoire (niveau du monstre −4 à +6) : ceux de la zone, ou ceux de tout le jeu
 *  si la zone en a moins de « minZone » à ce niveau. */
export function poolNiveau(ctx: Pick<CtxButin, 'pool' | 'niveau' | 'poolSecours'>) {
  const [a, b] = BUTIN.equipement.niveaux;
  const dans = (p: { id: string; level: number }[]) => p.filter(e => e.level >= ctx.niveau + a && e.level <= ctx.niveau + b);
  const zone = dans(ctx.pool);
  return zone.length >= BUTIN.equipement.minZone || !ctx.poolSecours ? zone : dans(ctx.poolSecours);
}

/** Monstres d'une zone : sous-zones, élites et donjons d'un monde ouvert, ou vagues d'une arène. */
export function monstresDeZone(z: ZoneDef): string[] {
  const out = new Set<string>(), o = z.open, w = z.waves;
  for (const s of Object.values(o?.subareas ?? {})) { for (const m of s.monsters) out.add(m); if (s.elite) out.add(s.elite); }
  for (const d of o?.donjons ?? []) for (const g of Object.values(d.salles)) for (const x of g.flat()) out.add(x);
  if (w) for (const m of [...w.pack.map(p => p.monster), w.boss, ...w.escort.monsters, ...w.archimonstres.monsters]) out.add(m);
  return [...out];
}
/** Équipement aléatoire (choix de Mathis 2026-11-09) : seulement des objets officiels liés aux monstres donnés,
 *  ceux de leur butin dans Dofus et ceux qu'on fabrique avec leurs ressources. Jamais d'objet de maître du jeu. */
export function poolOfficiel(items: ItemsData, monstres: Iterable<string>): { id: string; level: number }[] {
  const ids = new Set<string>(), res = new Set<string>();
  for (const m of monstres) for (const d of items.drops[m] ?? []) {
    if (d.cond === 'quete' || d.cond === 'evenement') continue;
    (items.equipment[d.item] ? ids : res).add(d.item);
  }
  for (const r of items.recipes ?? []) if (items.equipment[r.result] && r.ingredients.some(([i]) => res.has(String(i)))) ids.add(r.result);
  return [...ids].filter(id => { const d = items.equipment[id]; return d && !d.familier && !d.horsJeu; }).sort().map(id => ({ id, level: items.equipment[id].level }));
}
/** Panoplies d'un boss (0.4 suite 1C) : celles dont il lâche une pièce, ou dont une pièce se fabrique avec une ressource
 *  que lui seul lâche (Bworkette, Craqueleur Légendaire… n'ont pas de pièce dans leur butin, leurs panoplies se fabriquent).
 *  Seulement les panoplies dont au moins 2 pièces, et la moitié, lui sont liées (pas une ressource commune à 20 recettes).
 *  Toutes les pièces de ces panoplies, jamais d'objet de maître du jeu. */
export function panoDuBoss(items: ItemsData, boss: string): { id: string; level: number }[] {
  const lache = (items.drops[boss] ?? []).filter(d => d.cond !== 'quete' && d.cond !== 'evenement').map(d => d.item);
  const autres = new Set<string>();
  for (const [m, l] of Object.entries(items.drops)) if (m !== boss) for (const d of l) autres.add(d.item);
  const siennes = new Set(lache.filter(i => !items.equipment[i] && !autres.has(i)));
  const pieces = new Set(lache.filter(i => items.equipment[i]));
  for (const r of items.recipes ?? []) if (items.equipment[r.result] && r.ingredients.some(([i]) => siennes.has(String(i)))) pieces.add(r.result);
  const n = new Map<number, number>();
  for (const i of pieces) { const s = items.equipment[i].set; if (s) n.set(s, (n.get(s) ?? 0) + 1); }
  const sets = [...n].filter(([s, k]) => k >= 2 && k * 2 >= (items.sets[String(s)]?.items.length ?? 99)).map(([s]) => s);
  const ids = new Set<string>();
  for (const s of sets) for (const i of items.sets[String(s)]?.items ?? []) if (items.equipment[String(i)]) ids.add(String(i));
  return [...ids].filter(id => { const d = items.equipment[id]; return !d.familier && !d.horsJeu; }).sort().map(id => ({ id, level: items.equipment[id].level }));
}
export const kamasDe = (rang: Rang) => ({ chance: rang === 'normal' ? BUTIN.kamas.chance : 1, mult: BUTIN.kamas.mult[rang] });

export interface Butin {
  /** Ressources gagnées (une entrée par unité), et le métier qui gagne de l'XP pour chacune (viandes). */
  ressources: { id: string; job?: string }[];
  objets: Item[];
  kamas: number;
  /** « Apparats : » 1B 1D : apparats tombés (id Dofus). */
  apparats?: string[];
}
/** Tire le butin d'un monstre vaincu. Sert au jeu et au simulateur de l'outil de test (8B). */
export function tirerButin(rng: Rng, ctx: CtxButin, uid: () => number): Butin {
  const I = ctx.items, pros = ctx.prospection, more = coefProspection(pros), out: Butin = { ressources: [], objets: [], kamas: 0 };
  for (const d of I.drops[ctx.type] ?? []) {
    if (etatLigne(d, ctx) !== 'ok') continue;
    if (rng.next() >= chanceLigne(d, I, pros, ctx.rang)) continue;
    if (avant03(d, ctx)) continue;
    if (I.equipment[d.item]) out.objets.push(rollItem(d.item, I.equipment[d.item], rollRarity(rng, ctx.rang, pros, ctx.legendaire), rng, uid(), ctx.pouvoirs));
    else out.ressources.push({ id: d.item, job: metierDe(d, I) });
  }
  // familier de la famille du monstre (Familiers 1A)
  for (const id of ctx.familiers)
    if (rng.next() < Math.min(1, more / BUTIN.familier[ctx.rang])) out.objets.push(rollItem(id, I.equipment[id], 'commun', rng, uid()));
  const e = BUTIN.equipement[ctx.rang], pool = poolNiveau(ctx);
  for (let k = 0; k < e.tirages; k++) {
    if (rng.next() >= Math.min(1, e.chance * more) || !pool.length) continue;
    const pano = ctx.rang === 'boss' && ctx.panoBoss?.length && rng.next() < BUTIN.equipement.panoBoss ? ctx.panoBoss : null;
    const id = rng.pick(pano ?? pool).id;
    out.objets.push(rollItem(id, I.equipment[id], rollRarity(rng, ctx.rang, pros, ctx.legendaire), rng, uid(), ctx.pouvoirs));
  }
  // kamas : un petit tas de pièces, plus gros pour les élites et les boss
  const K = kamasDe(ctx.rang);
  if (ctx.rang !== 'normal' || rng.next() < K.chance)
    out.kamas = Math.max(1, Math.round(ctx.niveau * rng.range(BUTIN.kamas.min, BUTIN.kamas.max) * K.mult * more));
  return out;
}

/** Une ligne du tableau de butin : la ligne officielle, son état et sa chance réelle. */
export interface LigneButin { d: DropDef; etat: EtatLigne; chance: number; equipement: boolean }
export interface TableButin {
  officiel: LigneButin[];
  equipement: { chance: number; tirages: number; min: number; max: number; nb: number };
  raretes: Raretes;
  /** Légendaire ou Mythique par monstre vaincu (équipements officiels compris). */
  legendaire: number;
  familiers: { id: string; chance: number }[];
  kamas: { chance: number; min: number; max: number };
}
/** Le butin d'un monstre tel que le joueur le verra tomber (Bestiaire 2B+2C, 4A ; outil de test). */
export function tableButin(ctx: CtxButin): TableButin {
  const I = ctx.items, pros = ctx.prospection, more = coefProspection(pros);
  const officiel = (I.drops[ctx.type] ?? []).filter(d => !avant03(d, ctx)).map(d => ({ d, etat: etatLigne(d, ctx), chance: chanceLigne(d, I, pros, ctx.rang), equipement: !!I.equipment[d.item] }))
    .sort((a, b) => b.d.chance - a.d.chance);
  const R = raretes(ctx.rang, pros, ctx.legendaire), leg = R.legendaire + R.mythique, e = BUTIN.equipement[ctx.rang], pool = poolNiveau(ctx);
  const c = pool.length ? Math.min(1, e.chance * more) : 0;
  let aucun = Math.pow(1 - c * leg, e.tirages);
  for (const l of officiel) if (l.equipement && l.etat === 'ok') aucun *= 1 - l.chance * leg;
  const [a, b] = BUTIN.equipement.niveaux, K = kamasDe(ctx.rang);
  return {
    officiel, raretes: R, legendaire: 1 - aucun,
    equipement: { chance: c, tirages: e.tirages, min: ctx.niveau + a, max: ctx.niveau + b, nb: pool.length },
    familiers: ctx.familiers.map(id => ({ id, chance: Math.min(1, more / BUTIN.familier[ctx.rang]) })),
    kamas: { chance: K.chance, min: Math.max(1, Math.round(ctx.niveau * BUTIN.kamas.min * K.mult * more)), max: Math.round(ctx.niveau * BUTIN.kamas.max * K.mult * more) },
  };
}

/** Où vit un monstre : zone, sous-zone (ou donjon) et niveau de la sous-zone (celui de ses monstres en jeu). */
export interface Lieu { zone: string; nom: string; niveau: number; donjon?: boolean }
export function lieuxDe(type: string, data: GameData): Lieu[] {
  const out: Lieu[] = [];
  for (const [zid, z] of Object.entries(data.zones)) {
    const o = z.open;
    if (!o) {
      const w = z.waves;
      if (w && (w.pack.some(p => p.monster === type) || w.boss === type || w.escort.monsters.includes(type) || w.archimonstres.monsters.includes(type)))
        out.push({ zone: zid, nom: `${z.name} (vagues)`, niveau: z.level });
      continue;
    }
    const subs = Object.values(o.subareas);
    for (const s of subs) if (s.monsters.includes(type) || s.elite === type) out.push({ zone: zid, nom: s.name, niveau: s.level });
    for (const d of o.donjons ?? [])
      if (Object.values(d.salles).some(g => g.some(x => x.includes(type))))
        out.push({ zone: zid, nom: d.nom, niveau: subs.find(s => s.name === d.nom)?.level ?? z.level, donjon: true });
  }
  return out;
}
/** Niveau d'un monstre hors partie (Bestiaire, outil de test) : celui de la sous-zone où on le croise le plus bas, sinon celui de Dofus. */
export function niveauHorsPartie(type: string, data: GameData): number {
  const l = lieuxDe(type, data);
  return l.length ? Math.min(...l.map(x => x.niveau)) : data.monsters[type]?.level ?? 1;
}

/** D'où vient un objet (fiche « Où le trouver », 7A+7B+7C+7D). */
export interface Source { k: 'monstre' | 'recolte' | 'recette' | 'boutique'; nom: string; detail: string; cle?: string; chance?: number; etat?: EtatLigne }

/** Anomalies du butin (8C) : montrées en rouge dans l'outil de test et vérifiées par tests/butin.test.ts. */
export interface Anomalie { k: 'zero' | 'inconnu' | 'sansButin'; monstre: string; item?: string }
export function anomaliesButin(items: ItemsData, data: GameData): Anomalie[] {
  const out: Anomalie[] = [];
  for (const m of Object.keys(data.monsters)) if (!(m in items.drops)) out.push({ k: 'sansButin', monstre: m });
  for (const [m, l] of Object.entries(items.drops)) for (const d of l) {
    if (!(d.chance > 0)) out.push({ k: 'zero', monstre: m, item: d.item });
    if (!items.equipment[d.item] && !items.resources[d.item]) out.push({ k: 'inconnu', monstre: m, item: d.item });
  }
  return out;
}
