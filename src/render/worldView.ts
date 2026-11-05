import { v } from './assetUrl';
import Phaser from 'phaser';
import { GridMap, type WorldGrid, type WorldMapEntry } from '../sim/gridmap';
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
    if (this.scene.textures.exists(this.k('ciel'))) this.sky = this.scene.add.image(0, 0, this.k('ciel')).setScrollFactor(0).setDepth(-20000);
    for (const m of this.wg.world.maps) if (this.texturesReady(m)) { this.slots.get(m.tag)!.state = 'loading'; this.build(m); }
    this.pump(Infinity);   // au lancement, tout de suite (l'écran de chargement couvre)
  }

  isReady(tag: string | undefined) { return !!tag && this.slots.get(tag)?.state === 'ready'; }

  /** Chaque image : ciel qui suit la caméra ; quand le joueur change de carte, charge / décharge autour de lui. */
  update(px: number, py: number) {
    this.drawSky();
    this.pump();
    const here = this.wg.mapAt(px, py);
    if (!here || here.tag === this.center) return;
    this.center = here.tag;
    // intérieur : pas de ciel, fond noir comme dans Dofus
    this.sky?.setVisible(!here.inside);
    this.scene.cameras.main.setBackgroundColor(here.inside ? '#000000' : '#0d2b36');
    let queued = false;
    for (const m of this.wg.world.maps) {
      const d = ring(m, here.x, here.y), s = this.slots.get(m.tag)!;
      if (d <= LOAD_RING && s.state === 'none') {
        s.state = 'loading';
        if (this.texturesReady(m)) this.build(m);
        else { WorldView.queue(this.scene, m, this.dir, this.prefix); queued = true; }
      } else if (d > UNLOAD_RING && s.state !== 'none') this.unload(m);   // 'loading' : la carte arrivera pour rien, build() la jette
    }
    if (queued && !this.scene.load.isLoading()) this.scene.load.start();
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
    s.objs.push(this.scene.add.image(o.x, o.y, this.k(`sol_${m.tag}`)).setOrigin(0).setScale(S).setDepth(-10000));
    if (m.fond) {   // nuages et rayons qui débordent sur les voisins : sous tous les sols
      const f = wg.toScreen(m.fond.x, m.fond.y);
      s.objs.push(this.scene.add.image(f.x, f.y, this.k(`fond_${m.tag}`)).setOrigin(0).setScale(S * (m.fond.k ?? 1)).setDepth(-15000));
    }
    // débords en fondu sur les voisines : au-dessus de tous les sols, sous le décor
    if (m.bord) {
      const f = wg.toScreen(m.bord.x, m.bord.y);
      s.objs.push(this.scene.add.image(f.x, f.y, this.k(`bord_${m.tag}`)).setOrigin(0).setScale(S).setDepth(-9999));
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
        const sp = wg.toScreen(p.x, p.y), cc = wg.cellCenter(p.c), cs = wg.toScreen(cc.x, cc.y + h / 2);
        s.objs.push(this.scene.add.image(sp.x, sp.y, this.k(`decor_${m.tag}`), p.f).setScale(S).setDepth(cs.y + p.o * 0.01));
      }
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
