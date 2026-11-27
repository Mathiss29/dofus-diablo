import type { Rang } from './butin';
import type { Monster } from './monster';
import type { Player } from './player';
import type { World } from './world';

/** Siège des Zoths (0.7, ligne « 0.7 : » 6A) : sur la place du Village des Zoths (île d'Otomaï), un clic sur la grande plaque
 *  lance le siège. Pendant 3 min, des vagues de Zoths arrivent par les passerelles et foncent vers la plaque ; chaque Zoth qui
 *  y reste sans être dérangé use la Pierre du village. Si elle tient jusqu'au bout, un coffre (or, argent ou bronze selon ce
 *  qu'il lui reste) pour chaque joueur qui défendait. Un joueur ne peut défendre qu'une fois par heure (heure de Paris).
 *  État commun à tous les joueurs (un siège à la fois) ; ce qui est propre à chacun va dans Player.siege07. */
export const SIEGE = {
  /** Durée (s) ; une vague toutes les `cadence` s, la première tout de suite. */
  duree: 180, cadence: 20,
  /** Taille d'une vague : base + vague / 2 (arrondi au-dessus), +25 % par joueur en plus. */
  base: 3, parJoueur: 0.25,
  /** Cercle rouge au sol avant l'arrivée (s), écart entre deux Zoths d'une même passerelle (s). */
  annonce: 1, ecart: 0.4,
  /** Pierre du village : points, usure par Zoth posé sur la plaque (par s ; le double pour le Sergent). */
  pierre: 100, usure: 1.5, sergent: 'sergent_zoth',
  /** Rayon de la plaque (px) ; un Zoth se laisse distraire par un joueur à moins de `distrait` px ou s'il vient d'être frappé (s). */
  plaque: 75, distrait: 170, frappe: 3,
  /** Rayon du clic de lancement, rayon de la place où l'on compte comme défenseur (px). */
  rayon: 90, place: 900,
  /** Une fois par heure et par joueur (s). */
  recharge: 3600,
  /** Coffre : seuils en points de Pierre restants ; tirages de butin de boss ; l'or ajoute un objet Épique ou mieux. */
  seuils: { or: 70, argent: 35 }, tirages: { or: 3, argent: 2, bronze: 1 }, rang: 'boss' as Rang,
};

export type CoffreSiege = 'or' | 'argent' | 'bronze';
/** Données du siège (zones.json > astrub.open.siege07, écrites par tools/extraction/arenes07/siege07.py). */
export interface SiegeDef { nom: string; tag: string; sub: number; coeur: number; entrees: number[] }
/** Ce qu'un joueur garde du siège (sauvegarde) : dernier siège lancé (heure de Paris, s), sièges tenus, en or. */
export interface EtatSiege { dernier: number | null; tenus: number; or: number }
export const siegeVide = (): EtatSiege => ({ dernier: null, tenus: 0, or: 0 });

interface Pt { x: number; y: number }
interface Arrivee extends Pt { type: string; t: number }
interface Assaillant { m: Monster; hp: number; frappeT: number }

export function coffreSiege(pierre: number): CoffreSiege | null {
  return pierre <= 0 ? null : pierre >= SIEGE.seuils.or ? 'or' : pierre >= SIEGE.seuils.argent ? 'argent' : 'bronze';
}

/** Le siège du Village des Zoths : lancement, vagues, Pierre du village, coffres. */
export class Siege {
  /** En cours : temps écoulé (s), null hors siège. */
  chrono: number | null = null;
  vague = 0;
  pierre = SIEGE.pierre;
  arrivees: Arrivee[] = [];
  assaillants: Assaillant[] = [];
  /** Joueurs qui défendent (ceux qui étaient sur la place au lancement et pas en recharge). */
  defenseurs: number[] = [];
  readonly coeur: Pt;
  readonly entrees: Pt[];
  private readonly pool: string[];
  constructor(readonly w: World, readonly d: SiegeDef) {
    const wg = w.worldGrid!;
    this.coeur = wg.cellToWorld(d.coeur);
    this.entrees = d.entrees.map(c => wg.cellToWorld(c));
    const M = w.opts.data.monsters;
    this.pool = (w.zone.open!.subareas[String(d.sub)]?.monsters ?? []).filter(m => M[m]);
  }
  get enCours() { return this.chrono != null; }
  get reste() { return this.chrono == null ? 0 : Math.max(0, SIEGE.duree - this.chrono); }
  /** Heure de Paris (s) ; sans horloge (tests, serveur) : le temps de la partie. */
  maintenant(): number { const h = this.w.opts.horloge; return h ? h() : this.w.time; }
  /** Secondes avant que ce joueur puisse défendre à nouveau (0 = prêt). */
  attente(p: Player): number {
    const d = p.siege07.dernier;
    return d == null ? 0 : Math.max(0, d + SIEGE.recharge - this.maintenant());
  }
  surPlace(p: Player) { return Math.hypot(p.x - this.coeur.x, p.y - this.coeur.y) < SIEGE.place; }

  update(dt: number) {
    const w = this.w, c = this.coeur;
    for (const a of this.arrivees) {
      a.t -= dt;
      if (a.t <= SIEGE.annonce) w.telegraphs.push({ kind: 'circle', x: a.x, y: a.y, r: 40, progress: 1 - Math.max(0, a.t) / SIEGE.annonce, danger: true });
      if (a.t <= 0 && this.enCours) this.apparaitre(a);
    }
    this.arrivees = this.arrivees.filter(a => a.t > 0);
    if (!this.enCours) {
      // clic sur la plaque (à côté) = le siège commence
      for (const p of w.players) {
        if (p.dead || Math.hypot(p.x - c.x, p.y - c.y) > 200 || !p.vise(c.x, c.y, SIEGE.rayon)) continue;
        p.stopMove();
        const att = this.attente(p);
        if (att > 0) { w.commeJoueur(p, () => w.emit({ k: 'status', x: p.x, y: p.y - 60, text: `Les Zoths reprennent des forces (${Math.ceil(att / 60)} min)`, color: '#c9c4ab' })); continue; }
        this.lancer();
        break;
      }
      return;
    }
    this.chrono! += dt;
    this.assaillants = this.assaillants.filter(a => !a.m.dead || a.m.t > 0);
    // tous les défenseurs partis (ou morts loin de la place) : le village tombe
    const presents = w.players.filter(p => this.defenseurs.includes(p.id) && (this.surPlace(p) || p.dead));
    if (!presents.length) { this.finir(false); return; }
    if (this.pierre <= 0) { this.finir(false); return; }
    if (this.chrono! >= SIEGE.duree) { this.finir(true); return; }
    if (this.vague * SIEGE.cadence <= this.chrono!) this.lancerVague();
  }

  lancer() {
    const w = this.w, now = this.maintenant();
    this.chrono = 0; this.vague = 0; this.pierre = SIEGE.pierre; this.assaillants = []; this.arrivees = [];
    this.defenseurs = w.players.filter(p => !p.dead && this.surPlace(p) && this.attente(p) <= 0).map(p => p.id);
    for (const p of w.players) if (this.defenseurs.includes(p.id)) {
      p.siege07.dernier = now;
      w.commeJoueur(p, () => w.emit({ k: 'siegeDebut', nom: this.d.nom, duree: SIEGE.duree }));
    }
  }

  private lancerVague() {
    const w = this.w;
    this.vague++;
    let n = SIEGE.base + Math.ceil(this.vague / 2);
    n += Math.round(n * SIEGE.parJoueur * Math.max(0, this.defenseurs.length - 1));
    w.emit({ k: 'siegeVague', n: this.vague, total: Math.ceil(SIEGE.duree / SIEGE.cadence) });
    if (!this.pool.length || !this.entrees.length) return;
    const wg = w.worldGrid!;
    for (let j = 0; j < n; j++) {
      const e = this.entrees[j % this.entrees.length], k = Math.floor(j / this.entrees.length), a = w.rng.range(0, Math.PI * 2), r = k ? 40 : 0;
      const x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r * 0.6, q = wg.walkable(x, y) ? { x, y } : e;
      this.arrivees.push({ type: w.rng.pick(this.pool), x: q.x, y: q.y, t: SIEGE.annonce + k * SIEGE.ecart });
    }
  }
  private apparaitre(a: Arrivee) {
    const m = this.w.spawnMonster(a.type, a.x, a.y);
    m.arene = true; m.siege = true; m.state = 'chase';
    this.assaillants.push({ m, hp: m.hp, frappeT: 0 });
  }

  /** Avant l'IA ordinaire d'un Zoth du siège : true = le siège le mène (il marche vers la plaque, il l'use). Sinon il se bat. */
  piloter(m: Monster, dt: number): boolean {
    const v = this.assaillants.find(x => x.m === m);
    if (!v || m.dead || m.state === 'spawn' || !this.enCours) return false;
    const w = this.w, c = this.coeur;
    if (m.hp < v.hp) v.frappeT = SIEGE.frappe;
    v.hp = m.hp;
    if (v.frappeT > 0) { v.frappeT -= dt; return false; }
    if (w.players.some(q => !q.dead && Math.hypot(q.x - m.x, q.y - m.y) < SIEGE.distrait)) return false;
    if (Math.hypot(c.x - m.x, c.y - m.y) > SIEGE.plaque * 0.8) { m.allerVers(c.x, c.y, dt, w, 1); return true; }
    m.setAnim('windup', w.time % 1);
    const avant = this.pierre;
    this.pierre = Math.max(0, this.pierre - SIEGE.usure * (m.type === SIEGE.sergent ? 2 : 1) * dt);
    if (Math.floor(avant / 10) > Math.floor(this.pierre / 10)) w.emit({ k: 'siegePierre', reste: Math.ceil(this.pierre), x: c.x, y: c.y });
    return true;
  }

  /** Fin : les Zoths restants repartent ; si la Pierre tient, un coffre pour chaque défenseur encore là. */
  private finir(tenu: boolean) {
    const w = this.w, c = this.coeur, coffre = tenu ? coffreSiege(this.pierre) : null, temps = this.chrono ?? 0;
    this.chrono = null; this.arrivees = [];
    for (const a of this.assaillants) if (!a.m.dead) { a.m.dead = true; a.m.t = 0.6; }
    this.assaillants = [];
    const niveau = w.opts.data.zones[w.opts.zone]?.open?.subareas[String(this.d.sub)]?.level ?? 120;
    for (const p of w.players) {
      if (!this.defenseurs.includes(p.id)) continue;
      const la = this.surPlace(p) || p.dead;
      if (coffre && la) {
        p.siege07.tenus++; if (coffre === 'or') p.siege07.or++;
        w.butinCoffre(p, SIEGE.rang, SIEGE.tirages[coffre], niveau, c.x, c.y, w.players.length > 1 ? p.id : undefined, coffre === 'or');
      }
      w.commeJoueur(p, () => w.emit({ k: 'siegeFin', nom: this.d.nom, coffre: la ? coffre : null, pierre: Math.ceil(this.pierre), temps }));
    }
    this.defenseurs = [];
  }

  /** Mort pendant le siège : relevé sur la place (à côté de la plaque) si l'on défendait. */
  releve(p: Player): Pt | null {
    if (!this.enCours || !this.defenseurs.includes(p.id)) return null;
    const wg = this.w.worldGrid!, q = { x: this.coeur.x - 60, y: this.coeur.y + 40 };
    return wg.walkable(q.x, q.y) ? q : this.coeur;
  }
}
