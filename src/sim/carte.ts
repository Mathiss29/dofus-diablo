import type { Player } from './player';
import type { World } from './world';
import type { WorldMapEntry } from './gridmap';
import type { OpenDef, PorteDef } from './defs';
import { V06_PUBLIC, V07_PUBLIC } from './pouvoirs';

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
/** Carte du dehors, d'après son tag (« 9_-2 »), par opposition aux intérieurs et arènes. */
const TAG_DEHORS = /^-?\d+_-?\d+$/;
/** Icônes officielles des repères faits par nous (bateau, route, portail, donjon). */
const ICONE = { Bateau: 413, Route: 900, Portail: 447, donjon: 422 } as const;
/** Porte qui est un transport (bateau, route, portail entre zones) : elle relie deux cartes du dehors. */
export const estTransport = (d: PorteDef) => TAG_DEHORS.test(d.a[0]) && TAG_DEHORS.test(d.b[0]);
/** Un départ de transport vu d'une de ses cartes : où il mène, et ce qu'il demande. */
export interface Depart { t: string; vers: string; genre: 'Bateau' | 'Route' | 'Portail'; prix?: number; quete?: string }
/** Tous les départs de transports de la zone, dans les deux sens (le retour est gratuit et sans quête, comme en jeu).
 *  ouverte(tag) : la carte est jouable (0.4 / 0.6 cachées hors partie de test). */
export function departs(open: OpenDef | undefined, ouverte: (tag: string) => boolean = () => true): Depart[] {
  const l: Depart[] = [];
  for (const d of open?.portes ?? []) {
    if (!estTransport(d) || !d.lieux || !ouverte(d.a[0]) || (!d.zone && !ouverte(d.b[0]))) continue;
    const genre = d.zone ? 'Portail' : d.voyage || /^Bateau/.test(d.nom) ? 'Bateau' : 'Route';
    l.push({ t: d.a[0], vers: d.lieux[1], genre, ...(d.prix ? { prix: d.prix } : {}), ...(d.quete ? { quete: d.quete } : {}) });
    if (!d.zone && !d.sens) l.push({ t: d.b[0], vers: d.lieux[0], genre });   // un portail a son autre bout dans l'autre zone
  }
  return l;
}
/** Nom du repère d'une carte d'où partent un ou plusieurs transports : « Bateau vers l'île de Moon », ou
 *  « Bateaux vers l'île des Wabbits (500 kamas), l'île de Moon et Frigost (après « Cap sur Frigost ») ». */
export function nomDeparts(l: Depart[], nomQuete: (id: string) => string = id => id): string {
  const genres = [...new Set(l.map(d => d.genre))];
  const PLURIEL = { Bateau: 'Bateaux', Route: 'Routes', Portail: 'Portails' } as const;
  const tete = genres.length > 1 ? 'Transports' : l.length > 1 ? PLURIEL[genres[0]] : genres[0];
  const vers = l.map(d => `${d.vers}${d.prix ? ` (${d.prix} kamas)` : ''}${d.quete ? ` (après « ${nomQuete(d.quete)} »)` : ''}`);
  return `${tete} vers ${vers.length > 1 ? `${vers.slice(0, -1).join(', ')} et ${vers[vers.length - 1]}` : vers[0]}`;
}
/** Repères montrés en jeu (carte M, minicarte, lieux à découvrir) : les repères officiels de Dofus 3, sans ceux qui ne mènent
 *  à rien chez nous, et complétés par nos propres portes (retour joueur du 2026-11-15 : le seul repère du Port de Madrestam
 *  disait « Bateau vers l'île des Wabbits », personne ne trouvait le bateau pour Moon).
 *  - transports : remplacés par nos vrais départs (un repère par carte, qui nomme toutes les destinations) ;
 *  - donjons : seulement ceux qu'on peut faire, et un repère pour ceux qui n'en avaient pas (à leur entrée) ;
 *  - ateliers : seulement ceux où sont nos machines de ce métier ; services : seulement ceux où une porte mène quelque part. */
export function reperesJeu(reperes: readonly Repere[], open: OpenDef | undefined, ouverte?: (tag: string) => boolean,
  nomQuete?: (id: string) => string): Repere[] {
  const portes = open?.portes ?? [], depuis = new Set(portes.map(d => d.a[0]));
  const donjons = new Set([...(open?.donjons ?? []), ...(open?.donjonsTest ?? []), ...(open?.donjonsV06 ?? [])].map(d => d.nom));
  const l: Repere[] = [];
  for (const r of reperes) {
    const f = famille(r);
    if (f === 'transport') continue;
    if (f === 'donjon' && !donjons.has(r.n)) continue;
    if (f === 'atelier' && !(open?.ateliers ?? []).some(a => a.cartes.includes(r.t) && a.nom.startsWith(r.n))) continue;   // ses machines, pour ce métier
    if (f === 'service' && !depuis.has(r.t)) continue;
    l.push(r);
  }
  for (const n of donjons) {
    if (l.some(r => r.c === 6 && r.n === n)) continue;
    const d = portes.find(x => x.nom === n && TAG_DEHORS.test(x.a[0]));
    if (d) l.push({ t: d.a[0], n, g: ICONE.donjon, c: 6 });
  }
  const parCarte = new Map<string, Depart[]>();
  for (const d of departs(open, ouverte)) { const x = parCarte.get(d.t) ?? []; x.push(d); parCarte.set(d.t, x); }
  for (const [t, x] of parCarte) {
    const genres = new Set(x.map(d => d.genre));
    l.push({ t, n: nomDeparts(x, nomQuete), g: ICONE[genres.size === 1 ? x[0].genre : 'Bateau'], c: 9 });
  }
  return l;
}
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
    if (!dehors(m) || (m.essai && !test) || (m.v06 && !test && !V06_PUBLIC) || (m.v07 && !test && !V07_PUBLIC)) continue;
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
  for (const r of w.reperes) {
    if (r.t !== m.tag || !aDecouvrir(r)) continue;
    const k = cleLieu(zone, r);
    if (p.lieuxVus.includes(k)) continue;
    if (m.essai && !w.essaiOuvert) continue;
    if (m.v06 && !w.v06Ouvert) continue;
    if (m.v07 && !w.v07Ouvert) continue;
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
