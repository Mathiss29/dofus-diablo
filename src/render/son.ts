import SONS from '../data/sons.json';
import { v } from './assetUrl';

/** Musique et sons (maquette « Son », choix de Mathis du 2026-11-06 : 1A+1B 2A+2B 3A+3B 4A+4B 5A 6A+6B 7A+7B 8A+8B+8C+8D).
 *  Tous les sons sont les fichiers officiels de Dofus 3 (tools/extraction/sons.py -> public/assets/son, src/data/sons.json).
 *  Affichage seulement : la partie (src/sim) n'en sait rien, ZoneScene lit l'état et les événements et appelle ce module.
 *
 *  - Musique : celle du menu sur l'accueil et le premier chargement, puis les musiques d'Incarnam en alternance avec un
 *    silence de 20 à 40 s entre deux morceaux. Chaque musique a une piste calme et une piste « renfort » (les autres pistes
 *    officielles mélangées) qui monte quand des monstres nous attaquent (3A). Contre un boss (plus les élites depuis le 2026-11-08) : musique de combat
 *    officielle (intro puis boucle), jingle de victoire ou de défaite (3B). Maquette « Musique élites » (Mathis, 2026-11-08) : fondu
 *    croisé de 1,5 s avec les pistes de combat chargées à l'avance (4A), boucle collée à l'intro (5A), jingle en fondu (6B) et
 *    morceau d'exploration mis de côté pendant le combat, qui reprend là où il en était (6A).
 *  - Effets : son de l'animation du lanceur (même numéro que l'animation : AnimAttaque801), son de l'effet du sort (gfx),
 *    impacts, cris des monstres sur leur bus (maquette Sons : 2 par sorte, volume qui baisse avec le nombre, hauteur variée,
 *    compresseur doux), interface.
 *  - Ambiance : fond de la zone en boucle, et sons du décor (eau, feu, Zaap) d'autant plus forts qu'on s'en approche.
 *  Les musiques et les boucles passent par des balises <audio> (lues en flux, peu de mémoire), les sons courts par des
 *  tampons Web Audio. */

export type Bus = 'musique' | 'effets' | 'monstres' | 'ambiance' | 'interface';
export interface Volumes { general: number; musique: number; effets: number; monstres: number; ambiance: number; interface: number; muet: boolean;
  /** Maquette « Musique boss » 8A : réglage Oui/Non de la musique de combat des boss. */
  musiqueBoss: boolean }
type Manifest = {
  musiques: Record<string, string | { calme: string; renfort?: string; couches?: Record<string, string> } | { pistes: string[] }>;
  /** Musique officielle de chaque boss (maquette « Musique boss » 7B) : clé de `musiques` dont les pistes s'ajoutent avec ses PV perdus. */
  boss?: Record<string, string>;
  ambiances: Record<string, string>; ui: Record<string, string>;
  sorts: Record<string, Record<string, string>>; gfx: Record<string, string[]>;
  monstres: Record<string, { attaque: string[]; hit: string[]; mort: string[] }>; impacts: string[];
  /** Départ par un Zaap (AMB_Interactive_Teleport_Start, maquette « Zaap : » 9A). */
  teleport?: string[];
  /** Pièces qui tombent (AMB_Loc_CoinDrop) : kamas au sol et ramassés. */
  kamas?: string[];
  /** Coups des animations de récolte (maquette Armes 9A) : par geste officiel (AnimFaucher, AnimHache…). */
  recolte?: Record<string, string[]>;
};
export const MANIFESTE = SONS as Manifest;
const DOSSIER = 'assets/son/';

// ---------- calculs purs (testés dans tests/son.test.ts) ----------

/** Force d'un son selon la distance à l'écran (pixels) : plein jusqu'à `pres`, nul à `loin`. */
export function gainDistance(d: number, pres = 260, loin = 1300) {
  if (d <= pres) return 1;
  if (d >= loin) return 0;
  const k = 1 - (d - pres) / (loin - pres);
  return k * k;
}
/** Regroupe des points proches (sons du décor : 58 « courants » sur le lac deviennent quelques sources). */
export function regrouper(pts: { x: number; y: number }[], rayon: number) {
  const out: { x: number; y: number; n: number }[] = [];
  for (const p of pts) {
    const g = out.find(o => Math.hypot(o.x - p.x, o.y - p.y) < rayon);
    if (g) { g.x = (g.x * g.n + p.x) / (g.n + 1); g.y = (g.y * g.n + p.y) / (g.n + 1); g.n++; }
    else out.push({ x: p.x, y: p.y, n: 1 });
  }
  return out;
}
/** Musique de boss en couches (7B) : une piste de plus à chaque quart de PV perdu (4 pistes -> paliers 0 à 3). */
/** Groupes 4A (2026-11-09) : les monstres baissent de 1 dB par attaquant au-delà de 3, jusqu'à −6 dB. */
export function gainPack(attaquants: number) { return Math.pow(10, -Math.min(6, Math.max(0, attaquants - 3)) / 20); }
/** Groupes 1A : au plus 3 sons de monstres pour tout l'écran (cris et sorts), et un nouveau cri toutes les 0,3 s au plus. */
export const VOIX_MONSTRES = 3, ECART_CRIS = 0.3;
/** Groupes 3C : la traîne d'un sort de monstre part en fondu après 0,6 s. */
export const TRAINE_SORT_MONSTRE = 0.6;
/** Groupes 4B : quand on lance un sort, les monstres baissent de 40 % pendant 0,3 s. */
export const ESQUIVE = { gain: 0.6, duree: 0.3 };

export function palierBoss(hp: number, maxHp: number, pistes = 4) {
  if (maxHp <= 0) return 0;
  const perdu = Math.max(0, Math.min(1, 1 - hp / maxHp));
  return Math.min(pistes - 1, Math.floor(perdu * pistes));
}
/** Morceau suivant de la liste : jamais deux fois le même d'affilée. */
export function suivante(liste: string[], derniere: string | null, r: number) {
  const choix = liste.length > 1 ? liste.filter(m => m !== derniere) : liste;
  return choix[Math.min(choix.length - 1, Math.floor(r * choix.length))];
}
/** Décor qui sonne, d'après le nom des systèmes de particules officiels de la carte. */
export function sonDuDecor(nomParticules: string): string | null {
  if (/^(Feu|Braises)$/.test(nomParticules)) return 'feu';
  if (nomParticules === 'Cascade') return 'cascade';
  if (nomParticules === 'Courant') return 'courant';
  if (/^(Vortex|Ondes1|Warp4)$/.test(nomParticules)) return 'zaap';
  return null;
}

// ---------- lecture ----------

/** Une boucle ou un morceau lu en flux, branché sur un bus. */
class Flux {
  readonly el: HTMLAudioElement;
  readonly gain: GainNode;
  private src: MediaElementAudioSourceNode;
  constructor(ctx: AudioContext, url: string, bus: AudioNode, boucle: boolean, vol = 0) {
    this.el = new Audio(); this.el.crossOrigin = 'anonymous'; this.el.src = v(DOSSIER + url);
    this.el.loop = boucle; this.el.preload = 'auto';
    this.src = ctx.createMediaElementSource(this.el);
    this.gain = ctx.createGain(); this.gain.gain.value = vol;
    this.src.connect(this.gain).connect(bus);
  }
  vers(ctx: AudioContext, vol: number, duree: number) {
    const g = this.gain.gain, t = ctx.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(vol, t + Math.max(0.01, duree));
  }
  jouer() { this.el.play().catch(() => { /* pas encore de geste du joueur : on réessaiera */ }); }
  arreter() { this.el.pause(); this.src.disconnect(); this.gain.disconnect(); this.el.removeAttribute('src'); this.el.load(); }
}

type EtatMusique =
  | { k: 'rien' }
  | { k: 'menu'; f: Flux }
  | { k: 'explo'; calme: Flux; renfort: Flux | null; nom: string; couches?: { n: string; f: Flux }[] }
  | { k: 'silence'; reste: number }
  | { k: 'combat'; f: Flux; boucle: Flux | null; suite: boolean; couches: Flux[] }
  | { k: 'jingle'; f: Flux };

class Moteur {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private bus = {} as Record<Bus, GainNode>;
  private vol: Volumes = { general: 1, musique: 0.5, effets: 0.7, monstres: 0.5, ambiance: 0.6, interface: 0.7, muet: false, musiqueBoss: true };
  private cache = new Map<string, AudioBuffer | null | Promise<AudioBuffer | null>>();
  /** Ce que la musique doit jouer : le menu, la liste d'une zone, ou rien. */
  private voulu: 'menu' | 'zone' | 'rien' = 'rien';
  private liste: string[] = [];
  private etat: EtatMusique = { k: 'rien' };
  private derniere: string | null = null;
  private intensite = 0;
  private combatVoulu = false;
  /** Musique du combat en cours ou à venir : celle du boss (7B), sinon la musique de combat de la zone (7A). */
  private combatCle: string | null = null;
  private prevu: string | null = null;
  /** Musique de combat de la zone : Incarnam, ou Amakna à Astrub (7A). */
  private combatZone: 'incarnam' | 'amakna' = 'incarnam';
  /** Couches de la musique du boss à jouer (palierBoss). */
  private palier = 0;
  private anciens: Flux[] = [];
  /** Morceau d'exploration mis de côté pendant un combat de boss (6A) : il reprend là où il en était. */
  private misDeCote: { calme: Flux; renfort: Flux | null; nom: string; pause: ReturnType<typeof setTimeout> | null } | null = null;
  /** Intro et boucle de combat chargées à l'avance (4A) : pas de blanc quand un boss arrive. */
  private pret: { cle: string; intro: Flux; boucle: Flux | null; couches: Flux[] } | null = null;
  private fonds = new Map<string, Flux>();
  private decor = new Map<string, { f: Flux | null; muet: number }>();
  /** Cris de monstres en cours (maquette Sons 1A : au plus 2 par type ; le plus faible, donc le plus loin, cède sa place). */
  private voix: { src: AudioBufferSourceNode; type: string; vol: number }[] = [];
  /** Groupes 4A + 4B : gain du mixage automatique des monstres (taille du pack, nos sorts devant). */
  private mixMonstres!: GainNode;
  private pack = 1;
  private mixVise = 1;
  private esquiveFin = 0;
  /** Groupes 7B : dernier son de chaque sort du joueur, coupé en fondu quand le même sort repart. */
  private seuls = new Map<string, { src: AudioBufferSourceNode; g: GainNode }>();
  /** Dernier fichier tiré dans chaque liste (Sons 4B : jamais deux fois de suite le même). */
  private tires = new WeakMap<string[], string>();
  private derniers = new Map<string, number>();
  private cache_visible = false;

  /** Crée le contexte audio ; il démarre au premier clic ou à la première touche (règle des navigateurs). */
  demarrer() {
    if (this.ctx || typeof window === 'undefined' || !window.AudioContext) return;
    const ctx = this.ctx = new AudioContext();
    this.master = ctx.createGain(); this.master.connect(ctx.destination);
    for (const b of ['musique', 'effets', 'monstres', 'ambiance', 'interface'] as Bus[]) { this.bus[b] = ctx.createGain(); this.bus[b].connect(this.master); }
    // Sons 5A : compresseur doux sur les monstres, il ne touche pas un cri seul et retient les pics d'un gros groupe ;
    // Groupes 4A/4B : mixage automatique juste avant ; Groupes 7A : le même compresseur doux sur nos sorts (bus des effets)
    const doux = () => {
      const c = ctx.createDynamicsCompressor();
      c.threshold.value = -18; c.knee.value = 12; c.ratio.value = 4; c.attack.value = 0.005; c.release.value = 0.15;
      c.connect(this.master); return c;
    };
    this.mixMonstres = ctx.createGain();
    this.bus.monstres.disconnect(); this.bus.monstres.connect(this.mixMonstres); this.mixMonstres.connect(doux());
    this.bus.effets.disconnect(); this.bus.effets.connect(doux());
    this.appliquerVolumes();
    const reveil = () => {
      if (ctx.state !== 'running') ctx.resume().catch(() => {});
      this.relancer();
    };
    window.addEventListener('pointerdown', reveil, true);
    window.addEventListener('keydown', reveil, true);
    // 8C : musique et ambiance baissées quand l'onglet n'est plus affiché
    document.addEventListener('visibilitychange', () => { this.cache_visible = document.hidden; this.appliquerVolumes(); });
  }
  /** Relance les flux bloqués avant le premier geste du joueur. */
  private relancer() {
    const e = this.etat;
    const fl = e.k === 'menu' || e.k === 'combat' || e.k === 'jingle' ? [e.f] : e.k === 'explo' ? [e.calme, e.renfort, ...(e.couches ?? []).map(x => x.f)] : [];
    for (const f of [...fl, ...this.fonds.values()]) if (f?.el.paused) f.jouer();
  }

  volumes(v: Partial<Volumes>) { Object.assign(this.vol, v); this.appliquerVolumes(); }
  get muet() { return this.vol.muet; }
  private appliquerVolumes() {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime, V = this.vol, bas = this.cache_visible ? 0.2 : 1;
    this.master.gain.setTargetAtTime(V.muet ? 0 : V.general, t, 0.05);
    this.bus.musique.gain.setTargetAtTime(V.musique * bas, t, 0.1);
    this.bus.ambiance.gain.setTargetAtTime(V.ambiance * bas, t, 0.1);
    this.bus.effets.gain.setTargetAtTime(V.effets, t, 0.05);
    this.bus.monstres.gain.setTargetAtTime(V.monstres, t, 0.05);
    this.bus.interface.gain.setTargetAtTime(V.interface, t, 0.05);
  }

  // ----- musique -----
  /** Accueil et premier chargement (1A). */
  menu() { this.voulu = 'menu'; this.combatVoulu = false; this.oublierExplo(); }
  /** Musique d'une zone : liste de morceaux joués en alternance (2A + 2B). */
  zone(liste: string[], combat: 'incarnam' | 'amakna' = 'incarnam') {
    this.voulu = liste.length ? 'zone' : 'rien'; this.liste = liste; this.combatZone = combat;
    if (this.misDeCote && !liste.includes(this.misDeCote.nom)) this.oublierExplo();
  }
  /** 0 = on explore, 1 = des monstres nous attaquent (3A). */
  setIntensite(i: number) { this.intensite = i; }
  private poidsCouches: Record<string, number> = {};
  /** Volume (0 à 1) de chaque couche de la musique en cours (Bastion : une couche par nation, selon l'île la plus proche). */
  setCouches(p: Record<string, number>) { this.poidsCouches = p; }
  /** Un boss se bat contre nous (3B) ; musique = sa musique de boss (sons.json « boss »), sinon celle de la zone. */
  setCombat(on: boolean, musique: string | null = null) { this.combatVoulu = on; if (on) this.combatCle = musique; }
  /** Couches de la musique du boss (7B) : 0 = la base, 3 = toutes les pistes. */
  setPalier(n: number) { this.palier = n; }
  /** Boss présent dans les parages (ou attendu dans l'arène) : sa musique est chargée à l'avance (4A). */
  prevoir(musique: string | null) { this.prevu = musique; }
  /** Fin du combat contre le boss : jingle de victoire ou de défaite, puis l'exploration reprend. */
  finCombat(victoire: boolean) {
    const jouait = this.etat.k === 'combat';
    this.combatVoulu = false;
    if (!this.ctx || !jouait) return;   // 8A : musique des boss coupée, pas de jingle non plus
    // 6B : le combat s'efface en 1 s sous le jingle, qui monte en 0,3 s
    this.lacher(1);
    const f = new Flux(this.ctx, MANIFESTE.musiques[`${this.prefixe()}${victoire ? 'victoire' : 'defaite'}`] as string, this.bus.musique, false, 0);
    f.vers(this.ctx, 1, 0.3); f.jouer(); this.etat = { k: 'jingle', f };
  }
  /** Après le combat : le morceau mis de côté reprend en fondu de 3 s (6A), sinon un court silence puis le morceau suivant. */
  private apresCombat() {
    const m = this.misDeCote, c = this.ctx!;
    this.misDeCote = null;
    if (!m || m.calme.el.ended) { if (m) { m.calme.arreter(); m.renfort?.arreter(); } this.etat = { k: 'silence', reste: 3 }; return; }
    if (m.pause) clearTimeout(m.pause);
    m.calme.jouer(); m.renfort?.jouer();
    m.calme.vers(c, 1, 3);
    m.renfort?.vers(c, this.intensite, 3);
    this.etat = { k: 'explo', calme: m.calme, renfort: m.renfort, nom: m.nom };
  }
  private oublierExplo() {
    const m = this.misDeCote; if (!m) return;
    if (m.pause) clearTimeout(m.pause);
    m.calme.arreter(); m.renfort?.arreter();
    this.misDeCote = null;
  }
  private lacher(duree: number) {
    const e = this.etat, c = this.ctx!;
    const fl = e.k === 'menu' || e.k === 'jingle' ? [e.f] : e.k === 'combat' ? [e.f, e.boucle, ...e.couches] : e.k === 'explo' ? [e.calme, e.renfort, ...(e.couches ?? []).map(x => x.f)] : [];
    for (const f of fl) if (f) { f.vers(c, 0, duree); this.anciens.push(f); setTimeout(() => { f.arreter(); this.anciens = this.anciens.filter(x => x !== f); }, duree * 1000 + 100); }
    this.etat = { k: 'rien' };
  }
  private piste(nom: string): { calme: string; renfort?: string; couches?: Record<string, string> } {
    const m = MANIFESTE.musiques[nom];
    return typeof m === 'string' ? { calme: m } : 'pistes' in m ? { calme: m.pistes[0] } : m;
  }
  /** 7A : fichiers de la musique de combat de la zone (combat_… à Incarnam, combat_amakna_… à Astrub). */
  private prefixe() { return this.combatZone === 'amakna' && MANIFESTE.musiques.combat_amakna_intro ? 'combat_amakna_' : 'combat_'; }
  /** Clé de la musique de combat voulue : celle du boss si elle existe, sinon « zone:<préfixe> ». */
  private cleCombat(musique: string | null) {
    const m = musique ? MANIFESTE.musiques[musique] : undefined;
    return m && typeof m === 'object' && 'pistes' in m ? musique! : `zone:${this.prefixe()}`;
  }

  /** À chaque image : enchaîne les morceaux, fait monter ou descendre les pistes, place les sons du décor. */
  update(dt: number) {
    const c = this.ctx; if (!c) return;
    const e = this.etat;
    // menu voulu
    if (this.voulu === 'menu') {
      if (e.k !== 'menu') { this.lacher(1.5); const f = new Flux(c, MANIFESTE.musiques.menu as string, this.bus.musique, true); f.vers(c, 1, 1.5); f.jouer(); this.etat = { k: 'menu', f }; }
      return;
    }
    if (this.voulu === 'rien') { if (e.k !== 'rien') this.lacher(1.5); this.oublierExplo(); return; }
    // zone
    if (e.k === 'menu') { this.lacher(2.5); this.etat = { k: 'silence', reste: 2 }; return; }
    const combat = this.combatVoulu && this.vol.musiqueBoss;
    if (combat && e.k !== 'combat') {
      // 4A + 6A : l'exploration descend en 1,5 s et se met en pause (on la reprendra), le combat monte en même temps
      if (e.k === 'explo') {
        for (const x of e.couches ?? []) { x.f.vers(c, 0, 1.5); setTimeout(() => x.f.arreter(), 1600); }   // couches du Bastion : lâchées
        const m = { calme: e.calme, renfort: e.renfort, nom: e.nom, pause: null as ReturnType<typeof setTimeout> | null };
        e.calme.vers(c, 0, 1.5); e.renfort?.vers(c, 0, 1.5);
        m.pause = setTimeout(() => { m.pause = null; if (this.misDeCote === m) { m.calme.el.pause(); m.renfort?.el.pause(); } }, 1600);
        this.oublierExplo(); this.misDeCote = m; this.etat = { k: 'rien' };
      } else this.lacher(1.5);
      const cle = this.cleCombat(this.combatCle);
      if (this.pret && this.pret.cle !== cle) this.jeterPret();
      const p = this.pret ?? this.chargerCombat(cle); this.pret = null;
      p.intro.vers(c, 1, 1.5); p.intro.jouer();
      // 7B : toutes les couches partent ensemble (calées), seules celles du palier montent
      for (const [i, f] of p.couches.entries()) { f.jouer(); f.vers(c, this.palier > i ? 1 : 0, 1.5); }
      this.etat = { k: 'combat', f: p.intro, boucle: p.boucle, suite: false, couches: p.couches }; return;
    }
    // 4A : musique de combat (celle du boss attendu, sinon celle de la zone) prête avant qu'un boss n'arrive
    if (e.k !== 'combat') {
      const cle = this.cleCombat(this.prevu);
      if (this.pret && this.pret.cle !== cle) this.jeterPret();
      if (!this.pret) this.pret = this.chargerCombat(cle);
    }
    switch (e.k) {
      case 'rien': this.etat = { k: 'silence', reste: 1 }; break;
      case 'silence':
        // des monstres nous attaquent pendant le silence : la musique revient tout de suite
        e.reste -= this.intensite > 0.5 ? dt * 8 : dt;
        if (e.reste <= 0) this.lancerMorceau();
        break;
      case 'explo': {
        if (e.calme.el.ended) { this.lacher(0.5); this.etat = { k: 'silence', reste: 20 + Math.random() * 20 }; break; }
        if (e.renfort) {
          const cible = this.intensite, g = e.renfort.gain.gain.value;
          if (Math.abs(g - cible) > 0.02) e.renfort.vers(c, cible, cible > g ? 2 : 5);
          // les deux pistes restent calées
          if (!e.calme.el.paused && Math.abs(e.renfort.el.currentTime - e.calme.el.currentTime) > 0.08) e.renfort.el.currentTime = e.calme.el.currentTime;
          if (e.renfort.el.paused && !e.calme.el.paused) e.renfort.jouer();
        }
        // Bastion (Ville 5F) : la couche de chaque nation monte quand on s'approche de son île, calée sur la piste de base
        for (const x of e.couches ?? []) {
          const cible = this.poidsCouches[x.n] ?? 0, g = x.f.gain.gain.value;
          if (Math.abs(g - cible) > 0.02) x.f.vers(c, cible, 3);
          if (!e.calme.el.paused && Math.abs(x.f.el.currentTime - e.calme.el.currentTime) > 0.08 && !x.f.el.ended) x.f.el.currentTime = e.calme.el.currentTime;
          if (x.f.el.paused && !x.f.el.ended && !e.calme.el.paused) x.f.jouer();
        }
        break;
      }
      case 'combat':
        if (!combat) { this.lacher(2); this.apresCombat(); break; }
        // 7B : couches du boss selon ses PV perdus, calées sur la piste de base
        for (const [i, f] of e.couches.entries()) {
          const cible = this.palier > i ? 1 : 0, g = f.gain.gain.value;
          if (Math.abs(g - cible) > 0.02) f.vers(c, cible, cible > g ? 1.5 : 4);
          if (!e.f.el.paused && Math.abs(f.el.currentTime - e.f.el.currentTime) > 0.08) f.el.currentTime = e.f.el.currentTime;
          if (f.el.paused && !e.f.el.paused) f.jouer();
        }
        // 5A : la boucle (déjà chargée) démarre pile à la fin de l'intro, sans blanc
        if (e.boucle && !e.suite) {
          const reste = e.f.el.duration - e.f.el.currentTime;
          if (e.f.el.ended || (isFinite(reste) && reste < 0.4 && !e.f.el.paused)) {
            e.suite = true;
            const b = e.boucle;
            setTimeout(() => { b.vers(c, 1, 0.01); b.jouer(); }, Math.max(0, (e.f.el.ended ? 0 : reste - 0.02) * 1000));
          }
        }
        if (e.boucle && e.suite && e.f.el.ended) { e.f.arreter(); this.etat = { k: 'combat', f: e.boucle, boucle: null, suite: true, couches: e.couches }; }
        break;
      case 'jingle':
        if (e.f.el.ended) { e.f.arreter(); this.apresCombat(); }
        break;
    }
  }
  private chargerCombat(cle: string) {
    const c = this.ctx!, M = MANIFESTE.musiques, b = this.bus.musique;
    if (cle.startsWith('zone:')) {
      const z = cle.slice(5);
      return { cle, intro: new Flux(c, M[`${z}intro`] as string, b, false), boucle: new Flux(c, M[`${z}centrale`] as string, b, true), couches: [] };
    }
    // 7B : musique de boss en boucle, piste de base + couches
    const [base, ...autres] = (M[cle] as { pistes: string[] }).pistes;
    return { cle, intro: new Flux(c, base, b, true), boucle: null, couches: autres.map(f => new Flux(c, f, b, true)) };
  }
  private jeterPret() {
    const p = this.pret; if (!p) return;
    for (const f of [p.intro, p.boucle, ...p.couches]) f?.arreter();
    this.pret = null;
  }
  private lancerMorceau() {
    const c = this.ctx!, nom = suivante(this.liste, this.derniere, Math.random());
    this.derniere = nom;
    const p = this.piste(nom);
    const calme = new Flux(c, p.calme, this.bus.musique, false);
    const renfort = p.renfort ? new Flux(c, p.renfort, this.bus.musique, false, this.intensite) : null;
    const couches = Object.entries(p.couches ?? {}).map(([n, u]) => ({ n, f: new Flux(c, u, this.bus.musique, false, this.poidsCouches[n] ?? 0) }));
    calme.vers(c, 1, 2);
    calme.jouer(); renfort?.jouer(); for (const x of couches) x.f.jouer();
    this.etat = { k: 'explo', calme, renfort, nom, couches };
  }

  // ----- ambiance (7A) et décor (7B) -----
  /** Fonds d'ambiance de l'endroit (en boucle, fondu de 2 s entre deux endroits). */
  fond(noms: string[]) {
    const c = this.ctx; if (!c) return;
    for (const [n, f] of this.fonds) if (!noms.includes(n)) { f.vers(c, 0, 2); this.fonds.delete(n); setTimeout(() => f.arreter(), 2200); }
    for (const n of noms) if (!this.fonds.has(n) && MANIFESTE.ambiances[n]) {
      const f = new Flux(c, MANIFESTE.ambiances[n], this.bus.ambiance, true); f.vers(c, 1, 2); f.jouer(); this.fonds.set(n, f);
    }
  }
  /** Sons du décor : pour chaque sorte (eau, feu…), la source la plus proche du joueur règle le volume de sa boucle. */
  decorProche(proches: Record<string, number>, dt: number) {
    const c = this.ctx; if (!c) return;
    for (const k of new Set([...Object.keys(proches), ...this.decor.keys()])) {
      const g = gainDistance(proches[k] ?? Infinity, 200, 1100) * 0.8;
      let d = this.decor.get(k);
      if (!d) { d = { f: null, muet: 0 }; this.decor.set(k, d); }
      if (g > 0.01) {
        if (!d.f && MANIFESTE.ambiances[k]) { d.f = new Flux(c, MANIFESTE.ambiances[k], this.bus.ambiance, true); d.f.jouer(); }
        d.f?.vers(c, g, 0.25); d.muet = 0;
      } else if (d.f) {
        d.f.vers(c, 0, 0.25);
        if ((d.muet += dt) > 3) { d.f.arreter(); d.f = null; }
      }
    }
  }

  // ----- sons courts -----
  /** Charge des sons à l'avance (fichiers de sons.json), sans bloquer. */
  precharger(fichiers: string[]) { for (const f of fichiers) this.tampon(f); }
  private tampon(f: string): AudioBuffer | null {
    const c = this.ctx; if (!c) return null;
    const x = this.cache.get(f);
    if (x instanceof AudioBuffer) return x;
    if (x !== undefined) return null;
    const p = fetch(v(DOSSIER + f)).then(r => r.ok ? r.arrayBuffer() : Promise.reject())
      .then(b => c.decodeAudioData(b)).then(b => { this.cache.set(f, b); return b; }, () => { this.cache.set(f, null); return null; });
    this.cache.set(f, p);
    return null;
  }
  /** Groupes 4A : nombre de monstres qui nous attaquent (à chaque image). */
  setPack(n: number) { this.pack = gainPack(n); this.mixer(); }
  /** Groupes 4B : on lance un sort, les monstres s'effacent un instant. */
  esquive() { const c = this.ctx; if (!c) return; this.esquiveFin = c.currentTime + ESQUIVE.duree; this.mixer(); }
  private mixer() {
    const c = this.ctx; if (!c || !this.mixMonstres) return;
    const v = this.pack * (c.currentTime < this.esquiveFin ? ESQUIVE.gain : 1);
    if (Math.abs(this.mixVise - v) > 0.005) { this.mixVise = v; this.mixMonstres.gain.setTargetAtTime(v, c.currentTime, 0.04); }
  }
  /** Joue un son court. pan -1..1, offset = départ dans le fichier (s), cle = anti-répétition (au plus un toutes les `ecart` s).
   *  monstre = cri de monstre (type = sa sorte) : bus « monstres » et règles de la maquette Sons (2026-11-07).
   *  sansEcart = son de sort ou de mort d'un monstre (Groupes 3A : mêmes règles, sans l'écart entre deux cris) ; traine = fondu après tant de secondes (3C) ;
   *  seul = un seul son à la fois pour cette clé, le précédent part en fondu (7B). */
  jouer(f: string | undefined, bus: Bus, o: { vol?: number; pan?: number; offset?: number; vitesse?: number; cle?: string; ecart?: number; monstre?: boolean; type?: string; sansEcart?: boolean; traine?: number; seul?: string } = {}) {
    const c = this.ctx; if (!c || !f || c.state !== 'running' || this.vol.muet) return;
    if (o.cle) {
      const t = c.currentTime, d = this.derniers.get(o.cle) ?? -9;
      if (t - d < (o.ecart ?? 0.08)) return;
      this.derniers.set(o.cle, t);
    }
    const b = this.tampon(f); if (!b) return;
    let vol = o.vol ?? 1, vitesse = o.vitesse ?? 1, depart = 0;
    if (o.monstre) {
      const type = o.type ?? '?', t = c.currentTime;
      if (!o.sansEcart) {
        // Sons 3A : une même sorte de monstre ne crie pas plus d'une fois toutes les 0,25 s ; Groupes 1A : un nouveau cri toutes les 0,3 s au plus
        if (t - (this.derniers.get(`type:${type}`) ?? -9) < 0.25 || t - (this.derniers.get('cri') ?? -9) < ECART_CRIS) return;
      }
      // Groupes 1A : 3 sons de monstres au plus pour tout l'écran ; le plus faible (le plus loin) cède sa place au nouveau s'il est plus fort
      if (this.voix.length >= VOIX_MONSTRES) {
        const faible = this.voix.reduce((x, y) => x.vol < y.vol ? x : y);
        if (faible.vol >= vol) return;
        this.couper(faible);
      }
      if (!o.sansEcart) { this.derniers.set(`type:${type}`, t); this.derniers.set('cri', t); }
      vol /= Math.sqrt(1 + this.voix.length);   // 2A : plus il y a de cris en cours, plus le nouveau est bas
      vitesse *= 0.92 + Math.random() * 0.16;   // 4A : hauteur un peu variée (± 8 %)
      depart = Math.random() * 0.12;            // 3B : petit décalage, le groupe ne claque plus d'un coup
      bus = 'monstres';
    }
    const src = c.createBufferSource(); src.buffer = b; src.playbackRate.value = vitesse;
    const g = c.createGain(); g.gain.value = vol;
    const debut = c.currentTime + depart;
    if (o.traine && b.duration / vitesse > o.traine + 0.3) {   // Groupes 3C : on garde l'attaque, la queue part en fondu
      g.gain.setValueAtTime(vol, debut + o.traine); g.gain.linearRampToValueAtTime(0.0001, debut + o.traine + 0.25);
    }
    if (o.seul) {   // Groupes 7B : le même sort ne se superpose pas à lui-même
      const avant = this.seuls.get(o.seul);
      if (avant) { try { avant.g.gain.setTargetAtTime(0.0001, c.currentTime, 0.05); avant.src.stop(c.currentTime + 0.15); } catch { /* déjà fini */ } }
      const x = { src, g }; this.seuls.set(o.seul, x);
      src.addEventListener('ended', () => { if (this.seuls.get(o.seul!) === x) this.seuls.delete(o.seul!); });
    }
    let n: AudioNode = src.connect(g);
    if (o.pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); n = n.connect(p); }
    n.connect(this.bus[bus]);
    if (o.monstre) { const x = { src, type: o.type ?? '?', vol }; this.voix.push(x); src.addEventListener('ended', () => { this.voix = this.voix.filter(y => y !== x); }); }
    src.start(debut, Math.min(Math.max(0, o.offset ?? 0), Math.max(0, b.duration - 0.15)));
    if (o.traine && b.duration / vitesse > o.traine + 0.3) src.stop(debut + o.traine + 0.3);
  }
  private couper(x: { src: AudioBufferSourceNode }) { this.voix = this.voix.filter(y => y !== x); try { x.src.stop(); } catch { /* déjà fini */ } }
  /** Un son pris au hasard dans une liste, jamais deux fois de suite le même (Sons 4B). */
  auHasard(l: string[] | undefined) {
    if (!l?.length) return undefined;
    const avant = this.tires.get(l);
    let f = l[Math.floor(Math.random() * l.length)];
    if (l.length > 1) while (f === avant) f = l[Math.floor(Math.random() * l.length)];
    this.tires.set(l, f);
    return f;
  }
  /** Accès au contexte et au bus des effets pour les petits sons synthétisés (carillon du butin, jauge pleine). */
  synth(): { ctx: AudioContext; out: AudioNode } | null { return this.ctx && this.ctx.state === 'running' ? { ctx: this.ctx, out: this.bus.effets } : null; }
}

/** Le son du jeu : un seul pour toute la page (il survit aux relances de la scène). */
export const Son = new Moteur();
