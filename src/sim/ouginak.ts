import type { SpellDef } from './defs';
import type { Bete } from './bete';
import type { Monster } from './monster';
import type { Player } from './player';
import type { World } from './world';

/** Ouginak (classe 18). Choix de Mathis :
 *  « Classes : 14A+14C 15A+15B 16A+16B 17A » (15 nov. 2026) et « Ouginak : 1A+1B 2A 3A+3B 4A 5A 6A 7A-7P 8A 9A 10A ».
 *  14A Rage officielle (état 513) : 3 états, chacun réduit les dommages subis ; au 3e, Forme Bestiale (Bestialité Ouginak 23988) :
 *      plus rapide, dommages finaux en plus, sorts offensifs ramenés à 2 cases (sauf ceux qui « gardent leur portée »),
 *      sorts défensifs interdits. 14C : la Rage perd un cran toutes les 5 s sans frapper. 2A : la Bête tient tant que la Rage est à 3.
 *  3A+3B : la Rage monte avec les sorts officiels (Molosse, Charogne, Tibia, Pelage brisé) et quand un coup, ou les coups de 3 s,
 *      ôtent 15 % des PV max.
 *  15A+15B Proie (état 516) : frapper la Proie soigne de 15 % des dommages (effet officiel 786), pour tous les joueurs ;
 *      le premier monstre frappé devient la Proie si tu n'en as pas ; Proie achevée = sort Proie rechargé (13785).
 *  16A+16B Roquet (monstre 5865) : bête alliée permanente dès le niveau du Lance-roquet, revient 10 s après sa mort, mord ta Proie d'abord.
 *  17A Molosse au clic droit, Espace = bond de 4 cases (ruée officielle AnimDash, 4A), jusqu'à la Proie si elle est sous la souris.
 *  1A : animation 1815 à la transformation, perso +15 %, aura rouge sombre (src/render/entityView.ts).
 *  Tout l'état propre à un joueur est dans Player (oug, ougBete, ougTransfoT) ; la Proie est notée sur le monstre (proieDe). */

const CASE = 48;
export interface ReglesOuginak {
  subisParEtat: number; baisse: number;
  bete: { vitesse: number; dommages: number; portee: number; echelle: number };
  proie: { soin: number };
  encaisse: { part: number; fenetre: number };
  roquet: { retour: number };
  bond: { proie: number };
}
/** Effets des sorts (SpellDef.ouginak). */
export interface EffetsOuginak {
  /** +n Rage si le sort touche au moins une cible (Molosse, Charogne, Tibia). */
  rage?: number;
  /** Dommages subis réduits de n (part) pendant t s (Molosse, Amarok). */
  subis?: { n: number; t: number };
  /** Sur la Proie : chaque lancer fait +per de dommages (max fois), pendant t s après le dernier (Os à Moelle, Carcasse). */
  croit?: { per: number; max: number; t: number };
  /** Sur la Proie : bond à son contact avant le coup (Traque, Chasse). */
  bondProie?: boolean;
  /** Garde sa portée en Forme Bestiale (Traque, Cubitus, Limier). */
  garde?: boolean;
  /** Sort défensif : interdit en Forme Bestiale (Pelage Protecteur, Aboiement). */
  defensif?: boolean;
  /** Marque la Proie (sort Proie). */
  proie?: boolean;
  /** Convergence : sans ennemi touché, rejoint l'allié visé. */
  rejoint?: boolean;
  /** Lance-roquet : appelle (ou déplace) le Roquet au point visé. */
  roquet?: boolean;
  /** Consomme n crans de Rage (Arcanin, Flair) ou toute la Rage (Apaisement). */
  consomme?: number | 'tout';
  /** Apaisement : soin (part des PV max) + par cran consommé. */
  apaise?: { soin: number; parRage: number };
  /** Sur la Proie : course en plus (Cubitus). */
  courseProie?: { k: number; t: number };
  /** Sur la Proie : elle ralentit (part de vitesse) et tu cours plus vite (Rabattage). */
  volVitesse?: { k: number; t: number };
  /** Pelage Protecteur : son bouclier brisé par les coups donne un cran de Rage. */
  pelage?: boolean;
  /** Espace : bond, jusqu'à la Proie sous la souris. */
  bond?: boolean;
}
/** État d'un Ouginak (Player.oug). */
export interface EtatOuginak {
  /** Dernier coup porté (la Rage baisse d'un cran toutes les `baisse` s sans frapper). */
  coupA: number;
  /** Dommages reçus récents [temps, dommages] (3B). */
  encaisse: [number, number][];
  /** Réduction des dommages subis de Molosse / Amarok, et secondes restantes. */
  subisN: number; subisT: number;
  /** Os à Moelle, Carcasse : cumul sur la Proie, secondes restantes. */
  croit: Record<string, { n: number; t: number }>;
  /** Monstre marqué (id), Roquet en jeu (id), secondes avant son retour. */
  proie: number | null; roquet: number | null; roquetT: number;
  /** Bouclier de Pelage Protecteur en cours. */
  pelage: boolean;
}

export const etatOug = (p: Player): EtatOuginak =>
  (p.oug ??= { coupA: p.age, encaisse: [], subisN: 0, subisT: 0, croit: {}, proie: null, roquet: null, roquetT: 0, pelage: false });

/** La Proie de ce joueur (vivante), ou null. */
export function proieDe(p: Player, world: World): Monster | null {
  const id = p.oug?.proie;
  if (id == null) return null;
  const m = world.monsters.find(q => q.id === id && !q.dead);
  return m && m.proieDe === p.id ? m : null;
}

/** Marque une Proie (une seule par Ouginak ; la dernière marque posée sur un monstre l'emporte en coop). */
export function marquer(p: Player, m: Monster, world: World) {
  const o = etatOug(p), old = proieDe(p, world);
  if (old === m) return;
  if (old) old.proieDe = null;
  m.proieDe = p.id; o.proie = m.id;
  world.emit({ k: 'status', x: m.x, y: m.y - 46, text: 'Proie', color: '#ff7a3c' });
  world.emit({ k: 'proie', id: m.id, x: m.x, y: m.y });
}

/** Rage : n crans de plus (3 au plus). */
export function gagnerRage(p: Player, n: number, world: World) {
  if (!p.cls.ouginak || n <= 0 || p.dead) return;
  const avant = p.rage;
  p.rage = Math.min(p.cls.rage.max, Math.floor(p.rage) + n);
  etatOug(p).coupA = p.age;
  if (p.rage !== avant) world.emit({ k: 'status', x: p.x, y: p.y - 70, text: `Rage ${p.rage}`, color: '#e0605a' });
}
/** Consomme des crans de Rage (Arcanin, Flair, Apaisement) ; renvoie les crans pris. */
export function consommerRage(p: Player, n: number | 'tout'): number {
  const pris = Math.min(Math.floor(p.rage), n === 'tout' ? p.cls.rage.max : n);
  p.rage = Math.max(0, Math.floor(p.rage) - pris);
  return pris;
}

/** Dommages subis : chaque cran de Rage les réduit (officiel), Molosse et Amarok aussi. */
export function subisOuginak(p: Player): number {
  const O = p.cls.ouginak!, o = p.oug;
  return Math.max(0.5, 1 - O.subisParEtat * Math.floor(p.rage) - (o && o.subisT > 0 ? o.subisN : 0));
}
/** Coup reçu (PV déjà retirés) : 3B, perdre `part` des PV max d'un coup ou en `fenetre` s donne un cran de Rage. */
export function coupRecuOuginak(p: Player, dmg: number, world: World) {
  const E = p.cls.ouginak!.encaisse, o = etatOug(p);
  if (dmg <= 0) return;
  o.encaisse = o.encaisse.filter(([t]) => p.age - t < E.fenetre);
  o.encaisse.push([p.age, dmg]);
  if (o.encaisse.reduce((a, [, d]) => a + d, 0) >= p.maxHp * E.part) { o.encaisse = []; gagnerRage(p, 1, world); }
}

/** Sort interdit en Forme Bestiale (sorts défensifs, officiel 24001). */
export const interditBete = (p: Player, d: SpellDef | undefined): boolean => !!(p.ougBete && d?.ouginak?.defensif);
/** Portée maximale (px) en Forme Bestiale : les sorts offensifs sont ramenés à 2 cases, sauf ceux qui gardent leur portée. */
export function porteeBete(p: Player, d: SpellDef): number | null {
  if (!p.ougBete || !d.ouginak || d.ouginak.garde || d.dmg <= 0 || d.move) return null;
  return p.cls.ouginak!.bete.portee * CASE + CASE / 2;
}

/** Espace : bond de 4 cases ; si la Proie est sous la souris (et à `bond.proie` cases au plus), jusqu'à son contact. */
export function arriveeBond(p: Player, aim: { x: number; y: number }, world: World): { x: number; y: number } | null {
  const m = proieDe(p, world);
  if (!m || Math.hypot(aim.x - m.x, aim.y - m.y) > m.radius + CASE * 0.6) return null;
  if (Math.hypot(m.x - p.x, m.y - p.y) > p.cls.ouginak!.bond.proie * CASE) return null;
  return contact(p, m, world);
}
function contact(p: Player, m: Monster, world: World): { x: number; y: number } {
  const d = Math.hypot(m.x - p.x, m.y - p.y) || 1, r = m.radius + p.radius + 4;
  const x = m.x - (m.x - p.x) / d * r, y = m.y - (m.y - p.y) / d * r;
  return world.walkable(x, y) ? { x, y } : world.map.nearestFree(x, y);
}
/** La Proie est-elle au point visé (dans la zone du sort) ? */
const proieVisee = (m: Monster | null, x: number, y: number, r: number) => !!m && Math.hypot(m.x - x, m.y - y) <= r + m.radius;

/** Avant le coup d'un sort de l'Ouginak : bond au contact de la Proie (Traque, Chasse), bonus de cumul sur la Proie (Os à Moelle, Carcasse).
 *  Renvoie le multiplicateur de dommages. */
export function avantImpactOuginak(p: Player, id: string, d: SpellDef, s: { tx: number; ty: number }, world: World): number {
  const O = d.ouginak!, m = proieDe(p, world), r = d.hit.shape === 'point' ? d.hit.radius + CASE * 0.4 : CASE;
  if (!proieVisee(m, s.tx, s.ty, r) || !m) return 1;
  if (O.bondProie && Math.hypot(m.x - p.x, m.y - p.y) > m.radius + p.radius + 12) {
    const c = contact(p, m, world);
    world.emit({ k: 'bondOug', x: p.x, y: p.y, tx: c.x, ty: c.y });
    p.x = c.x; p.y = c.y; s.tx = m.x; s.ty = m.y;
  }
  if (O.croit) {
    const o = etatOug(p), c = o.croit[id], n = c && c.t > 0 ? c.n : 0;
    o.croit[id] = { n: Math.min(O.croit.max, n + 1), t: O.croit.t };
    if (n) world.emit({ k: 'status', x: m.x, y: m.y - 40, text: `+${Math.round(n * O.croit.per * 100)} %`, color: '#ffb36a' });
    return 1 + n * O.croit.per;
  }
  return 1;
}

/** Après le coup d'un sort de l'Ouginak : Rage, Proie, Roquet, soins et bonus. */
export function impactOuginak(p: Player, _id: string, d: SpellDef, tx: number, ty: number, size: number, hits: number, world: World) {
  const O = d.ouginak!, o = etatOug(p), m = proieDe(p, world), surProie = proieVisee(m, tx, ty, size);
  if (O.rage && hits > 0) gagnerRage(p, O.rage, world);
  if (O.subis) { o.subisN = O.subis.n; o.subisT = O.subis.t; }
  if (O.proie) {
    let best: Monster | null = null, bd = Infinity;
    for (const q of world.monsters) {
      if (q.dead || q.state === 'spawn') continue;
      const dd = Math.hypot(q.x - tx, q.y - ty) - q.radius;
      if (dd <= CASE * 0.6 && dd < bd) { bd = dd; best = q; }
    }
    if (best) { marquer(p, best, world); if (best.state === 'idle' || best.state === 'return') world.aggroGroup(best); }
  }
  if (O.roquet) appelerRoquet(p, tx, ty, world, true);
  if (O.consomme != null) {
    const pris = consommerRage(p, O.consomme);
    if (O.apaise) {
      const n = p.soigner(p.maxHp * (O.apaise.soin + O.apaise.parRage * pris));
      if (n > 0) world.emit({ k: 'heal', x: p.x, y: p.y, z: 50, amount: n });
    }
  }
  if (O.pelage) o.pelage = true;
  if (surProie && m && hits > 0) {
    if (O.courseProie) p.courir(O.courseProie.k, O.courseProie.t);
    if (O.volVitesse) {
      m.haste = Math.min(m.haste, 1 - O.volVitesse.k); m.hasteT = Math.max(m.hasteT, O.volVitesse.t);
      p.courir(O.volVitesse.k / 3, O.volVitesse.t);
    }
    if (O.rage) { const r = roquetDe(p, world); if (r) r.pa = Math.max(r.pa, r.def.sorts[0]?.pa ?? 3); }   // Accrocs officiel (23981) : le Roquet mord aussitôt
  }
  if (O.rejoint && hits === 0) {   // Convergence sur un allié : on le rejoint
    const q = world.players.find(j => j !== p && !j.dead && Math.hypot(j.x - tx, j.y - ty) <= j.radius + CASE * 0.6);
    if (q) { const c = { x: q.x - Math.cos(p.facing) * CASE, y: q.y - Math.sin(p.facing) * CASE }; if (world.walkable(c.x, c.y)) { p.x = c.x; p.y = c.y; } }
  }
}

/** Le Roquet vivant de ce joueur. */
export function roquetDe(p: Player, world: World): Bete | null {
  const id = p.oug?.roquet;
  return id == null ? null : world.betes.find(b => b.id === id && !b.dead) ?? null;
}
/** Lance-roquet, ou retour du Roquet permanent (16B) : il apparaît au point voulu (ou y saute, soigné, s'il est déjà là). */
export function appelerRoquet(p: Player, x: number, y: number, world: World, sort: boolean): Bete | null {
  const o = etatOug(p), r = roquetDe(p, world);
  if (r) {
    const q = world.walkable(x, y) ? { x, y } : world.map.nearestFree(x, y);
    r.x = q.x; r.y = q.y; r.soigner(r.maxHp * 0.3, world);
    return r;
  }
  const b = world.invoquer(p, 'oug_roquet', 'lance_roquet', x, y, !sort);
  if (!b) return null;
  b.horsCompte = true; o.roquet = b.id; o.roquetT = 0;
  return b;
}

/** Monstre achevé : si c'était une Proie, le sort Proie de son Ouginak est rechargé (officiel 13785). */
export function proieAchevee(m: Monster, world: World) {
  const p = world.players.find(q => q.id === m.proieDe);
  m.proieDe = null;
  if (!p?.oug || p.oug.proie !== m.id) return;
  p.oug.proie = null;
  if (p.cd.proie > 0 || p.casts.proie?.length) { p.cd.proie = 0; p.casts.proie = []; }
  world.emit({ k: 'status', x: m.x, y: m.y - 50, text: 'Proie achevée', color: '#ff9a4a' });
}

/** Coup d'un joueur sur un monstre (dommages faits) : Proie automatique (15B), soin de la Proie (15 % pour tous les joueurs). */
export function coupSurMonstre(p: Player, m: Monster, dmg: number, world: World) {
  if (p.cls.ouginak) {
    const o = etatOug(p);
    o.coupA = p.age;
    if (dmg > 0 && !proieDe(p, world) && m.proieDe == null && !m.mannequin) marquer(p, m, world);
  }
  if (m.proieDe != null && dmg > 0 && !p.dead) {
    const own = world.players.find(q => q.id === m.proieDe);
    const n = p.soigner(dmg * (own?.cls.ouginak?.proie.soin ?? 0.15));
    if (n > 0 && p.hp < p.maxHp) world.emit({ k: 'heal', x: p.x, y: p.y, z: 50, amount: n });
  }
}

/** Pas de l'Ouginak : la Rage qui retombe, la Forme Bestiale, le Roquet permanent, la Proie, les bonus. */
export function majOuginak(p: Player, dt: number, world: World) {
  const O = p.cls.ouginak!, o = etatOug(p);
  if (p.dead) { if (p.ougBete) finBete(p, world); return; }
  // 14C : un cran de moins toutes les `baisse` s sans frapper
  if (p.rage > 0 && p.age - o.coupA >= O.baisse) { p.rage = Math.max(0, Math.floor(p.rage) - 1); o.coupA = p.age; }
  // 2A : la Bête tient tant que la Rage est à 3
  if (!p.ougBete && p.rage >= p.cls.rage.max) devenirBete(p, world);
  else if (p.ougBete && p.rage < p.cls.rage.max) finBete(p, world);
  if (p.ougTransfoT > 0) p.ougTransfoT = Math.max(0, p.ougTransfoT - dt);
  if (o.subisT > 0 && (o.subisT -= dt) <= 0) o.subisN = 0;
  for (const c of Object.values(o.croit)) if (c.t > 0) c.t -= dt;
  // Pelage Protecteur : bouclier brisé par les coups = un cran de Rage
  if (o.pelage && (p.shieldSrc !== 'pelage_protecteur' || p.shield <= 0)) {
    if (p.shieldSrc === 'pelage_protecteur' && p.shield <= 0 && p.shieldT > 0) gagnerRage(p, 1, world);
    o.pelage = false;
  }
  if (o.proie != null && !proieDe(p, world)) o.proie = null;
  // 16B : Roquet permanent dès qu'on connaît Lance-roquet ; il revient `retour` s après sa chute
  if (p.knows('lance_roquet')) {
    if (o.roquet != null && !roquetDe(p, world)) {
      const b = world.betes.find(x => x.id === o.roquet);
      o.roquet = null; o.roquetT = b ? O.roquet.retour : 0;   // tombé : il revient plus tard ; disparu (changement de carte) : tout de suite
    }
    if (o.roquet == null && (o.roquetT -= dt) <= 0 && !world.dansHavreSac) {
      appelerRoquet(p, p.x - Math.cos(p.facing) * CASE, p.y - Math.sin(p.facing) * CASE, world, false);
    }
  }
}

function devenirBete(p: Player, world: World) {
  p.ougBete = true; p.ougTransfoT = 0.6;
  world.emit({ k: 'status', x: p.x, y: p.y - 80, text: 'Forme Bestiale', color: '#ff4a3a' });
  world.emit({ k: 'bete', id: p.id, x: p.x, y: p.y, on: true });
}
function finBete(p: Player, world: World) {
  p.ougBete = false; p.ougTransfoT = 0;
  world.emit({ k: 'bete', id: p.id, x: p.x, y: p.y, on: false });
}

/** Bête alliée : le Roquet vise la Proie de son maître d'abord. */
export function cibleRoquet(b: Bete, world: World): Monster | null {
  if (b.base !== 'oug_roquet') return null;
  const m = proieDe(b.owner, world);
  return m && Math.hypot(m.x - b.owner.x, m.y - b.owner.y) <= CASE * 10 ? m : null;
}
