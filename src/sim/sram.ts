import type { SpellDef } from './defs';
import type { Bete } from './bete';
import type { Cible, Monster } from './monster';
import type { Player } from './player';
import type { HitDef, World } from './world';
import { empoisonner } from './sadida';
import { REGLAGES_BUTIN } from './butin';

/** Sram (classe 4). Choix de Mathis : « Classes : 5A 6A+6C 7A+7B 8A 9A » (15 nov. 2026) et
 *  « Sram : 1A 2A 3A 4A 5A 6A-6P 7A 8A+8B 9A » (28 nov. 2026).
 *  1A Ruse : chaque piège qui touche et chaque monstre achevé la remplissent ; pleine, le prochain piège posé joue ses effets deux fois.
 *  2A poisons continus 3 s (même poison que le Sadida). 3A Peur en deux temps : le monstre, puis la case (5 au plus).
 *  5A vol de caractéristique : le monstre fait moins de dégâts, toi plus dans l'élément volé (2 fois, moitié sur les boss).
 *  6A+6C Invisibilité : les monstres perdent ta trace, élites et boss te retrouvent au bout d'1 s, frapper te montre 0,5 s,
 *  achever un monstre pendant l'Invisibilité la recharge. 7A+7B pièges : invisibles pour les monstres, 5 au plus, armés en 0,5 s,
 *  touche X : tous sautent. 8A Double : leurre ; à sa mort tu prends sa place et tu cours plus vite. 9A Sournoiserie au clic droit.
 *  Tout l'état propre à un joueur est dans Player.sram (un allié rendu invisible en a un aussi). */

const CASE = 48;
export interface ReglesSram {
  ruse: { parPiege: number; parAcheve: number };
  pieges: { max: number; arme: number; duree: number; declenche: number };
  invisible: { t: number; revele: number; elite: number; allie: number };
  vol: { n: number; max: number; t: number };
  double: { t: number; course: number; courseT: number };
  peur: { cases: number; attente: number };
}
export type Carac = 'puissance' | 'force' | 'agilite' | 'chance' | 'intelligence';
/** Effets des sorts (SpellDef.sram). */
export interface EffetsSram {
  /** Pose un piège au point visé : rayon de ses effets (cases), attire / repousse vers / depuis son centre (cases),
   *  immobilise (s), +parEnnemi de dommages par ennemi à `autour` cases (Funeste). */
  piege?: { r: number; attire?: number; repousse?: number; immobilise?: number; parEnnemi?: number; autour?: number;
    /** Piège Mortel : dommages × mortel sur un ennemi sous la moitié de ses PV. */
    mortel?: number };
  /** Vole cette caractéristique (5A). */
  vol?: Carac;
  /** Poison continu (dommages totaux, × 1,5 comme les sorts) et retrait de Portée (cases, s) : Arsenic. */
  poison?: number; poLoss?: { n: number; t: number };
  /** Cruauté : +n charge de pas (PM). */
  pm?: number;
  invisible?: boolean; double?: boolean; peur?: boolean;
  /** Pas de l'ombre (Espace) : rien de lui-même, porte le légendaire pc-sram-K. */
  pas?: boolean;
  /** Sournoiserie (clic droit) : repousse dans l'axe du lanceur (droit dans les pièges). */
  sournoiserie?: boolean;
  /** Concentration de Chakra (61-90) : t s sur l'ennemi visé ; un piège qui le touche te soigne de part des dommages du piège. */
  chakra?: { t: number; part: number };
  /** Dérobade : bouclier (part des PV max) et course en plus, t s, sur l'allié visé ou sur toi. */
  derobade?: { bouclier: number; t: number; course: number };
  /** Chausse-trappe (91-120) : +par de dommages par piège qui a sauté depuis le dernier lancer (max) ; le compte repart à zéro. */
  sautes?: { par: number; max: number };
  /** Toxines : chaque lancer sur la même cible renforce le poison de par (max fois, t s) ; un piège qui la touche le relance. */
  toxines?: { par: number; max: number; t: number };
  /** Brume : les alliés dans la zone deviennent invisibles t s, les ennemis y perdent po cases de Portée 6 s. */
  brume?: { t: number; po: number };
  /** Comploteur : Double de t s qui explose à sa mort (r cases, dommages du sort, +parPiege par piège qui a sauté pendant sa vie). */
  explose?: { r: number; t: number; parPiege: number };
}
/** Un piège au sol. */
export interface Piege { id: number; sort: string; x: number; y: number; t: number; double: boolean; gm: number }
/** État d'un Sram (Player.sram) ; pour un allié rendu invisible, seuls les champs d'Invisibilité servent. */
export interface EtatSram {
  pieges: Piege[]; prochain: number;
  /** Invisibilité : secondes restantes, âge du joueur au début, secondes où il reste visible après un coup. */
  invisT: number; invisA: number; reveleT: number;
  /** Vols en cours : crans et secondes restantes par caractéristique. */
  vols: Partial<Record<Carac, { n: number; t: number }>>;
  /** Double en jeu (id de la bête), monstre choisi par Peur (id) et secondes pour choisir la case. */
  double: number | null; peur: number | null; peurT: number;
  /** Pièges qui ont sauté (Chausse-trappe : depuis son dernier lancer ; Comploteur : pendant la vie du Double). */
  sautes: number; sautesDouble: number;
  /** Comploteur en jeu : sort et grade, pour l'explosion à sa mort. */
  explose: { sort: string; gm: number } | null;
  /** Ennemis sous Concentration de Chakra et sous Toxines (id, secondes, crans). */
  chakra: { mid: number; t: number }[]; toxines: { mid: number; t: number; n: number }[];
  /** Nappe de brume (pc-sram-O) : âge du dernier déclenchement. */
  brumeA: number;
}
export const etatSram = (p: Player): EtatSram =>
  (p.sram ??= { pieges: [], prochain: 1, invisT: 0, invisA: -99, reveleT: 0, vols: {}, double: null, peur: null, peurT: 0,
    sautes: 0, sautesDouble: 0, explose: null, chakra: [], toxines: [], brumeA: -99 });
const R = (p: Player): ReglesSram | undefined => p.cls.sram;
/** Règles du Sram, même pour un allié qui n'est pas Sram (Invisibilité posée sur lui). */
const REGLES = (p: Player, w: World): ReglesSram | undefined => R(p) ?? w.players.find(q => q.cls.sram)?.cls.sram;

// --- Légendaires inventés (« Sram : 6A-6P ») -------------------------------------------------------------------------------
/** Poison du Sram : Poison lent (pc-sram-E) dure 1 s de plus et frappe plus fort. */
function poison(p: Player, m: Monster, brut: number, el: SpellDef['element'], w: World) {
  const e = p.pcv('pc-sram-E');
  empoisonner(p, m, brut * (1 + e / 100) * (e ? 4 / 3 : 1), el, w);
  if (e && m.poisonT > 0) m.poisonT += 1;
}
/** Multiplicateur des dommages d'un sort du Sram : Lame dans le dos (invisible), Chausse-trappe (pièges sautés). */
export function multSram(p: Player, d: SpellDef): number {
  let k = 1;
  const a = p.pcv('pc-sram-A');
  if (a && invisible(p) && d.dmg > 0) k *= 1 + a / 100;
  if (d.sram?.sautes && p.sram) k *= 1 + d.sram.sautes.par * Math.min(d.sram.sautes.max, p.sram.sautes);
  return k;
}
/** Fuite rapide (pc-sram-L) : course en plus pendant l'Invisibilité. */
export const vitesseSram = (p: Player): number => p.sram && p.sram.invisT > 0 ? 1 + p.pcv('pc-sram-L') / 100 : 1;

// --- Invisibilité (6A+6C) ---------------------------------------------------------------------------------------------
/** Le joueur est-il invisible (pas montré par un coup) ? */
export const invisible = (p: Player): boolean => !!p.sram && p.sram.invisT > 0 && p.sram.reveleT <= 0;
/** Ce monstre a-t-il perdu sa trace ? Élites et boss le retrouvent au bout d'`elite` s. */
export function invisiblePour(p: Player, m: Monster, w: World): boolean {
  if (!invisible(p)) return false;
  if (m.def.elite || m.def.boss) return p.age - p.sram!.invisA < (REGLES(p, w)?.invisible.elite ?? 1);
  return true;
}
export function rendreInvisible(q: Player, w: World, t: number) {
  const s = etatSram(q);
  if (s.invisT <= 0) s.invisA = q.age;
  s.invisT = Math.max(s.invisT, t); s.reveleT = 0;
  w.emit({ k: 'status', x: q.x, y: q.y - 70, text: 'Invisible', color: '#b48cff' });
  w.emit({ k: 'invisible', id: q.id, x: q.x, y: q.y, on: true });
}
/** Un coup porté montre le Sram `revele` s. */
export function reveler(p: Player, w: World) {
  const s = p.sram, r = REGLES(p, w);
  if (s && s.invisT > 0 && r) s.reveleT = r.invisible.revele;
}
/** Ombre laissée aux monstres qui ont perdu la trace du joueur : une cible « tombée », ils abandonnent la poursuite. */
const ombres = new WeakMap<Player, Cible>();
export function ombre(p: Player): Cible {
  let o = ombres.get(p);
  if (!o) { o = { id: -1 - p.id, x: p.x, y: p.y, radius: p.radius, dead: true, tacle: 0, hurt: () => false } as unknown as Cible; ombres.set(p, o); }
  o.x = p.x; o.y = p.y;
  return o;
}

// --- Double (8A) ------------------------------------------------------------------------------------------------------
export function doubleDe(p: Player, w: World): Bete | null {
  const id = p.sram?.double;
  return id == null ? null : w.betes.find(b => b.id === id && !b.dead) ?? null;
}
/** Le Double attire les monstres en chasse à 10 cases (le plus proche d'eux, s'il y en a plusieurs). */
export function leurrePour(m: Monster, w: World): Bete | null {
  if (m.state === 'idle' || m.state === 'return') return null;
  let best: Bete | null = null, bd = CASE * 10;
  for (const p of w.players) {
    const b = p.sram?.double != null ? doubleDe(p, w) : null;
    if (!b || b.state === 'spawn') continue;
    const d = Math.hypot(b.x - m.x, b.y - m.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

// --- Vol de caractéristique (5A) --------------------------------------------------------------------------------------
const CARAC_EL: Record<string, Carac> = { terre: 'force', feu: 'intelligence', eau: 'chance', air: 'agilite' };
/** Dommages du Sram dans un élément : +n % par cran volé dans cet élément (ou de Puissance, qui vaut pour tous). */
export function dommagesSram(p: Player, el: string): number {
  const s = p.sram, r = R(p);
  if (!s || !r) return 1;
  const v = (k?: Carac) => { const x = k && s.vols[k]; return x && x.t > 0 ? x.n : 0; };
  const n = v('puissance') + v(CARAC_EL[el]);
  return 1 + n * r.vol.n / 100;
}
function voler(p: Player, c: Carac, cibles: Monster[], w: World) {
  const r = R(p)!, s = etatSram(p), v = s.vols[c], mi = p.pcv('pc-sram-I');   // Mains agiles : plus long, 3 crans
  const max = r.vol.max + (mi ? 1 : 0), n = Math.min(max, (v && v.t > 0 ? v.n : 0) + 1);
  s.vols[c] = { n, t: r.vol.t + mi };
  for (const m of cibles) {
    const k = r.vol.n * (m.def.boss ? 0.5 : 1);
    if (m.furyPct > 0) continue;   // un monstre enragé garde sa Frénésie
    m.furyPct = Math.max(-k * max, m.furyPct - k); m.furyT = Math.max(m.furyT, r.vol.t + mi); m.furyFlat = 0;
  }
  const nom = { puissance: 'Puissance', force: 'Force', agilite: 'Agilité', chance: 'Chance', intelligence: 'Intelligence' }[c];
  w.emit({ k: 'status', x: p.x, y: p.y - 70, text: `+${nom}${n > 1 ? ` ×${n}` : ''}`, color: '#c9a0ff' });
}

// --- Ruse (1A) --------------------------------------------------------------------------------------------------------
export function gagnerRuse(p: Player, n: number, w: World) {
  if (!R(p) || n <= 0 || p.dead) return;
  const plein = p.rageFull;
  p.rage = Math.min(p.cls.rage.max, p.rage + n);
  if (!plein && p.rageFull) w.emit({ k: 'status', x: p.x, y: p.y - 80, text: 'Ruse pleine : le prochain piège compte double', color: '#d6b4ff' });
}

// --- Pièges (7A+7B) ---------------------------------------------------------------------------------------------------
export function poserPiege(p: Player, sort: string, x: number, y: number, gm: number, w: World, jumeau = false) {
  const r = R(p)!, s = etatSram(p);
  const q = w.walkable(x, y) ? { x, y } : w.map.nearestFree(x, y);
  const double = !jumeau && p.rageFull;
  if (double) { p.rage = 0; w.emit({ k: 'status', x: q.x, y: q.y - 30, text: 'Piège doublé', color: '#d6b4ff' }); }
  s.pieges.push({ id: s.prochain++, sort, x: q.x, y: q.y, t: p.pcv('pc-sram-D') ? r.pieges.arme : 0, double, gm });   // Mèche courte : armé aussitôt
  while (s.pieges.length > r.pieges.max) s.pieges.shift();   // le plus ancien disparaît
  const c = p.pcv('pc-sram-C');   // Piège jumeau : un second, identique, à une case
  if (!jumeau && c && w.rng.next() < c / 100) {
    const a = w.rng.next() * Math.PI * 2;
    poserPiege(p, sort, q.x + Math.cos(a) * CASE, q.y + Math.sin(a) * CASE, gm, w, true);
    w.emit({ k: 'status', x: q.x, y: q.y - 46, text: 'Piège jumeau', color: '#d6b4ff' });
  }
}
/** Fait sauter un piège : ses effets (deux fois s'il est doublé), le poison des légendaires plus tard. Renvoie les monstres touchés. */
export function declencher(p: Player, pg: Piege, w: World, mult = 1): number {
  const s = etatSram(p);
  s.pieges = s.pieges.filter(x => x !== pg);
  const d = p.cls.spells[pg.sort];
  const P = d?.sram?.piege;
  if (!d || !P) return 0;
  const r = P.r * CASE, fois = pg.double ? 2 : 1;
  const zone = () => w.monsters.filter(m => !m.dead && m.state !== 'spawn' && Math.hypot(m.x - pg.x, m.y - pg.y) <= r + m.radius);
  let n = 0;
  for (let i = 0; i < fois; i++) {
    const autour = P.parEnnemi ? w.monsters.filter(m => !m.dead && Math.hypot(m.x - pg.x, m.y - pg.y) <= (P.autour ?? 2) * CASE + m.radius).length : 0;
    const N = p.pcv('pc-sram-N');
    const hit: HitDef = { dmg: d.dmg * pg.gm * mult * (1 + p.pcv('pc-sram-D') / 100) * (1 + (P.parEnnemi ?? 0) * Math.max(0, autour - 1)), execute: N ? N / 100 : undefined, knock: (P.repousse ?? 0) * 342, element: d.element,
      pmLoss: d.pmLoss, attire: P.attire ? { px: P.attire * CASE, vers: 'centre' } : undefined, sort: pg.sort };
    const touches = zone();
    if (P.mortel && hit.dmg > 0) {   // Piège Mortel : plus fort sous la moitié des PV, cible par cible
      for (const m of touches.filter(m => m.hp < m.maxHp / 2)) w.applyHits(q => q === m, { ...hit, dmg: hit.dmg * (P.mortel - 1), knock: 0, attire: undefined, pmLoss: 0 }, pg.x, pg.y, 0);
    }
    if (hit.dmg > 0) for (const c of s.chakra) {
      const m = c.t > 0 ? touches.find(x => x.id === c.mid) : undefined;
      if (m) { const sp = p.cls.spells.chakra?.sram?.chakra; if (sp && p.soigner(hit.dmg * sp.part) > 0) w.emit({ k: 'status', x: p.x, y: p.y - 60, text: 'Chakra', color: '#7fdc7f' }); }
    }
    const f = p.pcv('pc-sram-F');   // Venin des pièges
    if (f && hit.dmg > 0) for (const m of touches) poison(p, m, hit.dmg * f / 100, d.element, w);
    const morts = touches.filter(m => !m.dead);
    for (const x of s.toxines) {
      const m = x.t > 0 ? touches.find(q => q.id === x.mid) : undefined;
      const tx = p.cls.spells.toxines;
      if (m && tx?.sram?.poison && tx.sram.toxines) poison(p, m, tx.sram.poison * (1 + tx.sram.toxines.par * (x.n - 1)), tx.element, w);
    }
    if (hit.dmg > 0 || hit.knock || hit.attire || hit.pmLoss) n = Math.max(n, w.hitCircle(pg.x, pg.y, r, hit));
    else n = Math.max(n, touches.length);
    const j = p.pcv('pc-sram-J');   // Butin facile : les monstres tués par le piège sèment des kamas
    if (j) for (const m of morts) if ((m.dead || m.hp <= 0) && !m.mannequin) {
      const K = REGLAGES_BUTIN.kamas, k = Math.round(w.monsterLevel(m) * (K.min + K.max) / 2 * j / 100);
      if (k > 0) w.semerKamas(k, m.x, m.y);
    }
    if (P.immobilise) for (const m of touches) {
      const t = P.immobilise * (m.def.boss ? 0.5 : 1);
      m.haste = Math.min(m.haste, 0.05); m.hasteT = Math.max(m.hasteT, t);
      if (m.state === 'idle' || m.state === 'return') w.aggroGroup(m);
      w.emit({ k: 'status', x: m.x, y: m.y - 30, text: 'Immobilisé', color: '#9ad15a' });
    }
  }
  w.emit({ k: 'spell', fx: 'burst', id: pg.sort, x: pg.x, y: pg.y, facing: 0, size: r, arc: 0, element: d.element, big: pg.double, boosted: pg.double });
  w.emit({ k: 'piege', id: pg.id, x: pg.x, y: pg.y, r });
  if (n > 0) gagnerRuse(p, R(p)!.ruse.parPiege * (pg.double ? 2 : 1), w);
  s.sautes++; if (s.double != null) s.sautesDouble++;
  return n;
}
/** Touche X (7B) : tous les pièges sautent d'un coup. Renvoie les monstres achevés par la détonation. */
export function detoner(p: Player, w: World): number {
  const s = p.sram;
  if (!s?.pieges.length || p.dead) return 0;
  const k0 = w.kills;
  const ch = p.pcv('pc-sram-M'), mult = 1 + ch / 100 * (s.pieges.length - 1);   // Détonation en chaîne
  for (const pg of [...s.pieges]) declencher(p, pg, w, mult);
  w.emit({ k: 'impact', hitstop: 0.06, shake: 0.012, big: true });
  const n = w.kills - k0, q = w.quetes;   // 8B « Le grand piège » : meilleure détonation, pour le perso de cet écran
  if (q && p === w.players[0] && n > (q.compteurs.grandPiege ?? 0)) q.compteurs.grandPiege = n;
  return n;
}

// --- Sorts ------------------------------------------------------------------------------------------------------------
/** Avant le coup d'un sort du Sram : vrai = aucun coup aux monstres (piège posé, Invisibilité, Double, Peur). */
export function avantImpactSram(p: Player, id: string, d: SpellDef, s: { tx: number; ty: number; gm: number }, w: World): boolean {
  const S = d.sram!, r = R(p)!;
  if (S.piege) { poserPiege(p, id, s.tx, s.ty, s.gm, w); return true; }
  if (S.invisible) {   // toi, ou l'allié visé (qui court aussi plus vite : « augmente ses PM si c'est un allié »)
    const q = w.players.find(j => j !== p && !j.dead && Math.hypot(j.x - s.tx, j.y - s.ty) <= j.radius + CASE * 0.6) ?? p;
    rendreInvisible(q, w, r.invisible.t);
    if (q !== p) q.courir(r.invisible.allie, r.invisible.t);
    return true;
  }
  if (S.double) {
    doubleDe(p, w)?.mourir(w);
    const b = w.invoquer(p, 'sram_double', id, s.tx, s.ty);
    const st = etatSram(p);
    if (b) { const g = p.pcv('pc-sram-G'); if (g) { b.maxHp = Math.round(b.maxHp * 1.5); b.hp = b.maxHp; }
      b.horsCompte = true; b.finT = (S.explose?.t ?? r.double.t) + g; st.double = b.id; st.sautesDouble = 0; st.explose = S.explose ? { sort: id, gm: s.gm } : null; }
    return true;
  }
  if (S.derobade) {
    const q = w.players.find(j => j !== p && !j.dead && Math.hypot(j.x - s.tx, j.y - s.ty) <= j.radius + CASE * 0.6) ?? p;
    q.shield = Math.max(q.shield, Math.round(q.maxHp * S.derobade.bouclier)); q.shieldT = q.shieldT0 = S.derobade.t; q.shieldSrc = id;
    q.courir(S.derobade.course, S.derobade.t);
    w.emit({ k: 'status', x: q.x, y: q.y - 70, text: 'Dérobade', color: '#b48cff' });
    return true;
  }
  if (S.brume) {
    const rr = d.hit.shape === 'point' || d.hit.shape === 'circle' ? d.hit.radius : CASE * 2;
    for (const q of w.players) if (!q.dead && Math.hypot(q.x - s.tx, q.y - s.ty) <= rr + q.radius) rendreInvisible(q, w, S.brume.t);
    for (const m of w.monsters) if (!m.dead && Math.hypot(m.x - s.tx, m.y - s.ty) <= rr + m.radius) {
      m.poMalus = Math.max(m.poMalus, S.brume.po); m.poMalusT = Math.max(m.poMalusT, 6);
    }
    return true;
  }
  if (S.chakra) {
    let best: Monster | null = null, bd = CASE;
    for (const q of w.monsters) { if (q.dead) continue; const dd = Math.hypot(q.x - s.tx, q.y - s.ty) - q.radius; if (dd < bd) { bd = dd; best = q; } }
    if (best) {
      const st = etatSram(p);
      st.chakra = st.chakra.filter(c => c.mid !== best!.id && c.t > 0); st.chakra.push({ mid: best.id, t: S.chakra.t });
      if (best.state === 'idle' || best.state === 'return') w.aggroGroup(best);
      w.emit({ k: 'status', x: best.x, y: best.y - 40, text: 'Chakra', color: '#c9a0ff' });
    }
    reveler(p, w);
    return true;
  }
  if (S.peur) { peur(p, s.tx, s.ty, w); return true; }
  return false;
}
/** Peur (3A) : 1er lancer sur un monstre (choisi, le sort est rendu), 2e lancer sur la case où l'envoyer. */
function peur(p: Player, tx: number, ty: number, w: World) {
  const r = R(p)!, s = etatSram(p);
  const m = s.peur != null && s.peurT > 0 ? w.monsters.find(q => q.id === s.peur && !q.dead) : undefined;
  if (m) {
    s.peur = null; s.peurT = 0;
    const dx = tx - m.x, dy = ty - m.y, d0 = Math.hypot(dx, dy);
    const L = Math.min(d0, r.peur.cases * CASE);
    if (L > 4 && !m.def.boss) { m.kx += dx / d0 * L * 7.13; m.ky += dy / d0 * L * 7.13; m.stun = Math.max(m.stun, 0.3); }
    else if (L > 4) { m.kx += dx / d0 * L * 3.5; m.ky += dy / d0 * L * 3.5; }   // boss : à moitié
    if (m.state === 'idle' || m.state === 'return') w.aggroGroup(m);
    w.emit({ k: 'status', x: m.x, y: m.y - 40, text: 'Peur', color: '#c9a0ff' });
    return;
  }
  let best: Monster | null = null, bd = CASE;
  for (const q of w.monsters) {
    if (q.dead || q.state === 'spawn') continue;
    const dd = Math.hypot(q.x - tx, q.y - ty) - q.radius;
    if (dd < bd) { bd = dd; best = q; }
  }
  // premier temps : le sort est rendu (PA, charge), on choisit la case au prochain lancer
  p.pa += p.paCost('peur'); p.cd.peur = 0; p.casts.peur?.pop();
  if (!best) return;
  s.peur = best.id; s.peurT = r.peur.attente;
  w.emit({ k: 'status', x: best.x, y: best.y - 46, text: 'Peur : vise la case', color: '#c9a0ff' });
}
/** Après le coup d'un sort du Sram : vols, poison, PM, et l'Invisibilité qui se montre. */
export function impactSram(p: Player, d: SpellDef, tx: number, ty: number, size: number, hits: number, gm: number, w: World) {
  const S = d.sram!;
  const zone = () => w.monsters.filter(m => !m.dead && m.state !== 'spawn' && Math.hypot(m.x - tx, m.y - ty) <= size + m.radius);
  if (S.vol && hits > 0) voler(p, S.vol, zone(), w);
  if (S.poison) {
    const z = zone(), st = etatSram(p);
    for (const m of z) {
      let k = 1;
      if (S.toxines) {   // Toxines : le poison grossit à chaque lancer sur la même cible
        let x = st.toxines.find(q => q.mid === m.id && q.t > 0);
        if (!x) { x = { mid: m.id, t: 0, n: 0 }; st.toxines = st.toxines.filter(q => q.t > 0); st.toxines.push(x); }
        x.n = Math.min(S.toxines.max, x.n + 1); x.t = S.toxines.t; k = 1 + S.toxines.par * (x.n - 1);
      }
      poison(p, m, S.poison * gm * k, d.element, w);
    }
    if (S.poLoss) for (const m of z) { m.poMalus = Math.max(m.poMalus, S.poLoss.n); m.poMalusT = Math.max(m.poMalusT, S.poLoss.t);
      w.emit({ k: 'status', x: m.x, y: m.y, text: `-${S.poLoss.n} PO`, color: '#c8a0ff' }); }
    if (z.length) reveler(p, w);
  }
  if (S.sautes) etatSram(p).sautes = 0;
  const k = S.pas ? p.pcv('pc-sram-K') : 0;   // Pas de l'ombre : invisible à l'arrivée
  if (k) { rendreInvisible(p, w, k); return; }
  const fi = p.pcv('pc-sram-P');   // Fiel : vol de vie en plus sur une cible empoisonnée
  if (fi && d.lifesteal && hits > 0 && zone().some(m => m.poisonT > 0)) p.soigner(w.degatsCoup * d.lifesteal * fi / 100);
  if (S.pm) p.pm = Math.min(p.cls.pm.max + S.pm, p.pm + S.pm);
  if (hits > 0) reveler(p, w);
}

/** Monstre achevé par ce Sram : Ruse ; achevé pendant l'Invisibilité, le sort se recharge. */
export function acheveSram(p: Player, w: World) {
  const r = R(p);
  if (!r) return;
  gagnerRuse(p, r.ruse.parAcheve, w);
  const b = p.pcv('pc-sram-B');   // Disparition : l'Invisibilité dure plus
  if (b && p.sram && p.sram.invisT > 0) p.sram.invisT += b;
  if (p.sram && p.sram.invisT > 0 && (p.cd.invisibilite > 0 || p.casts.invisibilite?.length)) { p.cd.invisibilite = 0; p.casts.invisibilite = []; }
}

/** Pas d'un joueur qui a un état Sram : Invisibilité, vols, Peur, Double, pièges qui s'arment et sautent au passage. */
export function majSram(p: Player, dt: number, w: World) {
  const s = p.sram!, r = REGLES(p, w);
  if (!r) return;
  if (s.invisT > 0) {
    s.invisT -= dt; if (s.reveleT > 0) s.reveleT -= dt;
    if (s.invisT <= 0 || p.dead) { s.invisT = 0; w.emit({ k: 'invisible', id: p.id, x: p.x, y: p.y, on: false }); }
  }
  for (const v of Object.values(s.vols)) if (v && v.t > 0) v.t -= dt;
  if (s.peurT > 0 && (s.peurT -= dt) <= 0) s.peur = null;
  const o = p.pcv('pc-sram-O');   // Nappe de brume : sous 30 % de PV, invisible (toutes les 20 s)
  if (o && !p.dead && p.hp < p.maxHp * 0.3 && p.age - s.brumeA >= 20) { s.brumeA = p.age; rendreInvisible(p, w, o); }
  for (const c of s.chakra) c.t -= dt;
  for (const x of s.toxines) x.t -= dt;
  if (s.chakra.length && s.chakra.every(c => c.t <= 0)) s.chakra = [];
  if (s.toxines.length && s.toxines.every(x => x.t <= 0)) s.toxines = [];
  if (s.double != null) {
    const b = w.betes.find(x => x.id === s.double);
    if (!b || b.dead) {
      s.double = null;
      const ex = s.explose, de = ex && p.cls.spells[ex.sort], E = de?.sram?.explose;
      if (b && ex && de && E) {   // Comploteur : le Double explose
        w.hitCircle(b.x, b.y, E.r * CASE, { dmg: de.dmg * ex.gm * (1 + E.parPiege * s.sautesDouble), knock: 0, element: de.element, sort: ex.sort });
        w.emit({ k: 'spell', fx: 'burst', id: ex.sort, x: b.x, y: b.y, facing: 0, size: E.r * CASE, arc: 0, element: de.element, big: true, boosted: false });
      }
      s.explose = null;
      const h = p.pcv('pc-sram-H');   // Double piégé : un Piège Sournois à sa place
      if (b && h && !p.dead && p.cls.spells.piege_sournois) poserPiege(p, 'piege_sournois', b.x, b.y, h / 100, w, true);
      if (b && !p.dead && w.walkable(b.x, b.y)) {   // 8A : à sa mort, tu prends sa place et tu files
        w.emit({ k: 'bondOug', x: p.x, y: p.y, tx: b.x, ty: b.y });
        p.x = b.x; p.y = b.y; p.courir(r.double.course, r.double.courseT);
        w.emit({ k: 'status', x: p.x, y: p.y - 60, text: 'Échange', color: '#c9a0ff' });
      }
    }
  }
  if (!s.pieges.length) return;
  for (const pg of [...s.pieges]) {
    pg.t += dt;
    if (pg.t >= r.pieges.duree) { s.pieges = s.pieges.filter(x => x !== pg); continue; }
    if (pg.t < r.pieges.arme || p.dead) continue;
    const dr = r.pieges.declenche * CASE;
    if (w.monsters.some(m => !m.dead && m.state !== 'spawn' && !m.intouchable && Math.hypot(m.x - pg.x, m.y - pg.y) <= dr + m.radius)) declencher(p, pg, w);
  }
}
