import Phaser from 'phaser';
import { Assemblage } from './squelette';

/** Le perso du joueur dessiné en direct (maquette Apparence 3A) : chaque image de ses animations est dessinée par
 *  l'Assemblage (squelette + corps + tête + couleurs) la première fois qu'elle sert, puis rangée dans des pages
 *  de 2048 px (textures Phaser). Les images ont la même cellule, le même pied et la même échelle que les anciennes
 *  planches (perso_planche.py : boîte -260,-1000,260,120 à l'échelle 0,7), donc EntityView les affiche pareil. */
export class PersoVivant {
  /** Finesse : les images sont faites RESOLUTION fois plus grandes que les anciennes planches, et le sprite est réduit
   *  d'autant (la caméra agrandit le jeu : en 1x, le perso était flou et ses bords en escalier). */
  static readonly RESOLUTION = 2;
  static readonly ECHELLE = 0.7 * PersoVivant.RESOLUTION;
  static readonly CELLULE: [number, number] = [364 * PersoVivant.RESOLUTION, 784 * PersoVivant.RESOLUTION];
  static readonly PIED: [number, number] = [182 * PersoVivant.RESOLUTION, 700 * PersoVivant.RESOLUTION];
  private static readonly PAGE = 2048;
  private static n = 0;
  /** Suréchantillonnage : chaque image est dessinée SUR fois plus grande sur ce brouillon, puis réduite dans sa page. */
  private static readonly SUR = 1;
  private static readonly brouillon = document.createElement('canvas');
  /** Image juste dessinée, à sa taille exacte : c'est elle qu'on envoie à la carte graphique (pas la page entière). */
  private static readonly envoi = document.createElement('canvas');
  private pages: { tex: Phaser.Textures.CanvasTexture; x: number; y: number; h: number; sale: boolean }[] = [];
  private faites = new Map<string, [string, string]>();
  private file: [string, number][] = [];
  private readonly id = PersoVivant.n++;
  readonly compte: Record<string, number>;

  constructor(private scene: Phaser.Scene, readonly a: Assemblage) {
    this.compte = a.compte;
    // À dessiner d'avance, dans les moments calmes : repos et course (8 directions), coup de poing, coup reçu
    for (const k of Object.keys(this.compte)) if (/^Anim(StatiqueExplo0|Course|Arme0|Hit)_/.test(k)) this.attendre(k);
  }

  /** Met toutes les images d'une animation dans la file des images à dessiner d'avance. */
  attendre(anim: string) { for (let i = 0; i < (this.compte[anim] ?? 0); i++) if (!this.faites.has(`${anim}_${i}`)) this.file.push([anim, i]); }

  /** Texture et nom de l'image `idx` de `anim` (AnimCourse_1...), dessinée si besoin. */
  image(anim: string, idx: number): [string, string] {
    const nom = `${anim}_${idx}`;
    let f = this.faites.get(nom);
    if (!f) f = this.dessiner(anim, idx);
    return f;
  }

  private page(w: number, h: number) {
    const P = PersoVivant.PAGE;
    let p = this.pages[this.pages.length - 1];
    if (p && p.x + w > P) { p.x = 0; p.y += p.h; p.h = 0; }
    if (!p || p.y + h > P) {
      const tex = this.scene.textures.createCanvas(`vivant_${this.id}_${this.pages.length}`, P, P)!;
      p = { tex, x: 0, y: 0, h: 0, sale: false };
      this.pages.push(p);
    }
    return p;
  }

  private dessiner(anim: string, idx: number): [string, string] {
    const [cw, ch] = PersoVivant.CELLULE, [ox, oy] = PersoVivant.PIED, sc = PersoVivant.ECHELLE, nom = `${anim}_${idx}`;
    const b = this.a.bornes(anim, idx);
    let x0 = 0, y0 = 0, x1 = 1, y1 = 1;
    if (b) {
      x0 = Math.max(0, Math.floor(ox + b[0] * sc) - 2); y0 = Math.max(0, Math.floor(oy + b[1] * sc) - 2);
      x1 = Math.min(cw, Math.ceil(ox + b[2] * sc) + 2); y1 = Math.min(ch, Math.ceil(oy + b[3] * sc) + 2);
      if (x1 <= x0 || y1 <= y0) { x0 = y0 = 0; x1 = y1 = 1; }
    }
    const w = x1 - x0, h = y1 - y0, p = this.page(w + 2, h + 2), px = p.x + 1, py = p.y + 1;
    if (b) {
      // dessiné SUR fois plus grand sur un brouillon puis réduit (bords plus lisses) ; à 1, la RESOLUTION suffit
      const t = PersoVivant.brouillon, S = PersoVivant.SUR;
      if (t.width < w * S || t.height < h * S) { t.width = Math.max(t.width, w * S); t.height = Math.max(t.height, h * S); }
      const tc = t.getContext('2d')!;
      tc.setTransform(1, 0, 0, 1, 0, 0); tc.clearRect(0, 0, w * S, h * S);
      this.a.dessiner(tc, anim, idx, (ox - x0) * S, (oy - y0) * S, sc * S);
      const ctx = p.tex.getContext();
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(t, 0, 0, w * S, h * S, px, py, w, h);
      if (!this.envoyer(p.tex, t, w * S, h * S, px, py, w, h)) p.sale = true;
    }
    p.x += w + 2; p.h = Math.max(p.h, h + 2);
    const fr = p.tex.add(nom, 0, px, py, w, h)!;
    fr.setTrim(cw, ch, x0, y0, w, h);
    const r: [string, string] = [p.tex.key, nom];
    this.faites.set(nom, r);
    return r;
  }

  /** Envoie seulement le rectangle de l'image neuve dans la texture de sa page (texSubImage2D). Avant, toute la page
   *  (2048 x 2048, 16 Mo) repartait vers la carte graphique, avec ses mipmaps, à chaque image dessinée : une saccade à
   *  chaque nouvelle image d'un sort. Faux (canevas sans WebGL, contexte perdu) : la page sera rafraîchie en entier. */
  private envoyer(tex: Phaser.Textures.CanvasTexture, src: HTMLCanvasElement, sw: number, sh: number, px: number, py: number, w: number, h: number): boolean {
    const r = this.scene.renderer as Phaser.Renderer.WebGL.WebGLRenderer, gl = r.gl as WebGLRenderingContext | undefined;
    const wrap = tex.source[0]?.glTexture as (Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper & { pma?: boolean }) | null;
    if (!gl || !wrap?.webGLTexture || gl.isContextLost()) return false;
    const e = PersoVivant.envoi;
    if (e.width !== w || e.height !== h) { e.width = w; e.height = h; }
    const ec = e.getContext('2d');
    if (!ec) return false;
    ec.clearRect(0, 0, w, h); ec.imageSmoothingEnabled = true; ec.imageSmoothingQuality = 'high';
    ec.drawImage(src, 0, 0, sw, sh, 0, 0, w, h);
    // mêmes réglages que Phaser (WebGLTextureWrapper._processTexture), texture d'avant remise en place
    gl.activeTexture(gl.TEXTURE0);
    const avant = gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture | null;
    gl.bindTexture(gl.TEXTURE_2D, wrap.webGLTexture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, wrap.pma ?? true);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, !!wrap.flipY);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, px, py, gl.RGBA, gl.UNSIGNED_BYTE, e);
    gl.bindTexture(gl.TEXTURE_2D, avant);
    return true;
  }

  /** Cadre du visage pour le portrait du HUD, en pixels de la cellule : centre (x, y) et côté ; null si pas de tête. */
  cadreTete(anim: string, idx: number): [number, number, number] | null {
    const b = this.a.bornesTete(anim, idx);
    if (!b) return null;
    const [ox, oy] = PersoVivant.PIED, sc = PersoVivant.ECHELLE;
    const cote = Math.max(b[2] - b[0], b[3] - b[1]) * sc * 1.75;
    return [ox + ((b[0] + b[2]) / 2) * sc, oy + ((b[1] + b[3]) / 2) * sc + cote * 0.02, cote];
  }

  /** À appeler une fois par image du jeu : dessine d'avance pendant `ms` millisecondes au plus,
   *  puis envoie à la carte graphique les pages modifiées. */
  maj(ms = 3) {
    const fin = performance.now() + ms;
    while (this.file.length && performance.now() < fin) {
      const [a, i] = this.file.shift()!;
      if (!this.faites.has(`${a}_${i}`)) this.dessiner(a, i);
    }
    for (const p of this.pages) if (p.sale) { p.tex.refresh(); p.sale = false; }
  }

  destroy() { for (const p of this.pages) p.tex.destroy(); this.pages = []; this.faites.clear(); }
}

/** Fichier « en attente » pour le chargeur de Phaser : l'écran de chargement attend que la promesse soit tenue. */
export class Attente extends Phaser.Loader.File {
  constructor(loader: Phaser.Loader.LoaderPlugin, key: string, private promesse: Promise<unknown>) {
    super(loader, { type: 'attente', key, url: 'attente' });
  }
  load() {
    this.state = Phaser.Loader.FILE_LOADING;
    this.promesse.then(() => { this.state = Phaser.Loader.FILE_LOADED; this.loader.nextFile(this, true); },
      () => { this.state = Phaser.Loader.FILE_LOADED; this.loader.nextFile(this, false); });
  }
}
