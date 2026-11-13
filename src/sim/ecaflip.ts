import type { SpellDef } from './defs';
import type { Stat } from './items';
import type { Player } from './player';
import type { World } from './world';

/** Écaflip (maquette Écaflip, ligne de Mathis du 13 nov. 2026 :
 *  « 1A 2A+2C 3A+3B 4A+4C 5A 6B 7A 8A 9A 10A 11A 12A 13A 14A 15A+15C »).
 *  Le Poker d'Ecaflip officiel (refonte 2.72) en temps réel : chaque sort à carte Pioche sa carte dans la Main (4 au plus) ;
 *  la touche de classe Joue la Main : chaque carte posée sur la Table donne son bonus officiel pendant 9 s (moitié aux alliés proches, 3B),
 *  et la Main gagnante (paire, brelan, couleur, carré, suites…) donne des dommages en plus pendant 9 s (4A), avec un jackpot (4C).
 *  6B : hasard pur, aucun filet de sécurité (pas de « la chance tourne »).
 *  Pile ou Face (5A), Roulette (7A), Tromperie (élément tiré à chaque lancer), Chaton (Griffe Invocatrice : Puissance tant qu'il vit).
 *  Tout l'état est dans le Player : plusieurs Écaflips ont chacun leur Main. */

const CASE = 48;
/** Une carte : couleur (0 Pique/Air, 1 Trèfle/Eau, 2 Cœur/Feu, 3 Carreau/Terre) et valeur (0 Valet, 1 Dame, 2 Roi, 3 As). */
export interface Carte { c: number; v: number }
/** Main gagnante en cours : % de dommages, élément (-1 = tous), secondes restantes. */
export interface MainGagnante { nom: string; pct: number; el: number; t: number }
/** Réglages : classes.json > ecaflip.poker. */
export interface ReglesPoker {
  main: number;
  table: { t: number; stats: Stat[]; valeurs: number[][]; allies: number; portee: number };
  mains: { paire: number; doublePaire: number; brelan: number; couleur: number; carre: number[]; suite: number; suiteCouleur: number; suiteCouleurs: number; t: number };
  pileFace: { vitesse: number; course: number; t: number };
  roulette: { t: number; effets: string[]; course: number; lenteur: number; soin: number; critique: number; fragile: number; puissance: number };
  icones: number[];
}
/** Effets des sorts (SpellDef.ecaflip). */
export interface EffetsEcaflip {
  /** Carte piochée [couleur, valeur]. */
  carte?: [number, number];
  /** Dames : dommages +parCarte par carte de cette couleur dans la Main, puis ces cartes sont jouées. */
  couleur?: number; parCarte?: number;
  course?: { k: number; t: number };
  /** Yams : dé officiel (dommages 1 à 6), Critique en plus (cumul). */
  de?: [number, number]; crit?: { n: number; t: number; max: number };
  soinSiRien?: boolean; pileFace?: boolean;
  pioche?: number; rembourse?: boolean;
  perception?: { soin: number; parEnnemi: number; max: number };
  chateau?: { parValeur: number[]; t: number };
  roulette?: boolean; tromperie?: boolean;
  chaton?: { puissance: number };
  bondAllie?: { k: number; t: number };
}

export const ELEMENTS_CARTE = ['air', 'eau', 'feu', 'terre'] as const;
export const COULEURS = ['Pique', 'Trèfle', 'Cœur', 'Carreau'];
export const VALEURS = ['Valet', 'Dame', 'Roi', 'As'];
export const TEINTES = ['#7fe0a0', '#6fb8ff', '#ff7a5a', '#d8a35a'];
export const nomCarte = (k: Carte) => `${VALEURS[k.v]} de ${COULEURS[k.c]}`;
const R = (p: Player): ReglesPoker | undefined => p.cls.poker;

/** Valeur la plus haute qu'une Pioche aléatoire peut donner : les Rois arrivent avec leurs sorts (niveau 95), les As au 125. */
export function valeurMax(p: Player): number { return p.level >= 125 ? 3 : p.level >= 95 ? 2 : 1; }

/** Pioche une carte dans la Main (rien si elle est pleine). */
export function piocher(p: Player, k: Carte, world: World): boolean {
  const P = R(p);
  if (!P || p.ecaMain.length >= P.main) return false;
  p.ecaMain.push({ c: k.c, v: k.v });
  world.emit({ k: 'status', x: p.x + (world.rng.next() - 0.5) * 30, y: p.y - 78, text: nomCarte(k), color: TEINTES[k.c] });
  return true;
}
function piocherHasard(p: Player, world: World) {
  piocher(p, { c: world.rng.int(4), v: world.rng.int(valeurMax(p) + 1) }, world);
}

/** Pose des cartes sur la Table : bonus officiel de chacune pendant `t` s, moitié aux alliés à portée (3B). */
function poserTable(p: Player, cartes: Carte[], world: World) {
  const P = R(p)!;
  const T = P.table;
  for (const k of cartes) {
    const stat = T.stats[k.c], n = T.valeurs[k.c][k.v];
    p.addMod(stat, n, T.t, 'table');
    for (const q of world.players) if (q !== p && !q.dead && Math.hypot(q.x - p.x, q.y - p.y) <= T.portee) q.addMod(stat, Math.round(n * T.allies), T.t, 'table');
  }
  world.emit({ k: 'cartesJouees', x: p.x, y: p.y, cartes: cartes.map(k => k.c * 4 + k.v) });
}

/** Meilleure main gagnante de ces cartes (null : rien). */
export function evaluerMain(cartes: Carte[], P: ReglesPoker): MainGagnante | null {
  const M = P.mains, parV = [0, 0, 0, 0], parC = [0, 0, 0, 0];
  for (const k of cartes) { parV[k.v]++; parC[k.c]++; }
  const c: MainGagnante[] = [];
  const t = M.t;
  if (cartes.length === 4 && parV.every(n => n === 1)) {
    const une = parC.findIndex(n => n === 4);
    if (une >= 0) c.push({ nom: `Suite Royale de ${COULEURS[une]}`, pct: M.suiteCouleur, el: une, t });
    else if (parC.every(n => n === 1)) c.push({ nom: 'Suite Royale Couleurs', pct: M.suiteCouleurs, el: -1, t });
    else c.push({ nom: 'Suite Royale', pct: M.suite, el: -1, t });
  }
  parV.forEach((n, v) => { if (n === 4) c.push({ nom: `Carré de ${VALEURS[v]}s`, pct: M.carre[v], el: -1, t }); });
  parC.forEach((n, k) => { if (n === 4) c.push({ nom: `Couleur ${COULEURS[k]}`, pct: M.couleur, el: k, t }); });
  if (parV.some(n => n === 3)) c.push({ nom: 'Brelan', pct: M.brelan, el: -1, t });
  const paires = parV.filter(n => n === 2).length;
  if (paires === 2) c.push({ nom: 'Double Paire', pct: M.doublePaire, el: -1, t });
  else if (paires === 1) c.push({ nom: 'Paire', pct: M.paire, el: -1, t });
  if (!c.length) return null;
  return c.reduce((a, b) => (b.pct > a.pct || (b.pct === a.pct && b.el < 0 && a.el >= 0) ? b : a));
}
/** 4C : les mains qui font un jackpot (carré, suites). */
const jackpot = (g: MainGagnante) => g.nom.startsWith('Carré') || g.nom.startsWith('Suite');

/** Joue toute la Main (touche de classe, Bonne Pioche ou Tromperie Main pleine, Château de Cartes) : Table, puis Main gagnante. */
export function jouerMain(p: Player, world: World): boolean {
  const P = R(p);
  if (!P || p.dead) return false;
  if (!p.ecaMain.length) { world.emit({ k: 'status', x: p.x, y: p.y - 70, text: 'Main vide', color: '#a89fb6' }); return false; }
  const cartes = p.ecaMain;
  p.ecaMain = [];
  poserTable(p, cartes, world);
  const g = evaluerMain(cartes, P);
  if (g) {
    p.ecaGagnante = g;
    const j = jackpot(g);
    world.emit({ k: 'status', x: p.x, y: p.y - 96, text: `${j ? 'JACKPOT ! ' : ''}${g.nom} : +${g.pct} % dommages${g.el >= 0 ? ` ${ELEMENTS_CARTE[g.el]}` : ''}`, color: j ? '#ffd84a' : '#f2e3b0' });
    world.emit({ k: 'mainGagnante', x: p.x, y: p.y, nom: g.nom, jackpot: j });
    if (j) world.emit({ k: 'impact', hitstop: 0.08, shake: 0.014, big: true });
  } else world.emit({ k: 'status', x: p.x, y: p.y - 80, text: `Table : ${cartes.length} carte${cartes.length > 1 ? 's' : ''}`, color: '#f2e3b0' });
  return true;
}

/** Tromperie : élément tiré pour le lancer en cours (couleur), gardé jusqu'à l'impact. */
const tromperieEl = new WeakMap<Player, number>();
/** Dames : cartes de leur couleur dans la Main au moment du lancer. */
const damesN = new WeakMap<Player, number>();

/** Avant le coup d'un sort de l'Écaflip : multiplicateur de dommages (Main gagnante, Dames, dé du Yams) et élément (Tromperie). */
export function avantImpactEcaflip(p: Player, d: SpellDef, world: World): { mult: number; element?: SpellDef['element'] } {
  const E = d.ecaflip;
  let mult = 1, element: SpellDef['element'] | undefined;
  if (E?.tromperie) { const c = world.rng.int(4); tromperieEl.set(p, c); element = ELEMENTS_CARTE[c]; }
  if (E?.couleur != null) {
    const n = p.ecaMain.filter(k => k.c === E.couleur).length;
    damesN.set(p, n);
    mult *= 1 + (E.parCarte ?? 0) * n;
  }
  if (E?.de) mult *= (E.de[0] + world.rng.int(E.de[1] - E.de[0] + 1)) / ((E.de[0] + E.de[1]) / 2);
  const g = p.ecaGagnante, el = element ?? d.element;
  if (g && g.t > 0 && d.dmg > 0 && (g.el < 0 || ELEMENTS_CARTE[g.el] === el)) mult *= 1 + g.pct / 100;
  return { mult, element };
}

/** L'allié sous le point visé (à r px), sinon soi s'il vise près de lui, sinon null. */
function allieVise(p: Player, tx: number, ty: number, r: number, world: World, soiParDefaut = false): Player | null {
  let best: Player | null = null, bd = r;
  for (const q of world.players) { if (q.dead) continue; const dd = Math.hypot(q.x - tx, q.y - ty); if (dd <= bd) { bd = dd; best = q; } }
  return best ?? (soiParDefaut ? p : null);
}
function soigner(q: Player, n: number, world: World) {
  const v = q.soigner(n);
  if (v > 0) world.emit({ k: 'heal', x: q.x, y: q.y, z: 50, amount: v });
}

/** Après l'impact d'un sort de l'Écaflip : Pioche, Table des Dames, Pile ou Face, Roulette, soins… */
export function impactEcaflip(p: Player, id: string, d: SpellDef, tx: number, ty: number, touches: number, base: number, world: World) {
  const E = d.ecaflip, P = R(p);
  if (!E || !P) return;
  if (E.course) p.courir(E.course.k, E.course.t);
  if (E.crit) {   // Yams : cumul de Critique
    const l = p.mods.filter(m => m.src === 'yams');
    if (l.length >= E.crit.max) p.mods.splice(p.mods.indexOf(l[0]), 1);
    p.addMod('critique', E.crit.n, E.crit.t, 'yams');
  }
  if (E.soinSiRien && !touches) { const q = allieVise(p, tx, ty, CASE * 1.5, world); if (q) soigner(q, base, world); }   // Topkaj : soigne l'allié visé
  if (E.pileFace) {
    const F = P.pileFace, pile = p.ecaPF === 0 ? world.rng.next() < 0.5 : p.ecaPF === 2;
    p.mods = p.mods.filter(m => m.src !== 'pile');
    p.ecaPF = pile ? 1 : 2; p.ecaPFT = F.t;
    if (pile) p.addMod('vitesse', F.vitesse, F.t, 'pile');
    else p.courir(F.course, F.t);
    world.emit({ k: 'status', x: p.x, y: p.y - 60, text: pile ? `Pile : +${F.vitesse} % vitesse d'attaque` : 'Face : vitesse de course', color: '#e8d27a' });
  }
  if (E.perception) {
    const q = allieVise(p, tx, ty, CASE * 1.5, world, true)!, r = d.hit.shape === 'point' ? d.hit.radius : CASE * 2;
    const n = Math.min(E.perception.max, world.monsters.filter(m => !m.dead && Math.hypot(m.x - tx, m.y - ty) <= r + m.radius).length);
    soigner(q, q.maxHp * (E.perception.soin + E.perception.parEnnemi * n), world);
  }
  if (E.chateau) {
    const q = allieVise(p, tx, ty, CASE * 1.5, world, true)!;
    const part = p.ecaMain.reduce((a, k) => a + (E.chateau!.parValeur[k.v] ?? 0), 0);
    if (part > 0) {
      q.shield = Math.max(q.shield, Math.round(q.maxHp * part)); q.shieldT = q.shieldT0 = E.chateau.t; q.shieldSrc = id;
      world.emit({ k: 'status', x: q.x, y: q.y - 60, text: 'Château de Cartes', color: '#9fd3ff' });
    }
    jouerMain(p, world);
  }
  if (E.roulette) roulette(p, world);
  if (E.chaton) { /* la Puissance du Chaton est tenue par majEcaflip, tant qu'il vit */ }
  if (E.bondAllie) { const q = allieVise(p, tx, ty, CASE, world); if (q && q !== p) q.courir(E.bondAllie.k, E.bondAllie.t); }
  // Dames : joue les cartes de leur couleur tenues au lancer, puis pioche la Dame
  if (E.couleur != null && (damesN.get(p) ?? 0) > 0) {
    const jouees = p.ecaMain.filter(k => k.c === E.couleur);
    p.ecaMain = p.ecaMain.filter(k => k.c !== E.couleur);
    if (jouees.length) poserTable(p, jouees, world);
  }
  damesN.delete(p);
  if (E.pioche) {   // Bonne Pioche : joue la Main si elle est pleine, puis pioche au hasard
    if (p.ecaMain.length >= P.main) jouerMain(p, world);
    for (let i = 0; i < E.pioche; i++) piocherHasard(p, world);
  }
  if (E.tromperie) {   // la carte de l'élément tiré ; Main pleine : jouée avant
    const c = tromperieEl.get(p) ?? 0; tromperieEl.delete(p);
    if (p.ecaMain.length >= P.main) jouerMain(p, world);
    piocher(p, { c, v: 0 }, world);
  }
  if (E.carte) piocher(p, { c: E.carte[0], v: E.carte[1] }, world);
  if (E.rembourse) p.pa = Math.min(p.paMax, p.pa + p.paCost(id));
}

/** Roulette (7A) : un effet tiré au hasard, sur tout le monde (alliés, Écaflip et monstres) dans la zone. */
function roulette(p: Player, world: World) {
  const Ro = R(p)!.roulette, r = p.cls.spells.roulette?.hit.shape === 'circle' ? p.cls.spells.roulette.hit.radius : CASE * 6;
  const e = world.rng.pick(Ro.effets);
  const joueurs = world.players.filter(q => !q.dead && Math.hypot(q.x - p.x, q.y - p.y) <= r);
  const monstres = world.monsters.filter(m => !m.dead && Math.hypot(m.x - p.x, m.y - p.y) <= r + m.radius);
  const T = Ro.t;
  const textes: Record<string, string> = { course: 'Tout le monde court plus vite', lenteur: 'Tout le monde ralentit', soin: 'Tout le monde est soigné',
    critique: `+${Ro.critique} % Critique pour tous`, fragile: `Tout le monde subit +${Ro.fragile} % de dommages`, puissance: `+${Ro.puissance} Puissance pour tous` };
  for (const q of joueurs) {
    if (e === 'course') q.courir(Ro.course, T);
    else if (e === 'lenteur') q.slow(T, Ro.lenteur);
    else if (e === 'soin') soigner(q, q.maxHp * Ro.soin, world);
    else if (e === 'critique') q.addMod('critique', Ro.critique, T, 'roulette');
    else if (e === 'fragile') { q.subis = Math.max(q.subis, 1 + Ro.fragile / 100); q.subisT = Math.max(q.subisT, T); }
    else if (e === 'puissance') q.addMod('puissance', Ro.puissance, T, 'roulette');
  }
  for (const m of monstres) {
    if (e === 'course') { m.haste = Math.max(m.haste, 1 + Ro.course); m.hasteT = Math.max(m.hasteT, T); }
    else if (e === 'lenteur') { m.haste = Math.min(m.haste, 1 - Ro.lenteur); m.hasteT = Math.max(m.hasteT, T); }
    else if (e === 'soin') m.hp = Math.min(m.maxHp, m.hp + m.maxHp * Ro.soin);
    else if (e === 'fragile') { m.vuln = Math.max(m.vuln, Ro.fragile); m.vulnT = Math.max(m.vulnT, T); }
    else if (e === 'puissance') { m.furyPct = Math.max(m.furyPct, Ro.puissance / 2); m.furyT = Math.max(m.furyT, T); }
  }
  world.emit({ k: 'status', x: p.x, y: p.y - 96, text: `Roulette : ${textes[e] ?? e}`, color: '#ffd84a' });
  world.emit({ k: 'roulette', x: p.x, y: p.y, effet: e });
}

/** À chaque pas de l'Écaflip : minuteries de Pile ou Face et de la Main gagnante, Puissance du Chaton tant qu'il vit. */
export function majEcaflip(p: Player, dt: number, world: World) {
  if (p.ecaPFT > 0 && (p.ecaPFT -= dt) <= 0) p.ecaPF = 0;
  const g = p.ecaGagnante;
  if (g && (g.t -= dt) <= 0) p.ecaGagnante = null;
  const C = p.cls.spells.griffe_invocatrice?.ecaflip?.chaton;
  if (!C) return;
  const vivant = !p.dead && world.betes.some(b => b.owner === p && !b.dead && b.base === 'chaton_enrage');
  const a = p.mods.some(m => m.src === 'chaton');
  if (vivant && !a) p.addMod('puissance', C.puissance, Infinity, 'chaton');
  else if (!vivant && a) p.mods = p.mods.filter(m => m.src !== 'chaton');
}
