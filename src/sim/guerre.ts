import { coefProspection } from './butin';
import type { Monster } from './monster';
import type { World } from './world';

/** Guerre des Cawottes (île des Wabbits, 0.4 suite : 10A ; maquette « Guerre : 1A 2C 3A+3C+3D 4C 5C 6A+6C+6D 7B
 *  8A+8B+8C+8D+8E 9A 10A+10B+10C+10D 11B+11D 12A+12B+12C+12D »). Les Wabbits attaquent un des quatre champs de l'île :
 *  5 vagues arrivent par les chemins, chaque Wabbit file vers une cawotte et l'arrache en 2 s (un coup l'interrompt) ;
 *  le Tiwabbit Kiafin s'enfuit avec (cawotte replantée si on le tue avant qu'il sorte du champ). À la fin, un coffre selon
 *  les cawottes sauvées (or, argent, bronze) donne des Cawottes, la monnaie du marchand Tiwa Cawoteuw.
 *  État commun à tous les joueurs (une attaque sur l'île à la fois) ; gains à chaque joueur présent sur le champ.
 *  Aucun hasard hors de world.rng. */
export const GUERRE = {
  /** 2C : cawottes par champ ; 3A : temps pour en arracher une (s). */
  cawottes: 12, vol: 2,
  /** 4C : la vague suivante part quand il en reste 2, ou au bout de 30 s ; 5 vagues. */
  vagues: 5, reste: 2, delai: 30,
  /** Taille d'une vague : base + n (vague n), et +25 % par joueur en plus. */
  base: 3, parJoueur: 0.25,
  /** Cercle rouge au sol avant l'arrivée par un chemin (5C, comme les arènes), écart entre deux Wabbits d'un même chemin (s). */
  annonce: 1, cadence: 0.35,
  /** 6A : épouvantail gratuit, recharge par champ (s) ; 4A (Wabbits) : attaque spontanée toutes les ~15 min sur l'île. */
  recharge: 300, spontanee: [780, 1020] as [number, number],
  /** 6D : +50 % de Cawottes pour une attaque spontanée. */
  bonusSpontanee: 0.5,
  /** 7B : coffre bronze / argent / or (Cawottes) ; seuils en cawottes sauvées (2C). */
  coffre: { bronze: 5, argent: 12, or: 25 }, seuils: { or: 10, argent: 6, bronze: 1 },
  /** Un Wabbit qui vole se laisse distraire par un joueur à moins de cette distance (px), ou s'il vient d'être frappé (s). */
  distrait: 110, frappe: 2.5,
  /** 10D : mort pendant l'attaque = relevé au bord du champ au bout de ce temps (s). */
  retour: 5,
  /** Rayon autour de l'épouvantail pour le lancer (clic dessus) ; rayon du champ (px) où l'on compte comme présent. */
  rayon: 70, champ: 650,
  /** Monnaie de la guerre : objet officiel « Cawottes » (20446). */
  monnaie: '20446',
  /** Le voleur qui s'enfuit avec la cawotte. */
  kiafin: 'tiwabbit_kiafin',
};

export type Coffre = 'or' | 'argent' | 'bronze';
export interface ChampDef { nom: string; tag: string; sub: number; niveau: [number, number]; cawottes: number[]; entrees: number[]; epouvantail: number }
interface Pt { x: number; y: number }
/** Une cawotte du champ : plantée, emportée par un Kiafin (porteur = id du monstre) ou perdue. */
export interface Cawotte extends Pt { etat: 'plantee' | 'portee' | 'perdue'; porteur?: number }
interface Arrivee extends Pt { type: string; t: number }
/** pris : il a déjà arraché sa cawotte ; ensuite il se bat (un Wabbit = une cawotte au plus). */
interface Voleur { m: Monster; cible: number; vol: number; hp: number; frappeT: number; fuite: Pt | null; pris?: boolean }

export function coffreDe(sauvees: number): Coffre | null {
  const S = GUERRE.seuils;
  return sauvees >= S.or ? 'or' : sauvees >= S.argent ? 'argent' : sauvees >= S.bronze ? 'bronze' : null;
}

/** Une attaque en cours sur un champ. */
export class Attaque {
  vague = 0;
  chrono = 0;
  private tVague = 0;
  cawottes: Cawotte[];
  arrivees: Arrivee[] = [];
  voleurs: Voleur[] = [];
  readonly entrees: Pt[];
  fini = false;
  /** Kiafin rattrapés (succès « Kiafin rattrapé », 12C). */
  kiafins = 0;
  private readonly pool: string[];
  constructor(readonly w: World, readonly i: number, readonly c: ChampDef, readonly spontanee: boolean) {
    const wg = w.worldGrid!;
    this.cawottes = c.cawottes.map(k => ({ ...wg.cellToWorld(k), etat: 'plantee' as const }));
    this.entrees = c.entrees.map(k => wg.cellToWorld(k));
    const M = w.opts.data.monsters;
    this.pool = (w.zone.open!.subareas[String(c.sub)]?.monsters ?? []).filter(m => M[m]);
  }
  get restantes() { return this.cawottes.filter(c => c.etat !== 'perdue').length; }
  vivants() { return this.voleurs.filter(v => !v.m.dead).length; }

  update(dt: number) {
    const w = this.w;
    for (const a of this.arrivees) {
      a.t -= dt;
      if (a.t <= GUERRE.annonce) w.telegraphs.push({ kind: 'circle', x: a.x, y: a.y, r: 40, progress: 1 - Math.max(0, a.t) / GUERRE.annonce, danger: true });
      if (a.t <= 0) this.apparaitre(a);
    }
    this.arrivees = this.arrivees.filter(a => a.t > 0);
    if (this.fini) return;
    this.chrono += dt; this.tVague += dt;
    // Kiafin tué en fuite : la cawotte retombe et se replante (3C)
    for (const v of this.voleurs) if (v.m.dead && v.fuite) {
      const c = this.cawottes.find(x => x.etat === 'portee' && x.porteur === v.m.id);
      if (c) { c.etat = 'plantee'; c.porteur = undefined; this.kiafins++; w.emit({ k: 'guerreReplantee', x: c.x, y: c.y }); }
      v.fuite = null;
    }
    this.voleurs = this.voleurs.filter(v => !v.m.dead || v.m.t > 0);
    if (!this.restantes) { this.finir(); return; }
    const reste = this.vivants() + this.arrivees.length;
    if (this.vague < GUERRE.vagues && (this.vague === 0 || reste <= GUERRE.reste || this.tVague >= GUERRE.delai)) this.lancerVague();
    else if (this.vague >= GUERRE.vagues && !reste) this.finir();
  }

  private lancerVague() {
    const w = this.w;
    this.vague++; this.tVague = 0;
    let n = GUERRE.base + this.vague;
    n += Math.round(n * GUERRE.parJoueur * Math.max(0, w.players.length - 1));
    w.emit({ k: 'guerreVague', n: this.vague, total: GUERRE.vagues });
    if (!this.pool.length) return;
    for (let j = 0; j < n; j++) {
      const e = this.entrees[j % this.entrees.length], k = Math.floor(j / this.entrees.length), a = w.rng.range(0, Math.PI * 2), r = k ? 40 : 0;
      const wg = w.worldGrid!, x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r * 0.6, q = wg.walkable(x, y) ? { x, y } : e;
      this.arrivees.push({ type: w.rng.pick(this.pool), x: q.x, y: q.y, t: GUERRE.annonce + k * GUERRE.cadence });
    }
  }
  private apparaitre(a: Arrivee) {
    const m = this.w.spawnMonster(a.type, a.x, a.y);
    m.arene = true; m.guerre = true;
    this.voleurs.push({ m, cible: -1, vol: 0, hp: m.hp, frappeT: 0, fuite: null });
  }

  /** Avant l'IA ordinaire d'un monstre de l'attaque : true = la guerre le mène (il va voler, il vole, il fuit). Sinon il se bat. */
  piloter(m: Monster, dt: number): boolean {
    const v = this.voleurs.find(x => x.m === m);
    if (!v || m.dead || m.state === 'spawn' || this.fini) return false;
    const w = this.w;
    if (m.hp < v.hp) { v.frappeT = GUERRE.frappe; v.vol = 0; }   // 3A : un coup interrompt le vol
    v.hp = m.hp;
    if (v.frappeT > 0) v.frappeT -= dt;
    // Kiafin en fuite (3C) : il court vers le chemin le plus proche ; s'il l'atteint, la cawotte est perdue
    if (v.fuite) {
      if (!m.allerVers(v.fuite.x, v.fuite.y, dt, w, 1.15)) {
        const c = this.cawottes.find(x => x.etat === 'portee' && x.porteur === m.id);
        if (c) { c.etat = 'perdue'; c.porteur = undefined; w.emit({ k: 'guerreVol', x: m.x, y: m.y, reste: this.restantes, fuite: true }); }
        v.fuite = null; m.dead = true; m.t = 0;   // il disparaît dans son terrier
      }
      return true;
    }
    if (v.pris) return false;
    const proche = w.players.some(q => !q.dead && Math.hypot(q.x - m.x, q.y - m.y) < GUERRE.distrait);
    if (v.frappeT > 0 || proche) { v.vol = 0; return false; }
    // vise la cawotte plantée la plus proche (que personne d'autre n'arrache déjà, si possible)
    let c = this.cawottes[v.cible];
    if (!c || c.etat !== 'plantee') {
      const prises = new Set(this.voleurs.filter(x => x !== v && !x.m.dead).map(x => x.cible));
      let best = -1, bd = Infinity;
      this.cawottes.forEach((k, i) => {
        if (k.etat !== 'plantee') return;
        const d = Math.hypot(k.x - m.x, k.y - m.y) + (prises.has(i) ? 400 : 0);
        if (d < bd) { bd = d; best = i; }
      });
      v.cible = best; v.vol = 0; c = this.cawottes[best];
      if (!c) return false;
    }
    if (Math.hypot(c.x - m.x, c.y - m.y) > 26) { m.allerVers(c.x, c.y, dt, w, 1); return true; }
    m.setAnim('idle');
    v.vol += dt;
    w.telegraphs.push({ kind: 'circle', x: m.x, y: m.y - 4, r: 22, progress: Math.min(1, v.vol / GUERRE.vol), danger: true });
    if (v.vol >= GUERRE.vol) {
      v.vol = 0; v.cible = -1;
      if (m.type === GUERRE.kiafin) {
        c.etat = 'portee'; c.porteur = m.id;
        v.fuite = this.entrees.reduce((a, b) => Math.hypot(b.x - m.x, b.y - m.y) < Math.hypot(a.x - m.x, a.y - m.y) ? b : a);
        w.emit({ k: 'guerreFuite', id: m.id, x: m.x, y: m.y });
      } else {
        c.etat = 'perdue'; v.pris = true;
        w.emit({ k: 'guerreVol', x: c.x, y: c.y, reste: this.restantes, fuite: false });
      }
    }
    return true;
  }

  /** Fin : les Wabbits restants repartent, coffre selon les cawottes sauvées, Cawottes à chaque joueur présent. */
  private finir() {
    const w = this.w;
    this.fini = true; this.arrivees = [];
    for (const v of this.voleurs) if (!v.m.dead) { v.m.dead = true; v.m.t = 0.6; }
    const sauvees = this.cawottes.filter(c => c.etat === 'plantee').length, coffre = coffreDe(sauvees);
    const gain = coffre ? Math.round(GUERRE.coffre[coffre] * (this.spontanee ? 1 + GUERRE.bonusSpontanee : 1)) : 0;
    const centre = this.centre();
    for (const p of w.players) {
      if (Math.hypot(p.x - centre.x, p.y - centre.y) > GUERRE.champ * 1.5) continue;
      if (gain) p.resources[GUERRE.monnaie] = (p.resources[GUERRE.monnaie] ?? 0) + gain;
      w.commeJoueur(p, () => {
        const r = p.guerre;
        if (coffre) { r.gagnees++; if (coffre === 'or') r.or++; }
        if (sauvees === GUERRE.cawottes && !r.parfaits.includes(this.c.nom)) r.parfaits.push(this.c.nom);
        r.kiafins += this.kiafins;
        const ancien = r.records[this.c.nom];
        const record = !!coffre && (ancien == null || sauvees > ancien.sauvees || sauvees === ancien.sauvees && this.chrono < ancien.temps);
        if (record) r.records[this.c.nom] = { sauvees, temps: Math.round(this.chrono) };
        w.emit({ k: 'guerreFin', champ: this.c.nom, sauvees, total: GUERRE.cawottes, coffre, gain, temps: this.chrono, record });
      });
    }
  }
  centre(): Pt {
    const n = this.cawottes.length || 1;
    return { x: this.cawottes.reduce((s, c) => s + c.x, 0) / n, y: this.cawottes.reduce((s, c) => s + c.y, 0) / n };
  }
}

/** Ce qu'un joueur garde de l'île (sauvegarde) : attaques gagnées, en or, champs parfaits, Kiafin rattrapés, records ;
 *  malchance = chance en plus pour le Dofus Cawotte (« Wabbits : 14D »), remise à zéro quand il tombe. */
export interface EtatGuerre { gagnees: number; or: number; parfaits: string[]; kiafins: number; records: Record<string, { sauvees: number; temps: number }>; malchance?: number }
export const guerreVide = (): EtatGuerre => ({ gagnees: 0, or: 0, parfaits: [], kiafins: 0, records: {}, malchance: 0 });

/** Dofus Cawotte (« Wabbits : 14A + 14D ») : 0,2 % sur le Wa Wabbit, 0,4 % sur le Wa Wobot, × Prospection ;
 *  +0,01 % par boss vaincu sans l'avoir. Il ne tombe qu'une fois par perso (chaque Dofus est unique). */
export const DOFUS_CAWOTTE = { id: '972', taux: { wa_wabbit: 0.002, wa_wobot: 0.004 } as Record<string, number>, hausse: 0.0001 };
/** Le boss de l'île vient de tomber (ou de s'enfuir) : tirage du Dofus Cawotte pour le joueur en cours (commeJoueur). Vrai s'il tombe. */
export function tenterDofusCawotte(w: World, boss: string): boolean {
  const D = DOFUS_CAWOTTE, base = D.taux[boss], p = w.player;
  if (base == null || p.dofus.includes(D.id)) return false;
  const r = p.guerre, chance = (base + (r.malchance ?? 0)) * coefProspection(p.prospection);
  if (w.rng.next() < chance && p.gagnerDofus(D.id)) { r.malchance = 0; w.emit({ k: 'dofusGagne', id: D.id }); return true; }
  r.malchance = (r.malchance ?? 0) + D.hausse;
  return false;
}

/** Toute la guerre de l'île : recharges des épouvantails, attaque spontanée, attaque en cours. */
export class Guerre {
  attaque: Attaque | null = null;
  /** 6A : recharge de l'épouvantail de chaque champ (s). */
  recharges: number[];
  /** 4A : temps avant la prochaine attaque spontanée (compté seulement quand un joueur est sur l'île). */
  spontT: number;
  readonly champs: ChampDef[];
  readonly subs: Set<number>;
  constructor(readonly w: World, champs: ChampDef[]) {
    this.champs = champs;
    this.recharges = champs.map(() => 0);
    this.spontT = w.rng.range(...GUERRE.spontanee);
    this.subs = new Set(champs.map(c => c.sub));
  }
  /** Joueurs sur l'île (une de ses sous-zones, passerelles comprises). */
  surIle() {
    const wg = this.w.worldGrid!;
    return this.w.players.filter(p => { const s = wg.mapAt(p.x, p.y)?.sub; return s != null && (this.subs.has(s) || s === 1600); });
  }
  epouvantail(i: number): Pt { return this.w.worldGrid!.cellToWorld(this.champs[i].epouvantail); }

  update(dt: number) {
    const w = this.w;
    for (let i = 0; i < this.recharges.length; i++) this.recharges[i] = Math.max(0, this.recharges[i] - dt);
    const ici = this.surIle();
    // 6A : clic sur l'épouvantail d'un champ (à côté) = l'attaque commence
    if (!this.attaque) for (const p of ici) {
      if (p.dead) continue;
      const i = this.champs.findIndex((_, k) => { const e = this.epouvantail(k); return Math.hypot(p.x - e.x, p.y - e.y) < 160 && p.vise(e.x, e.y, GUERRE.rayon); });
      if (i < 0) continue;
      if (this.recharges[i] > 0) { w.commeJoueur(p, () => w.emit({ k: 'status', x: p.x, y: p.y - 60, text: `L'épouvantail se repose (${Math.ceil(this.recharges[i] / 60)} min)`, color: '#c9c4ab' })); p.stopMove(); continue; }
      p.stopMove();
      this.lancer(i, false);
      break;
    }
    // 4A : attaque spontanée sur le champ le plus proche d'un joueur de l'île
    if (!this.attaque && ici.length && (this.spontT -= dt) <= 0) {
      this.spontT = w.rng.range(...GUERRE.spontanee);
      const p = ici[0];
      let best = 0, bd = Infinity;
      this.champs.forEach((_c, k) => { const e = this.epouvantail(k), d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = k; } });
      this.lancer(best, true);
    }
    const a = this.attaque;
    if (!a) return;
    a.update(dt);
    // 10B : on peut partir et revenir ; l'attaque se termine d'elle-même (si plus personne sur l'île, les Wabbits gagnent vite)
    if (a.fini && !a.arrivees.length && a.vivants() === 0) this.attaque = null;
  }
  lancer(i: number, spontanee: boolean) {
    const w = this.w;
    this.recharges[i] = GUERRE.recharge;
    this.attaque = new Attaque(w, i, this.champs[i], spontanee);
    // 6C : l'annonce n'arrive qu'aux joueurs sur l'île
    for (const p of this.surIle()) w.commeJoueur(p, () => w.emit({ k: 'guerreDebut', champ: this.champs[i].nom, spontanee, vagues: GUERRE.vagues, cawottes: GUERRE.cawottes }));
  }
  /** 10D : où relever un joueur mort pendant l'attaque (au bord du champ). */
  bordDuChamp(): Pt | null { return this.attaque ? this.attaque.entrees[0] : null; }
}
