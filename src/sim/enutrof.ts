import type { SpellDef } from './defs';
import type { Bete } from './bete';
import type { Monster } from './monster';
import type { Player } from './player';
import type { Rang } from './butin';
import type { World } from './world';

/** Enutrof (maquette Enutrof, ligne de Mathis du 10 nov. 2026 :
 *  « 1A+1B 2D 3D (+ la mort de l'Enu compte) 4A+4C 5A (un seul coffre partagé par groupe) 6B 7C 8B 9A 10A 11A 12A 13A 14A 15A+15C 16A+16C »).
 *  Le coffre au trésor : un Coffre Animé permanent (2D) suit l'Enutrof, ne frappe jamais (16A) mais peut être frappé.
 *  Il se remplit de pièces à chaque monstre vaincu près de lui (1A), une de plus si le monstre était entravé (1B).
 *  4 paliers (Bronze, Argent, Or, Trésor) ; la touche du coffre l'ouvre : butin d'élite ou de boss tiré avec les vraies tables (4A),
 *  parfois un apparat de chasseur de trésor (4C). À 0 PV il perd la moitié de ses pièces et reste assommé (3D), comme à la mort de l'Enutrof.
 *  Coop (5A) : à l'ouverture, chaque allié proche reçoit son tas, un palier en dessous, réservé ; un seul coffre du groupe partage.
 *  L'état propre à chaque Enutrof (pièces, coffre assommé) est rangé dans son Player : plusieurs Enutrofs ont chacun le leur. */

const CASE = 48;
/** Réglages : classes.json > enutrof.coffre. */
export interface ReglesCoffre {
  paliers: number[]; noms: string[];
  /** Pièces par monstre vaincu selon son rang, et en plus s'il a été entravé (retrait de PM, PA ou Portée) moins de `fenetre` s avant. */
  gains: { normal: number; elite: number; archi: number; boss: number }; entrave: number; fenetre: number;
  /** Distance (px) jusqu'où un monstre vaincu remplit le coffre (et où les alliés reçoivent leur part). */
  portee: number;
  /** Secondes où le coffre reste assommé après être tombé. */
  ko: number;
  /** Butin de chaque palier : rang des tirages, nombre, objet Épique ou mieux garanti. */
  butin: { rang: Rang; n: number; epique?: boolean }[];
  /** 4C : chance d'un apparat de chasseur de trésor dans un coffre Or ou Trésor, et les apparats possibles (id Dofus). */
  tresor: { chance: number; dePalier: number; apparats: string[] };
  /** 15C : pièces gagnées en donnant un objet Rare ou Épique au coffre. */
  avale: { rare: number; epique: number };
}
export const CLE_COFFRE = 'coffre_tresor';

const R = (p: Player): ReglesCoffre | undefined => p.cls.coffre;
/** Palier atteint (0 Bronze … 3 Trésor), -1 sous le premier. */
export function palierCoffre(p: Player): number {
  const C = R(p);
  if (!C) return -1;
  let i = -1;
  C.paliers.forEach((n, k) => { if (p.coffrePieces >= n) i = k; });
  return i;
}
/** Le Coffre Animé de cet Enutrof (vivant), s'il est là. */
export function coffreDe(p: Player, world: World): Bete | undefined {
  return world.betes.find(b => b.owner === p && b.base === CLE_COFFRE && !b.dead);
}

/** À chaque pas de l'Enutrof : le coffre assommé se relève, le coffre absent (porte, Zaap, mort) revient à côté de lui. */
export function majEnutrof(p: Player, dt: number, world: World) {
  if (p.coffreKoT > 0) { p.coffreKoT -= dt; return; }
  if (p.dead || coffreDe(p, world) || world.betes.some(b => b.owner === p && b.base === CLE_COFFRE)) return;
  const a = p.facing + Math.PI;
  const b = world.invoquer(p, CLE_COFFRE, 'coffre', p.x + Math.cos(a) * CASE * 1.5, p.y + Math.sin(a) * CASE * 1.5, true);
  if (b) b.horsCompte = true;   // ne prend pas de place d'Invocation
}

/** Pièces gagnées quand un monstre tombe : chaque Enutrof vivant assez proche (lui ou un allié l'a vaincu). */
export function piecesMonstre(world: World, m: Monster) {
  for (const p of world.players) {
    const C = R(p);
    if (!C || p.dead || Math.hypot(p.x - m.x, p.y - m.y) > C.portee) continue;
    const g = C.gains, rang = m.def.boss ? g.boss : m.def.archiDe ? g.archi : m.def.elite ? g.elite : g.normal;
    const n = rang + (world.time - m.entraveA <= C.fenetre ? C.entrave : 0);
    ajouterPieces(p, n, world, m.x, m.y);
  }
}
export function ajouterPieces(p: Player, n: number, world: World, x: number, y: number) {
  const C = R(p);
  if (!C || n <= 0) return;
  const avant = palierCoffre(p), max = C.paliers[C.paliers.length - 1];
  p.coffrePieces = Math.min(max, p.coffrePieces + n);
  const c = coffreDe(p, world);
  // 15A : les pièces volent du monstre vers le coffre (ou l'Enutrof si le coffre est assommé)
  world.emit({ k: 'pieces', x, y, tx: c?.x ?? p.x, ty: c?.y ?? p.y, n });
  const apres = palierCoffre(p);
  if (apres > avant) world.emit({ k: 'status', x: c?.x ?? p.x, y: (c?.y ?? p.y) - 60, text: `Coffre : ${C.noms[apres]} !`, color: ['#c98b4e', '#dfe6ee', '#ffcf4a', '#ff9d3a'][apres] ?? '#ffcf4a' });
}

/** 3D : le coffre tombé à 0 PV, ou l'Enutrof mort, perd la moitié de ses pièces (une seule fois si les deux arrivent ensemble). */
export function perteCoffre(p: Player, world: World) {
  if (!R(p) || world.time - p.coffrePerteA < 1 || p.coffrePieces <= 0) return;
  p.coffrePerteA = world.time;
  const n = Math.floor(p.coffrePieces / 2);
  p.coffrePieces -= n;
  if (n) world.emit({ k: 'status', x: p.x, y: p.y - 80, text: `Coffre : -${n} pièces`, color: '#ff8a6a' });
}
/** Le Coffre Animé tombe : assommé `ko` s, puis il revient à côté de l'Enutrof. */
export function coffreAssomme(b: Bete, world: World) {
  const p = b.owner, C = R(p);
  if (!C) return;
  perteCoffre(p, world);
  if (!p.dead) { p.coffreKoT = C.ko; world.emit({ k: 'status', x: b.x, y: b.y - 50, text: 'Coffre assommé', color: '#c8c8c8' }); }
}

/** Touche du coffre : il s'ouvre là où il est et crache son butin ; les alliés proches reçoivent le leur (5A). */
export function ouvrirCoffre(p: Player, world: World): boolean {
  const C = R(p), i = palierCoffre(p);
  if (!C) return false;
  const c = coffreDe(p, world);
  if (i < 0 || !c) {
    world.emit({ k: 'status', x: p.x, y: p.y - 70, text: !c ? 'Coffre assommé' : `Coffre : ${p.coffrePieces} / ${C.paliers[0]} pièces`, color: '#c8c8c8' });
    return false;
  }
  p.coffrePieces = 0;
  const niv = world.niveauEn(c.x, c.y);
  const lacher = (q: Player, k: number, pour?: number) => {
    const B = C.butin[k];
    for (let n = 0; n < B.n; n++) world.butinCoffre(q, B.rang, niv, c.x, c.y, pour, B.epique && n === 0);
  };
  lacher(p, i);
  // 4C : un apparat de chasseur de trésor, rarement, dans un coffre Or ou Trésor
  if (i >= C.tresor.dePalier && world.rng.next() < C.tresor.chance) {
    const libres = C.tresor.apparats.filter(id => !p.apparats.includes(id));
    if (libres.length) { const id = world.rng.pick(libres); p.apparats.push(id); world.emit({ k: 'apparence', id }); }
  }
  // 5A : un seul coffre par groupe donne aux alliés (le premier Enutrof de la partie) ; chacun garde le sien pour lui
  const partageur = world.players.find(q => q.cls.coffre);
  if (partageur === p && i > 0)
    for (const q of world.players) if (q !== p && !q.dead && Math.hypot(q.x - c.x, q.y - c.y) <= C.portee) lacher(q, i - 1, q.id);
  world.emit({ k: 'spell', fx: 'burst', id: 'coffre', x: c.x, y: c.y, facing: 0, size: CASE * (1.5 + i * 0.5), arc: 0, element: 'eau', big: i >= 2, boosted: i >= 2 });
  world.emit({ k: 'status', x: c.x, y: c.y - 70, text: `Coffre ${C.noms[i]} ouvert !`, color: ['#c98b4e', '#dfe6ee', '#ffcf4a', '#ff9d3a'][i] ?? '#ffcf4a' });
  return true;
}

/** 15C : donner un objet Rare ou Épique du sac au coffre, contre des pièces. */
export function piecesObjet(p: Player, rarete: string): number {
  const C = R(p);
  return !C ? 0 : rarete === 'rare' ? C.avale.rare : rarete === 'epique' ? C.avale.epique : 0;
}

/** Effets des sorts de l'Enutrof qui ne passent pas par les coups (après l'impact) :
 *  Force de l'Âge (course), Ruée vers l'Or (allié ou soi), Boîte de Pandore, Clef du Trésor, Coffre Animé et Malle Animée (le coffre). */
export function impactEnutrof(p: Player, d: SpellDef, tx: number, ty: number, touches: number, world: World) {
  const E = d.enutrof;
  if (!E) return;
  if (E.course) p.courir(E.course.k, E.course.t);
  const allie = (r: number): Player => {   // l'allié sous le point visé, sinon soi (11A)
    let best: Player = p, bd = r;
    for (const q of world.players) { if (q.dead || q === p) continue; const dd = Math.hypot(q.x - tx, q.y - ty); if (dd < bd) { bd = dd; best = q; } }
    return best;
  };
  if (E.ruee) {
    const q = allie(CASE * 1.5);
    q.courir(E.ruee.vitesse, E.ruee.t);
    q.addMod('puissance', E.ruee.puissance, E.ruee.t, 'ruee_or');
    soigner(q, q.maxHp * E.ruee.soin, world);
    world.emit({ k: 'status', x: q.x, y: q.y - 60, text: 'Ruée vers l\'Or', color: '#ffcf4a' });
  }
  if (E.pandore) {   // soigne tous les alliés autour, mais les ennemis proches courent plus vite
    const r = E.pandore.rayon;
    for (const q of world.players) if (!q.dead && Math.hypot(q.x - p.x, q.y - p.y) <= r) soigner(q, q.maxHp * E.pandore.soin, world);
    for (const b of world.betes) if (!b.dead && b.owner === p && Math.hypot(b.x - p.x, b.y - p.y) <= r) b.soigner(b.maxHp * E.pandore.soin, world);
    for (const m of world.monsters) if (!m.dead && m.state !== 'idle' && Math.hypot(m.x - p.x, m.y - p.y) <= r) { m.haste = Math.max(m.haste, 1 + E.pandore.hate); m.hasteT = Math.max(m.hasteT, E.pandore.t); }
  }
  if (E.clef && !touches) {   // Clef du Trésor sans ennemi touché : +Portée à l'allié visé (ou à soi)
    const q = allie(CASE * 1.5);
    q.addMod('portee', E.clef.portee, E.clef.t, 'clef_tresor');
    world.emit({ k: 'status', x: q.x, y: q.y - 60, text: `+${E.clef.portee} PO`, color: '#c8a0ff' });
  }
  if (E.coffreBouclier || E.coffreSoin) {
    const c = coffreDe(p, world);
    if (!c) { world.emit({ k: 'status', x: p.x, y: p.y - 70, text: 'Coffre assommé', color: '#c8c8c8' }); return; }
    if (E.coffreBouclier) { c.shield = Math.max(c.shield, Math.round(c.maxHp * E.coffreBouclier.part)); c.shieldT = E.coffreBouclier.t; world.emit({ k: 'status', x: c.x, y: c.y - 50, text: 'Bouclier', color: '#9fd3ff' }); }
    if (E.coffreSoin) c.soigner(c.maxHp * E.coffreSoin, world);
  }
}
function soigner(q: Player, n: number, world: World) {
  const v = Math.max(0, Math.min(q.maxHp - q.hp, Math.round(n)));
  if (v <= 0 || q.dead) return;
  q.hp += v;
  world.emit({ k: 'heal', x: q.x, y: q.y, z: 50, amount: v });
}
