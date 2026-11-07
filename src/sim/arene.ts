import type { DonjonDef } from './defs';
import type { Monster } from './monster';
import type { World } from './world';

/** Réglages des arènes (maquette « Donjons en vagues », ligne Donjons : 1B 2D 3A 4A 5A+5B+5C 6A 7A 8A+8C 9C 10B 11A 12A 13A 14A 15A 16A). */
export const ARENE = {
  /** 6A : la vague suivante arrive quand il reste ce nombre de monstres, ou après ce délai (s). */
  reste: 2, delai: 30,
  /** 7A : cercle rouge à l'entrée pendant ce temps avant l'apparition (s) ; écart entre deux monstres d'une même entrée. */
  annonce: 1, cadence: 0.25,
  /** 15A : invulnérable à l'arrivée (s) ; la vague 1 attend le premier geste, au plus ce temps (s). */
  protection: 1.5, attente: 3,
  /** 14A : la clé reste valable ce temps (s) : on reprend à la vague atteinte. */
  cle: 600,
  /** 8C : paliers du boss (part de ses PV) ; à chacun il appelle cette vague et devient intouchable tant qu'elle vit. */
  paliers: [0.66, 0.33], palierN: 4,
  /** 13A : rayon du portail de sortie et du coffre. */
  rayon: 60,
};

/** Clé d'un donjon encore valable (14A), gardée dans la sauvegarde : vague atteinte et temps restant (s). */
export interface CleDonjon { nom: string; vague: number; reste: number }

interface Attente { type: string; x: number; y: number; t: number; vague: number }

/** Une partie dans l'arène d'un donjon : vagues, boss à paliers, chrono, portail et coffre à la fin.
 *  Aucun hasard hors de world.rng ; l'affichage lit l'état (vague, chrono, attente, fin) et les événements. */
export class Arene {
  /** Vague en cours (0 = pas commencée, total + 1 = celle du boss). */
  vague = 0;
  readonly total: number;
  /** Temps depuis le début de la vague 1 (12A), temps dans la vague en cours, attente du premier geste (15A). */
  chrono = 0;
  private tVague = 0;
  private attente = ARENE.attente;
  /** 15A : la première vague est partie. */
  demarre = false;
  /** Monstres annoncés (cercle rouge) pas encore apparus. */
  arrivees: Attente[] = [];
  /** Monstres de la vague en cours (et des vagues de palier, comptés à part). */
  private membres: Monster[] = [];
  private renforts: Monster[] = [];
  /** Tous les monstres apparus (pour les faire partir à la fin). */
  private tous: Monster[] = [];
  boss: Monster | null = null;
  private palier = 0;
  /** 13A : le boss est tombé ; coffre ouvert ou non. */
  fini = false;
  coffreOuvert = false;
  readonly pts: { arrivee: Pt; entrees: Pt[]; boss: Pt; sortie: Pt; coffre: Pt };
  private readonly pool: string[];
  private depart: Pt;

  constructor(readonly w: World, readonly d: DonjonDef, reprise: number) {
    const wg = w.worldGrid!, a = d.arene!, at = (c: number) => wg.cellToWorld(c);
    this.pts = { arrivee: at(a.arrivee), entrees: a.entrees.map(at), boss: at(a.boss), sortie: at(a.sortie), coffre: at(a.coffre) };
    this.total = d.vagues?.length ?? 0;
    const M = w.opts.data.monsters;
    this.pool = [...new Set(Object.values(d.salles).flat(2))].filter(m => M[m] && !M[m].boss);
    this.vague = Math.max(0, Math.min(this.total + 1, reprise) - 1);   // la vague atteinte recommence (monstres remis à neuf)
    this.depart = { ...this.pts.arrivee };
  }

  get nom() { return this.d.nom; }
  /** Monstres de l'arène encore en vie. */
  vivants() { return this.tous.filter(m => !m.dead).length; }

  update(dt: number) {
    const w = this.w, p = w.player;
    // 7A : cercle rouge au sol, puis le monstre arrive par l'entrée
    for (const a of this.arrivees) {
      a.t -= dt;
      if (a.t <= ARENE.annonce) w.telegraphs.push({ kind: 'circle', x: a.x, y: a.y, r: 46, progress: 1 - Math.max(0, a.t) / ARENE.annonce, danger: true });
      if (a.t <= 0) this.apparaitre(a);
    }
    this.arrivees = this.arrivees.filter(a => a.t > 0);
    if (this.fini) { this.updateFin(); return; }
    if (p.dead) return;
    // 15A : la vague 1 attend le premier geste (ou 3 s)
    if (!this.demarre) {
      const geste = p.state !== 'free' || Math.hypot(p.x - this.depart.x, p.y - this.depart.y) > 60;
      if ((this.attente -= dt) > 0 && !geste) return;
      this.demarre = true;
      this.lancerVague();
      return;
    }
    this.chrono += dt; this.tVague += dt;
    this.updateBoss();
    if (this.vague > this.total) return;   // la vague du boss finit quand il tombe
    const reste = this.membres.filter(m => !m.dead).length + this.arrivees.filter(a => a.vague === this.vague).length;
    if (reste <= ARENE.reste || this.tVague >= ARENE.delai) this.lancerVague();
  }

  /** Vague suivante : groupes officiels + tirages, répartis sur les trois entrées (7A). Après la dernière, le boss (8A). */
  private lancerVague() {
    const w = this.w, d = this.d;
    this.vague++; this.tVague = 0;
    const boss = this.vague > this.total;
    const liste = boss ? d.bossVague ?? [] : (d.vagues![this.vague - 1].m).map(m => (m === '?' ? w.rng.pick(this.pool) : m));
    this.membres = [];   // les restes de la vague d'avant ne retiennent plus la suivante
    const cle = w.player.cleDonjon;
    if (cle && cle.nom === d.nom) cle.vague = this.vague;
    w.emit({ k: 'areneVague', n: this.vague, total: this.total, nom: boss ? null : d.vagues![this.vague - 1].nom ?? null, boss: boss ? liste[0] ?? null : null });
    liste.forEach((type, i) => {
      // le boss et ses compagnons descendent de l'estrade ; les autres arrivent par les entrées, chacun à son tour
      const e = boss ? this.pts.boss : this.pts.entrees[i % this.pts.entrees.length];
      const k = boss ? i : Math.floor(i / this.pts.entrees.length), r = boss && i ? 90 : k ? 50 : 0, a = w.rng.range(0, Math.PI * 2);
      this.annoncer(type, e.x + Math.cos(a) * r, e.y + Math.sin(a) * r * 0.6, ARENE.annonce + k * ARENE.cadence);
    });
  }
  private annoncer(type: string, x: number, y: number, t: number) {
    const wg = this.w.worldGrid!, q = wg.walkable(x, y) ? { x, y } : wg.nearestFree(x, y, wg.freeByMap.get(this.d.arene!.tag)!);
    this.arrivees.push({ type, x: q.x, y: q.y, t, vague: this.vague });
  }
  private apparaitre(a: Attente) {
    const w = this.w, m = w.spawnMonster(a.type, a.x, a.y);
    m.arene = true; this.tous.push(m);
    if (a.vague < 0) this.renforts.push(m); else this.membres.push(m);
    if (m.def.boss && !this.boss) { this.boss = m; w.emit({ k: 'impact', hitstop: 0.05, shake: 0.012, big: true }); }
  }

  /** 8C : à 66 % puis 33 % de ses PV, le boss appelle une vague et reste intouchable tant qu'elle vit. */
  private updateBoss() {
    const b = this.boss, w = this.w;
    if (!b) return;
    if (b.dead) { this.finir(); return; }
    if (b.intouchable && !this.renforts.some(m => !m.dead) && !this.arrivees.some(a => a.vague < 0)) {
      b.intouchable = false;
      w.emit({ k: 'status', x: b.x, y: b.y - 40, text: 'Vulnérable !', color: '#f2d36b' });
    }
    const seuil = ARENE.paliers[this.palier];
    if (seuil == null || b.hp > b.maxHp * seuil) return;
    this.palier++; b.intouchable = true; this.renforts = this.renforts.filter(m => !m.dead);
    w.emit({ k: 'arenePalier', id: b.id, name: b.def.name, n: this.palier });
    for (let i = 0; i < ARENE.palierN; i++) {
      const e = this.pts.entrees[i % this.pts.entrees.length], a = w.rng.range(0, Math.PI * 2), r = i >= this.pts.entrees.length ? 50 : 0;
      this.arrivees.push({ ...this.libre(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r * 0.6), type: w.rng.pick(this.pool), t: ARENE.annonce, vague: -1 });
    }
  }
  private libre(x: number, y: number) {
    const wg = this.w.worldGrid!;
    return wg.walkable(x, y) ? { x, y } : wg.nearestFree(x, y, wg.freeByMap.get(this.d.arene!.tag)!);
  }

  /** Le boss est tombé : chrono arrêté, record gardé, la clé est usée ; les derniers monstres s'enfuient. Portail et coffre (13A). */
  private finir() {
    const w = this.w, p = w.player;
    this.fini = true; this.arrivees = [];
    for (const m of this.tous) if (!m.dead) { m.dead = true; m.t = 0.6; }
    if (p.cleDonjon?.nom === this.d.nom) p.cleDonjon = null;
    const record = w.quetes?.tempsDonjon(this.d.nom, this.chrono) ?? false;
    w.emit({ k: 'areneFin', nom: this.d.nom, temps: this.chrono, record });
  }
  private updateFin() {
    const w = this.w, p = w.player;
    if (p.dead || w.passage) return;
    const c = this.pts.coffre, s = this.pts.sortie;
    if (!this.coffreOuvert && (Math.hypot(p.x - c.x, p.y - c.y) < ARENE.rayon || p.vise(c.x, c.y, ARENE.rayon + 30) && Math.hypot(p.x - c.x, p.y - c.y) < 140)) {
      this.coffreOuvert = true;
      w.coffreDonjon(this.d, c.x, c.y);
    }
    if (Math.hypot(p.x - s.x, p.y - s.y) < ARENE.rayon * 0.8) w.quitterArene(this.d);
  }
  /** Le joueur est parti (mort, Rappel) : ses monstres disparaissent ; la clé garde la vague atteinte. */
  abandonner() {
    for (const m of this.tous) if (!m.dead) { m.dead = true; m.t = 0; }
    this.arrivees = [];
  }
}
type Pt = { x: number; y: number };
