import A from '../data/arene_ames.json';
import { AFFIXES, defAffixes, poserAffixes, type Affixe } from './elites';
import { jourDe } from './mondeVivant';
import type { Monster } from './monster';
import type { Player } from './player';
import type { World } from './world';

/** Arène des âmes (ligne « Arène : » du 15 novembre 2026). Au Marché couvert du Bastion, la Gardienne et le Gardien de l'arène
 *  (PNJ officiels) ouvrent une fenêtre : on choisit jusqu'à 5 âmes (boss de donjon ou archimonstres), le groupe proche est envoyé
 *  dans l'arène commune (4C), et les âmes reviennent une par une (une vague par âme ; 3 boss ou plus = enchaînement, 13A).
 *  Un défi tiré au hasard (12A), 1 âme sur 20 corrompue (14A), retour devant le PNJ à la fin ou à la mort (9A), « Encore ! » (9B).
 *  Les idoles actives s'appliquent comme partout (7A) ; chacun a son butin (7B, 8A) ; Rare garanti sur un archimonstre (8C). */
export const ARENE_AMES = A;
export type Defi = keyof typeof A.defis;
export const DEFIS = Object.keys(A.defis) as Defi[];

/** Ce qu'un perso garde : victoires par monstre, total, records (clé = âmes de la file), records de la semaine, âme du lundi prise. */
export interface EtatAreneAmes { v: Record<string, number>; n: number; rec: Record<string, number>; sem: string; recSem: Record<string, number>; lundi: string }
export const areneAmesVide = (): EtatAreneAmes => ({ v: {}, n: 0, rec: {}, sem: '', recSem: {}, lundi: '' });
export function lireAreneAmes(s: unknown): EtatAreneAmes {
  const o = (s && typeof s === 'object' ? s : {}) as Partial<EtatAreneAmes>, nb = (x: unknown) => typeof x === 'number' && isFinite(x) ? x : 0;
  const dict = (d: unknown) => Object.fromEntries(Object.entries(d && typeof d === 'object' ? d : {}).filter(([, v]) => typeof v === 'number' && isFinite(v))) as Record<string, number>;
  return { v: dict(o.v), n: nb(o.n), rec: dict(o.rec), sem: typeof o.sem === 'string' ? o.sem : '', recSem: dict(o.recSem), lundi: typeof o.lundi === 'string' ? o.lundi : '' };
}

/** Semaine (lundi 0 h, heure de Paris) d'un instant. */
export const semaineDe = (ms: number) => `s${Math.floor((jourDe(ms) + 3) / 7)}`;
/** Clé d'une file d'âmes (records). */
export const cleFile = (types: readonly string[]) => [...types].sort().join('+');

export interface AmeDef { id: string; type: string; boss: boolean }
/** Toutes les âmes relâchables du jeu (ressources « Âme capturée » officielles), boss d'abord puis par niveau. */
export function toutesAmes(w: World): AmeDef[] {
  const R = w.opts.items?.resources ?? {}, M = w.opts.data.monsters, out: AmeDef[] = [];
  for (const [id, r] of Object.entries(R)) { const t = r.ame, d = t ? M[t] : undefined; if (d) out.push({ id, type: t!, boss: !d.archiDe }); }
  const niv = (a: AmeDef) => M[a.type]?.level ?? 0;
  return out.sort((a, b) => Number(b.boss) - Number(a.boss) || niv(a) - niv(b) || a.type.localeCompare(b.type));
}
/** 16A : l'âme de boss de la semaine, la même pour tout le monde. */
export function ameDeLaSemaine(w: World, ms: number): AmeDef | null {
  const l = toutesAmes(w).filter(a => a.boss);
  return l.length ? l[Math.floor((jourDe(ms) + 3) / 7) % l.length] : null;
}

/** Un combat de l'arène des âmes, commun au groupe (tenu par l'hôte). */
export class CombatAmes {
  i = -1;
  chrono = 0;
  /** Attente avant la vague suivante (la première : le temps du fondu). */
  pause: number;
  /** Compte à rebours du retour devant le PNJ, après la victoire ou l'échec (0 = combat en cours). */
  retourT = 0;
  victoire = false;
  rate = false;
  vivants: Monster[] = [];
  private immobile = new Map<number, number>();
  private avant = new Map<number, { x: number; y: number; potions: number }>();
  constructor(private w: World, readonly file: { id: string; type: string; corrompue: boolean }[], public joueurs: number[], readonly defi: Defi,
    readonly retour: { x: number; y: number }, readonly lanceur: number, attente: number) { this.pause = attente; }

  get participants(): Player[] { return this.w.players.filter(q => this.joueurs.includes(q.id)); }
  /** Limite du défi « Contre la montre » (s). */
  get limite(): number { return A.defis.chrono.base + A.defis.chrono.parAme * this.file.length; }
  get nbBoss(): number { return this.file.filter(f => !this.w.opts.data.monsters[f.type]?.archiDe).length; }
  texteDefi(): string { return A.defis[this.defi].texte.replace('{s}', String(this.limite)); }

  update(dt: number) {
    const w = this.w;
    if (this.retourT > 0) { if ((this.retourT -= dt) <= 0) w.finirCombatAmes(); return; }
    if (!this.participants.some(q => !q.dead)) { this.echec(); return; }
    if (this.i >= 0) this.chrono += dt;
    this.suivreDefi(dt);
    this.vivants = this.vivants.filter(m => !m.dead);
    if (this.vivants.length) return;
    if ((this.pause -= dt) > 0) return;
    if (this.i + 1 < this.file.length) this.vagueSuivante();
    else this.gagner();
  }
  /** Défi du groupe : raté dès qu'un des joueurs le rate. */
  private suivreDefi(dt: number) {
    if (this.rate || this.i < 0) return;
    const D = A.defis;
    for (const q of this.participants) {
      if (q.dead) continue;
      const a = this.avant.get(q.id) ?? { x: q.x, y: q.y, potions: q.potions };
      let rate = false;
      if (this.defi === 'potion' && q.potions < a.potions) rate = true;
      if (this.defi === 'intact' && q.hp < q.maxHp / 2) rate = true;
      if (this.defi === 'bouger') {
        const t = Math.hypot(q.x - a.x, q.y - a.y) > 1 ? 0 : (this.immobile.get(q.id) ?? 0) + dt;
        this.immobile.set(q.id, t);
        if (t > D.bouger.immobile) rate = true;
      }
      this.avant.set(q.id, { x: q.x, y: q.y, potions: q.potions });
      if (rate) { this.rater(); return; }
    }
    if (this.defi === 'chrono' && this.chrono > this.limite) this.rater();
  }
  private rater() {
    this.rate = true;
    this.w.emit({ k: 'areneAmesDefi', reussi: false, nom: A.defis[this.defi].nom });
  }
  private vagueSuivante() {
    const w = this.w, f = this.file[++this.i], M = w.opts.data.monsters, d = M[f.type];
    this.pause = A.pause;
    if (!d) return;
    const wg = w.worldGrid!, tag = 'arene', c = w.openestCellOf(tag), libres = wg.freeByMap.get(tag);
    const types = [f.type];
    if (d.archiDe) { const n = 3 + Math.floor(w.rng.next() * 3); for (let k = 0; k < n; k++) types.push(d.archiDe); }   // 5A : l'archi et 3 à 5 monstres de sa famille
    types.forEach((t, k) => {
      const ang = k * 2 * Math.PI / Math.max(1, types.length - 1), q = k ? wg.nearestFree(c.x + Math.cos(ang) * 90, c.y + Math.sin(ang) * 45, libres) : c;
      let def = M[t];
      // 14A : âme corrompue par les Enfers : 2 affixes d'élite, butin doublé
      const aff: Affixe[] = [];
      if (!k && f.corrompue) { const l = [...AFFIXES]; while (aff.length < 2 && l.length) aff.push(l.splice(w.rng.int(l.length), 1)[0]); def = defAffixes(def, aff); }
      const m = w.spawnMonster(t, q.x, q.y, def);
      m.arene = true; m.relache = true; m.state = 'chase';
      if (aff.length) { poserAffixes(m, aff); m.corrompu = true; }
      this.vivants.push(m);
    });
    w.emit({ k: 'impact', hitstop: 0.05, shake: 0.012, big: true });
    w.emit({ k: 'areneAmesVague', n: this.i + 1, total: this.file.length, monster: f.type, corrompue: f.corrompue, x: c.x, y: c.y });
  }
  private gagner() {
    const w = this.w, cle = cleFile(this.file.map(f => f.type)), sem = w.opts.horloge ? semaineDe(w.opts.horloge()) : '';
    this.victoire = true; this.retourT = A.retour;
    const reussi = !this.rate, chaine = this.nbBoss >= A.chaine.min, c = w.openestCellOf('arene');
    for (const q of this.participants) {
      const e = q.areneAmes;
      for (const f of this.file) e.v[f.type] = (e.v[f.type] ?? 0) + 1;
      e.n += this.file.length;
      const record = !(e.rec[cle] <= this.chrono);
      if (record) e.rec[cle] = Math.round(this.chrono * 10) / 10;
      if (sem && e.sem !== sem) { e.sem = sem; e.recSem = {}; }
      if (sem && !(e.recSem[cle] <= this.chrono)) e.recSem[cle] = Math.round(this.chrono * 10) / 10;
      w.commeJoueur(q, () => {
        const der = this.file[this.file.length - 1], niv = w.opts.data.monsters[der.type]?.level ?? 1;
        // 12A : défi réussi = un tirage de butin de boss en plus par âme ; 13A : enchaînement de 3 boss ou plus = coffre garanti
        if (reussi) w.butinMonstre(q, der.type, 'boss', niv, c.x, c.y, A.defiTirages * this.file.length);
        if (chaine) w.butinMonstre(q, der.type, 'boss', niv, c.x, c.y, A.chaine.tirages * this.nbBoss, { rarete: A.chaine.rarete as 'epique', legendaire: A.chaine.legendaire });
        w.emit({ k: 'areneAmesFin', victoire: true, temps: this.chrono, record, defi: A.defis[this.defi].nom, reussi, chaine, encore: this.encorePossible(q), ames: this.file.length });
      });
    }
  }
  private echec() {
    const w = this.w;
    this.retourT = 0.01;
    for (const m of this.vivants) if (!m.dead) { m.dead = true; m.t = 0.6; }
    this.vivants = [];
    for (const q of w.players.filter(o => o.id === this.lanceur)) w.commeJoueur(q, () => w.emit({ k: 'areneAmesFin', victoire: false, temps: this.chrono, record: false, defi: A.defis[this.defi].nom, reussi: false, chaine: false, encore: false, ames: this.file.length }));
  }
  /** 9B : le lanceur a encore de quoi relancer la même file. */
  encorePossible(q: Player): boolean {
    if (q.id !== this.lanceur) return false;
    const besoin: Record<string, number> = {};
    for (const f of this.file) besoin[f.id] = (besoin[f.id] ?? 0) + 1;
    return Object.entries(besoin).every(([id, n]) => (q.resources[id] ?? 0) >= n);
  }
  /** Un joueur tombé ou parti ne compte plus. */
  retirer(id: number) { this.joueurs = this.joueurs.filter(j => j !== id); }
}
