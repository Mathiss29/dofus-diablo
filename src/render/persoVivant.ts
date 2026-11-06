import Phaser from 'phaser';
import { Assemblage } from './squelette';

/** Le perso du joueur dessiné en direct (maquette Apparence 3A) : chaque image de ses animations est dessinée par
 *  l'Assemblage (squelette + corps + tête + couleurs) la première fois qu'elle sert, puis rangée dans des pages
 *  de 2048 px (textures Phaser). Les images ont la même cellule, le même pied et la même échelle que les anciennes
 *  planches (perso_planche.py : boîte -260,-1000,260,120 à l'échelle 0,7), donc EntityView les affiche pareil. */
export class PersoVivant {
  static readonly ECHELLE = 0.7;
  static readonly CELLULE: [number, number] = [364, 784];
  static readonly PIED: [number, number] = [182, 700];
  private static readonly PAGE = 2048;
  private static n = 0;
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
      const ctx = p.tex.getContext();
      ctx.save(); ctx.beginPath(); ctx.rect(px, py, w, h); ctx.clip();
      this.a.dessiner(ctx, anim, idx, px - x0 + ox, py - y0 + oy, sc);
      ctx.restore();
      p.sale = true;
    }
    p.x += w + 2; p.h = Math.max(p.h, h + 2);
    const fr = p.tex.add(nom, 0, px, py, w, h)!;
    fr.setTrim(cw, ch, x0, y0, w, h);
    const r: [string, string] = [p.tex.key, nom];
    this.faites.set(nom, r);
    return r;
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
