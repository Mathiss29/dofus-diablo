import type { Player } from './player';
import type { World } from './world';
import type { WorldMapEntry } from './gridmap';

/** Carte du monde (maquette « Carte : » 2026-11-10 et « Carte suite : ») côté partie : brouillard par carte (6A), lieux à
 *  découvrir (17A), drapeaux (9A, 14A, 14C), signal au sol (14B), tombe de la dernière mort (15A). Tout est propre au joueur
 *  (rangé dans Player) : en coop, chacun a son brouillard, ses lieux et ses drapeaux ; les drapeaux et signaux se voient
 *  chez tout le groupe (champs d'entité, recopiés chez les invités). */

/** Un drapeau posé sur la carte (9A) : position en unités de carte (case [x, y] = [x, x+1] × [y, y+1]) dans le monde de sa zone, petite note (14C). */
export interface Drapeau { zone: string; x: number; y: number; note?: string }
/** Signal Alt + clic (14B) : un cercle qui pulse chez tout le groupe pendant SIGNAL_DUREE secondes. */
export interface Signal { zone: string; x: number; y: number; t: number }
/** Tombe de la dernière mort (15A), jusqu'à ce qu'on y repasse. */
export interface Tombe { zone: string; x: number; y: number }

export const MAX_DRAPEAUX = 5;
export const NOTE_MAX = 40;
export const SIGNAL_DUREE = 4;
/** On « repasse » sur sa tombe à moins de cette distance (unités du monde). */
export const TOMBE_RAYON = 260;

/** Repère officiel (table hints, monde.json reperes) : carte, nom, icône, catégorie. */
export interface Repere { t: string; n: string; g: number; c: number }
/** Familles de repères pour les filtres de la carte (4A). */
export type Famille = 'zaap' | 'transport' | 'atelier' | 'service' | 'donjon' | 'lieu';
const SERVICES = /^(Banque|Milice|Bibliothèque|Taverne|Tour du Conseil|Mine)/;
/** 5A : repères qui ne mènent à rien dans notre jeu (pas d'hôtel de vente, de guilde ni d'auberge des compagnons). */
const RIEN = /^(Hall de guilde|Temple des guildes|Auberge des compagnons)/;
/** 17A : lieux secrets, invisibles sur la carte tant qu'on ne les a pas trouvés. */
const SECRET = /^(Attitude|Sort :|Passage secret)/;

export function famille(r: Repere): Famille | null {
  if (r.c === 2 || RIEN.test(r.n)) return null;
  if (r.n === 'Zaap') return 'zaap';
  if (r.c === 9 || /^(Entrée des égouts|Passage vers)/.test(r.n)) return 'transport';
  if (r.c === 3) return 'atelier';
  if (r.c === 6) return 'donjon';
  if (SERVICES.test(r.n)) return 'service';
  return 'lieu';
}
export const secret = (r: Repere) => SECRET.test(r.n);
/** Lieu à découvrir (17A) : temples, lieux remarquables, coins secrets et entrées de donjon. Découvert en entrant sur sa carte. */
export const aDecouvrir = (r: Repere) => { const f = famille(r); return f === 'lieu' || f === 'donjon'; };
/** Nom affiché d'un lieu (les coins secrets disent ce qu'on y trouve). */
export const nomLieu = (r: Repere) => (/^(Attitude|Sort :)/.test(r.n) ? `Coin secret · ${r.n}` : r.n);
/** Clé d'un lieu dans Player.lieuxVus. */
export const cleLieu = (zone: string, r: Repere) => `${zone}|${r.t}|${r.n}`;

/** Carte du dehors (pas un intérieur ni une arène). */
export const dehors = (m: WorldMapEntry) => !m.inside && /^-?\d+_-?\d+$/.test(m.tag);

/** Brouillard (6A) : la carte où l'on est et ses 8 voisines deviennent visibles. Renvoie true si quelque chose a changé. */
export function explorer(p: Player, zone: string, m: WorldMapEntry): boolean {
  if (!dehors(m)) return false;
  const vus = (p.explore[zone] ??= []);
  let neuf = false;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const t = `${m.x + dx}_${m.y + dy}`;
    if (!p.exploreSet(zone).has(t)) { p.exploreSet(zone).add(t); vus.push(t); neuf = true; }
  }
  return neuf;
}

/** Part du monde explorée (6D) : cartes du dehors vues sur le total, sans les cartes en essai hors partie de test. */
export function partExploree(p: Player, zone: string, maps: WorldMapEntry[], test: boolean, region?: string, subs?: Record<string, { region?: string }>): number {
  const vus = p.exploreSet(zone);
  let n = 0, t = 0;
  for (const m of maps) {
    if (!dehors(m) || (m.essai && !test)) continue;
    if (region !== undefined && (subs?.[String(m.sub)]?.region ?? '') !== region) continue;
    t++; if (vus.has(m.tag)) n++;
  }
  return t ? n / t : 0;
}

/** Nettoie des drapeaux venus d'une sauvegarde ou du réseau. */
export function drapeauxPropres(v: unknown): Drapeau[] {
  if (!Array.isArray(v)) return [];
  const r: Drapeau[] = [];
  for (const d of v.slice(0, MAX_DRAPEAUX)) {
    if (!d || typeof d !== 'object') continue;
    const o = d as Record<string, unknown>;
    if (typeof o.zone !== 'string' || !Number.isFinite(o.x) || !Number.isFinite(o.y)) continue;
    const note = typeof o.note === 'string' ? o.note.slice(0, NOTE_MAX) : '';
    r.push({ zone: o.zone.slice(0, 30), x: o.x as number, y: o.y as number, ...(note ? { note } : {}) });
  }
  return r;
}
export function signalPropre(v: unknown): { x: number; y: number } | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  return Number.isFinite(o.x) && Number.isFinite(o.y) ? { x: o.x as number, y: o.y as number } : null;
}

/** Monde ouvert, pour world.player à son pas : brouillard, lieux découverts, tombe retrouvée. */
export function majCarteJoueur(w: World, m: WorldMapEntry | undefined) {
  const p = w.player, zone = w.opts.zone ?? '';
  if (p.tombe && (p.tombe.zone !== zone ? false : Math.hypot(p.tombe.x - p.x, p.tombe.y - p.y) < TOMBE_RAYON) && !p.dead) p.tombe = null;
  if (p.signal && w.time - p.signal.t > SIGNAL_DUREE) p.signal = null;
  if (!m || m.tag === p.carteIci) return;
  p.carteIci = m.tag;
  explorer(p, zone, m);
  const wg = w.worldGrid!;
  for (const r of wg.world.reperes ?? []) {
    if (r.t !== m.tag || !aDecouvrir(r)) continue;
    const k = cleLieu(zone, r);
    if (p.lieuxVus.includes(k)) continue;
    if (m.essai && !w.test) continue;
    p.lieuxVus.push(k);
    const xp = p.gainXp(Math.round(p.xpNeeded * 0.05), w);
    w.emit({ k: 'lieuDecouvert', nom: nomLieu(r), g: r.g, xp });
  }
}

/** Gestes de la carte reçus de l'affichage (ou d'un invité) : drapeaux remplacés, signal posé. */
export function appliquerCarte(w: World, p: Player, c: { drapeaux?: Drapeau[] | null; signal?: { x: number; y: number } | null } | null | undefined) {
  if (!c) return;
  if (c.drapeaux) p.drapeaux = drapeauxPropres(c.drapeaux);
  if (c.signal) {
    p.signal = { zone: w.opts.zone ?? '', x: c.signal.x, y: c.signal.y, t: w.time };
    w.emit({ k: 'signal', x: c.signal.x, y: c.signal.y, joueur: p.id });
  }
}
