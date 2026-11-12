import type { SpellDef } from './defs';
import type { Bete } from './bete';
import type { Monster } from './monster';
import type { Player } from './player';
import type { Butin, Rang } from './butin';
import { RARITIES, type Item } from './items';
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
  /** Interface du coffre 5B (vitrine) : ce qui s'ajoute dans le coffre à chaque palier atteint (rang des tirages, nombre,
   *  objet Épique ou mieux en plus). Le coffre ouvert rend tout ce qui s'est ajouté jusqu'au palier atteint. */
  butin: { rang: Rang; n: number; epique?: boolean }[];
  /** Interface du coffre 6B : après Trésor, chaque palier de surcharge ajoute ce butin ; le coffre attire les monstres à `attire`
   *  cases, et s'il tombe (ou l'Enutrof) en surcharge, il perd tout. */
  surcharge: { paliers: number[]; noms: string[]; butin: { rang: Rang; n: number }; attire: number };
  /** Interface du coffre 7B : le coffre ramasse les kamas au sol à `aimant` px autour de lui. */
  aimant: number;
  /** 4C : chance d'un apparat de chasseur de trésor dans un coffre Or ou Trésor, et les apparats possibles (id Dofus). */
  tresor: { chance: number; dePalier: number; apparats: string[] };
  /** 15C : pièces gagnées en donnant un objet Rare ou Épique au coffre. */
  avale: { rare: number; epique: number };
}
export const CLE_COFFRE = 'coffre_tresor';
/** 5B : ce que le coffre a déjà « avalé » pour un palier atteint (tiré au moment du palier, caché sous sa lueur). */
export interface VitrineCoffre { palier: number; butin: Butin }
/** 3B : une ligne du journal des pièces (plus récente en premier). */
export interface LigneCoffre { t: string; n: number; /** même gain plusieurs fois de suite (regroupé) */ fois?: number }
/** 3D : records du coffre de ce perso. */
export interface RecordsCoffre { ouverts: number; plusGros: number; palierMax: number; legendaires: number; total: number }
export const recordsVides = (): RecordsCoffre => ({ ouverts: 0, plusGros: 0, palierMax: -1, legendaires: 0, total: 0 });
/** Ce qui est sauvé avec le perso (8A). */
export interface EtatCoffre { pieces: number; vitrine: VitrineCoffre[]; journal: LigneCoffre[]; records: RecordsCoffre }
/** 7D : délai avant le premier objet éjecté, puis entre deux objets ; durée de la gueule ouverte. */
export const EJECTION = { debut: 0.35, pas: 0.16, gueule: 0.9 };
const JOURNAL_MAX = 10;

const R = (p: Player): ReglesCoffre | undefined => p.cls.coffre;
/** Tous les paliers, surcharge comprise (0 Bronze … 3 Trésor, 4+ surcharge). */
export function seuilsCoffre(C: ReglesCoffre): number[] { return [...C.paliers, ...(C.surcharge?.paliers ?? [])]; }
export function nomsCoffre(C: ReglesCoffre): string[] { return [...C.noms, ...(C.surcharge?.noms ?? [])]; }
/** Palier atteint (0 Bronze … 3 Trésor, 4 à 6 surcharge), -1 sous le premier. */
export function palierCoffre(p: Player): number {
  const C = R(p);
  if (!C) return -1;
  let i = -1;
  seuilsCoffre(C).forEach((n, k) => { if (p.coffrePieces >= n) i = k; });
  return i;
}
/** 6B : le coffre est en surcharge (au-delà de Trésor). */
export function enSurcharge(p: Player): boolean { const C = R(p); return !!C && palierCoffre(p) >= C.paliers.length; }
/** Le Coffre Animé de cet Enutrof (vivant), s'il est là. */
export function coffreDe(p: Player, world: World): Bete | undefined {
  return world.betes.find(b => b.owner === p && b.base === CLE_COFFRE && !b.dead);
}
/** Couleur de chaque palier (−1 = vide), pour l'affichage. */
export const COULEURS_COFFRE = ['#b89a7a', '#c98b4e', '#dfe6ee', '#ffcf4a', '#ff9d3a', '#ff7a3a', '#ff5a3a', '#ff3a3a'];
export const couleurCoffre = (pal: number) => COULEURS_COFFRE[Math.min(COULEURS_COFFRE.length - 1, pal + 1)];
/** Le seul coffre du groupe qui donne aux alliés (5A) : le premier Enutrof de la partie. */
export const partageurCoffre = (world: World): Player | undefined => world.players.find(q => q.cls.coffre);

/** 3B : note une ligne dans le journal des pièces. */
function noter(p: Player, t: string, n: number) {
  const d = p.coffreJournal[0];
  if (d && d.t === t && n > 0 && d.n > 0 && d.n % n === 0) { d.n += n; d.fois = (d.fois ?? 1) + 1; return; }   // « Bouftou, entravé ×10 »
  p.coffreJournal.unshift({ t, n });
  if (p.coffreJournal.length > JOURNAL_MAX) p.coffreJournal.length = JOURNAL_MAX;
}

/** À chaque pas de l'Enutrof : objets du coffre ouvert éjectés un par un (7D), le coffre assommé se relève,
 *  le coffre absent (porte, Zaap, mort) revient à côté de lui. */
export function majEnutrof(p: Player, dt: number, world: World) {
  const ej = p.coffreEjection;
  if (ej.length) {
    for (const e of ej) e.t -= dt;
    while (ej.length && ej[0].t <= 0) { const e = ej.shift()!; world.ejecterCoffre(e.b, e.x, e.y); }
  }
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
    const ent = world.time - m.entraveA <= C.fenetre;
    const n = rang + (ent ? C.entrave : 0);
    ajouterPieces(p, n, world, m.x, m.y, `${m.def.name}${m.def.boss ? ' (boss)' : m.def.archiDe ? ' (archimonstre)' : m.def.elite ? ' (élite)' : ''}${ent ? ', entravé' : ''}`);
  }
}
export function ajouterPieces(p: Player, n: number, world: World, x: number, y: number, raison = 'Pièces') {
  const C = R(p);
  if (!C || n <= 0) return;
  const S = seuilsCoffre(C), avant = palierCoffre(p), max = S[S.length - 1];
  const gain = Math.min(max, p.coffrePieces + n) - p.coffrePieces;
  if (gain <= 0) return;
  p.coffrePieces += gain;
  p.coffreRecords.total += gain;
  noter(p, raison, gain);
  const c = coffreDe(p, world);
  // 15A : les pièces volent du monstre vers le coffre (ou l'Enutrof si le coffre est assommé)
  world.emit({ k: 'pieces', x, y, tx: c?.x ?? p.x, ty: c?.y ?? p.y, n: gain });
  const apres = palierCoffre(p);
  if (apres > avant) {
    remplirVitrine(p, world, c?.x ?? p.x, c?.y ?? p.y);
    const sur = apres >= C.paliers.length;
    world.emit({ k: 'status', x: c?.x ?? p.x, y: (c?.y ?? p.y) - 60, text: sur ? `Coffre : ${nomsCoffre(C)[apres]} ! Il attire les monstres` : `Coffre : ${C.noms[apres]} !`, color: couleurCoffre(apres) });
  }
}
/** Ce qui s'ajoute au coffre en atteignant le palier k. */
function ajoutPalier(C: ReglesCoffre, k: number): { rang: Rang; n: number; epique?: boolean } {
  return k < C.butin.length ? C.butin[k] : C.surcharge.butin;
}
/** 5B : tire ce qui manque dans la vitrine pour chaque palier atteint (au moment où il est atteint, avec la Prospection de p). */
function remplirVitrine(p: Player, world: World, x: number, y: number) {
  const C = R(p), pal = palierCoffre(p);
  if (!C) return;
  const niv = world.niveauEn(x, y);
  for (let k = 0; k <= pal; k++) {
    if (p.coffreVitrine.some(v => v.palier === k)) continue;
    const A = ajoutPalier(C, k);
    p.coffreVitrine.push({ palier: k, butin: world.tirerCoffre(p, A.rang, A.n, niv, !!A.epique) });
  }
  p.coffreVitrine.sort((a, b) => a.palier - b.palier);
}
/** Meilleure rareté cachée dans une case de la vitrine (null : seulement des kamas). */
export function rareteVitrine(v: VitrineCoffre): string | null {
  let best: string | null = null, bi = -1;
  for (const o of v.butin.objets) { const i = RARITIES.indexOf(o.rarity); if (i > bi) { bi = i; best = o.rarity; } }
  return best;
}

/** 3D : le coffre tombé à 0 PV, ou l'Enutrof mort, perd la moitié de ses pièces (une seule fois si les deux arrivent ensemble)
 *  et les objets des paliers qu'il n'atteint plus, au moins celui du dernier palier (5B). En surcharge, il perd tout (6B). */
export function perteCoffre(p: Player, world: World, cause: 'coffre' | 'mort' = 'mort') {
  if (!R(p) || world.time - p.coffrePerteA < 1 || p.coffrePieces <= 0) return;
  p.coffrePerteA = world.time;
  const sur = enSurcharge(p);
  const n = sur ? p.coffrePieces : Math.floor(p.coffrePieces / 2);
  p.coffrePieces -= n;
  const garde = sur ? 0 : Math.min(palierCoffre(p) + 1, Math.max(0, p.coffreVitrine.length - 1));
  const perdus = p.coffreVitrine.length - garde;
  p.coffreVitrine = p.coffreVitrine.slice(0, garde);
  noter(p, `${cause === 'coffre' ? 'Coffre tombé' : 'Enutrof à terre'}${sur ? ' en surcharge' : ''}${perdus ? ` (${perdus} objet${perdus > 1 ? 's' : ''} perdu${perdus > 1 ? 's' : ''})` : ''}`, -n);
  if (n) world.emit({ k: 'status', x: p.x, y: p.y - 80, text: sur ? `Coffre en surcharge : tout est perdu !` : `Coffre : -${n} pièces`, color: '#ff8a6a' });
}
/** Le Coffre Animé tombe : assommé `ko` s, puis il revient à côté de l'Enutrof. */
export function coffreAssomme(b: Bete, world: World) {
  const p = b.owner, C = R(p);
  if (!C) return;
  perteCoffre(p, world, 'coffre');
  if (!p.dead) { p.coffreKoT = C.ko; world.emit({ k: 'status', x: b.x, y: b.y - 50, text: 'Coffre assommé', color: '#c8c8c8' }); }
}

/** Ouvre le coffre (bouton de sa fenêtre, 2C) : la gueule s'ouvre et les objets de la vitrine jaillissent un par un (7D) ;
 *  les alliés proches reçoivent le leur (5A), tiré à l'ouverture. */
export function ouvrirCoffre(p: Player, world: World): boolean {
  const C = R(p), i = palierCoffre(p);
  if (!C) return false;
  const c = coffreDe(p, world);
  if (i < 0 || !c) {
    world.emit({ k: 'status', x: p.x, y: p.y - 70, text: !c ? 'Coffre assommé' : `Coffre : ${p.coffrePieces} / ${C.paliers[0]} pièces`, color: '#c8c8c8' });
    return false;
  }
  remplirVitrine(p, world, c.x, c.y);   // paliers sans objet (pièces données par l'outil de test, vieille sauvegarde)
  const pieces = p.coffrePieces, contenu = p.coffreVitrine.filter(v => v.palier <= i);
  p.coffrePieces = 0; p.coffreVitrine = [];
  // 3D : records
  const R3 = p.coffreRecords;
  R3.ouverts++; R3.plusGros = Math.max(R3.plusGros, pieces); R3.palierMax = Math.max(R3.palierMax, i);
  R3.legendaires += contenu.reduce((a, v) => a + v.butin.objets.filter(o => RARITIES.indexOf(o.rarity) >= RARITIES.indexOf('legendaire')).length, 0);
  noter(p, `Coffre ${nomsCoffre(C)[i]} ouvert`, -pieces);
  // 7D : un objet après l'autre, les plus rares en dernier ; les kamas d'abord
  const kamas = contenu.reduce((a, v) => a + v.butin.kamas, 0);
  const objets = contenu.flatMap(v => v.butin.objets).sort((a, b) => RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity));
  const ress = contenu.flatMap(v => v.butin.ressources);
  const vague: Butin[] = [];
  if (kamas || ress.length) vague.push({ ressources: ress, objets: [], kamas });
  for (const o of objets) vague.push({ ressources: [], objets: [o], kamas: 0 });
  vague.forEach((b, k) => p.coffreEjection.push({ t: EJECTION.debut + k * EJECTION.pas, b, x: c.x, y: c.y }));
  c.ouvreT = EJECTION.gueule;
  // 4C : un apparat de chasseur de trésor, rarement, dans un coffre Or ou Trésor (ou en surcharge)
  if (i >= C.tresor.dePalier && world.rng.next() < C.tresor.chance) {
    const libres = C.tresor.apparats.filter(id => !p.apparats.includes(id));
    if (libres.length) { const id = world.rng.pick(libres); p.apparats.push(id); world.emit({ k: 'apparence', id }); }
  }
  // 5A : un seul coffre par groupe donne aux alliés (le premier Enutrof de la partie) ; chacun garde le sien pour lui
  const niv = world.niveauEn(c.x, c.y), pAllie = Math.min(i, C.paliers.length) - 1;
  if (partageurCoffre(world) === p && pAllie >= 0)
    for (const q of world.players) if (q !== p && !q.dead && Math.hypot(q.x - c.x, q.y - c.y) <= C.portee)
      for (let k = 0; k <= pAllie; k++) { const A = ajoutPalier(C, k); world.butinCoffre(q, A.rang, A.n, niv, c.x, c.y, q.id, !!A.epique); }
  world.emit({ k: 'tresorOuvert', x: c.x, y: c.y, palier: i, n: vague.length });
  world.emit({ k: 'status', x: c.x, y: c.y - 70, text: `Coffre ${nomsCoffre(C)[i]} ouvert !`, color: couleurCoffre(i) });
  return true;
}

/** 8A : ce qui est sauvé avec le perso. */
export function exporterCoffre(p: Player): EtatCoffre | undefined {
  if (!R(p)) return undefined;
  return { pieces: p.coffrePieces, vitrine: p.coffreVitrine, journal: p.coffreJournal, records: p.coffreRecords };
}
/** 8A : reprend le coffre d'une sauvegarde (nombres vérifiés, objets renumérotés par `uid`). */
export function restaurerCoffre(p: Player, e: EtatCoffre | undefined, uid: (it: Item) => Item) {
  const C = R(p);
  if (!C || !e || typeof e !== 'object') return;
  const S = seuilsCoffre(C), nb = (v: unknown) => Math.max(0, Math.floor(Number(v)) || 0);
  p.coffrePieces = Math.min(S[S.length - 1], nb(e.pieces));
  const pal = palierCoffre(p);
  p.coffreVitrine = (Array.isArray(e.vitrine) ? e.vitrine : [])
    .filter(v => v && Number.isInteger(v.palier) && v.palier >= 0 && v.palier <= pal && v.butin && Array.isArray(v.butin.objets))
    .map(v => ({ palier: v.palier, butin: { ressources: Array.isArray(v.butin.ressources) ? v.butin.ressources.filter(r => typeof r?.id === 'string') : [],
      objets: v.butin.objets.filter(o => typeof o?.id === 'string').map(uid), kamas: nb(v.butin.kamas) } }));
  p.coffreJournal = (Array.isArray(e.journal) ? e.journal : []).filter(l => typeof l?.t === 'string' && Number.isFinite(l.n)).slice(0, JOURNAL_MAX).map(l => ({ t: l.t, n: Math.round(l.n), ...(Number(l.fois) > 1 ? { fois: Math.floor(Number(l.fois)) } : {}) }));
  const r = e.records ?? recordsVides();
  p.coffreRecords = { ouverts: nb(r.ouverts), plusGros: nb(r.plusGros), palierMax: Number.isFinite(Number(r.palierMax)) ? Math.max(-1, Math.floor(Number(r.palierMax))) : -1, legendaires: nb(r.legendaires), total: nb(r.total) };
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
