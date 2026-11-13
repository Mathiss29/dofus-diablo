import type { SpellDef } from './defs';
import type { Monster } from './monster';
import type { Player } from './player';
import type { HitDef, World } from './world';
import { soignerAllie } from './eniripsa';

/** Sorts officiels du niveau 61 au 90 (0.6, ligne « 0.6 : … 7A+7C ») de la Forgelance, de l'Eniripsa et de l'Enutrof
 *  (ceux de l'Écaflip passent par src/sim/ecaflip.ts, avec le palier 2 du Poker). Règle temps réel : un tour officiel = 3 s,
 *  aucun effet différé (les effets « au tour suivant » deviennent instantanés, ou une aura qui dure).
 *  Les états posés sur les monstres sont rangés dans Monster.e06 (un objet, null sans effet) ; ceux d'un joueur dans Player. */

const CASE = 48;

/** Effets des sorts 61-90 (SpellDef.s06), joués après l'impact par impactSorts06. */
export interface Effets06 {
  /** Terre du Milieu : +n Puissance par ennemi touché (au plus max), pendant t s. */
  puissanceParEnnemi?: { n: number; t: number; max: number };
  /** Chevalerie : soin (part des PV max) et course en plus des alliés de la zone autour du lanceur. */
  chevalerie?: { soin: number; course: number; t: number };
  /** Jormun : ligne jusqu'à la Lance (ou devant soi sans Lance) ; sur soi, vague plus faible (part soi) autour de soi et de la Lance. */
  jormun?: { soi: number; rayon: number; largeur: number };
  /** Poinçon : la Lance plantée immobilise les ennemis à rayon px pendant t s. */
  poincon?: { t: number; rayon: number };
  /** Noa : état Noa t s ; un choc contre un obstacle déclenche un second coup Air (part des dommages du sort). */
  noa?: { t: number; part: number };
  /** Éclipse : bouclier (part des PV max, t s) du lanceur et des alliés à rayon px ; la Lance part sur la case visée (Disque de Sigel),
   *  ou le Croissant de Mani autour du lanceur s'il vise ses pieds. */
  eclipse?: { bouclier: number; t: number; rayon: number };
  /** Chapardage : le lanceur gagne la Portée volée (n) pendant t s. */
  volPortee?: { n: number; t: number };
  /** Mot Fleuri : état Floraison t s ; les alliés à rayon px d'un ennemi fleuri regagnent soinPct de leurs PV max par seconde. */
  floraison?: { t: number; rayon: number; soinPct: number };
  /** Pinceau Tribal : Peinture tribale t s ; sur un ennemi déjà peint, propage à rayon px (part des dommages) ;
   *  sur soi, fait éclater toutes les Peintures à portee px (+parEnnemi par ennemi), +poussee Dommages Poussée par allié proche. */
  tribal?: { t: number; rayon: number; propage: number; parEnnemi: number; poussee: number; portee: number };
  /** Cryothérapie : bouclier sur l'allié ; sur l'ennemi, ralenti t s, et l'état éclate (soin et dommages Eau à rayon px, part des dommages)
   *  quand l'ennemi meurt ou reçoit une autre Cryothérapie. */
  cryo?: { t: number; ralenti: number; bouclier: number; rayon: number; part: number };
  /** Corruption : l'ennemi ne peut ni attaquer ni être blessé t s (moitié sur un boss) ; un allié est soigné (part des PV max) et Pacifiste. */
  corruption?: { t: number; soin: number };
  /** Retraite Anticipée : immobilise les ennemis de la zone t s (moitié sur un boss) ; le lanceur perd ses charges de PM. */
  retraite?: { t: number };
}

/** États des sorts 61-90 sur un monstre (Monster.e06). de = id du joueur qui l'a posé. */
export interface Etats06 {
  noa?: { t: number; dmg: number; de: number };
  fleur?: { t: number; rayon: number; soinPct: number; de: number; acc: number };
  tribal?: { t: number; de: number };
  cryo?: { t: number; dmg: number; rayon: number; de: number };
  corrompu?: { t: number; avant: boolean };
  racine?: { t: number };
}

const etats = (m: Monster): Etats06 => (m.e06 ??= {});
const joueur = (world: World, id: number) => world.players.find(q => q.id === id) ?? null;
const vivants = (world: World, x: number, y: number, r: number) =>
  world.monsters.filter(m => !m.dead && m.state !== 'spawn' && Math.hypot(m.x - x, m.y - y) <= r + m.radius);
function monstreAuPoint(world: World, x: number, y: number, r: number): Monster | null {
  let best: Monster | null = null, bd = r;
  for (const m of world.monsters) {
    if (m.dead || m.state === 'spawn') continue;
    const d = Math.hypot(m.x - x, m.y - y) - m.radius;
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}
function joueurAuPoint(world: World, x: number, y: number, r: number): Player | null {
  let best: Player | null = null, bd = r;
  for (const q of world.players) { if (q.dead) continue; const d = Math.hypot(q.x - x, q.y - y) - q.radius; if (d < bd) { bd = d; best = q; } }
  return best;
}
function soin(q: Player, n: number, world: World) {
  const v = q.soigner(n);
  if (v > 0) world.emit({ k: 'heal', x: q.x, y: q.y, z: 50, amount: v });
}
const statut = (world: World, x: number, y: number, text: string, color: string) => world.emit({ k: 'status', x, y, text, color });
/** Immobilise un monstre t s (la moitié sur un boss) : il ne bouge presque plus, mais frappe encore au contact. */
function enraciner(m: Monster, t: number) {
  const e = etats(m), d = m.def.boss ? t / 2 : t;
  e.racine = { t: Math.max(e.racine?.t ?? 0, d) };
}
/** Vise-t-on ses propres pieds (« sur le lanceur ») ? */
const surSoi = (p: Player, tx: number, ty: number) => Math.hypot(tx - p.x, ty - p.y) < CASE * 0.75;

/** Après l'impact d'un sort à effets s06. hit = coup du sort (dommages déjà multipliés). Renvoie la taille de l'effet visuel, si elle change. */
export function impactSorts06(p: Player, id: string, d: SpellDef, tx: number, ty: number, hits: number, hit: HitDef, world: World): number | void {
  const E = d.s06;
  if (!E) return;
  const coup = (o: Partial<HitDef>) => ({ ...hit, ...o, sort: id });

  // --- Forgelance ---------------------------------------------------------------------------------------------------
  if (E.puissanceParEnnemi && hits > 0) {
    const P = E.puissanceParEnnemi, n = Math.min(P.max, hits) * P.n;
    p.mods = p.mods.filter(m => m.src !== id);
    p.addMod('puissance', n, P.t, id);
    statut(world, p.x, p.y - 60, `+${n} Puissance`, '#e8b860');
  }
  if (E.chevalerie) {
    const C = E.chevalerie, r = d.hit.shape === 'circle' ? d.hit.radius : CASE * 2.5;
    for (const q of world.players) if (!q.dead && Math.hypot(q.x - p.x, q.y - p.y) <= r + q.radius) {
      soin(q, q.maxHp * C.soin, world); q.courir(C.course, C.t);
    }
    for (const b of world.betes) if (!b.dead && Math.hypot(b.x - p.x, b.y - p.y) <= r + b.radius) b.soigner(b.maxHp * C.soin, world);
    statut(world, p.x, p.y - 60, 'Chevalerie', '#9fe08a');
  }
  if (E.jormun) {
    const J = E.jormun, L = p.lance;
    let size = 60;
    if (L && surSoi(p, tx, ty)) {   // sur le lanceur : vague plus faible autour de lui et de la Lance (une seule fois par ennemi)
      const deja = new Set<number>();
      for (const [x, y] of [[p.x, p.y], [L.x, L.y]]) for (const m of vivants(world, x, y, J.rayon)) deja.add(m.id);
      world.applyHits(m => deja.has(m.id), coup({ dmg: hit.dmg * J.soi, knock: 0 }), p.x, p.y, 0);
      size = J.rayon;
    } else {   // ligne jusqu'à la Lance, sinon devant soi jusqu'à la portée du sort
      const a = L ? Math.atan2(L.y - p.y, L.x - p.x) : p.facing;
      const len = L ? Math.hypot(L.x - p.x, L.y - p.y) : d.hit.shape === 'line' ? d.hit.length : CASE * 8;
      p.facing = a;
      world.hitLine(p.x, p.y, a, len, J.largeur, coup({}));
      size = len;
    }
    if (L) p.rappelerLance(world);
    return size;
  }
  if (E.poincon) {   // la Lance est rappelée puis plantée sur la case visée, en état Poinçon
    p.planterLance(tx, ty, world);
    p.poinconT = E.poincon.t; p.poinconR = E.poincon.rayon; statut(world, tx, ty - 50, 'Poinçon', '#e8b860');
  }
  if (E.noa) for (const m of vivants(world, tx, ty, d.hit.shape === 'point' ? d.hit.radius : CASE)) {
    etats(m).noa = { t: E.noa.t, dmg: Math.max(1, Math.round(hit.dmg * E.noa.part)), de: p.id };
  }
  if (E.eclipse) {
    const C = E.eclipse;
    for (const q of world.players) if (!q.dead && Math.hypot(q.x - p.x, q.y - p.y) <= C.rayon + q.radius) {
      q.shield = Math.max(q.shield, Math.round(q.maxHp * C.bouclier)); q.shieldT = q.shieldT0 = C.t; q.shieldSrc = id;
    }
    if (surSoi(p, tx, ty)) {   // Croissant de Mani : la Lance tourne autour du lanceur et repousse
      world.repousser(p.x, p.y, C.rayon, 520);
      statut(world, p.x, p.y - 70, 'Croissant de Mani', '#ffd87a');
    } else {   // Disque de Sigel : la Lance reste plantée sur la case visée (Désarmé)
      p.planterLance(tx, ty, world);
      statut(world, tx, ty - 50, 'Disque de Sigel', '#ffd87a');
    }
  }

  // --- Eniripsa -----------------------------------------------------------------------------------------------------
  if (E.volPortee && hits > 0) {
    p.mods = p.mods.filter(m => m.src !== id);
    p.addMod('portee', E.volPortee.n, E.volPortee.t, id);
  }
  if (E.floraison) {
    const F = E.floraison;
    for (const m of vivants(world, tx, ty, d.hit.shape === 'point' ? d.hit.radius : CASE)) {
      etats(m).fleur = { t: F.t, rayon: F.rayon, soinPct: F.soinPct, de: p.id, acc: 0 };
      statut(world, m.x, m.y - 34, 'Floraison', '#f2a6d8');
    }
  }
  if (E.tribal) {
    const T = E.tribal;
    if (surSoi(p, tx, ty)) {   // sur soi : toutes les Peintures éclatent
      const peints = world.monsters.filter(m => !m.dead && m.e06?.tribal && m.e06.tribal.de === p.id && Math.hypot(m.x - p.x, m.y - p.y) <= T.portee);
      const allies = world.players.filter(q => q !== p && !q.dead && Math.hypot(q.x - p.x, q.y - p.y) <= CASE * 3).length;
      if (peints.length) {
        const ids = new Set(peints.map(m => m.id));
        for (const m of peints) delete m.e06!.tribal;
        world.applyHits(m => ids.has(m.id), coup({ dmg: hit.dmg * (1 + T.parEnnemi * peints.length), knock: 0 }), p.x, p.y, 0);
        statut(world, p.x, p.y - 70, `Peintures éclatées : ${peints.length}`, '#d9a35a');
      }
      if (allies) { p.mods = p.mods.filter(m => m.src !== id); p.addMod('dommagesPoussee', T.poussee * allies, 9, id); }
    } else {
      const cible = monstreAuPoint(world, tx, ty, CASE * 0.75);
      if (cible?.e06?.tribal) {   // déjà peinte : la Peinture se propage, soigne les alliés et frappe en zone
        world.hitCircle(cible.x, cible.y, T.rayon, coup({ dmg: hit.dmg * T.propage, knock: 0 }));
        for (const q of world.players) if (!q.dead && Math.hypot(q.x - cible.x, q.y - cible.y) <= T.rayon + q.radius) soignerAllie(p, q, (d.soin ?? 0) * T.propage, world);
        for (const m of vivants(world, cible.x, cible.y, T.rayon)) etats(m).tribal = { t: T.t, de: p.id };
        statut(world, cible.x, cible.y - 40, 'La peinture se propage', '#d9a35a');
      } else if (cible) { etats(cible).tribal = { t: T.t, de: p.id }; statut(world, cible.x, cible.y - 34, 'Peint', '#d9a35a'); }
    }
  }
  if (E.cryo) {
    const C = E.cryo, q = joueurAuPoint(world, tx, ty, CASE * 0.6), m = q ? null : monstreAuPoint(world, tx, ty, CASE * 0.75);
    if (q) {
      q.shield = Math.max(q.shield, Math.round(q.maxHp * C.bouclier)); q.shieldT = q.shieldT0 = C.t; q.shieldSrc = id;
      statut(world, q.x, q.y - 60, 'Cryothérapie', '#8fd8ff');
    } else if (m && !m.dead) {
      if (m.e06?.cryo) eclaterCryo(world, m);   // une autre Cryothérapie : l'état éclate, puis revient
      etats(m).cryo = { t: C.t, dmg: Math.max(1, Math.round(hit.dmg * C.part)), rayon: C.rayon, de: p.id };
      m.haste = Math.min(m.haste, 1 - C.ralenti); m.hasteT = Math.max(m.hasteT, C.t);
    }
  }

  // --- Enutrof ------------------------------------------------------------------------------------------------------
  if (E.corruption) {
    const C = E.corruption, m = monstreAuPoint(world, tx, ty, CASE * 0.75);
    if (m && !m.intouchable) {
      const e = etats(m);
      e.corrompu = { t: m.def.boss ? C.t / 2 : C.t, avant: false };
      m.intouchable = true;
      statut(world, m.x, m.y - 40, 'Corrompu', '#b48aff');
    } else if (!m) {
      const q = joueurAuPoint(world, tx, ty, CASE);
      if (q) { soin(q, q.maxHp * C.soin, world); q.pacifiste = Math.max(q.pacifiste, C.t); q.pacifisteT0 = C.t; statut(world, q.x, q.y - 60, 'Pacifiste', '#c8c8c8'); }
    }
  }
  if (E.retraite) {
    const r = d.hit.shape === 'circle' ? d.hit.radius : CASE * 3;
    for (const m of vivants(world, p.x, p.y, r)) enraciner(m, E.retraite.t);
    p.pm = 0;   // « Immobilise le lanceur au tour suivant » : il perd tout de suite ses charges de PM
    statut(world, p.x, p.y - 60, 'Retraite Anticipée', '#e8d27a');
  }
}

/** L'état Cryothérapie éclate : soin des alliés et dommages Eau autour du monstre. */
function eclaterCryo(world: World, m: Monster) {
  const c = m.e06?.cryo;
  if (!c) return;
  delete m.e06!.cryo;
  const p = joueur(world, c.de);
  if (!p) return;
  world.commeJoueur(p, () => world.hitCircle(m.x, m.y, c.rayon, { dmg: c.dmg, knock: 0, element: 'eau', sort: 'cryotherapie' }));
  for (const q of world.players) if (!q.dead && Math.hypot(q.x - m.x, q.y - m.y) <= c.rayon + q.radius) soignerAllie(p, q, c.dmg, world, { brut: true, x: m.x, y: m.y });
  world.emit({ k: 'spell', fx: 'burst', id: 'cryotherapie', x: m.x, y: m.y, cx: m.x, cy: m.y, facing: 0, size: c.rayon, arc: 0, element: 'eau', big: false, boosted: false });
}

/** Noa : le monstre marqué heurte un obstacle (dommages de poussée) : second coup Air, et l'état part. */
export function chocNoa(world: World, m: Monster) {
  const n = m.e06?.noa;
  if (!n || m.dead) return;
  delete m.e06!.noa;
  m.hp -= n.dmg; m.flash = 0.09;
  world.emit({ k: 'hit', target: 'monster', id: m.id, x: m.x, y: m.y, z: m.radius * 2 + 40, amount: n.dmg, crit: false, element: 'air', sort: 'noa' });
  world.emit({ k: 'status', x: m.x, y: m.y - 40, text: 'Noa !', color: '#7fe0a0' });
}

/** Un monstre meurt : la Cryothérapie qu'il portait éclate. */
export function mortSorts06(world: World, m: Monster) {
  if (m.e06?.cryo) eclaterCryo(world, m);
}

/** À chaque pas, pour un monstre qui porte un état des sorts 61-90 : minuteries, Floraison, Corruption, immobilisation. */
export function pasMonstre06(world: World, m: Monster, dt: number) {
  const e = m.e06!;
  if (m.dead) { m.e06 = null; return; }
  if (e.noa && (e.noa.t -= dt) <= 0) delete e.noa;
  if (e.tribal && (e.tribal.t -= dt) <= 0) delete e.tribal;
  if (e.cryo && (e.cryo.t -= dt) <= 0) delete e.cryo;
  if (e.racine) {
    if ((e.racine.t -= dt) <= 0) { delete e.racine; m.haste = 1; m.hasteT = 0; }
    else { m.haste = Math.min(m.haste, 0.05); m.hasteT = Math.max(m.hasteT, 0.1); }
  }
  if (e.corrompu) {   // Pacifiste et Invulnérable
    if ((e.corrompu.t -= dt) <= 0) { m.intouchable = e.corrompu.avant; delete e.corrompu; }
    else { m.atkCd = Math.max(m.atkCd, 0.3); if (m.state === 'windup' || m.state === 'lunge') m.state = 'chase'; }
  }
  if (e.fleur) {
    const F = e.fleur;
    F.acc += dt;
    if (F.acc >= 1) {   // une fois par seconde, les alliés autour de l'ennemi fleuri sont soignés
      F.acc -= 1;
      const p = joueur(world, F.de);
      if (p) for (const q of world.players) if (!q.dead && q.hp < q.maxHp && Math.hypot(q.x - m.x, q.y - m.y) <= F.rayon + q.radius)
        soignerAllie(p, q, q.maxHp * F.soinPct, world, { brut: true, x: m.x, y: m.y });
    }
    if ((F.t -= dt) <= 0) delete e.fleur;
  }
  if (!e.noa && !e.fleur && !e.tribal && !e.cryo && !e.corrompu && !e.racine) m.e06 = null;
}

/** À chaque pas du joueur : Poinçon (la Lance immobilise les ennemis à son contact). */
export function pasJoueur06(p: Player, dt: number, world: World) {
  if (!p.lance || p.dead) { p.poinconT = 0; return; }
  p.poinconT -= dt;
  for (const m of vivants(world, p.lance.x, p.lance.y, p.poinconR)) enraciner(m, 0.2);
}
