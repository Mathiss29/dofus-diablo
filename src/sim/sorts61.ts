import type { Element, SpellDef } from './defs';
import type { Stat } from './items';
import type { Monster } from './monster';
import type { Player } from './player';
import type { HitDef, World } from './world';

/** Sorts officiels du niveau 61 à 90 (0.6, ligne « 0.6 : 7A+7C ») : Iop, Crâ, Osamodas, Sacrieur, en temps réel.
 *  Données officielles (Dofus 3.7, spelllevels) adaptées en secondes : 1 tour = 3 s, aucun effet différé (réaction immédiate
 *  ou aura continue, règle temps réel). Les textes joueur sont dans src/data/sorts_textes.json. */
export interface Effets61 {
  /** Friction (Iop) : pendant t s, l'ennemi visé est tiré vers son agresseur ; sur un allié, ses agresseurs (rayon cases) vers lui. */
  friction?: { t: number; rayon: number; pas: number };
  /** Précipitation (Iop) : l'allié visé (joueur ou bête, pas le lanceur) regagne ses PA × vite pendant t s, puis × lent pendant t s. */
  precipitation?: { vite: number; lent: number; t: number };
  /** Épée du Destin (Iop) : dommages en plus selon le temps depuis le dernier lancer (+max au bout de plein s). */
  destin?: { max: number; plein: number };
  /** Emprise (Iop) : l'ennemi visé est figé et ne prend plus de dommages pendant t s (pas les boss). */
  emprise?: { t: number };
  /** Tir de Repli (Crâ) : recule de n cases loin de l'ennemi visé, ou s'approche de l'allié visé. */
  repli?: { cases: number };
  /** Flèche Dévorante (Crâ) : multiplicateur des dommages par lancer d'affilée sur le même ennemi, dernier coup Feu (même échelle)
   *  quand on change de cible ou qu'on ne la relance pas pendant t s. */
  devorante?: { mult: number[]; dernier: number[]; t: number };
  /** Acuité Absolue (Crâ) : pendant t s, plus aucune ligne de vue demandée (le Critique en plus passe par `buff`). */
  acuite?: { t: number };
  /** Hit : soins reçus par la cible réduits de n (part) pendant t s (Flèche d'Expiation, Hécatombe) ; dommages × k sur un ennemi
   *  qui a un bouclier (Flèche Perforante). */
  antiSoin?: { n: number; t: number }; vsBouclier?: number;
  /** Aéropique (Osamodas) : visée sur une de ses bêtes, elle repousse de n cases tout ce qui la touche. */
  aeropique?: { cases: number };
  /** Esprit Glouton (Osamodas) : la recharge (s) ne part qu'à la mort du Gobgob. */
  glouton?: { recharge: number };
  /** Sacrifice (Sacrieur) : pendant t s, encaisse à la place des alliés à `rayon` cases ; les Épées de la zone lui rendent `epees` de leur vie. */
  sacrifice?: { t: number; rayon: number; epees: number };
  /** Bain de Sang (Sacrieur) : Tacle en plus par ennemi dans la zone, pendant t s. */
  bain?: { tacle: number; t: number };
  /** Libation (Sacrieur) : sacrifie une part des PV, retire les malus, puis soigne pendant t s (part des PV max : base + Souffrance). */
  libation?: { sacrifice: number; t: number; base: number; parSouffrance: number[] };
  /** Berserk (Sacrieur) : sacrifie une part des PV ; dommages × (1 + dommages), soins reçus × (1 - soins), plus de tacle ni de ralenti ;
   *  fin sous Souffrance `fin`, ou en relançant le sort. */
  berserk?: { sacrifice: number; dommages: number; soins: number; fin: number };
  /** Punition (Sacrieur) : dommages Neutre en plus = part des PV déjà perdus. */
  punition?: { part: number };
  /** Sorts 25-60 du Iop et du Crâ (0.6) : bonus posés sur l'allié visé (joueur le plus proche du point), sinon sur soi, pendant t s.
   *  Vitalité en part des PV max (Vitalité du Iop) ; `soi` : bonus quand on se vise soi-même (plus fort). */
  renfort?: { mods: Partial<Record<Stat, number>>; soi?: Partial<Record<Stat, number>>; vitalite?: number; vitaliteSoi?: number; t: number; seul?: boolean };
  /** Vertu (Iop) : Puissance perdue par allié (joueur ou bête) collé au lanceur, pendant t s. */
  vertu?: { malus: number; t: number };
  /** Œil pour Œil (Crâ) : dommages en plus (part) par coup reçu dans les t dernières secondes, jusqu'à max coups. */
  oeil?: { par: number; t: number; max: number };
}

/** État propre à un joueur (dans Player, jamais dans World). */
export interface Etat61 {
  frictions: { mid: number; t: number; pas: number }[];
  auras: { qid: number; t: number; rayon: number; pas: number }[];
  precip: { qid: number; bete: boolean; t: number; vite: number; lent: number; t0: number }[];
  emprises: { mid: number; t: number }[];
  destinA: number;
  dev: { sid: string; mid: number; n: number; t: number; gm: number } | null;
  /** Coups reçus récemment (Œil pour Œil). */
  coupsRecus: number[];
  acuiteT: number;
  sacrificeT: number; sacrificeR: number;
  libationT: number; libAcc: number;
  berserk: { dommages: number; soins: number; fin: number } | null;
  /** Temps pour les tirages (0,5 s) des attirances. */
  pasT: number;
  /** Balise de Survie visée par le sort en cours (id de la bête), échange de place au coup. */
  baliseVisee: number;
}
const CASE = 48;
export const etat61 = (): Etat61 => ({ frictions: [], auras: [], precip: [], emprises: [], destinA: -99, dev: null, coupsRecus: [], acuiteT: 0,
  sacrificeT: 0, sacrificeR: 0, libationT: 0, libAcc: 0, berserk: null, pasT: 0, baliseVisee: 0 });
const etat = (p: Player): Etat61 => (p.e61 ??= etat61());

/** Monstre visé : le plus proche du point, s'il est assez près. */
function cible(world: World, x: number, y: number, marge = CASE * 0.8): Monster | null {
  let best: Monster | null = null, bd = Infinity;
  for (const m of world.monsters) {
    if (m.dead || m.state === 'spawn') continue;
    const d = Math.hypot(m.x - x, m.y - y) - m.radius;
    if (d <= marge && d < bd) { best = m; bd = d; }
  }
  return best;
}
const statut = (world: World, x: number, y: number, text: string, color = '#ffb347') => world.emit({ k: 'status', x, y: y - 60, text, color });

/** Effets à mettre dans le coup (Expiation, Hécatombe, Perforante). */
export function hit61(d: SpellDef): Partial<HitDef> {
  const s = d.e61;
  return s ? { antiSoin: s.antiSoin, vsBouclier: s.vsBouclier } : {};
}

/** Avant le coup : multiplicateur des dommages (Épée du Destin, Flèche Dévorante) et effets qui se lancent d'abord. */
export function avantImpact61(p: Player, id: string, d: SpellDef, tx: number, ty: number, gm: number, world: World): number {
  const s = d.e61!, e = etat(p);
  let mult = 1;
  if (s.destin) {   // plus on attend avant de le relancer, plus il frappe fort
    mult *= 1 + s.destin.max * Math.min(1, (p.age - e.destinA) / s.destin.plein);
    e.destinA = p.age;
  }
  if (s.devorante) {
    const D = s.devorante, m = cible(world, tx, ty);
    if (m) {
      if (e.dev && e.dev.mid === m.id && e.dev.sid === id) e.dev.n = Math.min(D.mult.length, e.dev.n + 1);
      else { dernierCoup(p, world); e.dev = { sid: id, mid: m.id, n: 1, t: 0, gm } }
      e.dev.t = D.t; e.dev.gm = gm;
      mult *= D.mult[e.dev.n - 1];
    }
  }
  if (s.oeil) {   // Œil pour Œil : plus fort pour chaque coup reçu ces dernières secondes
    e.coupsRecus = e.coupsRecus.filter(t => p.age - t < s.oeil!.t);
    mult *= 1 + s.oeil.par * Math.min(s.oeil.max, e.coupsRecus.length);
  }
  if (s.bain) {   // Tacle en plus par ennemi dans la zone autour du lanceur
    const r = d.hit.shape === 'circle' ? d.hit.radius : CASE;
    const n = world.monsters.filter(m => !m.dead && m.state !== 'spawn' && Math.hypot(m.x - p.x, m.y - p.y) <= r + m.radius).length;
    p.mods = p.mods.filter(x => x.src !== id);
    if (n) p.addMod('tacle', s.bain.tacle * n, s.bain.t, id);
  }
  return mult;
}

/** Flèche Dévorante, Tempête de Puissance : l'ancienne cible prend son dernier coup (selon le nombre de lancers sur elle). */
function dernierCoup(p: Player, world: World) {
  const e = etat(p), v = e.dev;
  e.dev = null;
  if (!v) return;
  const sd = p.cls.spells[v.sid], D = sd?.e61?.devorante, m = world.monsters.find(x => x.id === v.mid && !x.dead);
  if (!m || !sd || !D) return;
  world.applyHits(x => x === m, { dmg: sd.dmg * D.dernier[v.n - 1] * v.gm, knock: 0, element: sd.element, sort: v.sid }, m.x, m.y, 0);
  world.emit({ k: 'spell', fx: 'burst', id: v.sid, x: m.x, y: m.y, cx: m.x, cy: m.y, facing: 0, size: CASE, arc: 0, element: sd.element, big: v.n >= D.mult.length, boosted: false });
}

/** Après le coup : les effets propres aux sorts 61-90. */
export function impact61(p: Player, id: string, d: SpellDef, tx: number, ty: number, world: World) {
  const s = d.e61!, e = etat(p);
  if (s.friction) {
    const F = s.friction, m = cible(world, tx, ty);
    if (m) { e.frictions = e.frictions.filter(f => f.mid !== m.id); e.frictions.push({ mid: m.id, t: F.t, pas: F.pas }); }
    else {
      const q = allie(world, tx, ty, true) ?? p;
      e.auras = e.auras.filter(a => a.qid !== q.id); e.auras.push({ qid: q.id, t: F.t, rayon: F.rayon, pas: F.pas });
    }
  }
  if (s.precipitation) {
    const P = s.precipitation, q = allie(world, tx, ty, false);
    const b = q ? null : world.betes.find(x => !x.dead && x.owner === p && Math.hypot(x.x - tx, x.y - ty) <= x.radius + CASE);
    if (!q && !b) {   // ne s'utilise pas sur soi : rien à viser, le sort est rendu
      p.pa = Math.min(p.paMax, p.pa + p.paCost(id)); p.cd[id] = 0;
      statut(world, p.x, p.y, 'Vise un allié', '#c8c8c8');
    } else {
      const qid = q ? q.id : b!.id;
      e.precip = e.precip.filter(x => x.qid !== qid);
      e.precip.push({ qid, bete: !q, t: P.t * 2, vite: P.vite, lent: P.lent, t0: P.t });
      statut(world, q ? q.x : b!.x, q ? q.y : b!.y, 'Précipitation', '#5aa8ff');
    }
  }
  if (s.aeropique) {   // sur une bête du lanceur : elle repousse tout ce qui est à son contact
    const b = world.betes.find(x => !x.dead && x.owner === p && Math.hypot(x.x - tx, x.y - ty) <= x.radius + CASE);
    if (b && world.repousser(b.x, b.y, b.radius + CASE, s.aeropique.cases * 342)) statut(world, b.x, b.y, 'Aéropique', '#9fe0c8');
  }
  if (s.emprise) {
    const m = cible(world, tx, ty);
    if (m && !m.def.boss && !m.intouchable) {
      m.intouchable = true; m.stun = Math.max(m.stun, s.emprise.t);
      e.emprises.push({ mid: m.id, t: s.emprise.t });
      statut(world, m.x, m.y + 20, 'Emprise', '#e8d27a');
    }
  }
  if (s.repli) {   // loin de l'ennemi visé, ou vers l'allié visé (freinage du recul : distance = vitesse / 7,13)
    const a = Math.atan2(ty - p.y, tx - p.x), q = allie(world, tx, ty, false), v = s.repli.cases * CASE * 7.13;
    const sens = q && !cible(world, tx, ty) ? Math.min(1, Math.max(0, Math.hypot(q.x - p.x, q.y - p.y) - CASE) / (s.repli.cases * CASE)) : -1;
    p.kx += Math.cos(a) * v * sens; p.ky += Math.sin(a) * v * sens;
  }
  if (s.renfort) {
    const R = s.renfort, q = (R.seul ? null : allie(world, tx, ty, false)) ?? p, soi = q === p;
    const mods = { ...R.mods, ...(soi ? R.soi : {}) };
    q.mods = q.mods.filter(m => m.src !== id);
    for (const [k, n] of Object.entries(mods) as [Stat, number][]) q.addMod(k, n, R.t, id);
    const vp = soi ? R.vitaliteSoi ?? R.vitalite : R.vitalite;
    if (vp) { q.addMod('vitalite', Math.round(q.maxHp * vp), R.t, id); q.recompute(); }
    statut(world, q.x, q.y, p.cls.spells[id]?.name ?? '', '#e8d27a');
  }
  if (s.vertu) {   // moins de Puissance pour chaque allié collé au lanceur
    const n = world.players.filter(q => q !== p && !q.dead && Math.hypot(q.x - p.x, q.y - p.y) <= CASE * 1.6).length
      + world.betes.filter(b => !b.dead && b.owner === p && Math.hypot(b.x - p.x, b.y - p.y) <= CASE * 1.6).length;
    p.mods = p.mods.filter(m => m.src !== id);
    if (n) p.addMod('puissance', -s.vertu.malus * n, s.vertu.t, id);
  }
  if (s.acuite) { e.acuiteT = s.acuite.t; statut(world, p.x, p.y, 'Acuité Absolue', '#7be07b'); }
  if (d.invoque) for (const b of world.betes) if (b.owner === p && b.sort === id && !b.dead) b.poids = 1;   // forme évoluée invoquée directement : une seule Invocation
  if (s.glouton) p.cd[id] = p.cdMax[id] = 60;   // la recharge ne part qu'à la mort du Gobgob (maj61)
  if (s.sacrifice) {
    const S = s.sacrifice;
    e.sacrificeT = S.t; e.sacrificeR = S.rayon * CASE;
    for (const b of world.betes) if (!b.dead && b.owner === p && (b.base === 'epee_vorace' || b.base === 'epee_dansante') && Math.hypot(b.x - p.x, b.y - p.y) <= e.sacrificeR + b.radius) {
      const n = p.soigner(b.hp * S.epees);
      b.mourir(world);
      if (n) world.emit({ k: 'status', x: p.x, y: p.y - 70, text: `+${n} PV`, color: '#7be07b' });
    }
    statut(world, p.x, p.y, 'Sacrifice', '#e06060');
  }
  if (s.libation) {
    const L = s.libation;
    p.sacrifier(L.sacrifice, world);
    p.slowT = 0; p.subis = 1; p.subisT = 0; p.mods = p.mods.filter(m => m.n >= 0);   // les malus partent
    e.libationT = L.t;
  }
  if (s.berserk) {
    if (e.berserk) { e.berserk = null; statut(world, p.x, p.y, 'Berserk terminé', '#c8c8c8'); }
    else {
      const B = s.berserk;
      p.sacrifier(B.sacrifice, world);
      e.berserk = { dommages: B.dommages, soins: B.soins, fin: B.fin };
      statut(world, p.x, p.y, 'Berserk !', '#ff3b3b');
    }
  }
  if (s.punition) {   // dommages Neutre en plus selon les PV déjà perdus
    const n = (p.maxHp - p.hp) * s.punition.part;
    if (n > 0) world.hitCircle(tx, ty, d.hit.shape === 'point' ? d.hit.radius : CASE / 2, { dmg: n, knock: 0, element: 'neutre', sort: id });
  }
}

/** Allié (autre joueur, ou soi si `soi`) le plus proche du point visé. */
function allie(world: World, x: number, y: number, soi: boolean): Player | null {
  let best: Player | null = null, bd = CASE * 1.5;
  for (const q of world.players) {
    if (q.dead || (!soi && q === world.player)) continue;
    const d = Math.hypot(q.x - x, q.y - y);
    if (d <= bd) { best = q; bd = d; }
  }
  return best;
}

/** Tire le monstre de `pas` px vers (x, y), sans passer le contact ni un mur. */
function tirer(world: World, m: Monster, x: number, y: number, pas: number, contact: number) {
  const d = Math.hypot(x - m.x, y - m.y), L = Math.min(pas, d - contact - m.radius);
  if (L <= 0) return;
  const nx = m.x + (x - m.x) / d * L, ny = m.y + (y - m.y) / d * L;
  if (world.walkable(nx, ny)) { m.x = nx; m.y = ny; }
}

/** À chaque pas du joueur : attirances de Friction, Précipitation, fin d'Emprise, Dévorante, Acuité, Sacrifice, Libation, Berserk, Gobgob. */
export function maj61(p: Player, dt: number, world: World) {
  const e = p.e61!;
  e.pasT -= dt;
  const tire = e.pasT <= 0;
  if (tire) e.pasT = 0.5;
  for (const f of e.frictions) {
    f.t -= dt;
    const m = world.monsters.find(x => x.id === f.mid && !x.dead);
    if (!m) { f.t = 0; continue; }
    if (!tire) continue;
    let q: Player | null = null, bd = Infinity;   // son agresseur : le joueur le plus proche
    for (const j of world.players) if (!j.dead) { const d = Math.hypot(j.x - m.x, j.y - m.y); if (d < bd) { bd = d; q = j; } }
    if (q) tirer(world, m, q.x, q.y, f.pas * CASE, q.radius + 4);
  }
  e.frictions = e.frictions.filter(f => f.t > 0);
  for (const a of e.auras) {
    a.t -= dt;
    const q = world.players.find(j => j.id === a.qid && !j.dead);
    if (!q) { a.t = 0; continue; }
    if (tire) for (const m of world.monsters) if (!m.dead && m.state !== 'spawn' && !m.def.boss && Math.hypot(m.x - q.x, m.y - q.y) <= a.rayon * CASE) tirer(world, m, q.x, q.y, a.pas * CASE, q.radius + 4);
  }
  e.auras = e.auras.filter(a => a.t > 0);
  for (const x of e.precip) {   // PA plus vite, puis plus lentement (le gain normal est déjà compté par l'allié)
    x.t -= dt;
    const k = x.t > x.t0 ? x.vite - 1 : x.lent - 1;
    if (x.bete) {
      const b = world.betes.find(o => o.id === x.qid && !o.dead);
      if (!b) { x.t = 0; continue; }
      b.pa = Math.max(0, Math.min(4, b.pa + 1.25 * k * dt));
    } else {
      const q = world.players.find(o => o.id === x.qid && !o.dead);
      if (!q) { x.t = 0; continue; }
      q.pa = Math.max(0, Math.min(q.paMax, q.pa + q.cls.pa.regen * k * dt));
    }
  }
  e.precip = e.precip.filter(x => x.t > 0);
  for (const x of e.emprises) {
    x.t -= dt;
    if (x.t > 0) continue;
    const m = world.monsters.find(o => o.id === x.mid);
    if (m) m.intouchable = false;
  }
  e.emprises = e.emprises.filter(x => x.t > 0);
  if (e.dev && (e.dev.t -= dt) <= 0) dernierCoup(p, world);   // pas relancée à temps : l'ennemi prend son dernier coup
  if (e.acuiteT > 0) e.acuiteT = Math.max(0, e.acuiteT - dt);
  if (e.sacrificeT > 0) e.sacrificeT = Math.max(0, e.sacrificeT - dt);
  if (e.libationT > 0) {
    e.libationT = Math.max(0, e.libationT - dt);
    const L = p.cls.spells.libation?.e61?.libation, sf = p.souffrance;
    if (L && !p.dead) e.libAcc += p.maxHp * (L.base + (sf ? L.parSouffrance[sf - 1] : 0)) / 100 * dt / L.t;
    if (e.libAcc >= 1 || (e.libationT <= 0 && e.libAcc > 0)) { const n = Math.floor(e.libAcc); e.libAcc -= n; if (n) p.soigner(n); if (e.libationT <= 0) e.libAcc = 0; }
  }
  if (e.berserk) {
    if (p.dead || p.souffrance < e.berserk.fin) { e.berserk = null; if (!p.dead) statut(world, p.x, p.y, 'Berserk terminé', '#c8c8c8'); }
    else p.insensibleT = Math.max(p.insensibleT, 0.1);   // rien ne le ralentit
  }
  const G = p.cls.spells.esprit_glouton?.e61?.glouton;   // le Gobgob est mort (ou parti) : la vraie recharge part
  if (G && (p.cd.esprit_glouton ?? 0) > G.recharge && !world.betes.some(b => !b.dead && b.owner === p && b.base === 'gobgob_glouton')) {
    p.cd.esprit_glouton = p.cdMax.esprit_glouton = G.recharge;
  }
}

/** Sacrifice : un autre joueur près d'un Sacrieur sous Sacrifice lui passe le coup. Renvoie vrai si le coup est pris par lui. */
export function redirige61(q: Player, raw: number, fromX: number, fromY: number, world: World, element: Element, loin?: boolean): boolean {
  if (q.cls.spells.oeil_pour_oeil && raw > 0) { const e = etat(q); e.coupsRecus.push(q.age); if (e.coupsRecus.length > 12) e.coupsRecus.shift(); }   // Œil pour Œil
  for (const p of world.players) {
    if (p === q || p.dead || !p.e61 || p.e61.sacrificeT <= 0 || Math.hypot(p.x - q.x, p.y - q.y) > p.e61.sacrificeR) continue;
    p.hurt(raw, fromX, fromY, world, element, loin);
    return true;
  }
  return false;
}
/** Soins reçus (Berserk : moins de soins). */
export const soins61 = (p: Player): number => (p.e61?.berserk ? 1 - p.e61.berserk.soins : 1);
/** Dommages en plus (Berserk). */
export const dommages61 = (p: Player): number => (p.e61?.berserk ? 1 + p.e61.berserk.dommages : 1);

/** Balise de Survie (Crâ) : un sort du lanceur visé sur sa Balise (point visé au lancer, les flèches partent du lanceur),
 *  s'il la voit, les fait échanger de place au moment du coup. */
export function viseBalise61(p: Player, aim: { x: number; y: number }, world: World) {
  const b = world.betes.find(x => !x.dead && x.owner === p && x.def.balise && x.state !== 'spawn' && Math.hypot(x.x - aim.x, x.y - aim.y) <= x.radius + CASE * 0.6);
  if (b) etat(p).baliseVisee = b.id; else if (p.e61) p.e61.baliseVisee = 0;
}
export function echangeBalise61(p: Player, world: World) {
  const e = p.e61, b = e?.baliseVisee ? world.betes.find(x => x.id === e.baliseVisee && !x.dead) : null;
  if (!e || !b) return;
  e.baliseVisee = 0;
  if (!world.clearShot(p, b)) return;
  const x = p.x, y = p.y; p.x = b.x; p.y = b.y; b.x = x; b.y = y;
  statut(world, p.x, p.y, 'Échange', '#9fe0c8');
}
