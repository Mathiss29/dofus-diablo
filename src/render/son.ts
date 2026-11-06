import SONS from '../data/sons.json';
import { v } from './assetUrl';

/** Musique et sons (maquette « Son », choix de Mathis du 2026-11-06 : 1A+1B 2A+2B 3A+3B 4A+4B 5A 6A+6B 7A+7B 8A+8B+8C+8D).
 *  Tous les sons sont les fichiers officiels de Dofus 3 (tools/extraction/sons.py -> public/assets/son, src/data/sons.json).
 *  Affichage seulement : la partie (src/sim) n'en sait rien, ZoneScene lit l'état et les événements et appelle ce module.
 *
 *  - Musique : celle du menu sur l'accueil et le premier chargement, puis les musiques d'Incarnam en alternance avec un
 *    silence de 20 à 40 s entre deux morceaux. Chaque musique a une piste calme et une piste « renfort » (les autres pistes
 *    officielles mélangées) qui monte quand des monstres nous attaquent (3A). Contre un élite ou un boss : musique de combat
 *    officielle (intro puis boucle), jingle de victoire ou de défaite (3B).
 *  - Effets : son de l'animation du lanceur (même numéro que l'animation : AnimAttaque801), son de l'effet du sort (gfx),
 *    impacts, voix des monstres (au plus 6 à la fois), interface.
 *  - Ambiance : fond de la zone en boucle, et sons du décor (eau, feu, Zaap) d'autant plus forts qu'on s'en approche.
 *  Les musiques et les boucles passent par des balises <audio> (lues en flux, peu de mémoire), les sons courts par des
 *  tampons Web Audio. */

export type Bus = 'musique' | 'effets' | 'ambiance' | 'interface';
export interface Volumes { general: number; musique: number; effets: number; ambiance: number; interface: number; muet: boolean }
type Manifest = {
  musiques: Record<string, string | { calme: string; renfort?: string }>;
  ambiances: Record<string, string>; ui: Record<string, string>;
  sorts: Record<string, Record<string, string>>; gfx: Record<string, string[]>;
  monstres: Record<string, { attaque: string[]; hit: string[]; mort: string[] }>; impacts: string[];
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
    this.el = new Audio(v(DOSSIER + url));
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
  | { k: 'explo'; calme: Flux; renfort: Flux | null; nom: string }
  | { k: 'silence'; reste: number }
  | { k: 'combat'; f: Flux; boucle: boolean }
  | { k: 'jingle'; f: Flux };

class Moteur {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private bus = {} as Record<Bus, GainNode>;
  private vol: Volumes = { general: 1, musique: 0.5, effets: 0.7, ambiance: 0.6, interface: 0.7, muet: false };
  private cache = new Map<string, AudioBuffer | null | Promise<AudioBuffer | null>>();
  /** Ce que la musique doit jouer : le menu, la liste d'une zone, ou rien. */
  private voulu: 'menu' | 'zone' | 'rien' = 'rien';
  private liste: string[] = [];
  private etat: EtatMusique = { k: 'rien' };
  private derniere: string | null = null;
  private intensite = 0;
  private combatVoulu = false;
  private anciens: Flux[] = [];
  private fonds = new Map<string, Flux>();
  private decor = new Map<string, { f: Flux | null; muet: number }>();
  private voixMonstres = 0;
  private derniers = new Map<string, number>();
  private cache_visible = false;

  /** Crée le contexte audio ; il démarre au premier clic ou à la première touche (règle des navigateurs). */
  demarrer() {
    if (this.ctx || typeof window === 'undefined' || !window.AudioContext) return;
    const ctx = this.ctx = new AudioContext();
    this.master = ctx.createGain(); this.master.connect(ctx.destination);
    for (const b of ['musique', 'effets', 'ambiance', 'interface'] as Bus[]) { this.bus[b] = ctx.createGain(); this.bus[b].connect(this.master); }
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
    const fl = e.k === 'menu' || e.k === 'combat' || e.k === 'jingle' ? [e.f] : e.k === 'explo' ? [e.calme, e.renfort] : [];
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
    this.bus.interface.gain.setTargetAtTime(V.interface, t, 0.05);
  }

  // ----- musique -----
  /** Accueil et premier chargement (1A). */
  menu() { this.voulu = 'menu'; this.combatVoulu = false; }
  /** Musique d'une zone : liste de morceaux joués en alternance (2A + 2B). */
  zone(liste: string[]) { this.voulu = liste.length ? 'zone' : 'rien'; this.liste = liste; }
  /** 0 = on explore, 1 = des monstres nous attaquent (3A). */
  setIntensite(i: number) { this.intensite = i; }
  /** Un élite ou un boss se bat contre nous (3B). */
  setCombat(on: boolean) { this.combatVoulu = on; }
  /** Fin du combat contre l'élite : jingle de victoire ou de défaite, puis l'exploration reprend. */
  finCombat(victoire: boolean) {
    this.combatVoulu = false;
    if (!this.ctx) return;
    this.lacher(0.4);
    const f = new Flux(this.ctx, MANIFESTE.musiques[victoire ? 'combat_victoire' : 'combat_defaite'] as string, this.bus.musique, false, 1);
    f.jouer(); this.etat = { k: 'jingle', f };
  }
  private lacher(duree: number) {
    const e = this.etat, c = this.ctx!;
    const fl = e.k === 'menu' || e.k === 'combat' || e.k === 'jingle' ? [e.f] : e.k === 'explo' ? [e.calme, e.renfort] : [];
    for (const f of fl) if (f) { f.vers(c, 0, duree); this.anciens.push(f); setTimeout(() => { f.arreter(); this.anciens = this.anciens.filter(x => x !== f); }, duree * 1000 + 100); }
    this.etat = { k: 'rien' };
  }
  private piste(nom: string): { calme: string; renfort?: string } {
    const m = MANIFESTE.musiques[nom];
    return typeof m === 'string' ? { calme: m } : m;
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
    if (this.voulu === 'rien') { if (e.k !== 'rien') this.lacher(1.5); return; }
    // zone
    if (e.k === 'menu') { this.lacher(2.5); this.etat = { k: 'silence', reste: 2 }; return; }
    if (this.combatVoulu && e.k !== 'combat') {
      this.lacher(1.2);
      const f = new Flux(c, MANIFESTE.musiques.combat_intro as string, this.bus.musique, false, 1);
      f.jouer(); this.etat = { k: 'combat', f, boucle: false }; return;
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
        break;
      }
      case 'combat':
        if (!this.combatVoulu) { this.lacher(2); this.etat = { k: 'silence', reste: 3 }; break; }
        if (!e.boucle && e.f.el.ended) {
          e.f.arreter();
          const f = new Flux(c, MANIFESTE.musiques.combat_centrale as string, this.bus.musique, true, 1);
          f.jouer(); this.etat = { k: 'combat', f, boucle: true };
        }
        break;
      case 'jingle':
        if (e.f.el.ended) { e.f.arreter(); this.etat = { k: 'silence', reste: 3 }; }
        break;
    }
  }
  private lancerMorceau() {
    const c = this.ctx!, nom = suivante(this.liste, this.derniere, Math.random());
    this.derniere = nom;
    const p = this.piste(nom);
    const calme = new Flux(c, p.calme, this.bus.musique, false);
    const renfort = p.renfort ? new Flux(c, p.renfort, this.bus.musique, false, this.intensite) : null;
    calme.vers(c, 1, 2);
    calme.jouer(); renfort?.jouer();
    this.etat = { k: 'explo', calme, renfort, nom };
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
  /** Joue un son court. pan -1..1, offset = départ dans le fichier (s), cle = anti-répétition (au plus un toutes les `ecart` s). */
  jouer(f: string | undefined, bus: Bus, o: { vol?: number; pan?: number; offset?: number; vitesse?: number; cle?: string; ecart?: number; monstre?: boolean } = {}) {
    const c = this.ctx; if (!c || !f || c.state !== 'running' || this.vol.muet) return;
    if (o.cle) {
      const t = c.currentTime, d = this.derniers.get(o.cle) ?? -9;
      if (t - d < (o.ecart ?? 0.08)) return;
      this.derniers.set(o.cle, t);
    }
    if (o.monstre && this.voixMonstres >= 6) return;   // 5A : au plus 6 voix de monstres à la fois
    const b = this.tampon(f); if (!b) return;
    const src = c.createBufferSource(); src.buffer = b; src.playbackRate.value = o.vitesse ?? 1;
    const g = c.createGain(); g.gain.value = o.vol ?? 1;
    let n: AudioNode = src.connect(g);
    if (o.pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); n = n.connect(p); }
    n.connect(this.bus[bus]);
    if (o.monstre) { this.voixMonstres++; src.onended = () => { this.voixMonstres--; }; }
    src.start(0, Math.min(Math.max(0, o.offset ?? 0), Math.max(0, b.duration - 0.15)));
  }
  /** Un son pris au hasard dans une liste. */
  auHasard(l: string[] | undefined) { return l?.length ? l[Math.floor(Math.random() * l.length)] : undefined; }
  /** Accès au contexte et au bus des effets pour les petits sons synthétisés (carillon du butin, jauge pleine). */
  synth(): { ctx: AudioContext; out: AudioNode } | null { return this.ctx && this.ctx.state === 'running' ? { ctx: this.ctx, out: this.bus.effets } : null; }
}

/** Le son du jeu : un seul pour toute la page (il survit aux relances de la scène). */
export const Son = new Moteur();
