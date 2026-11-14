import type { Element, SpellDef } from './defs';
import type { Bete } from './bete';
import type { Monster } from './monster';
import type { Player } from './player';
import type { HitDef, World } from './world';
import { soignerAllie } from './eniripsa';

/** Sadida (maquette Sadida, ligne de Mathis du 13 nov. 2026 :
 *  « 1A 2A+2B 3A+3B 4A 5A 6A+6B 7A 8A+8B 9A 10A 11A 12A 13A 14B 15A 16A 17B », 17D en légendaire).
 *  1A Infection officielle (état 263, 1 tour = 3 s) : un sort Sadida lancé sur un Infecté touche tous les Infectés,
 *     3 propagations par fenêtre de 3 s, sans critique sur les copies ; Cigüe entretient, Contagion propage autour de la cible.
 *  2A Arbres : 6 au plus (14B : par groupe, le 7e fait mourir le plus ancien), Feuillu au bout de 3 s ou tout de suite avec Larme :
 *     PV doublés et relais (un sort lancé sur un Feuillu s'applique en cercle de 2 cases). 2B : ils retournent sous terre
 *     20 s sans monstre à 15 cases. 3A+3B : sort Arbre dès le niveau 1, 3 charges (une toutes les 4 s).
 *  4A obstacles : les monstres ne les traversent pas et frappent l'Arbre qui les gêne.
 *  5A Poupées : naissent d'un de tes Arbres (le plus proche du curseur), une de chaque sorte, redeviennent Arbre à leur mort.
 *  6A IA alliée (moteur des bêtes de l'Osamodas) + 6B touche de ralliement (X) : toutes les Poupées sur l'ennemi sous la souris.
 *  7A poison continu (dégâts officiels étalés sur 3 s). 8A+8B retraits de PM comme l'Enutrof, ronces visibles au sol.
 *  9A soins sur soi en solo, sur l'allié visé en coop. 10A Passage racinaire sur Espace. 11A Ronce au clic droit.
 *  Tout l'état propre à un joueur est dans Player (sadiProp, sadiCible) : plusieurs Sadidas ont chacun leurs Arbres. */

const CASE = 48;
export interface ReglesSadida {
  infection: { t: number; max: number; propagations: number; fenetre: number };
  arbres: { max: number; feuillu: number; pv: number; pvFeuillu: number; relais: number };
  poison: number;
  sacrifiee: { croissance: number; periode: number; max: number; rayon: number };
  bloqueuse: { provoque: number; rayon: number; tacle: number };
  passage: { portee: number };
}
/** Effets des sorts (SpellDef.sadida). */
export interface EffetsSadida {
  infecte?: boolean; relais?: boolean; propage?: boolean;
  /** Larme : rend Feuillu l'Arbre visé (relais même sur un Arbre pas encore Feuillu). */
  feuillit?: boolean;
  /** Sans ennemi touché : soigne l'allié visé, ou soi (9A). */
  soinSiRien?: boolean;
  /** Ronce Apaisante : soigne seulement les alliés (pas de dommages). */
  soinSeul?: boolean;
  /** Cigüe : les Infectés touchés gardent leur Infection 3 s de plus. */
  maintient?: boolean;
  plante?: boolean;
  /** Charges du sort [nombre, secondes pour en regagner une] (Arbre, 3A). */
  charges?: [number, number];
  /** Poupée née d'un Arbre (clé de betes.json) ; Groute (Puissance Sylvestre) : née d'un Feuillu. */
  poupee?: string; groute?: string;
  /** Poison continu : dégâts officiels (× 1,5) étalés sur ReglesSadida.poison s, au lieu d'un coup. */
  poison?: number;
  /** Sève Paralysante : la cible n'esquive plus les retraits de PM pendant n s. */
  seve?: number;
  /** Contagion : sur un Infecté, l'Infection saute aux ennemis à n cases de la cible. */
  contagion?: number;
  /** Ronces Agressives : vol de PM, le Sadida court plus vite. */
  volPM?: { k: number; t: number };
  /** Fléau : relais par une Poupée (carré d'une case autour d'elle). */
  relaisPoupee?: boolean;
  /** Sacrifice Vaudou sur une de tes Poupées : elle se sacrifie, soigne les alliés et frappe les ennemis autour. */
  vaudou?: { rayon: number; soin: number };
  /** Passage racinaire (10A) : portée en cases jusqu'à un de tes Arbres. */
  passage?: number;
}
/** État d'un Arbre ou d'une Poupée du Sadida (Bete.sadi). */
export interface EtatSadi { feuillu: boolean; t: number; calme: number; deFeuillu?: boolean; age: number }

const R = (p: Player): ReglesSadida | undefined => p.cls.sadida;
/** Durée de l'Infection (Épidémie, pc-sadida-C : quelques secondes de plus). */
export const dureeInfection = (p: Player) => (R(p)?.infection.t ?? 3) + p.pcv('pc-sadida-C');
/** -1 PM sans esquive, ronces visibles au sol (Sentier de ronces, Contagion galopante). */
function entraver(m: Monster, w: World) {
  if (m.dead) return;
  m.haste = Math.min(m.haste, 0.85); m.hasteT = Math.max(m.hasteT, 3); m.ronceT = Math.max(m.ronceT, 3); m.entraveA = w.time;
  w.emit({ k: 'status', x: m.x, y: m.y, text: '-1 PM', color: '#9ad15a' });
}
const vivantes = (w: World) => w.betes.filter(b => !b.dead && b.def.sadida && b.sadi);
/** 14B : Arbres et Poupées de tout le groupe (les plus anciens d'abord). */
export const foretDuGroupe = (w: World) => vivantes(w).filter(b => b.def.sadida!.arbre || b.def.sadida!.poupee);
export const arbresDe = (p: Player, w: World) => vivantes(w).filter(b => b.owner === p && b.def.sadida!.arbre);
export const estArbre = (b: Bete) => !!b.def.sadida?.arbre;
export const estFeuillu = (b: Bete) => !!b.def.sadida?.arbre && !!b.sadi?.feuillu;

/** Arbre (ou Poupée) du groupe le plus proche de ce point, à r px au plus. */
function prochePoint(w: World, x: number, y: number, r: number, f: (b: Bete) => boolean): Bete | null {
  let best: Bete | null = null, bd = r;
  for (const b of vivantes(w)) { if (!f(b)) continue; const d = Math.hypot(b.x - x, b.y - y); if (d <= bd) { bd = d; best = b; } }
  return best;
}

// --- Infection et poison ----------------------------------------------------------------------------------------------
export function infecter(m: Monster, w: World, t?: number) {
  if (m.dead || m.def.boss && m.intouchable) return;
  const T = t ?? 3, avant = m.infecteT > 0;
  m.infecteT = Math.max(m.infecteT, T);
  if (!avant) w.emit({ k: 'status', x: m.x, y: m.y - 34, text: 'Infecté', color: '#9be36a' });
}
/** 7A : poison continu. Dommages calculés comme un coup du Sadida (caractéristiques, résistance), étalés sur t s. */
export function empoisonner(p: Player, m: Monster, brut: number, element: Element, w: World) {
  if (m.dead || m.intouchable || brut <= 0) return;
  const el = p.resolveElement(element), res = Math.min(50, m.def.res?.[el] ?? 0);
  const vu = (m.vulnT > 0 ? 1 + m.vuln / 100 : 1) * m.subis, t = R(p)?.poison ?? 3;
  const total = p.damage(brut, element) * (1 - res / 100) * vu;
  if (m.poisonT <= 0) w.emit({ k: 'status', x: m.x, y: m.y - 46, text: 'Empoisonné', color: '#7fd35a' });
  m.poison = Math.max(m.poisonT > 0 ? m.poison : 0, total / t); m.poisonT = t; m.poisonEl = el;
  if (m.state === 'idle' || m.state === 'return') w.aggroGroup(m);
}
/** Minuteurs du Sadida sur un monstre : Infection, poison (dégâts par paquets d'au moins 1), ronces au sol, Sève. */
export function majMonstreSadida(w: World, m: Monster, dt: number) {
  if (m.infecteT > 0) m.infecteT = Math.max(0, m.infecteT - dt);
  if (m.ronceT > 0) m.ronceT = Math.max(0, m.ronceT - dt);
  if (m.seveT > 0) m.seveT = Math.max(0, m.seveT - dt);
  if (m.poisonT > 0 && !m.dead) {
    const t = Math.min(dt, m.poisonT); m.poisonT -= dt; m.poisonAcc += m.poison * t;
    if (m.poisonAcc < 1 && m.poisonT > 0) return;
    const n = Math.max(1, Math.round(m.poisonAcc)); m.poisonAcc = 0;
    if (m.poisonT <= 0) m.poison = 0;
    m.hp -= n; m.calmeT = 0;
    w.emit({ k: 'hit', target: 'monster', id: m.id, x: m.x, y: m.y, z: m.radius * 2 + 10, amount: n, crit: false, element: m.poisonEl, sort: 'poison' });
    if (m.hp <= 0) w.killMonster(m);
  }
}

// --- Arbres -----------------------------------------------------------------------------------------------------------
/** Plante un Arbre (14B : 6 par groupe ; au-delà, le plus ancien Arbre meurt, le sien d'abord). */
export function planter(p: Player, x: number, y: number, w: World, feuillu = false): Bete | null {
  const r = R(p);
  if (!r) return null;
  const foret = foretDuGroupe(w);
  if (foret.length >= r.arbres.max) {
    const arbres = foret.filter(estArbre), vieux = arbres.find(b => b.owner === p) ?? arbres[0] ?? foret.find(b => b.owner === p) ?? foret[0];
    if (vieux) retirer(vieux, w);
  }
  const b = w.invoquer(p, 'sadi_arbre', 'arbre', x, y, true);
  if (!b) return null;
  b.horsCompte = true;
  b.maxHp = b.hp = Math.max(1, Math.round(p.maxHp * r.arbres.pv));
  b.sadi = { feuillu: false, t: feuillu ? 0 : r.arbres.feuillu - p.pcv('pc-sadida-E'), calme: 0, age: w.time };   // Forêt dense : Feuillu plus tôt
  if (feuillu) rendreFeuillu(b, w);
  return b;
}
/** Un Arbre devient Feuillu : PV doublés, sert de relais, ne bouge plus. */
export function rendreFeuillu(b: Bete, w: World) {
  if (!b.sadi || b.sadi.feuillu || !estArbre(b)) return;
  const k = R(b.owner)?.arbres.pvFeuillu ?? 2;
  b.sadi.feuillu = true; b.sadi.t = 0;
  b.maxHp = Math.round(b.maxHp * k); b.hp = Math.round(b.hp * k);
  w.emit({ k: 'feuillu', id: b.id, x: b.x, y: b.y });
}
/** Disparaît sans mourir (remplacé par une Poupée, 7e Arbre, 2B) : ni Racines vengeresses, ni Arbre qui repousse. */
function retirer(b: Bete, w: World) {
  b.dead = true; b.t = 0; b.cast = null;
  w.emit({ k: 'beteMorte', id: b.id, x: b.x, y: b.y, radius: b.radius, name: b.def.name, discret: true });
}

/** Pas d'un Arbre ou d'une Poupée du Sadida (appelé par Bete.update) ; vrai = la bête ne fait rien d'autre. */
export function majBeteSadida(b: Bete, dt: number, w: World): boolean {
  const S = b.def.sadida!, s = b.sadi, r = R(b.owner);
  if (!s || !r) return false;
  // 2B : sans monstre à 15 cases pendant 20 s, Arbres et Poupées retournent sous terre
  const proche = w.monsters.some(m => !m.dead && Math.abs(m.x - b.x) + Math.abs(m.y - b.y) <= CASE * 15 && Math.hypot(m.x - b.x, m.y - b.y) <= CASE * 15);
  s.calme = proche ? 0 : s.calme + dt;
  if (s.calme >= 20) { w.emit({ k: 'status', x: b.x, y: b.y - 40, text: 'Retourne sous terre', color: '#a8c890' }); retirer(b, w); return true; }
  if (S.arbre) {
    if (!s.feuillu && (s.t -= dt) <= 0) rendreFeuillu(b, w);
    b.kx = b.ky = 0; b.setAnim('idle');
    return true;
  }
  if (S.fixe) { b.kx = b.ky = 0; return false; }   // Groute : se bat sans bouger
  if (S.bloqueuse) return majBloqueuse(b, dt, w, r);
  if (S.sacrifiee) return majSacrifiee(b, dt, w, r);
  return false;
}

/** Cible des Poupées : l'ennemi du ralliement (6B), sinon celle des bêtes (dernier monstre frappé, 6A). */
export function cibleRalliement(p: Player, w: World): Monster | null {
  if (p.sadiCibleT <= 0 || p.sadiCible == null) return null;
  const m = w.monsters.find(q => q.id === p.sadiCible && !q.dead);
  if (!m) { p.sadiCible = null; p.sadiCibleT = 0; }
  return m ?? null;
}
function cibleProche(b: Bete, w: World, portee: number): Monster | null {
  const ral = cibleRalliement(b.owner, w);
  if (ral) return ral;
  const pris = w.cibleMeute != null ? w.monsters.find(q => q.id === w.cibleMeute && !q.dead) : null;
  if (pris && Math.hypot(pris.x - b.owner.x, pris.y - b.owner.y) <= portee) return pris;
  let best: Monster | null = null, bd = portee;
  for (const m of w.monsters) {
    if (m.dead || m.state === 'idle' || m.state === 'return' || m.state === 'spawn') continue;
    const d = Math.hypot(m.x - b.owner.x, m.y - b.owner.y);
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}
function marcherVers(b: Bete, x: number, y: number, dt: number, w: World, arret: number) {
  const dx = x - b.x, dy = y - b.y, d = Math.hypot(dx, dy);
  if (d <= arret) { b.setAnim('idle'); return true; }
  const st = Math.min(d - arret, b.owner.speed * 1.1 * dt), ux = dx / d, uy = dy / d;
  if (w.walkable(b.x + ux * st, b.y + uy * st)) { b.x += ux * st; b.y += uy * st; }
  b.facing = Math.atan2(uy, ux); b.setAnim('run');
  return false;
}
/** La Bloqueuse : file se planter devant la cible, provoque les monstres autour (toutes les n s) et tacle ceux à son contact. */
function majBloqueuse(b: Bete, dt: number, w: World, r: ReglesSadida): boolean {
  const B = r.bloqueuse, c = cibleProche(b, w, CASE * 10), J = b.owner.pcv('pc-sadida-J') > 0;   // Bloqueuse inébranlable
  if (!c) return false;   // personne : elle suit le Sadida comme une bête
  marcherVers(b, c.x, c.y, dt, w, c.radius + b.radius + 4);
  b.applyKnock(dt);
  if ((b.provoqueT -= dt) <= 0) {
    b.provoqueT = B.provoque - (J ? 1 : 0);
    let n = 0;
    for (const m of w.monsters) if (!m.dead && !m.def.boss && m.state !== 'idle' && m.state !== 'return' && Math.hypot(m.x - b.x, m.y - b.y) <= CASE * B.rayon) {
      m.agresseur = b.id; m.provoqueJusqua = w.time + B.provoque; n++;
    }
    if (n) w.emit({ k: 'status', x: b.x, y: b.y - 50, text: 'Provocation', color: '#f2d36b' });
  }
  for (const m of w.monsters) if (!m.dead && Math.hypot(m.x - b.x, m.y - b.y) <= m.radius + b.radius + CASE * 0.5) {   // tacle
    m.haste = Math.min(m.haste, 1 - Math.min(0.7, B.tacle * (J ? 2 : 1))); m.hasteT = Math.max(m.hasteT, 0.3);
  }
  return true;
}
/** La Sacrifiée : grossit (PV et dégâts) toutes les `periode` s, puis file au milieu des monstres et explose (Explosion Ouatée). */
function majSacrifiee(b: Bete, dt: number, w: World, r: ReglesSadida): boolean {
  const S = r.sacrifiee, s = b.sadi!, K = b.owner.pcv('pc-sadida-K');   // Sacrifice éclatant : grossit deux fois plus vite
  const k = Math.min(S.max, 1 + S.croissance * Math.floor((w.time - s.age) / (S.periode / (K ? 2 : 1))));
  const pvMax = Math.round(b.owner.maxHp * b.def.pv * k);
  if (pvMax > b.maxHp) { b.hp += pvMax - b.maxHp; b.maxHp = pvMax; }
  const c = cibleProche(b, w, CASE * 10);
  if (!c) return false;
  if (!marcherVers(b, c.x, c.y, dt, w, c.radius + b.radius)) { b.applyKnock(dt); return true; }
  const E = b.def.sadida!.sacrifiee!, p = b.owner;
  for (const m of w.monsters) {
    if (m.dead || m.state === 'spawn' || Math.hypot(m.x - b.x, m.y - b.y) > S.rayon + m.radius) continue;
    w.coupDeBete(b, m, w.rng.range(E.min, E.max + 1) * 1.5 * k * (1 + K / 100), E.element);
    infecter(m, w, dureeInfection(p));
  }
  if (K) w.zonesSol.push({ x: b.x, y: b.y, r: S.rayon, t: 3, tick: 1, ronce: true, hit: { dmg: 0, knock: 0, pmLoss: 2, element: E.element, sort: 'pc-sadida-K' }, touches: new Set(), id: 'pc-sadida-K' });
  w.emit({ k: 'spell', fx: 'burst', id: 'sadi_sacrifiee', x: b.x, y: b.y, facing: 0, size: S.rayon, arc: 0, element: E.element, big: true, boosted: false, cx: b.x, cy: b.y });
  w.emit({ k: 'impact', hitstop: 0.05, shake: 0.01, big: true });
  b.mourir(w);
  return true;
}

/** Mort d'un Arbre ou d'une Poupée : la Poupée redevient Arbre (Feuillu si elle venait d'un Feuillu) ;
 *  un Arbre qui meurt Infecte les ennemis autour avec Racines vengeresses (17D, légendaire pc-sadida-A). */
export function beteSadidaMorte(b: Bete, w: World) {
  const p = b.owner;
  if (!b.sadi || !R(p)) return;
  if (b.def.sadida!.poupee) { planter(p, b.x, b.y, w, !!b.sadi.deFeuillu); return; }
  const v = p.pcv('pc-sadida-A');
  if (v && estArbre(b)) {
    const ronce = p.cls.spells.ronce?.dmg ?? 20;
    for (const m of w.monsters) {
      if (m.dead || m.state === 'spawn' || Math.hypot(m.x - b.x, m.y - b.y) > CASE * 2 + m.radius) continue;
      infecter(m, w, dureeInfection(p));
      w.coupDeBete(b, m, ronce * v / 100, 'terre');
    }
    w.emit({ k: 'spell', fx: 'burst', id: 'pc-sadida-A', x: b.x, y: b.y, facing: 0, size: CASE * 2, arc: 0, element: 'terre', big: true, boosted: false, cx: b.x, cy: b.y });
  }
}

/** Une Poupée (ou le Groute) naît de l'Arbre le plus proche du point visé ; une seule de chaque sorte. */
function fairePoupee(p: Player, cle: string, x: number, y: number, feuilluSeul: boolean, w: World): Bete | null {
  const a = prochePoint(w, x, y, CASE * 30, b => b.owner === p && estArbre(b) && (!feuilluSeul || estFeuillu(b)));
  if (!a) {
    w.emit({ k: 'status', x: p.x, y: p.y - 70, text: feuilluSeul ? 'Il faut un Arbre Feuillu' : 'Il faut un Arbre', color: '#c8c8c8' });
    return null;
  }
  const deja = vivantes(w).find(b => b.owner === p && b.base === cle);
  if (deja) deja.mourir(w);   // 5A : une de chaque sorte, l'ancienne redevient Arbre
  const deF = estFeuillu(a), ax = a.x, ay = a.y;
  retirer(a, w);
  const b = w.invoquer(p, cle, cle, ax, ay);
  if (!b) return null;
  b.horsCompte = true;
  b.sadi = { feuillu: false, t: 0, calme: 0, deFeuillu: deF || feuilluSeul, age: w.time };
  const J = cle === 'sadi_bloqueuse' ? p.pcv('pc-sadida-J') : 0;   // Bloqueuse inébranlable : PV en plus
  if (J) { b.maxHp = Math.round(b.maxHp * (1 + J / 100)); b.hp = b.maxHp; }
  return b;
}
/** Écorce épineuse (pc-sadida-F) : un Arbre frappé renvoie une part des dommages au monstre qui frappe, et l'Infecte. */
export function ecorce(b: Bete, dmg: number, fx: number, fy: number, w: World) {
  const v = b.owner.pcv('pc-sadida-F');
  if (!v || !estArbre(b)) return;
  let m: Monster | null = null, bd = CASE * 1.5;
  for (const q of w.monsters) { if (q.dead || q.intouchable) continue; const d = Math.hypot(q.x - fx, q.y - fy); if (d < bd) { bd = d; m = q; } }
  if (!m) return;
  const n = Math.max(1, Math.round(dmg * v / 100));
  m.hp -= n; m.flash = 0.09;
  w.emit({ k: 'hit', target: 'monster', id: m.id, x: m.x, y: m.y, z: m.radius * 2 + 10, amount: n, crit: false, element: 'terre', sort: 'pc-sadida-F' });
  infecter(m, w, dureeInfection(b.owner));
  if (m.hp <= 0) w.killMonster(m);
}
/** Fléau insatiable (pc-sadida-N) : la vie volée en trop soigne ta Poupée la plus blessée. */
export function soignerPoupee(p: Player, n: number, w: World) {
  let best: Bete | null = null;
  for (const b of vivantes(w)) if (b.owner === p && b.def.sadida!.poupee && b.hp < b.maxHp && (!best || b.hp / b.maxHp < best.hp / best.maxHp)) best = b;
  if (best) best.soigner(n, w);
}

/** Passage racinaire (10A) : un de tes Arbres à portée, près du point visé. */
export function arbrePassage(p: Player, aim: { x: number; y: number }, w: World): Bete | null {
  const r = R(p);
  if (!r) return null;
  const a = prochePoint(w, aim.x, aim.y, CASE * 2.5, b => b.owner === p && estArbre(b));
  return a && Math.hypot(a.x - p.x, a.y - p.y) <= r.passage.portee * CASE ? a : null;
}

// --- Sorts ------------------------------------------------------------------------------------------------------------
export interface CtxSadida { r?: number; infectes: Set<Monster>; sx: number; sy: number; /** Cigüe mortelle : dégâts × mult sur un Infecté. */ mult?: number }
/** Avant l'impact : relais par un Feuillu (ou une Poupée pour Fléau), Larme qui rend Feuillu, Infectés d'avant le coup. */
export function avantImpactSadida(p: Player, d: SpellDef, s: { id: string; tx: number; ty: number; sx: number; sy: number }, w: World): CtxSadida {
  const S = d.sadida!, r = R(p)!, c: CtxSadida = { infectes: new Set(w.monsters.filter(m => !m.dead && m.infecteT > 0)), sx: s.sx, sy: s.sy };
  if (S.relais) {
    const a = prochePoint(w, s.tx, s.ty, CASE * 0.9, b => estArbre(b) && (estFeuillu(b) || !!S.feuillit));
    if (a) {
      s.tx = a.x; s.ty = a.y; c.r = r.arbres.relais;
      if (S.feuillit) rendreFeuillu(a, w);
    }
  }
  if (S.relaisPoupee) {
    const a = prochePoint(w, s.tx, s.ty, CASE * 0.9, b => b.owner === p && !!b.def.sadida?.poupee);
    if (a) { s.tx = a.x; s.ty = a.y; c.r = CASE * 1.5; }
  }
  const D = s.id === 'cigue' ? p.pcv('pc-sadida-D') : 0;   // Cigüe mortelle : plus fort sur un Infecté
  if (D && w.monsters.some(m => !m.dead && m.infecteT > 0 && Math.hypot(m.x - s.tx, m.y - s.ty) <= (c.r ?? CASE * 0.75) + m.radius)) c.mult = 1 + D / 100;
  return c;
}
/** Propagations de l'Infection (1A : au plus n par fenêtre de t s). */
function propagationPossible(p: Player, w: World, r: ReglesSadida): boolean {
  p.sadiProp = p.sadiProp.filter(t => w.time - t < r.infection.fenetre);
  return p.sadiProp.length < r.infection.propagations;
}
/** Après l'impact d'un sort Sadida : Infection, propagation, poison, soins, Poupées, Arbres. */
export function impactSadida(p: Player, id: string, d: SpellDef, tx: number, ty: number, size: number, hit: HitDef, c: CtxSadida, gm: number, w: World) {
  const S = d.sadida!, r = R(p)!, IT = dureeInfection(p), IMAX = r.infection.max + p.pcv('pc-sadida-C');
  const zone = size > 0 ? w.monsters.filter(m => !m.dead && m.state !== 'spawn' && Math.hypot(m.x - tx, m.y - ty) <= size + m.radius) : [];
  if (S.plante) { planter(p, tx, ty, w); return; }
  if (S.poupee) { fairePoupee(p, S.poupee, tx, ty, false, w); return; }
  if (S.groute) { fairePoupee(p, S.groute, tx, ty, true, w); return; }
  // Sacrifice Vaudou sur une de tes Poupées : elle se sacrifie, soigne les alliés et frappe les ennemis autour (Infecte)
  if (S.vaudou) {
    const pou = prochePoint(w, tx, ty, CASE, b => b.owner === p && !!b.def.sadida?.poupee);
    if (pou) {
      const V = S.vaudou, P = p.pcv('pc-sadida-P');   // Poupée immortelle : soin en plus, la Poupée renaît en Feuillu
      soignerZone(p, pou.x, pou.y, V.rayon, V.soin * gm * (1 + P / 100), w);
      w.hitCircle(pou.x, pou.y, V.rayon, hit);
      for (const m of w.monsters) if (!m.dead && Math.hypot(m.x - pou.x, m.y - pou.y) <= V.rayon + m.radius) infecter(m, w, IT);
      w.emit({ k: 'spell', fx: 'burst', id, x: pou.x, y: pou.y, facing: 0, size: V.rayon, arc: 0, element: 'eau', big: true, boosted: false, cx: p.x, cy: p.y });
      if (P && pou.sadi) pou.sadi.deFeuillu = true;
      pou.mourir(w);
    }
  }
  if (S.poison) for (const m of zone) empoisonner(p, m, S.poison * gm, d.element, w);
  if (S.infecte) for (const m of zone) infecter(m, w, IT);
  if (id === 'ronce' && zone.length && p.pcv('pc-sadida-C')) {   // Épidémie : Ronce Infecte aussi l'ennemi le plus proche de sa cible
    let o: Monster | null = null, bd = CASE * 3;
    for (const m of w.monsters) { if (m.dead || zone.includes(m) || m.state === 'spawn') continue; const dd = Math.hypot(m.x - tx, m.y - ty) - m.radius; if (dd < bd) { bd = dd; o = m; } }
    if (o) infecter(o, w, IT);
  }
  const M = id === 'buisson_ardent' ? p.pcv('pc-sadida-M') : 0;   // Buisson incendiaire : sol en feu 2 s
  if (M && hit.dmg > 0) w.zonesSol.push({ x: tx, y: ty, r: CASE * 1.5, t: 2, tick: 1, hit: { ...hit, dmg: hit.dmg * M / 100, pmLoss: undefined, sansCrit: true, sort: 'pc-sadida-M' }, touches: new Set(), id: 'pc-sadida-M' });
  if (S.seve) for (const m of zone) m.seveT = Math.max(m.seveT, S.seve);
  if (S.maintient) for (const m of zone) if (m.infecteT > 0) m.infecteT = Math.min(IMAX, m.infecteT + IT);
  // 8B : ronces au sol sous les monstres ralentis par ce sort
  if (hit.pmLoss) for (const m of zone) if (m.entraveA === w.time && m.hasteT > 0) m.ronceT = Math.max(m.ronceT, m.hasteT);
  if (S.volPM && zone.some(m => m.entraveA === w.time)) p.courir(S.volPM.k, S.volPM.t);
  // Soins (9A) : Larme / Ronce Apaisante sur un relais soignent tout le cercle ; sans ennemi touché, l'allié visé ou soi
  const G = p.pcv('pc-sadida-G'), soin = (d.soin ?? 0) * gm * (id === 'larme' ? 1 + G / 100 : 1);   // Sève vivifiante
  if (soin > 0) {
    if (c.r) soignerZone(p, tx, ty, c.r, soin, w, G > 0);
    else if (S.soinSiRien && !zone.length) soignerVise(p, tx, ty, soin, w);
  }
  const O = id === 'ronce_apaisante' ? p.pcv('pc-sadida-O') : 0;   // Ronces bienveillantes : bouclier aux alliés soignés
  if (O && soin > 0) {
    const vises = c.r ? w.players.filter(q => !q.dead && Math.hypot(q.x - tx, q.y - ty) <= c.r! + q.radius)
      : !zone.length ? [w.players.find(j => j !== p && !j.dead && Math.hypot(j.x - tx, j.y - ty) <= CASE + j.radius) ?? p] : [];
    for (const q of vises) { q.shield = Math.max(q.shield, Math.round(q.maxHp * O / 100)); q.shieldT = q.shieldT0 = 4; q.shieldSrc = 'pc-sadida-O'; }
  }
  // 1A : propagation à tous les autres Infectés, sans critique ; Contagion fait sauter l'Infection autour de la cible
  const touches = zone.filter(m => c.infectes.has(m));
  const H = S.contagion ? p.pcv('pc-sadida-H') : 0;   // Contagion galopante : plus loin, -1 PM
  if (S.contagion && touches.length) for (const t of touches) for (const m of w.monsters)
    if (!m.dead && m !== t && Math.hypot(m.x - t.x, m.y - t.y) <= (S.contagion + H) * CASE + m.radius) { infecter(m, w, IT); if (H) entraver(m, w); }
  const libre = id === 'cigue' && p.pcv('pc-sadida-D') > 0;   // Cigüe mortelle : hors de la limite des 3 propagations
  if (S.propage && touches.length && (libre || propagationPossible(p, w, r))) {
    const autres = w.monsters.filter(m => !m.dead && m.infecteT > 0 && !zone.includes(m) && m.state !== 'spawn');
    if (autres.length) {
      if (!libre) p.sadiProp.push(w.time);
      const copie: HitDef = { ...hit, sansCrit: true, sort: id };
      for (const m of autres) {
        if (hit.dmg > 0 || hit.pmLoss || hit.lifesteal) w.applyHits(q => q === m, copie, tx, ty, 0);
        if (S.poison) empoisonner(p, m, S.poison * gm, d.element, w);
        if (S.seve) m.seveT = Math.max(m.seveT, S.seve);
        if (S.maintient) m.infecteT = Math.min(IMAX, m.infecteT + IT);
        if (hit.pmLoss && m.entraveA === w.time && m.hasteT > 0) m.ronceT = Math.max(m.ronceT, m.hasteT);
      }
      w.emit({ k: 'infection', x: touches[0].x, y: touches[0].y, cibles: autres.map(m => [m.x, m.y] as [number, number]) });
    }
  }
  if (S.infecte || S.contagion || S.propage) foretHantee(p, w);
}
/** 17B : succès « Forêt Hantée » : 6 Arbres Feuillus du Sadida et 10 ennemis Infectés en même temps. */
function foretHantee(p: Player, w: World) {
  const q = w.quetes;
  if (!q || q.compteurs.foretHantee || p !== w.players[0]) return;   // le perso de cet écran (hôte ou solo)
  if (arbresDe(p, w).filter(b => b.sadi?.feuillu).length < 6) return;
  if (w.monsters.filter(m => !m.dead && m.infecteT > 0).length >= 10) q.compteurs.foretHantee = 1;
}
function soignerZone(p: Player, x: number, y: number, r: number, n: number, w: World, arbres = false) {
  for (const q of w.players) if (!q.dead && Math.hypot(q.x - x, q.y - y) <= r + q.radius) soignerAllie(p, q, n, w, { x, y });
  for (const b of w.betes) if (!b.dead && (arbres || !b.def.sadida?.arbre) && Math.hypot(b.x - x, b.y - y) <= r + b.radius) b.soigner(n, w);
}
/** 9A : l'allié visé (à une case du point) ou soi. */
function soignerVise(p: Player, x: number, y: number, n: number, w: World) {
  const q = w.players.find(j => j !== p && !j.dead && Math.hypot(j.x - x, j.y - y) <= CASE + j.radius) ?? p;
  soignerAllie(p, q, n, w);
}

/** 6B : touche de classe (X) : toutes les Poupées foncent sur l'ennemi le plus proche de la souris (8 s). */
export function rallier(p: Player, aim: { x: number; y: number }, w: World): boolean {
  if (!R(p) || p.dead) return false;
  let best: Monster | null = null, bd = CASE * 3;
  for (const m of w.monsters) { if (m.dead) continue; const d = Math.hypot(m.x - aim.x, m.y - aim.y) - m.radius; if (d < bd) { bd = d; best = m; } }
  if (!best) { w.emit({ k: 'status', x: p.x, y: p.y - 70, text: 'Aucun ennemi sous la souris', color: '#a89fb6' }); return false; }
  p.sadiCible = best.id; p.sadiCibleT = 8;
  for (const b of vivantes(w)) if (b.owner === p && b.def.sadida!.poupee) { b.cast = null; b.state = 'suit'; }
  w.emit({ k: 'status', x: best.x, y: best.y - 50, text: 'Ralliement !', color: '#9be36a' });
  w.emit({ k: 'ralliement', x: best.x, y: best.y });
  return true;
}
/** Sentier de ronces (pc-sadida-B) : Passage racinaire Infecte les ennemis traversés et leur retire 1 PM. */
export function sentierDeRonces(p: Player, sx: number, sy: number, tx: number, ty: number, w: World) {
  if (!p.pcv('pc-sadida-B')) return;
  const dx = tx - sx, dy = ty - sy, L2 = dx * dx + dy * dy || 1;
  for (const m of w.monsters) {
    if (m.dead || m.state === 'spawn') continue;
    const k = Math.max(0, Math.min(1, ((m.x - sx) * dx + (m.y - sy) * dy) / L2));
    if (Math.hypot(m.x - sx - dx * k, m.y - sy - dy * k) > CASE * 0.6 + m.radius) continue;
    infecter(m, w, dureeInfection(p)); entraver(m, w);
  }
}
export function majSadida(p: Player, dt: number) {
  if (p.sadiCibleT > 0 && (p.sadiCibleT -= dt) <= 0) p.sadiCible = null;
}
