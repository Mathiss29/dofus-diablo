import { BONUS_FAB } from './artisans';
import type { ItemDef, ItemsData, Slot, Stat } from './items';
import { extraBase } from './items';

/** Travailler le butin (maquette « Des métiers qui servent vraiment », ligne « Métiers : » 2A + 2C + 3B + 3D, 2026-11-13).
 *  - 2A chef-d'œuvre : 4 paliers, chacun monte tous les jets de l'objet de 5 %. Le métier de l'emplacement fait le travail, avec les
 *    ressources liées à l'objet (sa recette, ou le butin des monstres qui le lâchent), plus une ressource de boss au 4e palier.
 *  - 2C châsse : le Mineur perce l'objet (minerai de son niveau), le Bijoutier y sertit une pierre précieuse officielle (Rubis,
 *    Saphir, Émeraude, Diamant, Cristal) qui donne un petit bonus ; on la remplace quand on veut (l'ancienne est perdue).
 *  - 3D panoplies d'artisan : les panoplies officielles dont aucune pièce ne tombe des monstres ne se trouvent qu'à l'atelier. */
export const OEUVRE = {
  paliers: 4,
  /** +5 % sur tous les jets positifs par palier. */
  parPalier: 0.05,
  /** Niveau du métier requis : 15 par palier (15, 30, 45, 60). */
  niveauParPalier: 15,
  /** Ressources liées : quantité par palier, et kamas par niveau d'objet et par palier. */
  quantite: 5, kamas: 20,
  /** XP de métier par palier. */
  xp: 150,
};
export const CHASSE = {
  /** Minerai pour percer, selon le niveau de l'objet (et niveau de Mineur requis = niveau du minerai). */
  minerais: [[60, '443'], [40, '442'], [20, '441'], [1, '312']] as [number, string][],
  quantite: 5, kamas: 10, xp: 80,
  /** Bonus d'une pierre : la moitié d'une ligne de rareté au niveau de l'objet. */
  part: 0.5,
  /** Une récolte de Mineur peut donner une pierre précieuse (dorée : bien plus souvent). */
  pierreRecolte: 0.02, pierreDoree: 0.25,
};
/** Pierres précieuses officielles -> caractéristique qu'elles donnent serties. */
export const PIERRES: Record<string, Stat> = { '547': 'intelligence', '546': 'chance', '544': 'agilite', '543': 'force', '545': 'vitalite' };

const versEquip = (s: Slot) => s === 'anneau' ? 'anneau1' : s;
/** 2A : métiers qui peuvent faire d'un objet de cet emplacement un chef-d'œuvre. */
export const metiersOeuvre = (slot: Slot) => Object.keys(BONUS_FAB).filter(m => BONUS_FAB[m].includes(versEquip(slot)));
export const niveauOeuvre = (palier: number) => palier * OEUVRE.niveauParPalier;
/** Multiplicateur des jets positifs d'un objet travaillé. */
export const coefOeuvre = (palier = 0) => OEUVRE.parPalier * Math.max(0, Math.min(OEUVRE.paliers, palier));

const res = (items: ItemsData, id: string) => !!items.resources[id] && !items.equipment[id];
/** Les 2 ressources liées à un objet : celles de sa recette (les plus nombreuses), sinon celles des monstres qui le lâchent. */
export function ressourcesOeuvre(items: ItemsData, id: string): string[] {
  const r = items.recipes?.find(x => x.result === id);
  if (r) return r.ingredients.filter(([i]) => res(items, String(i))).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).slice(0, 2).map(([i]) => String(i));
  const n = new Map<string, number>();
  for (const l of Object.values(items.drops)) {
    if (!l.some(d => String(d.item) === id && d.cond !== 'quete' && d.cond !== 'evenement')) continue;
    for (const d of l) if (res(items, String(d.item)) && d.cond !== 'quete' && d.cond !== 'evenement' && d.chance < 100) n.set(String(d.item), (n.get(String(d.item)) ?? 0) + 1);
  }
  return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 2).map(x => x[0]);
}
/** 2A, 4e palier : une ressource du boss dont le niveau est le plus proche de celui de l'objet. */
export function ressourceBoss(items: ItemsData, monstres: Record<string, { boss?: boolean; level?: number }>, niveau: number): string | null {
  const boss = Object.entries(monstres).filter(([k, m]) => m.boss && (items.drops[k] ?? []).some(d => res(items, String(d.item))))
    .sort((a, b) => Math.abs((a[1].level ?? 0) - niveau) - Math.abs((b[1].level ?? 0) - niveau) || a[0].localeCompare(b[0]));
  for (const [k] of boss) {
    const l = (items.drops[k] ?? []).filter(d => res(items, String(d.item)) && d.cond !== 'quete' && d.cond !== 'evenement').sort((a, b) => b.chance - a.chance || String(a.item).localeCompare(String(b.item)));
    if (l.length) return String(l[0].item);
  }
  return null;
}
export interface Cout { kamas: number; res: [string, number][]; niveau: number }
/** Prix du palier suivant (palier = 1 à 4). */
export function coutOeuvre(items: ItemsData, monstres: Record<string, { boss?: boolean; level?: number }>, id: string, palier: number): Cout {
  const def = items.equipment[id], lien = ressourcesOeuvre(items, id), out: [string, number][] = lien.map(r => [r, OEUVRE.quantite * palier]);
  if (palier >= OEUVRE.paliers) { const b = ressourceBoss(items, monstres, def?.level ?? 1); if (b) out.push([b, 1]); }
  return { kamas: (def?.level ?? 1) * OEUVRE.kamas * palier * (lien.length ? 1 : 2), res: out, niveau: niveauOeuvre(palier) };
}
/** 2C : prix pour percer une châsse (Mineur). */
export function coutPerce(def: ItemDef): Cout {
  const [niveau, minerai] = CHASSE.minerais.find(([n]) => def.level >= n)!;
  return { kamas: def.level * CHASSE.kamas, res: [[minerai, CHASSE.quantite]], niveau };
}
/** Bonus d'une pierre sertie dans un objet de ce niveau. */
export function bonusPierre(pierre: string | undefined, niveau: number): [Stat, number] | null {
  const s = pierre ? PIERRES[pierre] : undefined;
  return s ? [s, Math.max(1, Math.round(extraBase(s, niveau) * CHASSE.part))] : null;
}

/** 3D : panoplies d'artisan, celles dont aucune pièce ne tombe d'un monstre (toutes leurs pièces se fabriquent). */
let cache: { items: ItemsData; sets: Set<number>; pieces: Set<string> } | null = null;
export function panosArtisan(items: ItemsData): { sets: Set<number>; pieces: Set<string> } {
  if (cache?.items === items) return cache;
  const tombe = new Set<string>(), fab = new Set((items.recipes ?? []).map(r => String(r.result)));
  for (const l of Object.values(items.drops)) for (const d of l) if (d.cond !== 'quete' && d.cond !== 'evenement') tombe.add(String(d.item));
  const sets = new Set<number>(), pieces = new Set<string>();
  for (const [k, s] of Object.entries(items.sets)) {
    const l = s.items.map(String).filter(i => items.equipment[i]);
    if (!l.length || l.some(i => tombe.has(i) || !fab.has(i))) continue;
    sets.add(+k); for (const i of l) pieces.add(i);
  }
  cache = { items, sets, pieces };
  return cache;
}
/** L'objet est-il une pièce de panoplie d'artisan (introuvable en butin aléatoire) ? */
export const pieceArtisan = (items: ItemsData, id: string) => panosArtisan(items).pieces.has(id);
