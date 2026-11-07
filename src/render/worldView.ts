import { v } from './assetUrl';
import Phaser from 'phaser';
import { GridMap, MAP_COLS, MAP_ROWS, type DecorPlace, type WorldGrid, type WorldMapEntry } from '../sim/gridmap';
import { ISO } from '../sim/iso';
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
export class WorldView {
  private readonly slots = new Map<string, Slot>();
  sky?: Phaser.GameObjects.Image;
  private center = '';
  private viewT = 0;
  /** Bouts de portes (sim/world.ts) : un repère doré au sol est posé sur chacun quand sa carte est chargée.
   *  `vers` = carte où elle mène (préchargée à l'approche, maquette Entrées 2A) ; `sortie` = sortie d'un intérieur (repère plus visible, 8A). */
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
  private readonly vivants: { im: Phaser.GameObjects.Image; p: DecorPlace; x0: number; y0: number; ph: number }[] = [];
  vent = true;
  eau = true;
  /** Particules officielles des cartes (render/particles.ts), lancées quand une carte est posée. */
  parts?: Particules;
  /** Décor qui s'efface devant le perso et les monstres (render/transparence.ts) : chaque image de décor posée lui est donnée. */
  transparence?: Transparence;
  private lastT = 0;

  /** Cartes du dehors (« x,y ») : un côté sans voisine est un bord du monde (voir brume()). */
  private readonly dehors: Set<string>;

  constructor(private readonly scene: Phaser.Scene, private readonly wg: WorldGrid, private readonly dir: string, private readonly prefix: string) {
    this.dehors = new Set(wg.world.maps.filter(m => !m.inside).map(m => `${m.x},${m.y}`));
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
    this.pump(Infinity);   // au lancement, tout de suite (l'écran de chargement couvre)
  }

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
      // intérieur : pas de ciel, fond noir comme dans Dofus
      // (le Temple Céleste flotte dans le ciel : il le garde)
      this.sky?.setVisible(!here.inside || !!here.ciel);
      this.scene.cameras.main.setBackgroundColor(here.inside && !here.ciel ? '#000000' : '#0d2b36');
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
    this.brume(m, s);
    s.next = 0;
    for (const p of this.portes) if (p.tag === m.tag) {
      const c = ISO.toScreen(p.x, p.y), g = this.scene.add.graphics().setPosition(c.x, c.y).setDepth(c.y - 2);   // comme une ombre : au-dessus du sol et des tapis
      if (p.sortie) {   // sortie d'un intérieur (8A) : halo plus large et plus vif, double anneau
        g.fillStyle(0xffd36a, 0.18).fillEllipse(0, 0, 130, 65).fillStyle(0xffd36a, 0.45).fillEllipse(0, 0, 96, 48)
          .lineStyle(4, 0xfff4c4, 1).strokeEllipse(0, 0, 96, 48).lineStyle(2, 0xffe08a, 0.8).strokeEllipse(0, 0, 118, 59);
      } else g.fillStyle(0xffd36a, 0.35).fillEllipse(0, 0, 92, 46).lineStyle(3, 0xfff0b0, 1).strokeEllipse(0, 0, 92, 46);
      this.scene.tweens.add({ targets: g, alpha: p.sortie ? 0.65 : 0.5, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      s.objs.push(g);
    }
    s.state = 'ready';
    this.parts?.add(m.tag);
    this.pump(m.tag === this.center ? Infinity : this.presse ? 14 : BUDGET_MS);   // la carte du joueur tout de suite, les voisines au fil des images
  }
  /** Bord du monde (monde sans ciel, ex. Astrub) : là où une carte du dehors n'a pas de voisine, son sol s'arrêtait net en escalier
   *  sur le fond, avec des bouts de toits qui flottaient au-delà (Tainéla, retour de Mathis 2026-11-06 ; Dofus ne montre qu'une
   *  carte, on n'y voit jamais ce bord). On fond le bord de la carte dans la couleur du fond, sur 2 cases, puis on couvre le reste. */
  private brume(m: WorldMapEntry, s: Slot) {
    const w = this.wg.world;
    if (w.sky || m.inside) return;
    const g = w.grid, [X0, Y0] = w.origin, S = GridMap.S;
    const x0 = g.ox + Math.floor(g.w / 4) + (m.x - X0) * MAP_COLS * g.w, y0 = g.oy + Math.floor(g.h / 4) + (m.y - Y0) * MAP_ROWS * g.h / 2;
    const a = this.wg.toScreen(x0, y0), W = MAP_COLS * g.w * S, H = MAP_ROWS * g.h / 2 * S;
    const dedans = 2 * g.w * S, dehors = 0.4 * g.w * S, loin = 1600, c = 0x0d2b36;
    const libre = (dx: number, dy: number) => !this.dehors.has(`${m.x + dx},${m.y + dy}`);
    const gr = this.scene.add.graphics().setDepth(1e6);
    const bande = (x: number, y: number, w2: number, h2: number, a1: number, a2: number, a3: number, a4: number) =>
      gr.fillGradientStyle(c, c, c, c, a1, a2, a3, a4).fillRect(x, y, w2, h2);
    const plein = (x: number, y: number, w2: number, h2: number) => gr.fillStyle(c, 1).fillRect(x, y, w2, h2);
    const L = libre(-1, 0), R = libre(1, 0), T = libre(0, -1), B = libre(0, 1), e = dehors + loin;
    if (L) { bande(a.x - dehors, a.y, dedans + dehors, H, 1, 0, 1, 0); plein(a.x - e, a.y, loin, H); }
    if (R) { bande(a.x + W - dedans, a.y, dedans + dehors, H, 0, 1, 0, 1); plein(a.x + W + dehors, a.y, loin, H); }
    if (T) { bande(a.x, a.y - dehors, W, dedans + dehors, 1, 1, 0, 0); plein(a.x, a.y - e, W, loin); }
    if (B) { bande(a.x, a.y + H - dedans, W, dedans + dehors, 0, 0, 1, 1); plein(a.x, a.y + H + dehors, W, loin); }
    // coins : seulement si les deux côtés et la diagonale sont vides
    if (L && T && libre(-1, -1)) plein(a.x - e, a.y - e, e, e);
    if (R && T && libre(1, -1)) plein(a.x + W, a.y - e, e, e);
    if (L && B && libre(-1, 1)) plein(a.x - e, a.y + H, e, e);
    if (R && B && libre(1, 1)) plein(a.x + W, a.y + H, e, e);
    if (gr.commandBuffer.length) s.objs.push(gr); else gr.destroy();
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
        if (p.b) this.light(im, p);
        else im.setTint(this.tint);
        if (p.c < 0 && p.g) im.setDepth(SOL + 2 + p.o * 0.0001);   // eau animée : juste au-dessus du sol, sous les lumières
        if (p.w || p.t || p.ca) {
          // vent : l'arbre plie depuis son pied (origine en bas) ; phase tirée de sa position, pour ne pas bouger tous ensemble
          if (p.w) { im.setOrigin(0.5, 1); im.y += (im.height * im.scaleY) / 2; }
          this.vivants.push({ im, p, x0: im.x, y0: im.y, ph: (p.x * 0.013 + p.y * 0.007) % (Math.PI * 2) });
        }
        if (p.c >= 0 && !p.b) this.transparence?.ajouter(im, p.bt);
        s.objs.push(im);
      }
    }
  }
  /** Fait bouger le décor vivant (arbres au vent, eau). Amplitudes officielles ; vitesses ralenties (trop rapides pour Mathis, 2026-11-06). */
  private animate(t: number) {
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
  /** Lumière officielle (halo, lueur, rayon) : ajoutée à l'image comme dans Dofus, jamais teintée, plus forte la nuit. */
  private light(im: Phaser.GameObjects.Image, p: DecorPlace) {
    im.setBlendMode(p.b === 'a' ? Phaser.BlendModes.ADD : Phaser.BlendModes.SCREEN).setData('k', p.k ?? 1).setData('j', !!p.j);
    const f = p.j ? this.sol : this.lum;
    im.setAlpha(Math.min(1, (p.k ?? 1) * f)).setVisible(f > 0.01);
  }
  /** Change l'ambiance : teinte des cartes (sol, décor, ciel) et force des lumières. Ne refait le travail que si ça a changé. */
  setAmbiance(tint: number, lum: number, sol: number) {
    if (tint === this.tint && Math.abs(lum - this.lum) < 0.01 && Math.abs(sol - this.sol) < 0.01) return;
    this.tint = tint; this.lum = lum; this.sol = sol;
    this.parts?.setAmbiance(tint, lum);
    this.sky?.setTint(tint);
    for (const s of this.slots.values()) for (const o of s.objs) {
      if (!(o instanceof Phaser.GameObjects.Image)) continue;
      const k = o.getData('k') as number | undefined;
      if (k === undefined) o.setTint(tint);   // (l'eau qui change de couleur est reteintée à chaque image par animate)
      else { const f = o.getData('j') ? sol : lum; o.setAlpha(Math.min(1, k * f)).setVisible(f > 0.01); }
    }
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
