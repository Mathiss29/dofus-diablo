import Phaser from 'phaser';

/** Voir son perso (et les monstres) derrière les bâtiments et le décor (demande de Mathis, 2026-11-06, rendu de Sanstour).
 *  Le décor de la carte est fait de grandes images triées en profondeur : une image passe « devant » un perso quand
 *  sa profondeur est plus grande et que ses pixels opaques couvrent le corps du perso. On teste quelques points du corps
 *  sur les pixels de l'image (pas son rectangle : un arbre ne s'efface pas quand on passe à côté de son tronc).
 *
 *  Choix de Mathis (maquette « Transparence », ligne 1A 2A 3A 4A 5A 6A) : le décor qui couvre le perso passe en fondu à 40 %
 *  (seulement ces morceaux, comme Sanstour) ; les monstres cachés ont une silhouette rouge sur le décor, qui reste plein
 *  (effacer le décor pour chaque monstre ferait clignoter toute la carte en combat). Case « Voir à travers le décor » dans les Options. */
export interface ReglagesTransparence { actif: boolean; alpha: number }

/** Ce qui peut être caché : un sprite, ses pieds (x, y à l'écran), la taille de son corps. */
export interface Cache { id: number; sprite: Phaser.GameObjects.Sprite; joueur: boolean; w: number; h: number }

type Piece = { im: Phaser.GameObjects.Image; x0: number; y0: number; x1: number; y1: number };

/** Taille d'une case de la grille de recherche (pixels du monde à l'écran). */
const CASE = 256;
/** Vitesse du fondu (part du chemin faite par seconde) : ~0,15 s pour s'effacer. */
const VITESSE = 14;

export class Transparence {
  static reglages: ReglagesTransparence = { actif: true, alpha: 0.4 };

  /** Décor rangé par cases de CASE pixels : on ne teste que les images proches d'un perso. */
  private readonly grille = new Map<number, Piece[]>();
  /** Images en cours de fondu -> transparence actuelle (1 = opaque). */
  private readonly fondus = new Map<Phaser.GameObjects.Image, number>();
  /** Images à effacer, et celles qui cachent un monstre (recalculées 10 fois par seconde). */
  private cibles = new Set<Phaser.GameObjects.Image>();
  private masquants: Phaser.GameObjects.Image[] = [];
  private cachesSil = new Map<number, Cache>();
  private t = 0;

  /** Silhouettes : dessinées dans une texture de la taille de l'écran, puis découpées à la forme du décor qui cache
   *  (2e texture = l'écran moins ce décor, effacée du calque). Pas de BitmapMask : avec la caméra de la
   *  mini-carte, Phaser 3.80 dessinait la mini-carte en grand au milieu de l'écran. */
  readonly calque: Phaser.GameObjects.RenderTexture;
  private readonly formes: Phaser.GameObjects.RenderTexture;
  private readonly sil = new Map<number, Phaser.GameObjects.Sprite>();
  private readonly copie: Phaser.GameObjects.Image;

  constructor(private readonly scene: Phaser.Scene) {
    const cam = scene.cameras.main, W = Math.max(1, cam.width), H = Math.max(1, cam.height);
    this.calque = scene.add.renderTexture(0, 0, W, H).setOrigin(0).setScrollFactor(0).setDepth(5e5).setVisible(false);
    this.formes = scene.make.renderTexture({ x: 0, y: 0, width: W, height: H }, false).setOrigin(0);
    this.copie = scene.make.image({}, false);
  }

  /** Une image de décor posée (pas le sol ni les lumières). */
  ajouter(im: Phaser.GameObjects.Image) {
    const sx = Math.abs(im.scaleX), sy = Math.abs(im.scaleY);
    const x0 = im.x - im.displayOriginX * sx, y0 = im.y - im.displayOriginY * sy;
    const p: Piece = { im, x0, y0, x1: x0 + im.width * sx, y1: y0 + im.height * sy };
    for (let cy = Math.floor(p.y0 / CASE); cy <= Math.floor(p.y1 / CASE); cy++)
      for (let cx = Math.floor(p.x0 / CASE); cx <= Math.floor(p.x1 / CASE); cx++) {
        const k = cle(cx, cy), l = this.grille.get(k);
        if (l) l.push(p); else this.grille.set(k, [p]);
      }
  }
  /** Images détruites (carte déchargée) : on les oublie. */
  private nettoyer() {
    for (const [k, l] of this.grille) {
      const r = l.filter(p => p.im.active);
      if (!r.length) this.grille.delete(k); else if (r.length !== l.length) this.grille.set(k, r);
    }
    for (const im of this.fondus.keys()) if (!im.active) this.fondus.delete(im);
  }

  private proches(x0: number, y0: number, x1: number, y1: number) {
    const vus = new Set<Piece>();
    for (let cy = Math.floor(y0 / CASE); cy <= Math.floor(y1 / CASE); cy++)
      for (let cx = Math.floor(x0 / CASE); cx <= Math.floor(x1 / CASE); cx++)
        for (const p of this.grille.get(cle(cx, cy)) ?? []) if (p.im.active && p.im.visible && p.x0 < x1 && p.x1 > x0 && p.y0 < y1 && p.y1 > y0) vus.add(p);
    return vus;
  }

  /** Le pixel (x, y) de l'écran est-il opaque sur cette image de décor ? */
  private opaque(p: Piece, x: number, y: number) {
    const im = p.im, sx = im.scaleX, sy = im.scaleY;
    let lx = (x - im.x) / sx + im.displayOriginX, ly = (y - im.y) / sy + im.displayOriginY;
    if (im.rotation) {   // arbre au vent : petite rotation autour de l'origine
      const c = Math.cos(-im.rotation), s = Math.sin(-im.rotation), dx = (lx - im.displayOriginX) * sx, dy = (ly - im.displayOriginY) * sy;
      lx = (dx * c - dy * s) / sx + im.displayOriginX; ly = (dx * s + dy * c) / sy + im.displayOriginY;
    }
    if (lx < 0 || ly < 0 || lx >= im.width || ly >= im.height) return false;
    const a = this.scene.textures.getPixelAlpha(Math.floor(lx), Math.floor(ly), im.texture.key, im.frame.name);
    return (a ?? 0) > 110;
  }

  /** Les images de décor devant ce perso qui couvrent son corps. */
  private devant(c: Cache) {
    const s = c.sprite, fx = s.x, fy = s.y, w = c.w, h = c.h;
    const res: Piece[] = [];
    for (const p of this.proches(fx - w / 2, fy - h, fx + w / 2, fy)) {
      if (p.im.depth <= s.depth) continue;
      let n = 0;
      for (const ky of [0.12, 0.35, 0.6, 0.85]) for (const kx of [-0.3, 0, 0.3])
        if (this.opaque(p, fx + kx * w, fy - ky * h)) n++;
      if (n >= 2) res.push(p);
    }
    return res;
  }

  /** Un bâtiment est fait de plusieurs images (murs, toit, porte, fenêtres, enseigne) : n'effacer que celles qui couvrent
   *  le perso laissait une façade pâle avec sa porte et son toit pleins par-dessus, comme deux bâtiments collés
   *  (retour de Mathis, 2026-11-07). On efface aussi les images devant le perso qui tiennent pour moitié au moins
   *  dans ce qui le couvre : la porte et les fenêtres suivent leur mur, le bâtiment d'à côté reste plein. */
  private batiment(d: Piece[], c: Cache) {
    if (!d.length) return d;
    const res = new Set(d);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of d) { x0 = Math.min(x0, p.x0); y0 = Math.min(y0, p.y0); x1 = Math.max(x1, p.x1); y1 = Math.max(y1, p.y1); }
    for (const p of this.proches(x0, y0, x1, y1)) {
      if (res.has(p) || p.im.depth <= c.sprite.depth) continue;
      const w = Math.min(x1, p.x1) - Math.max(x0, p.x0), h = Math.min(y1, p.y1) - Math.max(y0, p.y0);
      if (w > 0 && h > 0 && w * h * 2 >= (p.x1 - p.x0) * (p.y1 - p.y0)) res.add(p);
    }
    return [...res];
  }

  /** À chaque image, après la mise à jour des sprites. */
  update(dt: number, caches: Cache[]) {
    const R = Transparence.reglages;
    this.t -= dt;
    if (this.t <= 0) {
      this.t = 0.1;
      this.nettoyer();
      const cibles = new Set<Phaser.GameObjects.Image>(), masquants = new Set<Phaser.GameObjects.Image>();
      this.cachesSil = new Map();
      if (R.actif) for (const c of caches) {
        if (!c.sprite.visible) continue;
        const d = this.devant(c);
        if (!d.length) continue;
        if (c.joueur) for (const p of this.batiment(d, c)) cibles.add(p.im);
        else { this.cachesSil.set(c.id, c); for (const p of d) masquants.add(p.im); }
      }
      this.cibles = cibles;
      this.masquants = [...masquants];
    }
    // fondu doux vers la cible
    const k = 1 - Math.exp(-VITESSE * dt);
    for (const im of this.cibles) if (!this.fondus.has(im)) this.fondus.set(im, im.alpha);
    for (const [im, a] of this.fondus) {
      if (!im.active) { this.fondus.delete(im); continue; }
      const but = this.cibles.has(im) ? R.alpha : 1, na = Math.abs(but - a) < 0.01 ? but : a + (but - a) * k;
      im.setAlpha(na);
      if (na === 1) this.fondus.delete(im); else this.fondus.set(im, na);
    }
    this.silhouettes(caches);
  }

  /** Silhouettes rouges des monstres, visibles seulement là où le décor les cache. */
  private silhouettes(caches: Cache[]) {
    const vus: Phaser.GameObjects.Sprite[] = [], ids = new Set<number>();
    for (const c of caches) {
      if (!this.cachesSil.has(c.id) || !c.sprite.visible) continue;
      ids.add(c.id);
      let s = this.sil.get(c.id);
      if (!s) { s = this.scene.make.sprite({ key: c.sprite.texture.key }, false); this.sil.set(c.id, s); }
      vus.push(s.setTintFill(0xff4a3a).setAlpha(0.75 * c.sprite.alpha));
    }
    for (const [id, s] of this.sil) if (!ids.has(id) && !caches.some(c => c.id === id)) { s.destroy(); this.sil.delete(id); }
    this.masquants = this.masquants.filter(im => im.active);
    const on = vus.length > 0 && this.masquants.length > 0;
    this.calque.setVisible(on);
    if (!on) return;
    // l'écran : position et taille des textures, en suivant le zoom de la caméra
    const cam = this.scene.cameras.main, W = cam.width, H = cam.height, z = cam.zoom, v = cam.worldView;
    if (this.calque.width !== W || this.calque.height !== H) { this.calque.resize(W, H); this.formes.resize(W, H); }
    this.calque.setScale(1 / z).setPosition(W / 2 - W / 2 / z, H / 2 - H / 2 / z);
    const place = (d: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite, o: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite) =>
      d.setTexture(o.texture.key, o.frame.name).setOrigin(o.originX, o.originY).setRotation(o.rotation)
        .setPosition((o.x - v.x) * z, (o.y - v.y) * z).setScale(o.scaleX * z, o.scaleY * z);
    // formes = tout l'écran SAUF le décor qui cache ; effacer ça du calque garde les silhouettes sur ce décor seulement
    this.formes.clear().fill(0xffffff, 1);
    for (const im of this.masquants) { place(this.copie, im); this.formes.erase(this.copie); }
    this.calque.clear();
    let i = 0;
    for (const c of caches) {
      const s = this.sil.get(c.id);
      if (!s || !ids.has(c.id)) continue;
      place(s, c.sprite); this.calque.draw(s); i++;
    }
    if (i) this.calque.erase(this.formes, 0, 0);
  }

  destroy() {
    for (const [im] of this.fondus) if (im.active) im.setAlpha(1);
    for (const s of this.sil.values()) s.destroy();
    this.calque.destroy(); this.formes.destroy(); this.copie.destroy();
  }
}

function cle(cx: number, cy: number) { return (cy + 4096) * 8192 + (cx + 4096); }
