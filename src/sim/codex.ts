import { POIDS, RUNES, runesDe } from './forgemagie';
import { LEGENDARY, type Item, type ItemDef, type LegendaryFx, type LegendaryId } from './items';
import { POUVOIRS, POUVOIR_PAR_ID, classeDuPouvoir } from './pouvoirs';

/** Codex des pouvoirs (version 0.3, « 0.3 : » 5A+5B+5D 6A+6B 7A+7B 8C, façon Diablo 4) :
 *  briser un Légendaire ou un Mythique chez Malek y enregistre ses pouvoirs une fois pour toutes (5A) ;
 *  on imprime ensuite un pouvoir du Codex sur un objet Rare ou Épique du même emplacement, qui devient Légendaire (5B).
 *  Les pouvoirs maison (toutes classes, 3B) s'impriment sur n'importe quel emplacement. */
export interface EntreeCodex {
  /** Id du pouvoir : officiel (« iop-07 ») ou maison (« rage »…). */
  id: string;
  /** Relance éclair : le sort visé, gardé tel quel. */
  sort?: string;
}

/** Pouvoirs que le Codex peut garder pour cette classe : les 40 officiels de la classe et les 5 maison. */
export const pouvoirsDuCodex = (classe: string) => [...(POUVOIRS[classe] ?? []).map(p => p.id), ...Object.keys(LEGENDARY)];

/** Le pouvoir peut-il entrer dans le Codex de ce perso (pas un pouvoir d'une autre classe) ? */
export function codexAccepte(classe: string, l: LegendaryFx): boolean {
  const o = POUVOIR_PAR_ID[l.id];
  return o ? classeDuPouvoir(o.id) === classe : l.id in LEGENDARY;
}
/** Le pouvoir est-il nouveau pour le Codex (sceau « Nouveau pour le Codex », 14D) ? */
export function nouveauPourCodex(codex: EntreeCodex[], classe: string, l: LegendaryFx): boolean {
  return codexAccepte(classe, l) && !codex.some(e => e.id === l.id);
}

/** Objet qui peut recevoir une impression : Rare ou Épique (pas un familier), et pouvoir de son emplacement (ou maison). */
export function imprimable(def: ItemDef, it: Item, e: EntreeCodex): boolean {
  if (def.familier || (it.rarity !== 'rare' && it.rarity !== 'epique')) return false;
  const o = POUVOIR_PAR_ID[e.id];
  return !o || o.slot === def.slot;
}

/** Prix d'une impression (6A+6B) : au choix des kamas et des runes de l'objet (sa ligne la plus lourde), avec la commission
 *  de Malek, ou des Pépites. Le tout selon le niveau de l'objet. */
export const PRIX_CODEX = { kamasParNiveau: 100, runesParNiveau: 1 / 5, pepitesParNiveau: 10 };
export function prixImpression(def: ItemDef, it: Item): { kamas: number; rune: string | null; runes: number; pepites: number } {
  let best: string | null = null, poids = -1;
  for (const [s, v] of Object.entries(it.stats)) {
    const w = (POIDS as Record<string, number | undefined>)[s], rs = runesDe(s as never);
    if (w == null || !v || v <= 0 || !rs.length) continue;
    if (v * w > poids) { poids = v * w; best = rs[0]; }
  }
  return { kamas: Math.round(def.level * PRIX_CODEX.kamasParNiveau), rune: best && RUNES[best] ? best : null,
    runes: best ? Math.max(1, Math.ceil(def.level * PRIX_CODEX.runesParNiveau)) : 0, pepites: Math.round(def.level * PRIX_CODEX.pepitesParNiveau) };
}

/** Effet légendaire posé par une impression : un pouvoir maison prend la force du niveau de l'objet (comme au tirage). */
export function fxImpression(def: ItemDef, e: EntreeCodex, legendaryPower: (n: number) => number): LegendaryFx {
  if (POUVOIR_PAR_ID[e.id]) return { id: e.id, value: 0 };
  const m = LEGENDARY[e.id as LegendaryId];
  return e.id === 'relance'
    ? { id: e.id, value: Math.max(0.5, Math.round(m.max * legendaryPower(def.level) * 2) / 2), sort: e.sort }
    : { id: e.id, value: Math.round(m.max * legendaryPower(def.level)) };
}
