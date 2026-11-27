import type { SpellDef } from './defs';
import type { Monster } from './monster';
import type { Player } from './player';
import type { HitDef, World } from './world';

/** Sorts officiels du niveau 91 à 120 (0.7, ligne « 0.7 : » 8A) : les variantes des dix classes, en temps réel.
 *  Données officielles (Dofus 3, spelllevels) ; 1 tour = 3 s, aucun effet différé : ce qui est « à retardement » ou « au début du tour »
 *  devient un coup de plus au contact suivant, ou un poison continu. La plupart des effets passent par les champs communs de SpellDef
 *  (attire, knock, affaiblit, e61.renfort…) ; ici, ce qu'aucun sort d'avant ne savait faire. Textes joueur : src/data/sorts_textes.json. */
export interface Effets07 {
  /** Dommages subis +n % pendant t s par les ennemis de la zone (Tir Perçant, Décimation, Déplumage, Gibier). */
  marque?: { n: number; t: number };
  /** Poison continu sur les ennemis touchés : part des dommages du sort, étalée sur t s (Flèche Harcelante, Feu de Brousse). */
  poison?: { part: number; t: number };
  /** Épée du Jugement : la cible est Condamnée t s ; la frapper de nouveau avec ce sort fait × mult (la « frappe à retardement »). */
  condamne?: { mult: number; t: number };
  /** Balise Tactique : attire de `cases` les ennemis à `rayon` cases de la balise ; +puissance par ennemi attiré, t s. */
  aimante?: { rayon: number; cases: number; puissance: number; t: number };
  /** États de l'Enutrof (Monnaie Sonnante, Orpaillage, Éboulement, Coup de Grisou) : n fois en t s, chaque autre sort de l'Enutrof
   *  qui touche la cible lui fait part × les dommages de ce sort en plus (autour d'elle à `zone` cases pour le Grisou). */
  echo?: { n: number; t: number; part: number; zone?: number };
  /** Perfusion : donne part des PV du lanceur, partagés entre les alliés à `rayon` cases (rien à Souffrance 6 ou plus). */
  transfert?: { part: number; rayon: number };
  /** Soigne le lanceur et les alliés à `rayon` cases du point visé de part des PV max (Galanterie, Langue Râpeuse). */
  soin?: { part: number; rayon: number };
  /** Montée de Sève : les alliés de la zone (pas le lanceur) sont soignés de cette part des dommages faits. */
  soinDegats?: number;
  /** Muselière : +par de dommages pour chaque ennemi au contact du lanceur. */
  contact?: { par: number };
  /** Pistage : après la poussée, le lanceur bondit de `cases` vers la cible. */
  rapproche?: { cases: number };
}

/** État propre à un joueur (dans Player, jamais dans World). */
export interface Etat07 {
  condamnes: { mid: number; t: number }[];
  echos: { mid: number; sid: string; n: number; t: number; dmg: number; el: SpellDef['element']; zone: number }[];
}
const CASE = 48;
export const etat07 = (): Etat07 => ({ condamnes: [], echos: [] });
const etat = (p: Player): Etat07 => (p.e07 ??= etat07());

function cible(world: World, x: number, y: number, marge = CASE * 0.8): Monster | null {
  let best: Monster | null = null, bd = Infinity;
  for (const m of world.monsters) {
    if (m.dead || m.state === 'spawn') continue;
    const d = Math.hypot(m.x - x, m.y - y) - m.radius;
    if (d <= marge && d < bd) { best = m; bd = d; }
  }
  return best;
}
const dans = (world: World, x: number, y: number, r: number) =>
  world.monsters.filter(m => !m.dead && m.state !== 'spawn' && Math.hypot(m.x - x, m.y - y) <= r + m.radius);
const statut = (world: World, x: number, y: number, text: string, color = '#ffb347') => world.emit({ k: 'status', x, y: y - 60, text, color });

/** Avant le coup : multiplicateur des dommages (Épée du Jugement sur un Condamné, Muselière). */
export function avantImpact07(p: Player, d: SpellDef, tx: number, ty: number, world: World): number {
  const s = d.e07!;
  let mult = 1;
  if (s.condamne) {
    const m = cible(world, tx, ty), e = etat(p);
    if (m && e.condamnes.some(c => c.mid === m.id)) { mult *= s.condamne.mult; statut(world, m.x, m.y, 'Jugement !', '#7fc8ff'); }
  }
  if (s.contact) {
    const n = world.monsters.filter(m => !m.dead && m.state !== 'spawn' && Math.hypot(m.x - p.x, m.y - p.y) <= m.radius + p.radius + CASE * 0.6).length;
    mult *= 1 + s.contact.par * n;
  }
  return mult;
}

/** Après le coup : effets du sort (d.e07), puis les états de l'Enutrof déclenchés par n'importe quel autre de ses sorts. */
export function impact07(p: Player, id: string, d: SpellDef, tx: number, ty: number, size: number, hit: HitDef, gm: number, world: World) {
  const s = d.e07, e = etat(p), r = Math.max(size, CASE * 0.6);
  // états de l'Enutrof : un autre sort touche une cible marquée
  for (const c of e.echos) {
    if (c.sid === id || c.n <= 0 || !(hit.dmg > 0)) continue;
    const m = world.monsters.find(x => x.id === c.mid && !x.dead);
    if (!m || Math.hypot(m.x - tx, m.y - ty) > r + m.radius) continue;
    c.n--;
    world.hitCircle(m.x, m.y, c.zone ? c.zone * CASE : 1, { dmg: c.dmg, knock: 0, element: c.el, sort: c.sid });
  }
  e.echos = e.echos.filter(c => c.n > 0);
  if (!s) return;
  if (s.marque) world.markVuln(tx, ty, r, s.marque.n, s.marque.t);
  if (s.poison && hit.dmg > 0) for (const m of dans(world, tx, ty, r)) {
    m.poison = Math.max(m.poisonT > 0 ? m.poison : 0, hit.dmg * s.poison.part / s.poison.t); m.poisonT = s.poison.t; m.poisonEl = p.resolveElement(d.element);
  }
  if (s.condamne) {
    const m = cible(world, tx, ty);
    if (m) { e.condamnes = e.condamnes.filter(c => c.mid !== m.id); e.condamnes.push({ mid: m.id, t: s.condamne.t }); statut(world, m.x, m.y, 'Condamné', '#7fc8ff'); }
  }
  if (s.echo) {
    const m = cible(world, tx, ty);
    if (m) {
      e.echos = e.echos.filter(c => !(c.mid === m.id && c.sid === id));
      e.echos.push({ mid: m.id, sid: id, n: s.echo.n, t: s.echo.t, dmg: d.dmg * gm * s.echo.part, el: d.element, zone: s.echo.zone ?? 0 });
      statut(world, m.x, m.y, d.name, '#f2c94c');
    }
  }
  if (s.aimante) {
    const A = s.aimante, l = dans(world, tx, ty, A.rayon * CASE).filter(m => !m.def.boss);
    for (const m of l) {
      const d0 = Math.hypot(tx - m.x, ty - m.y), L = Math.min(A.cases * CASE, Math.max(0, d0 - CASE * 0.5));
      if (L > 0 && d0 > 0) { m.kx += (tx - m.x) / d0 * L * 7.13; m.ky += (ty - m.y) / d0 * L * 7.13; }
    }
    if (l.length) { p.mods = p.mods.filter(m => m.src !== 'balise07'); p.addMod('puissance', A.puissance * l.length, A.t, 'balise07'); statut(world, p.x, p.y, `+${A.puissance * l.length} Puissance`); }
  }
  if (s.transfert && p.souffrance < 6) {
    const allies = world.players.filter(q => q !== p && !q.dead && Math.hypot(q.x - p.x, q.y - p.y) <= s.transfert!.rayon * CASE + q.radius);
    if (allies.length) {
      const don = Math.min(p.hp - 1, Math.round(p.hp * s.transfert.part));
      p.hp -= don;
      for (const q of allies) { const v = q.soigner(don / allies.length); if (v) world.emit({ k: 'heal', x: q.x, y: q.y, z: 50, amount: v }); }
    }
  }
  if (s.soin) {
    for (const q of world.players) {
      if (q.dead || (q !== p && Math.hypot(q.x - tx, q.y - ty) > s.soin.rayon * CASE + q.radius)) continue;
      const v = q.soigner(q.maxHp * s.soin.part); if (v) world.emit({ k: 'heal', x: q.x, y: q.y, z: 50, amount: v });
    }
  }
  if (s.soinDegats && world.degatsCoup > 0) {
    for (const q of world.players) {
      if (q === p || q.dead || Math.hypot(q.x - tx, q.y - ty) > r + q.radius) continue;
      const v = q.soigner(world.degatsCoup * s.soinDegats); if (v) world.emit({ k: 'heal', x: q.x, y: q.y, z: 50, amount: v });
    }
  }
  if (s.rapproche) {
    const a = Math.atan2(ty - p.y, tx - p.x);
    for (let i = 0; i < s.rapproche.cases * 4; i++) {
      const nx = p.x + Math.cos(a) * CASE / 4, ny = p.y + Math.sin(a) * CASE / 4;
      if (!world.walkable(nx, ny)) break;
      p.x = nx; p.y = ny;
    }
  }
}

/** Chaque pas du joueur : les états s'usent. */
export function maj07(p: Player, dt: number) {
  const e = p.e07!;
  for (const c of e.condamnes) c.t -= dt;
  for (const c of e.echos) c.t -= dt;
  e.condamnes = e.condamnes.filter(c => c.t > 0);
  e.echos = e.echos.filter(c => c.t > 0 && c.n > 0);
}
