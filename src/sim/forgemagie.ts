import FM from '../data/forgemagie.json';
import { extraBase, type Item, type ItemDef, type Rarity, type Stat } from './items';
import type { Rng } from './math';

/** Forgemagie (maquette « Forgemagie : 1A 2A 3B 4B 5A 6A+6D 7A+7B 8A+8B+8D 9B 10A+10C 11B », Mathis 2026-11-07).
 *  Runes et poids officiels (src/data/forgemagie.json, tools/extraction/runes_export.py) ; règles officielles de Dofus (2A) :
 *  succès critique, succès neutre, échec, et le puits de l'objet. Les chances ne sont pas officielles (Dofus ne les publie pas). */
export interface RuneDef { stat: Stat; val: number; poids: number }
export const REGLES_FM = FM;
export const RUNES = FM.runes as Record<string, RuneDef>;
/** Poids officiel d'un point de chaque caractéristique (effectPowerRate) ; une caractéristique sans rune n'est pas forgemageable (5A). */
export const POIDS = FM.poids as Partial<Record<Stat, number>>;

/** Runes d'une caractéristique, de la plus petite à la plus grosse (Fo, Pa Fo, Ra Fo). */
export function runesDe(stat: Stat): string[] {
  return Object.keys(RUNES).filter(id => RUNES[id].stat === stat).sort((a, b) => RUNES[a].val - RUNES[b].val);
}

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
/** 4B : une seule ligne ajoutée, sur un Légendaire ou un Mythique. */
export function exoPossible(def: ItemDef, it: Item, s: Stat): boolean {
  return !aLaLigne(def, it, s) && !it.exo && FM.exo.raretes.includes(it.rarity) && POIDS[s] != null;
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
export interface ResultatFM { issue: Issue; stat: Stat; gain: number; pertes: [Stat, number][]; puits: number }

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
  return { issue, stat: s, gain: issue === 'echec' ? 0 : r.val, pertes, puits };
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
    const w0 = POIDS[s], rs = runesDe(s);
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
  for (const [s, v] of Object.entries(it.stats) as [Stat, number][]) { const w0 = POIDS[s]; if (w0 != null && v > 0 && runesDe(s).length) t += (3 * v * w0 * def.level / 200 + 1) * bonus; }
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
