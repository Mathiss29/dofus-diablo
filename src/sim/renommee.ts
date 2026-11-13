import V06 from '../data/v06.json';
import { APPARATS } from './data';
import { PEPITE, type Stat } from './items';
import type { Player } from './player';
import type { World } from './world';

/** Renommée de région (maquette 0.6, 19A+19C) et sanctuaires des Douze (20A+20C), par perso.
 *  La renommée se calcule depuis ce que le perso a déjà fait (cartes vues et chassées, lieux, archimonstres, sanctuaires) :
 *  les vieux persos ont donc tout de suite la leur. Chaque palier atteint donne sa récompense une fois. */
export const RENOMMEE = V06.renommee;
export const SANCTUAIRES = V06.sanctuaires;

export interface Sanctuaire { id: string; region: string; tag: string; x: number; y: number; dieu: string; carac: Stat }
interface InfoRegion { cartes: Set<string>; archis: Set<string>; sanctuaires: Sanctuaire[] }

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/** Région d'une carte du monde ouvert : celle de sa sous-zone, sinon le nom de la zone (Incarnam, Astrub). */
export function regionDe(w: World, tag: string): string | null {
  const m = w.worldGrid?.mapByTag(tag);
  if (!m || m.inside) return null;
  const sub = w.zone.open?.subareas[String(m.sub)];
  if (!sub || (sub.essai && !w.players[0]?.v04)) return null;
  return sub.region ?? w.zone.name;
}

const cache = new WeakMap<World, Map<string, InfoRegion>>();
/** Régions de ce monde : cartes du dehors, archimonstres possibles, sanctuaires (posés une fois pour toutes, sans hasard). */
export function regions(w: World): Map<string, InfoRegion> {
  let R = cache.get(w);
  if (R) return R;
  R = new Map();
  cache.set(w, R);
  const wg = w.worldGrid, open = w.zone.open;
  if (!wg || !open) return R;
  for (const m of wg.world.maps) {
    const r = regionDe(w, m.tag);
    if (!r || !wg.freeByMap.get(m.tag)?.length) continue;
    let I = R.get(r);
    if (!I) R.set(r, I = { cartes: new Set(), archis: new Set(), sanctuaires: [] });
    I.cartes.add(m.tag);
    for (const t of open.subareas[String(m.sub)]?.monsters ?? []) if (w.opts.data.monsters[`archi_${t}`]?.archiDe === t) I.archis.add(`archi_${t}`);
  }
  // Sanctuaires : dans les coins (cases loin du centre de la carte), sur des cartes tirées par empreinte du nom
  for (const [r, I] of R) {
    const n = Math.min(SANCTUAIRES.parRegion, Math.floor(I.cartes.size / SANCTUAIRES.cartesParSanctuaire));
    const tags = [...I.cartes].sort((a, b) => hash(r + a) - hash(r + b)).slice(0, n);
    tags.forEach((tag, i) => {
      const free = wg.freeByMap.get(tag)!, pts = free.map(c => wg.cellToWorld(c));
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      const loin = pts.sort((a, b) => Math.hypot(b.x - cx, b.y - cy) - Math.hypot(a.x - cx, a.y - cy))[Math.min(pts.length - 1, 6)];
      const [dieu, carac] = SANCTUAIRES.dieux[hash(r + tag) % SANCTUAIRES.dieux.length];
      I.sanctuaires.push({ id: `${r}|${i}|${carac}`, region: r, tag, x: loin.x, y: loin.y, dieu, carac: carac as Stat });
    });
  }
  return R;
}

/** Points de renommée du perso dans la région, et ce qu'il faut pour le palier 4. */
export function renommee(w: World, p: Player, region: string): { points: number; max: number; palier: number; seuils: number[] } {
  const I = regions(w).get(region), P = RENOMMEE.points;
  if (!I) return { points: 0, max: 0, palier: 0, seuils: [] };
  const z = w.opts.zone ?? '', vues = p.exploreSet(z), chassees = new Set(p.chasse[z] ?? []);
  let pts = 0;
  for (const t of I.cartes) { if (vues.has(t)) pts += P.carte; if (chassees.has(t)) pts += P.chassee; }
  for (const k of p.lieuxVus) { const [zz, tag] = k.split('|'); if (zz === z && I.cartes.has(tag)) pts += P.lieu; }
  for (const a of I.archis) if (p.ames.includes(a)) pts += P.archi;
  for (const s of I.sanctuaires) if (p.sanctuaires.includes(s.id)) pts += P.sanctuaire;
  const max = I.cartes.size * (P.carte + P.chassee) + I.archis.size * P.archi + I.sanctuaires.length * P.sanctuaire;
  const fin = Math.max(1, Math.round(max * RENOMMEE.objectif)), seuils = [0.25, 0.5, 0.75, 1].map(k => Math.round(fin * k));
  return { points: pts, max, palier: seuils.filter(s => pts >= s).length, seuils };
}

/** Donne les récompenses des paliers atteints (une fois chacune). */
export function majRenommee(w: World, p: Player) {
  if (!p.v06) return;
  for (const r of regions(w).keys()) {
    const { palier } = renommee(w, p, r), deja = p.renommee[r] ?? 0;
    for (let k = deja; k < palier; k++) {
      const G = RENOMMEE.paliers[k] as { pepites?: number; potion?: number; points?: number; apparat?: number; texte: string };
      if (G.pepites) p.resources[PEPITE] = (p.resources[PEPITE] ?? 0) + G.pepites;
      if (G.points) p.points += G.points;
      if (G.apparat) {
        const libres = Object.keys(APPARATS.objets).filter(id => !p.apparats.includes(id) && APPARATS.objets[id].slot !== 'familier').sort((a, b) => hash(r + a) - hash(r + b));
        if (libres[0]) p.apparats.push(libres[0]);
      }
      w.emit({ k: 'renommee', region: r, palier: k + 1, texte: G.texte });
    }
    if (palier > deja) { p.renommee[r] = palier; p.recompute(); }
  }
}

/** Charges de potion en plus (palier 2 de chaque région). */
export const potionsRenommee = (p: Player) => Object.values(p.renommee).filter(n => n >= 2).length;

/** Sanctuaires : un perso qui passe près d'une statue la trouve. */
export function sanctuairesPas(w: World) {
  const R = regions(w);
  if (!R.size) return;
  for (const p of w.players) {
    if (!p.v06 || p.dead) continue;
    const tag = w.worldGrid?.mapAt(p.x, p.y)?.tag, r = tag ? regionDe(w, tag) : null, I = r ? R.get(r) : undefined;
    if (!I) continue;
    for (const s of I.sanctuaires) if (s.tag === tag && !p.sanctuaires.includes(s.id) && Math.hypot(p.x - s.x, p.y - s.y) <= SANCTUAIRES.rayon) {
      p.sanctuaires.push(s.id); p.recompute();
      w.emit({ k: 'sanctuaire', dieu: s.dieu, carac: s.carac, bonus: SANCTUAIRES.bonus, region: s.region, n: I.sanctuaires.filter(x => p.sanctuaires.includes(x.id)).length, total: I.sanctuaires.length });
      majRenommee(w, p);
    }
  }
}
/** Bonus de caractéristiques des sanctuaires trouvés (l'id finit par la carac : « région|n|carac »). */
export function bonusSanctuaires(ids: readonly string[]): Partial<Record<Stat, number>> {
  const out: Partial<Record<Stat, number>> = {};
  for (const id of ids) { const k = id.split('|')[2] as Stat; if (k) out[k] = (out[k] ?? 0) + SANCTUAIRES.bonus; }
  return out;
}
