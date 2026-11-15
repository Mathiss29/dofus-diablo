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
  /** Sorts 61-90 (« Ouginak : 6A ») — Dogue, Panique : la Proie touchée ralentit (part de vitesse) pendant t s. */
  lentProie?: { k: number; t: number };
  /** Panique : repousse de `cases` tout ce qui est à `rayon` cases du point visé. */
  panique?: { cases: number; rayon: number };
  /** Aboiement : toi ou l'allié visé courez plus vite, ni repoussés ni ralentis, pendant t s ; le prochain coup reçu au contact retire l'effet et donne un cran de Rage. */
  aboiement?: { course: number; t: number };
  /** Limier : sur la Proie, attire d'abord à son contact les ennemis à `rayon` cases d'elle. */
  rassemble?: { rayon: number };
  /** Flair : tu apparais au contact de la Proie, où qu'elle soit (demande une Proie et un cran de Rage). */
  flair?: boolean;
  /** Appel de la Meute : le Roquet revient `retour` s plus tôt ; sur la Proie, elle perd `erosion` de ses PV max, le Roquet bondit sur elle
   *  et les autres joueurs sont attirés de `attire` cases vers elle ; sur soi, Roquet et alliés sont rappelés. */
  appel?: { retour: number; erosion: number; attire: number };
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
  /** Aboiement : actif jusqu'à cet âge du joueur (vaut aussi pour un allié qui n'est pas Ouginak). */
  aboieFin: number;
  /** Légendaires : âge de la dernière transformation (Pleine lune), du dernier Instinct de survie ; 2e Roquet (Meute fidèle) ;
   *  un bond sur deux gratuit en Bête (Bond de la bête) ; Roquet en vie (Course de meute). */
  beteA: number; instinctA: number; roquet2: number | null; roquet2T: number; bondPair: boolean; roquetVivant: boolean;
}

export const etatOug = (p: Player): EtatOuginak =>
  (p.oug ??= { coupA: p.age, encaisse: [], subisN: 0, subisT: 0, croit: {}, proie: null, roquet: null, roquetT: 0, pelage: false, aboieFin: 0,
    beteA: -99, instinctA: -99, roquet2: null, roquet2T: 0, bondPair: false, roquetVivant: false });

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
  const parEtat = O.subisParEtat + p.pcv('pc-ouginak-J') / 100;   // Peau dure
  return Math.max(0.4, 1 - parEtat * Math.floor(p.rage) - (o && o.subisT > 0 ? o.subisN : 0));
}
/** Aboiement actif sur ce joueur (pas repoussé). */
export const aboie = (p: Player): boolean => !!p.oug && p.age < p.oug.aboieFin;
/** Coup reçu (PV déjà retirés) : Aboiement retiré par un coup au contact (+1 Rage) ; 3B, perdre `part` des PV max d'un coup
 *  ou en `fenetre` s donne un cran de Rage. Appelé pour tout joueur qui a un état Ouginak (un allié sous Aboiement aussi). */
export function coupRecuOuginak(p: Player, dmg: number, world: World, contactCoup = false) {
  const o = etatOug(p);
  if (contactCoup && aboie(p)) {
    o.aboieFin = 0; p.insensibleT = 0;
    world.emit({ k: 'status', x: p.x, y: p.y - 70, text: 'Aboiement', color: '#e0a05a' });
    gagnerRage(p, 1, world);
  }
  if (dmg <= 0 || !p.cls.ouginak) return;
  const is = p.pcv('pc-ouginak-P');   // Instinct de survie : sous 30 % de PV, un cran de Rage et un bouclier (toutes les 20 s)
  if (is && p.hp > 0 && p.hp < p.maxHp * 0.3 && p.age - o.instinctA >= 20) {
    o.instinctA = p.age; gagnerRage(p, 1, world);
    p.shield = Math.max(p.shield, Math.round(p.maxHp * is / 100)); p.shieldT = p.shieldT0 = 5; p.shieldSrc = 'pc-ouginak-P';
    world.emit({ k: 'status', x: p.x, y: p.y - 80, text: 'Instinct de survie', color: '#ffb36a' });
  }
  const E = p.cls.ouginak.encaisse;
  o.encaisse = o.encaisse.filter(([t]) => p.age - t < E.fenetre);
  o.encaisse.push([p.age, dmg]);
  if (o.encaisse.reduce((a, [, d]) => a + d, 0) >= p.maxHp * E.part) { o.encaisse = []; gagnerRage(p, 1, world); }
}

/** Sort impossible : défensif en Forme Bestiale (officiel 24001), pas assez de Rage (« Nécessite la Rage »), Flair sans Proie. */
export function interditBete(p: Player, d: SpellDef | undefined): boolean {
  const O = d?.ouginak;
  if (!O) return false;
  if (p.ougBete && O.defensif && !(O.pelage && p.pcv('pc-ouginak-O'))) return true;   // Pelage épais : permis en Bête
  if (typeof O.consomme === 'number' && Math.floor(p.rage) < O.consomme) return true;
  return !!O.flair && p.oug?.proie == null;
}
/** Portée maximale (px) en Forme Bestiale : les sorts offensifs sont ramenés à 2 cases, sauf ceux qui gardent leur portée. */
export function porteeBete(p: Player, d: SpellDef): number | null {
  if (!p.ougBete || !d.ouginak || d.ouginak.garde || d.dmg <= 0 || d.move) return null;
  return p.cls.ouginak!.bete.portee * CASE + CASE / 2;
}

/** Bond de la bête (légendaire) : en Forme Bestiale, le bond va plus loin (px) ... */
export const porteeBondOuginak = (p: Player, d: SpellDef): number => d.ouginak?.bond && p.ougBete ? p.pcv('pc-ouginak-K') * CASE : 0;
/** ... et un bond sur deux ne coûte pas de charge. */
export function bondGratuit(p: Player, d: SpellDef): boolean {
  if (!d.ouginak?.bond || !p.ougBete || !p.pcv('pc-ouginak-K')) return false;
  const o = etatOug(p); o.bondPair = !o.bondPair;
  return !o.bondPair;
}
/** Rage aveugle (légendaire) : en Forme Bestiale, Tibia et Amarok frappent une case plus large (px). */
export const zoneOuginak = (p: Player, id: string): number => p.ougBete && (id === 'tibia' || id === 'amarok') && p.pcv('pc-ouginak-N') ? CASE : 0;
/** Course de meute (légendaire) : vitesse tant que le Roquet est en vie. */
export const vitesseOuginak = (p: Player): number => p.oug?.roquetVivant ? 1 + p.pcv('pc-ouginak-L') / 100 : 1;

/** Espace : bond de 4 cases ; si la Proie est sous la souris (et à `bond.proie` cases au plus), jusqu'à son contact. */
export function arriveeBond(p: Player, aim: { x: number; y: number }, world: World): { x: number; y: number } | null {
  const m = proieDe(p, world);
  if (!m || Math.hypot(aim.x - m.x, aim.y - m.y) > m.radius + CASE * 0.6) return null;
  if (Math.hypot(m.x - p.x, m.y - p.y) > p.cls.ouginak!.bond.proie * CASE) return null;
  return contact(p, m, world);
}
function contact(p: { x: number; y: number; radius: number }, m: Monster, world: World): { x: number; y: number } {
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
  const ra = zoneOuginak(p, id) ? 1 + p.pcv('pc-ouginak-N') / 100 : 1;   // Rage aveugle
  if (!proieVisee(m, s.tx, s.ty, r) || !m) return ra;
  const oeil = d.dmg > 0 ? 1 + p.pcv('pc-ouginak-G') / 100 : 1;   // Œil du traqueur : la Proie prend plus de tes sorts
  if (O.bondProie && Math.hypot(m.x - p.x, m.y - p.y) > m.radius + p.radius + 12) {
    const c = contact(p, m, world);
    world.emit({ k: 'bondOug', x: p.x, y: p.y, tx: c.x, ty: c.y });
    p.x = c.x; p.y = c.y; s.tx = m.x; s.ty = m.y;
  }
  if (O.rassemble) {   // Limier : les ennemis autour de la Proie viennent à son contact avant le coup
    for (const q of world.monsters) {
      if (q === m || q.dead || q.state === 'spawn' || q.intouchable || q.def.boss) continue;
      const dd = Math.hypot(q.x - m.x, q.y - m.y), r = m.radius + q.radius + 4;
      if (dd > O.rassemble.rayon * CASE + q.radius || dd <= r) continue;
      const x = m.x + (q.x - m.x) / dd * r, y = m.y + (q.y - m.y) / dd * r;
      if (world.walkable(x, y)) { q.x = x; q.y = y; }
    }
  }
  if (O.croit) {
    const o = etatOug(p), c = o.croit[id], n = c && c.t > 0 ? c.n : 0, oar = p.pcv('pc-ouginak-I');   // Os à ronger : plus long, deux fois plus vite
    o.croit[id] = { n: Math.min(O.croit.max, n + (oar ? 2 : 1)), t: O.croit.t + oar };
    if (n) world.emit({ k: 'status', x: m.x, y: m.y - 40, text: `+${Math.round(n * O.croit.per * 100)} %`, color: '#ffb36a' });
    return (1 + n * O.croit.per) * ra * oeil;
  }
  return ra * oeil;
}

/** Après le coup d'un sort de l'Ouginak : Rage, Proie, Roquet, soins et bonus. */
export function impactOuginak(p: Player, id: string, d: SpellDef, tx: number, ty: number, size: number, hits: number, world: World) {
  const O = d.ouginak!, o = etatOug(p), m = proieDe(p, world), surProie = proieVisee(m, tx, ty, size);
  const ma = id === 'molosse' && surProie && hits > 0 ? p.pcv('pc-ouginak-A') : 0;   // Mâchoires d'acier
  if (O.rage && hits > 0) gagnerRage(p, O.rage + (ma ? 1 : 0), world);
  if (O.subis) { o.subisN = ma ? ma / 100 : O.subis.n; o.subisT = O.subis.t; }
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
  if (O.pelage) {
    o.pelage = true;
    const pe = p.pcv('pc-ouginak-O');   // Pelage épais : boucliers plus gros
    if (pe && p.shieldSrc === 'pelage_protecteur') p.shield = Math.round(p.shield * (1 + pe / 100));
  }
  if (O.panique) {   // depuis le centre : la cible elle-même ne bouge pas
    for (const q of world.monsters) {
      const dd = Math.hypot(q.x - tx, q.y - ty);
      if (q.dead || q.state === 'spawn' || q.intouchable || dd < 6 || dd > O.panique.rayon * CASE + q.radius) continue;
      const kb = O.panique.cases * 342 / q.def.mass;
      q.kx += (q.x - tx) / dd * kb; q.ky += (q.y - ty) / dd * kb;
    }
  }
  if (O.lentProie && m && (O.panique ? proieVisee(m, tx, ty, O.panique.rayon * CASE) : surProie && hits > 0)) {
    m.haste = Math.min(m.haste, 1 - O.lentProie.k); m.hasteT = Math.max(m.hasteT, O.lentProie.t);
  }
  if (O.aboiement) {   // toi, ou le joueur visé
    const q = world.players.find(j => !j.dead && Math.hypot(j.x - tx, j.y - ty) <= j.radius + CASE * 0.6) ?? p;
    q.courir(O.aboiement.course, O.aboiement.t); q.insensibleT = Math.max(q.insensibleT, O.aboiement.t);
    etatOug(q).aboieFin = q.age + O.aboiement.t;
    world.emit({ k: 'status', x: q.x, y: q.y - 70, text: 'Aboiement', color: '#e0a05a' });
  }
  if (O.flair && m) {   // au contact de la Proie (ou sur la case visée si elle est juste à côté)
    const c = Math.hypot(tx - m.x, ty - m.y) <= m.radius + CASE * 1.5 && Math.hypot(tx - m.x, ty - m.y) > m.radius + p.radius && world.walkable(tx, ty)
      ? { x: tx, y: ty } : contact(p, m, world);
    world.emit({ k: 'bondOug', x: p.x, y: p.y, tx: c.x, ty: c.y });
    p.x = c.x; p.y = c.y; p.facing = Math.atan2(m.y - p.y, m.x - p.x);
  }
  if (O.appel) appelMeute(p, O.appel, tx, ty, m, world);
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

/** Appel de la Meute : Roquet rechargé plus vite ; sur la Proie, érosion + la meute bondit sur elle ; sur soi, la meute revient. */
function appelMeute(p: Player, A: NonNullable<EffetsOuginak['appel']>, tx: number, ty: number, m: Monster | null, world: World) {
  const o = etatOug(p);
  if (o.roquetT > 0) o.roquetT = Math.max(0, o.roquetT - A.retour);
  if (p.cd.lance_roquet > 0) p.cd.lance_roquet = Math.max(0, p.cd.lance_roquet - A.retour);
  const surProie = proieVisee(m, tx, ty, CASE * 0.8), surSoi = Math.hypot(tx - p.x, ty - p.y) <= p.radius + CASE * 0.8;
  const but: { x: number; y: number; radius: number } | null = surProie ? m! : surSoi ? p : null;
  if (!but) return;
  if (surProie && m) {
    const e = Math.max(1, Math.round(m.maxHp * A.erosion * (m.def.boss ? 0.25 : 1)));
    m.maxHp = Math.max(1, m.maxHp - e); m.hp = Math.min(m.hp, m.maxHp);
    world.emit({ k: 'status', x: m.x, y: m.y - 50, text: `−${e} PV max`, color: '#c9a0ff' });
  }
  const r = roquetDe(p, world);
  if (r) {
    const c = surProie && m ? contact(r, m, world) : { x: p.x - Math.cos(p.facing) * CASE, y: p.y - Math.sin(p.facing) * CASE };
    if (world.walkable(c.x, c.y)) { world.emit({ k: 'bondOug', x: r.x, y: r.y, tx: c.x, ty: c.y }); r.x = c.x; r.y = c.y; }
  }
  for (const q of world.players) {   // coop : les autres joueurs sont attirés vers la Proie (ou vers toi)
    if (q === p || q.dead) continue;
    const dx = but.x - q.x, dy = but.y - q.y, d0 = Math.hypot(dx, dy), L = Math.min(A.attire * CASE * (surProie ? 1 : 0.5), Math.max(0, d0 - but.radius - q.radius - 4));
    if (L > 0 && d0 < CASE * 12) { q.kx += dx / d0 * L * 7.13; q.ky += dy / d0 * L * 7.13; }
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
  const cu = p.pcv('pc-ouginak-M');   // Curée : un cran de Rage et des PV
  if (cu && !p.dead) {
    gagnerRage(p, 1, world);
    const n = p.soigner(p.maxHp * cu / 100);
    if (n > 0) world.emit({ k: 'heal', x: p.x, y: p.y, z: 50, amount: n });
  }
  const ps = p.pcv('pc-ouginak-H');   // Proie suivante : la marque saute au monstre le plus proche
  if (ps) {
    let best: Monster | null = null, bd = ps * CASE;
    for (const q of world.monsters) {
      if (q === m || q.dead || q.state === 'spawn' || q.mannequin || q.proieDe != null) continue;
      const dd = Math.hypot(q.x - m.x, q.y - m.y) - q.radius;
      if (dd <= bd) { bd = dd; best = q; }
    }
    if (best) marquer(p, best, world);
  }
}

/** Coup du Roquet sur un monstre (dommages faits) : Crocs sales (légendaire) le fait saigner 3 s. */
export function morsureRoquet(b: Bete, m: Monster, dmg: number) {
  const cs = b.base === 'oug_roquet' ? b.owner.pcv('pc-ouginak-D') : 0;
  if (!cs || dmg <= 0 || m.dead) return;
  m.saigne = Math.max(m.saigneT > 0 ? m.saigne : 0, dmg * cs / 100); m.saigneT = 3;
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
    const sl = p === own && p.ougBete ? 1 + p.pcv('pc-ouginak-B') / 100 : 1;   // Sang du loup
    const n = p.soigner(dmg * (own?.cls.ouginak?.proie.soin ?? 0.15) * sl);
    if (n > 0 && p.hp < p.maxHp) world.emit({ k: 'heal', x: p.x, y: p.y, z: 50, amount: n });
  }
}

/** Pas de l'Ouginak : la Rage qui retombe, la Forme Bestiale, le Roquet permanent, la Proie, les bonus. */
export function majOuginak(p: Player, dt: number, world: World) {
  const O = p.cls.ouginak!, o = etatOug(p);
  if (p.dead) { if (p.ougBete) finBete(p, world); return; }
  // 14C : un cran de moins toutes les `baisse` s sans frapper
  const pleineLune = p.ougBete && p.age - o.beteA < p.pcv('pc-ouginak-E');   // Pleine lune : la Rage tient après la transformation
  if (p.rage > 0 && !pleineLune && p.age - o.coupA >= O.baisse) { p.rage = Math.max(0, Math.floor(p.rage) - 1); o.coupA = p.age; }
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
    // Meute fidèle (légendaire) : un deuxième Roquet, plus faible, qui revient comme le premier
    const mf = p.pcv('pc-ouginak-C');
    const r2 = o.roquet2 == null ? null : world.betes.find(b => b.id === o.roquet2 && !b.dead) ?? null;
    if (o.roquet2 != null && !r2) { const b = world.betes.find(x => x.id === o.roquet2); o.roquet2 = null; o.roquet2T = b ? O.roquet.retour : 0; }
    if (r2 && !mf) { r2.mourir(world); o.roquet2 = null; }
    if (mf && o.roquet2 == null && (o.roquet2T -= dt) <= 0 && !world.dansHavreSac) {
      const b = world.invoquer(p, 'oug_roquet', 'lance_roquet', p.x + Math.cos(p.facing + 2) * CASE, p.y + Math.sin(p.facing + 2) * CASE, true);
      if (b) { b.horsCompte = true; b.force = mf / 100; b.maxHp = b.hp = Math.max(1, Math.round(b.maxHp * mf / 100)); o.roquet2 = b.id; }
    }
  }
  o.roquetVivant = o.roquet != null;
}

function devenirBete(p: Player, world: World) {
  p.ougBete = true; p.ougTransfoT = 0.6; etatOug(p).beteA = p.age;
  const hu = p.pcv('pc-ouginak-F');   // Hurlement : repousse et ralentit les ennemis à 3 cases
  if (hu) {
    for (const q of world.monsters) {
      const dd = Math.hypot(q.x - p.x, q.y - p.y);
      if (q.dead || q.state === 'spawn' || q.intouchable || dd > 3 * CASE + q.radius) continue;
      const kb = 2 * 342 / q.def.mass, k = dd || 1;
      q.kx += (q.x - p.x) / k * kb; q.ky += (q.y - p.y) / k * kb;
      q.haste = Math.min(q.haste, 1 - hu / 100); q.hasteT = Math.max(q.hasteT, 2);
    }
    world.emit({ k: 'status', x: p.x, y: p.y - 96, text: 'Hurlement', color: '#ff4a3a' });
  }
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
