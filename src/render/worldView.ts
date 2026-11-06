import { v } from './assetUrl';
import Phaser from 'phaser';
import { GridMap, type DecorPlace, type WorldGrid, type WorldMapEntry } from '../sim/gridmap';
import { ISO } from '../sim/iso';

/** Rayon (en cartes) chargé autour du joueur, et rayon au-delà duquel une carte est déchargée.
 *  Entre les deux, une carte déjà chargée reste : pas de va-et-vient quand on longe un bord. */
const LOAD_RING = 1, UNLOAD_RING = 2;

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
  /** Bouts de portes (sim/world.ts) : un repère doré au sol est posé sur chacun quand sa carte est chargée. */
  portes: { tag: string; x: number; y: number }[] = [];
  /** Cartes en téléchargement, et textures prêtes à envoyer à la carte graphique (une par image, voir fetchMap). */
  private readonly fetching = new Set<string>();
  private readonly uploads: { m: WorldMapEntry; add: () => void }[] = [];
  /** Ambiance (render/ambiance.ts) : teinte des cartes et force des lumières, appliquées aux objets posés et à venir. */
  private tint = 0xffffff;
  private lum = 1;
  private sol = 1;
  /** Décor qui bouge (maquette « Vivant ») : arbres au vent, eau qui glisse ou change de couleur. Coupables dans les Réglages. */
  private readonly vivants: { im: Phaser.GameObjects.Image; p: DecorPlace; x0: number; y0: number; ph: number }[] = [];
  vent = true;
  eau = true;

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
    for (const m of world.maps) if (ring(m, start[0], start[1]) <= LOAD_RING) WorldView.queue(scene, m, dir, prefix);
  }
  private static queue(scene: Phaser.Scene, m: WorldMapEntry, dir: string, prefix: string) {
    scene.load.image(WorldView.key(prefix, `sol_${m.tag}`), v(`${dir}/sol_${m.tag}.webp`));
    for (const c of CALQUES) if (m[c]) scene.load.image(WorldView.key(prefix, `${c}_${m.tag}`), v(`${dir}/${c}_${m.tag}.webp`));
    scene.load.atlas(WorldView.key(prefix, `decor_${m.tag}`), v(`${dir}/decor_${m.tag}.webp`), v(`${dir}/decor_${m.tag}.json`));
  }

  /** Après preload : pose le ciel et les cartes déjà chargées. */
  create() {
    if (this.scene.textures.exists(this.k('ciel'))) this.sky = this.scene.add.image(0, 0, this.k('ciel')).setScrollFactor(0).setDepth(-20000).setTint(this.tint);
    for (const m of this.wg.world.maps) if (this.texturesReady(m)) { this.slots.get(m.tag)!.state = 'loading'; this.build(m); }
    this.pump(Infinity);   // au lancement, tout de suite (l'écran de chargement couvre)
  }

  isReady(tag: string | undefined) { return !!tag && this.slots.get(tag)?.state === 'ready'; }

  /** Chaque image : ciel qui suit la caméra ; quand le joueur change de carte, charge / décharge autour de lui. */
  update(px: number, py: number) {
    this.drawSky();
    this.upload();
    this.pump();
    this.animate(this.scene.time.now / 1000);
    const here = this.wg.mapAt(px, py);
    if (!here || here.tag === this.center) return;
    this.center = here.tag;
    // intérieur : pas de ciel, fond noir comme dans Dofus
    this.sky?.setVisible(!here.inside);
    this.scene.cameras.main.setBackgroundColor(here.inside ? '#000000' : '#0d2b36');
    for (const m of this.wg.world.maps) {
      const d = ring(m, here.x, here.y), s = this.slots.get(m.tag)!;
      if (d <= LOAD_RING && s.state === 'none') {
        s.state = 'loading';
        if (this.texturesReady(m)) this.build(m);
        else this.fetchMap(m);
      } else if (d > UNLOAD_RING && s.state !== 'none') this.unload(m);   // 'loading' : la carte arrivera pour rien, build() la jette
    }
  }

  /** En jeu, une carte se charge sans saccade : les images sont téléchargées et décodées hors du fil principal
   *  (createImageBitmap), puis envoyées à la carte graphique une par image (le chargeur de Phaser décodait tout d'un coup
   *  au passage d'une carte à l'autre : mini-gel). */
  private fetchMap(m: WorldMapEntry) {
    if (this.fetching.has(m.tag)) return;
    this.fetching.add(m.tag);
    const tex = this.scene.textures, url = (n: string) => v(`${this.dir}/${n}`);
    const bmp = (n: string) => fetch(url(n)).then(r => { if (!r.ok) throw new Error(n); return r.blob(); })
      .then(b => createImageBitmap(b, { premultiplyAlpha: 'premultiply' }));
    const image = (n: string) => bmp(`${n}.webp`).then(b => () => { if (!tex.exists(this.k(n))) tex.addImage(this.k(n), b as unknown as HTMLImageElement); });
    const jobs = [image(`sol_${m.tag}`), ...CALQUES.filter(c => m[c]).map(c => image(`${c}_${m.tag}`)),
      Promise.all([bmp(`decor_${m.tag}.webp`), fetch(url(`decor_${m.tag}.json`)).then(r => r.json())])
        .then(([b, j]) => () => { if (!tex.exists(this.k(`decor_${m.tag}`))) tex.addAtlas(this.k(`decor_${m.tag}`), b as unknown as HTMLImageElement, j); })];
    Promise.all(jobs).then(adds => { for (const add of adds) this.uploads.push({ m, add }); })
      .catch(e => console.warn('Carte non chargée', m.tag, e))
      .finally(() => this.fetching.delete(m.tag));
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
    return this.scene.textures.exists(this.k(`sol_${m.tag}`)) && this.scene.textures.exists(this.k(`decor_${m.tag}`))
      && CALQUES.every(c => !m[c] || this.scene.textures.exists(this.k(`${c}_${m.tag}`)));
  }
  private onFile(key: string) {
    const tag = key.replace(new RegExp(`^${this.prefix}_(sol|fond|bord|decor)_`), '');
    const m = this.wg.world.maps.find(x => x.tag === tag), s = m && this.slots.get(tag);
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
    s.objs.push(this.scene.add.image(o.x, o.y, this.k(`sol_${m.tag}`)).setOrigin(0).setScale(S).setDepth(-10000).setTint(this.tint));
    if (m.fond) {   // nuages et rayons qui débordent sur les voisins : sous tous les sols
      const f = wg.toScreen(m.fond.x, m.fond.y);
      s.objs.push(this.scene.add.image(f.x, f.y, this.k(`fond_${m.tag}`)).setOrigin(0).setScale(S * (m.fond.k ?? 1)).setDepth(-15000).setTint(this.tint));
    }
    // débords en fondu sur les voisines : au-dessus de tous les sols, sous le décor
    if (m.bord) {
      const f = wg.toScreen(m.bord.x, m.bord.y);
      s.objs.push(this.scene.add.image(f.x, f.y, this.k(`bord_${m.tag}`)).setOrigin(0).setScale(S).setDepth(-9999).setTint(this.tint));
    }
    s.next = 0;
    for (const p of this.portes) if (p.tag === m.tag) {
      const c = ISO.toScreen(p.x, p.y), g = this.scene.add.graphics().setPosition(c.x, c.y).setDepth(c.y - 2);   // comme une ombre : au-dessus du sol et des tapis
      g.fillStyle(0xffd36a, 0.35).fillEllipse(0, 0, 92, 46).lineStyle(3, 0xfff0b0, 1).strokeEllipse(0, 0, 92, 46);
      this.scene.tweens.add({ targets: g, alpha: 0.5, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      s.objs.push(g);
    }
    s.state = 'ready';
    this.pump(m.tag === this.center ? Infinity : BUDGET_MS);   // la carte du joueur tout de suite, les voisines au fil des images
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
        const sp = wg.toScreen(p.x, p.y), im = this.scene.add.image(sp.x, sp.y, this.k(`decor_${m.tag}`), p.f).setScale(S * (p.z ?? 1));
        if (p.c < 0) im.setDepth(-9990 + p.o * 0.01);   // lumière posée sur le sol : au-dessus du sol, sous le décor
        else { const cc = wg.cellCenter(p.c), cs = wg.toScreen(cc.x, cc.y + h / 2); im.setDepth(cs.y + p.o * 0.01); }
        if (p.b) this.light(im, p);
        else im.setTint(this.tint);
        if (p.c < 0 && p.g) im.setDepth(-9998 + p.o * 0.0001);   // eau animée : juste au-dessus du sol, sous les lumières
        if (p.w || p.t || p.ca) {
          // vent : l'arbre plie depuis son pied (origine en bas) ; phase tirée de sa position, pour ne pas bouger tous ensemble
          if (p.w) { im.setOrigin(0.5, 1); im.y += (im.height * im.scaleY) / 2; }
          this.vivants.push({ im, p, x0: im.x, y0: im.y, ph: (p.x * 0.013 + p.y * 0.007) % (Math.PI * 2) });
        }
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
        const a = this.eau ? p.t[2] * Math.sin(t * Math.PI * 2 * p.t[3] * 4 + v.ph) : 0;
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
    this.dropTextures(m);
  }
  private dropTextures(m: WorldMapEntry) {
    for (const n of [`sol_${m.tag}`, `decor_${m.tag}`, ...CALQUES.map(c => `${c}_${m.tag}`)]) if (this.scene.textures.exists(this.k(n))) this.scene.textures.remove(this.k(n));
    this.scene.cache.json.remove(this.k(`decor_${m.tag}`));
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
