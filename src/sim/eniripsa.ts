import type { Element, SpellDef } from './defs';
import type { Bete } from './bete';
import type { Monster } from './monster';
import type { Player } from './player';
import type { World } from './world';

/** Eniripsa (maquette Eniripsa, ligne de Mathis du 9 nov. 2026 :
 *  « 1A 2A 3A+3C+3D 4B 5A+5B 6A+6B 7A 8A 9A 10B 11A 12A+12C 13A 14A 15A », 16A et 16C en légendaires).
 *  Mots officiels qui soignent les alliés et blessent les ennemis dans la même zone (1A), Éloquence (2A, mode de la jauge),
 *  soins sur soi à 60 % (4B), Encouragements et Fées (5A 5B), Moqueries et Feux Follets (6A 6B), Lapino (7A),
 *  Mot d'Envol (9A), Mot de Reconstitution qui relève à distance (10B), les soins attirent l'aggro (11A).
 *  Marche avec plusieurs joueurs : un soin vise n'importe quel joueur du monde, l'état soigné est rangé dans le joueur soigné. */

const CASE = 48, TOUR = 3;
/** Luciole : vitesse (× celle de l'Eniripsa), durée de vie (2 tours officiels), portée de recherche, nombre au plus par Eniripsa. */
export const LUCIOLE = { vitesse: 1.7, vie: 6, cherche: 8 * CASE, max: 2, soinPct: 0.06, insulte: 9 };

type Allie = Player | Bete;
/** Un soin remplit l'Éloquence et compte comme une action de combat (la jauge ne retombe pas). */
const eloquence = (p: Player, world: World) => { p.lastHitAt = p.age; p.addRage(p.cls.eniripsa?.parSoin ?? 0, world); };
const vivant = (e: { dead: boolean }) => !e.dead;

/** Soin d'un allié (joueur ou bête) par un joueur : l'Intelligence et les Soins du lanceur s'ajoutent (comme Dofus) ;
 *  sur lui-même, l'Eniripsa ne reçoit que soinSoi (4B) ; Insoignable (Mot de Reconstitution) bloque tout.
 *  brut : montant déjà calculé (Bisou Magique, Fées : % des PV max). Renvoie les PV rendus. */
export function soignerAllie(p: Player, q: Allie, base: number, world: World, o: { brut?: boolean; de?: Bete; x?: number; y?: number } = {}): number {
  if (q.dead || base <= 0) return 0;
  let n = o.brut ? base : base * (1 + Math.max(0, p.stat('intelligence')) / 100) + Math.max(0, p.stat('soins'));
  if (q === p && p.cls.eniripsa) n *= p.cls.eniripsa.soinSoi;
  if (q.faction === 'player') {
    const j = q as Player;
    if (j.insoignableT > 0) { world.emit({ k: 'status', x: j.x, y: j.y - 50, text: 'Insoignable', color: '#c8c8c8' }); return 0; }
    if (j.soinsRecusT > 0) n *= 1.2;
    const dm = p.pcv('pc-eniripsa-B');   // Dernier Mot (16C) : soin critique sur un allié sous 20 % de ses PV
    if (dm && j.hp < j.maxHp * 0.2) { n *= 1 + dm / 100; world.emit({ k: 'status', x: j.x, y: j.y - 70, text: 'Dernier Mot !', color: '#c8ffd8' }); }
  }
  const v = Math.max(0, Math.min(q.maxHp - q.hp, Math.round(n)));
  if (v > 0) {
    q.hp += v;
    world.emit({ k: 'heal', x: q.x, y: q.y, z: q.faction === 'player' ? 50 : 40, amount: v });
  }
  const tp = q.faction === 'player' ? p.pcv('pc-eniripsa-A') : 0, trop = Math.round(n) - v;
  if (tp && trop > 0) {   // Bouclier de trop-plein (16A) : le soin en trop devient un bouclier, 4 s
    const j = q as Player, max = Math.round(j.maxHp * tp / 100);
    const s = Math.min(max, (j.shieldSrc === 'pc-eniripsa-A' && j.shieldT > 0 ? j.shield : 0) + trop);
    if (s > j.shield || j.shieldSrc === 'pc-eniripsa-A') { j.shield = s; j.shieldT = j.shieldT0 = 4; j.shieldSrc = 'pc-eniripsa-A'; }
  }
  // 12C : fil de soin de l'Eniripsa (ou de son Lapino) vers l'allié soigné, vu de tous les joueurs
  const sx = o.de?.x ?? o.x ?? p.x, sy = o.de?.y ?? o.y ?? p.y;
  if (q !== p || o.de) world.emit({ k: 'filSoin', x: sx, y: sy, tx: q.x, ty: q.y, amount: v });
  if (v > 0 && q !== p && q.faction === 'player') attirerAggro(p, q as Player, world);
  return v;
}

/** 11A : un monstre en chasse près d'un allié soigné se tourne vers le soigneur, une fois sur deux, pendant quelques secondes. */
function attirerAggro(p: Player, q: Player, world: World) {
  const A = p.cls.eniripsa?.aggro;
  if (!A) return;
  for (const m of world.monsters) {
    if (m.dead || m.state === 'idle' || m.state === 'return' || m.state === 'spawn' || m.def.boss) continue;
    if (Math.hypot(m.x - q.x, m.y - q.y) > A.portee || m.viseJusqua > world.time) continue;
    if (world.rng.next() < A.chance) { m.viseId = p.id; m.viseJusqua = world.time + A.t; }
  }
}

/** L'allié (joueur vivant) le plus blessé à portée d'une bête, sous ce seuil de PV (Lapino). */
export function allieLePlusBlesse(world: World, b: Bete, seuil: number): Player | null {
  let best: Player | null = null, r = seuil;
  for (const q of world.players) {
    if (q.dead || Math.hypot(q.x - b.x, q.y - b.y) > 10 * CASE) continue;
    const k = q.hp / q.maxHp;
    if (k < r) { r = k; best = q; }
  }
  return best;
}

/** 3A : un Mot à cible unique s'aimante sur le perso (allié, bête ou monstre) le plus proche du curseur. */
export function aimanter(p: Player, def: SpellDef, aim: { x: number; y: number }, world: World): { x: number; y: number } {
  const E = p.cls.eniripsa;
  if (!E || def.move || def.hit.shape !== 'point' || def.hit.radius > 30) return aim;
  let best: { x: number; y: number } | null = null, bd = E.aimant;
  const voir = (e: { x: number; y: number; radius: number; dead: boolean }) => {
    if (e.dead) return;
    const d = Math.hypot(e.x - aim.x, e.y - aim.y) - e.radius;
    if (d < bd) { bd = d; best = { x: e.x, y: e.y }; }
  };
  if (!def.moque) { for (const q of world.players) voir(q); for (const b of world.betes) if (!b.luciole) voir(b); }
  if (!def.encourage && !def.reconstitution) for (const m of world.monsters) if (m.state !== 'spawn') voir(m);
  return best ?? aim;
}

/** Le joueur allié visé (le plus proche du point, à moins de r px) ; lui-même compris. */
function joueurAuPoint(world: World, x: number, y: number, r: number, sauf?: Player): Player | null {
  let best: Player | null = null, bd = r;
  for (const q of world.players) {
    if (q === sauf) continue;
    const d = Math.hypot(q.x - x, q.y - y) - q.radius;
    if (d < bd && (!q.dead || sauf)) { bd = d; best = q; }
  }
  return best;
}
function monstreAuPoint(world: World, x: number, y: number, r: number): Monster | null {
  let best: Monster | null = null, bd = r;
  for (const m of world.monsters) {
    if (m.dead || m.state === 'spawn') continue;
    const d = Math.hypot(m.x - x, m.y - y) - m.radius;
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}

/** Ce que fait un Mot à l'impact, côté alliés (les dommages aux ennemis passent par le chemin commun de Player).
 *  Renvoie vrai quand le Mot ne doit frapper aucun monstre (soutien pur, ou Mot à cible unique posé sur un allié). */
export function impactEniripsa(p: Player, id: string, d: SpellDef, tx: number, ty: number, r: number, mult: number, world: World): boolean {
  const pres = Math.max(30, r);
  let soigne = 0;
  // Mot de Reconstitution (10B) : relève à distance un allié à terre, sinon soin total d'un allié (pas le lanceur)
  if (d.reconstitution) {
    const R = d.reconstitution, q = joueurAuPoint(world, tx, ty, CASE, p);
    if (q?.dead) {
      world.releverAvecSort(q, R.releve);
      q.insoignableT = R.insoignable;
      p.cd[id] = p.cdMax[id] = R.relanceReleve;
      world.emit({ k: 'status', x: q.x, y: q.y - 60, text: 'Relevé !', color: '#7fc47a' });
      world.emit({ k: 'filSoin', x: p.x, y: p.y, tx: q.x, ty: q.y, amount: q.hp });
    } else if (q) {
      soigne += soignerAllie(p, q, q.maxHp, world, { brut: true });
      q.insoignableT = R.insoignable;
      world.emit({ k: 'status', x: q.x, y: q.y - 60, text: 'Insoignable', color: '#c8c8c8' });
    } else {
      const b = world.betes.find(o => vivant(o) && !o.luciole && Math.hypot(o.x - tx, o.y - ty) <= CASE);
      if (b) soigne += soignerAllie(p, b, b.maxHp, world, { brut: true });
    }
    if (soigne > 0) eloquence(p, world);
    return true;
  }
  // Mot d'Amitié : invoque le Lapino, ou le téléporte au point visé (officiel : relancé quand il est en vie)
  if (d.lapino) {
    const b = world.betes.find(o => o.owner === p && o.base === 'lapino' && vivant(o));
    if (b) {
      const ox = b.x, oy = b.y, f = world.walkable(tx, ty) ? { x: tx, y: ty } : world.map.nearestFree(tx, ty);
      b.x = f.x; b.y = f.y; b.cast = null; b.state = 'suit';
      world.emit({ k: 'echange', x: b.x, y: b.y, ox, oy });
    } else {
      const n = world.invoquer(p, 'lapino', id, tx, ty);
      if (n) n.horsCompte = true;   // ne prend pas la place d'une invocation de l'Osamodas (règle des bêtes)
    }
    return true;
  }
  // Encouragement (5A) sur l'allié visé ; sur une case libre, une Fée (5B)
  if (d.encourage) {
    const q = joueurAuPoint(world, tx, ty, pres);
    if (q && !q.dead) encourager(p, q, d, world);
    else lancerLuciole(p, 'fee', d.encourage.fee, id, tx, ty, world);
    return true;
  }
  // Moquerie (6A) sur l'ennemi visé ; sur une case libre, un Feu Follet (6B)
  if (d.moque) {
    const m = monstreAuPoint(world, tx, ty, pres);
    if (m) moquer(p, m, d, world);
    else lancerLuciole(p, 'feu', d.moque.feu, id, tx, ty, world);
    return true;
  }
  const unique = d.hit.shape === 'point' && d.hit.radius <= 30;
  const cx = d.hit.shape === 'circle' ? p.x : tx, cy = d.hit.shape === 'circle' ? p.y : ty;
  // Mot à cible unique posé sur un allié (Mot Vampirique, Farceur, Peinture, Interdit) : seulement l'effet allié
  const allie = unique ? joueurAuPoint(world, tx, ty, CASE * 0.6) : null;
  if (unique && allie && !allie.dead) {
    if (d.transfert && allie !== p) {   // Mot Vampirique : transfère une part de la vie du lanceur (jamais sous 1 PV)
      const n = Math.min(Math.round(p.hp * d.transfert), p.hp - 1);
      if (n > 0) { p.hp -= n; soigne += soignerAllie(p, allie, n, world, { brut: true }); }
    }
    if (d.soin) soigne += soignerAllie(p, allie, d.soin * mult, world);
    if (d.purge) purgerAllie(allie, world);
    if (d.peinture) peindreAllie(p, allie, d, world);
    if (soigne > 0) eloquence(p, world);
    return !!(d.soin || d.transfert || d.purge || d.peinture);
  }
  // Mot de zone : tous les alliés de la zone (le lanceur aussi, sauf Lamentations), bêtes comprises
  if (d.soin) {
    for (const q of world.players) if (!q.dead && (q !== p || d.soinLanceur !== false) && Math.hypot(q.x - cx, q.y - cy) <= r + q.radius) soigne += soignerAllie(p, q, d.soin * mult, world);
    for (const b of world.betes) if (!b.dead && !b.luciole && Math.hypot(b.x - cx, b.y - cy) <= r + b.radius) soigne += soignerAllie(p, b, d.soin * mult, world);
  }
  if (soigne > 0) eloquence(p, world);
  // Ennemi visé : effets propres au Mot (après les dommages, voir apresCoupEniripsa)
  return false;
}

/** Après les dommages aux ennemis : Lamentations soigne les alliés de la zone selon les dommages faits ; Farce, Peinture, purge. */
export function apresCoupEniripsa(p: Player, d: SpellDef, tx: number, ty: number, r: number, degats: number, world: World) {
  const cx = d.hit.shape === 'circle' ? p.x : tx, cy = d.hit.shape === 'circle' ? p.y : ty;
  if (d.soinVol && degats > 0) {
    const n = degats * d.soinVol;
    let soigne = 0;
    for (const q of world.players) if (!q.dead && (q !== p || d.soinLanceur !== false) && Math.hypot(q.x - cx, q.y - cy) <= r + q.radius) soigne += soignerAllie(p, q, n, world, { brut: true });
    for (const b of world.betes) if (!b.dead && !b.luciole && Math.hypot(b.x - cx, b.y - cy) <= r + b.radius) soigne += soignerAllie(p, b, n, world, { brut: true });
    if (soigne > 0) eloquence(p, world);
  }
  if (!d.farce && !d.peinture && !d.purge) return;
  for (const m of world.monsters) {
    if (m.dead || m.state === 'spawn' || Math.hypot(m.x - cx, m.y - cy) > Math.max(30, r) + m.radius) continue;
    if (d.farce && !m.def.boss) { p.farces = p.farces.filter(f => f.m !== m.id); p.farces.push({ m: m.id, x: m.x, y: m.y, t: d.farce }); }
    if (d.peinture) { m.peintT = d.peinture.t; m.peintK = d.peinture.poussee; world.emit({ k: 'status', x: m.x, y: m.y - 34, text: 'Peint', color: '#d9a35a' }); }
    if (d.purge && m.furyT > 0) { m.furyT = 0; m.furyPct = m.furyFlat = 0; world.emit({ k: 'status', x: m.x, y: m.y - 34, text: 'Bonus retirés', color: '#c8c8c8' }); }
  }
}

/** Encouragement (5A) : un seul à la fois par allié (cumul partagé officiel), le nouveau remplace l'ancien. */
export function encourager(p: Player, q: Player, d: SpellDef, world: World) {
  const E = d.encourage!;
  q.mods = q.mods.filter(m => m.src !== 'encourage');
  q.soinContinu = q.soinContinu.filter(s => s.src !== 'encourage');
  q.encourage = { k: E.k, t: E.t, t0: E.t, regen: E.regen ?? 0 };
  if (E.pm) q.addMod('pm', E.pm, E.t, 'encourage');
  if (E.vitesse) q.courir(E.vitesse, E.t);
  if (E.soinPct) {   // Jouvence : purge, soin immédiat puis soin continu (début de tour officiel = toutes les 3 s)
    purgerAllie(q, world);
    soignerAllie(p, q, q.maxHp * E.soinPct, world, { brut: true });
    q.soinContinu.push({ n: q.maxHp * E.soinPct / 2, t: E.t, next: TOUR, de: p.id, src: 'encourage' });
  }
  world.emit({ k: 'status', x: q.x, y: q.y - 60, text: 'Encouragé', color: '#9ff0c0' });
  if (q !== p) world.emit({ k: 'filSoin', x: p.x, y: p.y, tx: q.x, ty: q.y, amount: 0 });
}

/** Moquerie (6A) : ralentit l'ennemi (charges de PM en moins), moitié moins sur les élites et les boss. */
export function moquer(_p: Player, m: Monster, d: SpellDef, world: World) {
  const M = d.moque!, k = M.ralenti * (m.def.elite || m.def.boss ? 0.5 : 1);
  m.haste = Math.min(m.haste, 1 - k); m.hasteT = Math.max(m.hasteT, M.t);
  m.moqueT = m.moqueT0 = M.t;
  if (m.state === 'idle' || m.state === 'return') world.aggroGroup(m);
  world.emit({ k: 'status', x: m.x, y: m.y - 34, text: 'Moqué', color: '#e09aff' });
}

function purgerAllie(q: Player, world: World) {
  const avait = q.slowT > 0 || q.subis > 1 || q.pacifiste > 0 || q.mods.some(m => m.n < 0);
  q.slowT = 0; q.slowK = 0; if (q.subis > 1) { q.subis = 1; q.subisT = 0; } q.pacifiste = 0;
  q.mods = q.mods.filter(m => m.n >= 0);
  if (avait) world.emit({ k: 'status', x: q.x, y: q.y - 50, text: 'Malus retirés', color: '#9ff0c0' });
}

function peindreAllie(p: Player, q: Player, d: SpellDef, world: World) {
  const P = d.peinture!;
  q.soinContinu = q.soinContinu.filter(s => s.src !== 'peinture');
  q.soinContinu.push({ n: P.soin, t: P.t, next: TOUR, de: p.id, src: 'peinture' });
  world.emit({ k: 'status', x: q.x, y: q.y - 50, text: 'Peint', color: '#d9a35a' });
}

/** Fée ou Feu Follet (5B 6B) : 2 au plus par Eniripsa, la plus ancienne s'éteint pour laisser la place. */
function lancerLuciole(p: Player, kind: 'fee' | 'feu', cle: string, mot: string, x: number, y: number, world: World) {
  const miennes = world.betes.filter(b => b.owner === p && b.luciole && vivant(b));
  if (miennes.length >= LUCIOLE.max) miennes[0].mourir(world);
  const b = world.invoquer(p, cle, mot, x, y);
  if (!b) return;
  b.luciole = { kind, mot }; b.horsCompte = true; b.finT = LUCIOLE.vie;
}

/** Une Luciole file vers sa cible et y applique son Mot, puis s'éteint (à la moindre attaque, ou au bout de 6 s). */
export function lucioleMaj(b: Bete, dt: number, world: World) {
  const p = b.owner, L = b.luciole!;
  if (b.finT > 0 && (b.finT -= dt) <= 0 || p.dead) { b.mourir(world); return; }
  const d = p.cls.spells[L.mot];
  let cible: Player | Monster | null = null, bd = Infinity;
  if (L.kind === 'fee') {   // l'allié le plus blessé du groupe, sinon l'Eniripsa
    for (const q of world.players) {
      if (q.dead || Math.hypot(q.x - b.x, q.y - b.y) > LUCIOLE.cherche) continue;
      const k = q.hp / q.maxHp + Math.hypot(q.x - b.x, q.y - b.y) / 4000;
      if (k < bd) { bd = k; cible = q; }
    }
  } else {   // l'ennemi éveillé le plus proche
    for (const m of world.monsters) {
      if (m.dead || m.state === 'spawn' || m.state === 'idle' && Math.hypot(m.x - b.x, m.y - b.y) > CASE * 2) continue;
      const dd = Math.hypot(m.x - b.x, m.y - b.y);
      if (dd < bd && dd <= LUCIOLE.cherche) { bd = dd; cible = m; }
    }
  }
  if (!cible) { b.setAnim('idle'); return; }
  const dx = cible.x - b.x, dy = cible.y - b.y, dist = Math.hypot(dx, dy);
  b.facing = Math.atan2(dy, dx);
  if (dist > cible.radius + b.radius + 6) {
    const st = Math.min(dist, p.speed * LUCIOLE.vitesse * dt);
    b.x += dx / dist * st; b.y += dy / dist * st; b.setAnim('run');
    return;
  }
  if (cible.faction === 'player') {   // Compliment + l'Encouragement de son Mot
    const q = cible as Player;
    if (d?.encourage) encourager(p, q, d, world);
    soignerAllie(p, q, q.maxHp * LUCIOLE.soinPct, world, { brut: true, de: b });
  } else {   // Insulte + la Moquerie de son Mot
    const m = cible as Monster, el: Element = 'meilleur';
    world.coupDeBete(b, m, LUCIOLE.insulte, el);
    if (d?.moque) moquer(p, m, d, world);
  }
  world.emit({ k: 'spell', fx: 'burst', id: `luciole_${L.kind}`, x: cible.x, y: cible.y, facing: b.facing, size: 30, arc: 0, element: L.kind === 'fee' ? 'eau' : 'feu', big: false, boosted: false, discret: true });
  b.mourir(world);
}

/** Alchi-Rhétorique (7A, sorts 25930) : un Mot élémentaire qui touche le Lapino change l'élément de Lapinopoing
 *  et rend 1 PA (une fois par 3 s, le « tour » officiel). */
export function alchiRhetorique(p: Player, d: SpellDef, tx: number, ty: number, r: number, world: World) {
  if (d.element === 'neutre' || d.element === 'meilleur') return;
  const b = world.betes.find(o => o.owner === p && o.base === 'lapino' && vivant(o) && Math.hypot(o.x - tx, o.y - ty) <= Math.max(30, r) + o.radius);
  if (!b) return;
  b.alchi = d.element;
  if (p.age - p.alchiA >= TOUR) { p.alchiA = p.age; p.pa = Math.min(p.paMax, p.pa + 1); world.emit({ k: 'status', x: b.x, y: b.y - 40, text: '+1 PA', color: '#5aa8ff' }); }
  world.emit({ k: 'status', x: b.x, y: b.y - 56, text: `Lapino ${({ terre: 'Terre', feu: 'Feu', eau: 'Eau', air: 'Air' } as Record<string, string>)[d.element]}`, color: '#ffd87a' });
}

/** Chaque pas du joueur : Encouragement, soins continus (Jouvence, Peinture), Insoignable, Farces qui ramènent les ennemis. */
export function majEniripsa(p: Player, dt: number, world: World) {
  if (p.encourage && (p.encourage.t -= dt) <= 0) p.encourage = null;
  if (p.insoignableT > 0) p.insoignableT = Math.max(0, p.insoignableT - dt);
  if (p.soinContinu.length) {
    for (const s of p.soinContinu) {
      s.t -= dt; s.next -= dt;
      if (s.next <= 0 && s.t > -0.01) {
        s.next += TOUR;
        const de = world.players.find(q => q.id === s.de) ?? p;
        soignerAllie(de, p, s.n, world, { brut: true });
      }
    }
    p.soinContinu = p.soinContinu.filter(s => s.t > 0);
  }
  if (p.farces.length) {
    for (const f of p.farces) {
      f.t -= dt;
      if (f.t > 0) continue;
      const m = world.monsters.find(o => o.id === f.m && !o.dead);
      if (m && world.walkable(f.x, f.y)) {
        const ox = m.x, oy = m.y; m.x = f.x; m.y = f.y; m.kx = m.ky = 0;
        world.emit({ k: 'echange', x: m.x, y: m.y, ox, oy });
        world.emit({ k: 'status', x: m.x, y: m.y - 34, text: 'Farce !', color: '#9fd3ff' });
      }
    }
    p.farces = p.farces.filter(f => f.t > 0);
  }
}

/** Mot d'Envol (9A) : un allié (joueur ou bête) au point visé = échange de place ; sinon le saut normal a déjà eu lieu. */
export function envol(p: Player, sx: number, sy: number, tx: number, ty: number, world: World): boolean {
  let best: Allie | null = null, bd = CASE * 0.75;
  for (const q of [...world.players, ...world.betes]) {
    if (q === p || q.dead || (q as Bete).luciole) continue;
    const d = Math.hypot(q.x - tx, q.y - ty) - q.radius;
    if (d < bd) { bd = d; best = q; }
  }
  if (!best) return false;
  const bx = best.x, by = best.y;
  best.x = sx; best.y = sy; p.x = bx; p.y = by;
  world.emit({ k: 'echange', x: p.x, y: p.y, ox: sx, oy: sy });
  return true;
}
