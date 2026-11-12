import MV from '../data/monde_vivant.json';
import { APPARATS_SOURCES } from './apparats';
import { degatsMonstre } from './danger';
import type { GameData, MonsterDef, SubAreaDef } from './defs';
import { PEPITE } from './items';
import type { Monster } from './monster';
import type { Player } from './player';
import type { World } from './world';

/** Version 0.5 « monde vivant » (maquette « 0.5 : 1A+1B+1C+1D 2A+2D+2E 3A+3C+3D+3E 4A+4B+4C+4D 5B 6B 7A+7B 8A+8B 9B 11A 12A 14A »,
 *  Mathis 2026-11-12) : boss du monde toutes les 3 h, une sous-zone envahie chaque heure, petits événements près du joueur,
 *  bonus officiel du week-end. Réglages dans src/data/monde_vivant.json.
 *
 *  L'heure vient de l'affichage (World.opts.horloge) : l'heure de Paris, la même pour tous les joueurs (2E). Qui apparaît et où
 *  se déduit de l'heure seule (fonctions pures plus bas), si bien que l'accueil, le Bastion, la carte M et le robot Discord
 *  annoncent les mêmes rendez-vous que le jeu. Le reste du hasard passe par world.rng. */
export const VIVANT = MV;
const B = MV.boss, INV = MV.invasion, EVT = MV.evenements;

export interface BossMondeDef {
  nom: string; monstres: string[]; sousZone: number; carte: string; niveau: number; renforts: string[]; titre: string; cri: string;
  /** 1C : seulement la nuit (le programme le met à 21 h et à minuit). */
  nuit?: boolean;
  /** 1B : Gelées Royales, on ne tape que celle qui brille. */
  brille?: boolean;
}
export const BOSS_MONDE = B.liste as Record<string, BossMondeDef>;

// --- Horloge : heure de Paris en secondes « murales » (comme si Paris était à l'heure UTC) --------------------------------
export const HEURE = 3600, JOUR = 86400;
export const jourDe = (s: number) => Math.floor(s / JOUR);
/** 0 = lundi … 6 = dimanche (le 1er janvier 1970 était un jeudi). */
export const jourSemaine = (s: number) => (((jourDe(s) + 3) % 7) + 7) % 7;
export const heureDe = (s: number) => Math.floor((((s % JOUR) + JOUR) % JOUR) / HEURE);

// --- Boss du monde : qui et quand (2A) ------------------------------------------------------------------------------------
/** Boss du créneau c (créneau = periode s depuis le 1er janvier 1970, heure de Paris). */
export function bossDuCreneau(c: number): string {
  const parJour = Math.round(JOUR / B.periode), jour = Math.floor(c / parJour), k = c - jour * parJour, prog = B.programme;
  if (prog[k] === 'nuit') return Object.keys(BOSS_MONDE).find(x => BOSS_MONDE[x].nuit)!;
  const i = prog.slice(0, k).filter(x => x === 'jour').length, R = B.rotation;
  return R[(((jour + i) % R.length) + R.length) % R.length];   // tourne d'un cran chaque jour
}
export interface RendezVous { cle: string; creneau: number; debut: number }
/** Le boss en cours (dans sa fenêtre d'attente) et le prochain. */
export function rendezVous(s: number): { enCours: RendezVous | null; suivant: RendezVous } {
  const c = Math.floor(s / B.periode), cur = { cle: bossDuCreneau(c), creneau: c, debut: c * B.periode };
  return { enCours: s - cur.debut < B.attente ? cur : null, suivant: { cle: bossDuCreneau(c + 1), creneau: c + 1, debut: (c + 1) * B.periode } };
}
/** « 21 h », « 0 h » : l'heure de Paris d'un instant. */
export const heureTexte = (s: number) => `${heureDe(s)} h`;

// --- Invasions : une sous-zone par heure (5B, 6B) -------------------------------------------------------------------------
/** Sous-zones qui peuvent être envahies : celles du monde d'Astrub et d'Amakna qui ont des groupes de monstres. */
export function candidatsInvasion(data: GameData): number[] {
  const sz = data.zones.astrub?.open?.subareas ?? {};
  return Object.entries(sz).filter(([, s]) => s.monsters.length && s.groupsPerMap > 0 && !s.interieur && !s.cartes).map(([k]) => Number(k)).sort((a, b) => a - b);
}
/** Mélange entier d'une heure : la même sous-zone pour tous les joueurs (pas de hasard ici, juste l'heure). */
function melange(h: number): number {
  let x = Math.imul(h ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  x = (x ^ (x >>> 13)) >>> 0; x = Math.imul(x, 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}
export interface InvasionHeure { sub: number; heure: number; debut: number; fin: number }
/** L'invasion de l'heure en cours (jamais deux fois la même sous-zone de suite). */
export function invasionDe(s: number, candidats: number[]): InvasionHeure | null {
  const n = candidats.length;
  if (!n) return null;
  const h = Math.floor(s / HEURE), avant = melange(h - 1) % n;
  let i = melange(h) % n;
  if (i === avant && n > 1) i = (i + 1) % n;
  return { sub: candidats[i], heure: h, debut: h * HEURE, fin: (h + 1) * HEURE };
}

// --- Week-end (9B) ----------------------------------------------------------------------------------------------------------
export type CleBonus = 'xp' | 'butin' | 'metier' | 'cles';
export interface BonusWeekEnd { id: number; cle: CleBonus; nom: string; texte: string; n: number }
/** Bonus officiel du week-end (samedi et dimanche, heure de Paris), à tour de rôle chaque semaine ; null en semaine. */
export function bonusWeekEnd(s: number): BonusWeekEnd | null {
  if (jourSemaine(s) < 5) return null;
  const semaine = Math.floor((jourDe(s) + 3) / 7), L = MV.weekend.bonus as BonusWeekEnd[];
  return L[semaine % L.length];
}

// --- Ce qu'un joueur garde (sauvegarde) --------------------------------------------------------------------------------------
/** boss : boss du monde déjà vaincus (titres, 4D) ; apparitions : créneaux déjà récompensés (4B) ; invasions : jauges remplies ;
 *  eclatsHeure : heure de l'invasion des Éclats Obscurs en poche (7B : ils se dissipent après) ; evenements : petits événements réussis. */
export interface EtatVivant { boss: string[]; apparitions: number[]; invasions: number; eclatsHeure: number; evenements: number }
export const vivantVide = (): EtatVivant => ({ boss: [], apparitions: [], invasions: 0, eclatsHeure: -1, evenements: 0 });

// --- Le monde vivant d'une partie (monde d'Astrub) ------------------------------------------------------------------------------
interface Pt { x: number; y: number }
interface Arrivee extends Pt { type: string; t: number; evt: number }
/** Une apparition de boss du monde (un créneau). */
export interface BossEnCours {
  cle: string; def: BossMondeDef; creneau: number; debut: number; centre: Pt;
  monstres: Monster[]; renforts: Monster[];
  /** Posé dans le monde (un joueur est venu) ; combat = temps du monde au premier coup (3D) ; fin = vaincu, parti ou enfui. */
  pose: boolean; combat: number | null; fin: null | 'vaincu' | 'parti' | 'enfui';
  palier: number; intouchableT: number;
  /** 3C : attaque géante en préparation (point visé, temps avant l'impact) et temps avant la suivante. */
  seisme: (Pt & { t: number }) | null; seismeT: number;
  /** 1B : Gelée qui brille et temps avant que la lumière change. */
  brille: number; brilleT: number;
}
export interface InvasionEnCours extends InvasionHeure {
  nom: string; jauge: number; max: number; pleine: boolean; aides: Set<number>; coffre: Pt | null;
}
export type SorteEvenement = 'defense' | 'coffre';
/** Petit événement (8A, 8B). pv : PV de l'habitant (défense, en %) ; vague : vague en cours (coffre gardé). */
export interface Evenement extends Pt {
  id: number; sorte: SorteEvenement; sub: number; nom: string; niveau: number; t: number; vague: number; pv: number;
  monstres: Monster[]; arrivees: Arrivee[]; fin: null | 'reussi' | 'rate' | 'abandon'; finT: number; loinT: number;
  /** Défense : habitant à protéger (passants.json). */
  habitant?: { id: string; nom: string };
}

/** Ce que l'affichage montre du monde vivant (et ce que l'invité de la coop reçoit, World.vivantVu). */
export interface VueVivant {
  boss: { cle: string; nom: string; lieu: string; x: number; y: number; reste: number | null; fin: BossEnCours['fin']; pose: boolean } | null;
  invasion: { nom: string; sub: number; jauge: number; max: number; pleine: boolean; coffre: Pt | null; fin: number } | null;
  evenements: { id: number; sorte: SorteEvenement; nom: string; x: number; y: number; pv: number; reste: number; vague: number; vagues: number; habitant: string | null; fin: Evenement['fin'] }[];
}

/** Boss du monde à signaler (2D) : celui qui est là, ou le prochain s'il est annoncé (10 min avant). Pour le Zaap conseillé et la carte. */
export function bossAnnonce(w: World): (BossMondeDef & { cle: string }) | null {
  const v = w.vueVivant, h = w.opts.horloge;
  if (v?.boss && !v.boss.fin) return { ...BOSS_MONDE[v.boss.cle], cle: v.boss.cle };
  if (!h || !v) return null;
  const s = h(), sv = rendezVous(s).suivant;
  return sv.debut - s <= B.annonce && BOSS_MONDE[sv.cle] ? { ...BOSS_MONDE[sv.cle], cle: sv.cle } : null;
}

/** Ce que crie le crieur du Bastion (2D) : prochain boss du monde (nom, lieu, heure) et invasion de l'heure. */
export function nouvellesDuMonde(data: GameData, s: number): { boss: string; invasion: string } {
  const sz = data.zones.astrub?.open?.subareas ?? {}, sv = rendezVous(s).suivant, d = BOSS_MONDE[sv.cle];
  const inv = invasionDe(s, candidatsInvasion(data));
  return {
    boss: d && data.monsters[d.monstres[0]] ? `${d.nom} à ${heureTexte(sv.debut)}, ${sz[String(d.sousZone)]?.name ?? 'Amakna'}` : '',
    invasion: inv ? sz[String(inv.sub)]?.name ?? '' : '',
  };
}

export class MondeVivant {
  boss: BossEnCours | null = null;
  invasion: InvasionEnCours | null = null;
  evenements: Evenement[] = [];
  /** Dernier créneau annoncé (2D : 10 min avant). */
  private annonce = -1;
  /** Temps avant le prochain petit événement, par joueur. */
  private evtT = new Map<number, number>();
  private readonly candidats: number[];
  private centres = new Map<number, Pt>();
  private defs = new Map<string, MonsterDef>();
  constructor(readonly w: World) {
    const sz = w.zone.open?.subareas ?? {};
    this.candidats = candidatsInvasion(w.opts.data).filter(k => sz[String(k)]);
  }
  /** Heure de Paris (s), ou null sans horloge (tests, serveur). */
  get secondes(): number | null { const h = this.w.opts.horloge; return h ? h() : null; }

  update(dt: number) {
    const s = this.secondes;
    if (s == null) return;
    this.updateBoss(dt, s);
    this.updateInvasion(s);
    this.updateEvenements(dt);
  }

  /** État à montrer (HUD, carte, coop). */
  vue(): VueVivant {
    const b = this.boss, inv = this.invasion, s = this.secondes ?? 0;
    return {
      boss: b ? { cle: b.cle, nom: b.def.nom, lieu: this.nomSousZone(b.def.sousZone), x: b.centre.x, y: b.centre.y, reste: this.resteCombat() == null ? null : Math.ceil(this.resteCombat()!), fin: b.fin, pose: b.pose } : null,
      invasion: inv ? { nom: inv.nom, sub: inv.sub, jauge: Math.min(inv.jauge, inv.max), max: inv.max, pleine: inv.pleine, coffre: inv.coffre, fin: Math.max(0, Math.round(inv.fin - s)) } : null,
      evenements: this.evenements.filter(e => e.fin !== 'abandon').map(e => ({ id: e.id, sorte: e.sorte, nom: e.sorte === 'defense' ? e.habitant!.nom : 'Coffre gardé', x: Math.round(e.x), y: Math.round(e.y),
        pv: Math.ceil(e.pv), reste: e.sorte === 'defense' ? Math.max(0, Math.ceil(EVT.defense.duree - e.t)) : 0, vague: e.vague,
        vagues: e.sorte === 'defense' ? EVT.defense.vagues.length : EVT.coffre.vagues.length + 1, habitant: e.habitant?.id ?? null, fin: e.fin })),
    };
  }

  // === Boss du monde =========================================================================================================
  private updateBoss(dt: number, s: number) {
    const w = this.w, rv = rendezVous(s);
    // 2D : annonce 10 minutes avant
    const sv = rv.suivant;
    if (sv.debut - s <= B.annonce && this.annonce !== sv.creneau && this.lieuOk(sv.cle)) {
      this.annonce = sv.creneau;
      const d = BOSS_MONDE[sv.cle];
      w.emit({ k: 'bossMondeAnnonce', cle: sv.cle, nom: d.nom, lieu: this.nomSousZone(d.sousZone), dans: Math.round(sv.debut - s), heure: heureTexte(sv.debut) });
    }
    const ec = rv.enCours;
    if (ec && this.lieuOk(ec.cle) && (!this.boss || this.boss.creneau !== ec.creneau)) {
      if (this.boss && !this.boss.fin) this.retirer(this.boss);
      const d = BOSS_MONDE[ec.cle], centre = this.w.openestCellOf(d.carte);
      this.boss = { cle: ec.cle, def: d, creneau: ec.creneau, debut: ec.debut, centre, monstres: [], renforts: [], pose: false, combat: null, fin: null,
        palier: 0, intouchableT: 0, seisme: null, seismeT: B.seisme.relance[0], brille: 0, brilleT: B.gelees.brille };
      w.emit({ k: 'bossMondeArrive', cle: ec.cle, nom: d.nom, lieu: this.nomSousZone(d.sousZone), x: centre.x, y: centre.y });
    }
    const b = this.boss;
    if (!b || b.fin) return;
    const fenetreFinie = s - b.debut >= B.attente;
    if (!b.pose) {
      if (fenetreFinie) { b.fin = 'parti'; return; }
      if (w.players.some(p => !p.dead && Math.abs(p.x - b.centre.x) + Math.abs(p.y - b.centre.y) <= World_POSE)) this.poser(b);
      return;
    }
    const vivants = b.monstres.filter(m => !m.dead);
    if (!vivants.length) { this.victoire(b); return; }
    if (b.combat == null && vivants.some(m => m.hp < m.maxHp || m.state === 'chase')) {
      b.combat = w.time;
      w.emit({ k: 'bossMondeCombat', cle: b.cle, nom: b.def.nom, minuterie: B.minuterie });
    }
    if (b.combat == null) {
      if (fenetreFinie) { this.retirer(b); b.fin = 'parti'; w.emit({ k: 'bossMondeFin', cle: b.cle, nom: b.def.nom, fin: 'parti' }); return; }
      if (w.players.every(p => Math.abs(p.x - b.centre.x) + Math.abs(p.y - b.centre.y) > World_RETRAIT)) this.retirer(b);   // il attend chez lui
      return;
    }
    // 3D : 5 minutes pour le battre
    if (w.time - b.combat >= B.minuterie) {
      this.retirer(b); b.fin = 'enfui';
      w.emit({ k: 'bossMondeFin', cle: b.cle, nom: b.def.nom, fin: 'enfui' });
      return;
    }
    this.paliers(b, dt, vivants);
    if (b.def.brille) this.gelees(b, dt, vivants);
    this.seisme(b, dt, vivants);
  }
  /** Gelées Royales : seulement quand leurs dessins sont là (squelettes copiés du PC de Mathis). Les autres boss toujours. */
  private lieuOk(cle: string) { const d = BOSS_MONDE[cle], wg = this.w.worldGrid; return !!wg?.mapByTag(d.carte) && d.monstres.every(m => this.w.opts.data.monsters[m]); }
  nomSousZone(sub: number): string { return this.w.zone.open?.subareas[String(sub)]?.name ?? '?'; }
  /** Temps qui reste au combat (s), ou null. */
  resteCombat(): number | null { const b = this.boss; return b?.combat != null && !b.fin ? Math.max(0, B.minuterie - (this.w.time - b.combat)) : null; }

  /** Définition du boss du monde : vrais sorts officiels, au niveau de sa zone (3A), PV d'un boss du monde. */
  private defBoss(type: string, joueurs: number, part: number): MonsterDef {
    const k = `${type}|${joueurs}`, c = this.defs.get(k);
    if (c) return { ...c, res: { ...c.res } };
    const M = this.w.opts.data.monsters, base = M[type], L = BOSS_MONDE[this.boss!.cle].niveau;
    let sig = base.signature, best = 0;
    if (sig == null) for (const sp of base.spells ?? []) {   // sans signature officielle : son plus gros sort de dommages
      let t = 0;
      for (const e of sp.effects) if (e.k === 'dmg') t += (e.min + e.max) / 2;
      if (t > best) { best = t; sig = sp.id; }
    }
    const d: MonsterDef = { ...base, boss: true, elite: false, level: L, hp: Math.round((B.pv.base + B.pv.parNiveau * L) * (1 + B.parJoueur * (joueurs - 1)) * part),
      radius: Math.round(base.radius * 1.25), mass: Math.max(base.mass, 8), xp: Math.round(L * 14 * part), signature: sig, res: { ...base.res } };
    d.dmg = Math.round(degatsMonstre(d) * B.degats);
    this.defs.set(k, d);
    return { ...d, res: { ...d.res } };
  }
  private poser(b: BossEnCours) {
    const w = this.w, n = Math.max(1, w.joueursProches(b.centre.x, b.centre.y).length), part = b.def.brille ? B.gelees.part : 1;
    b.monstres = b.def.monstres.map((type, i) => {
      const a = (i / b.def.monstres.length) * Math.PI * 2, r = b.def.monstres.length > 1 ? 90 : 0;
      const q = w.map.nearestFree(b.centre.x + Math.cos(a) * r, b.centre.y + Math.sin(a) * r * 0.6);
      const m = w.spawnMonster(type, q.x, q.y, this.defBoss(type, n, part));
      m.bossMonde = b.cle; m.state = 'idle';
      return m;
    });
    b.pose = true; b.palier = 0; b.intouchableT = 0; b.seisme = null; b.seismeT = B.seisme.relance[0];
    if (b.def.brille) { b.brille = 0; b.brilleT = B.gelees.brille; this.eclairer(b); }
  }
  /** Le boss rentre chez lui (plus personne autour, temps écoulé) : ses monstres disparaissent sans butin. */
  private retirer(b: BossEnCours) {
    const w = this.w, partent = new Set([...b.monstres, ...b.renforts]);
    for (const m of partent) if (!m.dead) { m.dead = true; m.t = 0; }
    w.monsters = w.monsters.filter(m => !partent.has(m) || m.t > 0);
    b.monstres = []; b.renforts = []; b.pose = false; b.combat = null; b.seisme = null;
  }
  /** 3C : à 66 % puis 33 %, la garde arrive et le boss est intouchable tant qu'elle vit (au plus intouchableMax s). */
  private paliers(b: BossEnCours, dt: number, vivants: Monster[]) {
    const w = this.w;
    b.renforts = b.renforts.filter(m => !m.dead || m.t > 0);
    if (b.intouchableT > 0) {
      b.intouchableT -= dt;
      if (b.intouchableT <= 0 || !b.renforts.some(m => !m.dead)) { b.intouchableT = 0; for (const m of vivants) m.intouchable = false; if (b.def.brille) this.eclairer(b); }
    }
    const pv = b.monstres.reduce((t, m) => t + Math.max(0, m.dead ? 0 : m.hp), 0), max = b.monstres.reduce((t, m) => t + m.maxHp, 0);
    const seuil = B.paliers[b.palier];
    if (seuil == null || pv > max * seuil) return;
    b.palier++;
    const chef = vivants[0], n = B.renforts + Math.max(0, w.players.length - 1);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + w.rng.range(0, 0.6), q = w.map.nearestFree(chef.x + Math.cos(a) * 220, chef.y + Math.sin(a) * 140);
      const r = w.spawnMonster(w.rng.pick(b.def.renforts), q.x, q.y);
      r.arene = true; r.state = 'chase';
      b.renforts.push(r);
    }
    b.intouchableT = B.intouchableMax;
    for (const m of vivants) m.intouchable = true;
    w.emit({ k: 'bossMondePalier', cle: b.cle, nom: b.def.nom, n: b.palier, x: chef.x, y: chef.y });
  }
  /** 1B : une seule Gelée brille ; les autres sont intouchables. Celle qui brille perd vuln points de résistance. */
  private gelees(b: BossEnCours, dt: number, vivants: Monster[]) {
    if (b.intouchableT > 0) return;
    const cur = b.monstres[b.brille];
    if ((b.brilleT -= dt) <= 0 || !cur || cur.dead) {
      b.brilleT = B.gelees.brille;
      for (let k = 1; k <= b.monstres.length; k++) { const j = (b.brille + k) % b.monstres.length; if (!b.monstres[j].dead) { b.brille = j; break; } }
      this.eclairer(b);
    }
    void vivants;
  }
  private eclairer(b: BossEnCours) {
    const M = this.w.opts.data.monsters;
    b.monstres.forEach((m, j) => {
      const on = j === b.brille && !m.dead;
      m.brille = on; m.intouchable = !on || b.intouchableT > 0;
      const base = M[m.type].res ?? {};
      for (const k of Object.keys(base) as (keyof typeof base)[]) m.def.res![k] = (base[k] ?? 0) - (on ? B.gelees.vuln : 0);
    });
  }
  /** 3C : l'attaque géante, annoncée au sol sous un joueur, qui retire une grosse part des PV de ceux qui restent dedans. */
  private seisme(b: BossEnCours, dt: number, vivants: Monster[]) {
    const w = this.w, S = B.seisme, chef = vivants.find(m => m.brille) ?? vivants[0];
    if (b.seisme) {
      const z = b.seisme;
      z.t -= dt;
      w.telegraphs.push({ kind: 'circle', x: z.x, y: z.y, r: S.rayon, progress: 1 - Math.max(0, z.t) / S.telegraphe, danger: true });
      if (z.t <= 0) {
        for (const p of w.players) if (!p.dead && Math.hypot(p.x - z.x, p.y - z.y) <= S.rayon + p.radius) w.commeJoueur(p, () => p.hurt(Math.round(p.maxHp * S.degats), chef.x, chef.y, w));
        w.emit({ k: 'slam', x: z.x, y: z.y, radius: S.rayon });
        w.emit({ k: 'impact', hitstop: 0.08, shake: 0.03, big: true });
        b.seisme = null;
      }
      return;
    }
    if ((b.seismeT -= dt) > 0) return;
    const cibles = w.players.filter(p => !p.dead && Math.hypot(p.x - chef.x, p.y - chef.y) < 900);
    b.seismeT = S.relance[Math.min(b.palier, S.relance.length - 1)];
    if (!cibles.length) return;
    const p = w.rng.pick(cibles);
    b.seisme = { x: p.x, y: p.y, t: S.telegraphe };
    w.emit({ k: 'monsterCast', id: chef.id, name: 'Secousse', x: chef.x, y: chef.y });
  }
  /** 4A-4D : chaque joueur présent, une fois par apparition, a son coffre (butin de boss, un Rare au moins), ses Pépites et,
   *  la première fois, le titre officiel (succès « bossMonde »). */
  private victoire(b: BossEnCours) {
    const w = this.w, R = B.recompense, x = b.centre.x, y = b.centre.y, type = b.def.monstres[0];
    b.fin = 'vaincu';
    for (const m of b.renforts) if (!m.dead) { m.dead = true; m.t = 0.6; }
    const der = b.monstres[b.monstres.length - 1], px = der?.x ?? x, py = der?.y ?? y;
    for (const q of w.joueursProches(px, py)) {
      const v = q.vivant;
      if (v.apparitions.includes(b.creneau)) continue;
      v.apparitions = [...v.apparitions, b.creneau].slice(-12);
      const premier = !v.boss.includes(b.cle);
      if (premier) v.boss = [...v.boss, b.cle];
      w.commeJoueur(q, () => {
        w.butinMonstre(q, type, 'boss', b.def.niveau, px, py, R.tirages, { rarete: 'rare', legendaire: R.legendaire });
        q.resources[PEPITE] = (q.resources[PEPITE] ?? 0) + R.pepites;
        w.emit({ k: 'lootResource', id: PEPITE, n: R.pepites });
        w.emit({ k: 'bossMondeVaincu', cle: b.cle, nom: b.def.nom, premier, titre: b.def.titre, pepites: R.pepites });
        w.gagnerApparat(b.cle, APPARATS_SOURCES.chances.monde.boss);   // « Apparats : » 1E
      });
    }
    w.emit({ k: 'bossMondeFin', cle: b.cle, nom: b.def.nom, fin: 'vaincu' });
  }
  /** Un monstre du monde vivant tombe (World.killMonster) : boss, envahisseur ou monstre d'un événement. true = butin géré ici. */
  monstreVaincu(m: Monster): boolean {
    if (m.envahi) this.envahisseurVaincu(m);
    return !!m.bossMonde;
  }

  // === Invasions ================================================================================================================
  /** La sous-zone est envahie en ce moment. */
  envahie(sub: number | undefined): boolean { return sub != null && this.invasion?.sub === sub; }
  /** Définition d'un envahisseur : plus de PV, plus de dégâts (5B). */
  defEnvahi(type: string): MonsterDef {
    const k = `inv|${type}`, c = this.defs.get(k);
    if (c) return c;
    const base = this.w.opts.data.monsters[type], d = { ...base, hp: Math.round(base.hp * INV.pv), dmg: Math.round(base.dmg * INV.degats), xp: Math.round((base.xp ?? base.hp / 5) * 1.25) };
    this.defs.set(k, d);
    return d;
  }
  private updateInvasion(s: number) {
    const w = this.w, h = invasionDe(s, this.candidats);
    if (!h) return;
    if (!this.invasion || this.invasion.heure !== h.heure) {
      const nom = this.nomSousZone(h.sub);
      this.invasion = { ...h, nom, jauge: 0, max: INV.jauge, pleine: false, aides: new Set(), coffre: null };
      w.relancerSousZone(h.sub);   // les groupes au calme de la sous-zone repartent envahis
      w.emit({ k: 'invasionDebut', nom, sub: h.sub, fin: h.fin - s });
    }
    const inv = this.invasion;
    inv.max = Math.round(INV.jauge * (1 + INV.parJoueur * Math.max(0, w.players.length - 1)));
    for (const p of w.players) {   // 7B : les Éclats d'une autre heure se dissipent
      if (p.vivant.eclatsHeure === inv.heure || !(p.resources[INV.eclat] > 0)) continue;
      delete p.resources[INV.eclat]; p.vivant.eclatsHeure = -1;
      w.commeJoueur(p, () => w.emit({ k: 'status', x: p.x, y: p.y - 70, text: 'Tes Éclats Obscurs se dissipent', color: '#b9a3e8' }));
    }
    // 7B : clic sur le coffre d'invasion (à côté) = l'ouvrir avec des Éclats
    const c = inv.coffre;
    if (c) for (const p of w.players) {
      if (p.dead || Math.hypot(p.x - c.x, p.y - c.y) > 170 || !p.vise(c.x, c.y, 60)) continue;
      p.stopMove();
      w.commeJoueur(p, () => this.ouvrirCoffreInvasion(p));
    }
  }
  private envahisseurVaincu(m: Monster) {
    const w = this.w, inv = this.invasion;
    if (!inv || w.worldGrid?.mapAt(m.homeX, m.homeY)?.sub !== inv.sub) return;
    const n = m.def.elite || m.def.boss ? INV.eclatsElite : 1;
    inv.jauge += n;
    for (const q of w.joueursProches(m.x, m.y)) {
      inv.aides.add(q.id);
      if (!w.opts.items?.resources[INV.eclat]) continue;
      if (q.vivant.eclatsHeure !== inv.heure) { delete q.resources[INV.eclat]; q.vivant.eclatsHeure = inv.heure; }
      q.resources[INV.eclat] = (q.resources[INV.eclat] ?? 0) + n;
      w.commeJoueur(q, () => w.emit({ k: 'lootResource', id: INV.eclat, n }));
    }
    if (inv.pleine || inv.jauge < inv.max) return;
    // 7A : jauge pleine = Pépites à ceux qui ont aidé ; le coffre d'invasion apparaît au cœur de la sous-zone
    inv.pleine = true;
    inv.coffre = this.centreSousZone(inv.sub);
    for (const q of w.players) {
      if (!inv.aides.has(q.id)) continue;
      q.vivant.invasions++;
      q.resources[PEPITE] = (q.resources[PEPITE] ?? 0) + INV.pepites;
      w.commeJoueur(q, () => { w.emit({ k: 'lootResource', id: PEPITE, n: INV.pepites }); w.emit({ k: 'invasionPleine', nom: inv.nom, pepites: INV.pepites, x: inv.coffre!.x, y: inv.coffre!.y }); });
    }
  }
  /** Cœur de la sous-zone : l'endroit le plus dégagé de sa carte la plus proche de son centre. */
  centreSousZone(sub: number): Pt {
    const c = this.centres.get(sub);
    if (c) return c;
    const wg = this.w.worldGrid!, maps = wg.world.maps.filter(m => m.sub === sub && !m.inside && wg.freeByMap.get(m.tag)?.length);
    const cx = maps.reduce((t, m) => t + m.x, 0) / (maps.length || 1), cy = maps.reduce((t, m) => t + m.y, 0) / (maps.length || 1);
    const m = maps.sort((a, b) => (a.x - cx) ** 2 + (a.y - cy) ** 2 - (b.x - cx) ** 2 - (b.y - cy) ** 2)[0];
    const q = m ? this.w.openestCellOf(m.tag) : { x: 0, y: 0 };
    this.centres.set(sub, q);
    return q;
  }
  /** 7B : ouvre le coffre d'invasion pour le joueur qui agit, contre des Éclats Obscurs. */
  ouvrirCoffreInvasion(p: Player): boolean {
    const w = this.w, inv = this.invasion, C = INV.coffre;
    if (!inv?.coffre) return false;
    if ((p.resources[INV.eclat] ?? 0) < C.prix) {
      w.emit({ k: 'status', x: inv.coffre.x, y: inv.coffre.y - 80, text: `Il faut ${C.prix} Éclats Obscurs`, color: '#c9c4ab' });
      return false;
    }
    p.resources[INV.eclat] -= C.prix;
    if (p.resources[INV.eclat] <= 0) delete p.resources[INV.eclat];
    const niveau = w.niveauEn(inv.coffre.x, inv.coffre.y);
    w.butinMonstre(p, '', 'elite', niveau, inv.coffre.x, inv.coffre.y, C.tirages, { rarete: w.rng.next() < C.epique ? 'epique' : 'rare', legendaire: 0 });
    w.emit({ k: 'invasionCoffre', nom: inv.nom, x: inv.coffre.x, y: inv.coffre.y });
    w.commeJoueur(p, () => { w.gagnerApparat('invasion', APPARATS_SOURCES.chances.monde.invasion); w.familierInvasion(inv.coffre!.x, inv.coffre!.y); });   // « Apparats : » 1E, « Familiers : » 1C
    return true;
  }

  // === Petits événements (8A, 8B) ================================================================================================
  private updateEvenements(dt: number) {
    const w = this.w;
    for (const p of w.players) {
      let t = this.evtT.get(p.id);
      if (t == null) { t = w.rng.range(EVT.intervalle[0], EVT.intervalle[1]); this.evtT.set(p.id, t); }
      if (p.dead || w.arene || this.evenements.some(e => !e.fin)) continue;
      t -= dt;
      if (t <= 0) { t = w.commeJoueur(p, () => this.lancerEvenement(p)) ? w.rng.range(EVT.intervalle[0], EVT.intervalle[1]) : 20; }
      this.evtT.set(p.id, t);
    }
    for (const e of this.evenements) this.updateEvenement(e, dt);
    this.evenements = this.evenements.filter(e => !e.fin || e.finT > 0 || e.monstres.some(m => !m.dead));
  }
  /** Lance un petit événement près de p, dehors, dans une sous-zone qui a des monstres (pas pendant un boss du monde tout près). */
  lancerEvenement(p: Player, sorte?: SorteEvenement): boolean {
    const w = this.w, wg = w.worldGrid;
    const carte = wg?.mapAt(p.x, p.y);
    if (!wg || !carte || carte.inside || w.donjonIci()) return false;
    const sub = w.zone.open?.subareas[String(carte.sub)];
    if (!sub?.monsters.length || !sub.groupsPerMap) return false;
    const b = this.boss;
    if (b?.pose && !b.fin && Math.hypot(b.centre.x - p.x, b.centre.y - p.y) < 2000) return false;
    // un point libre sur la même sous-zone, à quelques pas devant
    let pt: Pt | null = null;
    const a0 = w.rng.range(0, Math.PI * 2);
    for (let k = 0; k < 12 && !pt; k++) {
      const a = a0 + k * 0.52, d = w.rng.range(EVT.distance[0], EVT.distance[1]);
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d * 0.6, m = wg.mapAt(x, y);
      if (!m || m.inside || m.sub !== carte.sub || !w.walkable(x, y)) continue;
      if (w.quetes?.pnjs.some(n => Math.hypot(n.x - x, n.y - y) < 300)) continue;
      pt = { x, y };
    }
    if (!pt) return false;
    const so: SorteEvenement = sorte ?? (w.rng.next() < 0.5 ? 'defense' : 'coffre');
    const niveau = w.niveauEn(pt.x, pt.y);
    const e: Evenement = { id: w.nextIdPublic(), sorte: so, sub: carte.sub, nom: sub.name, niveau, x: pt.x, y: pt.y, t: 0, vague: 0, pv: 100,
      monstres: [], arrivees: [], fin: null, finT: 0, loinT: 0 };
    if (so === 'defense') {
      const H = w.habitantsEvenement();
      if (!H.length) return false;
      const h = w.rng.pick(H); e.habitant = { id: h.id, nom: h.nom };
    } else {
      // 8B : l'élite de la sous-zone (ou un monstre de la zone) et ses gardes autour du coffre
      const chef = sub.elite && w.opts.data.monsters[sub.elite] ? sub.elite : w.rng.pick(sub.monsters);
      const types = [chef, ...Array.from({ length: EVT.coffre.gardes }, () => w.rng.pick(sub.monsters))];
      types.forEach((type, i) => {
        const a = (i / types.length) * Math.PI * 2, q = w.map.nearestFree(pt!.x + Math.cos(a) * 70, pt!.y + Math.sin(a) * 45);
        const m = w.spawnMonster(type, q.x, q.y, i === 0 && !w.opts.data.monsters[type].elite ? { ...w.opts.data.monsters[type], elite: true, hp: w.opts.data.monsters[type].hp * 3 } : undefined);
        m.evenement = e.id; m.state = 'idle';
        e.monstres.push(m);
      });
      e.vague = 1;
    }
    this.evenements.push(e);
    w.emit({ k: 'evenementDebut', id: e.id, sorte: so, nom: so === 'defense' ? `${e.habitant!.nom} attaqué !` : 'Coffre gardé', lieu: sub.name, x: e.x, y: e.y });
    return true;
  }
  private vague(e: Evenement, n: number) {
    const w = this.w, sub = w.zone.open!.subareas[String(e.sub)] as SubAreaDef;
    n += Math.max(0, w.players.length - 1);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + w.rng.range(0, 0.5), q = w.map.nearestFree(e.x + Math.cos(a) * 330, e.y + Math.sin(a) * 200);
      e.arrivees.push({ type: w.rng.pick(sub.monsters), x: q.x, y: q.y, t: 1 + i * 0.25, evt: e.id });
    }
  }
  private updateEvenement(e: Evenement, dt: number) {
    const w = this.w;
    if (e.fin) { e.finT -= dt; return; }
    e.t += dt;
    for (const a of e.arrivees) {
      a.t -= dt;
      if (a.t <= 1) w.telegraphs.push({ kind: 'circle', x: a.x, y: a.y, r: 40, progress: 1 - Math.max(0, a.t), danger: true });
      if (a.t <= 0) { const m = w.spawnMonster(a.type, a.x, a.y); m.evenement = e.id; m.arene = true; m.state = 'chase'; e.monstres.push(m); }
    }
    e.arrivees = e.arrivees.filter(a => a.t > 0);
    // abandon : plus personne autour depuis 20 s
    const pres = w.players.some(p => Math.abs(p.x - e.x) + Math.abs(p.y - e.y) <= EVT.abandon);
    e.loinT = pres ? 0 : e.loinT + dt;
    if (e.loinT > 20) { this.finir(e, 'abandon'); return; }
    const vivants = e.monstres.filter(m => !m.dead);
    if (e.sorte === 'defense') {
      const D = EVT.defense;
      while (e.vague < D.vagues.length && e.t >= D.vagues[e.vague]) { this.vague(e, w.rng.int(D.taille[1] - D.taille[0] + 1) + D.taille[0]); e.vague++; }
      if (e.pv <= 0) { this.finir(e, 'rate'); return; }
      if (e.t >= D.duree) this.finir(e, 'reussi');
      return;
    }
    // coffre gardé : les gardes, puis deux vagues
    if (vivants.length || e.arrivees.length) return;
    const V = EVT.coffre.vagues;
    if (e.vague <= V.length) { this.vague(e, V[e.vague - 1]); e.vague++; return; }
    this.finir(e, 'reussi');
  }
  /** 8A : l'envahisseur d'une défense court vers l'habitant (sauf si un joueur l'occupe) et le frappe au contact. */
  piloter(m: Monster, dt: number): boolean {
    const e = this.evenements.find(x => x.id === m.evenement);
    if (!e || e.fin || e.sorte !== 'defense' || m.dead || m.state === 'spawn') return false;
    const w = this.w;
    if (m.hp < m.maxHp || w.players.some(q => !q.dead && Math.hypot(q.x - m.x, q.y - m.y) < 110)) return false;
    if (Math.hypot(e.x - m.x, e.y - m.y) > 46) { m.allerVers(e.x, e.y, dt, w, 1); return true; }
    m.setAnim('idle');
    e.pv = Math.max(0, e.pv - EVT.defense.pvParSeconde * dt);
    return true;
  }
  private finir(e: Evenement, fin: 'reussi' | 'rate' | 'abandon') {
    const w = this.w;
    e.fin = fin; e.finT = 3; e.arrivees = [];
    if (fin !== 'rate') for (const m of e.monstres) if (!m.dead && (fin === 'abandon' || e.sorte === 'defense')) { m.dead = true; m.t = 0.6; }
    if (fin === 'abandon') { e.finT = 0; return; }
    if (fin === 'reussi') {
      const n = e.sorte === 'defense' ? EVT.defense.tirages : EVT.coffre.tirages;
      for (const q of w.joueursProches(e.x, e.y)) {
        q.vivant.evenements++;
        w.commeJoueur(q, () => {
          w.butinMonstre(q, '', 'elite', e.niveau, e.x, e.y, n, e.sorte === 'coffre' ? { rarete: 'rare', legendaire: 0 } : undefined);
          w.emit({ k: 'evenementFin', id: e.id, sorte: e.sorte, reussi: true, nom: e.sorte === 'defense' ? `${e.habitant!.nom} est sauf` : 'Coffre ouvert' });
        });
      }
      return;
    }
    w.emit({ k: 'evenementFin', id: e.id, sorte: e.sorte, reussi: false, nom: `${e.habitant?.nom ?? 'L\'habitant'} s'est enfui` });
  }
}

/** World.POSE et World.RETRAIT, sans importer World (dépendance circulaire). */
const World_POSE = 4000, World_RETRAIT = 5200;
