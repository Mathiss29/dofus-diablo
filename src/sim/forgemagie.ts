import FM from '../data/forgemagie.json';
import { extraBase, rollItem, type Item, type ItemDef, type Rarity, type Stat } from './items';
import type { Rng } from './math';

/** Forgemagie (maquette « Forgemagie : 1A 2A 3B 4B 5A 6A+6D 7A+7B 8A+8B+8D 9B 10A+10C 11B », Mathis 2026-11-07).
 *  Runes et poids officiels (src/data/forgemagie.json, tools/extraction/runes_export.py) ; règles officielles de Dofus (2A) :
 *  succès critique, succès neutre, échec, et le puits de l'objet. Les chances ne sont pas officielles (Dofus ne les publie pas). */
export interface RuneDef { stat: Stat; val: number; poids: number; /** Rune maison (v2 5B) : jamais rendue par le brisage. */ maison?: boolean }
export const REGLES_FM = FM;
export const RUNES = FM.runes as Record<string, RuneDef>;
/** Poids officiel d'un point de chaque caractéristique (effectPowerRate) ; une caractéristique sans rune n'est pas forgemageable (5A). */
export const POIDS = FM.poids as Partial<Record<Stat, number>>;

/** Runes d'une caractéristique, de la plus petite à la plus grosse (Fo, Pa Fo, Ra Fo). */
export function runesDe(stat: Stat): string[] {
  return Object.keys(RUNES).filter(id => RUNES[id].stat === stat).sort((a, b) => RUNES[a].val - RUNES[b].val);
}

/** Runes que rend le brisage : les officielles seulement (v2 5B : les runes maison se gagnent sur les boss). */
const runesBrisage = (stat: Stat) => runesDe(stat).filter(id => !RUNES[id].maison);

/** Jet max d'une ligne : officiel, sinon celui des lignes de rareté ; une ligne ajoutée (exo) est limitée au poids officiel 101 (4B). */
export function ligneMax(def: ItemDef, it: Item, s: Stat): number {
  const off = def.stats[s];
  if (off && off[1] > 0) return off[1];
  const base = Math.max(1, Math.round(extraBase(s, def.level)));
  if (it.exo === s) return Math.max(1, Math.min(base, Math.floor(FM.exo.poidsMax / (POIDS[s] ?? 1))));
  return base;
}
/** Plafond d'une ligne (3B) : le jet max officiel, dépassé selon la rareté (overmax) ; une ligne ajoutée ne dépasse pas son max. */
export function plafond(def: ItemDef, it: Item, s: Stat): number {
  const m = ligneMax(def, it, s);
  if (it.exo === s) return m;
  const o = (FM.overmax as Record<Rarity, number>)[it.rarity] ?? 0;
  return o > 0 ? Math.max(m + 1, Math.floor(m * (1 + o))) : m;
}
/** La ligne existe sur l'objet (une ligne officielle tombée à 0 compte encore : elle peut remonter). */
const aLaLigne = (def: ItemDef, it: Item, s: Stat) => (it.stats[s] ?? 0) > 0 || !!def.stats[s] || it.extra.includes(s) || it.exo === s;
/** 4B puis v2 8B : une seule ligne ajoutée, dès Épique ; PA, PM, Portée et les runes maison (5C) seulement sur un Légendaire ou un Mythique. */
export function exoPossible(def: ItemDef, it: Item, s: Stat): boolean {
  if (aLaLigne(def, it, s) || it.exo || POIDS[s] == null) return false;
  const E = FM.exo;
  return (E.fortes.includes(s) ? E.raretesFortes : E.raretes).includes(it.rarity);
}
/** v2 1A+1E : l'objet a-t-il un exo, une ligne au-dessus de son jet max officiel (over) ? */
export function etatFM(def: ItemDef, it: Item): { exo: boolean; over: Stat[] } {
  const over = (Object.keys(it.stats) as Stat[]).filter(s => s !== it.exo && (it.stats[s] ?? 0) > 0 && POIDS[s] != null && (it.stats[s] ?? 0) > ligneMax(def, it, s));
  return { exo: !!it.exo && (it.stats[it.exo] ?? 0) > 0, over };
}

export type Refus = 'plafond' | 'exo' | 'objet';
/** Chance qu'une rune passe (8B), ou la raison du refus. certain : le puits couvre le poids de la rune. */
export function chanceRune(def: ItemDef, it: Item, runeId: string): { p: number; certain: boolean } | { refus: Refus } {
  const r = RUNES[runeId];
  if (!r || def.familier) return { refus: 'objet' };
  const C = FM.chances, v = it.stats[r.stat] ?? 0;
  const certain = (it.puits ?? 0) >= r.poids;
  if (!aLaLigne(def, it, r.stat)) {
    if (!exoPossible(def, it, r.stat)) return { refus: 'exo' };
    if (r.val > ligneMaxExo(def, r.stat)) return { refus: 'plafond' };
    return { p: certain ? 1 : r.poids >= C.seuilLourde ? C.exoLourde : C.exo, certain };
  }
  const m = ligneMax(def, it, r.stat), cap = plafond(def, it, r.stat);
  if (v + r.val > cap) return { refus: 'plafond' };
  if (certain) return { p: 1, certain };
  if (v + r.val <= m) return { p: Math.max(C.min, C.base - C.pente * v / m), certain };
  return { p: Math.max(C.overmaxMin, C.overmax * (1 - (v - m) / Math.max(1, cap - m))), certain };
}
const ligneMaxExo = (def: ItemDef, s: Stat) => Math.max(1, Math.min(Math.round(extraBase(s, def.level)), Math.floor(FM.exo.poidsMax / (POIDS[s] ?? 1))));

export type Issue = 'critique' | 'neutre' | 'echec' | 'puits';
export interface ResultatFM { issue: Issue; stat: Stat; gain: number; pertes: [Stat, number][]; puits: number; /** v2 9C : la ligne vient de passer au-dessus de son max officiel. */ over: boolean }

/** Retire environ `poids` sur les autres lignes forgemageables de l'objet (jamais les malus ni les lignes sans rune) ; rend le poids perdu. */
function perdre(rng: Rng, it: Item, poids: number, sauf: Stat, pertes: [Stat, number][]): number {
  let perdu = 0;
  for (let essai = 0; perdu < poids && essai < 20; essai++) {
    const autres = (Object.keys(it.stats) as Stat[]).filter(s => s !== sauf && (it.stats[s] ?? 0) > 0 && POIDS[s] != null);
    if (!autres.length) break;
    const s = rng.pick(autres), w = POIDS[s]!, pts = Math.min(it.stats[s]!, Math.max(1, Math.ceil((poids - perdu) / w)));
    it.stats[s]! -= pts; perdu += pts * w;
    const d = pertes.find(x => x[0] === s); if (d) d[1] += pts; else pertes.push([s, pts]);
    if (!it.stats[s]) {   // ligne à 0 : elle disparaît (une ligne officielle peut revenir avec une rune)
      delete it.stats[s];
      if (it.extra.includes(s)) it.extra = it.extra.filter(x => x !== s);
      if (it.exo === s) delete it.exo;
    }
  }
  return Math.round(perdu * 100) / 100;
}

/** Pose une rune sur un objet (2A, règles officielles) : modifie l'objet et rend ce qui s'est passé, ou null si la rune ne peut pas aller dessus. */
export function forger(rng: Rng, def: ItemDef, it: Item, runeId: string): ResultatFM | null {
  const c = chanceRune(def, it, runeId);
  if ('refus' in c) return null;
  const r = RUNES[runeId], s = r.stat, pertes: [Stat, number][] = [];
  const monter = () => {
    if (!aLaLigne(def, it, s)) it.exo = s;
    it.stats[s] = (it.stats[s] ?? 0) + r.val;
  };
  const avant = it.stats[s] ?? 0;
  let puits = it.puits ?? 0, issue: Issue;
  if (c.certain) {   // le puits couvre la rune : elle passe, le puits paie
    monter(); puits -= r.poids; issue = 'puits';
  } else if (rng.next() < c.p) {
    const sous = (it.stats[s] ?? 0) + r.val <= ligneMax(def, it, s);
    monter();
    if (rng.next() < (sous ? FM.critique.sousMax : FM.critique.overmax)) issue = 'critique';
    else {   // succès neutre : la rune coûte son poids, payé d'abord par le puits, sinon par une autre ligne
      issue = 'neutre';
      const pris = Math.min(puits, r.poids); puits -= pris;
      if (pris < r.poids) { const perdu = perdre(rng, it, r.poids - pris, s, pertes); puits += Math.max(0, perdu - (r.poids - pris)); }
    }
  } else {   // échec : d'autres lignes perdent du poids, qui va dans le puits
    issue = 'echec';
    puits += perdre(rng, it, r.poids * (FM.echec.min + (FM.echec.max - FM.echec.min) * rng.next()), s, pertes);
  }
  puits = Math.round(puits * 100) / 100;
  if (puits > 0) it.puits = puits; else delete it.puits;
  it.fm = (it.fm ?? 0) + 1;
  const m = ligneMax(def, it, s), over = issue !== 'echec' && it.exo !== s && avant <= m && (it.stats[s] ?? 0) > m;
  return { issue, stat: s, gain: issue === 'echec' ? 0 : r.val, pertes, puits, over };
}

/** Coût d'un essai en kamas (9B), plus la commission du forgemage en mode « viser » (8D). */
export function coutKamas(def: ItemDef, runeId: string, viser = false): number {
  const r = RUNES[runeId]; if (!r) return 0;
  const k = Math.max(1, Math.round(def.level * r.poids * FM.kamas.parPoids));
  return viser ? k + Math.max(1, Math.round(k * FM.kamas.commission)) : k;
}

/** Brisage (7A+7B) : runes rendues par un objet. Par ligne, poids = 3 × jet × poids × niveau ÷ 200 + 1 (officiel) × bonus de rareté,
 *  converti en runes du palier le plus gros au plus petit ; le reste donne une petite rune au hasard (au prorata). */
export function briser(rng: Rng, def: ItemDef, it: Item): Record<string, number> {
  const gains: Record<string, number> = {}, bonus = (FM.brisage.rarete as Record<Rarity, number>)[it.rarity] ?? 1;
  const add = (id: string, n = 1) => { gains[id] = (gains[id] ?? 0) + n; };
  for (const [s, v] of Object.entries(it.stats) as [Stat, number][]) {
    const w0 = POIDS[s], rs = runesBrisage(s);
    if (w0 == null || v <= 0 || !rs.length) continue;
    let w = (3 * v * w0 * def.level / 200 + 1) * bonus;
    for (const id of [...rs].reverse()) { const n = Math.floor(w / RUNES[id].poids + 1e-9); if (n > 0) { add(id, n); w -= n * RUNES[id].poids; } }
    if (w > 0 && rng.next() < w / RUNES[rs[0]].poids) add(rs[0]);
  }
  return gains;
}
/** Aperçu sans hasard (poids total rendu) pour l'infobulle. */
export function poidsBrisage(def: ItemDef, it: Item): number {
  const bonus = (FM.brisage.rarete as Record<Rarity, number>)[it.rarity] ?? 1;
  let t = 0;
  for (const [s, v] of Object.entries(it.stats) as [Stat, number][]) { const w0 = POIDS[s]; if (w0 != null && v > 0 && runesBrisage(s).length) t += (3 * v * w0 * def.level / 200 + 1) * bonus; }
  return Math.round(t * 10) / 10;
}

/** Fusion (6D) : la rune du palier suivant (Fo -> Pa Fo -> Ra Fo), ou null pour la plus grosse. */
export function fusionVers(runeId: string): string | null {
  const r = RUNES[runeId]; if (!r) return null;
  const l = runesDe(r.stat), i = l.indexOf(runeId);
  return i >= 0 && i < l.length - 1 ? l[i + 1] : null;
}
export const FUSION_N = FM.fusion.n;

/** Caractéristiques d'un objet sous forme de lignes (pour la fenêtre) : valeur, max, plafond. */
export function lignes(def: ItemDef, it: Item): { s: Stat; v: number; max: number; cap: number; rune: boolean; extra: boolean; exo: boolean }[] {
  const ss = new Set<Stat>([...(Object.keys(def.stats) as Stat[]).filter(s => (def.stats[s]?.[1] ?? 0) > 0), ...(Object.keys(it.stats) as Stat[])]);
  return [...ss].filter(s => (it.stats[s] ?? 0) >= 0).map(s => ({
    s, v: it.stats[s] ?? 0, max: ligneMax(def, it, s), cap: plafond(def, it, s), rune: POIDS[s] != null && runesDe(s).length > 0,
    extra: it.extra.includes(s), exo: it.exo === s,
  }));
}
/** Somme des runes gagnées (pour les messages). */
export const totalRunes = (g: Record<string, number>) => Object.values(g).reduce((a, b) => a + b, 0);

// --- Commande à Malek (maquette « Forgemagie UI » 9A+9B+9C+9D+9E, Mathis 2026-11-08) -----------------------------------------
/** Ce que le joueur demande : une valeur par ligne (9A), un plancher par ligne protégée (9C) et un budget en kamas (9B). */
export interface Commande { objectifs: Partial<Record<Stat, number>>; planchers: Partial<Record<Stat, number>>; budget: number }
/** Pourquoi Malek s'arrête : objectifs atteints, ligne protégée sous son plancher, budget, ou plus de rune utile. */
export type FinCommande = 'ok' | 'plancher' | 'budget' | 'runes';
export interface RapportCommande { essais: number; kamas: number; fin: FinCommande; finStat?: Stat; runes: Record<string, number>; issues: Partial<Record<Issue, number>> }
/** Commande confiée (9E) : l'objet chez Malek, le temps qu'il reste, et ce qu'il a fait. */
export interface CommandeFM { item: Item; reste: number; total: number; rapport: RapportCommande; avant: Partial<Record<Stat, number>>; prete?: boolean }
export const REGLES_COMMANDE = FM.commande;

/** Prochaine rune de Malek : la ligne la plus en retard sur son objectif, la plus grosse rune qui ne dépasse pas l'écart
 *  (sinon la plus petite qui passe). null : plus rien d'utile dans le stock. */
export function runeCommande(def: ItemDef, it: Item, stock: Record<string, number>, cmd: Commande): string | null {
  const manque = (Object.keys(cmd.objectifs) as Stat[]).filter(s => (it.stats[s] ?? 0) < (cmd.objectifs[s] ?? 0))
    .sort((a, b) => (it.stats[a] ?? 0) / cmd.objectifs[a]! - (it.stats[b] ?? 0) / cmd.objectifs[b]!);
  for (const s of manque) {
    const ecart = cmd.objectifs[s]! - (it.stats[s] ?? 0);
    const ok = runesDe(s).filter(id => (stock[id] ?? 0) > 0 && !('refus' in chanceRune(def, it, id)));
    const r = [...ok].reverse().find(id => RUNES[id].val <= ecart) ?? ok[0];
    if (r) return r;
  }
  return null;
}

/** Malek exécute la commande sur l'objet (modifié) avec les runes du stock (modifié) et au plus `kamas` kamas, commission comprise. */
export function executerCommande(rng: Rng, def: ItemDef, it: Item, stock: Record<string, number>, kamas: number, cmd0: Commande): RapportCommande {
  // un objectif au-dessus du plafond de la ligne (overmax compris) est ramené au plafond
  const cmd: Commande = { ...cmd0, objectifs: Object.fromEntries((Object.keys(cmd0.objectifs) as Stat[]).map(s => [s, Math.min(cmd0.objectifs[s]!, plafond(def, it, s))])) };
  const R: RapportCommande = { essais: 0, kamas: 0, fin: 'ok', runes: {}, issues: {} }, budget = Math.min(kamas, cmd.budget);
  for (let i = 0; i < FM.commande.essaisMax; i++) {
    const casse = (Object.keys(cmd.planchers) as Stat[]).find(s => (cmd.planchers[s] ?? 0) > 0 && (it.stats[s] ?? 0) < cmd.planchers[s]!);
    if (casse) { R.fin = 'plancher'; R.finStat = casse; return R; }
    if (!(Object.keys(cmd.objectifs) as Stat[]).some(s => (it.stats[s] ?? 0) < (cmd.objectifs[s] ?? 0))) { R.fin = 'ok'; return R; }
    const r = runeCommande(def, it, stock, cmd);
    if (!r) { R.fin = 'runes'; return R; }
    const k = coutKamas(def, r, true);
    if (R.kamas + k > budget) { R.fin = 'budget'; return R; }
    const res = forger(rng, def, it, r);
    if (!res) { R.fin = 'runes'; return R; }
    R.kamas += k; R.essais++;
    stock[r]--; R.runes[r] = (R.runes[r] ?? 0) + 1;
    R.issues[res.issue] = (R.issues[res.issue] ?? 0) + 1;
  }
  R.fin = 'budget';
  return R;
}

export interface Estimation { reussite: number; kamas: number; runes: number; fins: Partial<Record<FinCommande, number>> }
/** 9D : Malek simule la commande `n` fois sur des copies (rien ne change) : chance de tout atteindre, kamas et runes moyens. */
export function estimerCommande(rng: Rng, def: ItemDef, it: Item, stock: Record<string, number>, kamas: number, cmd: Commande, n = FM.commande.simulations): Estimation {
  const E: Estimation = { reussite: 0, kamas: 0, runes: 0, fins: {} }, base = JSON.stringify(it);
  for (let i = 0; i < n; i++) {
    const r = executerCommande(rng, def, JSON.parse(base) as Item, { ...stock }, kamas, cmd);
    if (r.fin === 'ok') E.reussite++;
    E.kamas += r.kamas; E.runes += r.essais; E.fins[r.fin] = (E.fins[r.fin] ?? 0) + 1;
  }
  E.reussite /= n; E.kamas = Math.round(E.kamas / n); E.runes = Math.round(E.runes / n * 10) / 10;
  for (const f of Object.keys(E.fins) as FinCommande[]) E.fins[f]! /= n;
  return E;
}
/** Temps de travail de Malek (9E) : quelques secondes par rune posée, entre un minimum et un maximum. */
export const dureeCommande = (essais: number, test = false) =>
  test ? FM.commande.test : Math.max(FM.commande.min, Math.min(FM.commande.max, essais * FM.commande.parRune));

/** Aperçu du brisage (8A, façon Concasseur) : runes sûres de chaque objet (sans le petit reste au hasard). */
export function apercuBrisage(def: ItemDef, it: Item): Record<string, number> {
  const gains: Record<string, number> = {}, bonus = (FM.brisage.rarete as Record<Rarity, number>)[it.rarity] ?? 1;
  for (const [s, v] of Object.entries(it.stats) as [Stat, number][]) {
    const w0 = POIDS[s], rs = runesBrisage(s);
    if (w0 == null || v <= 0 || !rs.length) continue;
    let w = (3 * v * w0 * def.level / 200 + 1) * bonus;
    for (const id of [...rs].reverse()) { const n = Math.floor(w / RUNES[id].poids + 1e-9); if (n > 0) { gains[id] = (gains[id] ?? 0) + n; w -= n * RUNES[id].poids; } }
  }
  return gains;
}
export const SIGNATURE = FM.signature;

// --- Forgemagie v2 (maquette « Forgemagie v2 », Mathis 2026-11-12) ------------------------------------------------------------------
export const REGLES_V2 = { rafale: FM.rafale, orbes: FM.orbes, relance: FM.relance, potions: FM.potions, maison: FM.maison };

/** 7A : un Orbe régénérant officiel peut-il relancer cet objet (niveau d'objet au plus `orbe`) ? */
export const orbeConvient = (def: ItemDef, orbe: number) => !def.familier && def.level <= orbe;
/** 7A : relance tous les jets de l'objet dans sa rareté (lignes officielles et lignes de rareté) ; les pouvoirs légendaires,
 *  la signature et le cadenas restent ; le puits, l'exo et la relance de ligne repartent de zéro. */
export function regenerer(rng: Rng, def: ItemDef, it: Item, id: string): void {
  const neuf = rollItem(id, def, it.rarity, rng, it.uid, []);
  it.stats = neuf.stats; it.extra = neuf.extra;
  delete it.puits; delete it.exo; delete it.relances;
}

/** 7B : lignes que Malek peut relancer (pas un exo, pas un malus, pas une ligne déjà à son max ou au-dessus). */
export function lignesRelancables(def: ItemDef, it: Item): Stat[] {
  return (Object.keys(it.stats) as Stat[]).filter(s => s !== it.exo && (it.stats[s] ?? 0) > 0 && (def.stats[s]?.[0] ?? 0) >= 0
    && (it.stats[s] ?? 0) < ligneMax(def, it, s));
}
/** 7B : prix d'une relance (niveau × kamasParNiveau, doublé à chaque relance sur le même objet). */
export const coutRelance = (def: ItemDef, it: Item) => Math.round(Math.max(1, def.level) * FM.relance.kamasParNiveau * 2 ** (it.relances ?? 0));
/** 7B : un jet de la ligne, dans la fourchette de sa rareté (comme au butin). */
function jetLigne(rng: Rng, def: ItemDef, it: Item, s: Stat): number {
  const off = def.stats[s];
  if (off && off[1] > 0) {
    const lo = { commun: 0, rare: 0, epique: 0.5, legendaire: 0.7, mythique: 1 }[it.rarity], hi = { commun: 0.5, rare: 1, epique: 1, legendaire: 1, mythique: 1 }[it.rarity];
    return Math.round(off[0] + (off[1] - off[0]) * (lo + (hi - lo) * rng.next()));
  }
  return Math.max(1, Math.round(extraBase(s, def.level) * (it.rarity === 'mythique' ? 1 : 0.6 + 0.4 * rng.next())));
}
/** 7B : Malek tire deux jets et garde le meilleur, jamais moins que la valeur actuelle. Rend les deux jets et la valeur gardée. */
export function relancerLigne(rng: Rng, def: ItemDef, it: Item, s: Stat): { jets: [number, number]; avant: number; apres: number } | null {
  if (!lignesRelancables(def, it).includes(s)) return null;
  const jets: [number, number] = [jetLigne(rng, def, it, s), jetLigne(rng, def, it, s)], avant = it.stats[s] ?? 0;
  const apres = Math.min(ligneMax(def, it, s), Math.max(avant, ...jets));
  it.stats[s] = apres; it.relances = (it.relances ?? 0) + 1;
  return { jets, avant, apres };
}

/** 6A : la potion peut-elle aller sur cet objet (une arme qui a des dommages neutres) ? */
export const potionConvient = (def: ItemDef) => !!def.weapon?.dmg.some(d => d.element === 'neutre');
/** 6A : dommages de l'arme, potion de forgemagie comprise (les lignes neutres prennent l'élément, avec la perte officielle « forte » ou « faible »). */
export function dmgArme(def: ItemDef, it?: Item | null): { element: string; min: number; max: number }[] {
  const w = def.weapon?.dmg ?? [], P = it?.potion ? POTIONS[it.potion] : undefined;
  if (!P) return w;
  const k = 1 - P.perte;
  return w.map(d => d.element === 'neutre' ? { element: P.element, min: Math.max(1, Math.round(d.min * k)), max: Math.max(1, Math.round(d.max * k)) } : d);
}
/** Potions de forgemagie : id -> élément et perte (rempli par setPotions, depuis items.json). */
export const POTIONS: Record<string, { element: string; perte: number }> = {};
export function setPotions(res: Record<string, { level: number; potionFM?: string }>) {
  for (const [id, r] of Object.entries(res)) if (r.potionFM)
    POTIONS[id] = { element: r.potionFM, perte: r.level >= FM.potions.niveauForte ? FM.potions.perteForte : FM.potions.perteFaible };
}
