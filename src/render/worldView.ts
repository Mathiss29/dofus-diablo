import { v } from './assetUrl';
import Phaser from 'phaser';
import { ISO } from '../sim/iso';
import { GridMap, MAP_COLS, MAP_ROWS, type DecorPlace, type WorldGrid, type WorldMapEntry } from '../sim/gridmap';
import type { Particules } from './particles';
import type { Transparence } from './transparence';

/** Profondeur du sol. Le reste (perso, monstres, décor) est trié par sa hauteur à l'écran, qui descend sous -10 000 au nord
 *  d'Astrub (Tainéla, Cour du Bouftou Royal) : un sol à -10 000 passait alors au-dessus du perso et des PNJ. */
export const SOL = -1e8;

/** Rayon (en cartes) chargé autour du joueur, et rayon au-delà duquel une carte est déchargée.
 *  Entre les deux, une carte déjà chargée reste : pas de va-et-vient quand on longe un bord. */
const LOAD_RING = 1, UNLOAD_RING = 2;
/** Préchargement (choix 2A) : la 2e couronne est téléchargée d'avance sans être affichée ; les fichiers sont oubliés au-delà de OUBLI_RING. */
const PREFETCH_RING = 2, OUBLI_RING = 3;

/** Une carte affichée ; `next` = prochain élément de décor à poser (le décor arrive en plusieurs images, voir pump()). */
type Slot = { state: 'none' | 'loading' | 'ready'; objs: Phaser.GameObjects.GameObject[]; next: number };
/** Temps (ms) donné à chaque image pour poser du décor : une carte = ~400 images, les créer d'un coup faisait une saccade. */
const BUDGET_MS = 3;
/** Calques facultatifs d'une carte (tools/extraction/world_export.py). */
const CALQUES = ['fond', 'bord'] as const;

/** Affichage d'un monde ouvert qui ne garde en mémoire que les cartes proches du joueur.
 *  Chaque carte = un sol (+ un fond de nuages non coupé) + un atlas de décor (tools/extraction/world_export.py). Le ciel est une seule image
 *  fixée à la caméra, qui glisse un peu (parallaxe) quand on traverse le monde. */
/** Flou d'une image en niveaux (tableau L x H) : 3 passes de moyenne glissante (≈ gaussien), rayon en pixels. */
function flou(a: Float32Array, L: number, H: number, rad: number) {
  const tmp = new Float32Array(Math.max(L, H));
  const boite = (n: number, pas: number, debut: number) => {
    const at = (k: number) => a[debut + Math.min(n - 1, Math.max(0, k)) * pas];
    let s = 0;
    for (let k = -rad; k <= rad; k++) s += at(k);
    for (let k = 0; k < n; k++) { tmp[k] = s / (2 * rad + 1); s += at(k + rad + 1) - at(k - rad); }
    for (let k = 0; k < n; k++) a[debut + k * pas] = tmp[k];
  };
  for (let p = 0; p < 3; p++) {
    for (let j = 0; j < H; j++) boite(L, 1, j * L);
    for (let i = 0; i < L; i++) boite(H, L, i);
  }
}
const lisse = (t: number) => { const u = Math.min(1, Math.max(0, t)); return u * u * (3 - 2 * u); };

export class WorldView {
  private readonly slots = new Map<string, Slot>();
  sky?: Phaser.GameObjects.Image;
  private center = '';
  private viewT = 0;
  /** Bouts de portes (sim/world.ts). `vers` = carte où elle mène (préchargée à l'approche, maquette Entrées 2A) ;
   *  `sortie` = sortie d'un intérieur. */
  portes: { tag: string; x: number; y: number; vers?: string; sortie?: boolean }[] = [];
  /** Distance (monde) à laquelle on précharge ce qui est derrière une porte : 6 cases. */
  static readonly APPROCHE = 6 * 48;
  /** Cartes en téléchargement, et textures prêtes à envoyer à la carte graphique (une par image, voir fetchMap). */
  private readonly fetching = new Set<string>();
  private readonly uploads: { m: WorldMapEntry; add: () => void }[] = [];
  /** Fichiers des cartes déjà téléchargés (ou en cours), par nom : préchargement de la 2e couronne et retours rapides. */
  private readonly blobs = new Map<string, Promise<Blob>>();
  /** Rideau baissé (arrivée par une porte, un Zaap, après une mort) : on pose le décor plus vite, l'écran est noir. */
  presse = false;
  /** Ambiance (render/ambiance.ts) : teinte des cartes et force des lumières, appliquées aux objets posés et à venir. */
  private tint = 0xffffff;
  private lum = 1;
  private sol = 1;
  /** Décor qui bouge (maquette « Vivant ») : arbres au vent, eau qui glisse ou change de couleur. Coupables dans les Réglages. */
  /** Débords et originaux en double (DecorPlace.h / cc) : montrés ou cachés selon la carte où est le joueur. */
  private readonly selonCarte: { im: Phaser.GameObjects.Image; p: DecorPlace; tag: string }[] = [];
  private readonly vivants: { im: Phaser.GameObjects.Image; p: DecorPlace; x0: number; y0: number; ph: number }[] = [];
  vent = true;
  eau = true;
  /** Particules officielles des cartes (render/particles.ts), lancées quand une carte est posée. */
  parts?: Particules;
  /** Décor qui s'efface devant le perso et les monstres (render/transparence.ts) : chaque image de décor posée lui est donnée. */
  transparence?: Transparence;
  private lastT = 0;

  /** Fondu du bord du monde dans la mer ou la nuit (poserBrume), caché dans les intérieurs. */
  private brume?: Phaser.GameObjects.Image;
  /** Mer du rivage fondue depuis la vraie côte (poserRivage), cachée dans les intérieurs. */
  private rivage?: Phaser.GameObjects.Image;

  constructor(private readonly scene: Phaser.Scene, private readonly wg: WorldGrid, private readonly dir: string, private readonly prefix: string) {
    for (const m of wg.world.maps) this.slots.set(m.tag, { state: 'none', objs: [], next: 0 });
    scene.load.on(Phaser.Loader.Events.FILE_COMPLETE, (key: string) => this.onFile(key));
    scene.load.on(Phaser.Loader.Events.COMPLETE, () => {
      for (const m of wg.world.maps) if (this.slots.get(m.tag)!.state === 'loading' && this.texturesReady(m)) this.build(m);
    });
  }

  static key(prefix: string, name: string) { return `${prefix}_${name}`; }
  private k(name: string) { return WorldView.key(this.prefix, name); }

  /** À appeler dans preload() : le ciel et les cartes autour du départ, pour ne rien voir apparaître au lancement. */
  static preload(scene: Phaser.Scene, world: { sky?: string; maps: WorldMapEntry[] }, dir: string, prefix: string, start: [number, number]) {
    if (world.sky) scene.load.image(WorldView.key(prefix, 'ciel'), v(`${dir}/${world.sky}`));
    // contours officiels des portes au survol (tools/extraction/survols.py)
    if (world.maps.some(m => m.survols?.length) && !scene.textures.exists(`survols_${prefix}`))
      scene.load.atlas(`survols_${prefix}`, v(`assets/ui/survols_${prefix}.png`), v(`assets/ui/survols_${prefix}.json`));
    for (const m of world.maps) if (ring(m, start[0], start[1]) <= LOAD_RING) WorldView.queue(scene, m, dir, prefix);
  }
  private static queue(scene: Phaser.Scene, m: WorldMapEntry, dir: string, prefix: string) {
    scene.load.image(WorldView.key(prefix, `sol_${m.tag}`), v(`${dir}/sol_${m.tag}.webp`));
    for (const c of CALQUES) if (m[c]) scene.load.image(WorldView.key(prefix, `${c}_${m.tag}`), v(`${dir}/${c}_${m.tag}.webp`));
    for (const d of decors(m)) if (!scene.textures.exists(WorldView.key(prefix, d))) scene.load.atlas(WorldView.key(prefix, d), v(`${dir}/${d}.webp`), v(`${dir}/${d}.json`));
  }

  /** Après preload : pose le ciel et les cartes déjà chargées. */
  create() {
    if (this.scene.textures.exists(this.k('ciel'))) this.sky = this.scene.add.image(0, 0, this.k('ciel')).setScrollFactor(0).setDepth(SOL - 1e7).setTint(this.tint);
    for (const m of this.wg.world.maps) if (this.texturesReady(m)) { this.slots.get(m.tag)!.state = 'loading'; this.build(m); }
    this.poserBrume();
    this.poserRivage();
    this.pump(Infinity);   // au lancement, tout de suite (l'écran de chargement couvre)
    // paillasson à chaque sortie d'intérieur, comme Sanstour (Mathis 2026-11-08) : dalle de pierre au soleil vert qui luit,
    // posée sur la case de sortie officielle (la boîte de survol de la carte Dofus 3 quand elle existe), visible dans sa salle
    if (this.scene.textures.exists('paillasson')) for (const e of this.portes) if (e.sortie) {
      const s = this.caseDeSortie(e);
      const im = this.scene.add.image(s.x, s.y, 'paillasson').setScale(WorldView.PAILLASSON).setDepth(SOL + 3).setData('po', 1).setVisible(false).setTint(this.tint);
      const soleil = this.scene.textures.exists('paillasson_soleil')
        ? this.scene.add.image(s.x, s.y, 'paillasson_soleil').setScale(WorldView.SOLEIL).setDepth(SOL + 4).setBlendMode(Phaser.BlendModes.ADD).setVisible(false) : null;
      const etincelles = this.scene.textures.exists('paillasson_etincelle') ? this.scene.add.particles(s.x, s.y, 'paillasson_etincelle', {
        speedY: { min: -28, max: -12 }, speedX: { min: -5, max: 5 }, lifespan: 1300, frequency: 260, scale: { start: 0.9, end: 0 },
        alpha: { start: 0.9, end: 0 }, blendMode: 'ADD', emitting: false,
        emitZone: { type: 'random', source: new Phaser.Geom.Ellipse(0, 0, 44, 18) } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      }).setDepth(SOL + 5) : null;
      this.paillassons.push({ im, soleil, etincelles, tag: e.tag });
    }
  }
  /** Où poser le paillasson : la boîte de survol officielle la plus proche du bout de sortie (la case de sortie que Dofus 3
   *  entoure, Taverne : au coin du plancher), sinon une case de plancher. Point à l'écran. */
  private caseDeSortie(e: { tag: string; x: number; y: number }) {
    const fin = ISO.toScreen(e.x, e.y), m = this.wg.mapByTag(e.tag);
    let best: { x: number; y: number } | null = null, bd = WorldView.PAILLASSON_BOITE;
    for (const q of m?.survols ?? []) {
      const c = this.wg.toScreen(q.x, q.y), d = Math.hypot(c.x - fin.x, c.y - fin.y);
      if (d < bd) { bd = d; best = c; }
    }
    if (best) return best;
    const c = this.caseDeSol(e);
    return ISO.toScreen(c.x, c.y);
  }
  /** Taille du soleil vert du paillasson. */
  static readonly SOLEIL = 0.75;
  /** Distance max (px à l'écran) entre le bout de sortie et la boîte de survol officielle de la case de sortie. */
  static readonly PAILLASSON_BOITE = 120;
  /** Case du paillasson : le bout de sortie est au bord de la salle, souvent dans le noir (Taverne : pointe du couloir
   *  sous le coin du plancher). On avance d'une case vers le milieu de la salle, puis on prend la case libre la plus proche. */
  private caseDeSol(e: { tag: string; x: number; y: number }) {
    const wg = this.wg, libres = (wg.freeByMap.get(e.tag) ?? []).map(c => wg.cellToWorld(c));
    if (!libres.length) return e;
    const mx = libres.reduce((t, q) => t + q.x, 0) / libres.length, my = libres.reduce((t, q) => t + q.y, 0) / libres.length;
    const d = Math.hypot(mx - e.x, my - e.y) || 1, x = e.x + (mx - e.x) / d * WorldView.PAILLASSON_AVANCE, y = e.y + (my - e.y) / d * WorldView.PAILLASSON_AVANCE;
    return libres.reduce((b, q) => Math.hypot(q.x - x, q.y - y) < Math.hypot(b.x - x, b.y - y) ? q : b);
  }
  /** De combien le paillasson avance dans la salle depuis le bout de sortie (px du monde, ≈ une case). */
  static readonly PAILLASSON_AVANCE = 55;
  /** Échelle du paillasson (le tapis fait une case). */
  static readonly PAILLASSON = 0.95;
  private paillassons: { im: Phaser.GameObjects.Image; soleil: Phaser.GameObjects.Image | null; etincelles: Phaser.GameObjects.Particles.ParticleEmitter | null; tag: string }[] = [];

  isReady(tag: string | undefined) { return !!tag && this.slots.get(tag)?.state === 'ready'; }

  /** Chaque image : ciel qui suit la caméra ; charge les cartes autour du joueur ET celles que la caméra voit (dézoom),
   *  décharge celles qui sont loin des deux. Vérifié quand le joueur change de carte, et 4 fois par seconde pour le zoom. */
  update(px: number, py: number) {
    this.drawSky();
    this.upload();
    if (this.presse) this.upload();   // écran noir : deux textures par image, et plus de temps pour le décor
    this.pump(this.presse ? 14 : BUDGET_MS);
    const t = this.scene.time.now / 1000;
    this.animate(t);
    this.parts?.update(this.lastT ? t - this.lastT : 0);
    this.lastT = t;
    const here = this.wg.mapAt(px, py), now = this.scene.time.now;
    if (!here || (here.tag === this.center && now - this.viewT < 250)) return;
    this.viewT = now;
    if (here.tag !== this.center) {
      this.center = here.tag;
      this.majSelonCarte();
      // intérieur : pas de ciel, fond noir comme dans Dofus
      // (le Temple Céleste flotte dans le ciel : il le garde)
      this.sky?.setVisible(!here.inside || !!here.ciel);
      this.brume?.setVisible(!here.inside);
      this.rivage?.setVisible(!here.inside);
      for (const p of this.paillassons) {
        const v = p.tag === here.tag;
        p.im.setVisible(v); p.soleil?.setVisible(v); p.etincelles?.setVisible(v);
        if (p.etincelles) p.etincelles.emitting = v;
      }
      this.scene.cameras.main.setBackgroundColor(here.inside && !here.ciel ? '#000000' : here.mer !== undefined ? `#${here.mer.toString(16).padStart(6, '0')}` : '#0d2b36');
    }
    const seen = (m: WorldMapEntry, marge: number) => this.seen(m, here, marge);
    for (const m of this.wg.world.maps) {
      const d = ring(m, here.x, here.y), s = this.slots.get(m.tag)!;
      // dans un intérieur, seule sa salle est dessinée : les salles voisines dans la grille ne doivent pas se voir
      const veut = here.inside ? m.tag === here.tag : d <= LOAD_RING || seen(m, 400);
      const jette = here.inside ? m.tag !== here.tag : d > UNLOAD_RING && !seen(m, 1200);
      if (veut && s.state === 'none') {
        s.state = 'loading';
        if (this.texturesReady(m)) this.build(m);
        else this.fetchMap(m);
      } else if (jette && s.state !== 'none') this.unload(m);   // 'loading' : la carte arrivera pour rien, build() la jette
    }
    this.prefetch(here, px, py);
  }

  /** En jeu, une carte se charge sans saccade : les images sont téléchargées et décodées hors du fil principal
   *  (createImageBitmap), puis envoyées à la carte graphique une par image (le chargeur de Phaser décodait tout d'un coup
   *  au passage d'une carte à l'autre : mini-gel). */
  private fetchMap(m: WorldMapEntry) {
    if (this.fetching.has(m.tag)) return;
    this.fetching.add(m.tag);
    const tex = this.scene.textures;
    const bmp = (n: string) => this.blob(n).then(b => createImageBitmap(b, { premultiplyAlpha: 'premultiply' }));
    const image = (n: string) => bmp(`${n}.webp`).then(b => () => { if (!tex.exists(this.k(n))) tex.addImage(this.k(n), b as unknown as HTMLImageElement); });
    const atlas = (d: string) => Promise.all([bmp(`${d}.webp`), this.blob(`${d}.json`).then(b => b.text()).then(t => JSON.parse(t))])
      .then(([b, j]) => () => { if (!tex.exists(this.k(d))) tex.addAtlas(this.k(d), b as unknown as HTMLImageElement, j); });
    // pages communes déjà envoyées à la carte graphique (une voisine les utilise) : pas besoin de les refaire
    const jobs = [image(`sol_${m.tag}`), ...CALQUES.filter(c => m[c]).map(c => image(`${c}_${m.tag}`)),
      ...decors(m).filter(d => !tex.exists(this.k(d))).map(atlas)];
    Promise.all(jobs).then(adds => { for (const add of adds) this.uploads.push({ m, add }); })
      .catch(e => console.warn('Carte non chargée', m.tag, e))
      .finally(() => this.fetching.delete(m.tag));
  }
  /** Fichiers d'une carte (tools/extraction/world_export.py). */
  private fichiers(m: WorldMapEntry) {
    return [`sol_${m.tag}.webp`, ...CALQUES.filter(c => m[c]).map(c => `${c}_${m.tag}.webp`), ...decors(m).flatMap(d => [`${d}.webp`, `${d}.json`])];
  }
  /** Télécharge un fichier une seule fois (préchargé ou demandé par la carte) ; un échec sera retenté. */
  private blob(n: string) {
    let b = this.blobs.get(n);
    if (!b) {
      b = fetch(v(`${this.dir}/${n}`)).then(r => { if (!r.ok) throw new Error(n); return r.blob(); });
      b.catch(() => this.blobs.delete(n));
      this.blobs.set(n, b);
    }
    return b;
  }
  /** Préchargement (2A) : quand rien d'autre ne se télécharge, une carte de la 2e couronne à la fois, sans l'afficher.
   *  Les fichiers des cartes lointaines sont oubliés (mémoire). */
  private prefetch(here: WorldMapEntry, px: number, py: number) {
    const derriere = this.derrierePortes(here, px, py);
    for (const m of this.wg.world.maps) {
      if (this.slots.get(m.tag)!.state !== 'none' || derriere.has(m.tag)) continue;
      const d = !!m.inside === !!here.inside ? ring(m, here.x, here.y) : Infinity;
      if (d > OUBLI_RING) for (const n of this.fichiers(m)) this.blobs.delete(n);
    }
    if (this.fetching.size) return;
    // derrière les portes proches d'abord (2A) : l'intérieur, ou en sortant la carte du dehors et ses voisines
    for (const tag of derriere) {
      const m = this.wg.mapByTag(tag);
      if (!m || this.slots.get(tag)!.state !== 'none') continue;
      const f = this.fichiers(m);
      if (f.every(n => this.blobs.has(n))) continue;
      for (const n of f) this.blob(n).catch(() => { /* retenté plus tard */ });
      return;
    }
    if (here.inside) return;
    for (const m of this.wg.world.maps) {
      if (m.inside || ring(m, here.x, here.y) !== PREFETCH_RING || this.slots.get(m.tag)!.state !== 'none') continue;
      const f = this.fichiers(m);
      if (f.every(n => this.blobs.has(n))) continue;
      for (const n of f) this.blob(n).catch(() => { /* retenté plus tard */ });
      return;
    }
  }

  /** Cartes derrière les portes proches du joueur (dehors : à moins de APPROCHE ; dedans : toutes les portes de la salle).
   *  Un intérieur seul ; une carte du dehors avec ses voisines (l'arrivée attend la carte et ses 8 voisines, voir pret()). */
  private derrierePortes(here: WorldMapEntry, px: number, py: number): Set<string> {
    const r = new Set<string>();
    for (const p of this.portes) {
      if (!p.vers || p.vers === here.tag) continue;
      if (here.inside ? p.tag !== here.tag : Math.hypot(p.x - px, p.y - py) > WorldView.APPROCHE) continue;
      const m = this.wg.mapByTag(p.vers);
      if (!m) continue;
      if (m.inside) { r.add(m.tag); continue; }
      for (const n of this.wg.world.maps) if (!n.inside && ring(n, m.x, m.y) <= LOAD_RING) r.add(n.tag);
    }
    return r;
  }

  /** Arrivée (1A) : la carte du joueur et ses 8 voisines (dedans : la salle seule), et celles que la caméra voit,
   *  sont posées en entier, décor compris. `p` = part déjà posée, pour la barre de l'écran de chargement. */
  pret(px: number, py: number): { ok: boolean; p: number } {
    const here = this.wg.mapAt(px, py);
    if (!here) return { ok: true, p: 1 };
    let n = 0, ok = 0;
    for (const m of this.wg.world.maps) {
      const voulue = here.inside ? m.tag === here.tag : !m.inside && (ring(m, here.x, here.y) <= LOAD_RING || this.seen(m, here, 0));
      if (!voulue) continue;
      const s = this.slots.get(m.tag)!;
      n++;
      if (s.state === 'ready' && s.next >= m.decor.length) ok++;
    }
    return { ok: ok === n, p: n ? ok / n : 1 };
  }
  /** La carte est (presque) dans le champ de la caméra. */
  private seen(m: WorldMapEntry, here: WorldMapEntry, marge: number) {
    if (!!m.inside !== !!here.inside) return false;   // dehors on ne voit pas les intérieurs (et inversement)
    const v = this.scene.cameras.main.worldView, S = GridMap.S, a = this.wg.toScreen(m.sol.x, m.sol.y);
    return a.x < v.right + marge && a.x + m.sol.w * S > v.x - marge && a.y < v.bottom + marge && a.y + m.sol.h * S > v.y - marge;
  }
  /** Une texture par image vers la carte graphique ; la carte se pose quand toutes ses textures sont là. */
  private upload() {
    const u = this.uploads.shift();
    if (!u) return;
    const s = this.slots.get(u.m.tag)!;
    if (s.state !== 'loading') return;   // le joueur est reparti entre-temps
    u.add();
    if (this.texturesReady(u.m)) this.build(u.m);
  }
  private texturesReady(m: WorldMapEntry) {
    return this.scene.textures.exists(this.k(`sol_${m.tag}`)) && decors(m).every(d => this.scene.textures.exists(this.k(d)))
      && CALQUES.every(c => !m[c] || this.scene.textures.exists(this.k(`${c}_${m.tag}`)));
  }
  private onFile(key: string) {
    const page = key.match(new RegExp(`^${this.prefix}_decor_p(\\d+)$`));
    if (page) {   // page commune : toutes les cartes qui l'attendaient
      for (const m of this.wg.world.maps) if (m.pages?.includes(+page[1])) this.onMap(m);
      return;
    }
    const tag = key.replace(new RegExp(`^${this.prefix}_(sol|fond|bord|decor)_`), '');
    const m = this.wg.world.maps.find(x => x.tag === tag);
    if (m) this.onMap(m);
  }
  private onMap(m: WorldMapEntry) {
    const s = this.slots.get(m.tag);
    // le chargeur prévient quand le fichier est lu ; la texture arrive juste après : on attend une image
    if (!m || !s) return;
    this.scene.time.delayedCall(0, () => {
      if (s.state === 'loading' && this.texturesReady(m)) this.build(m);
      else if (s.state === 'none') this.dropTextures(m);   // arrivée après que le joueur est reparti
    });
  }

  private build(m: WorldMapEntry) {
    const s = this.slots.get(m.tag)!, S = GridMap.S, wg = this.wg;
    if (s.state !== 'loading') { this.unload(m); return; }   // annulée entre-temps (le joueur est reparti)
    const o = wg.toScreen(m.sol.x, m.sol.y);
    s.objs.push(this.scene.add.image(o.x, o.y, this.k(`sol_${m.tag}`)).setOrigin(0).setScale(S).setDepth(SOL).setTint(this.tint));
    if (m.fond) {   // nuages et rayons qui débordent sur les voisins : sous tous les sols
      const f = wg.toScreen(m.fond.x, m.fond.y);
      s.objs.push(this.scene.add.image(f.x, f.y, this.k(`fond_${m.tag}`)).setOrigin(0).setScale(S * (m.fond.k ?? 1)).setDepth(SOL - 5e6).setTint(this.tint));
    }
    // débords en fondu sur les voisines : au-dessus de tous les sols, sous le décor. Une carte plus haut (ou plus à gauche)
    // passe au-dessus : son dessin continue sans coupure au-delà du raccord (tools/extraction/bords_fondu.py).
    if (m.bord) {
      const f = wg.toScreen(m.bord.x, m.bord.y), rang = (m.y - this.wg.world.origin[1]) * 1000 + (m.x - this.wg.world.origin[0]);
      s.objs.push(this.scene.add.image(f.x, f.y, this.k(`bord_${m.tag}`)).setOrigin(0).setScale(S).setDepth(SOL + 1.4 - rang * 1e-6).setTint(this.tint));
    }
    s.next = 0;
    // plus de repère doré au sol (maquette Entrées 18A, comme Sanstour) : la porte et le paillasson officiels se voient,
    // et le survol donne le nom et le curseur maison
    s.state = 'ready';
    this.parts?.add(m.tag);
    this.pump(m.tag === this.center ? Infinity : this.presse ? 14 : BUDGET_MS);   // la carte du joueur tout de suite, les voisines au fil des images
  }
  /** Bord du monde (monde sans ciel, ex. Astrub) : là où une carte du dehors n'a pas de voisine, son sol s'arrêtait net en escalier
   *  sur le fond, avec des bouts de toits qui flottaient au-delà (Tainéla, retour de Mathis 2026-11-06 ; Dofus ne montre qu'une
   *  carte, on n'y voit jamais ce bord). Une seule image pour tout le monde, petite (1 px = 32 px du monde) et floutée : le cadre
   *  des cartes du dehors, flouté sur 3 cases, donne un fondu doux qui épouse la côte et arrondit les coins. Avant, chaque carte
   *  posait ses bandes et ses aplats rectangulaires : des escaliers de mer à chaque coin (maquette Raccords, 2026-11-08).
   *  Couleur : celle de la mer près des cartes du rivage (champ "mer", tools/extraction/mer.py), le bleu nuit ailleurs. */
  private poserBrume() {
    const w = this.wg.world;
    if (w.sky) return;
    const dehors = w.maps.filter(m => !m.inside);
    if (!dehors.length) return;
    const g = w.grid, [X0, Y0] = w.origin, Wm = MAP_COLS * g.w, Hm = MAP_ROWS * g.h / 2, K = 32, MARGE = 3200;
    const cadre = (m: WorldMapEntry) => ({ x: g.ox + Math.floor(g.w / 4) + (m.x - X0) * Wm, y: g.oy + Math.floor(g.h / 4) + (m.y - Y0) * Hm });
    const cs = dehors.map(cadre);
    const bx = Math.min(...cs.map(c => c.x)) - MARGE, by = Math.min(...cs.map(c => c.y)) - MARGE;
    const L = Math.ceil((Math.max(...cs.map(c => c.x)) + Wm + MARGE - bx) / K), Hh = Math.ceil((Math.max(...cs.map(c => c.y)) + Hm + MARGE - by) / K);
    const terre = new Float32Array(L * Hh), r = new Float32Array(L * Hh), v = new Float32Array(L * Hh), b = new Float32Array(L * Hh);
    const nuit = 0x0d2b36, fond = [nuit >> 16, nuit >> 8 & 255, nuit & 255];
    for (let i = 0; i < L * Hh; i++) { r[i] = fond[0]; v[i] = fond[1]; b[i] = fond[2]; }
    const remplir = (x: number, y: number, w2: number, h2: number, f: (i: number) => void) => {
      const i0 = Math.max(0, Math.round((x - bx) / K)), i1 = Math.min(L, Math.round((x + w2 - bx) / K));
      const j0 = Math.max(0, Math.round((y - by) / K)), j1 = Math.min(Hh, Math.round((y + h2 - by) / K));
      for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) f(j * L + i);
    };
    dehors.forEach((m, n) => {
      if (m.mer === undefined) return;   // la mer s'étend sur 2 cartes autour du rivage, comme avant
      const c = cs[n], col = [m.mer >> 16, m.mer >> 8 & 255, m.mer & 255];
      remplir(c.x - 2 * Wm, c.y - 2 * Hm, 5 * Wm, 5 * Hm, i => { r[i] = col[0]; v[i] = col[1]; b[i] = col[2]; });
    });
    cs.forEach(c => remplir(c.x, c.y, Wm, Hm, i => { terre[i] = 1; }));
    flou(terre, L, Hh, 3);
    for (const c of [r, v, b]) flou(c, L, Hh, 12);
    const cv = document.createElement('canvas'); cv.width = L; cv.height = Hh;
    const ctx = cv.getContext('2d')!, img = ctx.createImageData(L, Hh), d = img.data;
    for (let i = 0; i < L * Hh; i++) {
      // terre floutée : 1 au cœur de la carte, 0,5 sur le cadre, 0 au large. Opaque à ~½ case dehors, transparent à ~2 cases dedans.
      const a = lisse((0.92 - terre[i]) / (0.92 - 0.3));
      d[4 * i] = r[i]; d[4 * i + 1] = v[i]; d[4 * i + 2] = b[i]; d[4 * i + 3] = Math.round(a * 255);
    }
    ctx.putImageData(img, 0, 0);
    const cle = this.k('brume');
    if (this.scene.textures.exists(cle)) this.scene.textures.remove(cle);
    this.scene.textures.addCanvas(cle, cv);
    const o = this.wg.toScreen(bx, by);
    this.brume = this.scene.add.image(o.x, o.y, cle).setOrigin(0).setScale(K * GridMap.S).setDepth(1e6);
  }
  /** Mer du rivage (maquette Raccords, 2026-11-08) : l'eau officielle des cartes du rivage s'arrêtait net au cadre de la carte,
   *  sur l'aplat de la mer. On la fond dans la couleur de la mer à partir de la vraie côte (champ "rivage", tools/extraction/mer.py) :
   *  une bande d'eau officielle le long du sable, puis la mer unie, sans coin ni escalier. Posée juste au-dessus des sols, sous le
   *  décor : bateaux, rochers et vaguelettes restent visibles. */
  private poserRivage() {
    const w = this.wg.world, cotes = w.maps.filter(m => !m.inside && m.rivage && m.mer !== undefined);
    if (w.sky || !cotes.length) return;
    const g = w.grid, [X0, Y0] = w.origin, Wm = MAP_COLS * g.w, Hm = MAP_ROWS * g.h / 2, K = cotes[0].rivage!.k, mer = cotes[0].mer!;
    const cadre = (m: WorldMapEntry) => ({ x: g.ox + Math.floor(g.w / 4) + (m.x - X0) * Wm, y: g.oy + Math.floor(g.h / 4) + (m.y - Y0) * Hm });
    const cs = cotes.map(cadre);
    const bx = Math.min(...cs.map(c => c.x)) - 2 * Wm, by = Math.min(...cs.map(c => c.y)) - 2 * Hm;
    const L = Math.ceil((Math.max(...cs.map(c => c.x)) + 3 * Wm - bx) / K), H = Math.ceil((Math.max(...cs.map(c => c.y)) + 3 * Hm - by) / K);
    const terre = new Float32Array(L * H);
    const poser = (x: number, y: number, nw: number, nh: number, f: (i: number, j: number) => number) => {
      const i0 = Math.round((x - bx) / K), j0 = Math.round((y - by) / K);
      for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) {
        const ii = i0 + i, jj = j0 + j;
        if (ii >= 0 && jj >= 0 && ii < L && jj < H) terre[jj * L + ii] = f(i, j);
      }
    };
    for (const m of w.maps) if (!m.inside && !m.rivage) { const c = cadre(m); poser(c.x, c.y, Math.ceil(Wm / K), Math.ceil(Hm / K), () => 1); }
    cotes.forEach((m, n) => { const r = m.rivage!; poser(cs[n].x, cs[n].y, r.w, r.h, (i, j) => r.d.charCodeAt(j * r.w + i) === 49 ? 1 : 0); });
    flou(terre, L, H, 8);
    const cv = document.createElement('canvas'); cv.width = L; cv.height = H;
    const ctx = cv.getContext('2d')!, img = ctx.createImageData(L, H), d = img.data;
    for (let i = 0; i < L * H; i++) {
      // 0,5 = la côte ; l'eau officielle se voit sur ~1 case, puis la mer unie à ~2 cases
      d[4 * i] = mer >> 16; d[4 * i + 1] = mer >> 8 & 255; d[4 * i + 2] = mer & 255; d[4 * i + 3] = Math.round(lisse((0.45 - terre[i]) / 0.35) * 255);
    }
    ctx.putImageData(img, 0, 0);
    const cle = this.k('rivage');
    if (this.scene.textures.exists(cle)) this.scene.textures.remove(cle);
    this.scene.textures.addCanvas(cle, cv);
    const o = this.wg.toScreen(bx, by);
    this.rivage = this.scene.add.image(o.x, o.y, cle).setOrigin(0).setScale(K * GridMap.S).setDepth(SOL + 1.5);
  }
  /** Pose le décor des cartes prêtes, dans la limite du budget de temps. */
  private pump(budget = BUDGET_MS) {
    const t0 = performance.now(), wg = this.wg, S = GridMap.S, h = wg.data.grid.h;
    for (const m of this.wg.world.maps) {
      const s = this.slots.get(m.tag)!;
      if (s.state !== 'ready') continue;
      while (s.next < m.decor.length) {
        if (performance.now() - t0 > budget) return;
        const p = m.decor[s.next++];
        // profondeur = bas de la case dans la grande grille : on passe derrière un arbre même s'il est sur la carte voisine
        const sp = wg.toScreen(p.x, p.y), im = this.scene.add.image(sp.x, sp.y, this.k(p.p !== undefined ? `decor_p${p.p}` : `decor_${m.tag}`), p.f).setScale(S * (p.z ?? 1));
        if (p.c < 0) im.setDepth(SOL + 10 + p.o * 0.01);   // lumière posée sur le sol : au-dessus du sol, sous le décor
        else { const cc = wg.cellCenter(p.c), cs = wg.toScreen(cc.x, cc.y + h / 2); im.setDepth(cs.y + p.o * 0.01); }
        if (p.h || p.cc) im.setData('tag', m.tag);
        if (p.po) im.setData('po', p.po);
        if (p.b) this.light(im, p);
        else im.setTint(this.tint);
        if (p.c < 0 && p.g) im.setDepth(SOL + 2 + p.o * 0.0001);   // eau animée : juste au-dessus du sol, sous les lumières
        if (p.w || p.t || p.ca) {
          // vent : l'arbre plie depuis son pied (origine en bas) ; phase tirée de sa position, pour ne pas bouger tous ensemble
          if (p.w) { im.setOrigin(0.5, 1); im.y += (im.height * im.scaleY) / 2; }
          this.vivants.push({ im, p, x0: im.x, y0: im.y, ph: (p.x * 0.013 + p.y * 0.007) % (Math.PI * 2) });
        }
        if (p.c >= 0 && !p.b) this.transparence?.ajouter(im, p.bt);
        if (p.h || p.cc) { this.selonCarte.push({ im, p, tag: m.tag }); if (!this.montre(p, m.tag)) im.setVisible(false); }
        s.objs.push(im);
      }
    }
  }
  /** Contour de la porte survolée (façon Sanstour, comme les éléments interactifs de Dofus 3) : le dessin pile au-dessus
   *  de la porte (sx, sy : la case de la porte à l'écran) reçoit un trait lilas. null = plus rien de survolé. */
  contour(sx: number | null, sy = 0) {
    const cle = sx === null ? '' : `${Math.round(sx)},${Math.round(sy)}`, t = this.scene.time.now;
    // même porte : rien à refaire, sauf si son dessin n'était pas encore posé (carte voisine en chargement) : on recherche 4 fois par seconde
    if (cle === this.contourCle && (this.contourIm || this.survolIm?.visible || !cle || t - this.contourT < 250)) return;
    this.contourCle = cle; this.contourT = t;
    if (this.contourIm?.active) { this.contourIm.preFX?.clear(); if (this.contourIm.texture.key === 'paillasson') this.devant(this.contourIm, false); }
    this.contourIm = null;
    this.survolIm?.setVisible(false);
    if (sx === null) return;
    // le trait officiel de la porte (boîte de survol de la carte Dofus 3, ou dessin de la porte), comme Dofus 3 et Sanstour
    if (this.montrerSurvol(sx, sy)) return;
    const im = this.dessinPorte(sx, sy);
    if (!im?.preFX) return;   // rien à entourer, ou pas de WebGL
    im.preFX.setPadding(4);
    im.preFX.addGlow(WorldView.LILAS, 4, 0, false, 0.12, 3);
    // paillasson survolé : il passe devant le bord noir de la salle, qui le cache parfois
    if (im.texture.key === 'paillasson') this.devant(im, true);
    this.contourIm = im;
  }
  /** Paillasson (et son soleil, ses étincelles) devant le bord noir de la salle pendant le survol, ou de retour au sol. */
  private devant(im: Phaser.GameObjects.Image, oui: boolean) {
    const p = this.paillassons.find(q => q.im === im);
    im.setDepth(oui ? 1e6 - 7 : SOL + 3); p?.soleil?.setDepth(oui ? 1e6 - 6.5 : SOL + 4); p?.etincelles?.setDepth(oui ? 1e6 - 6 : SOL + 5);
  }
  /** Teinte du contour (le lilas de Sanstour). */
  static readonly LILAS = 0xe2d8ff;
  private survolIm: Phaser.GameObjects.Image | null = null;
  /** Le contour officiel le plus proche du haut de la case de la porte (survols de monde.json, sur les cartes affichées). */
  private montrerSurvol(sx: number, sy: number): boolean {
    const cle = `survols_${this.prefix}`;
    if (!this.scene.textures.exists(cle)) return false;
    const tex = this.scene.textures.get(cle), S = GridMap.S, px = sx, py = sy - 50;
    let best: { x: number; y: number; f: string; w: number } | null = null, bd = WorldView.CONTOUR_MAX;
    for (const m of this.wg.world.maps) {
      if (!m.survols || this.slots.get(m.tag)?.state !== 'ready') continue;
      for (const q of m.survols) {
        const fr = tex.get(q.f), w = fr.width * S, h = fr.height * S, c = this.wg.toScreen(q.x, q.y), x0 = c.x - w / 2, y0 = c.y - h / 2;
        const d = Math.hypot(Math.max(x0 - px, 0, px - x0 - w), Math.max(y0 - py, 0, py - y0 - h));
        if (d < bd || (d === bd && best && w < best.w)) { bd = d; best = { ...c, f: q.f, w }; }
      }
    }
    if (!best) return false;
    if (!this.survolIm) {
      this.survolIm = this.scene.add.image(0, 0, cle).setDepth(1e6 - 5);
      this.scene.cameras.getCamera('mini')?.ignore(this.survolIm);
    }
    this.survolIm.setTexture(cle, best.f).setPosition(best.x, best.y).setScale(S).setVisible(true);
    return true;
  }
  private contourCle = '';
  private contourT = 0;
  private contourIm: Phaser.GameObjects.Image | null = null;
  /** Le dessin de la porte : l'image marquée « porte » (gfx officiel, portes_contour.py) la plus proche, si elle touche
   *  presque le haut de la case. Une porte peinte dans le bâtiment n'a pas d'image à elle : pas de contour. */
  private dessinPorte(sx: number, sy: number): Phaser.GameObjects.Image | null {
    const px = sx, py = sy - 50;
    let best: Phaser.GameObjects.Image | null = null, bd = WorldView.CONTOUR_MAX;
    const listes = [...[...this.slots.values()].filter(s => s.state === 'ready').map(s => s.objs), this.paillassons.map(p => p.im)];
    for (const objs of listes) {
      for (const o of objs) {
        if (!(o instanceof Phaser.GameObjects.Image) || !o.visible || !o.getData('po') || o.displayWidth > 200) continue;
        const x0 = o.x - o.displayOriginX * o.scaleX, y0 = o.y - o.displayOriginY * o.scaleY;
        const d = Math.hypot(Math.max(x0 - px, 0, px - x0 - o.displayWidth), Math.max(y0 - py, 0, py - y0 - o.displayHeight));
        if (d < bd || (d === bd && best && o.displayWidth < best.displayWidth)) { bd = d; best = o; }
      }
    }
    return best;
  }
  /** Distance maximale (px) entre le haut de la case de la porte et le dessin de la porte. */
  static readonly CONTOUR_MAX = 70;
  /** Fait bouger le décor vivant (arbres au vent, eau). Amplitudes officielles ; vitesses ralenties (trop rapides pour Mathis, 2026-11-06). */
  private animate(t: number) {
    for (const p of this.paillassons) if (p.soleil?.visible) p.soleil.setAlpha(0.85 + 0.15 * Math.sin(t * 2.4)).setScale(WorldView.SOLEIL * (0.92 + 0.08 * Math.sin(t * 2.4)));
    let n = 0;
    for (const v of this.vivants) {
      if (!v.im.active) continue;   // carte déchargée : on l'oublie
      this.vivants[n++] = v;
      const { im, p } = v;
      if (p.w) im.setRotation(this.vent ? p.w * 0.035 * Math.sin(t * 0.7 + v.ph) + p.w * 0.008 * Math.sin(t * 1.5 + v.ph * 2) : 0);
      if (p.t) {
        // l'eau officielle (0,02) est accélérée x4 ; plafond 0,15 : les pierres flottantes du Temple (0,2-0,3) allaient trop vite
        const a = this.eau ? p.t[2] * Math.sin(t * Math.PI * 2 * Math.min(p.t[3] * 4, 0.15) + v.ph) : 0;
        im.setPosition(v.x0 + p.t[0] * a * GridMap.S, v.y0 - p.t[1] * a * GridMap.S);
      }
      if (p.ca) {
        const f = this.eau ? p.ca[1] * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * p.ca[2] * 0.5 + v.ph)) : 0;
        im.setTint(mulTint(lerpTint(0xffffff, p.ca[0], f), this.tint));
      }
    }
    this.vivants.length = n;
  }
  /** Façon Sanstour (Mathis, 2026-11-07) : chaque carte Dofus contient aussi ce qui l'entoure (débords « h »), mais Dofus
   *  n'affiche que la carte courante. Ici les voisines restent affichées en objets entiers (centre dans leur cadre), et les
   *  débords de la carte du joueur s'ajoutent, en cachant les originaux des voisines qu'ils recopient (« cc »). */
  private montre(p: DecorPlace, tag: string) {
    if (p.h) return tag === this.center;
    return !p.cc?.includes(this.center);
  }
  private majSelonCarte() {
    let n = 0;
    for (const e of this.selonCarte) {
      if (!e.im.active) continue;   // carte déchargée
      this.selonCarte[n++] = e;
      const v = this.montre(e.p, e.tag);
      if (e.p.b) e.im.setVisible(v && (e.p.j ? this.sol : this.lum) > 0.01);
      else e.im.setVisible(v);   // tout de suite : un fondu cassait le rythme (Mathis, 2026-11-07)
    }
    this.selonCarte.length = n;
  }
  /** Lumière officielle (halo, lueur, rayon) : ajoutée à l'image comme dans Dofus, jamais teintée, plus forte la nuit. */
  private light(im: Phaser.GameObjects.Image, p: DecorPlace) {
    im.setBlendMode(p.b === 'a' ? Phaser.BlendModes.ADD : Phaser.BlendModes.SCREEN).setData('k', p.k ?? 1).setData('j', !!p.j);
    const f = p.j ? this.sol : this.lum;
    im.setAlpha(Math.min(1, (p.k ?? 1) * f)).setVisible(f > 0.01 && ((!p.h && !p.cc) || this.montre(p, im.getData('tag') ?? '')));
  }
  /** Change l'ambiance : teinte des cartes (sol, décor, ciel) et force des lumières. Ne refait le travail que si ça a changé. */
  setAmbiance(tint: number, lum: number, sol: number) {
    if (tint === this.tint && Math.abs(lum - this.lum) < 0.01 && Math.abs(sol - this.sol) < 0.01) return;
    this.tint = tint; this.lum = lum; this.sol = sol;
    this.parts?.setAmbiance(tint, lum);
    this.sky?.setTint(tint);
    for (const p of this.paillassons) p.im.setTint(tint);
    for (const s of this.slots.values()) for (const o of s.objs) {
      if (!(o instanceof Phaser.GameObjects.Image)) continue;
      const k = o.getData('k') as number | undefined;
      if (k === undefined) o.setTint(tint);   // (l'eau qui change de couleur est reteintée à chaque image par animate)
      else { const f = o.getData('j') ? sol : lum; o.setAlpha(Math.min(1, k * f)).setVisible(f > 0.01); }
    }
    this.majSelonCarte();
  }
  private unload(m: WorldMapEntry) {
    const s = this.slots.get(m.tag)!;
    for (const o of s.objs) { this.scene.tweens.killTweensOf(o); o.destroy(); }
    s.objs = []; s.state = 'none'; s.next = 0;
    this.parts?.remove(m.tag);
    this.dropTextures(m);
  }
  private dropTextures(m: WorldMapEntry) {
    // une page commune reste tant qu'une autre carte affichée ou en chargement s'en sert
    const enUsage = (d: string) => this.wg.world.maps.some(o => o !== m && this.slots.get(o.tag)!.state !== 'none' && decors(o).includes(d));
    const decor = decors(m).filter(d => !enUsage(d));
    for (const n of [`sol_${m.tag}`, ...decor, ...CALQUES.map(c => `${c}_${m.tag}`)]) if (this.scene.textures.exists(this.k(n))) this.scene.textures.remove(this.k(n));
    for (const d of decor) this.scene.cache.json.remove(this.k(d));
  }

  /** Ciel : couvre l'écran avec 20 % de marge et glisse de cette marge d'un bout à l'autre du monde. */
  private drawSky() {
    const sky = this.sky;
    if (!sky) return;
    const cam = this.scene.cameras.main, W = cam.width, H = cam.height;
    const sc = Math.max(W / sky.width, H / sky.height) * 1.2;
    const a = this.wg.toScreen(this.wg.data.grid.ox, this.wg.data.grid.oy);
    const b = this.wg.toScreen(this.wg.data.grid.ox + this.wg.cols * this.wg.data.grid.w, this.wg.data.grid.oy + this.wg.rows * this.wg.data.grid.h / 2);
    const fx = Phaser.Math.Clamp((cam.midPoint.x - a.x) / (b.x - a.x), 0, 1), fy = Phaser.Math.Clamp((cam.midPoint.y - a.y) / (b.y - a.y), 0, 1);
    const ex = sky.width * sc - W, ey = sky.height * sc - H;
    // le zoom de la caméra agrandit aussi les objets fixes autour du centre de l'écran : on le compense
    const z = cam.zoom, cx = W / 2, cy = H / 2;
    sky.setScale(sc / z).setOrigin(0).setPosition(cx + (-ex * fx - cx) / z, cy + (-ey * fy - cy) / z);
  }
}

/** Distance en cartes (anneau) entre une carte et (x, y). */
/** Atlas de décor d'une carte : le sien, ou les pages communes du décor partagé (world_export.py PARTAGE=1). */
function decors(m: WorldMapEntry) { return m.pages ? m.pages.map(p => `decor_p${p}`) : [`decor_${m.tag}`]; }
function ring(m: { x: number; y: number }, x: number, y: number) { return Math.max(Math.abs(m.x - x), Math.abs(m.y - y)); }

/** Produit de deux teintes 0xRRGGBB, et mélange de a vers b (f de 0 à 1). */
function mulTint(a: number, b: number) {
  const c = (s: number) => Math.round((((a >> s) & 255) * ((b >> s) & 255)) / 255) << s;
  return c(16) | c(8) | c(0);
}
function lerpTint(a: number, b: number, f: number) {
  const c = (s: number) => Math.round(((a >> s) & 255) + ((((b >> s) & 255) - ((a >> s) & 255)) * f)) << s;
  return c(16) | c(8) | c(0);
}
